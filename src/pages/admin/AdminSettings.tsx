import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Palette, Type, Layout, Eye, Save, Image, RotateCcw, Upload } from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { toast } from "sonner";

const AdminSettings = () => {
  const { settings, updateColors, updateFonts, updateSections, updateLogo, resetSettings } = useSiteSettings();
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    setSaved(true);
    toast.success("Settings saved successfully!");
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    resetSettings();
    toast.success("Settings reset to defaults!");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      updateLogo(result);
      toast.success("Logo updated!");
    };
    reader.readAsDataURL(file);
  };

  const fontOptions = [
    "Plus Jakarta Sans", "Inter", "Poppins", "Roboto", "Open Sans", "Lato",
    "Montserrat", "Raleway", "Nunito", "Source Sans Pro", "DM Sans",
  ];

  const colorLabels: Record<string, string> = {
    primary: "Primary (Header, Buttons)",
    accent: "Accent (CTA, Highlights)",
    background: "Background",
    foreground: "Text Color",
    muted: "Muted Background",
    card: "Card Background",
  };

  const sectionLabels: Record<string, string> = {
    heroBanner: "Hero Banner Slider",
    announcementBar: "Announcement Bar",
    statsCounter: "Stats Counter",
    howItWorks: "How It Works",
    popularCourses: "Popular Courses",
    whyChooseUs: "Why Choose Us",
    testimonials: "Testimonials",
    faq: "FAQ Section",
    ctaBand: "CTA Band (Bottom)",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Site Settings</h1>
          <p className="text-sm text-muted-foreground">Colors, fonts, logo & section visibility — changes apply live!</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="w-4 h-4" />
            {saved ? "Saved ✓" : "Save Changes"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="colors">
        <TabsList>
          <TabsTrigger value="colors" className="gap-2"><Palette className="w-4 h-4" />Colors</TabsTrigger>
          <TabsTrigger value="fonts" className="gap-2"><Type className="w-4 h-4" />Fonts</TabsTrigger>
          <TabsTrigger value="logo" className="gap-2"><Image className="w-4 h-4" />Logo</TabsTrigger>
          <TabsTrigger value="sections" className="gap-2"><Layout className="w-4 h-4" />Sections</TabsTrigger>
        </TabsList>

        {/* COLORS */}
        <TabsContent value="colors">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Color Palette</CardTitle>
              <CardDescription>Changes apply instantly to the entire site</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(settings.colors).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <label className="text-sm font-medium">{colorLabels[key] || key}</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => updateColors({ [key]: e.target.value })}
                        className="w-12 h-10 rounded-lg cursor-pointer border border-border"
                      />
                      <Input
                        value={value}
                        onChange={(e) => updateColors({ [key]: e.target.value })}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Preview */}
              <div className="mt-6 p-6 rounded-xl border border-border" style={{ backgroundColor: settings.colors.background }}>
                <h3 className="font-bold text-lg mb-2" style={{ color: settings.colors.foreground }}>Live Preview</h3>
                <p className="text-sm mb-4" style={{ color: settings.colors.foreground + "99" }}>This is how your color scheme looks on the live site.</p>
                <div className="flex gap-3">
                  <button className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: settings.colors.primary }}>Primary</button>
                  <button className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: settings.colors.accent }}>Accent</button>
                </div>
                <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: settings.colors.muted }}>
                  <p className="text-sm" style={{ color: settings.colors.foreground }}>Muted background area</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FONTS */}
        <TabsContent value="fonts">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Typography</CardTitle>
              <CardDescription>Choose fonts for headings and body text</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Heading Font</label>
                  <Select value={settings.fonts.heading} onValueChange={(v) => updateFonts({ heading: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {fontOptions.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-2xl font-bold mt-3" style={{ fontFamily: settings.fonts.heading }}>
                    Heading Preview
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Body Font</label>
                  <Select value={settings.fonts.body} onValueChange={(v) => updateFonts({ body: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {fontOptions.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-3" style={{ fontFamily: settings.fonts.body }}>
                    Body text preview. This is how your content will look.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LOGO */}
        <TabsContent value="logo">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Site Logo</CardTitle>
              <CardDescription>Upload a new logo (SVG or PNG recommended)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start gap-8">
                {/* Current Logo Preview */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Current Logo</label>
                  <div className="p-6 bg-muted rounded-xl border border-border flex items-center justify-center min-w-[200px]">
                    <img src={settings.logo} alt="Current Logo" className="h-10 max-w-[200px] object-contain" />
                  </div>
                  <div className="p-6 bg-primary rounded-xl flex items-center justify-center min-w-[200px]">
                    <img src={settings.logo} alt="Logo on dark" className="h-10 max-w-[200px] object-contain" style={{ filter: "brightness(0) invert(1)" }} />
                  </div>
                </div>

                {/* Upload */}
                <div className="space-y-3 flex-1">
                  <label className="text-sm font-medium">Upload New Logo</label>
                  <input type="file" ref={fileInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-accent hover:bg-accent/5 transition-all"
                  >
                    <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">Click to upload logo</p>
                    <p className="text-xs text-muted-foreground mt-1">SVG, PNG, JPG (max 2MB)</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Or enter logo URL</label>
                    <Input
                      placeholder="https://example.com/logo.svg"
                      value={settings.logo.startsWith("data:") ? "" : settings.logo}
                      onChange={(e) => {
                        if (e.target.value) updateLogo(e.target.value);
                      }}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTIONS */}
        <TabsContent value="sections">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Section Visibility</CardTitle>
              <CardDescription>Toggle homepage sections on/off instantly</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(settings.sections).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">{sectionLabels[key] || key}</p>
                        <p className="text-xs text-muted-foreground">
                          {value ? "Currently visible" : "Hidden from homepage"}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={value}
                      onCheckedChange={(checked) => updateSections({ [key]: checked })}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
