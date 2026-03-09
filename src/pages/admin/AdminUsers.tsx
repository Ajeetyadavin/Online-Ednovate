import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Mail, Phone, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

const mockStudents: Student[] = [
  { id: "1", name: "Rahul Kumar", email: "rahul@gmail.com", phone: "+91 98765 43210", status: "active", enrolledCourses: ["CA Foundation", "Tax Planning"], totalSpent: 6998, joinedDate: "2024-01-15" },
  { id: "2", name: "Priya Sharma", email: "priya@gmail.com", phone: "+91 87654 32109", status: "active", enrolledCourses: ["CS Executive Combo"], totalSpent: 7999, joinedDate: "2024-02-20" },
  { id: "3", name: "Aman Gupta", email: "aman@gmail.com", phone: "+91 76543 21098", status: "inactive", enrolledCourses: ["CMA Inter Law"], totalSpent: 2499, joinedDate: "2024-03-10" },
  { id: "4", name: "Sneha Patel", email: "sneha@gmail.com", phone: "+91 65432 10987", status: "active", enrolledCourses: ["CA Inter Accounts", "CA Foundation", "Tax Planning"], totalSpent: 10997, joinedDate: "2023-11-05" },
  { id: "5", name: "Vikash Singh", email: "vikash@gmail.com", phone: "+91 54321 09876", status: "active", enrolledCourses: ["Tax Masterclass"], totalSpent: 1999, joinedDate: "2024-04-01" },
];

const AdminUsers = () => {
  const [search, setSearch] = useState("");
  const filtered = mockStudents.filter(
    (s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users & Enrollments</h1>
        <p className="text-sm text-muted-foreground">{mockStudents.length} registered students</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="grid gap-3">
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
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{student.phone}</span>
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
