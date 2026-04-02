import { FormEvent, useEffect, useMemo, useState } from "react";
import { MapPin, MessageCircle, Phone, User } from "lucide-react";
import { toast } from "sonner";

import { adminApi, type LeadCustomFieldSetting, type LeadFormFieldSetting, type LeadFormSettings } from "@/services/adminApi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface EnquiryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EnquiryFormState {
  name: string;
  address: string;
  mobile: string;
  email: string;
  message: string;
  streams: string[];
  customFieldValues: Record<string, string>;
}

const INITIAL_FORM_STATE: EnquiryFormState = {
  name: "",
  address: "",
  mobile: "",
  email: "",
  message: "",
  streams: [],
  customFieldValues: {},
};

const normalizeMobile = (value: string) => value.replace(/\D/g, "").slice(-10);

const DEFAULT_SETTINGS: LeadFormSettings = {
  fields: [
    { key: "name", label: "Full Name", type: "text", enabled: true, mandatory: true },
    { key: "address", label: "Address", type: "text", enabled: true, mandatory: true },
    { key: "mobile", label: "Mobile Number", type: "phone", enabled: true, mandatory: true },
    { key: "email", label: "Email Address", type: "email", enabled: true, mandatory: false },
    { key: "message", label: "Message", type: "textarea", enabled: true, mandatory: false },
  ],
  stream: {
    enabled: true,
    label: "Interested Stream",
    mandatory: false,
    allowMultiple: true,
    options: ["Science", "Commerce", "Arts"],
  },
  customFields: [],
};

const fieldClassName =
  "h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 text-sm font-medium text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus-visible:border-[rgb(38,72,151)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(38,72,151)]/20";

const EnquiryModal = ({ open, onOpenChange }: EnquiryModalProps) => {
  const [form, setForm] = useState<EnquiryFormState>(INITIAL_FORM_STATE);
  const [settings, setSettings] = useState<LeadFormSettings | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  const hasLoadedSettings = settings !== null;
  const resolvedSettings = settings || DEFAULT_SETTINGS;

  const fieldsByKey = useMemo(
    () => Object.fromEntries(resolvedSettings.fields.map((field) => [field.key, field])) as Record<string, LeadFormFieldSetting>,
    [resolvedSettings.fields],
  );

  const enabledCustomFields = useMemo(
    () => (resolvedSettings.customFields || []).filter((field) => field.enabled !== false),
    [resolvedSettings.customFields],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    let isMounted = true;
    setIsLoadingSettings(true);
    setSettings(null);
    adminApi
      .getPublicLeadFormSettings()
      .then((result) => {
        if (!isMounted) return;
        setSettings(result.settings || DEFAULT_SETTINGS);
      })
      .catch(() => {
        if (!isMounted) return;
        setSettings(DEFAULT_SETTINGS);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingSettings(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [open]);

  const resetForm = () => {
    setForm(INITIAL_FORM_STATE);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }

    onOpenChange(nextOpen);
  };

  const toggleStream = (option: string) => {
    setForm((previous) => {
      const exists = previous.streams.includes(option);
      if (resolvedSettings.stream.allowMultiple) {
        return {
          ...previous,
          streams: exists
            ? previous.streams.filter((item) => item !== option)
            : [...previous.streams, option],
        };
      }

      return {
        ...previous,
        streams: exists ? [] : [option],
      };
    });
  };

  const setCustomFieldValue = (key: string, value: string) => {
    setForm((previous) => ({
      ...previous,
      customFieldValues: {
        ...previous.customFieldValues,
        [key]: value,
      },
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasLoadedSettings) {
      return;
    }

    const isFieldEnabled = (key: string) => fieldsByKey[key]?.enabled !== false;
    const isFieldRequired = (key: string) => fieldsByKey[key]?.enabled !== false && fieldsByKey[key]?.mandatory === true;

    if (isFieldRequired("name") && !form.name.trim()) {
      toast.error("Please enter your name.");
      return;
    }

    if (isFieldRequired("address") && !form.address.trim()) {
      toast.error("Please enter your address.");
      return;
    }

    if (isFieldRequired("mobile") && form.mobile.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (isFieldEnabled("email") && form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (isFieldRequired("message") && !form.message.trim()) {
      toast.error("Please enter your message.");
      return;
    }

    if (resolvedSettings.stream.enabled && resolvedSettings.stream.mandatory && form.streams.length === 0) {
      toast.error("Please select at least one stream.");
      return;
    }

    for (const customField of enabledCustomFields) {
      const value = String(form.customFieldValues[customField.key] ?? "").trim();
      if (customField.mandatory && !value) {
        toast.error(`Please fill ${customField.label}.`);
        return;
      }

      if (customField.type === "number" && value && !Number.isFinite(Number(value))) {
        toast.error(`Please enter a valid number for ${customField.label}.`);
        return;
      }

      if (customField.type === "select" && value) {
        const valid = (customField.options || []).some((option) => option.toLowerCase() === value.toLowerCase());
        if (!valid) {
          toast.error(`Please select a valid option for ${customField.label}.`);
          return;
        }
      }
    }

    setIsSubmitting(true);

    const customFieldValues = enabledCustomFields.reduce<Record<string, string>>((accumulator, field) => {
      const value = String(form.customFieldValues[field.key] ?? "").trim();
      if (value) {
        accumulator[field.key] = value;
      }
      return accumulator;
    }, {});

    adminApi.submitPublicEnquiryLead({
      source: "enquiry_now",
      name: form.name,
      address: form.address,
      mobile: form.mobile,
      email: form.email,
      message: form.message,
      streams: form.streams,
      customFieldValues,
      extraData: {
        formType: "floating_enquiry_modal",
      },
    })
      .then(() => {
        toast.success("Enquiry submitted successfully. Our team will contact you soon.");
        handleOpenChange(false);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Failed to submit enquiry");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
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
          {!hasLoadedSettings ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-600">
              Loading enquiry form...
            </div>
          ) : (
            <>
          {fieldsByKey.name?.enabled !== false && (
            <div className="space-y-1.5">
              <Label htmlFor="enquiry-name" className="text-sm font-semibold text-slate-700">
                {fieldsByKey.name?.label || "Full Name"}
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
          )}

          {fieldsByKey.address?.enabled !== false && (
            <div className="space-y-1.5">
              <Label htmlFor="enquiry-address" className="text-sm font-semibold text-slate-700">
                {fieldsByKey.address?.label || "Address"}
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="enquiry-address"
                  value={form.address}
                  onChange={(event) => setForm((previous) => ({ ...previous, address: event.target.value }))}
                  placeholder="Enter your full address"
                  autoComplete="street-address"
                  className={fieldClassName}
                />
              </div>
            </div>
          )}

          {fieldsByKey.mobile?.enabled !== false && (
            <div className="space-y-1.5">
              <Label htmlFor="enquiry-mobile" className="text-sm font-semibold text-slate-700">
                {fieldsByKey.mobile?.label || "Mobile Number"}
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
          )}

          {fieldsByKey.email?.enabled !== false && (
            <div className="space-y-1.5">
              <Label htmlFor="enquiry-email" className="text-sm font-semibold text-slate-700">
                {fieldsByKey.email?.label || "Email Address"}
              </Label>
              <Input
                id="enquiry-email"
                value={form.email}
                onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                placeholder="Enter your email"
                autoComplete="email"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus-visible:border-[rgb(38,72,151)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(38,72,151)]/20"
              />
            </div>
          )}

          {resolvedSettings.stream.enabled && resolvedSettings.stream.options.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">{resolvedSettings.stream.label}</Label>
              <div className="grid grid-cols-2 gap-2">
                {resolvedSettings.stream.options.map((option) => {
                  const selected = form.streams.includes(option);
                  const styleClass = selected
                    ? "border-[rgb(38,72,151)] bg-[rgb(38,72,151)]/10 text-[rgb(38,72,151)]"
                    : "border-slate-300 bg-white text-slate-600 hover:border-[rgb(38,72,151)]/40";
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleStream(option)}
                      className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${styleClass}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {enabledCustomFields.map((customField: LeadCustomFieldSetting) => {
            const inputValue = form.customFieldValues[customField.key] || "";

            if (customField.type === "textarea") {
              return (
                <div className="space-y-1.5" key={customField.key}>
                  <Label htmlFor={`custom-field-${customField.key}`} className="text-sm font-semibold text-slate-700">
                    {customField.label}
                  </Label>
                  <Textarea
                    id={`custom-field-${customField.key}`}
                    value={inputValue}
                    onChange={(event) => setCustomFieldValue(customField.key, event.target.value)}
                    placeholder={customField.placeholder || `Enter ${customField.label.toLowerCase()}`}
                    className="min-h-[88px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus-visible:border-[rgb(38,72,151)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(38,72,151)]/20"
                  />
                </div>
              );
            }

            if (customField.type === "select") {
              return (
                <div className="space-y-1.5" key={customField.key}>
                  <Label htmlFor={`custom-field-${customField.key}`} className="text-sm font-semibold text-slate-700">
                    {customField.label}
                  </Label>
                  <select
                    id={`custom-field-${customField.key}`}
                    value={inputValue}
                    onChange={(event) => setCustomFieldValue(customField.key, event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition-colors focus-visible:border-[rgb(38,72,151)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(38,72,151)]/20"
                  >
                    <option value="">Select {customField.label}</option>
                    {(customField.options || []).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              );
            }

            return (
              <div className="space-y-1.5" key={customField.key}>
                <Label htmlFor={`custom-field-${customField.key}`} className="text-sm font-semibold text-slate-700">
                  {customField.label}
                </Label>
                <Input
                  id={`custom-field-${customField.key}`}
                  value={inputValue}
                  onChange={(event) => setCustomFieldValue(customField.key, event.target.value)}
                  type={customField.type === "number" ? "number" : "text"}
                  placeholder={customField.placeholder || `Enter ${customField.label.toLowerCase()}`}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus-visible:border-[rgb(38,72,151)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(38,72,151)]/20"
                />
              </div>
            );
          })}

           {fieldsByKey.message?.enabled !== false && (
             <div className="space-y-1.5">
               <Label htmlFor="enquiry-message" className="text-sm font-semibold text-slate-700">
                 {fieldsByKey.message?.label || "Message"}
               </Label>
               <Textarea
                 id="enquiry-message"
                 value={form.message}
                 onChange={(event) => setForm((previous) => ({ ...previous, message: event.target.value }))}
                 placeholder="Type your query"
                 className="min-h-[88px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus-visible:border-[rgb(38,72,151)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(38,72,151)]/20"
               />
             </div>
           )}

          <Button
            type="submit"
            disabled={isSubmitting || isLoadingSettings}
            className="h-11 w-full rounded-xl bg-[rgb(38,72,151)] font-bold text-white hover:bg-[rgb(29,60,129)]"
          >
            {isSubmitting ? "Submitting..." : "Submit Enquiry"}
          </Button>

          <p className="text-center text-xs font-medium text-slate-500">
            By submitting, you agree to receive a callback from the Ednovate team.
          </p>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EnquiryModal;
