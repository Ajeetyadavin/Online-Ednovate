import { useMemo, useState } from "react";
import { usePlatformData } from "@/context/PlatformDataContext";
import { adminApi } from "@/services/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Edit2, Trash2, Eye, EyeOff, Tag, ChevronRight, FolderOpen, } from "lucide-react";

type CategoryForm = {
  id: string;
  name: string;
  slug: string;
  color: string;
  parentId: string | null;
  sortOrder: number;
  isVisible: boolean;
};

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/* Preset colour swatches */
const SWATCHES = [
  "#9333ea", "#6366f1", "#3b82f6", "#06b6d4", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#64748b", "#0ea5e9",
];

/* Field label */
const FL = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{children}</p>
);
const fCls = "h-9 rounded-xl border-slate-200 text-xs placeholder:text-slate-400 focus-visible:ring-primary/40";

export default function AdminCategories() {
  const { categories, upsertCategory, deleteCategory, toggleCategoryVisibility } = usePlatformData();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<CategoryForm>({
    id: "", name: "", slug: "", color: "#9333ea", parentId: null, sortOrder: categories.length + 1, isVisible: true,
  });

  const sf = (u: Partial<CategoryForm>) => setForm((p) => ({ ...p, ...u }));

  const categoryMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const parentOptions = useMemo(() => categories.filter((c) => c.id !== editingId && !c.parentId), [categories, editingId]);

  const filteredCategories = useMemo(() => {
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    return sorted.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [categories, searchTerm]);

  /* Computed counts */
  const rootCount = useMemo(() => categories.filter((c) => !c.parentId).length, [categories]);
  const subCount = useMemo(() => categories.filter((c) => !!c.parentId).length, [categories]);
  const visibleCount = useMemo(() => categories.filter((c) => c.isVisible).length, [categories]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ id: `cat-${Date.now()}`, name: "", slug: "", color: "#9333ea", parentId: null, sortOrder: categories.length + 1, isVisible: true });
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    const cat = categoryMap[id];
    if (!cat) return;
    setEditingId(cat.id);
    setForm({ id: cat.id, name: cat.name, slug: cat.slug, color: cat.color, parentId: cat.parentId, sortOrder: cat.sortOrder, isVisible: cat.isVisible });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setIsSaving(true);
    try {
      const payload = {
        id: form.id,
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        color: form.color,
        parentId: form.parentId,
        sortOrder: Number(form.sortOrder || categories.length + 1),
        isVisible: form.isVisible,
      };
      const response = await adminApi.upsertCategory(payload);
      upsertCategory(response.item as any);
      setDialogOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save category");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    try {
      await adminApi.deleteCategory(id);
      deleteCategory(id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete category");
    }
  };

  const handleToggleVisibility = async (id: string) => {
    const current = categoryMap[id];
    if (!current) return;
    const nextVisible = !current.isVisible;
    try {
      await adminApi.toggleCategory(id, nextVisible);
      toggleCategoryVisibility(id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update category visibility");
    }
  };

  /* Group: roots + their children */
  const rootCategories = useMemo(() => filteredCategories.filter((c) => !c.parentId), [filteredCategories]);
  const childrenOf = (parentId: string) => filteredCategories.filter((c) => c.parentId === parentId);

  return (
    <div className="space-y-5 font-['Inter']">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Categories</h1>
            <p className="text-xs text-slate-400">Organise courses into categories and subcategories</p>
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex gap-2 ml-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Total: {categories.length}</span>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Root: {rootCount}</span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Subcategories: {subCount}</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Visible: {visibleCount}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input className="h-9 w-56 rounded-xl border-slate-200 pl-9 text-xs" placeholder="Search categories..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Button size="sm" className="h-9 gap-1.5 rounded-xl px-4 text-xs font-semibold" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5" />New Category
          </Button>
        </div>
      </div>

      {/* ─── Category List ───────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_auto_auto_auto_auto] gap-4 border-b border-slate-100 bg-slate-50 px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>Category</span>
          <span>Slug</span>
          <span>Parent</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderOpen className="mb-3 h-10 w-10 text-slate-200" />
            <p className="text-sm font-semibold text-slate-400">No categories found</p>
            <p className="mt-1 text-xs text-slate-300">Create your first category to organise courses</p>
            <Button size="sm" className="mt-4 gap-1.5 rounded-xl text-xs" onClick={openAdd}><Plus className="h-3.5 w-3.5" />New Category</Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rootCategories.map((cat) => {
              const subs = childrenOf(cat.id);
              return (
                <div key={cat.id}>
                  {/* Root row */}
                  <div className="grid grid-cols-[2fr_auto_auto_auto_auto] items-center gap-4 px-6 py-3.5 transition-colors hover:bg-slate-50/70">
                    {/* Name + colour dot */}
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-7 w-7 shrink-0 rounded-xl shadow-sm" style={{ backgroundColor: cat.color }} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{cat.name}</p>
                        {subs.length > 0 && (
                          <p className="text-[10px] text-slate-400">{subs.length} subcategor{subs.length === 1 ? "y" : "ies"}</p>
                        )}
                      </div>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Root</span>
                    </div>
                    {/* Slug */}
                    <code className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-mono text-slate-600">{cat.slug}</code>
                    {/* Parent */}
                    <span className="text-[11px] text-slate-400">—</span>
                    {/* Status */}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${cat.isVisible ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${cat.isVisible ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {cat.isVisible ? "Visible" : "Hidden"}
                    </span>
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => handleToggleVisibility(cat.id)} title={cat.isVisible ? "Hide" : "Show"}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${cat.isVisible ? "text-slate-400 hover:bg-amber-50 hover:text-amber-600" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}>
                        {cat.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button type="button" onClick={() => openEdit(cat.id)} title="Edit"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDelete(cat.id)} title="Delete"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Sub rows */}
                  {subs.map((sub) => (
                    <div key={sub.id} className="grid grid-cols-[2fr_auto_auto_auto_auto] items-center gap-4 border-t border-slate-50 bg-slate-50/40 px-6 py-3 transition-colors hover:bg-slate-50/80">
                      {/* Name indented */}
                      <div className="flex items-center gap-3 min-w-0">
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 ml-1" />
                        <span className="h-5 w-5 shrink-0 rounded-lg shadow-sm" style={{ backgroundColor: sub.color }} />
                        <p className="text-[13px] font-semibold text-slate-700">{sub.name}</p>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">Sub</span>
                      </div>
                      {/* Slug */}
                      <code className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-500">{sub.slug}</code>
                      {/* Parent */}
                      <span className="text-[11px] font-medium text-slate-500">{cat.name}</span>
                      {/* Status */}
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${sub.isVisible ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${sub.isVisible ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {sub.isVisible ? "Visible" : "Hidden"}
                      </span>
                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => handleToggleVisibility(sub.id)} title={sub.isVisible ? "Hide" : "Show"}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${sub.isVisible ? "text-slate-400 hover:bg-amber-50 hover:text-amber-600" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}>
                          {sub.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" onClick={() => openEdit(sub.id)} title="Edit"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDelete(sub.id)} title="Delete"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Orphaned subcategories whose parent is filtered out */}
            {filteredCategories
              .filter((c) => c.parentId && !categoryMap[c.parentId])
              .map((c) => (
                <div key={c.id} className="grid grid-cols-[2fr_auto_auto_auto_auto] items-center gap-4 px-6 py-3.5 transition-colors hover:bg-slate-50/70">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="h-6 w-6 shrink-0 rounded-xl" style={{ backgroundColor: c.color }} />
                    <p className="text-sm font-semibold text-slate-700">{c.name}</p>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">Sub</span>
                  </div>
                  <code className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-500">{c.slug}</code>
                  <span className="text-[11px] text-rose-400">Orphaned</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${c.isVisible ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${c.isVisible ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {c.isVisible ? "Visible" : "Hidden"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => openEdit(c.id)} title="Edit" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-primary/10 hover:text-primary"><Edit2 className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => handleDelete(c.id)} title="Delete" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ─── Add / Edit Dialog ───────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md overflow-hidden rounded-2xl border-slate-100 p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-100 px-6 py-4">
            <DialogTitle className="text-base font-bold text-slate-900">{editingId ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            {/* Name */}
            <div className="space-y-1.5">
              <FL>Category Name *</FL>
              <Input className={fCls} placeholder="e.g., Taxation" autoFocus value={form.name}
                onChange={(e) => sf({ name: e.target.value, slug: form.slug || slugify(e.target.value) })} />
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <FL>Slug (URL-friendly)</FL>
              <Input className={fCls} placeholder="e.g., taxation" value={form.slug}
                onChange={(e) => sf({ slug: slugify(e.target.value) })} />
            </div>

            {/* Parent */}
            <div className="space-y-1.5">
              <FL>Parent Category</FL>
              <select className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.parentId || "none"} onChange={(e) => sf({ parentId: e.target.value === "none" ? null : e.target.value })}>
                <option value="none">None — create as root category</option>
                {parentOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            {/* Colour swatches + custom picker */}
            <div className="space-y-2">
              <FL>Colour</FL>
              <div className="flex flex-wrap gap-2">
                {SWATCHES.map((c) => (
                  <button key={c} type="button" onClick={() => sf({ color: c })}
                    className="h-7 w-7 rounded-lg shadow-sm ring-2 transition-all"
                    style={{ backgroundColor: c, outline: form.color === c ? `2px solid ${c}` : "2px solid transparent", outlineOffset: "2px" }} />
                ))}
                <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-500 hover:border-primary/40">
                  Custom
                  <input type="color" value={form.color} onChange={(e) => sf({ color: e.target.value })} className="sr-only" />
                  <span className="h-4 w-4 rounded" style={{ backgroundColor: form.color }} />
                </label>
              </div>
              <p className="text-[10px] text-slate-400">Selected: <code className="font-mono">{form.color}</code></p>
            </div>

            {/* Sort order + Visibility row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <FL>Sort Order</FL>
                <Input type="number" className={fCls} value={form.sortOrder}
                  onChange={(e) => sf({ sortOrder: Number(e.target.value) || form.sortOrder })} />
              </div>
              <div className="space-y-1.5">
                <FL>Visibility</FL>
                <div className="flex h-9 gap-2">
                  {[{ v: true, label: "Visible" }, { v: false, label: "Hidden" }].map(({ v, label }) => (
                    <button key={label} type="button" onClick={() => sf({ isVisible: v })}
                      className={`flex flex-1 items-center justify-center rounded-xl border text-[11px] font-semibold transition-all ${form.isVisible === v ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
            <Button variant="outline" size="sm" className="rounded-xl border-slate-200 text-xs" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" className="gap-1.5 rounded-xl px-5 text-xs font-semibold" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "Saving..." : editingId ? "Update Category" : "Create Category"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
