import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Mail, MessageCircle, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { usePlatformData } from "@/context/PlatformDataContext";
import { COMPANY_CONTACT, toIndiaDialDigits } from "@/lib/companyContact";
import { resolveApiUrl, resolveUploadAssetUrl } from "@/lib/runtimeUrls";
import { BrandSocialIcon } from "@/components/BrandSocialIcon";

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
      icon: <BrandSocialIcon brand="facebook" className="h-10 w-10" />,
      iconUrl: socialIconUrls.facebook,
    },
    {
      key: "instagram",
      url: socialLinks.instagram,
      label: "Instagram",
      icon: <BrandSocialIcon brand="instagram" className="h-10 w-10" />,
      iconUrl: socialIconUrls.instagram,
    },
    {
      key: "youtube",
      url: socialLinks.youtube,
      label: "YouTube",
      icon: <BrandSocialIcon brand="youtube" className="h-10 w-10" />,
      iconUrl: socialIconUrls.youtube,
    },
    {
      key: "twitter",
      url: socialLinks.twitter,
      label: "Twitter / X",
      icon: <BrandSocialIcon brand="twitter" className="h-10 w-10" />,
      iconUrl: socialIconUrls.twitter,
    },
    {
      key: "linkedin",
      url: socialLinks.linkedin,
      label: "LinkedIn",
      icon: <BrandSocialIcon brand="linkedin" className="h-10 w-10" />,
      iconUrl: socialIconUrls.linkedin,
    },
    {
      key: "whatsapp",
      url: socialLinks.whatsapp,
      label: "WhatsApp",
      icon: <BrandSocialIcon brand="whatsapp" className="h-10 w-10" />,
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
                  <span className="leading-relaxed">
                    {COMPANY_CONTACT.addressLines.map((line) => (
                      <span key={line} className="block">{line}</span>
                    ))}
                  </span>
                </li>
                <li className="flex items-center gap-2.5 text-sm text-white">
                  <Phone className="w-4 h-4 flex-shrink-0 text-accent" />
                  <a href={`tel:+${toIndiaDialDigits(COMPANY_CONTACT.callPhone)}`} className="hover:text-white">
                    {COMPANY_CONTACT.callPhone}
                  </a>
                </li>
                <li className="flex items-center gap-2.5 text-sm text-white">
                  <MessageCircle className="w-4 h-4 flex-shrink-0 text-accent" />
                  <a
                    href={`https://wa.me/${toIndiaDialDigits(COMPANY_CONTACT.whatsappPhone)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white"
                  >
                    {COMPANY_CONTACT.whatsappPhone}
                  </a>
                </li>
                <li className="flex items-center gap-2.5 text-sm text-white break-all">
                  <Mail className="w-4 h-4 flex-shrink-0 text-accent" />
                  <a href={`mailto:${COMPANY_CONTACT.email}`} className="hover:text-white">
                    {COMPANY_CONTACT.email}
                  </a>
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
                  ) : <span className="flex h-10 w-10 items-center justify-center">{s.icon}</span>;

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
                      className="opacity-95 transition-opacity hover:opacity-100"
                    >
                      {content}
                    </a>
                  );
                }) : (["facebook", "instagram", "youtube", "linkedin", "whatsapp"] as const).map((brand) => (
                  <span key={brand} className="flex h-10 w-10 items-center justify-center opacity-95">
                    <BrandSocialIcon brand={brand} className="h-10 w-10" />
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
