"use client";

import {
  Download,
  Loader2,
  MoreHorizontal,
  Music,
  Pencil,
  Play,
  RefreshCcw,
  Search,
  XCircle,
} from "lucide-react";
import { Input } from "../ui/input";
import { useEffect, useState, useRef } from "react";
import { Button } from "../ui/button";
import { getPlayUrl, checkSongStatus } from "~/actions/generation";
import { Badge } from "../ui/badge";
import { renameSong, setPublishedStatus } from "~/actions/song";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { RenameDialog } from "./rename-dialog";
import { useRouter } from "next/navigation";
import { usePlayerStore } from "store/use-player-store";
import Image from "next/image";
import { Progress } from "../ui/progress";

export interface Track {
  id: string;
  title: string | null;
  createdAt: Date;
  instrumental: boolean;
  prompt: string | null;
  lyrics: string | null;
  describedLyrics: string | null;
  fullDescribedSong: string | null;
  thumbnailUrl: string | null;
  playUrl: string | null;
  status: string | null;
  createdByUserName: string | null;
  published: boolean;
}

export function TrackList({ tracks }: { tracks: Track[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [trackToRename, setTrackToRename] = useState<Track | null>(null);
  const [pollingActive, setPollingActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completionCountdown, setCompletionCountdown] = useState(0);
  const router = useRouter();
  const setTrack = usePlayerStore((state) => state.setTrack);
  
  // Use refs to store interval IDs and track monitoring state
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const monitoredSongsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  // Improved polling with progress tracking and 10s delay
  useEffect(() => {
    const processingSongs = tracks.filter(
      (track) => track.status === "processing" || track.status === "queued"
    );

    // On initial load, mark all processing songs as already monitored
    if (isInitialLoadRef.current) {
      processingSongs.forEach(song => {
        monitoredSongsRef.current.add(song.id);
      });
      isInitialLoadRef.current = false;
      console.log("Initial load - marking existing processing songs as monitored:", Array.from(monitoredSongsRef.current));
      return;
    }

    // Find NEW processing songs (not in monitored set)
    const newProcessingSongs = processingSongs.filter(
      song => !monitoredSongsRef.current.has(song.id)
    );

    // Clear all existing intervals first
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    // If NO NEW processing songs, reset everything and return
    if (newProcessingSongs.length === 0) {
      setPollingActive(false);
      setProgress(0);
      setCompletionCountdown(0);
      return;
    }

    // Add new songs to monitored set
    newProcessingSongs.forEach(song => {
      monitoredSongsRef.current.add(song.id);
    });

    // Only start polling if there ARE NEW processing songs
    setPollingActive(true);
    setProgress(10); // Start progress
    console.log(`Starting polling for ${newProcessingSongs.length} NEW processing songs:`, newProcessingSongs.map(s => s.id));

    // Simulate progress (moves from 10% to 90% over time)
    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev < 90) return prev + 1;
        return prev;
      });
    }, 500); // Update every 500ms

    // Poll for status updates
    pollIntervalRef.current = setInterval(() => {
      void (async () => {
        let shouldRefresh = false;

        for (const track of newProcessingSongs) {
          try {
            const updated = await checkSongStatus(track.id);

            if (
              updated &&
              updated.status !== "processing" &&
              updated.status !== "queued"
            ) {
              console.log(`Song ${track.id} completed with status: ${updated.status}`);
              shouldRefresh = true;
              setProgress(100); // Complete progress
              // Remove from monitored set
              monitoredSongsRef.current.delete(track.id);
            }
          } catch (error) {
            console.error(`Error checking status for song ${track.id}:`, error);
          }
        }

        if (shouldRefresh) {
          console.log("Song generation completed! Starting 10s countdown...");
          
          // Clear polling intervals
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          
          // Start 10 second countdown
          setCompletionCountdown(10);
          
          countdownIntervalRef.current = setInterval(() => {
            setCompletionCountdown((prev) => {
              if (prev <= 1) {
                if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                console.log("Countdown complete! Refreshing...");
                router.refresh();
                setPollingActive(false);
                setProgress(0);
                setCompletionCountdown(0);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      })();
    }, 5000); // Poll every 5 seconds

    // Cleanup function - runs when component unmounts or dependencies change
    return () => {
      console.log("Cleaning up polling intervals...");
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [tracks, router]);

  const handleTrackSelect = async (track: Track) => {
    if (loadingTrackId) return;
    setLoadingTrackId(track.id);
    const playUrl = await getPlayUrl(track.id);
    setLoadingTrackId(null);

    setTrack({
      id: track.id,
      title: track.title,
      audioUrl: playUrl ?? null,
      artwork: track.thumbnailUrl,
      prompt: track.prompt,
      createdByUserName: track.createdByUserName,
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const filteredTracks = tracks.filter(
    (track) =>
      track.title?.toLowerCase().includes(searchQuery.toLowerCase()) ??
      track.prompt?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-1 flex-col overflow-y-scroll">
      <div className="flex-1 p-6">
        {/* Progress bar - only visible when polling */}
        {pollingActive && (
          <div className="mb-4 rounded-lg border bg-muted/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {completionCountdown > 0 ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                    <span className="text-sm font-medium text-green-600">
                      Generation complete! Song appearing in {completionCountdown}s...
                    </span>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm font-medium">Generating your song...</span>
                  </>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {completionCountdown > 0 ? '100%' : `${progress}%`}
              </span>
            </div>
            <Progress value={completionCountdown > 0 ? 100 : progress} className="h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              {completionCountdown > 0 
                ? "Your song is ready! Preparing to display..."
                : "This usually takes 30-60 seconds. The page will auto-refresh when ready."
              }
            </p>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="pl-10"
            />
          </div>
          <Button
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            onClick={handleRefresh}
          >
            {isRefreshing ? (
              <Loader2 className="mr-2 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2" />
            )}
            Refresh
          </Button>
        </div>

        {/* Track list */}
        <div className="space-y-2">
          {filteredTracks.length > 0 ? (
            filteredTracks.map((track) => {
              switch (track.status) {
                case "failed":
                  return (
                    <div
                      key={track.id}
                      className="flex cursor-not-allowed items-center gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3"
                    >
                      <div className="bg-destructive/10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md">
                        <XCircle className="text-destructive h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-destructive truncate text-sm font-medium">
                          Generation failed
                        </h3>
                        <p className="text-muted-foreground truncate text-xs">
                          Please try creating the song again.
                        </p>
                      </div>
                    </div>
                  );

                case "no credits":
                  return (
                    <div
                      key={track.id}
                      className="flex cursor-not-allowed items-center gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3"
                    >
                      <div className="bg-destructive/10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md">
                        <XCircle className="text-destructive h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-destructive truncate text-sm font-medium">
                          Not enough credits
                        </h3>
                        <p className="text-muted-foreground truncate text-xs">
                          Please purchase more credits to generate this song.
                        </p>
                      </div>
                    </div>
                  );

                case "queued":
                case "processing":
                  // Don't display processing songs
                  return null;

                default:
                  return (
                    <div
                      key={track.id}
                      className="hover:bg-muted/50 flex cursor-pointer items-center gap-4 rounded-lg p-3 transition-colors"
                      onClick={() => handleTrackSelect(track)}
                    >
                      {/* Thumbnail */}
                      <div className="group relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                        {track.thumbnailUrl ? (
                          <Image
                            src={track.thumbnailUrl}
                            alt={`Cover art for ${track.title ?? "track"}`}
                            fill
                            sizes="48px"
                            className="object-cover"
                            priority={false}
                          />
                        ) : (
                          <div className="bg-muted flex h-full w-full items-center justify-center">
                            <Music className="text-muted-foreground h-6 w-6" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                          {loadingTrackId === track.id ? (
                            <Loader2 className="animate-spin text-white" />
                          ) : (
                            <Play className="fill-white text-white" />
                          )}
                        </div>
                      </div>

                      {/* Track info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-medium">
                            {track.title}
                          </h3>
                          {track.instrumental && (
                            <Badge variant="outline">Instrumental</Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground truncate text-xs">
                          {track.prompt}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await setPublishedStatus(
                              track.id,
                              !track.published,
                            );
                          }}
                          variant="outline"
                          size="sm"
                          className={`cursor-pointer ${track.published ? "border-red-200" : ""}`}
                        >
                          {track.published ? "Unpublish" : "Publish"}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={async (e) => {
                                e.stopPropagation();
                                const playUrl = await getPlayUrl(track.id);
                                window.open(playUrl, "_blank");
                              }}
                            >
                              <Download className="mr-2" /> Download
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async (e) => {
                                e.stopPropagation();
                                setTrackToRename(track);
                              }}
                            >
                              <Pencil className="mr-2" /> Rename
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
              }
            })
          ) : (
            <div className="flex flex-col items-center justify-center pt-20 text-center">
              <Music className="text-muted-foreground h-10 w-10" />
              <h2 className="mt-4 text-lg font-semibold">No Music Yet</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {searchQuery
                  ? "No tracks match your search."
                  : "Create your first song to get started."}
              </p>
            </div>
          )}
        </div>
      </div>

      {trackToRename && (
        <RenameDialog
          track={trackToRename}
          onClose={() => setTrackToRename(null)}
          onRename={(trackId, newTitle) => renameSong(trackId, newTitle)}
        />
      )}
    </div>
  );
}