import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Landmark, Mail, MapPin, MessageCircle, Phone, QrCode } from "lucide-react";
import { toast } from "sonner";

import { createEnquiryLead, normalizePhoneDigits } from "@/lib/contactTools";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ContactFormState {
  name: string;
  email: string;
  mobile: string;
  query: string;
}

const INITIAL_FORM_STATE: ContactFormState = {
  name: "",
  email: "",
  mobile: "",
  query: "",
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const fieldClassName =
  "h-11 rounded-xl border border-slate-200 bg-slate-50/70 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus-visible:border-[rgb(38,72,151)] focus-visible:ring-[rgb(38,72,151)]/20";

const ContactUs = () => {
  const { settings } = useSiteSettings();
  const [form, setForm] = useState<ContactFormState>(INITIAL_FORM_STATE);

  const callValue = settings.floatingContact.call.value || settings.header.topBarPhone;
  const whatsappValue = settings.floatingContact.whatsapp.value || settings.floatingContact.call.value || settings.header.topBarPhone;
  const callDigits = normalizePhoneDigits(callValue);
  const whatsappDigits = normalizePhoneDigits(whatsappValue);
  const telLink = callDigits ? `tel:+${callDigits}` : "";
  const whatsappLink = whatsappDigits ? `https://wa.me/${whatsappDigits}` : "";
  const emailLink = `mailto:${settings.header.topBarEmail}`;

  const quickLinks = useMemo(
    () => [
      { label: "Home", to: "/" },
      { label: "All Courses", to: "/packages" },
      { label: "Most Popular", to: "/#courses" },
      { label: "About Us", to: "/#why-choose" },
    ],
    [],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      toast.error("Please enter your name.");
      return;
    }

    if (!isValidEmail(form.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (normalizePhoneDigits(form.mobile).length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!form.query.trim()) {
      toast.error("Please enter your query.");
      return;
    }

    createEnquiryLead({
      name: form.name,
      location: "Contact Us Page",
      mobile: normalizePhoneDigits(form.mobile),
    });

    toast.success("Query submitted successfully. Our team will contact you soon.");
    setForm(INITIAL_FORM_STATE);
  };

  return (
    <div className="bg-[linear-gradient(180deg,#f7f9ff_0%,#ffffff_38%)]">
      <section className="relative overflow-hidden bg-gradient-to-br from-[rgb(38,72,151)] via-[rgb(38,72,151)] to-[rgb(17,37,92)] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="pointer-events-none absolute -left-10 top-1/3 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-56 w-56 rounded-full bg-[rgb(231,70,35)]/25 blur-3xl" />

        <div className="container mx-auto px-4 py-14 md:py-20 relative z-10">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] text-white/90">
            <MessageCircle className="w-3.5 h-3.5" />
            Support Desk
          </p>

          <h1 className="mt-4 max-w-3xl text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.05]">
            Let&apos;s Solve Your Query Fast
          </h1>
          <p className="mt-4 text-sm sm:text-base text-[rgb(211,224,255)] max-w-2xl font-medium leading-relaxed">
            Reach out for course guidance, admissions, batch details, or payment support. Our team responds quickly with the right next step.
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-4xl">
            <a
              href={telLink || undefined}
              className="rounded-2xl border border-white/25 bg-white/10 backdrop-blur-sm px-4 py-3 hover:bg-white/15 transition-colors"
            >
              <div className="flex items-center gap-2 text-white">
                <Phone className="w-4 h-4" />
                <span className="text-xs uppercase tracking-[0.15em] font-bold text-white/85">Call</span>
              </div>
              <p className="mt-2 text-sm font-bold text-white break-words">{callValue}</p>
            </a>

            <a
              href={whatsappLink || undefined}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-white/25 bg-white/10 backdrop-blur-sm px-4 py-3 hover:bg-white/15 transition-colors"
            >
              <div className="flex items-center gap-2 text-white">
                <MessageCircle className="w-4 h-4" />
                <span className="text-xs uppercase tracking-[0.15em] font-bold text-white/85">WhatsApp</span>
              </div>
              <p className="mt-2 text-sm font-bold text-white break-words">{whatsappValue}</p>
            </a>

            <a
              href={emailLink}
              className="rounded-2xl border border-white/25 bg-white/10 backdrop-blur-sm px-4 py-3 hover:bg-white/15 transition-colors"
            >
              <div className="flex items-center gap-2 text-white">
                <Mail className="w-4 h-4" />
                <span className="text-xs uppercase tracking-[0.15em] font-bold text-white/85">Email</span>
              </div>
              <p className="mt-2 text-sm font-bold text-white break-all">{settings.header.topBarEmail}</p>
            </a>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 md:py-12 lg:py-14">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 lg:gap-8">
          <div className="xl:col-span-3 space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_-50px_rgba(15,23,42,0.5)] overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/80">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary/75">Contact Form</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Send Us Your Query</h2>
                <p className="text-sm text-slate-600 mt-1">Fill in the details and our support counselor will connect with you shortly.</p>
              </div>

              <form className="p-6 space-y-4" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-800">Name*</label>
                    <Input
                      value={form.name}
                      onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                      placeholder="Enter your full name"
                      className={fieldClassName}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-800">Email Id*</label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                      placeholder="you@example.com"
                      className={fieldClassName}
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-800">Mobile No*</label>
                    <Input
                      value={form.mobile}
                      onChange={(event) => setForm((previous) => ({ ...previous, mobile: event.target.value }))}
                      placeholder="Enter 10-digit mobile number"
                      inputMode="numeric"
                      className={fieldClassName}
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-800">Query*</label>
                    <Textarea
                      value={form.query}
                      onChange={(event) => setForm((previous) => ({ ...previous, query: event.target.value }))}
                      placeholder="Tell us exactly what you need help with"
                      className="min-h-[130px] rounded-xl border border-slate-200 bg-slate-50/60 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus-visible:border-[rgb(38,72,151)] focus-visible:ring-[rgb(38,72,151)]/20"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button type="submit" className="h-11 px-7 rounded-xl bg-[rgb(231,70,35)] hover:bg-[rgb(209,60,30)] text-white font-bold">
                    Submit Query
                  </Button>
                  <p className="text-xs text-slate-500 font-medium">Our typical response time is under 30 minutes during working hours.</p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3">
                  <Phone className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <p className="text-xs sm:text-sm font-semibold text-emerald-800 leading-relaxed">
                    Your details remain private and are only used by the Ednovate support team for callback and query resolution.
                  </p>
                </div>
              </form>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 sm:p-6 shadow-[0_24px_50px_-40px_rgba(15,23,42,0.45)]">
              <div className="flex flex-wrap items-center gap-2">
                <Phone className="w-4 h-4 text-primary" />
                <p className="text-xs uppercase tracking-[0.16em] font-bold text-primary/80">Need Immediate Help?</p>
              </div>
              <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">Talk To Our Support Team Now</h3>
              <p className="mt-1 text-sm text-slate-600">If your issue is urgent, use direct call or WhatsApp and get real-time guidance.</p>

              <div className="mt-4 flex flex-wrap gap-3">
                {telLink && (
                  <a href={telLink} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity">
                    <Phone className="w-4 h-4" />
                    Call Support
                  </a>
                )}
                {whatsappLink && (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Chat On WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_50px_-40px_rgba(15,23,42,0.45)]">
              <h3 className="text-xl font-black tracking-tight text-slate-900">Contact Info</h3>
              <p className="text-sm text-slate-600 mt-1">Choose your preferred channel and connect with us instantly.</p>

              <div className="mt-5 space-y-3">
                <a href={telLink || undefined} className="group flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 hover:border-primary/40 hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Phone className="w-4 h-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-slate-500">Call</p>
                    <p className="text-sm font-bold text-slate-900 break-all">{callValue}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                </a>

                <a
                  href={whatsappLink || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 hover:border-green-400 hover:bg-green-50/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-green-100 text-green-600 flex items-center justify-center"><MessageCircle className="w-4 h-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-slate-500">WhatsApp</p>
                    <p className="text-sm font-bold text-slate-900 break-all">{whatsappValue}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-green-600 transition-colors" />
                </a>

                <a href={emailLink} className="group flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 hover:border-primary/40 hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Mail className="w-4 h-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-slate-500">Email</p>
                    <p className="text-sm font-bold text-slate-900 break-all">{settings.header.topBarEmail}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                </a>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_50px_-40px_rgba(15,23,42,0.45)] overflow-hidden">
              <div className="h-48 w-full border-b border-slate-200">
                <iframe
                  title="Ednovate Location"
                  src="https://maps.google.com/maps?q=Mumbai,Maharashtra&z=12&output=embed"
                  className="w-full h-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h3 className="text-base font-black text-slate-900">Locate Us</h3>
                </div>
                <p className="text-sm text-slate-700 font-semibold">Mumbai, Maharashtra</p>
                <a
                  href="https://maps.google.com/?q=Mumbai,Maharashtra"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                >
                  Open in Google Maps
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="rounded-[28px] bg-gradient-to-br from-[rgb(38,72,151)] via-[rgb(38,72,151)] to-[rgb(17,37,92)] p-6 text-white shadow-[0_24px_60px_-30px_rgba(38,72,151,0.75)]">
              <h3 className="text-lg font-black tracking-tight">Bank Details</h3>
              <p className="text-sm text-white/80 mt-1">Use QR code for quick payment and share confirmation on WhatsApp.</p>

              <div className="mt-4 flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-32 h-32 rounded-xl border border-white/30 bg-white/10 flex flex-col items-center justify-center text-center px-2 backdrop-blur-sm">
                  <QrCode className="w-9 h-9 text-white" />
                  <p className="text-[11px] font-bold text-white mt-2">Scan To Pay</p>
                </div>

                <div className="space-y-1.5 text-sm text-white/95">
                  <p><span className="font-bold">Account Name:</span> Ednovate Learning Pvt. Ltd.</p>
                  <p><span className="font-bold">Bank Name:</span> Update Your Bank Name</p>
                  <p><span className="font-bold">Account Number:</span> XXXX XXXX XXXX</p>
                  <p><span className="font-bold">IFSC Code:</span> XXXXX000000</p>
                  <p><span className="font-bold">Branch:</span> Mumbai</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_50px_-40px_rgba(15,23,42,0.45)]">
              <div className="flex items-center gap-2 mb-3">
                <Landmark className="w-4 h-4 text-primary" />
                <h3 className="text-base font-black text-slate-900">Additional Links</h3>
              </div>
              <div className="space-y-2.5">
                {quickLinks.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="group flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:border-primary/30 transition-colors"
                  >
                    {item.label}
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactUs;