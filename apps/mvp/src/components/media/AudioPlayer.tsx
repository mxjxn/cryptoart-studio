"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  title?: string;
  /** Optional cover image to display */
  coverImage?: string;
  className?: string;
}

/**
 * Custom styled audio player with play/pause, progress bar, volume controls
 * Matches the minimal/colorful theme using CSS variables
 */
export function AudioPlayer({ src, title, coverImage, className = "" }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Format time as MM:SS
  const formatTime = (time: number): string => {
    if (!isFinite(time) || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Handle play/pause
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((e) => {
        console.error("Audio playback failed:", e);
        setError("Failed to play audio");
      });
    }
  }, [isPlaying]);

  // Handle seeking via progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progress = progressRef.current;
    if (!audio || !progress || !duration) return;

    const rect = progress.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    audio.currentTime = clickPosition * duration;
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  // Toggle mute
  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setError("Failed to load audio");
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error) {
    return (
      <div className={`bg-[#111] border border-[#333] p-6 ${className}`}>
        <div className="text-[#999] text-center">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#111] border border-[#333] ${className}`}>
      {/* Cover image if provided */}
      {coverImage && (
        <div className="aspect-square w-full overflow-hidden">
          <img
            src={coverImage}
            alt={title || "Audio cover"}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Audio element (hidden) */}
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Controls */}
      <div className="p-4 space-y-3">
        {/* Title if provided */}
        {title && (
          <div className="text-sm text-[#ccc] truncate">{title}</div>
        )}

        {/* Progress bar */}
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="h-1 bg-[#333] cursor-pointer group relative"
        >
          <div
            className="h-full bg-[var(--color-accent,#fff)] transition-all"
            style={{ width: `${progressPercent}%` }}
          />
          {/* Hover indicator */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[var(--color-accent,#fff)] opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progressPercent}% - 6px)` }}
          />
        </div>

        {/* Time display and controls */}
        <div className="flex items-center justify-between">
          {/* Play/Pause button */}
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-10 h-10 flex items-center justify-center bg-[var(--color-accent,#fff)] text-black hover:opacity-80 transition-opacity disabled:opacity-50"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>

          {/* Time display */}
          <div className="text-xs text-[#999] font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          {/* Volume controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-[#999] hover:text-white transition-colors"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-[#333] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white"
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
}



