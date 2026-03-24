import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, Headphones, Mail, MapPin, MessageCircle, Phone, QrCode, Send, Clock } from "lucide-react";
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

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

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

  const quickLinks = useMemo(
    () => [
      { label: "Home", to: "/" },
      { label: "All Courses", to: "/packages" },
      { label: "Most Popular", to: "/#courses" },
      { label: "About Us", to: "/#why-choose" },
    ],
    [],
  );

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
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative bg-[#1e3a8a] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-white translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[#E74623] translate-y-1/3 -translate-x-1/4" />
        </div>
        
        <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
              <Headphones className="w-4 h-4 text-white" />
              <span className="text-xs font-semibold uppercase tracking-wider text-white/90">24/7 Support</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight">
              We&apos;re Here to <span className="text-[#E74623]">Help</span>
            </h1>
            
            <p className="mt-4 text-lg text-blue-100 max-w-xl">
              Have questions about courses, admissions, or payments? Our expert team is ready to assist you within minutes.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href={telLink || undefined}
                className="inline-flex items-center gap-2 bg-white text-[#1e3a8a] px-5 py-2.5 rounded-xl font-bold hover:bg-blue-50 transition-colors"
              >
                <Phone className="w-5 h-5" />
                {callValue}
              </a>
              <a
                href={whatsappLink || undefined}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-[#25D366] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#20BD5A] transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                WhatsApp
              </a>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 text-center">
              <Clock className="w-8 h-8 mx-auto text-[#E74623] mb-2" />
              <p className="text-2xl font-black text-white">30 min</p>
              <p className="text-sm text-blue-200">Avg Response Time</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 text-center">
              <CheckCircle className="w-8 h-8 mx-auto text-[#E74623] mb-2" />
              <p className="text-2xl font-black text-white">10K+</p>
              <p className="text-sm text-blue-200">Students Helped</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 text-center">
              <MessageCircle className="w-8 h-8 mx-auto text-[#E74623] mb-2" />
              <p className="text-2xl font-black text-white">24/7</p>
              <p className="text-sm text-blue-200">Support Available</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-6xl mx-auto px-4 py-12 -mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-[#1e3a8a] to-[#1e3a8a]/90 px-8 py-6">
                <h2 className="text-2xl font-black text-white">Send us a Message</h2>
                <p className="text-blue-100 text-sm mt-1">We typically respond within 30 minutes</p>
              </div>

              <form className="p-8" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Full Name *</label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="John Doe"
                      className="h-12 rounded-xl border-slate-200 focus:border-[#1e3a8a] focus:ring-[#1e3a8a]/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Email Address *</label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="john@example.com"
                      className="h-12 rounded-xl border-slate-200 focus:border-[#1e3a8a] focus:ring-[#1e3a8a]/20"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">Phone Number *</label>
                    <Input
                      value={form.mobile}
                      onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))}
                      placeholder="9876543210"
                      inputMode="numeric"
                      className="h-12 rounded-xl border-slate-200 focus:border-[#1e3a8a] focus:ring-[#1e3a8a]/20"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">Your Query *</label>
                    <Textarea
                      value={form.query}
                      onChange={(e) => setForm((p) => ({ ...p, query: e.target.value }))}
                      placeholder="Tell us about your query in detail..."
                      className="min-h-[140px] rounded-xl border-slate-200 focus:border-[#1e3a8a] focus:ring-[#1e3a8a]/20 resize-none"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="h-12 px-8 rounded-xl bg-[#E74623] hover:bg-[#d13a1a] text-white font-bold text-base"
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
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border border-slate-100 group"
              >
                <div className="w-12 h-12 bg-[#1e3a8a]/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#1e3a8a] transition-colors">
                  <Phone className="w-6 h-6 text-[#1e3a8a] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Call Us</h3>
                <p className="text-sm text-slate-500 mt-1">Mon-Sat, 9AM-8PM</p>
                <p className="text-[#1e3a8a] font-bold mt-2">{callValue}</p>
              </a>

              <a 
                href={whatsappLink || undefined}
                target="_blank"
                rel="noreferrer"
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border border-slate-100 group"
              >
                <div className="w-12 h-12 bg-[#25D366]/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#25D366] transition-colors">
                  <MessageCircle className="w-6 h-6 text-[#25D366] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">WhatsApp</h3>
                <p className="text-sm text-slate-500 mt-1">Quick chat, quick reply</p>
                <p className="text-[#25D366] font-bold mt-2">{whatsappValue}</p>
              </a>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info Card */}
            <div className="bg-white rounded-3xl shadow-lg p-6">
              <h3 className="text-xl font-black text-slate-900">Get in Touch</h3>
              <p className="text-sm text-slate-500 mt-1">Prefer face-to-face? Visit us!</p>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#E74623]/10 rounded-lg flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-[#E74623]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase">Phone</p>
                    <p className="font-bold text-slate-900">{callValue}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#1e3a8a]/10 rounded-lg flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-[#1e3a8a]" />
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
            <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
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
                  className="text-sm text-[#1e3a8a] font-semibold hover:underline flex items-center gap-1 mt-1"
                >
                  Open in Maps <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Bank Details Card */}
            <div className="bg-gradient-to-br from-[#1e3a8a] to-[#1e3a8a]/80 rounded-3xl shadow-lg p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <QrCode className="w-5 h-5" />
                <h3 className="text-lg font-bold">Bank Details</h3>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-28 h-28 bg-white/10 rounded-xl flex flex-col items-center justify-center shrink-0">
                  <QrCode className="w-10 h-10 text-white/80" />
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

            {/* Quick Links */}
            <div className="bg-white rounded-3xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Links</h3>
              <div className="space-y-2">
                {quickLinks.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-[#1e3a8a]/5 text-slate-700 hover:text-[#1e3a8a] font-medium transition-colors"
                  >
                    {item.label}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="bg-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-4xl font-black text-[#E74623]">15+</p>
              <p className="text-sm text-slate-500 mt-1">Years Experience</p>
            </div>
            <div>
              <p className="text-4xl font-black text-[#E74623]">50K+</p>
              <p className="text-sm text-slate-500 mt-1">Students Trained</p>
            </div>
            <div>
              <p className="text-4xl font-black text-[#E74623]">500+</p>
              <p className="text-sm text-slate-500 mt-1">Courses</p>
            </div>
            <div>
              <p className="text-4xl font-black text-[#E74623]">98%</p>
              <p className="text-sm text-slate-500 mt-1">Satisfaction Rate</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactUs;
