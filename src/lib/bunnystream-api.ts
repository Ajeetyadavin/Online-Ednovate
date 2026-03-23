/**
 * Bunny Stream API Integration
 * Provides utilities for managing videos through Bunny Stream API
 */

export interface BunnyStreamConfig {
  enabled: boolean;
  libraryId: string;
  apiKey: string;
  cdnHostname: string;
  pullZone: string;
}

const resolveBunnyHostname = (config: BunnyStreamConfig): string => {
  const cdnHost = String(config.cdnHostname || "").trim();
  if (cdnHost) return cdnHost;

  const pullZone = String(config.pullZone || "").trim();
  return pullZone ? `${pullZone}.b-cdn.net` : "";
};

/**
 * Bunny Stream Video response
 */
export interface BunnyStreamVideo {
  videoId: string;
  title: string;
  length: number;
  status: number;
  dateUploaded: string;
  thumbnail: string;
  encodeProgress: number;
  views: number;
  guid: string;
}

/**
 * Get the video playback URL from Bunny Stream
 * @param videoId Video ID from Bunny Stream
 * @param config Bunny Stream configuration
 * @returns Full CDN URL for the video
 */
export const getBunnyStreamVideoUrl = (videoId: string, config: BunnyStreamConfig): string => {
  const hostname = resolveBunnyHostname(config);
  if (!hostname || !videoId) {
    return videoId;
  }

  // Bunny Stream CDN URL format: https://[CDN-HOSTNAME]/[VIDEO-GUID]/playlist.m3u8
  return `https://${hostname}/${videoId}/playlist.m3u8`;
};

/**
 * Get video thumbnail from Bunny Stream
 * @param videoGuid Video GUID from Bunny Stream
 * @param config Bunny Stream configuration
 * @returns Thumbnail URL
 */
export const getBunnyStreamThumbnailUrl = (videoGuid: string, config: BunnyStreamConfig): string => {
  const hostname = resolveBunnyHostname(config);
  if (!hostname || !videoGuid) {
    return "";
  }

  return `https://${hostname}/${videoGuid}/thumbnail.jpg`;
};

/**
 * Upload a video to Bunny Stream
 * @param file Video file to upload
 * @param config Bunny Stream configuration
 * @param onProgress Progress callback
 * @returns Video data from Bunny Stream
 */
export const uploadToBunnyStream = async (
  file: File,
  config: BunnyStreamConfig,
  onProgress?: (progress: number) => void
): Promise<BunnyStreamVideo> => {
  if (!config.enabled || !config.libraryId || !config.apiKey) {
    throw new Error("Bunny Stream API is not configured");
  }

  const formData = new FormData();
  formData.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        const percentComplete = (e.loaded / e.total) * 100;
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch {
          reject(new Error("Invalid response from Bunny Stream"));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    // Use library endpoint
    const uploadUrl = `https://api.bunnycdn.com/videolibrary/${config.libraryId}/videos`;
    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("AccessKey", config.apiKey);

    xhr.send(formData);
  });
};

/**
 * Get video details from Bunny Stream
 * @param videoId Video ID
 * @param config Bunny Stream configuration
 * @returns Video details
 */
export const getVideoDetails = async (
  videoId: string,
  config: BunnyStreamConfig
): Promise<BunnyStreamVideo> => {
  if (!config.enabled || !config.libraryId || !config.apiKey) {
    throw new Error("Bunny Stream API is not configured");
  }

  const response = await fetch(`https://api.bunnycdn.com/videolibrary/${config.libraryId}/videos/${videoId}`, {
    method: "GET",
    headers: {
      AccessKey: config.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch video details");
  }

  return response.json();
};

/**
 * Delete a video from Bunny Stream
 * @param videoId Video ID
 * @param config Bunny Stream configuration
 */
export const deleteVideo = async (videoId: string, config: BunnyStreamConfig): Promise<void> => {
  if (!config.enabled || !config.libraryId || !config.apiKey) {
    throw new Error("Bunny Stream API is not configured");
  }

  const response = await fetch(`https://api.bunnycdn.com/videolibrary/${config.libraryId}/videos/${videoId}`, {
    method: "DELETE",
    headers: {
      AccessKey: config.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to delete video");
  }
};

/**
 * Update video metadata in Bunny Stream
 * @param videoId Video ID
 * @param metadata Metadata to update (title, description, tags, etc.)
 * @param config Bunny Stream configuration
 */
export const updateVideoMetadata = async (
  videoId: string,
  metadata: Partial<{ title: string; description: string; tags: string[] }>,
  config: BunnyStreamConfig
): Promise<BunnyStreamVideo> => {
  if (!config.enabled || !config.libraryId || !config.apiKey) {
    throw new Error("Bunny Stream API is not configured");
  }

  const response = await fetch(`https://api.bunnycdn.com/videolibrary/${config.libraryId}/videos/${videoId}`, {
    method: "POST",
    headers: {
      AccessKey: config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    throw new Error("Failed to update video metadata");
  }

  return response.json();
};

/**
 * List all videos in library
 * @param config Bunny Stream configuration
 * @param limit Maximum number of videos to return
 * @param offset Offset for pagination
 * @returns Array of videos
 */
export const listVideos = async (
  config: BunnyStreamConfig,
  limit: number = 100,
  offset: number = 0
): Promise<BunnyStreamVideo[]> => {
  if (!config.enabled || !config.libraryId || !config.apiKey) {
    throw new Error("Bunny Stream API is not configured");
  }

  const response = await fetch(
    `https://api.bunnycdn.com/videolibrary/${config.libraryId}/videos?limit=${limit}&offset=${offset}`,
    {
      method: "GET",
      headers: {
        AccessKey: config.apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to list videos");
  }

  const data = await response.json();
  return data.items || [];
};

/**
 * Generate a signed playback URL for the video (with token-based access)
 * @param videoId Video ID
 * @param config Bunny Stream configuration
 * @param expiryHours How many hours the token should be valid (optional)
 * @returns Signed playback URL
 */
export const getSignedPlaybackUrl = (videoId: string, config: BunnyStreamConfig, expiryHours?: number): string => {
  const hostname = resolveBunnyHostname(config);
  if (!hostname || !videoId) {
    return videoId;
  }

  const baseUrl = `https://${hostname}/${videoId}/playlist.m3u8`;

  // For token-based access, would need additional implementation
  // This is a simplified version
  return baseUrl;
};

/**
 * USAGE EXAMPLE in AdminCourseContent.tsx:
 *
 * ```typescript
 * import { uploadToBunnyStream, getBunnyStreamVideoUrl } from "@/lib/bunnystream-api";
 * 
 * const handleVideoUpload = async (file: File) => {
 *   try {
 *     setUploading(true);
 *     const video = await uploadToBunnyStream(file, bunnyStreamConfig, (progress) => {
 *       setProgress(progress);
 *     });
 *     
 *     const playbackUrl = getBunnyStreamVideoUrl(video.guid, bunnyStreamConfig);
 *     // Save playbackUrl to your lesson/course
 *   } catch (error) {
 *     console.error("Upload failed:", error);
 *   } finally {
 *     setUploading(false);
 *   }
 * };
 * ```
 */
