import { useEffect, useMemo, useState } from "react";
import { usePlatformData } from "@/context/PlatformDataContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit2, Trash2, Eye, EyeOff } from "lucide-react";
import { adminApi } from "@/services/adminApi";

export default function AdminAnnouncements() {
  const { announcements, setAnnouncements } = usePlatformData();
  const [searchTerm, setSearchTerm] = useState("");
  const [homepageContent, setHomepageContent] = useState<{ banners: unknown[]; testimonials: unknown[] }>({
    banners: [],
    testimonials: [],
  });
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    content: "",
    link: "",
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const loadHomepageContent = async () => {
      try {
        const data = await adminApi.getHomepage();
        setHomepageContent({
          banners: Array.isArray(data.banners) ? data.banners : [],
          testimonials: Array.isArray(data.testimonials) ? data.testimonials : [],
        });
        setAnnouncements(Array.isArray(data.announcements) ? (data.announcements as any) : []);
      } catch {
        // Keep current in-memory state if API is unavailable.
      }
    };

    void loadHomepageContent();
  }, [setAnnouncements]);

  const persistAnnouncements = async (nextAnnouncements: unknown[]) => {
    await adminApi.updateHomepage({
      banners: homepageContent.banners,
      testimonials: homepageContent.testimonials,
      announcements: nextAnnouncements,
    });
  };

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((announcement) =>
      announcement.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [announcements, searchTerm]);

  const handleAddAnnouncement = async () => {
    if (newAnnouncement.title && newAnnouncement.content) {
      const announcement = {
        id: `ann-${Date.now()}`,
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        link: newAnnouncement.link || "",
        isVisible: true,
      };
      const nextAnnouncements = [...announcements, announcement as any];
      try {
        await persistAnnouncements(nextAnnouncements);
        setAnnouncements(nextAnnouncements);
        setNewAnnouncement({ title: "", content: "", link: "" });
        setDialogOpen(false);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Failed to save announcement");
      }
    }
  };

  const handleToggleVisibility = async (announcementId: string) => {
    const updated = announcements.map((a) =>
      a.id === announcementId ? { ...a, isVisible: !a.isVisible } : a
    );
    try {
      await persistAnnouncements(updated);
      setAnnouncements(updated);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update visibility");
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    const target = announcements.find((announcement) => announcement.id === announcementId);
    if (!target) return;
    if (!window.confirm(`Delete announcement \"${target.title}\"?`)) return;

    const updated = announcements.filter((announcement) => announcement.id !== announcementId);
    try {
      await persistAnnouncements(updated);
      setAnnouncements(updated);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete announcement");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Announcements</h1>
          <p className="text-gray-600 mt-1">Create and manage platform announcements</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              <Plus className="w-4 h-4" />
              New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Announcement</DialogTitle>
              <DialogDescription>Share important updates with your students</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Title</label>
                <Input
                  placeholder="e.g., New Batch Starting Next Week"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Content</label>
                <Textarea
                  placeholder="Write your announcement content..."
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                  rows={4}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Link (Optional)</label>
                <Input
                  placeholder="https://example.com"
                  value={newAnnouncement.link}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, link: e.target.value })}
                />
              </div>
              <Button
                onClick={handleAddAnnouncement}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600"
              >
                Create Announcement
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Announcements</CardTitle>
              <CardDescription>{filteredAnnouncements.length} announcements</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search announcements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAnnouncements.length > 0 ? (
            <div className="space-y-3">
              {filteredAnnouncements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 truncate">{announcement.title}</h3>
                      <Badge
                        className={`${
                          announcement.isVisible
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                        }`}
                      >
                        {announcement.isVisible ? "Published" : "Hidden"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{announcement.content}</p>
                    {announcement.link && (
                      <a href={announcement.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 mt-2 inline-block">
                        {announcement.link}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleVisibility(announcement.id)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      {announcement.isVisible ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-900"
                      onClick={() => void handleDeleteAnnouncement(announcement.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No announcements found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
