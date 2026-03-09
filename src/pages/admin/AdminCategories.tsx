import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, Eye, EyeOff, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePlatformData, type ManagedCategory } from "@/context/PlatformDataContext";

const AdminCategories = () => {
  const { categories, upsertCategory, deleteCategory, toggleCategoryVisibility } = usePlatformData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedCategory | null>(null);
  const emptyCategory: ManagedCategory = {
    id: "",
    name: "",
    slug: "",
    color: "#1E40AF",
    isVisible: true,
    parentId: null,
    sortOrder: 0,
  };
  const [form, setForm] = useState<ManagedCategory>(emptyCategory);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyCategory, id: Date.now().toString(), sortOrder: categories.length + 1 });
    setDialogOpen(true);
  };
  const openEdit = (cat: ManagedCategory) => {
    setEditing(cat);
    setForm({ ...cat });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    upsertCategory({
      ...form,
      name: form.name.trim(),
      slug: form.slug.trim() || generateSlug(form.name),
    });
    setDialogOpen(false);
  };

  const generateSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const visibleCount = categories.filter((category) => category.isVisible).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Manage course categories • {visibleCount}/{categories.length} visible
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Add Category</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: generateSlug(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium">Slug</label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                  <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="flex-1" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Parent Category (optional)</label>
                <select
                  value={form.parentId || "none"}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value === "none" ? null : e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="none">No parent</option>
                  {sortedCategories
                    .filter((category) => category.id !== form.id)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Sort Order</label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.isVisible} onChange={(e) => setForm({ ...form, isVisible: e.target.checked })} className="rounded" />
                <label className="text-sm">Visible on site</label>
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? "Update" : "Add"} Category</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {sortedCategories.map((cat) => (
          <Card key={cat.id} className={!cat.isVisible ? "opacity-60" : ""}>
            <CardContent className="p-4 flex items-center gap-4">
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
              <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{cat.name}</h3>
                <p className="text-xs text-muted-foreground">/{cat.slug}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Parent: {cat.parentId ? categories.find((item) => item.id === cat.parentId)?.name || "Unknown" : "None"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => toggleCategoryVisibility(cat.id)}>
                  {cat.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}><Edit className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => deleteCategory(cat.id)} className="text-destructive hover:text-destructive">
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

export default AdminCategories;
