import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Mail, Save, Globe, Sparkles, CreditCard, Zap } from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { adminApi } from "@/services/adminApi";

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

type PaymentGatewaySettings = {
  cod: {
    enabled: boolean;
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

const defaultPaymentGateways = (): PaymentGatewaySettings => ({
  cod: {
    enabled: true,
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
};

const defaultEmailTemplates = (): Record<TemplateKey, EmailTemplate> => ({
  user_purchase: {
    enabled: true,
    subject: "Purchase confirmation - {{platformName}}",
    body: "Hello {{studentName}},\n\nYour purchase {{orderId}} is confirmed.\nItems: {{itemsSummary}}\nAmount: {{amount}}\n\nThanks,\n{{platformName}}",
  },
  user_login: {
    enabled: true,
    subject: "Login alert - {{platformName}}",
    body: "Hello {{studentName}},\n\nA new login was detected on {{loginAt}} from IP {{ipAddress}}.\n\n{{platformName}}",
  },
  course_complete: {
    enabled: true,
    subject: "Course milestone reached - {{platformName}}",
    body: "Hello {{studentName}},\n\nYou completed {{lessonTitle}} in {{courseTitle}}.\n\n{{platformName}}",
  },
  user_notification: {
    enabled: true,
    subject: "Notification from {{platformName}}",
    body: "Hello {{studentName}},\n\n{{notificationMessage}}\n\n{{platformName}}",
  },
  password_reset: {
    enabled: true,
    subject: "Password changed - {{platformName}}",
    body: "Hello {{studentName}},\n\nYour password was changed on {{changedAt}}.\n\n{{platformName}}",
  },
  new_account: {
    enabled: true,
    subject: "Welcome to {{platformName}}",
    body: "Hello {{studentName}},\n\nYour account is ready.\n\n{{platformName}}",
  },
});

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
    paymentGateways: defaultPaymentGateways(),
    emailAutomationEnabled: true,
    emailTemplates: defaultEmailTemplates(),
  });

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

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
        const paymentDefaults = defaultPaymentGateways();
        const codRaw = (paymentRaw.cod && typeof paymentRaw.cod === "object" ? paymentRaw.cod : {}) as Record<string, unknown>;
        const payuRaw = (paymentRaw.payu && typeof paymentRaw.payu === "object" ? paymentRaw.payu : {}) as Record<string, unknown>;
        const hdfcRaw = (paymentRaw.hdfc && typeof paymentRaw.hdfc === "object" ? paymentRaw.hdfc : {}) as Record<string, unknown>;
        const defaultTemplates = defaultEmailTemplates();

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
          paymentGateways: {
            cod: {
              enabled: codRaw.enabled !== false,
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
        }));

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
        paymentGateways: settings.paymentGateways,
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
      emailAutomation: {
        enabled: settings.emailAutomationEnabled,
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
      });
      await adminApi.savePlatformSettings(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Configure your platform</p>
      </div>

      {saved && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">Settings saved successfully!</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="general" className="gap-2">
            <Globe className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Features
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="w-4 h-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="payment" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Payment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Information</CardTitle>
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

          <Card>
            <CardHeader>
              <CardTitle>Legal & Compliance</CardTitle>
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

        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
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
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200">
                <div className="space-y-1">
                  <Label htmlFor="enableNotifications" className="text-gray-900 font-medium">Email Notifications</Label>
                  <p className="text-sm text-gray-600">Send email updates to users</p>
                </div>
                <Switch id="enableNotifications" checked={settings.enableNotifications} onCheckedChange={(value) => handleInputChange("enableNotifications", value)} />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200">
                <div className="space-y-1">
                  <Label htmlFor="enableEmailVerification" className="text-gray-900 font-medium">Email Verification</Label>
                  <p className="text-sm text-gray-600">Require email verification on signup</p>
                </div>
                <Switch id="enableEmailVerification" checked={settings.enableEmailVerification} onCheckedChange={(value) => handleInputChange("enableEmailVerification", value)} />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="space-y-1">
                  <Label htmlFor="maintenanceMode" className="text-gray-900 font-medium">Maintenance Mode</Label>
                  <p className="text-sm text-gray-600">Temporarily disable user access</p>
                </div>
                <Switch id="maintenanceMode" checked={settings.maintenanceMode} onCheckedChange={(value) => handleInputChange("maintenanceMode", value)} />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-orange-50 border border-orange-200">
                <div className="space-y-1">
                  <Label htmlFor="antiInspectEnabled" className="text-gray-900 font-medium">Inspect Protection</Label>
                  <p className="text-sm text-gray-600">Block common DevTools shortcuts on public pages and lock UI when DevTools is detected</p>
                </div>
                <Switch id="antiInspectEnabled" checked={settings.antiInspectEnabled} onCheckedChange={(value) => handleInputChange("antiInspectEnabled", value)} />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-orange-50 border border-orange-200">
                <div className="space-y-1">
                  <Label htmlFor="disableCopyPaste" className="text-gray-900 font-medium">Disable Copy/Paste</Label>
                  <p className="text-sm text-gray-600">Disable right click, copy, cut, paste, and text selection on public pages</p>
                </div>
                <Switch id="disableCopyPaste" checked={settings.disableCopyPaste} onCheckedChange={(value) => handleInputChange("disableCopyPaste", value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bunny Stream API Configuration</CardTitle>
              <CardDescription>Configure Bunny Stream for professional video hosting and delivery</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-purple-50 border border-purple-200">
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" /> SMTP Mail Setup
              </CardTitle>
              <CardDescription>
                Configure SMTP here. Set host, port, username, password, and sender details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 border border-blue-200">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Templates & Event Control</CardTitle>
              <CardDescription>
                Configure template text per event and turn any event OFF to stop its emails (for example, login email).
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

              {templateMeta.map((meta) => {
                const template = settings.emailTemplates[meta.key];
                return (
                  <div key={meta.key} className="rounded-lg border border-gray-200 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <Label className="text-gray-900 font-semibold">{meta.title}</Label>
                        <p className="text-xs text-gray-500">{meta.description}</p>
                      </div>
                      <Switch
                        checked={template.enabled}
                        onCheckedChange={(value) => handleTemplateChange(meta.key, "enabled", value)}
                      />
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

        <TabsContent value="payment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Gateway Configuration</CardTitle>
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
      </Tabs>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button variant="outline">Cancel</Button>
        <Button type="button" variant="outline" className="gap-2" onClick={handleActivateAllFeatures}>
          <Zap className="w-4 h-4" />
          Activate All Features
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
