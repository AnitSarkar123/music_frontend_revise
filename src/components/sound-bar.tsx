"use client";

import {
  Download,
  MoreHorizontal,
  Music,
  Pause,
  Play,
  Volume2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../../store/use-player-store";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Slider } from "./ui/slider";

export default function SoundBar() {
  const { track, clearTrack } = usePlayerStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([100]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Add this near your other debug logging
  useEffect(() => {
    if (track?.audioUrl) {
      console.log("Testing CORS for audio URL:", track.audioUrl);
      fetch(track.audioUrl, {
        method: "HEAD",
        mode: "cors",
      })
        .then((res) => {
          console.log("CORS test result:", {
            status: res.status,
            ok: res.ok,
            headers: {
              "content-type": res.headers.get("content-type"),
              "access-control-allow-origin": res.headers.get(
                "access-control-allow-origin",
              ),
            },
          });
        })
        .catch((err) => console.error("CORS test failed:", err));
    }
  }, [track]);

  // Debug the track data we're receiving
  useEffect(() => {
    if (track) {
      console.log("Track in player:", {
        id: track.id,
        title: track.title,
        audioUrl: track.audioUrl,
        hasAudioUrl: !!track.audioUrl,
      });

      // Single URL test
      if (track.audioUrl) {
        fetch(track.audioUrl, { method: "HEAD" })
          .then((res) => {
            console.log("Audio URL test:", {
              status: res.status,
              ok: res.ok,
              contentType: res.headers.get("content-type"),
            });
          })
          .catch((err) => {
            console.error("Error testing audio URL:", err);
          });
      }
    }
  }, [track]);

  // Handle track changes - load and play
  useEffect(() => {
    if (track?.audioUrl && audioRef.current) {
      console.log("Loading audio URL:", track.audioUrl);

      // Reset state
      setCurrentTime(0);
      setDuration(0);

      // Set the source and load
      audioRef.current.src = track.audioUrl;
      audioRef.current.load();

      // Try to play with proper error handling
      audioRef.current
        .play()
        .then(() => {
          console.log("Audio playing successfully");
          setIsPlaying(true);
        })
        .catch((err) => {
          console.error("Error playing audio:", err);
          console.error(
            "Browser may be blocking autoplay. Try clicking play button.",
          );
          setIsPlaying(false);
        });
    }
  }, [track]);

  // Handle volume changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const v =
      Array.isArray(volume) &&
      volume.length > 0 &&
      typeof volume[0] === "number"
        ? volume[0]
        : 100;

    // Clamp to [0,100] then normalize to [0,1] for the audio element
    const normalized = Math.min(Math.max(v, 0), 100) / 100;
    audio.volume = normalized;
  }, [volume]);

  // Set up audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      console.log("Audio duration:", audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      console.log("Audio playback ended");
    };

    const handleError = (e: ErrorEvent) => {
      console.error("Audio error:", e);
      setIsPlaying(false);
    };

    // Add event listeners
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError as EventListener);

    // Cleanup
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError as EventListener);
    };
  }, []);

  const togglePlay = async () => {
    if (!track?.audioUrl || !audioRef.current) return;

    console.log("Toggle play, current state:", isPlaying);

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Error toggling playback:", err);
    }
  };

  const handleClose = () => {
    // Stop current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    // Clear the track from player (this will hide the sound bar)
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    clearTrack();
    
    console.log("Sound bar closed");
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;

    const newTime = value[0];
    if (typeof newTime !== "number") return;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!track) return null;

  return (
    <div className="flex justify-center px-4 pb-2">
      <Card className="bg-background/60 relative w-full max-w-4xl shrink-0 border-t py-0 backdrop-blur">
        {/* Close button - positioned absolutely in top right */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 rounded-full hover:bg-destructive/10 z-20"
          onClick={handleClose}
          aria-label="Close player"
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between pr-8">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-purple-500 to-pink-500 z-0">
                {track?.artwork ? (
                  <Image
                    src={track.artwork}
                    alt={`Album artwork for ${track.title ?? "song"}`}
                    fill
                    sizes="40px"
                    className="object-cover"
                    priority={false}
                  />
                ) : (
                  <Music className="h-4 w-4 text-white" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium">{track.title}</h3>
                <p className="text-muted-foreground truncate text-xs">
                  {track.createdByUserName ?? "Unknown Artist"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 p-2 z-10">
              <Button
                variant="default"
                size="icon"
                className="h-12 w-12 rounded-full border-2 border-white bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg hover:from-purple-700 hover:to-pink-700"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="ml-0.5 h-6 w-6" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Download"
                onClick={() => {
                  if (track?.audioUrl) {
                    // Create a temporary anchor to trigger download
                    const a = document.createElement("a");
                    a.href = track.audioUrl;
                    a.download = `${track.title ?? "song"}.mp3`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="More"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-muted-foreground w-9 text-xs tabular-nums">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="flex-1"
              aria-label="Seek"
            />
            <span className="text-muted-foreground w-9 text-xs tabular-nums">
              {formatTime(duration)}
            </span>
            <div className="flex items-center gap-1.5">
              <Volume2 className="text-muted-foreground h-4 w-4" />
              <Slider
                value={volume}
                max={100}
                step={1}
                onValueChange={setVolume}
                className="w-20"
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      </Card>

      <audio
        ref={audioRef}
        preload="metadata"
        onError={(e) => {
          console.error("Audio element error:", e);
          console.error("Audio error code:", audioRef.current?.error?.code);
          console.error(
            "Audio error message:",
            audioRef.current?.error?.message,
          );
        }}
      />
    </div>
  );
}