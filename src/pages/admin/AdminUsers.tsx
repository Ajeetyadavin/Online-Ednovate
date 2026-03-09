import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Mail, Phone, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/context/CartContext";

interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "active" | "inactive";
  enrolledCourses: string[];
  totalSpent: number;
  joinedDate: string;
}

const AdminUsers = () => {
  const { orders } = useCart();
  const [search, setSearch] = useState("");

  const students = orders.reduce<Student[]>((acc, order, index) => {
    const identity = order.email || order.phone || order.studentName || `student-${index + 1}`;
    const existing = acc.find(
      (student) =>
        student.email === order.email ||
        (student.phone && order.phone && student.phone === order.phone) ||
        student.name === order.studentName,
    );

    if (existing) {
      existing.totalSpent += order.total;
      existing.joinedDate = existing.joinedDate || order.date;
      order.items.forEach((item) => {
        if (!existing.enrolledCourses.includes(item.title)) {
          existing.enrolledCourses.push(item.title);
        }
      });
      return acc;
    }

    acc.push({
      id: identity,
      name: order.studentName || "Student",
      email: order.email || "",
      phone: order.phone || "",
      status: order.status === "Completed" ? "active" : "inactive",
      enrolledCourses: order.items.map((item) => item.title),
      totalSpent: order.total,
      joinedDate: order.date,
    });

    return acc;
  }, []);

  const filtered = students.filter(
    (student) =>
      student.name.toLowerCase().includes(search.toLowerCase()) ||
      student.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users & Enrollments</h1>
        <p className="text-sm text-muted-foreground">{students.length} registered students</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No users found. Users will appear after successful checkouts.
            </CardContent>
          </Card>
        )}

        {filtered.map((student) => (
          <Card key={student.id}>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold text-lg">{student.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{student.name}</h3>
                    <Badge variant={student.status === "active" ? "default" : "secondary"} className="text-xs">
                      {student.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{student.email}</span>
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{student.phone || "N/A"}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {student.enrolledCourses.map((course) => (
                      <span key={course} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />{course}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-foreground">₹{student.totalSpent.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Joined {student.joinedDate}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminUsers;
