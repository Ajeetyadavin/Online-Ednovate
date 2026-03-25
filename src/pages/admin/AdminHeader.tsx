import { useEffect, useMemo, useState } from "react";
import {
  Plus, Trash2, Save, Loader2, Search,
  ChevronDown, ChevronUp, ArrowUp, ArrowDown, Edit2,
  PenLine, Navigation, MousePointerClick, LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useSiteSettings,
  type HeaderButtonStyle,
  type HeaderCourseCollection,
  type HeaderNavLink,
  type HeaderQuickButton,
} from "@/context/SiteSettingsContext";
import { usePlatformData } from "@/context/PlatformDataContext";
import { adminApi } from "@/services/adminApi";

/* ─── Helpers ─────────────────────────────────────────────── */
const buttonStyles: HeaderButtonStyle[] = ["solid", "outline", "ghost"];

const slugify = (value: string) =>
  String(value || "").toLowerCase().trim().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "") || `collection-${Date.now()}`;

const extractCollectionSlug = (href: string): string | null => {
  const match = String(href || "").match(/^\/collections\/([a-z0-9-]+)$/i);
  return match?.[1] ? slugify(match[1]) : null;
};

const createCollection = (label: string, sortOrder: number, navigationOrder: number): HeaderCourseCollection => {
  const slug = slugify(label);
  return {
    id: `collection-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    slug, title: label, description: "", badge: "", heroImageUrl: "",
    ctaLabel: "Explore Courses", visible: true, sortOrder, courseIds: [],
    enableSearch: true, searchPlaceholder: "Search courses...",
    enableCategoryFilter: true, categoryFilterLabel: "Filter by Category",
    categoryIds: [], emptyStateText: "No courses found for selected filters.",
    showInNavigation: true, navigationLabel: label, navigationOrder,
    enableCourseSelector: true, enableCourseSchedule: false,
    courseVisibleFrom: "", courseVisibleUntil: "",
  };
};

/* ─── Field label helper ──────────────────────────────────── */
const FL = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{children}</p>
);
const fCls = "h-9 rounded-xl border-slate-200 text-xs placeholder:text-slate-400 focus-visible:ring-primary/40";

type Tab = "branding" | "navigation" | "buttons" | "collections";
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "branding", label: "Branding", icon: PenLine },
  { id: "navigation", label: "Navigation", icon: Navigation },
  { id: "buttons", label: "Buttons", icon: MousePointerClick },
  { id: "collections", label: "Collections", icon: LayoutGrid },
];

/* ─── Main Component ──────────────────────────────────────── */
export default function AdminHeader() {
  const { settings, updateSettings } = useSiteSettings();
  const { courses, categories } = usePlatformData();

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("branding");
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);
  const [collectionQuery, setCollectionQuery] = useState<Record<string, string>>({});
  const [selectedCollectionNavId, setSelectedCollectionNavId] = useState("");
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ logo: settings.logo, header: settings.header });

  useEffect(() => {
    setDraft({ logo: settings.logo, header: settings.header });
  }, [settings.logo, settings.header]);

  const sortedCourses = useMemo(() => [...courses].sort((a, b) => String(a.title).localeCompare(String(b.title))), [courses]);
  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.sortOrder - b.sortOrder || String(a.name).localeCompare(String(b.name))), [categories]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const availableCollectionsForNav = useMemo(() => {
    const used = new Set(draft.header.navLinks.map((link) => extractCollectionSlug(link.href)).filter((slug): slug is string => Boolean(slug)));
    return draft.header.courseCollections.filter((collection) => !used.has(collection.slug));
  }, [draft.header.courseCollections, draft.header.navLinks]);

  const syncHeader = (nextHeader: typeof draft.header) => setDraft((prev) => ({ ...prev, header: nextHeader }));
  const syncLogo = (logo: string) => setDraft((prev) => ({ ...prev, logo }));

  const moveNavLink = (id: string, direction: "up" | "down") => {
    const links = [...draft.header.navLinks];
    const index = links.findIndex((item) => item.id === id);
    if (index < 0) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= links.length) return;
    [links[index], links[target]] = [links[target], links[index]];
    syncHeader({ ...draft.header, navLinks: links });
  };

  const moveButton = (id: string, direction: "up" | "down") => {
    const buttons = [...draft.header.customButtons];
    const index = buttons.findIndex((item) => item.id === id);
    if (index < 0) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= buttons.length) return;
    [buttons[index], buttons[target]] = [buttons[target], buttons[index]];
    syncHeader({ ...draft.header, customButtons: buttons });
  };

  const moveCollectionInNavigation = (collectionId: string, direction: "up" | "down") => {
    const inNav = draft.header.courseCollections.filter((item) => item.showInNavigation).sort((a, b) => a.navigationOrder - b.navigationOrder || a.sortOrder - b.sortOrder);
    const index = inNav.findIndex((item) => item.id === collectionId);
    if (index < 0) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= inNav.length) return;
    const reordered = [...inNav];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const orderMap = new Map(reordered.map((item, idx) => [item.id, idx + 1]));
    syncHeader({ ...draft.header, courseCollections: draft.header.courseCollections.map((item) => item.showInNavigation ? { ...item, navigationOrder: orderMap.get(item.id) ?? item.navigationOrder } : item) });
  };

  const addCollection = () => {
    const title = `Collection ${draft.header.courseCollections.length + 1}`;
    const maxNav = draft.header.courseCollections.reduce((max, item) => Math.max(max, Number(item.navigationOrder || 0)), 0);
    const created = createCollection(title, draft.header.courseCollections.length + 1, maxNav + 1);
    syncHeader({ ...draft.header, courseCollections: [...draft.header.courseCollections, created] });
    setEditingCollectionId(created.id);
  };

  const deleteCollection = (collectionId: string) => {
    if (!confirm("Delete this collection page?")) return;
    const target = draft.header.courseCollections.find((item) => item.id === collectionId);
    if (!target) return;
    const clearLinkedHref = (href: string) => { const linkedSlug = extractCollectionSlug(href); return linkedSlug === target.slug ? "/packages" : href; };
    syncHeader({ ...draft.header, navLinks: draft.header.navLinks.map((link) => ({ ...link, href: clearLinkedHref(link.href) })), customButtons: draft.header.customButtons.map((button) => ({ ...button, href: clearLinkedHref(button.href) })), courseCollections: draft.header.courseCollections.filter((item) => item.id !== collectionId) });
    setExpandedCollectionId((prev) => (prev === collectionId ? null : prev));
  };

  const ensureAutoCollectionVisibility = (headerDraft: typeof draft.header) => {
    const slugsToEnsure: Array<{ slug: string; label: string }> = [];
    headerDraft.navLinks.forEach((link) => { const slug = extractCollectionSlug(link.href); if (slug) slugsToEnsure.push({ slug, label: link.label || slug }); });
    headerDraft.customButtons.forEach((button) => { const slug = extractCollectionSlug(button.href); if (slug) slugsToEnsure.push({ slug, label: button.label || slug }); });
    if (slugsToEnsure.length === 0) return headerDraft;
    const maxNav = headerDraft.courseCollections.reduce((max, item) => Math.max(max, Number(item.navigationOrder || 0)), 0);
    let nextNav = maxNav;
    const nextCollections = [...headerDraft.courseCollections];
    slugsToEnsure.forEach(({ slug, label }) => { const exists = nextCollections.some((item) => item.slug === slug); if (!exists) { nextNav += 1; nextCollections.push(createCollection(label, nextCollections.length + 1, nextNav)); } });
    return { ...headerDraft, courseCollections: nextCollections };
  };

  const syncCollectionsFromNavigation = (headerDraft: typeof draft.header) => {
    const navCollectionLinks = headerDraft.navLinks.map((link, index) => ({ link, index, slug: extractCollectionSlug(link.href) })).filter((entry) => Boolean(entry.slug));
    if (navCollectionLinks.length === 0) return headerDraft;
    const orderMap = new Map<string, number>();
    navCollectionLinks.forEach((entry, index) => { if (entry.slug) orderMap.set(entry.slug, index + 1); });
    let nextCollections = [...headerDraft.courseCollections];
    let maxSortOrder = nextCollections.reduce((max, item) => Math.max(max, Number(item.sortOrder || 0)), 0);
    let maxNavOrder = nextCollections.reduce((max, item) => Math.max(max, Number(item.navigationOrder || 0)), 0);
    navCollectionLinks.forEach(({ link, slug }) => { if (!slug) return; const exists = nextCollections.some((item) => item.slug === slug); if (exists) return; maxSortOrder += 1; maxNavOrder += 1; nextCollections.push(createCollection(link.label || slug, maxSortOrder, maxNavOrder)); });
    nextCollections = nextCollections.map((collection) => { const linkedNav = navCollectionLinks.find((entry) => entry.slug === collection.slug)?.link; if (!linkedNav) return collection; return { ...collection, showInNavigation: linkedNav.visible, navigationLabel: linkedNav.label || collection.navigationLabel || collection.title, navigationOrder: orderMap.get(collection.slug) ?? collection.navigationOrder }; });
    return { ...headerDraft, courseCollections: nextCollections };
  };

  const saveAll = async () => {
    setIsSaving(true);
    try {
      const preparedHeader = ensureAutoCollectionVisibility(syncCollectionsFromNavigation(draft.header));
      const nextSiteSettings = { ...settings, logo: draft.logo, header: preparedHeader };
      updateSettings(nextSiteSettings);
      await adminApi.saveHomepagePlatformSettings({ bunnyStreamApi: { enabled: Boolean(settings.bunnyStreamApi?.enabled), libraryId: String(settings.bunnyStreamApi?.libraryId || ""), apiKey: String(settings.bunnyStreamApi?.apiKey || ""), cdnHostname: String(settings.bunnyStreamApi?.cdnHostname || ""), pullZone: String(settings.bunnyStreamApi?.pullZone || "") }, siteSettings: nextSiteSettings as unknown as Record<string, unknown>, homepage: { exploreCategoryIds: settings.exploreCategoryIds || [] } });
      setDraft({ logo: nextSiteSettings.logo, header: nextSiteSettings.header });
      alert("Header module saved successfully.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save header module");
    } finally { setIsSaving(false); }
  };

  const collectionNavItems = draft.header.courseCollections.slice().sort((a, b) => a.navigationOrder - b.navigationOrder || a.sortOrder - b.sortOrder);
  const visibleCollectionNavIds = collectionNavItems.filter((item) => item.showInNavigation).map((item) => item.id);
  const visibleCollectionIndexMap = new Map(visibleCollectionNavIds.map((id, idx) => [id, idx]));

  /* ── JSX ── */
  return (
    <div className="space-y-5 font-['Inter']">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <PenLine className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Header Module</h1>
            <p className="text-xs text-slate-400">Logo, top bar, nav links, buttons &amp; collection pages</p>
          </div>
        </div>
        <Button size="sm" className="ml-auto gap-2 rounded-xl px-5 text-xs font-semibold shadow-sm" onClick={saveAll} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {isSaving ? "Saving..." : "Save Header Module"}
        </Button>
      </div>

      {/* Tab bar */}
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

      {/* ── BRANDING ─────────────────────────────────────── */}
      {activeTab === "branding" && (
        <div className="space-y-4">
          {/* Logo & Brand */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <p className="text-sm font-bold text-slate-800">Logo &amp; Brand</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FL>Logo URL</FL><Input className={fCls} placeholder="/ednovate-logo.svg" value={draft.logo} onChange={(e) => syncLogo(e.target.value)} /></div>
              <div className="flex items-end pb-0.5">
                <div className="flex items-center justify-between w-full rounded-xl border border-slate-200 px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-700">Show brand text beside logo</span>
                  <Switch checked={draft.header.showBrandText} onCheckedChange={(checked) => syncHeader({ ...draft.header, showBrandText: checked })} />
                </div>
              </div>
              <div className="space-y-1.5"><FL>Brand Title</FL><Input className={fCls} placeholder="Ednovate" value={draft.header.brandTitle} onChange={(e) => syncHeader({ ...draft.header, brandTitle: e.target.value })} /></div>
              <div className="space-y-1.5"><FL>Brand Subtitle</FL><Input className={fCls} placeholder="Exam Ready Learning" value={draft.header.brandSubtitle} onChange={(e) => syncHeader({ ...draft.header, brandSubtitle: e.target.value })} /></div>
            </div>
          </div>
          {/* Top Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">Top Info Bar</p>
                <p className="text-xs text-slate-400 mt-0.5">Slim contact strip above the navbar</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">{draft.header.topBarVisible ? "Enabled" : "Disabled"}</span>
                <Switch checked={draft.header.topBarVisible} onCheckedChange={(checked) => syncHeader({ ...draft.header, topBarVisible: checked })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FL>Phone</FL><Input className={fCls} disabled={!draft.header.topBarVisible} placeholder="+91 98765 43210" value={draft.header.topBarPhone} onChange={(e) => syncHeader({ ...draft.header, topBarPhone: e.target.value })} /></div>
              <div className="space-y-1.5"><FL>Email</FL><Input className={fCls} disabled={!draft.header.topBarVisible} placeholder="info@ednovate.in" value={draft.header.topBarEmail} onChange={(e) => syncHeader({ ...draft.header, topBarEmail: e.target.value })} /></div>
              <div className="space-y-1.5"><FL>Primary Text</FL><Input className={fCls} disabled={!draft.header.topBarVisible} placeholder="Download App" value={draft.header.topBarPrimaryText} onChange={(e) => syncHeader({ ...draft.header, topBarPrimaryText: e.target.value })} /></div>
              <div className="space-y-1.5"><FL>Secondary Text</FL><Input className={fCls} disabled={!draft.header.topBarVisible} placeholder="Demo Classes Available" value={draft.header.topBarSecondaryText} onChange={(e) => syncHeader({ ...draft.header, topBarSecondaryText: e.target.value })} /></div>
            </div>
          </div>
        </div>
      )}

      {/* ── NAVIGATION ───────────────────────────────────── */}
      {activeTab === "navigation" && (
        <div className="space-y-4">
          {/* Nav links */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center border-b border-slate-100 bg-slate-50 px-5 py-3">
              <p className="text-xs font-bold text-slate-700">Navigation Links</p>
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{draft.header.navLinks.length}</span>
            </div>
            <div className="divide-y divide-slate-100 p-3 space-y-0">
              {draft.header.navLinks.map((link, index) => (
                <div key={link.id} className="flex flex-wrap items-center gap-2 py-2.5 px-1">
                  <Input className={`${fCls} w-28 shrink-0`} placeholder="Label" value={link.label} onChange={(e) => syncHeader({ ...draft.header, navLinks: draft.header.navLinks.map((item) => item.id === link.id ? { ...item, label: e.target.value } : item) })} />
                  <Input className={`${fCls} flex-1 min-w-[120px]`} placeholder="/path" value={link.href} onChange={(e) => syncHeader({ ...draft.header, navLinks: draft.header.navLinks.map((item) => item.id === link.id ? { ...item, href: e.target.value } : item) })} />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                      <Switch checked={link.visible} onCheckedChange={(checked) => syncHeader({ ...draft.header, navLinks: draft.header.navLinks.map((item) => item.id === link.id ? { ...item, visible: checked } : item) })} />Visible
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                      <Switch checked={link.hasDropdown} onCheckedChange={(checked) => syncHeader({ ...draft.header, navLinks: draft.header.navLinks.map((item) => item.id === link.id ? { ...item, hasDropdown: checked } : item) })} />Dropdown
                    </label>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={index === 0} onClick={() => moveNavLink(link.id, "up")} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-slate-50 transition-colors"><ArrowUp className="h-3 w-3" /></button>
                    <button type="button" disabled={index === draft.header.navLinks.length - 1} onClick={() => moveNavLink(link.id, "down")} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-slate-50 transition-colors"><ArrowDown className="h-3 w-3" /></button>
                    <button type="button" onClick={() => syncHeader({ ...draft.header, navLinks: draft.header.navLinks.filter((item) => item.id !== link.id) })} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1.5" onClick={() => syncHeader({ ...draft.header, navLinks: [...draft.header.navLinks, { id: `nav-${Date.now()}`, label: "New Link", href: "/packages", hasDropdown: false, visible: true } as HeaderNavLink] })}>
                <Plus className="h-3.5 w-3.5" />Add Standard Link
              </Button>
              <div className="flex flex-1 min-w-[220px] items-center gap-2">
                <select className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700" value={selectedCollectionNavId} onChange={(e) => setSelectedCollectionNavId(e.target.value)}>
                  <option value="">Link a collection page...</option>
                  {availableCollectionsForNav.map((collection) => (
                    <option key={collection.id} value={collection.id}>{collection.navigationLabel || collection.title} (/collections/{collection.slug})</option>
                  ))}
                </select>
                <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1.5 shrink-0" disabled={!selectedCollectionNavId} onClick={() => {
                  const collection = draft.header.courseCollections.find((item) => item.id === selectedCollectionNavId);
                  if (!collection) return;
                  syncHeader({ ...draft.header, navLinks: [...draft.header.navLinks, { id: `nav-collection-${Date.now()}`, label: collection.navigationLabel || collection.title, href: `/collections/${collection.slug}`, hasDropdown: false, visible: true } as HeaderNavLink] });
                  setSelectedCollectionNavId("");
                }}><Plus className="h-3.5 w-3.5" />Add</Button>
              </div>
            </div>
          </div>

          {/* Collection nav sequence */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
              <p className="text-xs font-bold text-slate-700">Collection Navigation Sequence</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Control visibility, label, and order of collection pages in nav</p>
            </div>
            {collectionNavItems.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">No collection pages yet. Add one in the Collections tab.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {collectionNavItems.map((item) => {
                  const visibleIndex = visibleCollectionIndexMap.get(item.id) ?? -1;
                  const canMoveUp = item.showInNavigation && visibleIndex > 0;
                  const canMoveDown = item.showInNavigation && visibleIndex >= 0 && visibleIndex < visibleCollectionNavIds.length - 1;
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/70 transition-colors">
                      <div className="flex-1 min-w-0">
                        <Input className="h-8 rounded-xl border-slate-200 text-xs" value={item.navigationLabel || item.title} onChange={(e) => syncHeader({ ...draft.header, courseCollections: draft.header.courseCollections.map((collection) => collection.id === item.id ? { ...collection, navigationLabel: e.target.value } : collection) })} placeholder="Navigation label" />
                        <p className="text-[11px] text-slate-400 mt-1">/collections/{item.slug}</p>
                      </div>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 shrink-0">
                        <Switch checked={item.showInNavigation} onCheckedChange={(checked) => {
                          const maxOrder = draft.header.courseCollections.reduce((max, collection) => collection.showInNavigation ? Math.max(max, Number(collection.navigationOrder || 0)) : max, 0);
                          syncHeader({ ...draft.header, courseCollections: draft.header.courseCollections.map((collection) => collection.id === item.id ? { ...collection, showInNavigation: checked, navigationOrder: checked ? (Number(collection.navigationOrder || 0) > 0 ? collection.navigationOrder : maxOrder + 1) : collection.navigationOrder } : collection) });
                        }} />Show
                      </label>
                      <div className="flex gap-1 shrink-0">
                        <button type="button" disabled={!canMoveUp} onClick={() => moveCollectionInNavigation(item.id, "up")} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-slate-50"><ChevronUp className="h-3.5 w-3.5" /></button>
                        <button type="button" disabled={!canMoveDown} onClick={() => moveCollectionInNavigation(item.id, "down")} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-slate-50"><ChevronDown className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BUTTONS ──────────────────────────────────────── */}
      {activeTab === "buttons" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center border-b border-slate-100 bg-slate-50 px-5 py-3">
            <p className="text-xs font-bold text-slate-700">Header Action Buttons</p>
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{draft.header.customButtons.length}</span>
          </div>
          <div className="divide-y divide-slate-100 p-3">
            {draft.header.customButtons.map((button, index) => (
              <div key={button.id} className="flex flex-wrap items-center gap-2 py-2.5 px-1">
                <Input className={`${fCls} w-28 shrink-0`} placeholder="Label" value={button.label} onChange={(e) => syncHeader({ ...draft.header, customButtons: draft.header.customButtons.map((item) => item.id === button.id ? { ...item, label: e.target.value } : item) })} />
                <Input className={`${fCls} flex-1 min-w-[100px]`} placeholder="/path" value={button.href} onChange={(e) => syncHeader({ ...draft.header, customButtons: draft.header.customButtons.map((item) => item.id === button.id ? { ...item, href: e.target.value } : item) })} />
                <select className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 shrink-0" value={button.style} onChange={(e) => syncHeader({ ...draft.header, customButtons: draft.header.customButtons.map((item) => item.id === button.id ? { ...item, style: e.target.value as HeaderButtonStyle } : item) })}>
                  {buttonStyles.map((style) => <option key={style} value={style}>{style}</option>)}
                </select>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                    <Switch checked={button.visible} onCheckedChange={(checked) => syncHeader({ ...draft.header, customButtons: draft.header.customButtons.map((item) => item.id === button.id ? { ...item, visible: checked } : item) })} />Visible
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                    <Switch checked={button.newTab} onCheckedChange={(checked) => syncHeader({ ...draft.header, customButtons: draft.header.customButtons.map((item) => item.id === button.id ? { ...item, newTab: checked } : item) })} />New Tab
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={index === 0} onClick={() => moveButton(button.id, "up")} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-slate-50"><ArrowUp className="h-3 w-3" /></button>
                  <button type="button" disabled={index === draft.header.customButtons.length - 1} onClick={() => moveButton(button.id, "down")} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-slate-50"><ArrowDown className="h-3 w-3" /></button>
                  <button type="button" onClick={() => syncHeader({ ...draft.header, customButtons: draft.header.customButtons.filter((item) => item.id !== button.id) })} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
            <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1.5" onClick={() => syncHeader({ ...draft.header, customButtons: [...draft.header.customButtons, { id: `btn-${Date.now()}`, label: "New Button", href: "/packages", style: "solid", visible: true, newTab: false } as HeaderQuickButton] })}>
              <Plus className="h-3.5 w-3.5" />Add Button
            </Button>
          </div>
        </div>
      )}

      {/* ── COLLECTIONS ──────────────────────────────────── */}
      {activeTab === "collections" && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center border-b border-slate-100 bg-slate-50 px-5 py-3">
              <p className="text-xs font-bold text-slate-700">Collection Pages</p>
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{draft.header.courseCollections.length}</span>
              <Button size="sm" variant="outline" className="ml-auto rounded-xl text-xs gap-1.5" onClick={addCollection}><Plus className="h-3.5 w-3.5" />Add Collection</Button>
            </div>
            {draft.header.courseCollections.length === 0 ? (
              <p className="py-12 text-center text-xs text-slate-400">No collection pages yet. Add one above.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {draft.header.courseCollections.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((collection) => {
                  const selectedCourses = sortedCourses.filter((course) => collection.courseIds.includes(course.id)).slice(0, 3);
                  return (
                    <div key={collection.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{collection.title || "Untitled Collection"}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">/collections/{collection.slug} · {collection.courseIds.length} course{collection.courseIds.length !== 1 ? "s" : ""}</p>
                        {selectedCourses.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {selectedCourses.map((course) => (
                              <span key={course.id} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{course.title}</span>
                            ))}
                            {collection.courseIds.length > 3 && <span className="text-[10px] text-slate-400">+{collection.courseIds.length - 3} more</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => setEditingCollectionId(collection.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-primary/10 hover:text-primary transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => deleteCollection(collection.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {editingCollectionId && (
            <CollectionEditorModal
              collection={draft.header.courseCollections.find((c) => c.id === editingCollectionId)!}
              onClose={() => setEditingCollectionId(null)}
              onUpdate={(updatedCollection) => { syncHeader({ ...draft.header, courseCollections: draft.header.courseCollections.map((item) => item.id === updatedCollection.id ? updatedCollection : item) }); setEditingCollectionId(null); }}
              allCourses={sortedCourses}
              allCategories={sortedCategories}
              categoryMap={categoryMap}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Collection Editor Modal ─────────────────────────────── */
interface CollectionEditorModalProps {
  collection: HeaderCourseCollection;
  onClose: () => void;
  onUpdate: (collection: HeaderCourseCollection) => void;
  allCourses: any[];
  allCategories: any[];
  categoryMap: Map<string, string>;
}

const fClsModal = "h-9 rounded-xl border-slate-200 text-xs placeholder:text-slate-400 focus-visible:ring-primary/40";
const FLm = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{children}</p>
);
const SRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5">
    <span className="text-xs font-semibold text-slate-700">{label}</span>
    {children}
  </div>
);

function CollectionEditorModal({ collection: initialCollection, onClose, onUpdate, allCourses, allCategories, categoryMap }: CollectionEditorModalProps) {
  const [collection, setCollection] = useState(initialCollection);
  const [courseQuery, setCourseQuery] = useState("");

  const query = courseQuery.trim().toLowerCase();
  const filteredCourses = query
    ? allCourses.filter((course) => [course.title, course.professor, categoryMap.get(course.category) || course.category].join(" ").toLowerCase().includes(query))
    : allCourses;

  const updateCollection = (updates: Partial<HeaderCourseCollection>) => setCollection((prev) => ({ ...prev, ...updates }));

  const toggleCourse = (courseId: string) => {
    const selected = new Set(collection.courseIds);
    if (selected.has(courseId)) selected.delete(courseId); else selected.add(courseId);
    updateCollection({ courseIds: Array.from(selected) });
  };

  const toggleCategory = (categoryId: string) => {
    const selected = new Set(collection.categoryIds);
    if (selected.has(categoryId)) selected.delete(categoryId); else selected.add(categoryId);
    updateCollection({ categoryIds: Array.from(selected) });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border-slate-100 p-0 shadow-2xl">
        <DialogHeader className="border-b border-slate-100 bg-slate-50 px-6 py-4 shrink-0">
          <DialogTitle className="text-base font-bold">Edit Collection Page</DialogTitle>
          <DialogDescription className="text-xs text-slate-400">Configure title, courses, categories, and visibility settings.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          {/* Basic */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <p className="text-xs font-bold text-slate-700">Basic Settings</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FLm>Title</FLm><Input className={fClsModal} placeholder="e.g., New Releases" value={collection.title} onChange={(e) => updateCollection({ title: e.target.value })} /></div>
              <div className="space-y-1.5"><FLm>Slug (auto)</FLm><Input className={`${fClsModal} bg-slate-100 cursor-not-allowed`} readOnly value={collection.slug} placeholder="Auto-generated" /></div>
            </div>
            <div className="space-y-1.5"><FLm>Description</FLm><textarea rows={2} className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40" value={collection.description} onChange={(e) => updateCollection({ description: e.target.value })} /></div>
            <SRow label="Collection Visible"><Switch checked={collection.visible} onCheckedChange={(checked) => updateCollection({ visible: checked })} /></SRow>
          </div>

          {/* Page Content */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <p className="text-xs font-bold text-slate-700">Page Content</p>
            <div className="space-y-1.5"><FLm>Navigation Label</FLm><Input className={fClsModal} placeholder="How it appears in header nav" value={collection.navigationLabel} onChange={(e) => updateCollection({ navigationLabel: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FLm>Hero Image URL</FLm><Input className={fClsModal} placeholder="Optional" value={collection.heroImageUrl} onChange={(e) => updateCollection({ heroImageUrl: e.target.value })} /></div>
              <div className="space-y-1.5"><FLm>Badge (e.g., "New")</FLm><Input className={fClsModal} value={collection.badge} onChange={(e) => updateCollection({ badge: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><FLm>CTA Button Label</FLm><Input className={fClsModal} value={collection.ctaLabel} onChange={(e) => updateCollection({ ctaLabel: e.target.value })} /></div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <SRow label="Show In Header Navigation"><Switch checked={collection.showInNavigation} onCheckedChange={(checked) => updateCollection({ showInNavigation: checked })} /></SRow>
            <SRow label="Enable Course Search"><Switch checked={collection.enableSearch} onCheckedChange={(checked) => updateCollection({ enableSearch: checked })} /></SRow>
            <SRow label="Enable Category Filter">
              <Switch checked={collection.enableCategoryFilter} onCheckedChange={(checked) => updateCollection({ enableCategoryFilter: checked, categoryIds: checked ? collection.categoryIds : [] })} />
            </SRow>
            {collection.enableCategoryFilter && (
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Select Categories</p>
                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                  {allCategories.map((category) => (
                    <label key={category.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs hover:border-primary/30">
                      <input type="checkbox" className="accent-primary" checked={collection.categoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} />
                      <span className="font-medium text-slate-700">{category.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <SRow label="Enable Course Selection">
              <Switch checked={collection.enableCourseSelector} onCheckedChange={(checked) => updateCollection({ enableCourseSelector: checked, courseIds: checked ? collection.courseIds : [] })} />
            </SRow>
            <SRow label="Enable Date-Time Schedule">
              <Switch checked={collection.enableCourseSchedule} onCheckedChange={(checked) => updateCollection({ enableCourseSchedule: checked, courseVisibleFrom: checked ? collection.courseVisibleFrom : "", courseVisibleUntil: checked ? collection.courseVisibleUntil : "" })} />
            </SRow>
            {collection.enableCourseSchedule && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><FLm>Visible From</FLm><Input type="datetime-local" className={fClsModal} value={collection.courseVisibleFrom || ""} onChange={(e) => updateCollection({ courseVisibleFrom: e.target.value })} /></div>
                <div className="space-y-1.5"><FLm>Visible Until</FLm><Input type="datetime-local" className={fClsModal} value={collection.courseVisibleUntil || ""} onChange={(e) => updateCollection({ courseVisibleUntil: e.target.value })} /></div>
              </div>
            )}
          </div>

          {/* Course selector */}
          {collection.enableCourseSelector && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-700">Select Courses <span className="text-primary">({collection.courseIds.length} selected)</span></p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input className="h-9 rounded-xl border-slate-200 pl-9 text-xs placeholder:text-slate-400" placeholder="Search courses..." value={courseQuery} onChange={(e) => setCourseQuery(e.target.value)} />
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {filteredCourses.map((course) => (
                  <label key={course.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${collection.courseIds.includes(course.id) ? "border-primary/30 bg-primary/5" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                    <input type="checkbox" className="accent-primary" checked={collection.courseIds.includes(course.id)} onChange={() => toggleCourse(course.id)} />
                    <span className="font-semibold text-slate-800">{course.title}</span>
                    <span className="ml-auto text-slate-400">{categoryMap.get(course.category)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4 shrink-0">
          <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="rounded-xl gap-1.5 px-5 text-xs font-semibold" onClick={() => onUpdate(collection)}>
            <Save className="h-3.5 w-3.5" />Save Collection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
