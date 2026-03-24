import { useState } from "react";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { getReadableTextColor, normalizePhoneDigits, sanitizeHexColor } from "@/lib/contactTools";
import { MessageCircle, Phone, ChevronLeft, ChevronRight } from "lucide-react";
import EnquiryModal from "./EnquiryModal";

const FloatingContact = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const { settings } = useSiteSettings();

  const { floatingContact } = settings;

  const toggleColor = sanitizeHexColor(floatingContact.toggleColor, settings.colors.primary);
  const enquiryColor = sanitizeHexColor(floatingContact.enquiry.color, "#FFFFFF");
  const enquiryTextColor = getReadableTextColor(enquiryColor);
  const callDigits = normalizePhoneDigits(floatingContact.call.value || settings.header.topBarPhone);
  const whatsappDigits = normalizePhoneDigits(floatingContact.whatsapp.value || floatingContact.call.value || settings.header.topBarPhone);
  const telLink = callDigits ? `tel:+${callDigits}` : "#";
  const waLink = whatsappDigits ? `https://wa.me/${whatsappDigits}` : "#";
  const callColor = sanitizeHexColor(floatingContact.call.color, "#2563EB");
  const whatsappColor = sanitizeHexColor(floatingContact.whatsapp.color, "#22C55E");

  if (!floatingContact.visible) {
    return null;
  }

  return (
    <>
      <div className="fixed left-0 top-1/2 -translate-y-1/2 z-50 flex items-center gap-0 p-0 m-0">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? "Open contact options" : "Hide contact options"}
          style={{ backgroundColor: toggleColor, color: getReadableTextColor(toggleColor) }}
          className="h-9 w-6 rounded-r-md rounded-l-none shadow-md flex items-center justify-center shrink-0"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        <div
          className={`flex flex-col items-start gap-3 transition-all duration-300 ease-out ${
            collapsed ? "max-w-0 opacity-0 overflow-hidden pointer-events-none" : "max-w-[130px] opacity-100"
          }`}
        >
          {floatingContact.enquiry.visible && (
            <button
              type="button"
              onClick={() => setEnquiryOpen(true)}
              style={{ backgroundColor: enquiryColor, color: enquiryTextColor }}
              className="h-36 w-12 rounded-r-xl shadow-lg text-xs font-extrabold tracking-wide [writing-mode:vertical-rl]"
            >
              {String(floatingContact.enquiry.label || "Enquire Now").toUpperCase()}
            </button>
          )}

          {floatingContact.call.visible && callDigits && (
            <a
              href={telLink}
              style={{ backgroundColor: callColor, color: getReadableTextColor(callColor) }}
              className="w-11 h-11 rounded-full shadow-lg flex items-center justify-center hover:opacity-90"
              aria-label={floatingContact.call.label || "Call"}
            >
              <Phone className="w-4 h-4" />
            </a>
          )}

          {floatingContact.whatsapp.visible && whatsappDigits && (
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              style={{ backgroundColor: whatsappColor, color: getReadableTextColor(whatsappColor) }}
              className="w-11 h-11 rounded-full shadow-lg flex items-center justify-center hover:opacity-90"
              aria-label={floatingContact.whatsapp.label || "WhatsApp"}
            >
              <MessageCircle className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      <EnquiryModal open={enquiryOpen} onOpenChange={setEnquiryOpen} />
    </>
  );
};

export default FloatingContact;
