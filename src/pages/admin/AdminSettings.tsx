import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Save } from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { adminApi } from "@/services/adminApi";

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
    bunnyStreamEnabled: false,
    bunnyStreamLibraryId: "",
    bunnyStreamApiKey: "",
    bunnyStreamCdnHostname: "",
    bunnyStreamPullZone: "",
  });

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Load settings from context on mount
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
        if (!isMounted || !bunny) return;

        setSettings((prev) => ({
          ...prev,
          bunnyStreamEnabled: bunny.enabled,
          bunnyStreamLibraryId: bunny.libraryId || "",
          bunnyStreamApiKey: bunny.apiKey || "",
          bunnyStreamCdnHostname: bunny.cdnHostname || "",
          bunnyStreamPullZone: bunny.pullZone || "",
        }));

        siteSettings.updateSettings({
          bunnyStreamApi: {
            enabled: bunny.enabled,
            libraryId: bunny.libraryId || "",
            apiKey: bunny.apiKey || "",
            cdnHostname: bunny.cdnHostname || "",
            pullZone: bunny.pullZone || "",
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

  const handleSave = async () => {
    setError("");
    setIsSaving(true);

    // Save to SiteSettingsContext
    const bunnySettings = {
      bunnyStreamApi: {
        enabled: settings.bunnyStreamEnabled,
        libraryId: settings.bunnyStreamLibraryId,
        apiKey: settings.bunnyStreamApiKey,
        cdnHostname: settings.bunnyStreamCdnHostname,
        pullZone: settings.bunnyStreamPullZone,
      },
    };

    try {
      siteSettings.updateSettings(bunnySettings);
      await adminApi.savePlatformSettings(bunnySettings);
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

      {/* Platform Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Information</CardTitle>
          <CardDescription>Basic details about your platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Platform Name</label>
            <Input
              value={settings.platformName}
              onChange={(e) => handleInputChange("platformName", e.target.value)}
              placeholder="Ednovate"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Email</label>
              <Input
                type="email"
                value={settings.platformEmail}
                onChange={(e) => handleInputChange("platformEmail", e.target.value)}
                placeholder="info@ednovate.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Phone</label>
              <Input
                value={settings.platformPhone}
                onChange={(e) => handleInputChange("platformPhone", e.target.value)}
                placeholder="+91 9876543210"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Support Email</label>
            <Input
              type="email"
              value={settings.supportEmail}
              onChange={(e) => handleInputChange("supportEmail", e.target.value)}
              placeholder="support@ednovate.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">About Platform</label>
            <Textarea
              value={settings.about}
              onChange={(e) => handleInputChange("about", e.target.value)}
              placeholder="Tell us about your platform..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Legal Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Legal & Compliance</CardTitle>
          <CardDescription>Terms, privacy, and compliance settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Terms & Conditions URL</label>
            <Input
              value={settings.termsUrl}
              onChange={(e) => handleInputChange("termsUrl", e.target.value)}
              placeholder="https://ednovate.com/terms"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Privacy Policy URL</label>
            <Input
              value={settings.privacyUrl}
              onChange={(e) => handleInputChange("privacyUrl", e.target.value)}
              placeholder="https://ednovate.com/privacy"
            />
          </div>
        </CardContent>
      </Card>

      {/* Feature Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Features & Services</CardTitle>
          <CardDescription>Enable or disable platform features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
            <div>
              <p className="font-medium text-gray-900">Email Notifications</p>
              <p className="text-sm text-gray-600">Send email updates to users</p>
            </div>
            <Switch
              checked={settings.enableNotifications}
              onCheckedChange={(value) => handleInputChange("enableNotifications", value)}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
            <div>
              <p className="font-medium text-gray-900">Email Verification</p>
              <p className="text-sm text-gray-600">Require email verification on signup</p>
            </div>
            <Switch
              checked={settings.enableEmailVerification}
              onCheckedChange={(value) => handleInputChange("enableEmailVerification", value)}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
            <div>
              <p className="font-medium text-gray-900">Maintenance Mode</p>
              <p className="text-sm text-gray-600">Temporarily disable user access</p>
            </div>
            <Switch
              checked={settings.maintenanceMode}
              onCheckedChange={(value) => handleInputChange("maintenanceMode", value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bunny Stream API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Bunny Stream API Configuration</CardTitle>
          <CardDescription>Configure Bunny Stream for professional video hosting and delivery</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-200">
            <div>
              <p className="font-medium text-gray-900">Enable Bunny Stream</p>
              <p className="text-sm text-gray-600">Use Bunny Stream API for video management and delivery</p>
            </div>
            <Switch
              checked={settings.bunnyStreamEnabled}
              onCheckedChange={(value) => handleInputChange("bunnyStreamEnabled", value)}
            />
          </div>

          {settings.bunnyStreamEnabled && (
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Library ID</label>
                <Input
                  value={settings.bunnyStreamLibraryId}
                  onChange={(e) => handleInputChange("bunnyStreamLibraryId", e.target.value)}
                  placeholder="621597"
                  disabled={!settings.bunnyStreamEnabled}
                />
                <p className="text-xs text-gray-500 mt-1">Your Bunny Stream video library ID</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">API Key</label>
                <Input
                  value={settings.bunnyStreamApiKey}
                  onChange={(e) => handleInputChange("bunnyStreamApiKey", e.target.value)}
                  placeholder="your-api-key-here"
                  type="password"
                  disabled={!settings.bunnyStreamEnabled}
                />
                <p className="text-xs text-gray-500 mt-1">Your Bunny Stream API key for authentication</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">CDN Hostname</label>
                  <Input
                    value={settings.bunnyStreamCdnHostname}
                    onChange={(e) => handleInputChange("bunnyStreamCdnHostname", e.target.value)}
                    placeholder="vz-260f96eb-4e3.b-cdn.net"
                    disabled={!settings.bunnyStreamEnabled}
                  />
                  <p className="text-xs text-gray-500 mt-1">e.g., vz-xxxxx.b-cdn.net</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Pull Zone</label>
                  <Input
                    value={settings.bunnyStreamPullZone}
                    onChange={(e) => handleInputChange("bunnyStreamPullZone", e.target.value)}
                    placeholder="vz-260f96eb-4e3"
                    disabled={!settings.bunnyStreamEnabled}
                  />
                  <p className="text-xs text-gray-500 mt-1">Your pull zone identifier</p>
                </div>
              </div>
              <Alert className="bg-purple-50 border-purple-200">
                <AlertDescription className="text-xs text-purple-800">
                  <strong>How to use:</strong> Once enabled, videos can be uploaded and managed through Bunny Stream API. The video player will automatically use the CDN hostname for playback.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 w-full">
            Delete All Orders
          </Button>
          <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 w-full">
            Reset Database
          </Button>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
