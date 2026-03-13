import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Palette, Type, Layout, Eye, Save, Image, RotateCcw, Upload, PanelTop, Smartphone, Plus, Trash2, Zap } from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { usePlatformData } from "@/context/PlatformDataContext";
import { toast } from "sonner";

const AdminSettings = () => {
  const { settings, updateColors, updateFonts, updateSections, updateHeader, updateMobileFooter, updateAnimations, updateLogo, resetSettings } = useSiteSettings();
  const { resetPlatformData } = usePlatformData();
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

  const handleResetPlatformData = () => {
    resetPlatformData();
    toast.success("Platform content reset to defaults.");
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

  const headerStyleOptions = [
    { value: "solid", label: "Solid" },
    { value: "outline", label: "Outline" },
    { value: "ghost", label: "Ghost" },
  ];

  const mobileActionOptions = [
    { value: "link", label: "Open Link" },
    { value: "tel", label: "Call Number" },
    { value: "login", label: "Login / Profile" },
    { value: "dashboard", label: "Open Dashboard" },
  ];

  const mobileIconOptions = [
    { value: "home", label: "Home" },
    { value: "courses", label: "Courses" },
    { value: "phone", label: "Phone" },
    { value: "profile", label: "Profile" },
    { value: "login", label: "Login" },
    { value: "support", label: "Support" },
    { value: "settings", label: "Settings" },
  ];

  const addHeaderButton = () => {
    updateHeader({
      customButtons: [
        ...settings.header.customButtons,
        {
          id: `header-btn-${Date.now()}`,
          label: "New Button",
          href: "/packages",
          style: "outline",
          visible: true,
          newTab: false,
        },
      ],
    });
  };

  const updateHeaderButton = (id: string, updates: Record<string, unknown>) => {
    updateHeader({
      customButtons: settings.header.customButtons.map((button) =>
        button.id === id ? { ...button, ...updates } : button,
      ),
    });
  };

  const removeHeaderButton = (id: string) => {
    updateHeader({
      customButtons: settings.header.customButtons.filter((button) => button.id !== id),
    });
  };

  const addHeaderNavLink = () => {
    updateHeader({
      navLinks: [
        ...settings.header.navLinks,
        {
          id: `nav-link-${Date.now()}`,
          label: "New Menu",
          href: "/",
          hasDropdown: false,
          visible: true,
        },
      ],
    });
  };

  const updateHeaderNavLink = (id: string, updates: Record<string, unknown>) => {
    updateHeader({
      navLinks: settings.header.navLinks.map((link) =>
        link.id === id ? { ...link, ...updates } : link,
      ),
    });
  };

  const removeHeaderNavLink = (id: string) => {
    updateHeader({
      navLinks: settings.header.navLinks.filter((link) => link.id !== id),
    });
  };

  const addMobileFooterButton = () => {
    updateMobileFooter({
      buttons: [
        ...settings.mobileFooter.buttons,
        {
          id: `mobile-btn-${Date.now()}`,
          label: "New Footer Button",
          href: "/",
          action: "link",
          icon: "home",
          visible: true,
        },
      ],
    });
  };

  const updateMobileButton = (id: string, updates: Record<string, unknown>) => {
    updateMobileFooter({
      buttons: settings.mobileFooter.buttons.map((button) =>
        button.id === id ? { ...button, ...updates } : button,
      ),
    });
  };

  const removeMobileButton = (id: string) => {
    updateMobileFooter({
      buttons: settings.mobileFooter.buttons.filter((button) => button.id !== id),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Site Settings</h1>
          <p className="text-sm text-muted-foreground">Colors, fonts, logo & section visibility — changes apply live!</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleResetPlatformData} className="gap-2">
            <RotateCcw className="w-4 h-4" /> Reset CMS Data
          </Button>
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
          <TabsTrigger value="animations" className="gap-2"><Zap className="w-4 h-4" />Animations</TabsTrigger>
          <TabsTrigger value="navigation" className="gap-2"><PanelTop className="w-4 h-4" />Navigation</TabsTrigger>
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

        {/* ANIMATIONS */}
        <TabsContent value="animations">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Scroll Animations</CardTitle>
              <CardDescription>Control homepage section scroll animations — change type, speed, or disable entirely</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Enable / Disable */}
              <div className="flex items-center justify-between border border-border rounded-xl p-4">
                <div>
                  <p className="font-semibold text-sm">Enable Scroll Animations</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sections will animate as they scroll into view</p>
                </div>
                <Switch
                  checked={settings.animations.enabled}
                  onCheckedChange={(checked) => updateAnimations({ enabled: checked })}
                />
              </div>

              {/* Animation Type */}
              <div className={`space-y-3 transition-opacity ${settings.animations.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                <p className="font-semibold text-sm">Animation Type</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([
                    { value: "up",     label: "Slide Up",    emoji: "⬆️" },
                    { value: "down",   label: "Slide Down",  emoji: "⬇️" },
                    { value: "left",   label: "Slide Left",  emoji: "⬅️" },
                    { value: "right",  label: "Slide Right", emoji: "➡️" },
                    { value: "scale",  label: "Zoom In",     emoji: "🔍" },
                    { value: "fade",   label: "Fade Only",   emoji: "✨" },
                    { value: "zoom",   label: "Zoom Out",    emoji: "🔎" },
                    { value: "bounce", label: "Bounce",      emoji: "🏀" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateAnimations({ type: opt.value })}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-semibold tap-bounce ${
                        settings.animations.type === opt.value
                          ? "border-primary bg-primary/8 text-primary"
                          : "border-border bg-card hover:border-primary/30"
                      }`}
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed */}
              <div className={`space-y-3 transition-opacity ${settings.animations.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                <p className="font-semibold text-sm">Animation Speed</p>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: "fast",   label: "Fast",   sub: "0.28s" },
                    { value: "normal", label: "Normal", sub: "0.6s"  },
                    { value: "slow",   label: "Slow",   sub: "1s"    },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateAnimations({ speed: opt.value })}
                      className={`flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all font-semibold tap-bounce ${
                        settings.animations.speed === opt.value
                          ? "border-primary bg-primary/8 text-primary"
                          : "border-border bg-card hover:border-primary/30"
                      }`}
                    >
                      <span className="text-base">{opt.label}</span>
                      <span className="text-xs font-normal text-muted-foreground">{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="rounded-xl bg-muted/60 border border-border p-4 text-sm text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">How does it work?</p>
                <p>• Sections automatically animate when they scroll into view</p>
                <p>• Changing the type updates direction/style across all sections globally</p>
                <p>• Speed controls how fast or slow the animation plays — also applied globally</p>
                <p>• Disabling animations makes all sections appear instantly without any effect</p>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* NAVIGATION */}
        <TabsContent value="navigation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Header Controls</CardTitle>
              <CardDescription>Top bar, auth labels, search toggle, and custom header buttons.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between border border-border rounded-lg p-3">
                  <div>
                    <p className="font-medium text-sm">Show Top Bar</p>
                    <p className="text-xs text-muted-foreground">Phone/email strip above header</p>
                  </div>
                  <Switch checked={settings.header.topBarVisible} onCheckedChange={(checked) => updateHeader({ topBarVisible: checked })} />
                </div>
                <div className="flex items-center justify-between border border-border rounded-lg p-3">
                  <div>
                    <p className="font-medium text-sm">Show Search</p>
                    <p className="text-xs text-muted-foreground">Desktop search input toggle</p>
                  </div>
                  <Switch checked={settings.header.showSearch} onCheckedChange={(checked) => updateHeader({ showSearch: checked })} />
                </div>
                <div className="flex items-center justify-between border border-border rounded-lg p-3 md:col-span-2">
                  <div>
                    <p className="font-medium text-sm">Show Login/Signup Buttons</p>
                    <p className="text-xs text-muted-foreground">Desktop + mobile auth button visibility</p>
                  </div>
                  <Switch checked={settings.header.showAuthButtons} onCheckedChange={(checked) => updateHeader({ showAuthButtons: checked })} />
                </div>
                <div className="flex items-center justify-between border border-border rounded-lg p-3 md:col-span-2">
                  <div>
                    <p className="font-medium text-sm">Notice Scroll Speed</p>
                    <p className="text-xs text-muted-foreground">
                      Seconds for one full loop. Smaller = super fast, bigger = super slow.
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={settings.header.announcementSpeedSeconds}
                    onChange={(e) =>
                      updateHeader({
                        announcementSpeedSeconds: Math.min(120, Math.max(5, Number(e.target.value) || 5)),
                      })
                    }
                    className="w-24 text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Top Bar Phone</label>
                  <Input value={settings.header.topBarPhone} onChange={(e) => updateHeader({ topBarPhone: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Top Bar Email</label>
                  <Input value={settings.header.topBarEmail} onChange={(e) => updateHeader({ topBarEmail: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Top Bar Right Text 1</label>
                  <Input value={settings.header.topBarPrimaryText} onChange={(e) => updateHeader({ topBarPrimaryText: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Top Bar Right Text 2</label>
                  <Input value={settings.header.topBarSecondaryText} onChange={(e) => updateHeader({ topBarSecondaryText: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Login Button Label</label>
                  <Input value={settings.header.loginLabel} onChange={(e) => updateHeader({ loginLabel: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Signup Button Label</label>
                  <Input value={settings.header.signupLabel} onChange={(e) => updateHeader({ signupLabel: e.target.value })} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">Header Navigation Links</p>
                  <Button size="sm" variant="outline" onClick={addHeaderNavLink} className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add Link
                  </Button>
                </div>

                {settings.header.navLinks.map((link) => (
                  <div key={link.id} className="border border-border rounded-lg p-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Menu Label</label>
                        <Input value={link.label} onChange={(e) => updateHeaderNavLink(link.id, { label: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Menu Link</label>
                        <Input value={link.href} onChange={(e) => updateHeaderNavLink(link.id, { href: e.target.value })} />
                      </div>
                      <div className="flex items-end gap-4 md:col-span-2 pb-1">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={link.visible} onChange={(e) => updateHeaderNavLink(link.id, { visible: e.target.checked })} className="rounded" />
                          Visible
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={link.hasDropdown} onChange={(e) => updateHeaderNavLink(link.id, { hasDropdown: e.target.checked })} className="rounded" />
                          Show Dropdown Arrow
                        </label>
                        <Button size="icon" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => removeHeaderNavLink(link.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">Custom Header Buttons</p>
                  <Button size="sm" variant="outline" onClick={addHeaderButton} className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add Button
                  </Button>
                </div>

                {settings.header.customButtons.map((button) => (
                  <div key={button.id} className="border border-border rounded-lg p-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Label</label>
                        <Input value={button.label} onChange={(e) => updateHeaderButton(button.id, { label: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Link</label>
                        <Input value={button.href} onChange={(e) => updateHeaderButton(button.id, { href: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Style</label>
                        <select
                          value={button.style}
                          onChange={(e) => updateHeaderButton(button.id, { style: e.target.value as "solid" | "outline" | "ghost" })}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {headerStyleOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end gap-4 pb-1">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={button.visible} onChange={(e) => updateHeaderButton(button.id, { visible: e.target.checked })} className="rounded" />
                          Visible
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={button.newTab} onChange={(e) => updateHeaderButton(button.id, { newTab: e.target.checked })} className="rounded" />
                          Open in New Tab
                        </label>
                        <Button size="icon" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => removeHeaderButton(button.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mobile Footer Controls</CardTitle>
              <CardDescription>Phone view bottom sticky buttons manage karein.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border border-border rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Show Mobile Footer</p>
                    <p className="text-xs text-muted-foreground">Sticky button bar on phone screens</p>
                  </div>
                </div>
                <Switch checked={settings.mobileFooter.visible} onCheckedChange={(checked) => updateMobileFooter({ visible: checked })} />
              </div>

              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">Mobile Footer Buttons</p>
                <Button size="sm" variant="outline" onClick={addMobileFooterButton} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Footer Button
                </Button>
              </div>

              {settings.mobileFooter.buttons.map((button) => (
                <div key={button.id} className="border border-border rounded-lg p-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Label</label>
                      <Input value={button.label} onChange={(e) => updateMobileButton(button.id, { label: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Link / Value</label>
                      <Input value={button.href} onChange={(e) => updateMobileButton(button.id, { href: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Action</label>
                      <select
                        value={button.action}
                        onChange={(e) => updateMobileButton(button.id, { action: e.target.value as "link" | "tel" | "login" | "dashboard" })}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {mobileActionOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Icon</label>
                      <select
                        value={button.icon}
                        onChange={(e) => updateMobileButton(button.id, { icon: e.target.value as "home" | "courses" | "phone" | "profile" | "login" | "support" | "settings" })}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {mobileIconOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end gap-4 md:col-span-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={button.visible} onChange={(e) => updateMobileButton(button.id, { visible: e.target.checked })} className="rounded" />
                        Visible
                      </label>
                      <Button size="icon" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => removeMobileButton(button.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
