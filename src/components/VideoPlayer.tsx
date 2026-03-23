import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import {
  decodeVideoUrl,
  extractYouTubeVideoId,
  getVideoUrl,
  LessonVideoSource,
} from "@/lib/video-utils";
import { getBunnyStreamVideoUrl } from "@/lib/bunnystream-api";
import Hls from "hls.js";

interface VideoPlayerProps {
  /** The video URL or path */
  videoUrl: string;
  /** The video source type (youtube, direct, upload) */
  source: LessonVideoSource;
  /** Optional custom title */
  title?: string;
  /** Optional poster/thumbnail URL */
  poster?: string;
  /** Whether to autoplay the video */
  autoplay?: boolean;
  /** Whether to show controls */
  controls?: boolean;
  /** Disable native fullscreen button (useful for custom container fullscreen) */
  disableNativeFullscreen?: boolean;
  /** Video player aspect ratio class */
  aspectRatio?: string;
  /** Whether to show loading state */
  isLoading?: boolean;
  /** Compact layout for embedded LMS usage */
  compact?: boolean;
  /** Progress callback for playback-aware pages */
  onProgress?: (data: {
    currentTime: number;
    duration: number;
    remainingTime: number;
    progressPercent: number;
  }) => void;
  /** Called when media playback ends */
  onEnded?: () => void;
}

export default function VideoPlayer({
  videoUrl,
  source,
  title,
  poster,
  autoplay = false,
  controls = true,
  disableNativeFullscreen = false,
  aspectRatio = "aspect-video",
  isLoading = false,
  compact = false,
  onProgress,
  onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastProgressSecondRef = useRef<number>(-1);
  const [signedPlaybackUrl, setSignedPlaybackUrl] = useState("");
  const siteSettings = useSiteSettings();
  const bunnyLibraryId = siteSettings.settings?.bunnyStreamApi?.libraryId || "";

  // Check if input is a Bunny Stream video ID (UUID format)
  const isBunnyStreamId = (input: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(input.trim());
  };

  const decodedVideoInput = useMemo(() => decodeVideoUrl(videoUrl).trim(), [videoUrl]);

  const resolvedSource = useMemo<LessonVideoSource>(() => {
    if (source !== "youtube") return source;

    // If source was mistakenly left as YouTube but a Bunny GUID/URL is provided,
    // auto-fallback to a playable source instead of rendering a broken iframe URL.
    if (extractYouTubeVideoId(decodedVideoInput)) return "youtube";
    if (isBunnyStreamId(decodedVideoInput)) return "upload";
    return "direct";
  }, [source, decodedVideoInput]);

  const videoSrc = useMemo(() => {
    const decoded = getVideoUrl(videoUrl, resolvedSource);
    
    // If it's a Bunny Stream video ID, convert to full CDN URL
    if (isBunnyStreamId(decoded) && siteSettings) {
      const bunnyConfig = {
        enabled: siteSettings.settings?.bunnyStreamApi?.enabled || false,
        libraryId: siteSettings.settings?.bunnyStreamApi?.libraryId || "",
        apiKey: siteSettings.settings?.bunnyStreamApi?.apiKey || "",
        cdnHostname: siteSettings.settings?.bunnyStreamApi?.cdnHostname || "",
        pullZone: siteSettings.settings?.bunnyStreamApi?.pullZone || "",
      };
      return getBunnyStreamVideoUrl(decoded, bunnyConfig);
    }
    
    return decoded;
  }, [videoUrl, resolvedSource, siteSettings]);

  const bunnyVideoId = useMemo(() => {
    const decoded = getVideoUrl(videoUrl, resolvedSource).trim();
    return isBunnyStreamId(decoded) ? decoded : "";
  }, [videoUrl, resolvedSource]);

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    const loadSignedPlayback = async () => {
      if (!bunnyVideoId) {
        setSignedPlaybackUrl("");
        return;
      }

      try {
        const response = await fetch("/api/bunny/signed-playback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId: bunnyVideoId,
            cdnHostname: siteSettings.settings?.bunnyStreamApi?.cdnHostname || "",
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          if (!isCancelled) setSignedPlaybackUrl("");
          return;
        }

        const payload = (await response.json()) as { playbackUrl?: string };
        if (!isCancelled) {
          setSignedPlaybackUrl(String(payload?.playbackUrl || "").trim());
        }
      } catch {
        if (!isCancelled) setSignedPlaybackUrl("");
      }
    };

    void loadSignedPlayback();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [bunnyVideoId, siteSettings.settings?.bunnyStreamApi?.cdnHostname]);

  const bunnyEmbedSrc = useMemo(() => {
    if (!bunnyVideoId || !bunnyLibraryId) return "";

    const params = new URLSearchParams({
      autoplay: autoplay ? "true" : "false",
      preload: "true",
      responsive: "true",
    });

    return `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${bunnyVideoId}?${params.toString()}`;
  }, [autoplay, bunnyLibraryId, bunnyVideoId]);

  // Keep HTML5/HLS mode in LMS where progress tracking is required.
  const useBunnyIframePlayer = Boolean(bunnyEmbedSrc) && !onProgress && !signedPlaybackUrl;

  const finalVideoSrc = useMemo(() => {
    if (signedPlaybackUrl && bunnyVideoId) return signedPlaybackUrl;
    return videoSrc;
  }, [signedPlaybackUrl, bunnyVideoId, videoSrc]);

  // Detect if this is an HLS stream (chunk-based delivery from CDN)
  const isHlsStream = useMemo(() => {
      return finalVideoSrc.toLowerCase().includes(".m3u8") || 
           resolvedSource === "upload" ||
        finalVideoSrc.toLowerCase().includes("bunny");
    }, [finalVideoSrc, resolvedSource]);

  // Setup HLS streaming for CDN chunked delivery
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !isHlsStream) return;

    try {
      // Cleanup existing HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // For native HLS support (Safari)
      if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
        videoEl.src = finalVideoSrc;
        return;
      }

      // For other browsers, use HLS.js for chunked streaming
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          startLevel: -1, // Auto select quality
        });

        hlsRef.current = hls;
        hls.loadSource(finalVideoSrc);
        hls.attachMedia(videoEl);

        return () => {
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
        };
      }

      // Fallback: browser might support HLS natively
      videoEl.src = finalVideoSrc;
    } catch (error) {
      console.error("HLS setup error:", error);
      videoEl.src = finalVideoSrc; // Fallback
    }
  }, [finalVideoSrc, isHlsStream]);

  const emitProgress = () => {
    const el = videoRef.current;
    if (!el || !onProgress) return;

    const currentTime = Number(el.currentTime || 0);
    const duration = Number(el.duration || 0);
    if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return;

    const wholeSecond = Math.floor(currentTime);
    if (wholeSecond === lastProgressSecondRef.current) return;
    lastProgressSecondRef.current = wholeSecond;

    const remainingTime = Math.max(0, duration - currentTime);
    const progressPercent = Math.max(0, Math.min(100, (currentTime / duration) * 100));

    onProgress({ currentTime, duration, remainingTime, progressPercent });
  };

  if (!videoUrl) {
    return (
      <div className={`${aspectRatio} bg-background border border-border rounded-xl flex items-center justify-center`}>
        <AlertCircle className="w-12 h-12 text-gray-500" />
      </div>
    );
  }

  // YouTube embed
  if (resolvedSource === "youtube") {
    return (
      <div className={compact ? "w-full h-full" : "w-full"}>
        <div className={`${aspectRatio} rounded-xl overflow-hidden bg-background border border-border shadow-sm`}>
          <iframe
            className="w-full h-full"
            src={videoSrc}
            title={title || "Video Player"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {title && !compact && (
          <div className="mt-3">
            <p className="text-sm font-medium text-gray-200">{title}</p>
          </div>
        )}
      </div>
    );
  }

  // Bunny Stream iframe player (native Bunny UI)
  if (useBunnyIframePlayer) {
    return (
      <div className={compact ? "w-full h-full" : "w-full"}>
        <div className={`${aspectRatio} rounded-xl overflow-hidden bg-black`}>
          <iframe
            className="w-full h-full"
            src={bunnyEmbedSrc}
            title={title || "Bunny Video Player"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {title && !compact && (
          <div className="mt-3">
            <p className="text-sm font-medium text-gray-200">{title}</p>
          </div>
        )}
      </div>
    );
  }

  // Direct video or Bunny CDN video
  return (
    <div className={compact ? "w-full h-full" : "w-full"}>
      <div className={`${aspectRatio} rounded-xl overflow-hidden bg-background border border-border shadow-sm relative`}>
        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
          </div>
        )}

        {/* Video Element - Chunked streaming support */}
        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-background"
          controls={controls}
          autoPlay={autoplay}
          poster={poster}
          preload="metadata"
          controlsList={disableNativeFullscreen ? "nodownload nofullscreen" : "nodownload"}
          onContextMenu={(e) => e.preventDefault()}
          onLoadedMetadata={emitProgress}
          onTimeUpdate={emitProgress}
          onEnded={() => {
            emitProgress();
            onEnded?.();
          }}
        >
          {/* For non-HLS videos */}
          {!isHlsStream && (
            <>
              <source src={finalVideoSrc} type="video/mp4" />
              <source src={finalVideoSrc} type="video/webm" />
            </>
          )}
          {/* For HLS streams, src is set via JavaScript */}
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Title below video */}
      {title && !compact && (
        <div className="mt-3">
          <p className="text-sm font-semibold text-foreground">{title}</p>
        </div>
      )}
    </div>
  );
}

/**
 * VideoPlayer Component - Universal Video Player with HLS Chunked Streaming
 *
 * FEATURES:
 * - HLS streaming support (.m3u8) for chunk-based CDN delivery
 * - Direct MP4/WebM video support
 * - YouTube embed support
 * - Automatic quality selection for HLS streams
 * - Progress tracking and callbacks
 *
 * USAGE EXAMPLES:
 *
 * 1. YouTube video
 *    <VideoPlayer
 *      videoUrl="https://youtube.com/watch?v=dQw4w9WgXcQ"
 *      source="youtube"
 *      title="My Video"
 *    />
 *
 * 2. Direct MP4/WebM video
 *    <VideoPlayer
 *      videoUrl="https://videos.example.com/video.mp4"
 *      source="direct"
 *      title="Direct Video"
 *    />
 *
 * 3. HLS chunked stream from CDN (Bunny Stream, etc)
 *    <VideoPlayer
 *      videoUrl="https://cdn.bunny.net/video.m3u8"
 *      source="upload"
 *      title="CDN Video"
 *    />
 *
 * 4. With loading indicator
 *    <VideoPlayer
 *      videoUrl="video.mp4"
 *      source="direct"
 *      isLoading={isTranscoding}
 *    />
 *
 * HOW IT WORKS:
 * - Automatically detects HLS streams (.m3u8 files)
 * - Uses HLS.js library for chunk-based streaming in browsers that don't support HLS natively
 * - Supports adaptive bitrate streaming (auto quality selection)
 * - Works with Safari's native HLS support
 * - Falls back to direct video source for unsupported formats
 */


