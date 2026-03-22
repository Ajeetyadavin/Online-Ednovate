import { useState, useCallback } from "react";
import { useSiteSettings, type HomepageSection } from "@/context/SiteSettingsContext";
import { adminApi } from "@/services/adminApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff, Trash2, Edit2, Plus, ArrowUp, ArrowDown, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

export default function AdminHomepageSectionBuilder() {
  const { settings, updateSettings } = useSiteSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
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
    visible: true,
  });

  const sortedSections = [...(settings.customHomepageSections || [])].sort((a, b) => a.order - b.order);

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
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save custom sections");
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

  const deleteSection = (id: string) => {
    if (!confirm("Delete this section?")) return;
    const sections = (settings.customHomepageSections || []).filter((s) => s.id !== id);
    void persistSections(sections);
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
                        onClick={() => deleteSection(section.id)}
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
    </div>
  );
}
