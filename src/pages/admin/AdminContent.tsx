import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Eye, EyeOff, Star, Image, MessageSquare, Bell } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  usePlatformData,
  type ManagedAnnouncement,
  type ManagedBanner,
  type ManagedTestimonial,
} from "@/context/PlatformDataContext";

const AdminContent = () => {
  const {
    banners,
    testimonials,
    announcements,
    setBanners,
    setTestimonials,
    setAnnouncements,
  } = usePlatformData();

  const [bannerDialog, setBannerDialog] = useState(false);
  const [bannerForm, setBannerForm] = useState<ManagedBanner>({ id: "", title: "", imageUrl: "", isVisible: true, sortOrder: 0 });
  const [editingBanner, setEditingBanner] = useState<ManagedBanner | null>(null);

  const [testimonialDialog, setTestimonialDialog] = useState(false);
  const [testimonialForm, setTestimonialForm] = useState<ManagedTestimonial>({ id: "", authorName: "", authorRole: "", content: "", rating: 5, isVisible: true });
  const [editingTestimonial, setEditingTestimonial] = useState<ManagedTestimonial | null>(null);

  const [announcementDialog, setAnnouncementDialog] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState<ManagedAnnouncement>({ id: "", title: "", content: "", link: "/packages", isVisible: true });
  const [editingAnnouncement, setEditingAnnouncement] = useState<ManagedAnnouncement | null>(null);

  // Banner CRUD
  const saveBanner = () => {
    if (!bannerForm.title.trim() || !bannerForm.imageUrl.trim()) return;

    if (editingBanner) {
      setBanners(banners.map((b) => (b.id === bannerForm.id ? { ...bannerForm, title: bannerForm.title.trim() } : b)));
    } else {
      setBanners([
        ...banners,
        {
          ...bannerForm,
          id: Date.now().toString(),
          title: bannerForm.title.trim(),
          sortOrder: banners.length + 1,
        },
      ]);
    }
    setBannerDialog(false);
  };

  // Testimonial CRUD
  const saveTestimonial = () => {
    if (!testimonialForm.authorName.trim() || !testimonialForm.content.trim()) return;

    if (editingTestimonial) {
      setTestimonials(testimonials.map((t) => (t.id === testimonialForm.id ? testimonialForm : t)));
    } else {
      setTestimonials([...testimonials, { ...testimonialForm, id: Date.now().toString() }]);
    }
    setTestimonialDialog(false);
  };

  // Announcement CRUD
  const saveAnnouncement = () => {
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) return;

    if (editingAnnouncement) {
      setAnnouncements(announcements.map((a) => (a.id === announcementForm.id ? announcementForm : a)));
    } else {
      setAnnouncements([...announcements, { ...announcementForm, id: Date.now().toString() }]);
    }
    setAnnouncementDialog(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Content Management</h1>
        <p className="text-sm text-muted-foreground">Manage banners, testimonials, and announcements</p>
      </div>

      <Tabs defaultValue="banners">
        <TabsList>
          <TabsTrigger value="banners" className="gap-2"><Image className="w-4 h-4" />Banners</TabsTrigger>
          <TabsTrigger value="testimonials" className="gap-2"><MessageSquare className="w-4 h-4" />Testimonials</TabsTrigger>
          <TabsTrigger value="announcements" className="gap-2"><Bell className="w-4 h-4" />Announcements</TabsTrigger>
        </TabsList>

        {/* BANNERS */}
        <TabsContent value="banners" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingBanner(null); setBannerForm({ id: "", title: "", imageUrl: "", isVisible: true, sortOrder: 0 }); setBannerDialog(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Banner
            </Button>
          </div>
          {[...banners].sort((a, b) => a.sortOrder - b.sortOrder).map((banner) => (
            <Card key={banner.id} className={!banner.isVisible ? "opacity-60" : ""}>
              <CardContent className="p-4 flex items-center gap-4">
                <img src={banner.imageUrl} alt={banner.title} className="w-24 h-14 rounded-lg object-cover bg-muted" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{banner.title}</h3>
                  <p className="text-xs text-muted-foreground">{banner.imageUrl}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setBanners(banners.map((b) => b.id === banner.id ? { ...b, isVisible: !b.isVisible } : b))}>
                    {banner.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEditingBanner(banner); setBannerForm(banner); setBannerDialog(true); }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setBanners(banners.filter((b) => b.id !== banner.id))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <Dialog open={bannerDialog} onOpenChange={setBannerDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingBanner ? "Edit Banner" : "Add Banner"}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div><label className="text-sm font-medium">Title</label><Input value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Image URL</label><Input value={bannerForm.imageUrl} onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Sort Order</label><Input type="number" value={bannerForm.sortOrder} onChange={(e) => setBannerForm({ ...bannerForm, sortOrder: Number(e.target.value) || 1 })} /></div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={bannerForm.isVisible} onChange={(e) => setBannerForm({ ...bannerForm, isVisible: e.target.checked })} />
                  <label className="text-sm">Visible</label>
                </div>
                <Button onClick={saveBanner} className="w-full">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* TESTIMONIALS */}
        <TabsContent value="testimonials" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingTestimonial(null); setTestimonialForm({ id: "", authorName: "", authorRole: "", content: "", rating: 5, isVisible: true }); setTestimonialDialog(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Testimonial
            </Button>
          </div>
          {testimonials.map((t) => (
            <Card key={t.id} className={!t.isVisible ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-accent font-bold">{t.authorName.charAt(0)}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{t.authorName}</h3>
                      <span className="text-xs text-muted-foreground">• {t.authorRole}</span>
                    </div>
                    <div className="flex gap-0.5 my-1">{Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />)}</div>
                    <p className="text-sm text-muted-foreground">{t.content}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setTestimonials(testimonials.map((x) => x.id === t.id ? { ...x, isVisible: !x.isVisible } : x))}>
                      {t.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setEditingTestimonial(t); setTestimonialForm(t); setTestimonialDialog(true); }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setTestimonials(testimonials.filter((x) => x.id !== t.id))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Dialog open={testimonialDialog} onOpenChange={setTestimonialDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingTestimonial ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Name</label><Input value={testimonialForm.authorName} onChange={(e) => setTestimonialForm({ ...testimonialForm, authorName: e.target.value })} /></div>
                  <div><label className="text-sm font-medium">Role</label><Input value={testimonialForm.authorRole} onChange={(e) => setTestimonialForm({ ...testimonialForm, authorRole: e.target.value })} /></div>
                </div>
                <div><label className="text-sm font-medium">Review</label><Textarea value={testimonialForm.content} onChange={(e) => setTestimonialForm({ ...testimonialForm, content: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Rating (1-5)</label><Input type="number" min={1} max={5} value={testimonialForm.rating} onChange={(e) => setTestimonialForm({ ...testimonialForm, rating: Number(e.target.value) })} /></div>
                <Button onClick={saveTestimonial} className="w-full">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ANNOUNCEMENTS */}
        <TabsContent value="announcements" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingAnnouncement(null); setAnnouncementForm({ id: "", title: "", content: "", link: "/packages", isVisible: true }); setAnnouncementDialog(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Announcement
            </Button>
          </div>
          {announcements.map((a) => (
            <Card key={a.id} className={!a.isVisible ? "opacity-60" : ""}>
              <CardContent className="p-4 flex items-center gap-4">
                <Bell className="w-5 h-5 text-accent flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{a.title}</h3>
                  <p className="text-sm text-muted-foreground">{a.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">Link: {a.link}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setAnnouncements(announcements.map((x) => x.id === a.id ? { ...x, isVisible: !x.isVisible } : x))}>
                    {a.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEditingAnnouncement(a); setAnnouncementForm(a); setAnnouncementDialog(true); }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setAnnouncements(announcements.filter((x) => x.id !== a.id))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <Dialog open={announcementDialog} onOpenChange={setAnnouncementDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingAnnouncement ? "Edit Announcement" : "Add Announcement"}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div><label className="text-sm font-medium">Title</label><Input value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Content</label><Textarea value={announcementForm.content} onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Link</label><Input value={announcementForm.link} onChange={(e) => setAnnouncementForm({ ...announcementForm, link: e.target.value || "/packages" })} /></div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={announcementForm.isVisible} onChange={(e) => setAnnouncementForm({ ...announcementForm, isVisible: e.target.checked })} />
                  <label className="text-sm">Visible</label>
                </div>
                <Button onClick={saveAnnouncement} className="w-full">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminContent;
