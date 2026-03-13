import { FormEvent, useState } from "react";
import { MapPin, MessageCircle, Phone, User } from "lucide-react";
import { toast } from "sonner";

import { createEnquiryLead } from "@/lib/contactTools";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EnquiryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EnquiryFormState {
  name: string;
  location: string;
  mobile: string;
}

const INITIAL_FORM_STATE: EnquiryFormState = {
  name: "",
  location: "",
  mobile: "",
};

const normalizeMobile = (value: string) => value.replace(/\D/g, "").slice(-10);

const fieldClassName =
  "h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 text-sm font-medium text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus-visible:border-[rgb(38,72,151)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(38,72,151)]/20";

const EnquiryModal = ({ open, onOpenChange }: EnquiryModalProps) => {
  const [form, setForm] = useState<EnquiryFormState>(INITIAL_FORM_STATE);

  const resetForm = () => {
    setForm(INITIAL_FORM_STATE);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }

    onOpenChange(nextOpen);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      toast.error("Please enter your name.");
      return;
    }

    if (!form.location.trim()) {
      toast.error("Please enter your location.");
      return;
    }

    if (form.mobile.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    createEnquiryLead({
      name: form.name,
      location: form.location,
      mobile: form.mobile,
    });

    toast.success("Enquiry submitted successfully. Our team will contact you soon.");
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[96vw] max-w-[420px] overflow-hidden rounded-[28px] border-0 p-0 shadow-[0_28px_80px_-24px_rgba(15,23,42,0.45)] [&>button]:text-primary-foreground [&>button]:opacity-90">
        <div className="relative overflow-hidden bg-gradient-to-br from-[rgb(38,72,151)] via-[rgb(38,72,151)] to-[rgb(17,37,92)] px-6 pb-6 pt-7 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 left-[-18px] h-28 w-28 rounded-full bg-white/10" />

          <DialogHeader className="relative text-left">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 backdrop-blur-sm">
              <MessageCircle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-2xl font-extrabold tracking-tight text-white">
              Enquire Now
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm font-medium text-[rgb(211,224,255)]">
              Share your details and our team will contact you shortly.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form className="space-y-4 bg-white px-6 py-6" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="enquiry-name" className="text-sm font-semibold text-slate-700">
              Full Name
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="enquiry-name"
                value={form.name}
                onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                placeholder="Enter your full name"
                autoComplete="name"
                className={fieldClassName}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="enquiry-location" className="text-sm font-semibold text-slate-700">
              Location
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="enquiry-location"
                value={form.location}
                onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))}
                placeholder="City or area"
                autoComplete="address-level2"
                className={fieldClassName}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="enquiry-mobile" className="text-sm font-semibold text-slate-700">
              Mobile Number
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="enquiry-mobile"
                value={form.mobile}
                onChange={(event) => setForm((previous) => ({ ...previous, mobile: normalizeMobile(event.target.value) }))}
                placeholder="Enter 10-digit mobile number"
                autoComplete="tel"
                inputMode="numeric"
                className={fieldClassName}
              />
            </div>
          </div>

          <Button type="submit" className="h-11 w-full rounded-xl bg-[rgb(38,72,151)] font-bold text-white hover:bg-[rgb(29,60,129)]">
            Submit Enquiry
          </Button>

          <p className="text-center text-xs font-medium text-slate-500">
            By submitting, you agree to receive a callback from the Ednovate team.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EnquiryModal;