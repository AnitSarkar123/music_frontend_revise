"use client";

import type { Category, Like, Song } from "@prisma/client";
import { Heart, Loader2, Music, Play } from "lucide-react";
import { useState } from "react";
import { getPlayUrl } from "~/actions/generation";
import { toggleLikeSong } from "~/actions/song";
import { usePlayerStore } from '../../../store/use-player-store';
import Image from "next/image";

type SongWithRelation = Song & {
  user: { name: string | null };
  _count: {
    likes: number;
  };
  categories: Category[];
  thumbnailUrl?: string | null;
  likes?: Like[];
};

export function SongCard({ song }: { song: SongWithRelation }) {
  const [isLoading, setIsLoading] = useState(false);
  const setTrack = usePlayerStore((state) => state.setTrack);
  const [isLiked, setIsLiked] = useState(
    song.likes ? song.likes.length > 0 : false,
  );
  const [likesCount, setLikesCount] = useState(song._count.likes);

  const handlePlay = async () => {
  try {
    setIsLoading(true);
    console.log("Getting play URL for:", song.id);
    const playUrl = await getPlayUrl(song.id);
    
    // Set the track with the correct property name (url instead of audioUrl)
    setTrack({
      id: song.id,
      title: song.title || "Untitled",
      audioUrl: playUrl ?? null, // Ensure url is string | null, not undefined
      artwork: song.thumbnailUrl ?? null,
      prompt: song.prompt ?? null,
      createdByUserName: song.user?.name ?? null
    });
    
  } catch (error) {
    console.error("Error playing track:", error);
  } finally {
    setIsLoading(false);
  }
};

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();

    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);

    await toggleLikeSong(song.id);
  };

  return (
    <div>
      <div onClick={handlePlay} className="cursor-pointer">
        <div className="group relative aspect-square w-full overflow-hidden rounded-md bg-gray-200 group-hover:opacity-75">
          {song.thumbnailUrl ? (
           <Image
    src={song.thumbnailUrl}
    alt={`Album artwork for ${song.title}`}
    fill
    sizes="(max-width: 768px) 100vw, 33vw"
    className="object-cover object-center"
    priority={false}
  />
          ) : (
            <div className="bg-muted flex h-full w-full items-center justify-center">
              <Music className="text-muted-foreground h-12 w-12" />
            </div>
          )}

          {/* Loader */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 transition-transform group-hover:scale-105">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              ) : (
                <Play className="h-6 w-6 fill-white text-white" />
              )}
            </div>
          </div>
        </div>

        <h3 className="mt-2 truncate text-sm font-medium text-gray-900">
          {song.title}
        </h3>

        <p className="text-xs text-gray-500">{song.user.name}</p>

        <div className="mt-1 flex items-center justify-between text-xs text-gray-900">
          <span>{song.listenCount} listens</span>
          <button
            onClick={handleLike}
            className="flex cursor-pointer items-center gap-1"
          >
            <Heart
              className={`h-4 w-4 ${isLiked ? "fill-red-500 text-red-500" : ""}`}
            />
            {likesCount} likes
          </button>
        </div>
      </div>
    </div>
  );
}