import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Facebook, Instagram, Youtube, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { resolveApiUrl, resolveUploadAssetUrl } from "@/lib/runtimeUrls";

const normalizeLogoUrl = (url?: string) => {
  return resolveUploadAssetUrl(url, "/ednovate-logo.svg");
};

const Footer = () => {
  const { settings } = useSiteSettings();
  const logoUrl = normalizeLogoUrl(settings.logo);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

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
                  className="h-12 w-auto drop-shadow-md"
                  onError={(event) => {
                    const target = event.currentTarget;
                    if (target.src.endsWith("/ednovate-logo.svg")) return;
                    target.src = "/ednovate-logo.svg";
                  }}
                />
              </div>
              <p className="text-sm text-white leading-relaxed max-w-sm mb-6">
                India&apos;s trusted online learning platform for CA, CS, CMA and professional courses. Structured programs, expert mentorship, and outcomes that matter.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 max-w-sm">
                <Input
                  placeholder="Your email"
                  className="h-10 text-sm bg-white/10 border-white/20 text-white placeholder:text-white rounded-xl"
                />
                <Button size="sm" className="h-10 px-4 w-full sm:w-auto bg-[rgb(231,70,35)] hover:bg-[rgb(209,60,30)] text-white text-xs font-semibold rounded-xl">
                  Subscribe
                </Button>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-[0.14em] mb-4 text-white">Quick Links</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Home", href: "/" },
                  { label: "All Courses", href: "/packages" },
                  { label: "New Releases", href: "/#courses" },
                  { label: "About Us", href: "/#why-choose" },
                  { label: "Contact Us", href: "/contact-us" },
                ].map((link) => (
                  <li key={link.label}>
                    <Link to={link.href} className="text-sm text-white hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Courses */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-[0.14em] mb-4 text-white">Courses</h4>
              <ul className="space-y-2.5">
                {["CA Foundation", "CA Inter", "CA Final", "CS Executive", "CS Professional", "CMA / CFA"].map((course) => (
                  <li key={course}>
                    <Link to="/packages" className="text-sm text-white hover:text-white transition-colors">
                      {course}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-[0.14em] mb-4 text-white">Contact</h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-2.5 text-sm text-white">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
                  Mumbai, Maharashtra
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
              <div className="flex gap-2.5 mt-5">
                {[Facebook, Instagram, Youtube, Twitter].map((Icon, i) => (
                  <a key={i} href="#" className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center hover:bg-[rgb(231,70,35)] hover:text-white hover:border-[rgb(231,70,35)] transition-all">
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center text-xs text-white gap-2">
            <span>© 2026 Ednovate. All rights reserved.</span>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Refunds</a>
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
          className={`block h-2.5 w-2.5 rounded-full shadow-[0_0_10px_2px_rgba(0,0,0,0.2)] ${
            isBackendConnected ? "bg-emerald-400 shadow-emerald-400/90" : "bg-red-500 shadow-red-500/90"
          }`}
        />
      </div>
    </footer>
  );
};

export default Footer;
