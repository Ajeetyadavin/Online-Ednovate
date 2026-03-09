import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Course {
  id: string;
  title: string;
  category: string;
  price: number;
  originalPrice: number;
  professor: string;
  isVisible: boolean;
  image: string;
}

const initialCourses: Course[] = [
  { id: "1", title: "CA Foundation Complete Course", category: "CA", price: 4999, originalPrice: 7999, professor: "Dr. Sharma", isVisible: true, image: "/placeholder.svg" },
  { id: "2", title: "CS Executive Combo Pack", category: "CS", price: 7999, originalPrice: 12999, professor: "Prof. Patel", isVisible: true, image: "/placeholder.svg" },
  { id: "3", title: "CMA Inter Law & Ethics", category: "CMA", price: 2499, originalPrice: 3999, professor: "Dr. Gupta", isVisible: true, image: "/placeholder.svg" },
  { id: "4", title: "CA Inter Accounts Group", category: "CA", price: 5999, originalPrice: 8999, professor: "Prof. Singh", isVisible: false, image: "/placeholder.svg" },
  { id: "5", title: "Tax Planning Masterclass", category: "Tax", price: 1999, originalPrice: 2999, professor: "CA Verma", isVisible: true, image: "/placeholder.svg" },
];

const AdminCourses = () => {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [search, setSearch] = useState("");
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const emptyCourse: Course = { id: "", title: "", category: "", price: 0, originalPrice: 0, professor: "", isVisible: true, image: "/placeholder.svg" };
  const [form, setForm] = useState<Course>(emptyCourse);

  const filtered = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditingCourse(null);
    setForm({ ...emptyCourse, id: Date.now().toString() });
    setDialogOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditingCourse(course);
    setForm({ ...course });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editingCourse) {
      setCourses(courses.map((c) => (c.id === form.id ? form : c)));
    } else {
      setCourses([...courses, form]);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    setCourses(courses.filter((c) => c.id !== id));
  };

  const toggleVisibility = (id: string) => {
    setCourses(courses.map((c) => (c.id === id ? { ...c, isVisible: !c.isVisible } : c)));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Courses</h1>
          <p className="text-sm text-muted-foreground">{courses.length} total courses</p>
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
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Professor</label>
                  <Input value={form.professor} onChange={(e) => setForm({ ...form, professor: e.target.value })} />
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
              <div>
                <label className="text-sm font-medium">Image URL</label>
                <Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
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
          <Card key={course.id} className={`${!course.isVisible ? "opacity-60" : ""}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <img src={course.image} alt={course.title} className="w-16 h-16 rounded-lg object-cover bg-muted flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{course.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{course.category}</span>
                  <span className="text-xs text-muted-foreground">{course.professor}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-bold text-sm">₹{course.price.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground line-through">₹{course.originalPrice.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => toggleVisibility(course.id)} title={course.isVisible ? "Hide" : "Show"}>
                  {course.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(course)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(course.id)} className="text-destructive hover:text-destructive">
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
