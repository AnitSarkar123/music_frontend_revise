/* eslint-disable @typescript-eslint/no-unsafe-assignment */


"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "~/lib/auth";
import { db } from "~/server/db";
import { env } from "~/env";
import { v2 as cloudinary } from "cloudinary";

// Typed Cloudinary client
const cloudinaryClient = (cloudinary as unknown) as {
  url: (publicId: string, options?: Record<string, unknown>) => string;
  uploader: { 
    destroy: (id: string, opts?: Record<string, unknown>) => Promise<{ result: string }>;
    // Explicit upload response shape to avoid 'any' lint errors.
    upload: (file: string, opts?: Record<string, unknown>) => Promise<{
      public_id?: string;
      secure_url?: string;
      url?: string;
      resource_type?: string;
      [key: string]: unknown;
    }>;
  };
  api: {
    // Use a generic Record instead of `any` for api.resources response
    resources: (options: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
  config: (opts: { cloud_name: string; api_key: string; api_secret: string; secure: boolean }) => void;
};

// Configure Cloudinary
cloudinaryClient.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface GenerateRequest {
  prompt?: string;
  lyrics?: string;
  fullDescribedSong?: string;
  describedLyrics?: string;
  instrumental?: boolean;
}

export async function generateSong(generateRequest: GenerateRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth/sign-in");

  await queueSong(generateRequest, 7.5, session.user.id);// here 7.5 is the guidance scale, you can adjust it as needed or make it dynamic based on user input or other factors. it is here used for testing to generate faster results, you can increase it to 15 for better quality but longer generation time.
  // await queueSong(generateRequest, 15, session.user.id);

  revalidatePath("/create");
  revalidatePath("/");
}

export async function queueSong(
  generateRequest: GenerateRequest,
  guidanceScale: number,
  userId: string,
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });

  if (!user || user.credits < 2) {
    throw new Error("Insufficient credits. You need at least 2 credits to generate a song.");
  }
  let title =
    generateRequest.fullDescribedSong ??
    generateRequest.describedLyrics ??
    "Untitled";

  if (title.length > 0) title = title.charAt(0).toUpperCase() + title.slice(1);

  const song = await db.song.create({
    data: {
      userId,
      title,
      prompt: generateRequest.prompt,
      lyrics: generateRequest.lyrics,
      describedLyrics: generateRequest.describedLyrics,
      fullDescribedSong: generateRequest.fullDescribedSong,
      instrumental: generateRequest.instrumental ?? false,
      guidanceScale, 
      audioDuration: 120,
      status: "processing", // Change from queued to processing
    },
  });
  // const { inngest } = await import("~/inngest/client");
  // await inngest.send({
  //   name: "generate-song-event",
  //   data: { 
  //     songId: song.id, 
  //     userId: song.userId,
  //     prompt: generateRequest.prompt,
  //     lyrics: generateRequest.lyrics,
  //     describedLyrics: generateRequest.describedLyrics,
  //     fullDescribedSong: generateRequest.fullDescribedSong,
  //     instrumental: generateRequest.instrumental ?? false,
  //     guidanceScale
  //   },
  // });
  
  console.log("Song generation started:", song.id);

  try {
    // Call Modal backend
    const result = await callModalBackend(generateRequest, guidanceScale);
    
    // Debug the response from Modal
    console.log("Modal backend response:", {
      songId: song.id,
      audioUrl: result.audio_url,
      audioPublicId: result.audio_public_id,
      coverImageUrl: result.cover_image_url,
      coverImagePublicId: result.cover_image_public_id
    });

    // Update song with Cloudinary URLs
    await db.song.update({
      where: { id: song.id },
      data: {
        // Save direct Cloudinary URLs (preferred)
        audioUrl: result.audio_url ?? null,
        coverImageUrl: result.cover_image_url ?? null,
        // Also store public_ids for fallback URL generation
        audioPublicId: result.audio_public_id ?? null,
        coverImagePublicId: result.cover_image_public_id ?? null,
        status: "completed",
      },
    });
    // Deduct credits after successful generation
    await db.user.update({
      where: { id: userId },
      data: {
        credits: {
          decrement: 5,
        },
      },
    });
    // Verify update worked by fetching song
    const updatedSong = await db.song.findUnique({
      where: { id: song.id },
      select: { 
        audioUrl: true, 
        audioPublicId: true,
        coverImageUrl: true,
        coverImagePublicId: true,
        status: true 
      }
    });
    
    console.log("Updated song:", updatedSong);
    
    // If we still don't have URLs, try direct Cloudinary lookup as fallback
    if (!updatedSong?.audioUrl && !updatedSong?.audioPublicId) {
      console.log("No audio data found, trying Cloudinary lookup...");
      try {
        const assets = await browseCloudinaryAssets();
        if (assets.audio.length > 0) {
          // Use most recent audio and image
          const latestAudio = assets.audio[0];
          const latestImage = assets.images.length > 0 ? assets.images[0] : null;
          
          await db.song.update({
            where: { id: song.id },
            data: {
              audioUrl: latestAudio?.url,
              audioPublicId: latestAudio?.public_id,
              coverImageUrl: latestImage?.url ?? null,
              coverImagePublicId: latestImage?.public_id ?? null,
              status: "completed",
            },
          });
          console.log("Updated song with direct Cloudinary assets");
        }
      } catch (fallbackError) {
        console.error("Cloudinary fallback lookup failed:", fallbackError);
      }
    }
  } catch (err) {
    console.error("Generation failed:", err);
    await db.song.update({
      where: { id: song.id },
      data: { status: "failed" },
    });
    throw err;
  }
}

export async function getPlayUrl(songId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth/sign-in");

  const song = await db.song.findUniqueOrThrow({
    where: { id: songId },
    select: {
      userId: true,
      published: true,
      audioUrl: true,
      audioPublicId: true,
      status: true, // Add status field to check generation state
      title: true,   // For logging
    },
  });

  if (song.userId !== session.user.id && !song.published) {
    redirect("/auth/sign-in");
  }

  // Check song status first and provide better error messages
  if (song.status === "queued" || song.status === "processing") {
    throw new Error("Your song is still being generated. Please wait a moment and try again.");
  }
  
  if (song.status === "failed") {
    throw new Error("Song generation failed. Please try creating a new song.");
  }

  await db.song.update({
    where: { id: songId },
    data: { listenCount: { increment: 1 } },
  });

  // Debug information
  console.log("Getting play URL for song:", {
    id: songId,
    title: song.title,
    audioUrl: song.audioUrl,
    audioPublicId: song.audioPublicId,
    status: song.status
  });

  // Prefer saved direct URL
  if (song.audioUrl) return song.audioUrl;

  // Fallback: build URL from Cloudinary public_id
  if (song.audioPublicId) {
    try {
      const url = await getCloudinarySignedUrl(song.audioPublicId);
      // Persist for future reads
      await db.song.update({ 
        where: { id: songId },
        data: { audioUrl: url }
      });
      return url;
    } catch (error) {
      console.error(`Error generating URL for public ID ${song.audioPublicId}:`, error);
    }
  }

  // Last resort: search Cloudinary directly
  try {
    console.log("Searching Cloudinary directly for song:", songId);
    const assets = await browseCloudinaryAssets();
    
    // Try to find by matching public_id containing the song ID or title
    const songIdLower = songId.toLowerCase();
    const titleLower = song.title?.toLowerCase() ?? "";
    
    const matchingAudio = assets.audio.find(asset => 
      asset.public_id.toLowerCase().includes(songIdLower) || 
      (titleLower && asset.public_id.toLowerCase().includes(titleLower))
    );
    
    if (matchingAudio) {
      console.log("Found matching audio in Cloudinary:", matchingAudio);
      await db.song.update({
        where: { id: songId },
        data: { 
          audioUrl: matchingAudio.url,
          audioPublicId: matchingAudio.public_id,
          status: "completed"
        }
      });
      return matchingAudio.url;
    }
    
    // If no match, use most recent as fallback
    if (assets.audio.length > 0) {
      const latestAudio = assets.audio[0];
      console.log("Using most recent audio as fallback:", latestAudio);
      await db.song.update({
        where: { id: songId },
        data: { 
          audioUrl: latestAudio?.url,
          audioPublicId: latestAudio?.public_id,
          status: "completed"
        }
      });
      return latestAudio?.url;
    }
  } catch (lookupError) {
    console.error("Error searching Cloudinary:", lookupError);
  }

  console.error(`Song ${songId} has no audio data. Status: ${song.status}`);
  throw new Error("Audio URL not available for this song. The file may still be processing or wasn't properly saved.");
}

export async function getCloudinarySignedUrl(publicId: string): Promise<string> {
  if (!publicId) throw new Error("Invalid public_id: " + publicId);
  
  if (cloudinaryClient && typeof cloudinaryClient.url === "function") {
    return cloudinaryClient.url(publicId, {
      resource_type: "video", // audio files are uploaded as 'video'
      secure: true,
    });
  }
  throw new Error("Cloudinary client not properly configured");
}

export async function getThumbnailUrl(publicId: string): Promise<string> {
  if (!publicId) throw new Error("Invalid public_id: " + publicId);
  
  if (cloudinaryClient && typeof cloudinaryClient.url === "function") {
    return cloudinaryClient.url(publicId, {
      resource_type: "image",
      secure: true,
      transformation: [
        { width: 300, height: 300, crop: "fill" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });
  }
  throw new Error("Cloudinary client not properly configured");
}

export async function deleteCloudinaryAssets(
  audioPublicId?: string,
  imagePublicId?: string,
) {
  try {
    if (audioPublicId && cloudinaryClient?.uploader?.destroy) {
      await cloudinaryClient.uploader.destroy(audioPublicId, {
        resource_type: "video",
      });
    }
    if (imagePublicId && cloudinaryClient?.uploader?.destroy) {
      await cloudinaryClient.uploader.destroy(imagePublicId, {
        resource_type: "image",
      });
    }
  } catch (error) {
    console.error("Error deleting Cloudinary assets:", error);
  }
}

// --- New Cloudinary Utility Functions ---

// Function to browse/search Cloudinary for assets
export async function browseCloudinaryAssets(
  folderPath = "music-generator",
  limit = 30
): Promise<{
  audio: Array<{id: string, public_id: string, url: string}>,
  images: Array<{id: string, public_id: string, url: string}>
}> {
  try {
    // For testing/debugging
    console.log("Browsing Cloudinary assets in folder:", folderPath);
    
    // We'll use direct Cloudinary URL building instead of API calls for simplicity
    // This assumes your assets are publicly accessible
    
    // In a production environment, you should use the proper Cloudinary Admin API:
    // const resources = await cloudinaryClient.api.resources({
    //   type: 'upload',
    //   prefix: folderPath,
    //   max_results: limit
    // });
    const audioResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/video`, 
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`).toString('base64')}`
        }
      }
    );
    const imageResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image`, 
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`).toString('base64')}`
        }
      }
    );
     
    if (!audioResponse.ok || !imageResponse.ok) {
      console.error("Cloudinary API error:", 
        audioResponse.ok ? "" : await audioResponse.text(),
        imageResponse.ok ? "" : await imageResponse.text()
      );
      throw new Error("Failed to fetch from Cloudinary API");
    }
    
    const audioData = await audioResponse.json();
    const imageData = await imageResponse.json();
    
    // Safely extract resources arrays from possibly-untyped JSON responses.
    // Use runtime checks to avoid unsafe member access on `any`.
    const audioResources = Array.isArray((audioData as { resources?: unknown }).resources)
      ? (audioData as { resources: Record<string, unknown>[] }).resources
      : [];
    const imageResources = Array.isArray((imageData as { resources?: unknown }).resources)
      ? (imageData as { resources: Record<string, unknown>[] }).resources
      : [];
    
    console.log("Cloudinary API response:", {
      audioCount: audioResources.length,
      imageCount: imageResources.length
    });
    
    
   
    // Simplified implementation that returns recently generated assets
        // You would replace this with actual API calls in production
        return {
          audio: audioResources.map((resource: Record<string, unknown>) => {
            const public_id = typeof resource.public_id === "string" ? resource.public_id : "";
            const secure_url = typeof resource.secure_url === "string" ? resource.secure_url : "";
            return {
              id: public_id.split("/").pop() ?? public_id,
              public_id,
              url: secure_url ?? ""
            };
          }),
          images: imageResources.map((resource: Record<string, unknown>) => {
            const public_id = typeof resource.public_id === "string" ? resource.public_id : "";
            const secure_url = typeof resource.secure_url === "string" ? resource.secure_url : "";
            return {
              id: public_id.split("/").pop() ?? public_id,
              public_id,
              url: secure_url ?? ""
            };
          })
        };
    
    
    /* Uncomment and implement properly with the Admin API:
    // Get audio files (stored as "video" resource type in Cloudinary)
    const audioResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/video`, 
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`).toString('base64')}`
        }
      }
    );
    
    // Get image files
    const imageResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image`, 
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`).toString('base64')}`
        }
      }
    );
    
    const audioData = await audioResponse.json();
    const imageData = await imageResponse.json();
    
    return {
      audio: (audioData.resources || []).map((resource: any) => ({
        id: resource.public_id.split('/').pop(),
        public_id: resource.public_id,
        url: resource.secure_url
      })),
      images: (imageData.resources || []).map((resource: any) => ({
        id: resource.public_id.split('/').pop(),
        public_id: resource.public_id,
        url: resource.secure_url
      }))
    };
    */
  } catch (error) {
    console.error("Error browsing Cloudinary assets:", error);
    return { audio: [], images: [] };
  }
}

// Debug function to check what's in Cloudinary
export async function debugCloudinaryAssets() {
  try {
    const assets = await browseCloudinaryAssets();
    console.log("Cloudinary assets found:", {
      audioCount: assets.audio.length,
      imageCount: assets.images.length,
      firstAudio: assets.audio[0],
      firstImage: assets.images[0]
    });
    return assets;
  } catch (error) {
    console.error("Error debugging Cloudinary:", error);
    throw error;
  }
}

// --- Helpers ---

type ModalGenResponse = {
  audio_public_id?: string;
  audio_url?: string;
  cover_image_public_id?: string;
  cover_image_url?: string;
  categories?: string[];
};

async function callModalBackend(
  generateRequest: GenerateRequest,
  guidanceScale: number,
): Promise<ModalGenResponse> {
  // Build payload for Modal endpoints (snake_case to match FastAPI/Pydantic)
  const payload: Record<string, unknown> = {
    prompt: generateRequest.prompt,
    lyrics: generateRequest.lyrics,
    described_lyrics: generateRequest.describedLyrics,
    full_described_song: generateRequest.fullDescribedSong,
    instrumental: !!generateRequest.instrumental,
    guidance_scale: guidanceScale,
    audio_duration: 120,
    seed: -1,
    infer_step: 60,
  };

  // Choose endpoint
  let endpoint = env.GENERATE_WITH_LYRICS;
  if (generateRequest.fullDescribedSong) {
    endpoint = env.GENERATE_FROM_DESCRIPTION;
  } else if (generateRequest.describedLyrics) {
    endpoint = env.GENERATE_FROM_DESCRIBED_LYRICS;
  }

  if (!endpoint) throw new Error("Modal endpoint URL is not set in env.");

  console.log(`Calling Modal endpoint: ${endpoint}`);
  console.log("With payload:", JSON.stringify(payload, null, 2));

  const headersInit: Record<string, string> = { "Content-Type": "application/json" };
  // Include Modal proxy auth only if required by your endpoints
  if (env.MODAL_KEY && env.MODAL_SECRET) {
    headersInit["Modal-Key"] = env.MODAL_KEY;
    headersInit["Modal-Secret"] = env.MODAL_SECRET;
  }

  // Use AbortController to set a timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: headersInit,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.text();
      console.error(`Modal API error: ${res.status} ${res.statusText}`, body);
      throw new Error(`Modal API error: ${res.status} ${res.statusText} - ${body}`);
    }

    const result = await res.json();
    console.log("Modal API success response:", result);
    
    return result as ModalGenResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Narrow the unknown 'error' to a safe shape before accessing properties
    const err = error as { name?: string };
    if (err.name === 'AbortError') {
      throw new Error('Request to Modal backend timed out after 2 minutes');
    }
    
    throw error;
  }
}
// ...existing code...

export async function checkSongStatus(songId: string) {
  const song = await db.song.findUnique({
    where: { id: songId },
    select: {
      id: true,
      title: true,
      status: true,
      audioUrl: true,
      coverImageUrl: true,
      audioPublicId: true,
      coverImagePublicId: true,
    },
  });

  return song;
}