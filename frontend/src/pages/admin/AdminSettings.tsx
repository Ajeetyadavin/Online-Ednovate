import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Mail, Save, Globe, Sparkles, CreditCard, Zap, GripVertical, ArrowUp, ArrowDown, Eye, EyeOff, SlidersHorizontal, MessageSquare, Share2, PanelBottom, Upload, Loader2 } from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { adminApi, fileToBase64 } from "@/services/adminApi";
import { COMPANY_ADDRESS_TEXT } from "@/lib/companyContact";
import { resolveUploadAssetUrl } from "@/lib/runtimeUrls";
import {
  ADMIN_SIDEBAR_STORAGE_KEY,
  buildDefaultAdminSidebarConfig,
  normalizeAdminSidebarConfig,
  reorderAdminSidebarConfig,
  type AdminSidebarItemConfig,
} from "@/lib/adminSidebarConfig";

type SmtpSettings = {
  enabled: boolean;
  host: string;
  port: string;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
};

type SmsOtpSettings = {
  enabled: boolean;
  apiUrl: string;
  apiUsername: string;
  apiPassword: string;
  apiKey: string;
  senderId: string;
  templateId: string;
  entityId: string;
  route: string;
  countryCode: string;
  otpTtlSeconds: string;
  messageTemplate: string;
};

type PaymentGatewaySettings = {
  cod: {
    enabled: boolean;
  };
  easebuzz: {
    enabled: boolean;
    key: string;
    salt: string;
    env: "test" | "prod";
    apiBaseUrl: string;
  };
  payu: {
    enabled: boolean;
    merchantKey: string;
    merchantSalt: string;
    merchantId: string;
    apiBaseUrl: string;
  };
  hdfc: {
    enabled: boolean;
    merchantId: string;
    accessCode: string;
    workingKey: string;
    apiBaseUrl: string;
  };
};

type AiProvider = "gemini" | "grok" | "openrouter";

type AiExtractionSettings = {
  provider: AiProvider;
  geminiApiKey: string;
  geminiModel: string;
  grokApiKey: string;
  grokModel: string;
  openRouterApiKey: string;
  openRouterModel: string;
};

const defaultPaymentGateways = (): PaymentGatewaySettings => ({
  cod: {
    enabled: true,
  },
  easebuzz: {
    enabled: false,
    key: "",
    salt: "",
    env: "test",
    apiBaseUrl: "https://testpay.easebuzz.in",
  },
  payu: {
    enabled: false,
    merchantKey: "",
    merchantSalt: "",
    merchantId: "",
    apiBaseUrl: "",
  },
  hdfc: {
    enabled: false,
    merchantId: "",
    accessCode: "",
    workingKey: "",
    apiBaseUrl: "",
  },
});

const defaultAiExtraction = (): AiExtractionSettings => ({
  provider: "gemini",
  geminiApiKey: "",
  geminiModel: "gemini-1.5-flash",
  grokApiKey: "",
  grokModel: "grok-2-vision-latest",
  openRouterApiKey: "",
  openRouterModel: "google/gemini-2.0-flash-001",
});

const aiModelOptions: Record<AiProvider, string[]> = {
  gemini: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash", "gemini-2.5-flash"],
  grok: ["grok-2-vision-latest", "grok-2-latest", "grok-3-latest", "grok-3-mini-latest"],
  openrouter: ["google/gemini-2.0-flash-001", "openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "meta-llama/llama-3.1-70b-instruct"],
};

type TemplateKey =
  | "user_purchase"
  | "user_login"
  | "course_complete"
  | "user_notification"
  | "password_reset"
  | "new_account";

type EmailTemplate = {
  enabled: boolean;
  subject: string;
  body: string;
  sendToAdmin: boolean;
};

const defaultEmailTemplates = (): Record<TemplateKey, EmailTemplate> => ({
  user_purchase: {
    enabled: true,
    subject: "Purchase confirmation - {{platformName}}",
    body: "Hello {{studentName}},\n\nYour purchase {{orderId}} is confirmed.\nItems: {{itemsSummary}}\nAmount: {{amount}}\n\nThanks,\n{{platformName}}",
    sendToAdmin: false,
  },
  user_login: {
    enabled: true,
    subject: "Login alert - {{platformName}}",
    body: "Hello {{studentName}},\n\nA new login was detected on {{loginAt}} from IP {{ipAddress}}.\n\n{{platformName}}",
    sendToAdmin: false,
  },
  course_complete: {
    enabled: true,
    subject: "Course milestone reached - {{platformName}}",
    body: "Hello {{studentName}},\n\nYou completed {{lessonTitle}} in {{courseTitle}}.\n\n{{platformName}}",
    sendToAdmin: false,
  },
  user_notification: {
    enabled: true,
    subject: "Notification from {{platformName}}",
    body: "Hello {{studentName}},\n\n{{notificationMessage}}\n\n{{platformName}}",
    sendToAdmin: false,
  },
  password_reset: {
    enabled: true,
    subject: "Password changed - {{platformName}}",
    body: "Hello {{studentName}},\n\nYour password was changed on {{changedAt}}.\n\n{{platformName}}",
    sendToAdmin: false,
  },
  new_account: {
    enabled: true,
    subject: "Welcome to {{platformName}}",
    body: "Hello {{studentName}},\n\nYour account is ready.\n\n{{platformName}}",
    sendToAdmin: false,
  },
});

const parseAdminRecipients = (value: string) =>
  Array.from(
    new Set(
      String(value || "")
        .split(/[\n,;]+/)
        .map((item) => item.trim().toLowerCase())
        .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)),
    ),
  );

const templateMeta: Array<{ key: TemplateKey; title: string; description: string }> = [
  { key: "user_purchase", title: "User Purchase", description: "Send email when a user purchases a course/package" },
  { key: "user_login", title: "User Login", description: "Send email on login; turn OFF to disable login emails" },
  { key: "course_complete", title: "Course Complete", description: "Send email when a lesson/course milestone is completed" },
  { key: "user_notification", title: "User Notification", description: "Send email when admin sends a user notification" },
  { key: "password_reset", title: "Password Reset", description: "Send email when password is changed/reset" },
  { key: "new_account", title: "New Account", description: "Send welcome email on new account signup" },
];

export default function AdminSettings() {
  const siteSettings = useSiteSettings();
  type SocialPlatform = "facebook" | "instagram" | "youtube" | "twitter" | "linkedin" | "whatsapp";
  const [settings, setSettings] = useState({
    platformName: "Ednovate",
    platformEmail: "info@ednovate.com",
    platformPhone: "+91 9876543210",
    supportEmail: "support@ednovate.com",
    about: "Welcome to Ednovate - Your Online Learning Platform",
    termsUrl: "https://ednovate.com/terms",
    privacyUrl: "https://ednovate.com/privacy",
    enableNotifications: true,
    enableEmailVerification: true,
    maintenanceMode: false,
    antiInspectEnabled: false,
    disableCopyPaste: false,
    bunnyStreamEnabled: false,
    bunnyStreamLibraryId: "",
    bunnyStreamApiKey: "",
    bunnyStreamCdnHostname: "",
    bunnyStreamPullZone: "",
    smtp: {
      enabled: false,
      host: "",
      port: "587",
      secure: false,
      username: "",
      password: "",
      fromName: "Ednovate",
      fromEmail: "",
      replyTo: "",
    } as SmtpSettings,
    smsOtp: {
      enabled: false,
      apiUrl: "",
      apiUsername: "",
      apiPassword: "",
      apiKey: "",
      senderId: "",
      templateId: "",
      entityId: "",
      route: "",
      countryCode: "91",
      otpTtlSeconds: "300",
      messageTemplate: "Your OTP for {{platformName}} is {{otp}}. It is valid for {{minutes}} minutes.",
    } as SmsOtpSettings,
    aiExtraction: defaultAiExtraction(),
    paymentGateways: defaultPaymentGateways(),
    emailAutomationEnabled: true,
    emailAdminRecipients: "",
    emailTemplates: defaultEmailTemplates(),
    adminSidebar: buildDefaultAdminSidebarConfig() as AdminSidebarItemConfig[],
    socialLinks: {
      facebook: "",
      instagram: "",
      youtube: "",
      twitter: "",
      linkedin: "",
      whatsapp: "",
    },
    socialIconUrls: {
      facebook: "",
      instagram: "",
      youtube: "",
      twitter: "",
      linkedin: "",
      whatsapp: "",
    },
    footer: {
      tagline: "India's trusted online learning platform for CA, CS, CMA and professional courses. Structured programs, expert mentorship, and outcomes that matter.",
      address: COMPANY_ADDRESS_TEXT,
      copyrightText: "© 2026 Ednovate. All rights reserved.",
      privacyUrl: "#",
      termsUrl: "#",
      refundsUrl: "#",
      showSubscribeForm: true,
      showCoursesSection: true,
      showQuickLinksSection: true,
    },
  });

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [smtpTestToEmail, setSmtpTestToEmail] = useState("");
  const [isSmtpTesting, setIsSmtpTesting] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [aiConnection, setAiConnection] = useState<{ status: "idle" | "testing" | "success" | "error"; message: string }>({
    status: "idle",
    message: "Not tested",
  });
  const [dragSidebarItemId, setDragSidebarItemId] = useState<string | null>(null);
  const [dragOverSidebarItemId, setDragOverSidebarItemId] = useState<string | null>(null);
  const [uploadingSocialIconKey, setUploadingSocialIconKey] = useState<SocialPlatform | null>(null);

  useEffect(() => {
    if (siteSettings?.settings?.bunnyStreamApi) {
      setSettings((prev) => ({
        ...prev,
        bunnyStreamEnabled: siteSettings.settings.bunnyStreamApi.enabled,
        bunnyStreamLibraryId: siteSettings.settings.bunnyStreamApi.libraryId,
        bunnyStreamApiKey: siteSettings.settings.bunnyStreamApi.apiKey,
        bunnyStreamCdnHostname: siteSettings.settings.bunnyStreamApi.cdnHostname,
        bunnyStreamPullZone: siteSettings.settings.bunnyStreamApi.pullZone,
      }));
    }
  }, [siteSettings?.settings?.bunnyStreamApi]);

  useEffect(() => {
    let isMounted = true;

    const loadFromServer = async () => {
      try {
        const response = await adminApi.getPlatformSettings();
        const bunny = response?.settings?.bunnyStreamApi;
        const site = (response?.settings?.siteSettings || {}) as Record<string, unknown>;
        const security = (site.security && typeof site.security === "object")
          ? (site.security as Record<string, unknown>)
          : {};
        const smtpRaw = (
          response?.settings?.smtp && typeof response.settings.smtp === "object"
            ? response.settings.smtp
            : site.smtp && typeof site.smtp === "object"
              ? site.smtp
              : {}
        ) as Record<string, unknown>;
        const smsOtpRaw = (
          site.smsOtp && typeof site.smsOtp === "object"
            ? site.smsOtp
            : {}
        ) as Record<string, unknown>;
        const emailAutomationRaw = ((response?.settings?.emailAutomation && typeof response.settings.emailAutomation === "object"
          ? response.settings.emailAutomation
          : site.emailAutomation && typeof site.emailAutomation === "object"
            ? site.emailAutomation
            : {})
        ) as Record<string, unknown>;
        const templatesRaw = (emailAutomationRaw.templates && typeof emailAutomationRaw.templates === "object"
          ? emailAutomationRaw.templates
          : {}) as Record<string, unknown>;
        const paymentRaw = (site.paymentGateways && typeof site.paymentGateways === "object"
          ? site.paymentGateways
          : site.paymentGatewaySettings && typeof site.paymentGatewaySettings === "object"
            ? site.paymentGatewaySettings
            : {}) as Record<string, unknown>;
        const aiRaw = (response?.settings?.aiExtraction && typeof response.settings.aiExtraction === "object"
          ? response.settings.aiExtraction
          : {}) as Record<string, unknown>;
        const paymentDefaults = defaultPaymentGateways();
        const aiDefaults = defaultAiExtraction();
        const codRaw = (paymentRaw.cod && typeof paymentRaw.cod === "object" ? paymentRaw.cod : {}) as Record<string, unknown>;
        const easebuzzRaw = (paymentRaw.easebuzz && typeof paymentRaw.easebuzz === "object" ? paymentRaw.easebuzz : {}) as Record<string, unknown>;
        const payuRaw = (paymentRaw.payu && typeof paymentRaw.payu === "object" ? paymentRaw.payu : {}) as Record<string, unknown>;
        const hdfcRaw = (paymentRaw.hdfc && typeof paymentRaw.hdfc === "object" ? paymentRaw.hdfc : {}) as Record<string, unknown>;
        const defaultTemplates = defaultEmailTemplates();
        const adminSidebar = normalizeAdminSidebarConfig(site.adminSidebar);

        if (!isMounted) return;

        setSettings((prev) => ({
          ...prev,
          bunnyStreamEnabled: bunny?.enabled === true,
          bunnyStreamLibraryId: String(bunny?.libraryId || ""),
          bunnyStreamApiKey: String(bunny?.apiKey || ""),
          bunnyStreamCdnHostname: String(bunny?.cdnHostname || ""),
          bunnyStreamPullZone: String(bunny?.pullZone || ""),
          platformName: String(site.platformName || prev.platformName),
          platformEmail: String(site.platformEmail || prev.platformEmail),
          platformPhone: String(site.platformPhone || prev.platformPhone),
          supportEmail: String(site.supportEmail || prev.supportEmail),
          about: String(site.about || prev.about),
          termsUrl: String(site.termsUrl || prev.termsUrl),
          privacyUrl: String(site.privacyUrl || prev.privacyUrl),
          enableNotifications: site.enableNotifications !== false,
          enableEmailVerification: site.enableEmailVerification !== false,
          maintenanceMode: site.maintenanceMode === true,
          antiInspectEnabled: security.antiInspectEnabled === true,
          disableCopyPaste: security.disableCopyPaste === true,
          smtp: {
            enabled: smtpRaw.enabled === true,
            host: String(smtpRaw.host || ""),
            port: String(smtpRaw.port || "587"),
            secure: smtpRaw.secure === true,
            username: String(smtpRaw.username || ""),
            password: String(smtpRaw.password || ""),
            fromName: String(smtpRaw.fromName || "Ednovate"),
            fromEmail: String(smtpRaw.fromEmail || ""),
            replyTo: String(smtpRaw.replyTo || ""),
          },
          smsOtp: {
            enabled: smsOtpRaw.enabled === true,
            apiUrl: String(smsOtpRaw.apiUrl || ""),
            apiUsername: String(smsOtpRaw.apiUsername || ""),
            apiPassword: String(smsOtpRaw.apiPassword || ""),
            apiKey: String(smsOtpRaw.apiKey || ""),
            senderId: String(smsOtpRaw.senderId || ""),
            templateId: String(smsOtpRaw.templateId || ""),
            entityId: String(smsOtpRaw.entityId || ""),
            route: String(smsOtpRaw.route || ""),
            countryCode: String(smsOtpRaw.countryCode || "91") || "91",
            otpTtlSeconds: String(smsOtpRaw.otpTtlSeconds || "300") || "300",
            messageTemplate:
              String(smsOtpRaw.messageTemplate || "").trim()
              || "Your OTP for {{platformName}} is {{otp}}. It is valid for {{minutes}} minutes.",
          },
          aiExtraction: {
            provider: ["gemini", "grok", "openrouter"].includes(String(aiRaw.provider || ""))
              ? (String(aiRaw.provider) as AiProvider)
              : aiDefaults.provider,
            geminiApiKey: String(aiRaw.geminiApiKey || ""),
            geminiModel: String(aiRaw.geminiModel || aiDefaults.geminiModel),
            grokApiKey: String(aiRaw.grokApiKey || ""),
            grokModel: String(aiRaw.grokModel || aiDefaults.grokModel),
            openRouterApiKey: String(aiRaw.openRouterApiKey || ""),
            openRouterModel: String(aiRaw.openRouterModel || aiDefaults.openRouterModel),
          },
          paymentGateways: {
            cod: {
              enabled: codRaw.enabled !== false,
            },
            easebuzz: {
              enabled: easebuzzRaw.enabled === true,
              key: String(easebuzzRaw.key || paymentDefaults.easebuzz.key),
              salt: String(easebuzzRaw.salt || paymentDefaults.easebuzz.salt),
              env: easebuzzRaw.env === "prod" ? "prod" : "test",
              apiBaseUrl: String(easebuzzRaw.apiBaseUrl || paymentDefaults.easebuzz.apiBaseUrl),
            },
            payu: {
              enabled: payuRaw.enabled === true,
              merchantKey: String(payuRaw.merchantKey || paymentDefaults.payu.merchantKey),
              merchantSalt: String(payuRaw.merchantSalt || paymentDefaults.payu.merchantSalt),
              merchantId: String(payuRaw.merchantId || paymentDefaults.payu.merchantId),
              apiBaseUrl: String(payuRaw.apiBaseUrl || paymentDefaults.payu.apiBaseUrl),
            },
            hdfc: {
              enabled: hdfcRaw.enabled === true,
              merchantId: String(hdfcRaw.merchantId || paymentDefaults.hdfc.merchantId),
              accessCode: String(hdfcRaw.accessCode || paymentDefaults.hdfc.accessCode),
              workingKey: String(hdfcRaw.workingKey || paymentDefaults.hdfc.workingKey),
              apiBaseUrl: String(hdfcRaw.apiBaseUrl || paymentDefaults.hdfc.apiBaseUrl),
            },
          },
          emailAutomationEnabled: emailAutomationRaw.enabled !== false,
          emailAdminRecipients: Array.isArray(emailAutomationRaw.adminRecipients)
            ? emailAutomationRaw.adminRecipients.map((item) => String(item || "").trim()).filter(Boolean).join(", ")
            : "",
          emailTemplates: {
            user_purchase: {
              ...defaultTemplates.user_purchase,
              ...((templatesRaw.user_purchase as Record<string, unknown>) || {}),
            },
            user_login: {
              ...defaultTemplates.user_login,
              ...((templatesRaw.user_login as Record<string, unknown>) || {}),
            },
            course_complete: {
              ...defaultTemplates.course_complete,
              ...((templatesRaw.course_complete as Record<string, unknown>) || {}),
            },
            user_notification: {
              ...defaultTemplates.user_notification,
              ...((templatesRaw.user_notification as Record<string, unknown>) || {}),
            },
            password_reset: {
              ...defaultTemplates.password_reset,
              ...((templatesRaw.password_reset as Record<string, unknown>) || {}),
            },
            new_account: {
              ...defaultTemplates.new_account,
              ...((templatesRaw.new_account as Record<string, unknown>) || {}),
            },
          },
          adminSidebar,
          socialLinks: (() => {
            const sl = (site.socialLinks && typeof site.socialLinks === "object" ? site.socialLinks : {}) as Record<string, unknown>;
            return {
              facebook: String(sl.facebook || ""),
              instagram: String(sl.instagram || ""),
              youtube: String(sl.youtube || ""),
              twitter: String(sl.twitter || ""),
              linkedin: String(sl.linkedin || ""),
              whatsapp: String(sl.whatsapp || ""),
            };
          })(),
          socialIconUrls: (() => {
            const si = (site.socialIconUrls && typeof site.socialIconUrls === "object" ? site.socialIconUrls : {}) as Record<string, unknown>;
            return {
              facebook: String(si.facebook || ""),
              instagram: String(si.instagram || ""),
              youtube: String(si.youtube || ""),
              twitter: String(si.twitter || ""),
              linkedin: String(si.linkedin || ""),
              whatsapp: String(si.whatsapp || ""),
            };
          })(),
          footer: (() => {
            const ft = (site.footer && typeof site.footer === "object" ? site.footer : {}) as Record<string, unknown>;
            return {
              tagline: String(ft.tagline || "India's trusted online learning platform for CA, CS, CMA and professional courses. Structured programs, expert mentorship, and outcomes that matter."),
              address: String(ft.address || COMPANY_ADDRESS_TEXT),
              copyrightText: String(ft.copyrightText || "\u00a9 2026 Ednovate. All rights reserved."),
              privacyUrl: String(ft.privacyUrl || "#"),
              termsUrl: String(ft.termsUrl || "#"),
              refundsUrl: String(ft.refundsUrl || "#"),
              showSubscribeForm: ft.showSubscribeForm !== false,
              showCoursesSection: ft.showCoursesSection !== false,
              showQuickLinksSection: ft.showQuickLinksSection !== false,
            };
          })(),
        }));

        localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, JSON.stringify(adminSidebar));

        siteSettings.updateSettings({
          maintenanceMode: site.maintenanceMode === true,
          security: {
            antiInspectEnabled: security.antiInspectEnabled === true,
            disableCopyPaste: security.disableCopyPaste === true,
          },
          bunnyStreamApi: {
            enabled: bunny?.enabled === true,
            libraryId: String(bunny?.libraryId || ""),
            apiKey: String(bunny?.apiKey || ""),
            cdnHostname: String(bunny?.cdnHostname || ""),
            pullZone: String(bunny?.pullZone || ""),
          },
        });
      } catch (apiError) {
        if (!isMounted) return;
        setError(apiError instanceof Error ? apiError.message : "Failed to load settings from server");
      }
    };

    loadFromServer();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleInputChange = (field: string, value: string | boolean) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSmtpChange = (field: keyof SmtpSettings, value: string | boolean) => {
    setSettings((prev) => ({
      ...prev,
      smtp: {
        ...prev.smtp,
        [field]: value,
      },
    }));
  };

  const handleSocialIconUpload = async (platform: SocialPlatform, file?: File | null) => {
    if (!file) return;
    setError("");
    setUploadingSocialIconKey(platform);
    try {
      const base64Data = await fileToBase64(file);
      const uploaded = await adminApi.uploadImage(file.name, file.type, base64Data, "branding");
      setSettings((prev) => ({
        ...prev,
        socialIconUrls: {
          ...prev.socialIconUrls,
          [platform]: uploaded.url,
        },
      }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload social icon");
    } finally {
      setUploadingSocialIconKey(null);
    }
  };

  const handleSmsOtpChange = (field: keyof SmsOtpSettings, value: string | boolean) => {
    setSettings((prev) => ({
      ...prev,
      smsOtp: {
        ...prev.smsOtp,
        [field]: value,
      },
    }));
  };

  const handleAiExtractionChange = (field: keyof AiExtractionSettings, value: string) => {
    setAiConnection({ status: "idle", message: "Not tested" });
    setSettings((prev) => ({
      ...prev,
      aiExtraction: {
        ...prev.aiExtraction,
        [field]: value,
      },
    }));
  };

  const getActiveAiModel = () => (
    settings.aiExtraction.provider === "gemini"
      ? settings.aiExtraction.geminiModel
      : settings.aiExtraction.provider === "grok"
        ? settings.aiExtraction.grokModel
        : settings.aiExtraction.openRouterModel
  );

  const getActiveAiModelField = (): keyof AiExtractionSettings => (
    settings.aiExtraction.provider === "gemini"
      ? "geminiModel"
      : settings.aiExtraction.provider === "grok"
        ? "grokModel"
        : "openRouterModel"
  );

  const handleAiConnectionTest = async () => {
    setAiConnection({ status: "testing", message: "Testing connection..." });
    try {
      const result = await adminApi.testAiExtractionConnection(settings.aiExtraction);
      setAiConnection({
        status: "success",
        message: result?.message || `Connected to ${settings.aiExtraction.provider}`,
      });
    } catch (apiError) {
      setAiConnection({
        status: "error",
        message: apiError instanceof Error ? apiError.message : "AI connection failed",
      });
    }
  };

  const handleTemplateChange = (key: TemplateKey, field: keyof EmailTemplate, value: string | boolean) => {
    setSettings((prev) => ({
      ...prev,
      emailTemplates: {
        ...prev.emailTemplates,
        [key]: {
          ...prev.emailTemplates[key],
          [field]: value,
        },
      },
    }));
  };

  const handleGatewayChange = (
    gateway: keyof PaymentGatewaySettings,
    field: string,
    value: string | boolean,
  ) => {
    setSettings((prev) => ({
      ...prev,
      paymentGateways: {
        ...prev.paymentGateways,
        [gateway]: {
          ...prev.paymentGateways[gateway],
          [field]: value,
        },
      },
    }));
  };

  const handleActivateAllFeatures = () => {
    setError("");
    setSaved(false);

    setSettings((prev) => ({
      ...prev,
      enableNotifications: true,
      enableEmailVerification: true,
      maintenanceMode: false,
      antiInspectEnabled: false,
      disableCopyPaste: false,
      bunnyStreamEnabled: true,
      emailAutomationEnabled: true,
      emailTemplates: {
        user_purchase: { ...prev.emailTemplates.user_purchase, enabled: true },
        user_login: { ...prev.emailTemplates.user_login, enabled: true },
        course_complete: { ...prev.emailTemplates.course_complete, enabled: true },
        user_notification: { ...prev.emailTemplates.user_notification, enabled: true },
        password_reset: { ...prev.emailTemplates.password_reset, enabled: true },
        new_account: { ...prev.emailTemplates.new_account, enabled: true },
      },
      paymentGateways: {
        cod: {
          ...prev.paymentGateways.cod,
          enabled: true,
        },
        easebuzz: {
          ...prev.paymentGateways.easebuzz,
          enabled: true,
        },
        payu: {
          ...prev.paymentGateways.payu,
          enabled: true,
        },
        hdfc: {
          ...prev.paymentGateways.hdfc,
          enabled: true,
        },
      },
    }));
  };

  const updateSidebarConfig = (updater: (items: AdminSidebarItemConfig[]) => AdminSidebarItemConfig[]) => {
    setSettings((prev) => {
      const nextSidebar = reorderAdminSidebarConfig(updater(prev.adminSidebar));
      localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, JSON.stringify(nextSidebar));
      return {
        ...prev,
        adminSidebar: nextSidebar,
      };
    });
  };

  const handleSidebarLabelChange = (id: string, label: string) => {
    updateSidebarConfig((items) => items.map((item) => (item.id === id ? { ...item, label } : item)));
  };

  const handleSidebarVisibilityToggle = (id: string, visible: boolean) => {
    if (id === "settings") return;
    updateSidebarConfig((items) => items.map((item) => (item.id === id ? { ...item, visible } : item)));
  };

  const handleSidebarEnabledToggle = (id: string, enabled: boolean) => {
    if (id === "settings") return;
    updateSidebarConfig((items) => items.map((item) => (item.id === id ? { ...item, enabled } : item)));
  };

  const moveSidebarItem = (id: string, direction: "up" | "down") => {
    updateSidebarConfig((items) => {
      const list = [...items];
      const currentIndex = list.findIndex((item) => item.id === id);
      if (currentIndex < 0) return list;
      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= list.length) return list;
      [list[currentIndex], list[nextIndex]] = [list[nextIndex], list[currentIndex]];
      return list;
    });
  };

  const handleSidebarDragStart = (event: React.DragEvent<HTMLElement>, itemId: string) => {
    setDragSidebarItemId(itemId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
  };

  const handleSidebarDrop = (event: React.DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault();
    const sourceId = dragSidebarItemId || event.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) {
      setDragOverSidebarItemId(null);
      return;
    }
    updateSidebarConfig((items) => {
      const list = [...items];
      const dragIndex = list.findIndex((item) => item.id === sourceId);
      const targetIndex = list.findIndex((item) => item.id === targetId);
      if (dragIndex < 0 || targetIndex < 0) return list;
      const [dragged] = list.splice(dragIndex, 1);
      list.splice(targetIndex, 0, dragged);
      return list;
    });
    setDragSidebarItemId(null);
    setDragOverSidebarItemId(null);
  };

  const resetSidebarToDefault = () => {
    const defaults = buildDefaultAdminSidebarConfig();
    setSettings((prev) => ({
      ...prev,
      adminSidebar: defaults,
    }));
    localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, JSON.stringify(defaults));
  };

  const handleSave = async () => {
    setError("");
    setIsSaving(true);

    const payload = {
      bunnyStreamApi: {
        enabled: settings.bunnyStreamEnabled,
        libraryId: settings.bunnyStreamLibraryId,
        apiKey: settings.bunnyStreamApiKey,
        cdnHostname: settings.bunnyStreamCdnHostname,
        pullZone: settings.bunnyStreamPullZone,
      },
      siteSettings: {
        platformName: settings.platformName,
        platformEmail: settings.platformEmail,
        platformPhone: settings.platformPhone,
        supportEmail: settings.supportEmail,
        about: settings.about,
        termsUrl: settings.termsUrl,
        privacyUrl: settings.privacyUrl,
        enableNotifications: settings.enableNotifications,
        enableEmailVerification: settings.enableEmailVerification,
        maintenanceMode: settings.maintenanceMode,
        security: {
          antiInspectEnabled: settings.antiInspectEnabled,
          disableCopyPaste: settings.disableCopyPaste,
        },
        smtp: {
          enabled: settings.smtp.enabled,
          host: settings.smtp.host,
          port: Number(settings.smtp.port || 587),
          secure: settings.smtp.secure,
          username: settings.smtp.username,
          password: settings.smtp.password,
          fromName: settings.smtp.fromName,
          fromEmail: settings.smtp.fromEmail,
          replyTo: settings.smtp.replyTo,
        },
        smsOtp: {
          enabled: settings.smsOtp.enabled,
          apiUrl: settings.smsOtp.apiUrl,
          apiUsername: settings.smsOtp.apiUsername,
          apiPassword: settings.smsOtp.apiPassword,
          apiKey: settings.smsOtp.apiKey,
          senderId: settings.smsOtp.senderId,
          templateId: settings.smsOtp.templateId,
          entityId: settings.smsOtp.entityId,
          route: settings.smsOtp.route,
          countryCode: settings.smsOtp.countryCode,
          otpTtlSeconds: Number(settings.smsOtp.otpTtlSeconds || 300),
          messageTemplate: settings.smsOtp.messageTemplate,
        },
        paymentGateways: settings.paymentGateways,
        adminSidebar: settings.adminSidebar,
        socialLinks: settings.socialLinks,
        socialIconUrls: settings.socialIconUrls,
        footer: settings.footer,
      },
      smtp: {
        enabled: settings.smtp.enabled,
        host: settings.smtp.host,
        port: Number(settings.smtp.port || 587),
        secure: settings.smtp.secure,
        username: settings.smtp.username,
        password: settings.smtp.password,
        fromName: settings.smtp.fromName,
        fromEmail: settings.smtp.fromEmail,
        replyTo: settings.smtp.replyTo,
      },
      aiExtraction: settings.aiExtraction,
      emailAutomation: {
        enabled: settings.emailAutomationEnabled,
        adminRecipients: parseAdminRecipients(settings.emailAdminRecipients),
        templates: settings.emailTemplates,
      },
    };

    try {
      siteSettings.updateSettings({
        maintenanceMode: settings.maintenanceMode,
        security: {
          antiInspectEnabled: settings.antiInspectEnabled,
          disableCopyPaste: settings.disableCopyPaste,
        },
        bunnyStreamApi: payload.bunnyStreamApi,
        socialLinks: settings.socialLinks,
        socialIconUrls: settings.socialIconUrls,
        footer: settings.footer,
      });
      await adminApi.savePlatformSettings(payload);
      setSaved(true);
      void handleAiConnectionTest();
      setTimeout(() => setSaved(false), 3000);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSmtpTest = async () => {
    setSmtpTestResult(null);
    setIsSmtpTesting(true);

    const payload = {
      bunnyStreamApi: {
        enabled: settings.bunnyStreamEnabled,
        libraryId: settings.bunnyStreamLibraryId,
        apiKey: settings.bunnyStreamApiKey,
        cdnHostname: settings.bunnyStreamCdnHostname,
        pullZone: settings.bunnyStreamPullZone,
      },
      siteSettings: {
        platformName: settings.platformName,
        platformEmail: settings.platformEmail,
        platformPhone: settings.platformPhone,
        supportEmail: settings.supportEmail,
        about: settings.about,
        termsUrl: settings.termsUrl,
        privacyUrl: settings.privacyUrl,
        enableNotifications: settings.enableNotifications,
        enableEmailVerification: settings.enableEmailVerification,
        maintenanceMode: settings.maintenanceMode,
        security: {
          antiInspectEnabled: settings.antiInspectEnabled,
          disableCopyPaste: settings.disableCopyPaste,
        },
        smtp: {
          enabled: settings.smtp.enabled,
          host: settings.smtp.host,
          port: Number(settings.smtp.port || 587),
          secure: settings.smtp.secure,
          username: settings.smtp.username,
          password: settings.smtp.password,
          fromName: settings.smtp.fromName,
          fromEmail: settings.smtp.fromEmail,
          replyTo: settings.smtp.replyTo,
        },
        smsOtp: {
          enabled: settings.smsOtp.enabled,
          apiUrl: settings.smsOtp.apiUrl,
          apiUsername: settings.smsOtp.apiUsername,
          apiPassword: settings.smsOtp.apiPassword,
          apiKey: settings.smsOtp.apiKey,
          senderId: settings.smsOtp.senderId,
          templateId: settings.smsOtp.templateId,
          entityId: settings.smsOtp.entityId,
          route: settings.smsOtp.route,
          countryCode: settings.smsOtp.countryCode,
          otpTtlSeconds: Number(settings.smsOtp.otpTtlSeconds || 300),
          messageTemplate: settings.smsOtp.messageTemplate,
        },
        paymentGateways: settings.paymentGateways,
        adminSidebar: settings.adminSidebar,
      },
      smtp: {
        enabled: settings.smtp.enabled,
        host: settings.smtp.host,
        port: Number(settings.smtp.port || 587),
        secure: settings.smtp.secure,
        username: settings.smtp.username,
        password: settings.smtp.password,
        fromName: settings.smtp.fromName,
        fromEmail: settings.smtp.fromEmail,
        replyTo: settings.smtp.replyTo,
      },
      aiExtraction: settings.aiExtraction,
      emailAutomation: {
        enabled: settings.emailAutomationEnabled,
        adminRecipients: parseAdminRecipients(settings.emailAdminRecipients),
        templates: settings.emailTemplates,
      },
    };

    const targetEmail = String(smtpTestToEmail || settings.platformEmail || settings.smtp.fromEmail || settings.smtp.username)
      .trim()
      .toLowerCase();

    if (!targetEmail) {
      setSmtpTestResult({ type: "error", message: "Please enter a valid recipient email for SMTP test." });
      setIsSmtpTesting(false);
      return;
    }

    try {
      await adminApi.savePlatformSettings(payload);
      const result = await adminApi.sendSmtpTestMail(targetEmail);
      setSmtpTestResult({
        type: "success",
        message: result?.message || `SMTP test mail sent to ${targetEmail}`,
      });
    } catch (apiError) {
      setSmtpTestResult({
        type: "error",
        message: apiError instanceof Error ? apiError.message : "Failed to send SMTP test mail",
      });
    } finally {
      setIsSmtpTesting(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Platform Settings</h1>
            <p className="mt-1 text-sm text-gray-600">Manage your platform configuration, integrations &amp; appearance</p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {saved && (
        <Alert className="bg-emerald-50 border-emerald-300">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-800 font-medium">Settings saved successfully!</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="bg-red-50 border-red-300">
          <AlertDescription className="text-red-800 font-medium">{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2 gap-1 mb-6 rounded-lg border border-gray-200 bg-gray-50 p-1 sm:grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="general" className="gap-1.5 rounded-md text-xs font-medium text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900">
            <Globe className="w-3.5 h-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="footer" className="gap-1.5 rounded-md text-xs font-medium text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900">
            <PanelBottom className="w-3.5 h-3.5" />
            Footer
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-1.5 rounded-md text-xs font-medium text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900">
            <Sparkles className="w-3.5 h-3.5" />
            Features
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5 rounded-md text-xs font-medium text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900">
            <Mail className="w-3.5 h-3.5" />
            Email
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-1.5 rounded-md text-xs font-medium text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900">
            <MessageSquare className="w-3.5 h-3.5" />
            SMS OTP
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5 rounded-md text-xs font-medium text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900">
            <Sparkles className="w-3.5 h-3.5" />
            AI
          </TabsTrigger>
          <TabsTrigger value="payment" className="gap-1.5 rounded-md text-xs font-medium text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900">
            <CreditCard className="w-3.5 h-3.5" />
            Payment
          </TabsTrigger>
          <TabsTrigger value="sidebar" className="gap-1.5 rounded-md text-xs font-medium text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Sidebar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="rounded-2xl border border-gray-200 bg-white shadow-none">
            <CardHeader className="border-b border-gray-200 bg-gray-50/60 pb-4">
              <CardTitle className="flex items-center gap-2 text-gray-900"><Globe className="w-4 h-4" />Platform Information</CardTitle>
              <CardDescription>Basic details about your platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="platformName">Platform Name</Label>
                <Input id="platformName" value={settings.platformName} onChange={(e) => handleInputChange("platformName", e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="platformEmail">Email</Label>
                  <Input id="platformEmail" type="email" value={settings.platformEmail} onChange={(e) => handleInputChange("platformEmail", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="platformPhone">Phone</Label>
                  <Input id="platformPhone" value={settings.platformPhone} onChange={(e) => handleInputChange("platformPhone", e.target.value)} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input id="supportEmail" type="email" value={settings.supportEmail} onChange={(e) => handleInputChange("supportEmail", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="about">About Platform</Label>
                <Textarea id="about" value={settings.about} onChange={(e) => handleInputChange("about", e.target.value)} rows={4} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-200 bg-white shadow-none">
            <CardHeader className="border-b border-gray-200 bg-gray-50/60 pb-4">
              <CardTitle className="text-gray-900">Legal &amp; Compliance</CardTitle>
              <CardDescription>Terms, privacy, and compliance settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="termsUrl">Terms & Conditions URL</Label>
                <Input id="termsUrl" value={settings.termsUrl} onChange={(e) => handleInputChange("termsUrl", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="privacyUrl">Privacy Policy URL</Label>
                <Input id="privacyUrl" value={settings.privacyUrl} onChange={(e) => handleInputChange("privacyUrl", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="footer" className="space-y-6">
          <Card className="rounded-2xl border border-gray-200 bg-white shadow-none">
            <CardHeader className="border-b border-gray-200 bg-gray-50/60 pb-4">
              <CardTitle className="flex items-center gap-2 text-gray-900"><PanelBottom className="w-4 h-4" />Brand &amp; Tagline</CardTitle>
              <CardDescription>Tagline text shown below the logo in the footer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="footerTagline">Tagline / Description</Label>
                <Textarea id="footerTagline" rows={3} value={settings.footer.tagline} onChange={(e) => setSettings((prev) => ({ ...prev, footer: { ...prev.footer, tagline: e.target.value } }))} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-200 bg-white shadow-none">
            <CardHeader className="border-b border-gray-200 bg-gray-50/60 pb-4">
              <CardTitle className="text-gray-900">Section Visibility</CardTitle>
              <CardDescription>Show or hide footer sections on the public site</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="footerShowQuickLinks" className="text-gray-900 font-medium cursor-pointer">Quick Links</Label>
                  <p className="text-sm text-gray-600">Show navigation links column in footer</p>
                </div>
                <Switch id="footerShowQuickLinks" checked={settings.footer.showQuickLinksSection} onCheckedChange={(v) => setSettings((prev) => ({ ...prev, footer: { ...prev.footer, showQuickLinksSection: v } }))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="footerShowCourses" className="text-gray-900 font-medium cursor-pointer">Courses / Categories</Label>
                  <p className="text-sm text-gray-600">Show course categories column in footer</p>
                </div>
                <Switch id="footerShowCourses" checked={settings.footer.showCoursesSection} onCheckedChange={(v) => setSettings((prev) => ({ ...prev, footer: { ...prev.footer, showCoursesSection: v } }))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="footerShowSubscribe" className="text-gray-900 font-medium cursor-pointer">Email Subscribe Form</Label>
                  <p className="text-sm text-gray-600">Show the &ldquo;Subscribe&rdquo; input in the brand column</p>
                </div>
                <Switch id="footerShowSubscribe" checked={settings.footer.showSubscribeForm} onCheckedChange={(v) => setSettings((prev) => ({ ...prev, footer: { ...prev.footer, showSubscribeForm: v } }))} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-200 bg-white shadow-none">
            <CardHeader className="border-b border-gray-200 bg-gray-50/60 pb-4">
              <CardTitle className="text-gray-900">Contact &amp; Address</CardTitle>
              <CardDescription>Address shown in the Contact column. Phone and email are pulled from Header settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="footerAddress">Address</Label>
                <Input id="footerAddress" placeholder="Mumbai, Maharashtra" value={settings.footer.address} onChange={(e) => setSettings((prev) => ({ ...prev, footer: { ...prev.footer, address: e.target.value } }))} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-200 bg-white shadow-none">
            <CardHeader className="border-b border-gray-200 bg-gray-50/60 pb-4">
              <CardTitle className="text-gray-900">Bottom Bar</CardTitle>
              <CardDescription>Copyright text and footer links shown at the very bottom</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="footerCopyright">Copyright Text</Label>
                <Input id="footerCopyright" placeholder="© 2026 YourBrand. All rights reserved." value={settings.footer.copyrightText} onChange={(e) => setSettings((prev) => ({ ...prev, footer: { ...prev.footer, copyrightText: e.target.value } }))} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="footerPrivacyUrl">Privacy Policy URL</Label>
                  <Input id="footerPrivacyUrl" placeholder="#" value={settings.footer.privacyUrl} onChange={(e) => setSettings((prev) => ({ ...prev, footer: { ...prev.footer, privacyUrl: e.target.value } }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="footerTermsUrl">Terms & Conditions URL</Label>
                  <Input id="footerTermsUrl" placeholder="#" value={settings.footer.termsUrl} onChange={(e) => setSettings((prev) => ({ ...prev, footer: { ...prev.footer, termsUrl: e.target.value } }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="footerRefundsUrl">Refund Policy URL</Label>
                  <Input id="footerRefundsUrl" placeholder="#" value={settings.footer.refundsUrl} onChange={(e) => setSettings((prev) => ({ ...prev, footer: { ...prev.footer, refundsUrl: e.target.value } }))} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-200 bg-white shadow-none">
            <CardHeader className="border-b border-gray-200 bg-gray-50/60 pb-4">
              <CardTitle className="flex items-center gap-2 text-gray-900"><Share2 className="w-4 h-4" />Social Media Links</CardTitle>
              <CardDescription>Link and logo upload for footer social icons. URL blank hoga to icon hide ho jayega.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="socialFacebook">Facebook URL</Label>
                  <Input id="socialFacebook" placeholder="https://facebook.com/yourpage" value={settings.socialLinks.facebook} onChange={(e) => setSettings((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, facebook: e.target.value } }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="socialFacebookIconUpload">Facebook Logo Upload</Label>
                  <Input id="socialFacebookIconUpload" type="file" accept="image/*" onChange={(e) => void handleSocialIconUpload("facebook", e.target.files?.[0])} />
                  {uploadingSocialIconKey === "facebook" && <p className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</p>}
                  {settings.socialIconUrls.facebook && (
                    <img src={resolveUploadAssetUrl(settings.socialIconUrls.facebook, settings.socialIconUrls.facebook)} alt="Facebook logo" className="w-8 h-8 object-contain rounded border border-gray-200 p-1" />
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="socialInstagram">Instagram URL</Label>
                  <Input id="socialInstagram" placeholder="https://instagram.com/yourhandle" value={settings.socialLinks.instagram} onChange={(e) => setSettings((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, instagram: e.target.value } }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="socialInstagramIconUpload">Instagram Logo Upload</Label>
                  <Input id="socialInstagramIconUpload" type="file" accept="image/*" onChange={(e) => void handleSocialIconUpload("instagram", e.target.files?.[0])} />
                  {uploadingSocialIconKey === "instagram" && <p className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</p>}
                  {settings.socialIconUrls.instagram && (
                    <img src={resolveUploadAssetUrl(settings.socialIconUrls.instagram, settings.socialIconUrls.instagram)} alt="Instagram logo" className="w-8 h-8 object-contain rounded border border-gray-200 p-1" />
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="socialYoutube">YouTube URL</Label>
                  <Input id="socialYoutube" placeholder="https://youtube.com/@yourchannel" value={settings.socialLinks.youtube} onChange={(e) => setSettings((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, youtube: e.target.value } }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="socialYoutubeIconUpload">YouTube Logo Upload</Label>
                  <Input id="socialYoutubeIconUpload" type="file" accept="image/*" onChange={(e) => void handleSocialIconUpload("youtube", e.target.files?.[0])} />
                  {uploadingSocialIconKey === "youtube" && <p className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</p>}
                  {settings.socialIconUrls.youtube && (
                    <img src={resolveUploadAssetUrl(settings.socialIconUrls.youtube, settings.socialIconUrls.youtube)} alt="YouTube logo" className="w-8 h-8 object-contain rounded border border-gray-200 p-1" />
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="socialTwitter">Twitter / X URL</Label>
                  <Input id="socialTwitter" placeholder="https://x.com/yourhandle" value={settings.socialLinks.twitter} onChange={(e) => setSettings((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, twitter: e.target.value } }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="socialTwitterIconUpload">Twitter / X Logo Upload</Label>
                  <Input id="socialTwitterIconUpload" type="file" accept="image/*" onChange={(e) => void handleSocialIconUpload("twitter", e.target.files?.[0])} />
                  {uploadingSocialIconKey === "twitter" && <p className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</p>}
                  {settings.socialIconUrls.twitter && (
                    <img src={resolveUploadAssetUrl(settings.socialIconUrls.twitter, settings.socialIconUrls.twitter)} alt="Twitter logo" className="w-8 h-8 object-contain rounded border border-gray-200 p-1" />
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="socialLinkedin">LinkedIn URL</Label>
                  <Input id="socialLinkedin" placeholder="https://linkedin.com/company/yourpage" value={settings.socialLinks.linkedin} onChange={(e) => setSettings((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, linkedin: e.target.value } }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="socialLinkedinIconUpload">LinkedIn Logo Upload</Label>
                  <Input id="socialLinkedinIconUpload" type="file" accept="image/*" onChange={(e) => void handleSocialIconUpload("linkedin", e.target.files?.[0])} />
                  {uploadingSocialIconKey === "linkedin" && <p className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</p>}
                  {settings.socialIconUrls.linkedin && (
                    <img src={resolveUploadAssetUrl(settings.socialIconUrls.linkedin, settings.socialIconUrls.linkedin)} alt="LinkedIn logo" className="w-8 h-8 object-contain rounded border border-gray-200 p-1" />
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="socialWhatsapp">WhatsApp URL</Label>
                  <Input id="socialWhatsapp" placeholder="https://wa.me/919876543210" value={settings.socialLinks.whatsapp} onChange={(e) => setSettings((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, whatsapp: e.target.value } }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="socialWhatsappIconUpload">WhatsApp Logo Upload</Label>
                  <Input id="socialWhatsappIconUpload" type="file" accept="image/*" onChange={(e) => void handleSocialIconUpload("whatsapp", e.target.files?.[0])} />
                  {uploadingSocialIconKey === "whatsapp" && <p className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</p>}
                  {settings.socialIconUrls.whatsapp && (
                    <img src={resolveUploadAssetUrl(settings.socialIconUrls.whatsapp, settings.socialIconUrls.whatsapp)} alt="WhatsApp logo" className="w-8 h-8 object-contain rounded border border-gray-200 p-1" />
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-600 flex items-center gap-2">
                <Upload className="w-3.5 h-3.5" />
                Image upload ho jayega aur footer me same icon show hoga after Save.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-6">
          <Card className="rounded-2xl border border-gray-200 bg-white shadow-none">
            <CardHeader className="border-b border-gray-200 bg-gray-50/60 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Features & Services</CardTitle>
                  <CardDescription>Enable or disable platform features</CardDescription>
                </div>
                <Button type="button" variant="outline" className="gap-2" onClick={handleActivateAllFeatures}>
                  <Zap className="w-4 h-4" />
                  Activate All Features
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="enableNotifications" className="text-gray-900 font-medium cursor-pointer">📧 Email Notifications</Label>
                  <p className="text-sm text-gray-600">Send email updates to users</p>
                </div>
                <Switch id="enableNotifications" checked={settings.enableNotifications} onCheckedChange={(value) => handleInputChange("enableNotifications", value)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="enableEmailVerification" className="text-gray-900 font-medium cursor-pointer">✅ Email Verification</Label>
                  <p className="text-sm text-gray-600">Require email verification on signup</p>
                </div>
                <Switch id="enableEmailVerification" checked={settings.enableEmailVerification} onCheckedChange={(value) => handleInputChange("enableEmailVerification", value)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="maintenanceMode" className="text-gray-900 font-medium cursor-pointer">🔧 Maintenance Mode</Label>
                  <p className="text-sm text-gray-600">Temporarily disable user access</p>
                </div>
                <Switch id="maintenanceMode" checked={settings.maintenanceMode} onCheckedChange={(value) => handleInputChange("maintenanceMode", value)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="antiInspectEnabled" className="text-gray-900 font-medium cursor-pointer">🛡️ Inspect Protection</Label>
                  <p className="text-sm text-gray-600">Block DevTools shortcuts &amp; lock UI when DevTools detected</p>
                </div>
                <Switch id="antiInspectEnabled" checked={settings.antiInspectEnabled} onCheckedChange={(value) => handleInputChange("antiInspectEnabled", value)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="disableCopyPaste" className="text-gray-900 font-medium cursor-pointer">🚫 Disable Copy/Paste</Label>
                  <p className="text-sm text-gray-600">Disable right-click, copy, cut, paste &amp; text selection on public pages</p>
                </div>
                <Switch id="disableCopyPaste" checked={settings.disableCopyPaste} onCheckedChange={(value) => handleInputChange("disableCopyPaste", value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-200 bg-white shadow-none">
            <CardHeader className="border-b border-gray-200 bg-gray-50/60 pb-4">
              <CardTitle className="flex items-center gap-2 text-gray-900">🐰 Bunny Stream API</CardTitle>
              <CardDescription>Configure Bunny Stream for professional video hosting and delivery</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                <div className="space-y-1">
                  <Label htmlFor="bunnyStreamEnabled" className="text-gray-900 font-medium">Enable Bunny Stream</Label>
                  <p className="text-sm text-gray-600">Use Bunny Stream API for video management and delivery</p>
                </div>
                <Switch id="bunnyStreamEnabled" checked={settings.bunnyStreamEnabled} onCheckedChange={(value) => handleInputChange("bunnyStreamEnabled", value)} />
              </div>

              {settings.bunnyStreamEnabled && (
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <div className="grid gap-2">
                    <Label htmlFor="bunnyStreamLibraryId">Library ID</Label>
                    <Input id="bunnyStreamLibraryId" value={settings.bunnyStreamLibraryId} onChange={(e) => handleInputChange("bunnyStreamLibraryId", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bunnyStreamApiKey">API Key</Label>
                    <Input id="bunnyStreamApiKey" type="password" value={settings.bunnyStreamApiKey} onChange={(e) => handleInputChange("bunnyStreamApiKey", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="bunnyStreamCdnHostname">CDN Hostname</Label>
                      <Input id="bunnyStreamCdnHostname" value={settings.bunnyStreamCdnHostname} onChange={(e) => handleInputChange("bunnyStreamCdnHostname", e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="bunnyStreamPullZone">Pull Zone</Label>
                      <Input id="bunnyStreamPullZone" value={settings.bunnyStreamPullZone} onChange={(e) => handleInputChange("bunnyStreamPullZone", e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-6">
          <Card className="rounded-2xl border border-gray-200 bg-white shadow-none">
            <CardHeader className="border-b border-gray-200 bg-gray-50/60 pb-4">
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Mail className="w-5 h-5" /> SMTP Mail Setup
              </CardTitle>
              <CardDescription>
                Configure SMTP here. Set host, port, username, password, and sender details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                <div className="space-y-1">
                  <Label htmlFor="smtpEnabled" className="text-gray-900 font-medium">Enable SMTP</Label>
                  <p className="text-sm text-gray-600">Turn on SMTP to send automated emails</p>
                </div>
                <Switch id="smtpEnabled" checked={settings.smtp.enabled} onCheckedChange={(value) => handleSmtpChange("enabled", value)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input id="smtpHost" placeholder="smtp.gmail.com" value={settings.smtp.host} onChange={(e) => handleSmtpChange("host", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="smtpPort">Port</Label>
                  <Input id="smtpPort" placeholder="587" value={settings.smtp.port} onChange={(e) => handleSmtpChange("port", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="smtpUsername">Username</Label>
                  <Input id="smtpUsername" placeholder="noreply@yourdomain.com" value={settings.smtp.username} onChange={(e) => handleSmtpChange("username", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="smtpPassword">Password / App Password</Label>
                  <Input id="smtpPassword" type="password" placeholder="******" value={settings.smtp.password} onChange={(e) => handleSmtpChange("password", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="smtpFromName">From Name</Label>
                  <Input id="smtpFromName" placeholder="Ednovate" value={settings.smtp.fromName} onChange={(e) => handleSmtpChange("fromName", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="smtpFromEmail">From Email</Label>
                  <Input id="smtpFromEmail" placeholder="noreply@yourdomain.com" value={settings.smtp.fromEmail} onChange={(e) => handleSmtpChange("fromEmail", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="smtpReplyTo">Reply To</Label>
                  <Input id="smtpReplyTo" placeholder="support@yourdomain.com" value={settings.smtp.replyTo} onChange={(e) => handleSmtpChange("replyTo", e.target.value)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                  <div className="space-y-1">
                    <Label htmlFor="smtpSecure" className="text-sm font-medium text-gray-900">Use Secure (SSL/TLS)</Label>
                    <p className="text-xs text-gray-500">Usually true for 465, false for 587</p>
                  </div>
                  <Switch id="smtpSecure" checked={settings.smtp.secure} onCheckedChange={(value) => handleSmtpChange("secure", value)} />
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4 space-y-3 bg-gray-50">
                <div className="space-y-1">
                  <Label htmlFor="smtpTestToEmail" className="text-gray-900 font-medium">SMTP Test Recipient</Label>
                  <p className="text-xs text-gray-600">Test mail will be sent using your current SMTP configuration.</p>
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                  <Input
                    id="smtpTestToEmail"
                    type="email"
                    placeholder="admin@yourdomain.com"
                    value={smtpTestToEmail}
                    onChange={(e) => setSmtpTestToEmail(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="md:min-w-[170px]"
                    onClick={handleSmtpTest}
                    disabled={isSmtpTesting}
                  >
                    {isSmtpTesting ? "Testing..." : "Send SMTP Test"}
                  </Button>
                </div>
                {smtpTestResult && (
                  <Alert className={smtpTestResult.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                    <AlertDescription className={smtpTestResult.type === "success" ? "text-gray-900" : "text-red-800"}>
                      {smtpTestResult.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-200 bg-white shadow-none">
            <CardHeader className="border-b border-gray-200 bg-gray-50/60 pb-4">
              <CardTitle className="flex items-center gap-2 text-gray-900">📨 Email Templates &amp; Event Control</CardTitle>
              <CardDescription>
                Configure template text per event and turn any event OFF to stop its emails.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200">
                <div className="space-y-1">
                  <Label htmlFor="emailAutomationEnabled" className="text-gray-900 font-medium">Enable Email Automation</Label>
                  <p className="text-sm text-gray-600">Global switch for all event-based emails</p>
                </div>
                <Switch
                  id="emailAutomationEnabled"
                  checked={settings.emailAutomationEnabled}
                  onCheckedChange={(value) => handleInputChange("emailAutomationEnabled", value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="emailAdminRecipients">Admin Recipient Emails</Label>
                <Textarea
                  id="emailAdminRecipients"
                  rows={2}
                  placeholder="admin1@domain.com, admin2@domain.com"
                  value={settings.emailAdminRecipients}
                  onChange={(event) => handleInputChange("emailAdminRecipients", event.target.value)}
                />
                <p className="text-xs text-gray-500">These emails will receive selected event notifications when you enable "Also send to admins" for that event.</p>
              </div>

              {templateMeta.map((meta) => {
                const template = settings.emailTemplates[meta.key];
                return (
                  <div key={meta.key} className="rounded-lg border border-gray-200 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <Label className="text-gray-900 font-semibold">{meta.title}</Label>
                        <p className="text-xs text-gray-500">{meta.description}</p>
                      </div>
                      <div className="flex items-center gap-5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Enable</span>
                          <Switch
                            checked={template.enabled}
                            onCheckedChange={(value) => handleTemplateChange(meta.key, "enabled", value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Also send to admins</span>
                          <Switch
                            checked={template.sendToAdmin === true}
                            onCheckedChange={(value) => handleTemplateChange(meta.key, "sendToAdmin", value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`${meta.key}Subject`}>Subject</Label>
                      <Input
                        id={`${meta.key}Subject`}
                        value={template.subject}
                        onChange={(e) => handleTemplateChange(meta.key, "subject", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`${meta.key}Body`}>Body</Label>
                      <Textarea
                        id={`${meta.key}Body`}
                        rows={4}
                        value={template.body}
                        onChange={(e) => handleTemplateChange(meta.key, "body", e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms" className="space-y-6">
          <Card className="rounded-2xl border border-gray-200 bg-white shadow-none">
            <CardHeader className="border-b border-gray-200 bg-gray-50/60 pb-4">
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <MessageSquare className="w-5 h-5" /> TimesMobile OTP Setup
              </CardTitle>
              <CardDescription>
                Add TimesMobile API credentials for login/forgot-password OTP delivery.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                <div className="space-y-1">
                  <Label htmlFor="smsOtpEnabled" className="text-gray-900 font-medium">Enable OTP via TimesMobile</Label>
                  <p className="text-sm text-gray-600">When ON, OTP is sent via TimesMobile API.</p>
                </div>
                <Switch
                  id="smsOtpEnabled"
                  checked={settings.smsOtp.enabled}
                  onCheckedChange={(value) => handleSmsOtpChange("enabled", value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="smsOtpApiUrl">API URL</Label>
                  <Input
                    id="smsOtpApiUrl"
                    placeholder="https://your-timesmobile-endpoint"
                    value={settings.smsOtp.apiUrl}
                    onChange={(e) => handleSmsOtpChange("apiUrl", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="smsOtpApiUsername">API Username</Label>
                  <Input
                    id="smsOtpApiUsername"
                    placeholder="ednovateotp.trans"
                    value={settings.smsOtp.apiUsername}
                    onChange={(e) => handleSmsOtpChange("apiUsername", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="smsOtpApiPassword">API Password</Label>
                  <Input
                    id="smsOtpApiPassword"
                    type="password"
                    placeholder="••••••••"
                    value={settings.smsOtp.apiPassword}
                    onChange={(e) => handleSmsOtpChange("apiPassword", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="smsOtpApiKey">API Key</Label>
                  <Input
                    id="smsOtpApiKey"
                    type="password"
                    placeholder="Optional API key / bearer token"
                    value={settings.smsOtp.apiKey}
                    onChange={(e) => handleSmsOtpChange("apiKey", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="smsOtpSenderId">Sender ID</Label>
                  <Input
                    id="smsOtpSenderId"
                    placeholder="SENDER"
                    value={settings.smsOtp.senderId}
                    onChange={(e) => handleSmsOtpChange("senderId", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="smsOtpTemplateId">Template ID</Label>
                  <Input
                    id="smsOtpTemplateId"
                    placeholder="Template ID"
                    value={settings.smsOtp.templateId}
                    onChange={(e) => handleSmsOtpChange("templateId", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="smsOtpEntityId">Entity ID</Label>
                  <Input
                    id="smsOtpEntityId"
                    placeholder="Entity ID"
                    value={settings.smsOtp.entityId}
                    onChange={(e) => handleSmsOtpChange("entityId", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="smsOtpRoute">Route (optional)</Label>
                  <Input
                    id="smsOtpRoute"
                    placeholder="Transactional / Route code"
                    value={settings.smsOtp.route}
                    onChange={(e) => handleSmsOtpChange("route", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="smsOtpCountryCode">Country Code</Label>
                  <Input
                    id="smsOtpCountryCode"
                    placeholder="91"
                    value={settings.smsOtp.countryCode}
                    onChange={(e) => handleSmsOtpChange("countryCode", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="smsOtpTtl">OTP Validity (seconds)</Label>
                  <Input
                    id="smsOtpTtl"
                    type="number"
                    min={60}
                    max={900}
                    value={settings.smsOtp.otpTtlSeconds}
                    onChange={(e) => handleSmsOtpChange("otpTtlSeconds", e.target.value)}
                  />
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="smsOtpTemplate">SMS Message Template</Label>
                  <Textarea
                    id="smsOtpTemplate"
                    rows={3}
                    value={settings.smsOtp.messageTemplate}
                    onChange={(e) => handleSmsOtpChange("messageTemplate", e.target.value)}
                  />
                  <p className="text-xs text-gray-500">Use placeholders: {'{otp}'}, {'{minutes}'}, {'{platformName}'}, {'{mobile}'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card className="rounded-2xl border border-gray-200 bg-white shadow-none">
            <CardHeader className="border-b border-gray-200 bg-gray-50/60 pb-4">
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Sparkles className="w-5 h-5" /> AI Question Extraction
              </CardTitle>
              <CardDescription>
                Select the provider and model used by CrackIt AI Extract Question.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <datalist id="geminiModelSuggestions">
                {aiModelOptions.gemini.map((model) => <option key={model} value={model} />)}
              </datalist>
              <datalist id="grokModelSuggestions">
                {aiModelOptions.grok.map((model) => <option key={model} value={model} />)}
              </datalist>
              <datalist id="openRouterModelSuggestions">
                {aiModelOptions.openrouter.map((model) => <option key={model} value={model} />)}
              </datalist>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="aiProvider">Active Provider</Label>
                  <select
                    id="aiProvider"
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={settings.aiExtraction.provider}
                    onChange={(e) => handleAiExtractionChange("provider", e.target.value as AiProvider)}
                  >
                    <option value="gemini">Gemini</option>
                    <option value="grok">Grok / xAI</option>
                    <option value="openrouter">OpenRouter</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="activeAiModel">Active Model / Custom Model</Label>
                  <Input
                    id="activeAiModel"
                    list={`${settings.aiExtraction.provider === "openrouter" ? "openRouter" : settings.aiExtraction.provider}ModelSuggestions`}
                    placeholder="Enter any supported model id"
                    value={getActiveAiModel()}
                    onChange={(e) => handleAiExtractionChange(getActiveAiModelField(), e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-3 w-3 rounded-full ${
                      aiConnection.status === "success"
                        ? "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                        : aiConnection.status === "error"
                          ? "bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.12)]"
                          : aiConnection.status === "testing"
                            ? "bg-amber-400 shadow-[0_0_0_4px_rgba(245,158,11,0.14)]"
                            : "bg-gray-300"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {aiConnection.status === "success" ? "Connected" : aiConnection.status === "error" ? "Not connected" : aiConnection.status === "testing" ? "Checking..." : "Connection not tested"}
                    </p>
                    <p className="text-xs text-gray-600">{aiConnection.message}</p>
                  </div>
                </div>
                <Button type="button" variant="outline" className="gap-2" onClick={handleAiConnectionTest} disabled={aiConnection.status === "testing"}>
                  {aiConnection.status === "testing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Test Connection
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="font-semibold text-gray-900">Gemini</Label>
                      <p className="text-xs text-gray-500">Google Gemini API for PDF text and image extraction.</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${settings.aiExtraction.provider === "gemini" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                      {settings.aiExtraction.provider === "gemini" ? "Active" : "Standby"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="geminiApiKey">API Key</Label>
                      <Input
                        id="geminiApiKey"
                        type="password"
                        placeholder="Gemini API key"
                        value={settings.aiExtraction.geminiApiKey}
                        onChange={(e) => handleAiExtractionChange("geminiApiKey", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="geminiModel">Model / Custom Model</Label>
                      <Input
                        id="geminiModel"
                        list="geminiModelSuggestions"
                        placeholder="gemini-1.5-flash"
                        value={settings.aiExtraction.geminiModel}
                        onChange={(e) => handleAiExtractionChange("geminiModel", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="font-semibold text-gray-900">Grok / xAI</Label>
                      <p className="text-xs text-gray-500">OpenAI-compatible xAI endpoint for CrackIt extraction.</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${settings.aiExtraction.provider === "grok" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                      {settings.aiExtraction.provider === "grok" ? "Active" : "Standby"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="grokApiKey">API Key</Label>
                      <Input
                        id="grokApiKey"
                        type="password"
                        placeholder="xAI API key"
                        value={settings.aiExtraction.grokApiKey}
                        onChange={(e) => handleAiExtractionChange("grokApiKey", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="grokModel">Model / Custom Model</Label>
                      <Input
                        id="grokModel"
                        list="grokModelSuggestions"
                        placeholder="grok-2-vision-latest"
                        value={settings.aiExtraction.grokModel}
                        onChange={(e) => handleAiExtractionChange("grokModel", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="font-semibold text-gray-900">OpenRouter</Label>
                      <p className="text-xs text-gray-500">OpenRouter API key with selectable routed model.</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${settings.aiExtraction.provider === "openrouter" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                      {settings.aiExtraction.provider === "openrouter" ? "Active" : "Standby"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="openRouterApiKey">API Key</Label>
                      <Input
                        id="openRouterApiKey"
                        type="password"
                        placeholder="OpenRouter API key"
                        value={settings.aiExtraction.openRouterApiKey}
                        onChange={(e) => handleAiExtractionChange("openRouterApiKey", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="openRouterModel">Model / Custom Model</Label>
                      <Input
                        id="openRouterModel"
                        list="openRouterModelSuggestions"
                        placeholder="provider/model-id"
                        value={settings.aiExtraction.openRouterModel}
                        onChange={(e) => handleAiExtractionChange("openRouterModel", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-6">
          <Card className="rounded-2xl border border-gray-200 bg-white shadow-none">
            <CardHeader className="border-b border-gray-200 bg-gray-50/60 pb-4">
              <CardTitle className="flex items-center gap-2 text-gray-900"><CreditCard className="w-4 h-4" />Payment Gateway Configuration</CardTitle>
              <CardDescription>
                Turn gateways ON/OFF and configure API credentials. Checkout will show only enabled methods.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="font-semibold text-gray-900">Cash on Delivery (COD)</Label>
                    <p className="text-xs text-gray-500">Enable COD as a checkout payment method</p>
                  </div>
                  <Switch
                    checked={settings.paymentGateways.cod.enabled}
                    onCheckedChange={(value) => handleGatewayChange("cod", "enabled", value)}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="font-semibold text-gray-900">Easebuzz</Label>
                    <p className="text-xs text-gray-500">Configure Easebuzz credentials for online payments</p>
                  </div>
                  <Switch
                    checked={settings.paymentGateways.easebuzz.enabled}
                    onCheckedChange={(value) => handleGatewayChange("easebuzz", "enabled", value)}
                  />
                </div>

                {settings.paymentGateways.easebuzz.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                    <div className="grid gap-2">
                      <Label htmlFor="easebuzzKey">Key</Label>
                      <Input
                        id="easebuzzKey"
                        value={settings.paymentGateways.easebuzz.key}
                        onChange={(e) => handleGatewayChange("easebuzz", "key", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="easebuzzSalt">Salt</Label>
                      <Input
                        id="easebuzzSalt"
                        type="password"
                        value={settings.paymentGateways.easebuzz.salt}
                        onChange={(e) => handleGatewayChange("easebuzz", "salt", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="easebuzzEnv">Environment</Label>
                      <select
                        id="easebuzzEnv"
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={settings.paymentGateways.easebuzz.env}
                        onChange={(e) => handleGatewayChange("easebuzz", "env", e.target.value as "test" | "prod")}
                      >
                        <option value="test">Test</option>
                        <option value="prod">Production</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="easebuzzApiBaseUrl">API Base URL</Label>
                      <Input
                        id="easebuzzApiBaseUrl"
                        placeholder="https://testpay.easebuzz.in"
                        value={settings.paymentGateways.easebuzz.apiBaseUrl}
                        onChange={(e) => handleGatewayChange("easebuzz", "apiBaseUrl", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="font-semibold text-gray-900">PayU</Label>
                    <p className="text-xs text-gray-500">Configure PayU API credentials for online payments</p>
                  </div>
                  <Switch
                    checked={settings.paymentGateways.payu.enabled}
                    onCheckedChange={(value) => handleGatewayChange("payu", "enabled", value)}
                  />
                </div>

                {settings.paymentGateways.payu.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                    <div className="grid gap-2">
                      <Label htmlFor="payuMerchantKey">Merchant Key</Label>
                      <Input
                        id="payuMerchantKey"
                        value={settings.paymentGateways.payu.merchantKey}
                        onChange={(e) => handleGatewayChange("payu", "merchantKey", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="payuMerchantSalt">Merchant Salt</Label>
                      <Input
                        id="payuMerchantSalt"
                        type="password"
                        value={settings.paymentGateways.payu.merchantSalt}
                        onChange={(e) => handleGatewayChange("payu", "merchantSalt", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="payuMerchantId">Merchant ID</Label>
                      <Input
                        id="payuMerchantId"
                        value={settings.paymentGateways.payu.merchantId}
                        onChange={(e) => handleGatewayChange("payu", "merchantId", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="payuApiBaseUrl">API Base URL</Label>
                      <Input
                        id="payuApiBaseUrl"
                        placeholder="https://secure.payu.in"
                        value={settings.paymentGateways.payu.apiBaseUrl}
                        onChange={(e) => handleGatewayChange("payu", "apiBaseUrl", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="font-semibold text-gray-900">HDFC Bank Gateway</Label>
                    <p className="text-xs text-gray-500">Configure HDFC gateway credentials for online payments</p>
                  </div>
                  <Switch
                    checked={settings.paymentGateways.hdfc.enabled}
                    onCheckedChange={(value) => handleGatewayChange("hdfc", "enabled", value)}
                  />
                </div>

                {settings.paymentGateways.hdfc.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                    <div className="grid gap-2">
                      <Label htmlFor="hdfcMerchantId">Merchant ID</Label>
                      <Input
                        id="hdfcMerchantId"
                        value={settings.paymentGateways.hdfc.merchantId}
                        onChange={(e) => handleGatewayChange("hdfc", "merchantId", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="hdfcAccessCode">Access Code</Label>
                      <Input
                        id="hdfcAccessCode"
                        value={settings.paymentGateways.hdfc.accessCode}
                        onChange={(e) => handleGatewayChange("hdfc", "accessCode", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="hdfcWorkingKey">Working Key</Label>
                      <Input
                        id="hdfcWorkingKey"
                        type="password"
                        value={settings.paymentGateways.hdfc.workingKey}
                        onChange={(e) => handleGatewayChange("hdfc", "workingKey", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="hdfcApiBaseUrl">API Base URL</Label>
                      <Input
                        id="hdfcApiBaseUrl"
                        placeholder="https://api.hdfcbank.com"
                        value={settings.paymentGateways.hdfc.apiBaseUrl}
                        onChange={(e) => handleGatewayChange("hdfc", "apiBaseUrl", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sidebar" className="space-y-6">
          <Card className="rounded-2xl border border-gray-200 bg-white shadow-none">
            <CardHeader className="border-b border-gray-200 bg-gray-50/60 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-gray-900"><SlidersHorizontal className="w-4 h-4" />Sidebar Menu Manager</CardTitle>
                  <CardDescription>Hide/show menu items, rename labels, and drag to reorder positions.</CardDescription>
                </div>
                <Button type="button" variant="outline" className="border-slate-300 hover:bg-slate-100" onClick={resetSidebarToDefault}>Reset Default</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {settings.adminSidebar.map((item, index) => (
                <div
                  key={item.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (dragSidebarItemId && dragSidebarItemId !== item.id) setDragOverSidebarItemId(item.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverSidebarItemId === item.id) setDragOverSidebarItemId(null);
                  }}
                  onDrop={(event) => handleSidebarDrop(event, item.id)}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 transition-colors ${
                    dragOverSidebarItemId === item.id ? "border-gray-300 bg-gray-50" : "border-gray-200"
                  }`}
                >
                  {item.id === "settings" ? (
                    <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">
                      Settings menu locked: always ON and always visible for recovery.
                    </div>
                  ) : null}
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => handleSidebarDragStart(event, item.id)}
                    onDragEnd={() => {
                      setDragSidebarItemId(null);
                      setDragOverSidebarItemId(null);
                    }}
                    className="cursor-grab rounded-lg border border-gray-200 p-2 text-gray-500 active:cursor-grabbing"
                    title="Drag to reorder"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <div className="w-8 text-sm font-semibold text-gray-400">{index + 1}</div>
                  <div className="min-w-[220px] flex-1">
                    <Input
                      value={item.label}
                      onChange={(event) => handleSidebarLabelChange(item.id, event.target.value)}
                      placeholder="Menu label"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => moveSidebarItem(item.id, "up")}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => moveSidebarItem(item.id, "down")}
                      disabled={index === settings.adminSidebar.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.enabled ? "bg-emerald-500" : "bg-gray-300"}`} />
                      <span className="text-sm text-gray-600">Feature ON</span>
                      <Switch
                        checked={item.enabled !== false}
                        disabled={item.id === "settings"}
                        onCheckedChange={(value) => handleSidebarEnabledToggle(item.id, value)}
                      />
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5">
                      {item.visible ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-gray-400" />}
                      <span className="text-sm text-gray-600">Sidebar Visible</span>
                      <Switch
                        checked={item.visible}
                        disabled={item.id === "settings"}
                        onCheckedChange={(value) => handleSidebarVisibilityToggle(item.id, value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-xs text-gray-500">Feature ON/OFF: OFF karne par module open nahi hoga. Sidebar Visible: hide karne par menu gayab hoga, feature URL se chalta rahega.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-0 z-10 flex justify-end gap-3 rounded-b-2xl border-t border-gray-200 bg-white px-1 py-4">
        <Button variant="outline" className="border-gray-300 hover:bg-gray-100">Cancel</Button>
        <Button type="button" variant="outline" className="gap-2 border-gray-300 text-gray-700 hover:bg-gray-50" onClick={handleActivateAllFeatures}>
          <Zap className="w-4 h-4" />
          Activate All
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2 bg-gray-900 text-white hover:bg-gray-800">
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
