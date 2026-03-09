import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, Eye, EyeOff, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  isVisible: boolean;
  parentId: string | null;
  sortOrder: number;
}

const initialCategories: Category[] = [
  { id: "1", name: "CA Foundation", slug: "ca-foundation", color: "#1E40AF", isVisible: true, parentId: null, sortOrder: 1 },
  { id: "2", name: "CA Intermediate", slug: "ca-inter", color: "#7C3AED", isVisible: true, parentId: null, sortOrder: 2 },
  { id: "3", name: "CA Final", slug: "ca-final", color: "#059669", isVisible: true, parentId: null, sortOrder: 3 },
  { id: "4", name: "CS Executive", slug: "cs-executive", color: "#DC2626", isVisible: true, parentId: null, sortOrder: 4 },
  { id: "5", name: "CMA Inter", slug: "cma-inter", color: "#D97706", isVisible: false, parentId: null, sortOrder: 5 },
];

const AdminCategories = () => {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const emptyCategory: Category = { id: "", name: "", slug: "", color: "#1E40AF", isVisible: true, parentId: null, sortOrder: 0 };
  const [form, setForm] = useState<Category>(emptyCategory);

  const openAdd = () => { setEditing(null); setForm({ ...emptyCategory, id: Date.now().toString(), sortOrder: categories.length + 1 }); setDialogOpen(true); };
  const openEdit = (cat: Category) => { setEditing(cat); setForm({ ...cat }); setDialogOpen(true); };

  const handleSave = () => {
    if (editing) {
      setCategories(categories.map((c) => (c.id === form.id ? form : c)));
    } else {
      setCategories([...categories, form]);
    }
    setDialogOpen(false);
  };

  const generateSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground">Manage course categories</p>
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
        {categories.sort((a, b) => a.sortOrder - b.sortOrder).map((cat) => (
          <Card key={cat.id} className={!cat.isVisible ? "opacity-60" : ""}>
            <CardContent className="p-4 flex items-center gap-4">
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
              <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{cat.name}</h3>
                <p className="text-xs text-muted-foreground">/{cat.slug}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setCategories(categories.map((c) => c.id === cat.id ? { ...c, isVisible: !c.isVisible } : c))}>
                  {cat.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}><Edit className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setCategories(categories.filter((c) => c.id !== cat.id))} className="text-destructive hover:text-destructive">
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
