import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePlatformData, type ManagedCourse } from "@/context/PlatformDataContext";
import { toast } from "sonner";

const AdminCourses = () => {
  const { courses, categories, upsertCourse, deleteCourse, toggleCourseVisibility } = usePlatformData();
  const [search, setSearch] = useState("");
  const [editingCourse, setEditingCourse] = useState<ManagedCourse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const emptyCourse: ManagedCourse = {
    id: "",
    title: "",
    category: categories[0]?.id || "ca-foundation",
    subcategory: "general",
    language: "Hindi + English",
    lectures: 0,
    hours: 0,
    price: 0,
    originalPrice: 0,
    discount: 0,
    image: "/placeholder.svg",
    professor: "",
    isCombo: false,
    isMaterial: false,
    isVisible: true,
  };
  const [form, setForm] = useState<ManagedCourse>(emptyCourse);

  const filtered = useMemo(
    () =>
      courses.filter(
        (course) =>
          course.title.toLowerCase().includes(search.toLowerCase()) ||
          course.category.toLowerCase().includes(search.toLowerCase()) ||
          course.professor.toLowerCase().includes(search.toLowerCase()),
      ),
    [courses, search],
  );

  const visibleCount = courses.filter((course) => course.isVisible).length;

  const openAdd = () => {
    setEditingCourse(null);
    setForm({
      ...emptyCourse,
      id: Date.now().toString(),
      category: categories[0]?.id || "ca-foundation",
    });
    setDialogOpen(true);
  };

  const openEdit = (course: ManagedCourse) => {
    setEditingCourse(course);
    setForm({ ...course });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.title.trim() || !form.professor.trim()) return;

    const originalPrice = Math.max(form.originalPrice, form.price);
    const discount =
      originalPrice > 0
        ? Math.max(0, Math.min(95, Math.round(((originalPrice - form.price) / originalPrice) * 100)))
        : 0;

    upsertCourse({
      ...form,
      title: form.title.trim(),
      professor: form.professor.trim(),
      language: form.language.trim() || "English",
      subcategory: form.subcategory.trim() || "general",
      image: form.image.trim() || "/placeholder.svg",
      originalPrice,
      discount,
    });

    setDialogOpen(false);
  };

  const handleCourseImageUpload = (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file.");
      return;
    }

    const maxSizeMb = 2;
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error("Image is too large. Keep it up to 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = typeof event.target?.result === "string" ? event.target.result : "";
      if (!dataUrl) {
        toast.error("Image upload failed.");
        return;
      }

      setForm((prev) => ({ ...prev, image: dataUrl }));
      toast.success("Thumbnail image uploaded.");
    };

    reader.readAsDataURL(file);
  };

  const categoryLabel = (categoryId: string) =>
    categories.find((category) => category.id === categoryId)?.name || categoryId;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Courses</h1>
          <p className="text-sm text-muted-foreground">
            {courses.length} total courses • {visibleCount} visible on website
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Add Course</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCourse ? "Edit Course" : "Add New Course"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {categories
                      .filter((category) => category.isVisible)
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Professor</label>
                  <Input value={form.professor} onChange={(e) => setForm({ ...form, professor: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Subcategory</label>
                  <Input value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Language</label>
                  <Input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Price (₹)</label>
                  <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Original Price (₹)</label>
                  <Input type="number" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Total Lectures</label>
                  <Input type="number" value={form.lectures} onChange={(e) => setForm({ ...form, lectures: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Total Hours</label>
                  <Input type="number" value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Image URL</label>
                <Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Upload Thumbnail Image</label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleCourseImageUpload(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">Recommended: JPG/PNG, up to 2MB.</p>
                {form.image && (
                  <img
                    src={form.image}
                    alt="Course thumbnail preview"
                    className="h-24 w-full max-w-xs rounded-md border border-border object-cover"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(form.isCombo)}
                    onChange={(e) => setForm({ ...form, isCombo: e.target.checked })}
                    className="rounded"
                  />
                  Combo Course
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(form.isMaterial)}
                    onChange={(e) => setForm({ ...form, isMaterial: e.target.checked })}
                    className="rounded"
                  />
                  Study Material
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.isVisible} onChange={(e) => setForm({ ...form, isVisible: e.target.checked })} className="rounded" />
                <label className="text-sm">Visible on site</label>
              </div>
              <Button onClick={handleSave} className="w-full">{editingCourse ? "Update Course" : "Add Course"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search courses..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="grid gap-3">
        {filtered.map((course) => (
          <Card key={course.id} className={!course.isVisible ? "opacity-60" : ""}>
            <CardContent className="p-4 flex items-center gap-4">
              <img src={course.image} alt={course.title} className="w-16 h-16 rounded-lg object-cover bg-muted flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{course.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{categoryLabel(course.category)}</span>
                  <span className="text-xs text-muted-foreground">{course.professor}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-bold text-sm">₹{course.price.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground line-through">₹{course.originalPrice.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => toggleCourseVisibility(course.id)} title={course.isVisible ? "Hide" : "Show"}>
                  {course.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(course)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteCourse(course.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminCourses;
