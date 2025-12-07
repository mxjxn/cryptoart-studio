"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Repeat } from "lucide-react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  /** Auto-play when in view (muted by default) */
  autoPlay?: boolean;
}

/**
 * Custom styled video player with play/pause, progress bar, volume, fullscreen
 * Shows poster image while loading with progress percentage, controls appear below video after it starts playing
 */
export function VideoPlayer({ src, poster, className = "", autoPlay = false }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(autoPlay);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isPlayPending, setIsPlayPending] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [posterOpacity, setPosterOpacity] = useState(1);
  const [loop, setLoop] = useState(true);
  
  // Prevent rapid clicks that can cause crashes
  const playLockRef = useRef(false);
  const videoReadyRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  // Format time as MM:SS
  const formatTime = (time: number): string => {
    if (!isFinite(time) || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Calculate buffered percentage
  const getBufferedPercent = useCallback((): number => {
    const video = videoRef.current;
    if (!video) return 0;
    
    const videoDuration = video.duration;
    if (!videoDuration || videoDuration === 0 || !isFinite(videoDuration)) return 0;

    try {
      const buffered = video.buffered;
      if (!buffered || buffered.length === 0) return 0;

      // Get the end of the last buffered range
      const bufferedEnd = buffered.end(buffered.length - 1);
      return Math.min(100, Math.round((bufferedEnd / videoDuration) * 100));
    } catch (e) {
      return 0;
    }
  }, []);

  // Handle play/pause with better error handling and click protection
  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video || playLockRef.current) return;

    // Lock to prevent rapid clicks
    playLockRef.current = true;

    try {
      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
      } else {
        // Check if video is ready to play
        if (video.readyState < 2) {
          // Video not ready, wait a bit
          setIsPlayPending(true);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const playPromise = video.play();
        
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
          setHasStartedPlaying(true);
          setIsLoading(false);
          setIsPlayPending(false);
        }
      }
    } catch (e: any) {
      console.error("Video playback error:", e);
      // Don't show error for common user-initiated cancellations
      if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') {
        setError("Failed to play video. Please try again.");
      }
      setIsPlayPending(false);
    } finally {
      // Unlock after a short delay
      setTimeout(() => {
        playLockRef.current = false;
      }, 300);
    }
  }, [isPlaying]);

  // Handle seeking via progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const progress = progressRef.current;
    if (!video || !progress || !duration) return;

    const rect = progress.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    video.currentTime = clickPosition * duration;
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  // Toggle mute
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.muted = false;
      video.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      console.error("Fullscreen error:", e);
    }
  };

  // Track loading progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video || hasStartedPlaying) return;

    const updateProgress = () => {
      const percent = getBufferedPercent();
      setLoadProgress(percent);
      
      // If video is ready and has buffered, we can consider it loaded
      if (video.readyState >= 3 && percent > 0) {
        setIsLoading(false);
      }
    };

    const handleProgress = () => {
      updateProgress();
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      setLoadProgress(0);
    };

    const handleLoadedData = () => {
      updateProgress();
    };

    video.addEventListener("progress", handleProgress);
    video.addEventListener("loadstart", handleLoadStart);
    video.addEventListener("loadeddata", handleLoadedData);

    // Update periodically while loading
    const interval = setInterval(updateProgress, 200);

    return () => {
      video.removeEventListener("progress", handleProgress);
      video.removeEventListener("loadstart", handleLoadStart);
      video.removeEventListener("loadeddata", handleLoadedData);
      clearInterval(interval);
    };
  }, [hasStartedPlaying, getBufferedPercent]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setHasStartedPlaying(true);
      setIsLoading(false);
      setIsPlayPending(false);
      
      // Fade in video and fade out poster when video starts playing
      if (videoReadyRef.current) {
        setShowVideo(true);
        setTimeout(() => {
          setPosterOpacity(0);
        }, 50);
      }
    };
    
    const handlePause = () => {
      setIsPlaying(false);
      setIsPlayPending(false);
    };
    
    const handleEnded = () => {
      if (!loop) {
        setIsPlaying(false);
        setCurrentTime(0);
      }
      // If loop is true, video will automatically restart
    };

    const handleError = (e: Event) => {
      const videoError = video.error;
      if (videoError) {
        console.error("Video error:", videoError);
        let errorMessage = "Failed to load video";
        
        switch (videoError.code) {
          case videoError.MEDIA_ERR_ABORTED:
            errorMessage = "Video loading was aborted";
            break;
          case videoError.MEDIA_ERR_NETWORK:
            errorMessage = "Network error while loading video";
            break;
          case videoError.MEDIA_ERR_DECODE:
            errorMessage = "Video decoding error";
            break;
          case videoError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = "Video format not supported";
            break;
        }
        
        setError(errorMessage);
      } else {
        setError("Failed to load video");
      }
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      // Video is ready to play
      const percent = getBufferedPercent();
      setLoadProgress(percent);
    };

    const handleCanPlayThrough = async () => {
      // Video can play through without buffering
      setLoadProgress(100);
      setIsLoading(false);
      setIsVideoReady(true);
      videoReadyRef.current = true;
      
      // Automatically start playing (muted) to reveal video when fully loaded
      if (!hasStartedPlaying) {
        try {
          // Temporarily mute for auto-play
          const originalMuted = video.muted;
          video.muted = true;
          
          const playPromise = video.play();
          
          if (playPromise !== undefined) {
            await playPromise;
            // handlePlay will be called, which will trigger the fade
            // Restore original mute state after a moment
            if (!originalMuted && !autoPlay) {
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.muted = false;
                  setIsMuted(false);
                }
              }, 500);
            }
          }
        } catch (e: any) {
          // If auto-play fails, user can click to play - fade will happen then
          console.log("Auto-play prevented:", e);
        }
      }
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    const handlePlaying = () => {
      setIsLoading(false);
      setIsPlayPending(false);
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleStalled = () => {
      setIsLoading(true);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("canplaythrough", handleCanPlayThrough);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("stalled", handleStalled);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("canplaythrough", handleCanPlayThrough);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("stalled", handleStalled);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [getBufferedPercent]);

  // Smooth progress updates using requestAnimationFrame
  useEffect(() => {
    if (!isPlaying || !videoRef.current) {
      return;
    }

    const updateProgress = () => {
      const video = videoRef.current;
      if (video && isPlaying) {
        setCurrentTime(video.currentTime);
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying]);

  // Sync loop state with video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.loop = loop;
    }
  }, [loop]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isLoadingBeforePlay = isLoading && !hasStartedPlaying;

  if (error) {
    return (
      <div className={`bg-[#111] border border-[#333] aspect-video flex items-center justify-center ${className}`}>
        <div className="text-[#999] text-center">
          <p className="text-sm">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              if (videoRef.current) {
                videoRef.current.load();
              }
            }}
            className="mt-2 text-xs text-white/60 hover:text-white underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`bg-black ${className}`}>
      {/* Video container */}
      <div className="relative">
        {/* Video element */}
        <video
          ref={videoRef}
          src={src}
          className={`w-full h-full object-contain cursor-pointer transition-opacity duration-500 ease-in-out ${
            showVideo ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={togglePlay}
          playsInline
          muted={isMuted}
          autoPlay={autoPlay}
          preload="auto"
          loop={loop}
        />

        {/* Poster image overlay - fades out when video starts playing */}
        {poster && posterOpacity > 0 && (
          <div
            className="absolute inset-0 cursor-pointer transition-opacity duration-500 ease-in-out"
            style={{
              opacity: posterOpacity,
            }}
            onClick={togglePlay}
          >
            <img
              src={poster}
              alt="Video poster"
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>
        )}

        {/* Loading overlay - only show spinner if no poster image */}
        {isLoadingBeforePlay && !poster && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-8 h-8 border-2 border-white border-t-transparent animate-spin" />
          </div>
        )}

        {/* Play button overlay (when paused and video has loaded) */}
        {!isPlaying && !isLoading && hasStartedPlaying && !isPlayPending && posterOpacity === 0 && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
            onClick={togglePlay}
          >
            <div className="w-16 h-16 flex items-center justify-center bg-white/90 hover:bg-white transition-colors">
              <Play className="w-8 h-8 text-black ml-1" />
            </div>
          </div>
        )}

        {/* Loading indicator overlay (when play is pending) */}
        {isPlayPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-8 h-8 border-2 border-white border-t-transparent animate-spin" />
          </div>
        )}
      </div>

      {/* Loading progress - Show below image while loading, before video starts playing */}
      {isLoadingBeforePlay && (
        <div className="mt-2 px-1">
          <div className="text-[10px] text-white/60 font-mono">
            loading video {loadProgress}%
          </div>
        </div>
      )}

      {/* Controls - Only show after video has started playing, positioned below video */}
      {hasStartedPlaying && (
        <div className="mt-2 px-1">
          {/* Progress bar - thin track with small point */}
          <div
            ref={progressRef}
            onClick={handleProgressClick}
            className="relative h-[1px] bg-white/10 cursor-pointer mb-2 group/progress"
          >
            {/* Small point indicator with black border */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full border border-black pointer-events-none"
              style={{ 
                left: `calc(${progressPercent}% - 3px)`
              }}
            />
          </div>

          {/* Controls row - minimal and thin */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Play/Pause button */}
              <button
                onClick={togglePlay}
                disabled={isPlayPending || playLockRef.current}
                className="text-white/80 hover:text-white transition-colors p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlayPending ? (
                  <div className="w-4 h-4 border border-white border-t-transparent animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>

              {/* Volume controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleMute}
                  className="text-white/80 hover:text-white transition-colors p-1"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-12 h-0.5 bg-white/20 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                  aria-label="Volume"
                />
              </div>

              {/* Time display */}
              <div className="text-[10px] text-white/60 font-mono ml-1">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Loop toggle button */}
              <button
                onClick={() => setLoop(!loop)}
                className={`p-1 transition-colors ${
                  loop 
                    ? 'text-white' 
                    : 'text-white/50 hover:text-white/80'
                }`}
                aria-label={loop ? "Disable loop" : "Enable loop"}
              >
                <Repeat className="w-3.5 h-3.5" />
              </button>

              {/* Fullscreen button */}
              <button
                onClick={toggleFullscreen}
                className="text-white/80 hover:text-white transition-colors p-1"
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize className="w-3.5 h-3.5" />
                ) : (
                  <Maximize className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
