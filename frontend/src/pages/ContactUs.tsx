import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle, Mail, MapPin, PhoneCall, QrCode, Send } from "lucide-react";
import { toast } from "sonner";

import { normalizePhoneDigits } from "@/lib/contactTools";
import { COMPANY_ADDRESS_TEXT, COMPANY_CONTACT, toIndiaDialDigits } from "@/lib/companyContact";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { adminApi } from "@/services/adminApi";
import { BrandSocialIcon } from "@/components/BrandSocialIcon";
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

const BRAND_BLUE = "rgb(38,71,150)";
const BRAND_ORANGE = "#e74723";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const ContactUs = () => {
  const { settings } = useSiteSettings();
  const [form, setForm] = useState<ContactFormState>(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const callValue = COMPANY_CONTACT.callPhone;
  const whatsappValue = COMPANY_CONTACT.whatsappPhone;
  const whatsappLink = `https://wa.me/${toIndiaDialDigits(whatsappValue)}`;
  const emailLink = `mailto:${COMPANY_CONTACT.email}`;
  const mapsQuery = encodeURIComponent(COMPANY_ADDRESS_TEXT);
  const socialIconLinks = [
    { brand: "facebook" as const, label: "Facebook", url: settings.socialLinks.facebook },
    { brand: "instagram" as const, label: "Instagram", url: settings.socialLinks.instagram },
    { brand: "youtube" as const, label: "YouTube", url: settings.socialLinks.youtube },
    { brand: "linkedin" as const, label: "LinkedIn", url: settings.socialLinks.linkedin },
    { brand: "whatsapp" as const, label: "WhatsApp", url: settings.socialLinks.whatsapp || whatsappLink },
  ];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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

    setIsSubmitting(true);

    try {
      await adminApi.submitPublicEnquiryLead({
        source: "contact_us",
        name: form.name,
        address: "Contact Us Page",
        mobile: normalizePhoneDigits(form.mobile),
        email: form.email,
        message: form.query,
        streams: [],
        extraData: {
          formType: "contact_us",
        },
      });

      toast.success("Query submitted successfully. Our team will contact you soon.");
      setForm(INITIAL_FORM_STATE);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit your query");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-slate-900 [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Helvetica_Neue',Arial,sans-serif] [&_h1]:[font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Arial,sans-serif] [&_h2]:[font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Arial,sans-serif] [&_h3]:[font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Arial,sans-serif]">
      {/* Main Content */}
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-900 px-6 py-5 sm:px-8">
                <h2 className="text-2xl font-bold text-white">Send us a Message</h2>
                <p className="mt-1 text-sm text-slate-300">We typically respond as soon as possible</p>
              </div>

              <form className="p-5 sm:p-8" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Full Name *</label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className="h-12 rounded-lg border-slate-300"
                      style={{ borderColor: "#cbd5e1" }}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Email Address *</label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      className="h-12 rounded-lg border-slate-300"
                      style={{ borderColor: "#cbd5e1" }}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">Phone Number *</label>
                    <Input
                      value={form.mobile}
                      onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))}
                      inputMode="numeric"
                      className="h-12 rounded-lg border-slate-300"
                      style={{ borderColor: "#cbd5e1" }}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">Your Query *</label>
                    <Textarea
                      value={form.query}
                      onChange={(e) => setForm((p) => ({ ...p, query: e.target.value }))}
                      className="min-h-[140px] resize-none rounded-lg border-slate-300"
                      style={{ borderColor: "#cbd5e1" }}
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="h-12 rounded-lg px-8 text-base font-semibold text-white"
                    style={{ backgroundColor: BRAND_ORANGE }}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Send className="w-5 h-5" />
                        Submit Query
                      </span>
                    )}
                  </Button>
                  
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Your data is secure with us</span>
                  </div>
                </div>
              </form>
            </div>

            {/* Payment Details */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-slate-800">
              <div className="mb-4 flex items-center gap-2" style={{ color: BRAND_BLUE }}>
                <QrCode className="h-5 w-5" />
                <h3 className="text-lg font-bold">Bank Details</h3>
              </div>

              <div className="grid gap-5 md:grid-cols-[170px_1fr] md:items-start">
                <div className="mx-auto w-full max-w-[170px] rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:mx-0">
                  <img
                    src="/payment-qr.jpg"
                    alt="Ednovate payment QR code"
                    className="h-36 w-full rounded-lg object-contain"
                    loading="lazy"
                  />
                  <p className="mt-2 text-center text-xs font-semibold text-slate-600">Scan &amp; Pay</p>
                </div>

                <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[120px_1fr]">
                  <dt className="font-bold text-slate-700">Bank Name:</dt>
                  <dd className="text-slate-900">HDFC Bank Ltd</dd>
                  <dt className="font-bold text-slate-700">A/C Name:</dt>
                  <dd className="text-slate-900">Ednovate Edutech Private Limited</dd>
                  <dt className="font-bold text-slate-700">A/C No.:</dt>
                  <dd className="font-semibold text-slate-900">50200066371383</dd>
                  <dt className="font-bold text-slate-700">IFSC Code:</dt>
                  <dd className="text-slate-900">HDFC0000079</dd>
                  <dt className="font-bold text-slate-700">Branch Name:</dt>
                  <dd className="text-slate-900">Sana Building, Linkid Road, Santacruz (West) Mumbai-400054</dd>
                  <dt className="font-bold text-slate-700">TID:</dt>
                  <dd className="text-slate-900">62459033</dd>
                </dl>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold" style={{ color: BRAND_BLUE }}>Get in Touch</h3>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(231,71,35,0.12)" }}>
                    <PhoneCall className="w-5 h-5" style={{ color: BRAND_ORANGE }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase">Call</p>
                    <p className="font-bold text-slate-900">{callValue}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                    <BrandSocialIcon brand="whatsapp" className="h-10 w-10" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase">WhatsApp</p>
                    <p className="font-bold text-slate-900">{whatsappValue}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(38,71,150,0.12)" }}>
                    <Mail className="w-5 h-5" style={{ color: BRAND_BLUE }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase">Email</p>
                    <a href={emailLink} className="font-bold text-slate-900 hover:underline">{COMPANY_CONTACT.email}</a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase">Address</p>
                    <p className="font-bold leading-relaxed text-slate-900">
                      {COMPANY_CONTACT.addressLines.map((line) => (
                        <span key={line} className="block">{line}</span>
                      ))}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Follow Us</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {socialIconLinks.map((item) => {
                    const icon = <BrandSocialIcon brand={item.brand} className="h-10 w-10" />;

                    if (!item.url) {
                      return <span key={item.brand} aria-label={item.label}>{icon}</span>;
                    }

                    return (
                      <a key={item.brand} href={item.url} target="_blank" rel="noreferrer noopener" aria-label={item.label} className="transition-opacity hover:opacity-85">
                        {icon}
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Map Card */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-48">
                <iframe
                  title="Ednovate Location"
                  src={`https://maps.google.com/maps?q=${mapsQuery}&z=16&output=embed`}
                  className="w-full h-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <div className="p-5">
                <h4 className="font-bold text-slate-900">Find Us</h4>
                <a
                  href={`https://maps.google.com/?q=${mapsQuery}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-800 hover:underline"
                >
                  Open in Maps <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactUs;
