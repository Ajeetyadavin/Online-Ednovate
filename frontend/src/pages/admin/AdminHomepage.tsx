import { useEffect, useRef, useState } from "react";
import { usePlatformData } from "@/context/PlatformDataContext";
import { adminApi, fileToBase64 } from "@/services/adminApi";
import { useSiteSettings, type SiteSettings } from "@/context/SiteSettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Edit2, Trash2, Star, Upload, Loader2, Image, Megaphone, MessageSquare, LayoutDashboard, Settings2, Plus } from "lucide-react";
import AdminHomepageSectionBuilder from "./AdminHomepageSectionBuilder";

/* ─── Types ─────────────────────────────────────────────────── */
type Tab = "banners" | "categories" | "announcements" | "testimonials" | "sections" | "site";

/* ─── Field label ─────────────────────────────────────────────── */
const FL = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{children}</p>
);
const fCls = "h-9 rounded-xl border-slate-200 text-xs placeholder:text-slate-400 focus-visible:ring-primary/40";
const textAreaCls = "w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40";

const ColorField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="space-y-1.5">
    <FL>{label}</FL>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-11 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
      />
      <Input className={fCls} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  </div>
);

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "banners", label: "Banners", icon: Image },
  { id: "categories", label: "Categories", icon: LayoutDashboard },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "testimonials", label: "Testimonials", icon: MessageSquare },
  { id: "sections", label: "Custom Sections", icon: Plus },
  { id: "site", label: "Site Config", icon: Settings2 },
];

export default function AdminHomepage() {
  const { settings, updateSettings, resetSettings } = useSiteSettings();
  const { banners, announcements, testimonials, categories, setBanners, setTestimonials, setAnnouncements } = usePlatformData();

  const [activeTab, setActiveTab] = useState<Tab>("banners");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [siteDraft, setSiteDraft] = useState<SiteSettings>(settings);

  const [newBanner, setNewBanner] = useState({ title: "", imageUrl: "" });
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", content: "", link: "" });
  const [newTestimonial, setNewTestimonial] = useState({ authorName: "", authorRole: "", content: "", rating: 5, avatarUrl: "" });
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const settingsSaveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => { setSiteDraft(settings); }, [settings]);

  const buildHomepagePlatformSettingsPayload = (draft: SiteSettings) => ({
    bunnyStreamApi: {
      enabled: Boolean(draft.bunnyStreamApi?.enabled),
      libraryId: String(draft.bunnyStreamApi?.libraryId || ""),
      apiKey: String(draft.bunnyStreamApi?.apiKey || ""),
      cdnHostname: String(draft.bunnyStreamApi?.cdnHostname || ""),
      pullZone: String(draft.bunnyStreamApi?.pullZone || ""),
    },
    siteSettings: draft as unknown as Record<string, unknown>,
    homepage: {
      exploreCategoryIds: Array.isArray(draft.exploreCategoryIds) ? draft.exploreCategoryIds : [],
    },
  });

  const persistHomepage = async (nextBanners = banners, nextTestimonials = testimonials, nextAnnouncements = announcements) => {
    setIsSaving(true);
    try { await adminApi.updateHomepage({ banners: nextBanners, testimonials: nextTestimonials, announcements: nextAnnouncements }); }
    catch (error) { alert(error instanceof Error ? error.message : "Failed to save homepage data"); }
    finally { setIsSaving(false); }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [data, platform] = await Promise.all([adminApi.getHomepage(), adminApi.getHomepagePlatformSettings().catch(() => null)]);
        setBanners((data.banners || []) as any);
        setTestimonials((data.testimonials || []) as any);
        setAnnouncements((data.announcements || []) as any);
        const loadedSiteSettings = platform?.settings?.siteSettings as Partial<SiteSettings> | undefined;
        const loadedExplore = platform?.settings?.homepage?.exploreCategoryIds;
        const safeExplore = Array.isArray(loadedExplore)
          ? loadedExplore.map((id) => String(id).trim()).filter(Boolean)
          : Array.isArray(loadedSiteSettings?.exploreCategoryIds)
            ? loadedSiteSettings.exploreCategoryIds.map((id) => String(id).trim()).filter(Boolean)
            : settings.exploreCategoryIds || [];

        if (loadedSiteSettings) {
          const merged = {
            ...settings,
            ...loadedSiteSettings,
            exploreCategoryIds: safeExplore,
          } as SiteSettings;
          updateSettings(merged);
          setSiteDraft(merged);
          return;
        }

        if (safeExplore.length > 0) {
          const merged = {
            ...settings,
            exploreCategoryIds: safeExplore,
          } as SiteSettings;
          updateSettings(merged);
          setSiteDraft(merged);
        }
      } catch { /* Keep local fallback */ }
    };
    load();
  }, []);

  const persistSiteSettings = async (draft: SiteSettings, syncLocal = true) => {
    setIsSaving(true);
    try {
      if (syncLocal) updateSettings(draft);
      const result = await adminApi.saveHomepagePlatformSettings(buildHomepagePlatformSettingsPayload(draft));
      const savedSiteSettings = result?.settings?.siteSettings as Partial<SiteSettings> | undefined;
      const savedExploreIds = Array.isArray(result?.settings?.homepage?.exploreCategoryIds)
        ? result.settings.homepage.exploreCategoryIds.map((item) => String(item).trim()).filter(Boolean)
        : draft.exploreCategoryIds || [];

      if (savedSiteSettings) {
        const nextDraft = {
          ...draft,
          ...savedSiteSettings,
          exploreCategoryIds: savedExploreIds,
        } as SiteSettings;
        setSiteDraft(nextDraft);
        updateSettings(nextDraft);
      }
    } catch (error) { alert(error instanceof Error ? error.message : "Failed to save site settings"); }
    finally { setIsSaving(false); }
  };

  const updateFaqItem = (index: number, key: "question" | "answer", value: string) => setSiteDraft((prev) => ({ ...prev, homepageContent: { ...prev.homepageContent, faq: { ...prev.homepageContent.faq, items: prev.homepageContent.faq.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)) } } }));
  const addFaqItem = () => setSiteDraft((prev) => ({ ...prev, homepageContent: { ...prev.homepageContent, faq: { ...prev.homepageContent.faq, items: [...prev.homepageContent.faq.items, { question: "", answer: "" }] } } }));
  const removeFaqItem = (index: number) => setSiteDraft((prev) => ({ ...prev, homepageContent: { ...prev.homepageContent, faq: { ...prev.homepageContent.faq, items: prev.homepageContent.faq.items.filter((_, i) => i !== index) } } }));

  const updateStatItem = (index: number, key: "label" | "value" | "suffix", value: string) => setSiteDraft((prev) => ({ ...prev, homepageContent: { ...prev.homepageContent, stats: { ...prev.homepageContent.stats, items: prev.homepageContent.stats.items.map((item, i) => i === index ? { ...item, [key]: key === "value" ? Number(value || 0) : value } : item) } } }));
  const addStatItem = () => setSiteDraft((prev) => ({ ...prev, homepageContent: { ...prev.homepageContent, stats: { ...prev.homepageContent.stats, items: [...prev.homepageContent.stats.items, { label: "", value: 0, suffix: "" }] } } }));
  const removeStatItem = (index: number) => setSiteDraft((prev) => ({ ...prev, homepageContent: { ...prev.homepageContent, stats: { ...prev.homepageContent.stats, items: prev.homepageContent.stats.items.filter((_, i) => i !== index) } } }));

  const updateHowStep = (index: number, key: "title" | "desc" | "icon", value: string) => setSiteDraft((prev) => ({ ...prev, homepageContent: { ...prev.homepageContent, howItWorks: { ...prev.homepageContent.howItWorks, steps: prev.homepageContent.howItWorks.steps.map((step, i) => (i === index ? { ...step, [key]: value } : step)) } } }));
  const addHowStep = () => setSiteDraft((prev) => ({ ...prev, homepageContent: { ...prev.homepageContent, howItWorks: { ...prev.homepageContent.howItWorks, steps: [...prev.homepageContent.howItWorks.steps, { title: "", desc: "", icon: "Search" }] } } }));
  const removeHowStep = (index: number) => setSiteDraft((prev) => ({ ...prev, homepageContent: { ...prev.homepageContent, howItWorks: { ...prev.homepageContent.howItWorks, steps: prev.homepageContent.howItWorks.steps.filter((_, i) => i !== index) } } }));

  const updateWhyItem = (index: number, key: "title" | "description" | "icon", value: string) => setSiteDraft((prev) => ({ ...prev, homepageContent: { ...prev.homepageContent, whyChooseUs: { ...prev.homepageContent.whyChooseUs, items: prev.homepageContent.whyChooseUs.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)) } } }));
  const addWhyItem = () => setSiteDraft((prev) => ({ ...prev, homepageContent: { ...prev.homepageContent, whyChooseUs: { ...prev.homepageContent.whyChooseUs, items: [...prev.homepageContent.whyChooseUs.items, { title: "", description: "", icon: "BookOpen" }] } } }));
  const removeWhyItem = (index: number) => setSiteDraft((prev) => ({ ...prev, homepageContent: { ...prev.homepageContent, whyChooseUs: { ...prev.homepageContent.whyChooseUs, items: prev.homepageContent.whyChooseUs.items.filter((_, i) => i !== index) } } }));

  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleToggleExploreCategory = (categoryId: string, checked: boolean) => {
    setSiteDraft((prev) => {
      const current = prev.exploreCategoryIds || [];
      const next = checked
        ? Array.from(new Set([...current, categoryId]))
        : current.filter((id) => id !== categoryId);
      const nextDraft = { ...prev, exploreCategoryIds: next };

      updateSettings(nextDraft);
      settingsSaveQueueRef.current = settingsSaveQueueRef.current
        .then(() => persistSiteSettings(nextDraft, false))
        .catch(() => undefined);

      return nextDraft;
    });
  };

  const uploadImageFile = async (file: File, folder: string) => {
    setIsUploading(true);
    try { const base64Data = await fileToBase64(file); const uploaded = await adminApi.uploadImage(file.name, file.type, base64Data, folder); return uploaded.url; }
    finally { setIsUploading(false); }
  };

  const handleBannerFileInput = async (file?: File | null) => {
    if (!file) return;
    try { const url = await uploadImageFile(file, "homepage-banners"); setNewBanner((prev) => ({ ...prev, imageUrl: url })); }
    catch (error) { alert(error instanceof Error ? error.message : "Image upload failed"); }
  };

  const handleTestimonialImage = async (file?: File | null) => {
    if (!file) return;
    try { const url = await uploadImageFile(file, "testimonials"); setNewTestimonial((prev) => ({ ...prev, avatarUrl: url })); }
    catch (error) { alert(error instanceof Error ? error.message : "Image upload failed"); }
  };

  const handleLogoFileInput = async (file?: File | null) => {
    if (!file) return;
    try {
      const url = await uploadImageFile(file, "branding");
      setSiteDraft((prev) => {
        const nextDraft = { ...prev, logo: url };
        updateSettings(nextDraft);
        settingsSaveQueueRef.current = settingsSaveQueueRef.current
          .then(() => persistSiteSettings(nextDraft, false))
          .catch(() => undefined);
        return nextDraft;
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Logo upload failed");
    }
  };

  const handleAddBanner = async () => {
    if (!newBanner.title.trim() || !newBanner.imageUrl.trim()) { alert("Banner title and image are required"); return; }
    const next = [...banners, { id: `banner_${Date.now()}`, title: newBanner.title, imageUrl: newBanner.imageUrl, isVisible: true, sortOrder: banners.length + 1 }];
    setBanners(next); await persistHomepage(next, testimonials, announcements); setNewBanner({ title: "", imageUrl: "" });
  };

  const handleToggleBanner = async (id: string) => { const next = banners.map((b) => (b.id === id ? { ...b, isVisible: !b.isVisible } : b)); setBanners(next); await persistHomepage(next, testimonials, announcements); };
  const handleDeleteBanner = async (id: string) => { if (!confirm("Delete this banner?")) return; const next = banners.filter((b) => b.id !== id); setBanners(next); await persistHomepage(next, testimonials, announcements); };

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.title.trim()) { alert("Announcement title is required"); return; }
    const next = [...announcements, { id: `ann_${Date.now()}`, title: newAnnouncement.title, content: newAnnouncement.content, link: newAnnouncement.link, isVisible: true }];
    setAnnouncements(next); await persistHomepage(banners, testimonials, next); setNewAnnouncement({ title: "", content: "", link: "" });
  };

  const handleUpdateAnnouncement = async (id: string, updates: Record<string, unknown>) => { const next = announcements.map((a) => (a.id === id ? { ...a, ...updates } : a)); setAnnouncements(next); await persistHomepage(banners, testimonials, next); };
  const handleDeleteAnnouncement = async (id: string) => { if (!confirm("Delete announcement?")) return; const next = announcements.filter((a) => a.id !== id); setAnnouncements(next); await persistHomepage(banners, testimonials, next); };

  const handleAddTestimonial = async () => {
    if (!newTestimonial.authorName.trim() || !newTestimonial.content.trim()) { alert("Name and testimonial content are required"); return; }
    const next = [...testimonials, { id: `test_${Date.now()}`, authorName: newTestimonial.authorName, authorRole: newTestimonial.authorRole, content: newTestimonial.content, rating: newTestimonial.rating, isVisible: true, avatarUrl: newTestimonial.avatarUrl }];
    setTestimonials(next as any); await persistHomepage(banners, next as any, announcements); setNewTestimonial({ authorName: "", authorRole: "", content: "", rating: 5, avatarUrl: "" });
  };

  const handleUpdateTestimonial = async (id: string, updates: Record<string, unknown>) => { const next = testimonials.map((t) => (t.id === id ? { ...t, ...updates } : t)); setTestimonials(next as any); await persistHomepage(banners, next as any, announcements); };
  const handleDeleteTestimonial = async (id: string) => { if (!confirm("Delete testimonial?")) return; const next = testimonials.filter((t) => t.id !== id); setTestimonials(next as any); await persistHomepage(banners, next as any, announcements); };

  const editingAnn = editingAnnId ? announcements.find((a) => a.id === editingAnnId) : null;
  const editingTest = editingTestId ? testimonials.find((t) => t.id === editingTestId) : null;

  return (
    <div className="space-y-5 font-['Inter']">
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Homepage Manager</h1>
            <p className="text-xs text-slate-400">Banners, announcements, testimonials &amp; site config</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm">
          {isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /><span>Saving...</span></> : <><span className="h-2 w-2 rounded-full bg-emerald-500" /><span>Auto-save On</span></>}
        </div>
      </div>

      {/* ─── Custom Tab bar ──────────────────────────────── */}
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${activeTab === t.id ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── BANNERS ─────────────────────────────────────── */}
      {activeTab === "banners" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-sm font-bold text-slate-800">Add New Banner</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FL>Banner Title *</FL><Input className={fCls} placeholder="e.g., CA Final Offer" value={newBanner.title} onChange={(e) => setNewBanner((p) => ({ ...p, title: e.target.value }))} /></div>
              <div className="space-y-1.5"><FL>Image URL</FL><Input className={fCls} placeholder="https://cdn.example.com/banner.jpg" value={newBanner.imageUrl} onChange={(e) => setNewBanner((p) => ({ ...p, imageUrl: e.target.value }))} /></div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-primary/40 transition-colors">
                <Upload className="h-3.5 w-3.5" />{isUploading ? "Uploading..." : "Upload Image File"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBannerFileInput(e.target.files?.[0])} />
              </label>
              <Button size="sm" className="ml-auto gap-1.5 rounded-xl px-5 text-xs font-semibold" onClick={handleAddBanner}>Add Banner</Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center border-b border-slate-100 bg-slate-50 px-5 py-3">
              <span className="text-xs font-bold text-slate-700">Active Banners</span>
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{banners.length}</span>
            </div>
            {banners.length === 0 ? <div className="py-12 text-center text-xs text-slate-400">No banners yet. Add one above.</div> : (
              <div className="divide-y divide-slate-100">
                {banners.map((banner) => (
                  <div key={banner.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/70 transition-colors">
                    <img src={banner.imageUrl} alt={banner.title} className="h-14 w-24 shrink-0 rounded-xl object-cover bg-slate-100" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-slate-900">{banner.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Sort #{banner.sortOrder}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${banner.isVisible ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{banner.isVisible ? "Visible" : "Hidden"}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => handleToggleBanner(banner.id)} className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${banner.isVisible ? "text-slate-400 hover:bg-amber-50 hover:text-amber-600" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}>
                        {banner.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button type="button" onClick={() => handleDeleteBanner(banner.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── CATEGORIES ──────────────────────────────────── */}
      {activeTab === "categories" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <p className="text-sm font-bold text-slate-800">Explore Section Categories</p>
            <p className="text-xs text-slate-400 mt-0.5">Tick categories to show them in the homepage Explore section</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
            {sortedCategories.map((cat) => {
              const checked = (siteDraft.exploreCategoryIds || []).includes(cat.id);
              return (
                <label key={cat.id} className="flex cursor-pointer items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition-colors">
                  <input type="checkbox" checked={checked} onChange={(e) => handleToggleExploreCategory(cat.id, e.target.checked)} className="h-4 w-4 rounded accent-primary" />
                  <span className="h-5 w-5 shrink-0 rounded-lg" style={{ backgroundColor: cat.color }} />
                  <span className="flex-1 text-sm font-semibold text-slate-800">{cat.name}</span>
                  <code className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-500">{cat.slug}</code>
                  {checked && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">On Homepage</span>}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── ANNOUNCEMENTS ───────────────────────────────── */}
      {activeTab === "announcements" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-sm font-bold text-slate-800">Add Announcement</p>
            <div className="space-y-3">
              <div className="space-y-1.5"><FL>Title *</FL><Input className={fCls} placeholder="e.g., New CA Finals batch starting" value={newAnnouncement.title} onChange={(e) => setNewAnnouncement((p) => ({ ...p, title: e.target.value }))} /></div>
              <div className="space-y-1.5"><FL>Content</FL><textarea rows={2} className={`${textAreaCls} h-16`} placeholder="Brief announcement text..." value={newAnnouncement.content} onChange={(e) => setNewAnnouncement((p) => ({ ...p, content: e.target.value }))} /></div>
              <div className="space-y-1.5"><FL>Link (optional)</FL><Input className={fCls} placeholder="https://..." value={newAnnouncement.link} onChange={(e) => setNewAnnouncement((p) => ({ ...p, link: e.target.value }))} /></div>
              <div className="flex justify-end"><Button size="sm" className="gap-1.5 rounded-xl px-5 text-xs font-semibold" onClick={handleAddAnnouncement}>Add Announcement</Button></div>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center border-b border-slate-100 bg-slate-50 px-5 py-3">
              <span className="text-xs font-bold text-slate-700">Announcements</span>
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{announcements.length}</span>
            </div>
            {announcements.length === 0 ? <div className="py-12 text-center text-xs text-slate-400">No announcements yet.</div> : (
              <div className="divide-y divide-slate-100">
                {announcements.map((ann) => (
                  <div key={ann.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{ann.title}</p>
                      {ann.content && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ann.content}</p>}
                      {ann.link && <p className="text-[11px] text-primary mt-0.5 truncate">{ann.link}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 mt-0.5">
                      <button type="button" onClick={() => setEditingAnnId(ann.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-primary/10 hover:text-primary transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => handleDeleteAnnouncement(ann.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TESTIMONIALS ────────────────────────────────── */}
      {activeTab === "testimonials" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-sm font-bold text-slate-800">Add Testimonial</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FL>Student Name *</FL><Input className={fCls} placeholder="Priya Sharma" value={newTestimonial.authorName} onChange={(e) => setNewTestimonial((p) => ({ ...p, authorName: e.target.value }))} /></div>
              <div className="space-y-1.5"><FL>Role / Exam</FL><Input className={fCls} placeholder="CA Final Student" value={newTestimonial.authorRole} onChange={(e) => setNewTestimonial((p) => ({ ...p, authorRole: e.target.value }))} /></div>
            </div>
            <div className="mt-3 space-y-1.5"><FL>Feedback *</FL><textarea rows={3} className={`${textAreaCls} h-20`} placeholder="What the student said..." value={newTestimonial.content} onChange={(e) => setNewTestimonial((p) => ({ ...p, content: e.target.value }))} /></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FL>Avatar URL</FL><Input className={fCls} placeholder="https://.../avatar.jpg" value={newTestimonial.avatarUrl} onChange={(e) => setNewTestimonial((p) => ({ ...p, avatarUrl: e.target.value }))} /></div>
              <div className="space-y-1.5"><FL>Rating</FL>
                <div className="flex gap-1 h-9 items-center">
                  {[1,2,3,4,5].map((star) => (
                    <button key={star} type="button" onClick={() => setNewTestimonial((p) => ({ ...p, rating: star }))}>
                      <Star className={`h-5 w-5 transition-colors ${star <= newTestimonial.rating ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-300"}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-primary/40 transition-colors">
                <Upload className="h-3.5 w-3.5" />{isUploading ? "Uploading..." : "Upload Avatar"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleTestimonialImage(e.target.files?.[0])} />
              </label>
              <Button size="sm" className="ml-auto gap-1.5 rounded-xl px-5 text-xs font-semibold" onClick={handleAddTestimonial}>Add Testimonial</Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center border-b border-slate-100 bg-slate-50 px-5 py-3">
              <span className="text-xs font-bold text-slate-700">Testimonials</span>
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{testimonials.length}</span>
            </div>
            {testimonials.length === 0 ? <div className="py-12 text-center text-xs text-slate-400">No testimonials yet.</div> : (
              <div className="divide-y divide-slate-100">
                {testimonials.map((test) => (
                  <div key={test.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition-colors">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-primary overflow-hidden flex items-center justify-center">
                      {test.avatarUrl ? <img src={test.avatarUrl} alt={test.authorName} className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-white">{test.authorName.charAt(0)}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-900">{test.authorName}</p>
                        <p className="text-xs text-slate-400">{test.authorRole}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${test.isVisible ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{test.isVisible ? "Visible" : "Hidden"}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{test.content}</p>
                      <div className="flex gap-0.5 mt-1">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3 w-3 ${i < test.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 mt-1">
                      <button type="button" onClick={() => setEditingTestId(test.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-primary/10 hover:text-primary transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => handleUpdateTestimonial(test.id, { isVisible: !test.isVisible })} className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${test.isVisible ? "text-slate-400 hover:bg-amber-50 hover:text-amber-600" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}>
                        {test.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button type="button" onClick={() => handleDeleteTestimonial(test.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── CUSTOM SECTIONS ─────────────────────────────── */}
      {activeTab === "sections" && <AdminHomepageSectionBuilder />}

      {/* ─── SITE CONFIG ─────────────────────────────────── */}
      {activeTab === "site" && (
        <div className="space-y-4">
          {/* Colors & Fonts */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <p className="text-sm font-bold text-slate-800">Theme &amp; Fonts</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5"><FL>Primary Color</FL><Input className={fCls} value={siteDraft.colors.primary} onChange={(e) => setSiteDraft((p) => ({ ...p, colors: { ...p.colors, primary: e.target.value } }))} /></div>
              <div className="space-y-1.5"><FL>Accent Color</FL><Input className={fCls} value={siteDraft.colors.accent} onChange={(e) => setSiteDraft((p) => ({ ...p, colors: { ...p.colors, accent: e.target.value } }))} /></div>
              <div className="space-y-1.5"><FL>Heading Font</FL><Input className={fCls} value={siteDraft.fonts.heading} onChange={(e) => setSiteDraft((p) => ({ ...p, fonts: { ...p.fonts, heading: e.target.value } }))} /></div>
              <div className="space-y-1.5"><FL>Body Font</FL><Input className={fCls} value={siteDraft.fonts.body} onChange={(e) => setSiteDraft((p) => ({ ...p, fonts: { ...p.fonts, body: e.target.value } }))} /></div>
              <div className="space-y-1.5"><FL>Global Font Size (px)</FL><Input type="number" min={12} max={24} className={fCls} value={siteDraft.fonts.baseSizePx} onChange={(e) => setSiteDraft((p) => ({ ...p, fonts: { ...p.fonts, baseSizePx: Number(e.target.value || 16) } }))} /></div>
              <div className="flex items-end"><Button type="button" variant="outline" size="sm" className="w-full rounded-xl text-xs" onClick={() => setSiteDraft((p) => ({ ...p, fonts: { ...p.fonts, baseSizePx: 16 } }))}>Reset Font Size</Button></div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
              <p className="text-xs font-bold text-slate-700">Brand Logo</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-1.5">
                  <FL>Logo URL</FL>
                  <Input
                    className={fCls}
                    placeholder="https://cdn.example.com/logo.svg"
                    value={siteDraft.logo}
                    onChange={(e) => setSiteDraft((p) => ({ ...p, logo: e.target.value }))}
                  />
                </div>
                <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:border-primary/40 transition-colors">
                  <Upload className="h-3.5 w-3.5" /> {isUploading ? "Uploading..." : "Upload Logo"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoFileInput(e.target.files?.[0])} />
                </label>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-28 rounded-lg border border-slate-200 bg-white flex items-center justify-center overflow-hidden">
                  {siteDraft.logo ? (
                    <img src={siteDraft.logo} alt="Logo preview" className="h-8 w-auto max-w-[100px] object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-400">No logo</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">Used in header branding across the website.</p>
              </div>
            </div>
          </div>

          {/* Section visibility */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <p className="text-sm font-bold text-slate-800">Homepage Section Visibility</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(siteDraft.sections).map(([key, value]) => (
                <label key={key} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <span className="text-xs font-semibold text-slate-700 capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                  <Switch checked={Boolean(value)} onCheckedChange={(checked) => setSiteDraft((p) => ({ ...p, sections: { ...p.sections, [key]: checked } }))} />
                </label>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
              <FL>Section Gap (px)</FL>
              <div className="grid gap-2 sm:grid-cols-[1fr_96px] sm:items-center">
                <input
                  type="range"
                  min={-64}
                  max={120}
                  step={2}
                  value={siteDraft.layout.sectionGapPx}
                  onChange={(e) => {
                    const nextGap = Math.min(120, Math.max(-64, Number(e.target.value || 0)));
                    setSiteDraft((p) => ({ ...p, layout: { ...p.layout, sectionGapPx: nextGap } }));
                  }}
                  className="w-full"
                />
                <Input
                  className={fCls}
                  type="number"
                  min={-64}
                  max={120}
                  value={siteDraft.layout.sectionGapPx}
                  onChange={(e) => {
                    const nextGap = Math.min(120, Math.max(-64, Number(e.target.value || 0)));
                    setSiteDraft((p) => ({ ...p, layout: { ...p.layout, sectionGapPx: nextGap } }));
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-500">Use negative values for tighter layout and positive values for more breathing space.</p>
            </div>
          </div>

          {/* Top Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">Header Top Bar</p>
                <p className="text-xs text-slate-400 mt-0.5">Slim info bar shown above the main navigation</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">{siteDraft.header.topBarVisible ? "Enabled" : "Disabled"}</span>
                <Switch checked={Boolean(siteDraft.header.topBarVisible)} onCheckedChange={(checked) => setSiteDraft((p) => ({ ...p, header: { ...p.header, topBarVisible: checked } }))} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FL>Phone</FL><Input className={fCls} disabled={!siteDraft.header.topBarVisible} placeholder="+91 98765 43210" value={siteDraft.header.topBarPhone} onChange={(e) => setSiteDraft((p) => ({ ...p, header: { ...p.header, topBarPhone: e.target.value } }))} /></div>
              <div className="space-y-1.5"><FL>Email</FL><Input className={fCls} disabled={!siteDraft.header.topBarVisible} placeholder="info@ednovate.in" value={siteDraft.header.topBarEmail} onChange={(e) => setSiteDraft((p) => ({ ...p, header: { ...p.header, topBarEmail: e.target.value } }))} /></div>
              <div className="space-y-1.5"><FL>Primary Text</FL><Input className={fCls} disabled={!siteDraft.header.topBarVisible} placeholder="Download App" value={siteDraft.header.topBarPrimaryText} onChange={(e) => setSiteDraft((p) => ({ ...p, header: { ...p.header, topBarPrimaryText: e.target.value } }))} /></div>
              <div className="space-y-1.5"><FL>Secondary Text</FL><Input className={fCls} disabled={!siteDraft.header.topBarVisible} placeholder="Demo Classes Available" value={siteDraft.header.topBarSecondaryText} onChange={(e) => setSiteDraft((p) => ({ ...p, header: { ...p.header, topBarSecondaryText: e.target.value } }))} /></div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div>
              <p className="text-sm font-bold text-slate-800">Announcement Bar</p>
              <p className="text-xs text-slate-400 mt-0.5">Control ticker colors, text size, and scrolling speed from admin.</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
              <FL>Scroll Speed (seconds)</FL>
              <div className="grid gap-2 sm:grid-cols-[1fr_96px] sm:items-center">
                <input
                  type="range"
                  min={6}
                  max={120}
                  step={1}
                  value={siteDraft.header.announcementSpeedSeconds}
                  onChange={(e) => {
                    const nextSpeed = Math.min(120, Math.max(6, Number(e.target.value || 28)));
                    setSiteDraft((p) => ({ ...p, header: { ...p.header, announcementSpeedSeconds: nextSpeed } }));
                  }}
                  className="w-full"
                />
                <Input
                  className={fCls}
                  type="number"
                  min={6}
                  max={120}
                  value={siteDraft.header.announcementSpeedSeconds}
                  onChange={(e) => {
                    const nextSpeed = Math.min(120, Math.max(6, Number(e.target.value || 28)));
                    setSiteDraft((p) => ({ ...p, header: { ...p.header, announcementSpeedSeconds: nextSpeed } }));
                  }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <FL>Live Badge Text</FL>
                <Input
                  className={fCls}
                  placeholder="LIVE"
                  value={siteDraft.header.announcementBar.liveLabel}
                  onChange={(e) => setSiteDraft((p) => ({ ...p, header: { ...p.header, announcementBar: { ...p.header.announcementBar, liveLabel: e.target.value } } }))}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ColorField label="Bar Background" value={siteDraft.header.announcementBar.backgroundColor} onChange={(value) => setSiteDraft((p) => ({ ...p, header: { ...p.header, announcementBar: { ...p.header.announcementBar, backgroundColor: value } } }))} />
              <ColorField label="Bar Border" value={siteDraft.header.announcementBar.borderColor} onChange={(value) => setSiteDraft((p) => ({ ...p, header: { ...p.header, announcementBar: { ...p.header.announcementBar, borderColor: value } } }))} />
              <ColorField label="Live Badge Background" value={siteDraft.header.announcementBar.badgeBackgroundColor} onChange={(value) => setSiteDraft((p) => ({ ...p, header: { ...p.header, announcementBar: { ...p.header.announcementBar, badgeBackgroundColor: value } } }))} />
              <ColorField label="Live Badge Text" value={siteDraft.header.announcementBar.badgeTextColor} onChange={(value) => setSiteDraft((p) => ({ ...p, header: { ...p.header, announcementBar: { ...p.header.announcementBar, badgeTextColor: value } } }))} />
              <ColorField label="Announcement Text" value={siteDraft.header.announcementBar.textColor} onChange={(value) => setSiteDraft((p) => ({ ...p, header: { ...p.header, announcementBar: { ...p.header.announcementBar, textColor: value } } }))} />
              <ColorField label="Title Text" value={siteDraft.header.announcementBar.titleColor} onChange={(value) => setSiteDraft((p) => ({ ...p, header: { ...p.header, announcementBar: { ...p.header.announcementBar, titleColor: value } } }))} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ColorField label="Bullet Color" value={siteDraft.header.announcementBar.bulletColor} onChange={(value) => setSiteDraft((p) => ({ ...p, header: { ...p.header, announcementBar: { ...p.header.announcementBar, bulletColor: value } } }))} />
              <div className="space-y-1.5">
                <FL>Desktop Text Size (px)</FL>
                <Input
                  className={fCls}
                  type="number"
                  min={10}
                  max={24}
                  value={siteDraft.header.announcementBar.fontSizePx}
                  onChange={(e) => {
                    const nextSize = Math.min(24, Math.max(10, Number(e.target.value || 14)));
                    setSiteDraft((p) => ({ ...p, header: { ...p.header, announcementBar: { ...p.header.announcementBar, fontSizePx: nextSize } } }));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <FL>Mobile Text Size (px)</FL>
                <Input
                  className={fCls}
                  type="number"
                  min={9}
                  max={20}
                  value={siteDraft.header.announcementBar.mobileFontSizePx}
                  onChange={(e) => {
                    const nextSize = Math.min(20, Math.max(9, Number(e.target.value || 12)));
                    setSiteDraft((p) => ({ ...p, header: { ...p.header, announcementBar: { ...p.header.announcementBar, mobileFontSizePx: nextSize } } }));
                  }}
                />
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-800">FAQ Content</p><Button type="button" size="sm" variant="outline" className="rounded-xl text-xs" onClick={addFaqItem}>+ Add Question</Button></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FL>Section Title</FL><Input className={fCls} placeholder="FAQ Section Title" value={siteDraft.homepageContent.faq.title} onChange={(e) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, faq: { ...p.homepageContent.faq, title: e.target.value } } }))} /></div>
              <div className="space-y-1.5"><FL>Section Subtitle</FL><Input className={fCls} placeholder="FAQ Section Subtitle" value={siteDraft.homepageContent.faq.subtitle} onChange={(e) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, faq: { ...p.homepageContent.faq, subtitle: e.target.value } } }))} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField label="Background Color" value={siteDraft.homepageContent.faq.backgroundColor} onChange={(value) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, faq: { ...p.homepageContent.faq, backgroundColor: value } } }))} />
              <ColorField label="Text Color" value={siteDraft.homepageContent.faq.textColor} onChange={(value) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, faq: { ...p.homepageContent.faq, textColor: value } } }))} />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {siteDraft.homepageContent.faq.items.map((item, index) => (
                <div key={`faq-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="space-y-1"><FL>Question</FL><Input className={fCls} placeholder="Question" value={item.question} onChange={(e) => updateFaqItem(index, "question", e.target.value)} /></div>
                  <div className="space-y-1"><FL>Answer</FL><Input className={fCls} placeholder="Answer" value={item.answer} onChange={(e) => updateFaqItem(index, "answer", e.target.value)} /></div>
                  <button type="button" onClick={() => removeFaqItem(index)} className="mt-6 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-800">Stats Counter</p><Button type="button" size="sm" variant="outline" className="rounded-xl text-xs" onClick={addStatItem}>+ Add Stat</Button></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField label="Background Color" value={siteDraft.homepageContent.stats.backgroundColor} onChange={(value) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, stats: { ...p.homepageContent.stats, backgroundColor: value } } }))} />
              <ColorField label="Text Color" value={siteDraft.homepageContent.stats.textColor} onChange={(value) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, stats: { ...p.homepageContent.stats, textColor: value } } }))} />
            </div>
            <ColorField label="Icon Color" value={siteDraft.homepageContent.stats.iconColor} onChange={(value) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, stats: { ...p.homepageContent.stats, iconColor: value } } }))} />
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {siteDraft.homepageContent.stats.items.map((item, index) => (
                <div key={`stat-${index}`} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="space-y-1"><FL>Label</FL><Input className={fCls} placeholder="Label" value={item.label} onChange={(e) => updateStatItem(index, "label", e.target.value)} /></div>
                  <div className="space-y-1"><FL>Value</FL><Input className={fCls} type="number" placeholder="Value" value={item.value} onChange={(e) => updateStatItem(index, "value", e.target.value)} /></div>
                  <div className="space-y-1"><FL>Suffix</FL><Input className={fCls} placeholder="+" value={item.suffix} onChange={(e) => updateStatItem(index, "suffix", e.target.value)} /></div>
                  <button type="button" onClick={() => removeStatItem(index)} className="mt-6 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-800">How It Works</p><Button type="button" size="sm" variant="outline" className="rounded-xl text-xs" onClick={addHowStep}>+ Add Step</Button></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FL>Section Title</FL><Input className={fCls} placeholder="How It Works" value={siteDraft.homepageContent.howItWorks.title} onChange={(e) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, howItWorks: { ...p.homepageContent.howItWorks, title: e.target.value } } }))} /></div>
              <div className="space-y-1.5"><FL>Section Subtitle</FL><Input className={fCls} placeholder="4 simple steps..." value={siteDraft.homepageContent.howItWorks.subtitle} onChange={(e) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, howItWorks: { ...p.homepageContent.howItWorks, subtitle: e.target.value } } }))} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField label="Background Color" value={siteDraft.homepageContent.howItWorks.backgroundColor} onChange={(value) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, howItWorks: { ...p.homepageContent.howItWorks, backgroundColor: value } } }))} />
              <ColorField label="Text Color" value={siteDraft.homepageContent.howItWorks.textColor} onChange={(value) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, howItWorks: { ...p.homepageContent.howItWorks, textColor: value } } }))} />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {siteDraft.homepageContent.howItWorks.steps.map((step, index) => (
                <div key={`step-${index}`} className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="space-y-1"><FL>Title</FL><Input className={fCls} placeholder="Title" value={step.title} onChange={(e) => updateHowStep(index, "title", e.target.value)} /></div>
                  <div className="space-y-1"><FL>Description</FL><Input className={fCls} placeholder="Description" value={step.desc} onChange={(e) => updateHowStep(index, "desc", e.target.value)} /></div>
                  <div className="space-y-1"><FL>Icon</FL><Input className={fCls} placeholder="Search" value={step.icon || ""} onChange={(e) => updateHowStep(index, "icon", e.target.value)} /></div>
                  <button type="button" onClick={() => removeHowStep(index)} className="mt-6 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Why Ednovate */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-800">Why Ednovate</p><Button type="button" size="sm" variant="outline" className="rounded-xl text-xs" onClick={addWhyItem}>+ Add Card</Button></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FL>Section Title</FL><Input className={fCls} placeholder="Why Ednovate Title" value={siteDraft.homepageContent.whyChooseUs.title} onChange={(e) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, whyChooseUs: { ...p.homepageContent.whyChooseUs, title: e.target.value } } }))} /></div>
              <div className="space-y-1.5"><FL>Section Subtitle</FL><Input className={fCls} placeholder="Why Ednovate Subtitle" value={siteDraft.homepageContent.whyChooseUs.subtitle} onChange={(e) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, whyChooseUs: { ...p.homepageContent.whyChooseUs, subtitle: e.target.value } } }))} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField label="Background Color" value={siteDraft.homepageContent.whyChooseUs.backgroundColor} onChange={(value) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, whyChooseUs: { ...p.homepageContent.whyChooseUs, backgroundColor: value } } }))} />
              <ColorField label="Text Color" value={siteDraft.homepageContent.whyChooseUs.textColor} onChange={(value) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, whyChooseUs: { ...p.homepageContent.whyChooseUs, textColor: value } } }))} />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {siteDraft.homepageContent.whyChooseUs.items.map((item, index) => (
                <div key={`why-${index}`} className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="space-y-1"><FL>Title</FL><Input className={fCls} placeholder="Card Title" value={item.title} onChange={(e) => updateWhyItem(index, "title", e.target.value)} /></div>
                  <div className="space-y-1"><FL>Description</FL><Input className={fCls} placeholder="Description" value={item.description} onChange={(e) => updateWhyItem(index, "description", e.target.value)} /></div>
                  <div className="space-y-1"><FL>Icon</FL><Input className={fCls} placeholder="BookOpen" value={item.icon || ""} onChange={(e) => updateWhyItem(index, "icon", e.target.value)} /></div>
                  <button type="button" onClick={() => removeWhyItem(index)} className="mt-6 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Faculty Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <p className="text-sm font-bold text-slate-800">Faculty Section</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FL>Section Title</FL><Input className={fCls} placeholder="Meet Our Expert Instructors" value={siteDraft.homepageContent.faculty.title} onChange={(e) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, faculty: { ...p.homepageContent.faculty, title: e.target.value } } }))} /></div>
              <div className="space-y-1.5"><FL>Section Subtitle</FL><Input className={fCls} placeholder="Learn from industry professionals..." value={siteDraft.homepageContent.faculty.subtitle} onChange={(e) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, faculty: { ...p.homepageContent.faculty, subtitle: e.target.value } } }))} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField label="Background Color" value={siteDraft.homepageContent.faculty.backgroundColor} onChange={(value) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, faculty: { ...p.homepageContent.faculty, backgroundColor: value } } }))} />
              <ColorField label="Text Color" value={siteDraft.homepageContent.faculty.textColor} onChange={(value) => setSiteDraft((p) => ({ ...p, homepageContent: { ...p.homepageContent, faculty: { ...p.homepageContent.faculty, textColor: value } } }))} />
            </div>
            <p className="text-[11px] text-slate-500">Faculty members are managed in the <strong>Faculty</strong> admin module. Only active faculty with photos will display here.</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => { if (!confirm("Reset all site settings to default values?")) return; resetSettings(); }}>Reset All Settings</Button>
            <Button size="sm" className="gap-1.5 rounded-xl px-5 text-xs font-semibold" onClick={() => persistSiteSettings(siteDraft)} disabled={isSaving}>
              {isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving...</> : "Save Site Config"}
            </Button>
          </div>
        </div>
      )}

      {/* ─── Edit Announcement Dialog ────────────────────── */}
      <Dialog open={!!editingAnnId} onOpenChange={(open) => !open && setEditingAnnId(null)}>
        {editingAnn && (
          <DialogContent className="max-w-md rounded-2xl border-slate-100 p-0 shadow-2xl">
            <DialogHeader className="border-b border-slate-100 px-6 py-4"><DialogTitle className="text-base font-bold">Edit Announcement</DialogTitle></DialogHeader>
            <div className="space-y-4 px-6 py-5">
              <div className="space-y-1.5"><FL>Title</FL><Input className={fCls} value={editingAnn.title} onChange={(e) => handleUpdateAnnouncement(editingAnn.id, { title: e.target.value })} /></div>
              <div className="space-y-1.5"><FL>Content</FL><textarea rows={2} className={`${textAreaCls} h-16`} value={editingAnn.content} onChange={(e) => handleUpdateAnnouncement(editingAnn.id, { content: e.target.value })} /></div>
              <div className="space-y-1.5"><FL>Link</FL><Input className={fCls} value={editingAnn.link} onChange={(e) => handleUpdateAnnouncement(editingAnn.id, { link: e.target.value })} /></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5">
                <span className="text-xs font-semibold text-slate-700">Visible on homepage</span>
                <Switch checked={editingAnn.isVisible} onCheckedChange={(checked) => handleUpdateAnnouncement(editingAnn.id, { isVisible: checked })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setEditingAnnId(null)}>Close</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* ─── Edit Testimonial Dialog ─────────────────────── */}
      <Dialog open={!!editingTestId} onOpenChange={(open) => !open && setEditingTestId(null)}>
        {editingTest && (
          <DialogContent className="max-w-md rounded-2xl border-slate-100 p-0 shadow-2xl">
            <DialogHeader className="border-b border-slate-100 px-6 py-4"><DialogTitle className="text-base font-bold">Edit Testimonial</DialogTitle></DialogHeader>
            <div className="space-y-3 px-6 py-5">
              <div className="space-y-1.5"><FL>Name</FL><Input className={fCls} value={editingTest.authorName} onChange={(e) => handleUpdateTestimonial(editingTest.id, { authorName: e.target.value })} /></div>
              <div className="space-y-1.5"><FL>Role</FL><Input className={fCls} value={editingTest.authorRole} onChange={(e) => handleUpdateTestimonial(editingTest.id, { authorRole: e.target.value })} /></div>
              <div className="space-y-1.5"><FL>Content</FL><textarea rows={3} className={`${textAreaCls} h-20`} value={editingTest.content} onChange={(e) => handleUpdateTestimonial(editingTest.id, { content: e.target.value })} /></div>
              <div className="space-y-1.5"><FL>Rating</FL>
                <div className="flex gap-1">{[1,2,3,4,5].map((star) => (<button key={star} type="button" onClick={() => handleUpdateTestimonial(editingTest.id, { rating: star })}><Star className={`h-5 w-5 ${star <= (editingTest.rating || 0) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} /></button>))}</div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5">
                <span className="text-xs font-semibold text-slate-700">Visible on homepage</span>
                <Switch checked={editingTest.isVisible} onCheckedChange={(checked) => handleUpdateTestimonial(editingTest.id, { isVisible: checked })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setEditingTestId(null)}>Close</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
