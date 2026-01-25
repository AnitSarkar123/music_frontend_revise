"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "~/lib/auth";
import { db } from "~/server/db";
import { env } from "~/env";
import { TrackList } from "./track-list";
// Helper function to generate Cloudinary thumbnail URL directly
function generateCloudinaryThumbnailUrl(publicId: string): string {
  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/w_300,h_300,c_fill,q_auto,f_auto/${publicId}`;
}

export default async function TrackListFetcher() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth/sign-in");
  }

  const songs = await db.song.findMany({
    where: { userId: session?.user?.id },
    include: {
      user: {
        select: { name: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const track = songs.map((song) => {
    let thumbnailUrl = null;

    // Use direct Cloudinary URL if available
    if (song.coverImageUrl) {
      thumbnailUrl = song.coverImageUrl;
    } else if (song.coverImagePublicId) {
      thumbnailUrl = generateCloudinaryThumbnailUrl(song.coverImagePublicId);
    }
    // Legacy S3 fallback could go here if needed

    return {
      id: song.id,
      title: song.title,
      createdAt: song.createdAt,
      instrumental: song.instrumental,
      prompt: song.prompt,
      lyrics: song.lyrics,
      describedLyrics: song.describedLyrics,
      fullDescribedSong: song.fullDescribedSong,
      thumbnailUrl,
      playUrl: null,
      status: song.status,
      createdByUserName: song.user?.name,
      published: song.published,
    };
  });

  // return songsWithThumbnails;
  return <TrackList tracks={track} />;
}