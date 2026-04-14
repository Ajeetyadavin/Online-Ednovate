import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Facebook, Instagram, Youtube, Twitter, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { usePlatformData } from "@/context/PlatformDataContext";
import { resolveApiUrl, resolveUploadAssetUrl } from "@/lib/runtimeUrls";

const normalizeLogoUrl = (url?: string) => {
  return resolveUploadAssetUrl(url, "/ednovate-logo.png");
};

const Footer = () => {
  const { settings } = useSiteSettings();
  const { categories } = usePlatformData();
  const logoUrl = normalizeLogoUrl(settings.logo);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [brokenSocialIcons, setBrokenSocialIcons] = useState<Record<string, boolean>>({});

  const headerSettings = settings.header;
  const socialLinks = settings.socialLinks;
  const socialIconUrls = settings.socialIconUrls;
  const footerSettings = settings.footer;

  // Dynamic Quick Links from header navLinks (visible only)
  const quickLinks = headerSettings.navLinks.filter((l) => l.visible);

  // Footer Courses: top-level visible categories (CA, CS, FYJC, SYJC, CMA, CFA, ACCA)
  const footerCategories = categories
    .filter((c) => c.isVisible && !c.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Social icons config
  const socialIcons: Array<{ key: string; url: string; label: string; icon: ReactNode; iconUrl: string }> = [
    {
      key: "facebook",
      url: socialLinks.facebook,
      label: "Facebook",
      icon: <Facebook className="w-4 h-4" />,
      iconUrl: socialIconUrls.facebook,
    },
    {
      key: "instagram",
      url: socialLinks.instagram,
      label: "Instagram",
      icon: <Instagram className="w-4 h-4" />,
      iconUrl: socialIconUrls.instagram,
    },
    {
      key: "youtube",
      url: socialLinks.youtube,
      label: "YouTube",
      icon: <Youtube className="w-4 h-4" />,
      iconUrl: socialIconUrls.youtube,
    },
    {
      key: "twitter",
      url: socialLinks.twitter,
      label: "Twitter / X",
      icon: <Twitter className="w-4 h-4" />,
      iconUrl: socialIconUrls.twitter,
    },
    {
      key: "linkedin",
      url: socialLinks.linkedin,
      label: "LinkedIn",
      icon: <Linkedin className="w-4 h-4" />,
      iconUrl: socialIconUrls.linkedin,
    },
    {
      key: "whatsapp",
      url: socialLinks.whatsapp,
      label: "WhatsApp",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
        </svg>
      ),
      iconUrl: socialIconUrls.whatsapp,
    },
  ].filter((s) => s.url.trim() !== "" || s.iconUrl.trim() !== "");

  useEffect(() => {
    let mounted = true;

    const checkHealth = async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(resolveApiUrl("/api/health"), {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!mounted) return;

        if (!response.ok) {
          setIsBackendConnected(false);
          return;
        }

        const payload = await response.json().catch(() => null);
        setIsBackendConnected(payload?.status === "ok");
      } catch {
        if (mounted) setIsBackendConnected(false);
      } finally {
        window.clearTimeout(timeout);
      }
    };

    checkHealth();
    const intervalId = window.setInterval(checkHealth, 30000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <footer id="footer" className="relative mt-6 md:mt-8">
      <div className="bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: "20px 20px"
        }} />
        <div className="absolute -top-16 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 py-10 md:py-12 relative z-10">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-8 md:gap-10">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-2 lg:col-span-2">
              <div className="mb-5">
                <img
                  src={logoUrl}
                  alt="Ednovate"
                  className="h-20 md:h-24 w-auto"
                  onError={(event) => {
                    const target = event.currentTarget;
                    if (target.src.endsWith("/ednovate-logo.png")) return;
                    target.src = "/ednovate-logo.png";
                  }}
                />
              </div>
              <p className="text-[15px] text-white leading-relaxed max-w-sm mb-6">
                {footerSettings.tagline}
              </p>
              {footerSettings.showSubscribeForm && (
                <div className="flex flex-col sm:flex-row gap-2 max-w-sm">
                  <Input
                    placeholder="Your email"
                    className="h-10 text-sm bg-white/10 text-white placeholder:text-white rounded-xl border-0 outline-none"
                  />
                  <Button size="sm" className="h-10 px-4 w-full sm:w-auto bg-[rgb(231,70,35)] hover:bg-[rgb(209,60,30)] text-white text-xs font-semibold rounded-xl">
                    Subscribe
                  </Button>
                </div>
              )}
            </div>

            {/* Quick Links */}
            {footerSettings.showQuickLinksSection && (
              <div>
                <h4 className="font-bold text-xs uppercase tracking-[0.14em] mb-4 text-white">Quick Links</h4>
                <ul className="space-y-2.5">
                  {quickLinks.length > 0 ? quickLinks.map((link) => (
                    <li key={link.id}>
                      <Link
                        to={link.href}
                        className="text-sm text-white hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  )) : (
                    <li>
                      <Link to="/" className="text-sm text-white hover:text-white transition-colors">Home</Link>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Courses */}
            {footerSettings.showCoursesSection && (
              <div>
                <h4 className="font-bold text-xs uppercase tracking-[0.14em] mb-4 text-white">Courses</h4>
                <ul className="space-y-2.5">
                  {(footerCategories.length > 0 ? footerCategories : [
                    { id: "ca", name: "CA" },
                    { id: "cs", name: "CS" },
                    { id: "fyjc", name: "FYJC" },
                    { id: "syjc", name: "SYJC" },
                    { id: "cma", name: "CMA" },
                    { id: "cfa", name: "CFA" },
                    { id: "acca", name: "ACCA" },
                  ]).map((cat) => (
                    <li key={cat.id}>
                      <Link to={`/packages?category=${cat.id}`} className="text-sm text-white hover:text-white transition-colors">
                        {cat.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contact */}
            <div className="lg:-ml-4">
              <h4 className="font-bold text-xs uppercase tracking-[0.14em] mb-4 text-white">Contact</h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-2.5 text-sm text-white">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
                  {footerSettings.address}
                </li>
                <li className="flex items-center gap-2.5 text-sm text-white">
                  <Phone className="w-4 h-4 flex-shrink-0 text-accent" />
                  {settings.header.topBarPhone}
                </li>
                <li className="flex items-center gap-2.5 text-sm text-white break-all">
                  <Mail className="w-4 h-4 flex-shrink-0 text-accent" />
                  {settings.header.topBarEmail}
                </li>
              </ul>
              <div className="flex gap-3 mt-5">
                {socialIcons.length > 0 ? socialIcons.map((s) => {
                  const hasLink = s.url.trim() !== "";
                  const showCustomImage = s.iconUrl.trim() !== "" && !brokenSocialIcons[s.key];

                  const content = showCustomImage ? (
                    <img
                      src={resolveUploadAssetUrl(s.iconUrl, s.iconUrl)}
                      alt={s.label}
                      className="w-7 h-7 object-contain"
                      onError={() => setBrokenSocialIcons((prev) => ({ ...prev, [s.key]: true }))}
                    />
                  ) : <span className="w-7 h-7 flex items-center justify-center text-white">{s.icon}</span>;

                  if (!hasLink) {
                    return (
                      <span key={s.key} aria-label={s.label} className="opacity-80">
                        {content}
                      </span>
                    );
                  }

                  return (
                    <a
                      key={s.key}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={s.label}
                      className="opacity-80 hover:opacity-100 transition-opacity"
                    >
                      {content}
                    </a>
                  );
                }) : [Facebook, Instagram, Youtube, Twitter].map((Icon, i) => (
                  <span key={i} className="w-7 h-7 flex items-center justify-center text-white opacity-40">
                    <Icon className="w-6 h-6" />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center text-xs text-white gap-2">
            <span>{footerSettings.copyrightText}</span>
            <div className="flex gap-4">
              <a href={footerSettings.privacyUrl} className="hover:text-white transition-colors">Privacy</a>
              <a href={footerSettings.termsUrl} className="hover:text-white transition-colors">Terms</a>
              <a href={footerSettings.refundsUrl} className="hover:text-white transition-colors">Refunds</a>
            </div>
          </div>
        </div>
      </div>
      <div
        className="absolute bottom-2 right-2"
        title={isBackendConnected ? "Backend connected" : "Backend disconnected"}
        aria-label={isBackendConnected ? "Backend connected" : "Backend disconnected"}
      >
        <span
          className={`block h-2.5 w-2.5 rounded-full ${
            isBackendConnected ? "bg-emerald-400" : "bg-red-500"
          }`}
        />
      </div>
    </footer>
  );
};

export default Footer;
