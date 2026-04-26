import { useEffect, useMemo, useRef, useState } from "react";
import { adminApi, type BunnyLibraryCollection, type BunnyLibraryVideo } from "@/services/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Video, RefreshCw, FolderOpen, Clapperboard, Search, Upload, Plus, Trash2, Copy, Check, GripVertical, Play, Clock, HardDrive, Film, ArrowUpCircle, Image as ImageIcon, FileVideo, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/context/ConfirmContext";

const formatDuration = (seconds: number) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const AdminBunnyVideo = () => {
  const { confirm } = useConfirm();
  const [libraryId, setLibraryId] = useState("");
  const [collections, setCollections] = useState<BunnyLibraryCollection[]>([]);
  const [videos, setVideos] = useState<BunnyLibraryVideo[]>([]);
  const [searchText, setSearchText] = useState("");
  const [collectionFilterId, setCollectionFilterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCollectionId, setUploadCollectionId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [deletingVideoId, setDeletingVideoId] = useState("");

  // Multi-select
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Drag-to-collection
  const [draggingVideoIds, setDraggingVideoIds] = useState<string[]>([]);
  const [dragOverCollectionId, setDragOverCollectionId] = useState("");
  const [movingVideoIds, setMovingVideoIds] = useState<string[]>([]);

  // Copy feedback
  const [copiedId, setCopiedId] = useState("");
  const copyTimerRef = useRef<number | null>(null);

  const loadLibrary = async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(silent);
    setError(null);
    try {
      const result = await adminApi.getBunnyLibrary({
        limit: 250,
        search: searchText.trim() || undefined,
        collectionId: collectionFilterId || undefined,
      });
      setLibraryId(String(result.libraryId || ""));
      setCollections(Array.isArray(result.collections) ? result.collections : []);
      setVideos(Array.isArray(result.videos) ? result.videos : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Bunny Stream library");
      setCollections([]);
      setVideos([]);
      setLibraryId("");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadLibrary(false); }, 250);
    return () => window.clearTimeout(timer);
  }, [searchText, collectionFilterId]);

  // Clear selection when visible video list changes
  useEffect(() => { setSelectedVideoIds(new Set()); }, [videos]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const createCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) { toast.error("Collection name required"); return; }
    try {
      setCreatingCollection(true);
      await adminApi.createBunnyCollection(name);
      toast.success("Collection created");
      setNewCollectionName("");
      await loadLibrary(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create collection");
    } finally {
      setCreatingCollection(false);
    }
  };

  const uploadVideo = async () => {
    if (!uploadFile) { toast.error("Please choose a video file"); return; }
    try {
      setUploading(true);
      setUploadProgress(0);
      await adminApi.uploadVideoFileToBunnyWithProgress(uploadFile, "videos", {
        collectionId: uploadCollectionId || undefined,
        onProgress: (percent) => setUploadProgress(percent),
      });
      toast.success("Video uploaded successfully");
      setUploadFile(null);
      setUploadProgress(0);
      await loadLibrary(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to upload video");
    } finally {
      setUploading(false);
    }
  };

  const deleteVideo = async (videoId: string, title: string) => {
    const isConfirmed = await confirm({ title: "Delete Video?", description: `Delete video "${title || videoId}" from Bunny library?` });
    if (!isConfirmed) return;
    try {
      setDeletingVideoId(videoId);
      await adminApi.deleteBunnyVideo(videoId);
      toast.success("Video deleted");
      await loadLibrary(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete video");
    } finally {
      setDeletingVideoId("");
    }
  };

  const deleteSelectedVideos = async () => {
    const ids = Array.from(selectedVideoIds);
    if (!ids.length) return;
    const isConfirmed = await confirm({ title: "Delete Selected Videos?", description: `Delete ${ids.length} selected video(s)?` });
    if (!isConfirmed) return;
    try {
      setBulkDeleting(true);
      await Promise.all(ids.map((id) => adminApi.deleteBunnyVideo(id)));
      toast.success(`${ids.length} video(s) deleted`);
      setSelectedVideoIds(new Set());
      await loadLibrary(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete selected videos");
    } finally {
      setBulkDeleting(false);
    }
  };

  const moveVideosToCollection = async (videoIds: string[], collectionId: string) => {
    if (!videoIds.length || !collectionId) return;
    const name = collections.find((c) => c.id === collectionId)?.name || collectionId;
    try {
      setMovingVideoIds(videoIds);
      await Promise.all(videoIds.map((id) => adminApi.moveBunnyVideoToCollection(id, collectionId)));
      toast.success(`${videoIds.length} video(s) moved to "${name}"`);
      setSelectedVideoIds(new Set());
      await loadLibrary(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to move video(s)");
    } finally {
      setMovingVideoIds([]);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      setCopiedId(text);
      toast.success(`${label} copied`);
      copyTimerRef.current = window.setTimeout(() => setCopiedId(""), 1500) as unknown as number;
    }).catch(() => toast.error("Copy failed"));
  };

  // ─── Selection helpers ───────────────────────────────────────────────────────

  const allSelected = videos.length > 0 && selectedVideoIds.size === videos.length;
  const someSelected = selectedVideoIds.size > 0 && !allSelected;

  const toggleSelectVideo = (id: string) => {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedVideoIds(allSelected ? new Set() : new Set(videos.map((v) => v.id)));
  };

  // ─── Drag helpers ────────────────────────────────────────────────────────────

  const handleVideoDragStart = (e: React.DragEvent, videoId: string) => {
    const ids = selectedVideoIds.has(videoId) && selectedVideoIds.size > 1
      ? Array.from(selectedVideoIds)
      : [videoId];
    setDraggingVideoIds(ids);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", ids.join(","));
  };

  const handleVideoDragEnd = () => {
    setDraggingVideoIds([]);
    setDragOverCollectionId("");
  };

  const handleCollectionDragOver = (e: React.DragEvent, collectionId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCollectionId(collectionId);
  };

  const handleCollectionDrop = (e: React.DragEvent, collectionId: string) => {
    e.preventDefault();
    setDragOverCollectionId("");
    const ids = e.dataTransfer.getData("text/plain").split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return;
    void moveVideosToCollection(ids, collectionId);
    setDraggingVideoIds([]);
  };

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const totalDurationSeconds = useMemo(
    () => videos.reduce((sum, v) => sum + Math.max(0, Number(v.lengthSeconds || 0)), 0),
    [videos],
  );

  const isDraggingAny = draggingVideoIds.length > 0;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-full font-['Inter'] animate-in fade-in duration-300">
      {/* ───────────────── HEADER SECTION ───────────────── */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
              <HardDrive className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bunny Video Storage</h1>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-500">
                <span className="font-mono text-blue-600">{libraryId || "No Library Connected"}</span>
                {libraryId && <span className="text-slate-300">•</span>}
                <span className="text-slate-500">{videos.length} videos</span>
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-10 w-full rounded-lg border-slate-200 bg-slate-50 pl-10 pr-4 text-sm transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 sm:w-64"
                placeholder="Search videos..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <Button
              type="button"
              className="h-10 shrink-0 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
              onClick={() => void loadLibrary(true)}
              disabled={refreshing || loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${(refreshing || loading) ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-px bg-slate-100 lg:grid-cols-4">
          <div className="flex items-center gap-3 bg-white px-6 py-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
              <Film className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Videos</p>
              <p className="text-xl font-bold text-slate-900">{videos.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white px-6 py-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Duration</p>
              <p className="text-xl font-bold text-slate-900">{formatDuration(totalDurationSeconds)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white px-6 py-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
              <FolderOpen className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Collections</p>
              <p className="text-xl font-bold text-slate-900">{collections.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white px-6 py-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50">
              <CheckCircle className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Ready</p>
              <p className="text-xl font-bold text-slate-900">{videos.filter(v => Number(v.status) === 4).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────── MAIN CONTENT ───────────────── */}
      <div className="flex w-full flex-col gap-6 lg:flex-row">
        
        {/* Create Collection */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <Plus className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-800">New Collection</h2>
          </div>
          <div className="flex flex-col gap-3">
            <Input
              className="h-10 w-full rounded-lg border-slate-200 bg-slate-50 px-3 text-sm transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              placeholder="e.g. Chapter 1 Videos"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void createCollection(); }}
            />
            <Button
              type="button"
              className="h-10 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
              onClick={() => void createCollection()}
              disabled={creatingCollection}
            >
              {creatingCollection ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Collection"}
            </Button>
          </div>
        </div>

        {/* Collections List */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                  <FolderOpen className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Collections</h2>
                  <p className="text-xs font-medium text-slate-500">{collections.length} total</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col overflow-y-auto max-h-[50vh] p-2 space-y-1">
            <button
              onClick={() => setCollectionFilterId("")}
              className={`flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left transition-all duration-150 ${
                collectionFilterId === "" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FolderOpen className={`h-4 w-4 ${collectionFilterId === "" ? "text-emerald-600" : "text-slate-400"}`} />
                <span className="text-sm font-medium">All Videos</span>
              </div>
              <span className="text-xs font-medium text-slate-400">{videos.length}</span>
            </button>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            ) : collections.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-slate-500">No collections found.</p>
              </div>
            ) : (
              collections.map((item) => {
                const isDropTarget = dragOverCollectionId === item.id;
                const isActive = collectionFilterId === item.id;
                return (
                  <div
                    key={item.id}
                    onDragOver={(e) => handleCollectionDragOver(e, item.id)}
                    onDragLeave={() => setDragOverCollectionId("")}
                    onDrop={(e) => handleCollectionDrop(e, item.id)}
                    className={`group relative flex w-full flex-col justify-center rounded-lg px-4 py-2.5 text-left transition-all duration-150 ${
                      isDropTarget
                        ? "border-blue-400 bg-blue-50"
                        : isActive
                        ? "bg-emerald-50 border border-emerald-200"
                        : "bg-transparent hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setCollectionFilterId(item.id)}
                        className="flex-1 flex items-center gap-2.5 focus:outline-none"
                      >
                        <FolderOpen className={`h-4 w-4 ${isActive ? "text-emerald-600" : "text-slate-400 group-hover:text-emerald-500"}`} />
                        <span className={`truncate text-sm font-medium ${isActive ? "text-emerald-700" : "text-slate-600"}`}>
                          {item.name}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(item.id, "Collection ID"); }}
                        className={`ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-all ${
                          copiedId === item.id ? "bg-emerald-100 text-emerald-600 opacity-100" : "bg-slate-200 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600"
                        }`}
                        title="Copy ID"
                      >
                        {copiedId === item.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    {isActive && (
                      <p className="mt-1 pl-7 text-[11px] font-medium text-emerald-600/80">
                        Contains {item.videoCount} videos
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ───────────────── RIGHT MAIN PANE ───────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-6">

      {/* ───────────────── UPLOAD & ACTIONS ───────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Upload Tool */}
          <div className="col-span-1 lg:col-span-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="h-5 w-5 text-blue-500" />
                  <h2 className="text-base font-semibold text-slate-800">Upload Video</h2>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <select
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 sm:w-44"
                    value={uploadCollectionId}
                    onChange={(e) => setUploadCollectionId(e.target.value)}
                  >
                    <option value="">No Collection</option>
                    {collections.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <label className="flex h-10 flex-1 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-3 transition-all hover:border-blue-400 hover:bg-blue-50">
                    <div className="flex items-center gap-2">
                      <FileVideo className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-600 truncate">{uploadFile ? uploadFile.name : "Select Video File"}</span>
                    </div>
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>
              
              <Button
                type="button"
                className="h-10 shrink-0 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap"
                onClick={() => void uploadVideo()}
                disabled={uploading || !uploadFile}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading {Math.round(uploadProgress)}%
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Start Upload
                  </>
                )}
              </Button>
            </div>
            
            {uploading && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, uploadProgress))}%` }}
                />
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="flex flex-col justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Duration</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{formatDuration(totalDurationSeconds)}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="overflow-hidden rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                <span className="text-red-600">!</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-red-700">{error}</p>
                <p className="mt-1 text-xs text-red-600">Please ensure Library ID + API Key are securely configured.</p>
              </div>
            </div>
          </div>
        )}

        {/* Videos Table */}
        <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                <Clapperboard className="h-4 w-4 text-blue-600" />
              </div>
              <h2 className="text-base font-semibold text-slate-800">
                {collectionFilterId ? (collections.find(c => c.id === collectionFilterId)?.name || 'Videos') : 'All Videos'}
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {videos.length}
              </span>
              {(isDraggingAny || selectedVideoIds.size > 0) && (
                <span className="ml-2 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                  {selectedVideoIds.size || draggingVideoIds.length} selected
                </span>
              )}
            </div>

            {selectedVideoIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Move:</span>
                <select
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none transition-all focus:border-blue-500"
                  defaultValue=""
                  onChange={(e) => {
                    const col = e.target.value;
                    if (!col) return;
                    e.target.value = "";
                    void moveVideosToCollection(Array.from(selectedVideoIds), col);
                  }}
                >
                  <option value="">Move to...</option>
                  {collections.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-lg border-red-200 px-3 text-xs font-medium text-red-600 transition-all hover:bg-red-50"
                  onClick={() => void deleteSelectedVideos()}
                  disabled={bulkDeleting}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {bulkDeleting ? "..." : `Delete`}
                </Button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto min-h-[300px]">
            {loading ? (
              <div className="flex h-48 flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-blue-600"></div>
                <span className="text-sm font-medium text-slate-500">Loading videos...</span>
              </div>
            ) : videos.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center px-4 text-center">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100">
                  <ImageIcon className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-base font-medium text-slate-700">No Videos Found</p>
                <p className="mt-1 max-w-xs text-sm text-slate-500">
                  Your current view is empty. Upload new files to this collection.
                </p>
              </div>
            ) : (
              <table className="min-w-full text-left text-sm whitespace-nowrap">
                <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected; }}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600"
                      />
                    </th>
                    <th className="w-8 px-2 py-3"></th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {videos.map((video) => {
                    const isSelected = selectedVideoIds.has(video.id);
                    const isDragging = draggingVideoIds.includes(video.id);
                    const isMoving = movingVideoIds.includes(video.id);
                    return (
                      <tr
                        key={video.id}
                        className={`transition-colors duration-150 ${
                          isDragging ? "bg-slate-50 opacity-50"
                          : isSelected ? "bg-blue-50/70"
                          : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectVideo(video.id)}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600"
                          />
                        </td>
                        <td
                          className="cursor-grab px-2 py-3 text-slate-300 hover:text-slate-500"
                          draggable
                          onDragStart={(e) => handleVideoDragStart(e, video.id)}
                          onDragEnd={handleVideoDragEnd}
                        >
                          <GripVertical className="h-4 w-4" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                              <Play className="h-3.5 w-3.5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-800 max-w-[200px] truncate" title={video.title}>{video.title}</p>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-slate-400">{video.id}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(video.id, "Video ID")}
                                  className={`flex transition-colors ${
                                    copiedId === video.id ? "text-emerald-500" : "text-slate-300 hover:text-emerald-500"
                                  }`}
                                >
                                  {copiedId === video.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            {formatDuration(video.lengthSeconds)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase ${
                            Number(video.status) === 4 ? "bg-emerald-100 text-emerald-700" :
                            Number(video.status) === 3 ? "bg-amber-100 text-amber-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {Number(video.status) === 4 ? <CheckCircle className="h-2.5 w-2.5" /> : null}
                            {Number(video.status) === 4 ? "Ready" : Number(video.status) === 3 ? "Encoding" : video.status || "?"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {video.dateCreated ? new Date(video.dateCreated).toLocaleDateString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric'
                          }) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-7 rounded-md px-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            onClick={() => void deleteVideo(video.id, video.title)}
                            disabled={deletingVideoId === video.id || isMoving}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminBunnyVideo;
