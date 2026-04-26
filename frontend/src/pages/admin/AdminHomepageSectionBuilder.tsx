import { useState, useCallback } from "react";
import { HOMEPAGE_SECTION_ANCHORS, useSiteSettings, type HomepageSection, type HomepageSectionAnchor } from "@/context/SiteSettingsContext";
import { usePlatformData } from "@/context/PlatformDataContext";
import { adminApi, fileToBase64 } from "@/services/adminApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff, Trash2, Edit2, Plus, ArrowUp, ArrowDown, Save, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

const HOMEPAGE_SECTION_ANCHOR_LABELS: Record<HomepageSectionAnchor, string> = {
  "before-hero": "Before Hero Banner",
  heroBanner: "After Hero Banner",
  announcementBar: "After Announcement Bar",
  statsCounter: "After Stats Counter",
  howItWorks: "After How It Works",
  popularCourses: "After Popular Courses",
  whyChooseUs: "After Why Choose Us",
  testimonials: "After Testimonials",
  faculty: "After Faculty Section",
  faq: "After FAQ",
  ctaBand: "After CTA Band",
};

export default function AdminHomepageSectionBuilder() {
  const { settings, updateSettings } = useSiteSettings();
  const { courses } = usePlatformData();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState<HomepageSection>({
    id: "",
    type: "text",
    title: "",
    subtitle: "",
    content: "",
    imageUrl: "",
    backgroundColor: "#FFFFFF",
    textColor: "#000000",
    fontSize: "16",
    fontFamily: "sans-serif",
    order: 0,
    insertAfter: "faq",
    visible: true,
  });

  const sortedSections = [...(settings.customHomepageSections || [])].sort((a, b) => a.order - b.order);
  const visibleCourses = courses.filter((course) => course.isVisible);

  const selectedCourseIds = Array.isArray(formData.customSettings?.selectedCourseIds)
    ? (formData.customSettings?.selectedCourseIds as string[])
    : [];

  const maxCourses = Number(formData.customSettings?.maxCourses || 8);

  const persistSections = useCallback(async (nextSections: HomepageSection[]) => {
    setIsSaving(true);
    const nextDraft = { ...settings, customHomepageSections: nextSections };
    try {
      updateSettings({ customHomepageSections: nextSections });
      await adminApi.saveHomepagePlatformSettings({
        bunnyStreamApi: {
          enabled: Boolean(nextDraft.bunnyStreamApi?.enabled),
          libraryId: String(nextDraft.bunnyStreamApi?.libraryId || ""),
          apiKey: String(nextDraft.bunnyStreamApi?.apiKey || ""),
          cdnHostname: String(nextDraft.bunnyStreamApi?.cdnHostname || ""),
          pullZone: String(nextDraft.bunnyStreamApi?.pullZone || ""),
        },
        siteSettings: nextDraft as unknown as Record<string, unknown>,
        homepage: { exploreCategoryIds: nextDraft.exploreCategoryIds || [] },
      });
      toast.success("Homepage sections saved successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save custom sections");
    } finally {
      setIsSaving(false);
    }
  }, [settings, updateSettings]);

  const openEditDialog = (section: HomepageSection) => {
    setFormData(section);
    setEditingId(section.id);
    setShowDialog(true);
  };

  const openNewDialog = () => {
    setFormData({
      id: `section-${Date.now()}`,
      type: "text",
      title: "",
      subtitle: "",
      content: "",
      imageUrl: "",
      backgroundColor: "#FFFFFF",
      textColor: "#000000",
      fontSize: "16",
      fontFamily: "sans-serif",
      order: sortedSections.length,
      insertAfter: "faq",
      visible: true,
    });
    setEditingId(null);
    setShowDialog(true);
  };

  const saveSection = async () => {
    const sections = settings.customHomepageSections || [];
    const newSections = editingId
      ? sections.map((s) => (s.id === editingId ? formData : s))
      : [...sections, formData];
    await persistSections(newSections);
    setShowDialog(false);
  };

  const confirmDeleteSection = (id: string) => {
    setSectionToDelete(id);
  };

  const executeDeleteSection = () => {
    if (!sectionToDelete) return;
    const sections = (settings.customHomepageSections || []).filter((s) => s.id !== sectionToDelete);
    void persistSections(sections);
    setSectionToDelete(null);
  };

  const handleBannerImageUpload = async (file?: File | null) => {
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const base64Data = await fileToBase64(file);
      const uploaded = await adminApi.uploadImage(file.name, file.type, base64Data, "homepage-banners");
      setFormData((prev) => ({ ...prev, imageUrl: uploaded.url }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const toggleSelectedCourse = (courseId: string, checked: boolean) => {
    const current = Array.isArray(formData.customSettings?.selectedCourseIds)
      ? (formData.customSettings?.selectedCourseIds as string[])
      : [];
    const nextSelected = checked
      ? Array.from(new Set([...current, courseId]))
      : current.filter((id) => id !== courseId);

    setFormData((prev) => ({
      ...prev,
      customSettings: {
        ...(prev.customSettings || {}),
        selectedCourseIds: nextSelected,
      },
    }));
  };

  const toggleVisibility = (id: string) => {
    const sections = (settings.customHomepageSections || []).map((s) =>
      s.id === id ? { ...s, visible: !s.visible } : s,
    );
    void persistSections(sections);
  };

  const reorderSection = (id: string, direction: "up" | "down") => {
    const sections = [...(settings.customHomepageSections || [])].sort((a, b) => a.order - b.order);
    const index = sections.findIndex((s) => s.id === id);
    if (index < 0) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= sections.length) return;

    const newSections = sections.map((s, i) => ({
      ...s,
      order: i < Math.min(index, target) || i > Math.max(index, target) ? s.order : i === target ? index : target,
    }));
    void persistSections(newSections);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Custom Homepage Sections</CardTitle>
          <CardDescription>Build fully customizable sections with text, banners, courses, and more</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={openNewDialog} className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
            <Plus className="w-4 h-4" /> Add New Section
          </Button>

          <div className="space-y-3">
            {sortedSections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No custom sections yet. Create one to get started!</p>
              </div>
            ) : (
              sortedSections.map((section, index) => (
                <div key={section.id} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="px-2 py-1 rounded text-xs font-semibold text-white"
                          style={{ backgroundColor: section.backgroundColor }}
                        >
                          {section.type.toUpperCase()}
                        </span>
                        <h3 className="font-semibold">{section.title || "Untitled"}</h3>
                      </div>
                      <p className="text-xs text-gray-600">Order: {section.order}</p>
                      <p className="text-xs text-gray-500">Placement: {HOMEPAGE_SECTION_ANCHOR_LABELS[section.insertAfter || "faq"]}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleVisibility(section.id)}
                        title={section.visible ? "Hide" : "Show"}
                      >
                        {section.visible ? (
                          <Eye className="w-4 h-4 text-blue-600" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={index === 0}
                        onClick={() => reorderSection(section.id, "up")}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={index === sortedSections.length - 1}
                        onClick={() => reorderSection(section.id, "down")}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => openEditDialog(section)}
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => confirmDeleteSection(section.id)}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Section" : "Create New Section"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Section Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as HomepageSection["type"] })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="hero">Hero Section</option>
                <option value="banner">Banner Image</option>
                <option value="text">Text Block</option>
                <option value="courses">Courses Grid</option>
                <option value="features">Features List</option>
                <option value="cta">Call To Action</option>
                <option value="custom">Custom HTML</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Title</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Section title"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Subtitle</label>
              <Input
                value={formData.subtitle || ""}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                placeholder="Optional subtitle"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Place Section</label>
              <select
                value={formData.insertAfter || "faq"}
                onChange={(e) => setFormData({ ...formData, insertAfter: e.target.value as HomepageSectionAnchor })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                {HOMEPAGE_SECTION_ANCHORS.map((anchor) => (
                  <option key={anchor} value={anchor}>{HOMEPAGE_SECTION_ANCHOR_LABELS[anchor]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Content</label>
              <Textarea
                value={formData.content || ""}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Main content (text, features separated by lines, or HTML)"
                rows={5}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Image URL</label>
              <Input
                value={formData.imageUrl || ""}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            {(formData.type === "banner" || formData.type === "hero") && (
              <div className="rounded border border-gray-200 p-3 space-y-2">
                <p className="text-sm font-medium text-gray-700">Upload Banner Image</p>
                <label className="inline-flex items-center gap-2 text-sm border border-gray-300 rounded px-3 py-2 cursor-pointer hover:bg-gray-50">
                  <Upload className="w-4 h-4" />
                  {isUploadingImage ? "Uploading..." : "Choose Image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isUploadingImage}
                    onChange={(e) => void handleBannerImageUpload(e.target.files?.[0])}
                  />
                </label>
                <p className="text-xs text-gray-500">Recommended: wide banner image for best hero-like look.</p>
              </div>
            )}

            {formData.type === "courses" && (
              <div className="rounded border border-gray-200 p-3 space-y-3">
                <p className="text-sm font-medium text-gray-700">Select Courses For This Grid</p>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Max Courses To Show</label>
                  <Input
                    type="number"
                    min="1"
                    max="24"
                    value={String(maxCourses)}
                    onChange={(e) => {
                      const nextMax = Math.min(24, Math.max(1, Number(e.target.value || 8)));
                      setFormData((prev) => ({
                        ...prev,
                        customSettings: {
                          ...(prev.customSettings || {}),
                          maxCourses: nextMax,
                        },
                      }));
                    }}
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-100 rounded p-2">
                  {visibleCourses.length === 0 && (
                    <p className="text-xs text-gray-500">No visible courses found.</p>
                  )}
                  {visibleCourses.map((course) => {
                    const checked = selectedCourseIds.includes(course.id);
                    return (
                      <label key={course.id} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleSelectedCourse(course.id, e.target.checked)}
                        />
                        <span>{course.title}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500">If no course is selected, system will use category-based explore courses.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Background Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.backgroundColor}
                    onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                    className="w-12 h-10 rounded cursor-pointer border"
                  />
                  <Input
                    value={formData.backgroundColor}
                    onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Text Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.textColor}
                    onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                    className="w-12 h-10 rounded cursor-pointer border"
                  />
                  <Input value={formData.textColor} onChange={(e) => setFormData({ ...formData, textColor: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Font Size (px)</label>
                <Input
                  type="number"
                  value={formData.fontSize}
                  onChange={(e) => setFormData({ ...formData, fontSize: e.target.value })}
                  min="10"
                  max="64"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Font Family</label>
                <select
                  value={formData.fontFamily}
                  onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="sans-serif">Sans Serif</option>
                  <option value="serif">Serif</option>
                  <option value="monospace">Monospace</option>
                  <option value="cursive">Cursive</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded border border-gray-200 p-3">
              <span className="text-sm text-gray-700">Visible on homepage</span>
              <Switch
                checked={formData.visible}
                onCheckedChange={(checked) => setFormData({ ...formData, visible: checked })}
              />
            </div>

            <Button
              onClick={saveSection}
              disabled={isSaving}
              className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? "Saving..." : editingId ? "Update Section" : "Create Section"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!sectionToDelete} onOpenChange={(open) => !open && setSectionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the section from the homepage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDeleteSection}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
