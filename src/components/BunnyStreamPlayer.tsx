import { useMemo, useState } from "react";
import { Play, Volume2, VolumeX, Maximize, Loader2, AlertCircle } from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { getBunnyStreamVideoUrl, BunnyStreamConfig } from "@/lib/bunnystream-api";

interface BunnyStreamPlayerProps {
  /** Video GUID from Bunny Stream */
  videoGuid: string;
  /** Optional custom title */
  title?: string;
  /** Optional poster/thumbnail URL */
  poster?: string;
  /** Custom Bunny Stream config (optional, will use site settings if not provided) */
  bunnyConfig?: BunnyStreamConfig;
  /** Whether to autoplay the video */
  autoplay?: boolean;
  /** Video player aspect ratio class */
  aspectRatio?: string;
  /** Whether to show loading state */
  isLoading?: boolean;
  /** Show video info overlay */
  showInfo?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Specialized Bunny Stream Video Player
 * Optimized for professional video delivery with modern UI
 */
export default function BunnyStreamPlayer({
  videoGuid,
  title = "Video",
  poster,
  bunnyConfig: customConfig,
  autoplay = false,
  aspectRatio = "aspect-video",
  isLoading = false,
  showInfo = true,
  className = "",
}: BunnyStreamPlayerProps) {
  const siteSettings = useSiteSettings();
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(true);

  // Use custom config or site settings
  const bunnyConfig = useMemo(() => {
    if (customConfig) return customConfig;

    if (siteSettings?.settings?.bunnyStreamApi) {
      return {
        enabled: siteSettings.settings.bunnyStreamApi.enabled,
        libraryId: siteSettings.settings.bunnyStreamApi.libraryId,
        apiKey: siteSettings.settings.bunnyStreamApi.apiKey,
        cdnHostname: siteSettings.settings.bunnyStreamApi.cdnHostname,
        pullZone: siteSettings.settings.bunnyStreamApi.pullZone,
      } as BunnyStreamConfig;
    }

    return { enabled: false, libraryId: "", apiKey: "", cdnHostname: "", pullZone: "" } as BunnyStreamConfig;
  }, [siteSettings.settings?.bunnyStreamApi, customConfig]);

  // Get the HLS playback URL
  const videoSrc = useMemo(() => {
    return getBunnyStreamVideoUrl(videoGuid, bunnyConfig);
  }, [videoGuid, bunnyConfig]);

  if (!videoGuid) {
    return (
      <div className={`${aspectRatio} bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl flex items-center justify-center ${className}`}>
        <AlertCircle className="w-12 h-12 text-gray-500" />
      </div>
    );
  }

  return (
    <div className={`relative ${aspectRatio} rounded-xl overflow-hidden bg-black group ${className}`}>
      {/* Video Element */}
      <video
        className="w-full h-full"
        src={videoSrc}
        poster={poster}
        preload="metadata"
        autoPlay={autoplay}
        muted={isMuted}
        controls={false}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onMouseEnter={() => setShowPlayButton(false)}
        onMouseLeave={() => setShowPlayButton(!isPlaying)}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
            <p className="text-white text-sm font-medium">Processing video...</p>
          </div>
        </div>
      )}

      {/* Play Button Overlay */}
      {showPlayButton && !isPlaying && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/40 flex items-center justify-center z-20 cursor-pointer group/play">
          <div className="relative">
            <div className="absolute inset-0 bg-orange-500/30 rounded-full blur-2xl animate-pulse" />
            <button
              className="relative w-20 h-20 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center shadow-2xl hover:from-orange-600 hover:to-orange-700 transform transition-all duration-300 group-hover/play:scale-110"
              onClick={() => setIsPlaying(true)}
              aria-label="Play video"
            >
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* Gradient Overlays */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top Gradient */}
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/60 via-black/30 to-transparent z-10" />

        {/* Bottom Gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />
      </div>

      {/* Video Info */}
      {showInfo && (
        <div className="absolute bottom-0 left-0 right-0 p-4 z-30 transform transition-all duration-300 group-hover:opacity-100 opacity-0">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span className="text-xs font-bold text-orange-500 uppercase tracking-wider">Bunny Stream</span>
            </div>
            <h3 className="text-white font-semibold text-sm leading-tight max-w-[90%]">{title}</h3>
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {/* Left Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm transition-all"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm transition-all"
            aria-label="Fullscreen"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Status Badge */}
      <div className="absolute top-4 left-4 z-30">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500/80 to-orange-600/80 backdrop-blur-sm">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-xs font-semibold text-white">LIVE CDN</span>
        </div>
      </div>
    </div>
  );
}

/**
 * USAGE EXAMPLE:
 *
 * ```typescript
 * import BunnyStreamPlayer from "@/components/BunnyStreamPlayer";
 *
 * // In CourseDetails or CourseLMS
 * <BunnyStreamPlayer
 *   videoGuid="ae983721-96aa-445c-b13f-dc9333eb6b6b"
 *   title="Course Introduction"
 *   poster="https://cdn.example.com/poster.jpg"
 *   showInfo={true}
 *   isLoading={isProcessing}
 * />
 *
 * // With custom config
 * <BunnyStreamPlayer
 *   videoGuid={video.guid}
 *   title={video.title}
 *   bunnyConfig={customConfig}
 * />
 * ```
 */
