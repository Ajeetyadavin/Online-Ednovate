import { useEffect, useMemo, useState } from "react";
import { adminApi, type FacultyProfile } from "@/services/adminApi";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Upload, UserRoundPlus, Pencil, Trash2, Search, GraduationCap,
  BookOpen, CheckCircle2, XCircle,
} from "lucide-react";

/* ─── Types ───────────────────────────────────────────────── */
interface CourseOption { id: string; title: string; thumbnail?: string; }
interface FacultyFormState {
  name: string; photoUrl: string; about: string;
  courseIds: string[]; isActive: boolean; sortOrder: number;
}

const createDefaultForm = (): FacultyFormState => ({
  name: "", photoUrl: "", about: "", courseIds: [], isActive: true, sortOrder: Date.now(),
});

const toCourseOptions = (courses: unknown[]): CourseOption[] =>
  courses.map((row) => {
    const item = (row || {}) as Record<string, unknown>;
    const id = String(item.id || "").trim();
    if (!id) return null;
    return { id, title: String(item.title || "Untitled"), thumbnail: String(item.thumbnail || item.image || "") };
  }).filter(Boolean) as CourseOption[];

/* ─── Field label ─────────────────────────────────────────── */
const FL = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{children}</p>
);
const fCls = "h-9 rounded-xl border-slate-200 text-xs placeholder:text-slate-400 focus-visible:ring-primary/40";

/* ─── AVATAR GRADIENTS ──────────────────────────────────────── */
const GRADIENTS = [
  "from-violet-400 to-purple-600", "from-sky-400 to-blue-600",
  "from-emerald-400 to-teal-600", "from-amber-400 to-orange-600",
  "from-rose-400 to-pink-600", "from-indigo-400 to-blue-600",
];

/* ─── Main ────────────────────────────────────────────────── */
export default function AdminFaculty() {
  const { hasPermission } = useAdminAuth();
  const [items, setItems] = useState<FacultyProfile[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [form, setForm] = useState<FacultyFormState>(createDefaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const canCreate = hasPermission("faculty", "create");
  const canEdit = hasPermission("faculty", "edit");
  const canDelete = hasPermission("faculty", "delete");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [facultyResponse, courseResponse] = await Promise.all([adminApi.listFaculty(), adminApi.getCourses()]);
      setItems(Array.isArray(facultyResponse.items) ? facultyResponse.items : []);
      setCourses(toCourseOptions(Array.isArray(courseResponse.courses) ? courseResponse.courses : []));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load faculty module");
    } finally { setIsLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const resetForm = () => { setEditingId(null); setForm(createDefaultForm()); setShowForm(false); setCourseSearch(""); };

  const sortedItems = useMemo(() => [...items].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)), [items]);

  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    return q ? courses.filter((c) => c.title.toLowerCase().includes(q)) : courses;
  }, [courses, courseSearch]);

  const handleSelectCourse = (courseId: string, checked: boolean) => {
    setForm((prev) => {
      const nextIds = checked
        ? Array.from(new Set([...prev.courseIds, courseId]))
        : prev.courseIds.filter((id) => id !== courseId);
      return { ...prev, courseIds: nextIds };
    });
  };

  const handleUploadPhoto = async (file?: File | null) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
      });
      const uploaded = await adminApi.uploadImage(file.name, file.type, base64Data, "faculty");
      setForm((prev) => ({ ...prev, photoUrl: uploaded.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally { setIsUploading(false); }
  };

  const handleEdit = (item: FacultyProfile) => {
    setEditingId(item.id);
    setForm({ name: item.name || "", photoUrl: item.photoUrl || "", about: item.about || "", courseIds: Array.isArray(item.courseIds) ? item.courseIds : [], isActive: item.isActive !== false, sortOrder: Number(item.sortOrder || 0) });
    setShowForm(true);
    setCourseSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Faculty name is required"); return; }
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = { name: form.name.trim(), photoUrl: form.photoUrl.trim(), about: form.about.trim(), courseIds: form.courseIds, isActive: form.isActive, sortOrder: Number(form.sortOrder || 0) };
      if (editingId) {
        if (!canEdit) throw new Error("No permission to edit faculty");
        await adminApi.updateFaculty(editingId, payload);
        setSuccess("Faculty updated successfully!");
      } else {
        if (!canCreate) throw new Error("No permission to create faculty");
        await adminApi.createFaculty(payload);
        setSuccess("Faculty added successfully!");
      }
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save faculty");
    } finally { setIsSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!canDelete || !confirm("Delete this faculty profile?")) return;
    try {
      await adminApi.deleteFaculty(id);
      setSuccess("Faculty deleted");
      await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to delete"); }
  };

  const handleToggleActive = async (item: FacultyProfile, checked: boolean) => {
    if (!canEdit) return;
    try {
      await adminApi.updateFaculty(item.id, { name: item.name, photoUrl: item.photoUrl || "", about: item.about || "", courseIds: Array.isArray(item.courseIds) ? item.courseIds : [], isActive: checked, sortOrder: Number(item.sortOrder || 0) });
      await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to update status"); }
  };

  /* ── JSX ── */
  return (
    <div className="space-y-5 font-['Inter']">
      {/* Page header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Faculty Module</h1>
            <p className="text-xs text-slate-400">Manage instructors, assign courses &amp; control visibility</p>
          </div>
        </div>
        {canCreate && !showForm && (
          <button
            type="button"
            onClick={() => { setShowForm(true); setEditingId(null); setForm(createDefaultForm()); }}
            className="ml-auto flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition-colors"
          >
            <UserRoundPlus className="h-3.5 w-3.5" /> Add Faculty
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          <XCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{success}
        </div>
      )}

      {/* ── FORM PANEL ─────────────────────────────────────── */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* form header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
            <p className="text-xs font-bold text-slate-700">{editingId ? "Edit Faculty Profile" : "Add New Faculty"}</p>
            <button type="button" onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-600 font-semibold transition-colors">Cancel</button>
          </div>

          <div className="p-5 space-y-5">
            {/* Avatar + basic info row */}
            <div className="flex flex-col sm:flex-row gap-5">
              {/* Avatar preview */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="h-24 w-24 rounded-full overflow-hidden ring-4 ring-slate-100 shadow-inner bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                  {form.photoUrl ? (
                    <img src={form.photoUrl} alt="Faculty" className="w-full h-full object-cover" />
                  ) : (
                    <GraduationCap className="h-9 w-9 text-slate-300" />
                  )}
                </div>
                <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-primary/40 hover:text-primary transition-colors shadow-sm">
                  {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {isUploading ? "Uploading..." : "Upload Photo"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadPhoto(e.target.files?.[0])} />
                </label>
              </div>

              {/* Name, URL, About */}
              <div className="flex-1 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FL>Name *</FL>
                    <Input className={fCls} placeholder="Professor name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <FL>Photo URL (or upload above)</FL>
                    <Input className={fCls} placeholder="https://..." value={form.photoUrl} onChange={(e) => setForm((prev) => ({ ...prev, photoUrl: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <FL>About</FL>
                  <textarea
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Brief faculty introduction..."
                    value={form.about}
                    onChange={(e) => setForm((prev) => ({ ...prev, about: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Course selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FL>Courses Taught</FL>
                {form.courseIds.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{form.courseIds.length} selected</span>
                )}
              </div>
              {/* search */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input className={`${fCls} pl-9`} placeholder="Search courses..." value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)} />
              </div>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {filteredCourses.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">No courses found</p>
                ) : (
                  filteredCourses.map((course) => {
                    const selected = form.courseIds.includes(course.id);
                    return (
                      <label key={course.id} className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors ${selected ? "bg-primary/5" : "hover:bg-slate-50/80"}`}>
                        <input type="checkbox" className="accent-primary h-3.5 w-3.5 shrink-0" checked={selected} onChange={(e) => handleSelectCourse(course.id, e.target.checked)} />
                        {course.thumbnail && <img src={course.thumbnail} alt={course.title} className="h-8 w-12 rounded-md object-cover shrink-0" />}
                        <span className={`text-xs font-semibold line-clamp-1 ${selected ? "text-primary" : "text-slate-700"}`}>{course.title}</span>
                        {selected && <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />}
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer: sort, active, save */}
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <FL>Sort Order</FL>
                <Input type="number" className="h-8 w-20 rounded-xl border-slate-200 text-xs" value={form.sortOrder} onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: Number(e.target.value || 0) }))} />
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5">
                <span className="text-xs font-semibold text-slate-600">Active</span>
                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
              </div>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="button" onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserRoundPlus className="h-3.5 w-3.5" />}
                  {editingId ? "Update Faculty" : "Add Faculty"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FACULTY LIST ────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center border-b border-slate-100 bg-slate-50 px-5 py-3">
          <p className="text-xs font-bold text-slate-700">All Faculty</p>
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{sortedItems.length}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <p className="text-xs text-slate-400">Loading faculty...</p>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <GraduationCap className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500">No faculty added yet</p>
            <p className="text-xs text-slate-400 mt-1">Click "Add Faculty" to create the first instructor profile</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sortedItems.map((item, index) => {
              const gradient = GRADIENTS[index % GRADIENTS.length];
              return (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className={`h-[60px] w-[60px] rounded-full overflow-hidden ring-2 ring-white shadow-md bg-gradient-to-br ${gradient}`}>
                      {item.photoUrl ? (
                        <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span className="text-xl font-extrabold text-white/90">{item.name.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                    <span className={`absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-white shadow ${item.isActive ? "bg-emerald-400" : "bg-slate-300"}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{item.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {item.about && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.about}</p>}
                    {/* Course badges */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(item.courses || []).length === 0 ? (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400"><BookOpen className="h-3 w-3" />No courses mapped</span>
                      ) : (
                        item.courses.slice(0, 4).map((course) => (
                          <span key={`${item.id}-${course.id}`} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                            <BookOpen className="h-2.5 w-2.5" />{course.title}
                          </span>
                        ))
                      )}
                      {(item.courses || []).length > 4 && (
                        <span className="text-[10px] text-slate-400">+{item.courses.length - 4} more</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5">
                      <span className="text-[11px] font-semibold text-slate-500">Active</span>
                      <Switch checked={item.isActive} onCheckedChange={(checked) => handleToggleActive(item, checked)} disabled={!canEdit} />
                    </div>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleEdit(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-40"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!canDelete}
                      onClick={() => handleDelete(item.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
