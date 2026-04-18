import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle, Mail, MapPin, PhoneCall, QrCode, Send } from "lucide-react";
import { toast } from "sonner";

import { normalizePhoneDigits } from "@/lib/contactTools";
import { adminApi } from "@/services/adminApi";
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

const BRAND_BLUE = "rgb(38,71,150)";
const BRAND_ORANGE = "#e74723";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
    <path d="M12.04 2.003a9.93 9.93 0 0 0-8.46 15.13L2 22l5.03-1.54A9.93 9.93 0 1 0 12.04 2.003Zm0 18.06a8.03 8.03 0 0 1-4.1-1.12l-.29-.17-2.98.91.92-2.9-.19-.3a8.03 8.03 0 1 1 6.64 3.58Zm4.62-6.5c-.25-.12-1.48-.73-1.7-.81-.23-.08-.39-.12-.55.12-.16.25-.64.8-.78.97-.14.16-.28.18-.53.06-.25-.13-1.06-.39-2.01-1.24-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.01-.39.11-.52.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.47-.4-.4-.55-.41h-.47c-.16 0-.42.06-.63.31-.21.25-.8.77-.8 1.87 0 1.1.81 2.16.92 2.31.11.16 1.58 2.41 3.83 3.38.54.23.96.37 1.3.48.54.17 1.03.15 1.41.09.43-.06 1.32-.54 1.51-1.07.19-.53.19-.99.13-1.08-.05-.09-.21-.15-.46-.27Z" />
  </svg>
);

const ContactUs = () => {
  const { settings } = useSiteSettings();
  const [form, setForm] = useState<ContactFormState>(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const callValue = settings.floatingContact.call.value || settings.header.topBarPhone;
  const whatsappValue = settings.floatingContact.whatsapp.value || settings.floatingContact.call.value || settings.header.topBarPhone;
  const callDigits = normalizePhoneDigits(callValue);
  const whatsappDigits = normalizePhoneDigits(whatsappValue);
  const telLink = callDigits ? `tel:+${callDigits}` : "";
  const whatsappLink = whatsappDigits ? `https://wa.me/${whatsappDigits}` : "";
  const emailLink = `mailto:${settings.header.topBarEmail}`;

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

            {/* Quick Contact Cards */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a 
                href={telLink || undefined}
                className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all"
                style={{ borderColor: "rgba(38,71,150,0.28)" }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg transition-colors" style={{ backgroundColor: "rgba(38,71,150,0.12)" }}>
                  <PhoneCall className="h-6 w-6" style={{ color: BRAND_BLUE }} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Call Us</h3>
                <p className="text-sm text-slate-500 mt-1">Mon-Sat, 9AM-8PM</p>
                <p className="mt-2 font-bold text-slate-800">{callValue}</p>
              </a>

              <a 
                href={whatsappLink || undefined}
                target="_blank"
                rel="noreferrer"
                className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-[#25D366]/30"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#25D366]/10 transition-colors group-hover:bg-[#25D366]">
                  <WhatsAppIcon className="h-6 w-6 text-[#25D366] transition-colors group-hover:text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">WhatsApp</h3>
                <p className="text-sm text-slate-500 mt-1">Quick chat, quick reply</p>
                <p className="mt-2 font-bold text-slate-800">{whatsappValue}</p>
              </a>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold" style={{ color: BRAND_BLUE }}>Get in Touch</h3>
              <p className="text-sm text-slate-500 mt-1">Prefer face-to-face? Visit us!</p>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(231,71,35,0.12)" }}>
                    <PhoneCall className="w-5 h-5" style={{ color: BRAND_ORANGE }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase">Phone</p>
                    <p className="font-bold text-slate-900">{callValue}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(38,71,150,0.12)" }}>
                    <Mail className="w-5 h-5" style={{ color: BRAND_BLUE }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase">Email</p>
                    <p className="font-bold text-slate-900">{settings.header.topBarEmail}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase">Address</p>
                    <p className="font-bold text-slate-900">Mumbai, Maharashtra</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Card */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-48">
                <iframe
                  title="Ednovate Location"
                  src="https://maps.google.com/maps?q=Mumbai,Maharashtra&z=12&output=embed"
                  className="w-full h-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <div className="p-5">
                <h4 className="font-bold text-slate-900">Find Us</h4>
                <a
                  href="https://maps.google.com/?q=Mumbai,Maharashtra"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-800 hover:underline"
                >
                  Open in Maps <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Bank Details Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-slate-800">
              <div className="flex items-center gap-2 mb-4" style={{ color: BRAND_BLUE }}>
                <QrCode className="w-5 h-5" />
                <h3 className="text-lg font-bold">Bank Details</h3>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="h-28 w-28 shrink-0 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center">
                  <QrCode className="w-10 h-10 text-slate-500" />
                  <p className="text-xs font-semibold mt-2">Scan to Pay</p>
                </div>
                
                <div className="space-y-2 text-sm">
                  <p><span className="font-bold">A/C Name:</span> Ednovate Learning Pvt. Ltd.</p>
                  <p><span className="font-bold">Bank:</span> Update Your Bank</p>
                  <p><span className="font-bold">A/C No:</span> XXXX XXXX XXXX</p>
                  <p><span className="font-bold">IFSC:</span> XXXXX000000</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactUs;
