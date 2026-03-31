import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, Loader2, Plus, RefreshCw, Save, Search, Trash2, Phone, Mail, MapPin, Calendar, Settings } from "lucide-react";
import { toast } from "sonner";

import { adminApi, type LeadCustomFieldSetting, type LeadFollowUp, type LeadFormSettings, type LeadRecord } from "@/services/adminApi";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type LeadStatus = "all" | "fresh" | "contacted" | "follow_up" | "qualified" | "won" | "lost";

const STATUS_OPTIONS: Array<{ value: LeadStatus; label: string }> = [
  { value: "all", label: "All Status" },
  { value: "fresh", label: "Fresh" },
  { value: "contacted", label: "Contacted" },
  { value: "follow_up", label: "Follow-up" },
  { value: "qualified", label: "Qualified" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const LEAD_STATUS_OPTIONS: Array<{ value: Exclude<LeadStatus, "all">; label: string }> = [
  { value: "fresh", label: "Fresh" },
  { value: "contacted", label: "Contacted" },
  { value: "follow_up", label: "Follow-up" },
  { value: "qualified", label: "Qualified" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const DEFAULT_SETTINGS: LeadFormSettings = {
  fields: [
    { key: "name", label: "Full Name", type: "text", enabled: true, mandatory: true },
    { key: "address", label: "Address", type: "text", enabled: true, mandatory: true },
    { key: "mobile", label: "Mobile Number", type: "phone", enabled: true, mandatory: true },
    { key: "email", label: "Email", type: "email", enabled: true, mandatory: false },
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

const CUSTOM_FIELD_TYPES: Array<LeadCustomFieldSetting["type"]> = ["text", "textarea", "number", "select"];

const sanitizeCustomFieldKey = (value: string) => {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return cleaned;
};

const normalizeSettings = (incoming?: LeadFormSettings): LeadFormSettings => {
  const source = incoming || DEFAULT_SETTINGS;
  return {
    fields: Array.isArray(source.fields) && source.fields.length > 0 ? source.fields : DEFAULT_SETTINGS.fields,
    stream: {
      ...DEFAULT_SETTINGS.stream,
      ...(source.stream || {}),
      options: Array.isArray(source.stream?.options)
        ? source.stream.options.map((item) => item.trim()).filter(Boolean)
        : DEFAULT_SETTINGS.stream.options,
    },
    customFields: Array.isArray(source.customFields)
      ? source.customFields.map((field, index) => ({
          key: sanitizeCustomFieldKey(field.key || field.label || `custom_field_${index + 1}`) || `custom_field_${index + 1}`,
          label: String(field.label || `Custom Field ${index + 1}`).trim(),
          type: CUSTOM_FIELD_TYPES.includes(field.type) ? field.type : "text",
          enabled: field.enabled !== false,
          mandatory: field.mandatory === true,
          options: Array.isArray(field.options) ? field.options.map((item) => item.trim()).filter(Boolean) : [],
          placeholder: String(field.placeholder || "").trim(),
        }))
      : [],
  };
};

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdminLeads() {
  const { hasPermission } = useAdminAuth();
  const canEdit = hasPermission("leads", "edit");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeadStatus>("all");
  const [source, setSource] = useState("all");
  const [stream, setStream] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [summary, setSummary] = useState({ total: 0, freshCount: 0, followUpCount: 0, qualifiedCount: 0, wonCount: 0, lostCount: 0 });
  const [isLoading, setIsLoading] = useState(false);

  const [settings, setSettings] = useState<LeadFormSettings>(normalizeSettings(DEFAULT_SETTINGS));
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isFormSettingsOpen, setIsFormSettingsOpen] = useState(false);

  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [followUps, setFollowUps] = useState<LeadFollowUp[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [followUpComment, setFollowUpComment] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState<Exclude<LeadStatus, "all">>("follow_up");
  const [followUpDate, setFollowUpDate] = useState("");
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);

  const loadLeads = async () => {
    try {
      setIsLoading(true);
      const result = await adminApi.listLeads({
        search,
        status,
        source,
        stream,
        from: fromDate || undefined,
        to: toDate || undefined,
        limit: 1000,
      });
      setLeads(result.items || []);
      setSummary(result.summary || { total: 0, freshCount: 0, followUpCount: 0, qualifiedCount: 0, wonCount: 0, lostCount: 0 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load leads");
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      setIsLoadingSettings(true);
      const result = await adminApi.getLeadFormSettings();
      setSettings(normalizeSettings(result.settings));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load lead settings");
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const loadLeadDetails = async (leadId: number) => {
    try {
      setIsLoadingDetail(true);
      const result = await adminApi.getLeadDetails(leadId);
      setSelectedLead(result.lead);
      setFollowUps(result.followUps || []);
      setFollowUpStatus((result.lead.status as Exclude<LeadStatus, "all">) || "follow_up");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load lead details");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    void loadLeads();
    void loadSettings();
  }, []);

  const streamOptions = useMemo(
    () => settings.stream.options.map((item) => item.trim()).filter(Boolean),
    [settings.stream.options],
  );

  const exportToExcel = () => {
    if (leads.length === 0) {
      toast.error("No leads available for export");
      return;
    }

    const rows = leads.map((lead) => ({
      LeadID: lead.id,
      Date: formatDateTime(lead.createdAt),
      Source: lead.source,
      Name: lead.name,
      Address: lead.address,
      Mobile: lead.mobile,
      Email: lead.email || "",
      Stream: (lead.streams || []).join(", "),
      Status: lead.status,
      FollowUpCount: lead.followUpCount || 0,
      LastFollowUp: formatDateTime(lead.latestFollowUpAt || lead.lastFollowUpAt),
      Message: lead.enquiryMessage || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    XLSX.writeFile(workbook, `leads_${fromDate || "start"}_${toDate || "end"}.xlsx`);
  };

  const saveSettings = async () => {
    try {
      setIsSavingSettings(true);
      const nextSettings: LeadFormSettings = {
        ...settings,
        customFields: (settings.customFields || []).map((field, index) => ({
          ...field,
          key: sanitizeCustomFieldKey(field.key || field.label || `custom_field_${index + 1}`) || `custom_field_${index + 1}`,
          label: String(field.label || `Custom Field ${index + 1}`).trim() || `Custom Field ${index + 1}`,
          options: field.type === "select" ? (field.options || []).map((item) => item.trim()).filter(Boolean) : [],
          placeholder: String(field.placeholder || "").trim(),
        })),
        stream: {
          ...settings.stream,
          options: settings.stream.options.map((item) => item.trim()).filter(Boolean),
        },
      };

      const result = await adminApi.saveLeadFormSettings(nextSettings);
      setSettings(normalizeSettings(result.settings || nextSettings));
      toast.success("Lead form settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save lead settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const updateSelectedLeadStatus = async (nextStatus: Exclude<LeadStatus, "all">) => {
    if (!selectedLead) return;
    try {
      const result = await adminApi.updateLeadStatus(selectedLead.id, nextStatus);
      setSelectedLead(result.item);
      setLeads((previous) => previous.map((lead) => (lead.id === result.item.id ? { ...lead, ...result.item } : lead)));
      toast.success("Lead status updated");
      await loadLeads();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update lead status");
    }
  };

  const addFollowUp = async () => {
    if (!selectedLead) return;
    if (!followUpComment.trim()) {
      toast.error("Follow-up comment is required");
      return;
    }

    try {
      setIsSavingFollowUp(true);
      const payload = {
        commentText: followUpComment.trim(),
        status: followUpStatus,
        nextFollowUpAt: followUpDate ? new Date(followUpDate).toISOString() : undefined,
      };

      const result = await adminApi.addLeadFollowUp(selectedLead.id, payload);
      setFollowUps((previous) => [result.followUp, ...previous]);
      setSelectedLead(result.lead);
      setLeads((previous) => previous.map((lead) => (lead.id === result.lead.id ? { ...lead, ...result.lead } : lead)));
      setFollowUpComment("");
      setFollowUpDate("");
      toast.success("Follow-up saved");
      await loadLeads();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add follow-up");
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  const addCustomField = () => {
    const current = settings.customFields || [];
    const baseIndex = current.length + 1;
    const key = `custom_field_${baseIndex}`;
    const nextField: LeadCustomFieldSetting = {
      key,
      label: `Custom Field ${baseIndex}`,
      type: "text",
      enabled: true,
      mandatory: false,
      options: [],
      placeholder: "",
    };
    setSettings((previous) => ({
      ...previous,
      customFields: [...(previous.customFields || []), nextField],
    }));
  };

  const updateCustomField = (index: number, patch: Partial<LeadCustomFieldSetting>) => {
    setSettings((previous) => {
      const next = [...(previous.customFields || [])];
      if (!next[index]) return previous;
      const merged = { ...next[index], ...patch };
      if (merged.type !== "select") {
        merged.options = [];
      }
      next[index] = merged;
      return {
        ...previous,
        customFields: next,
      };
    });
  };

  const removeCustomField = (index: number) => {
    setSettings((previous) => ({
      ...previous,
      customFields: (previous.customFields || []).filter((_item, itemIndex) => itemIndex !== index),
    }));
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string }> = {
      fresh: { bg: "bg-slate-200 text-slate-700", text: "Fresh" },
      contacted: { bg: "bg-slate-300 text-slate-800", text: "Contacted" },
      follow_up: { bg: "bg-amber-100 text-amber-700", text: "Follow-up" },
      qualified: { bg: "bg-violet-100 text-violet-700", text: "Qualified" },
      won: { bg: "bg-emerald-100 text-emerald-700", text: "Won" },
      lost: { bg: "bg-rose-100 text-rose-700", text: "Lost" },
    };
    const config = statusConfig[status] || statusConfig.fresh;
    return <Badge className={`${config.bg} text-xs font-medium px-2 py-0.5`}>{config.text}</Badge>;
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lead Management</h1>
          <p className="text-sm text-slate-500">Manage enquiries, track follow-ups, and export data</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isFormSettingsOpen} onOpenChange={setIsFormSettingsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={isLoadingSettings}>
                <Settings className="h-3.5 w-3.5" />
                Form Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl p-0">
              <DialogHeader className="border-b px-4 py-3">
                <DialogTitle className="text-sm font-semibold">Lead Form Settings</DialogTitle>
              </DialogHeader>
              <div className="max-h-[75vh] overflow-y-auto p-4">
                <div className="space-y-3">
                  {settings.fields.map((field, index) => (
                    <div key={field.key} className="rounded border p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-xs font-medium">{field.label}</p>
                        <div className="flex items-center gap-2 text-[10px]">
                          <label className="flex cursor-pointer items-center gap-1">
                            <input
                              type="checkbox"
                              checked={field.enabled}
                              onChange={(event) => {
                                const next = [...settings.fields];
                                next[index] = { ...field, enabled: event.target.checked };
                                setSettings((prev) => ({ ...prev, fields: next }));
                              }}
                              disabled={!canEdit}
                            />
                            Enabled
                          </label>
                          <label className="flex cursor-pointer items-center gap-1">
                            <input
                              type="checkbox"
                              checked={field.mandatory}
                              onChange={(event) => {
                                const next = [...settings.fields];
                                next[index] = { ...field, mandatory: event.target.checked };
                                setSettings((prev) => ({ ...prev, fields: next }));
                              }}
                              disabled={!canEdit}
                            />
                            Req
                          </label>
                        </div>
                      </div>
                      <Input
                        value={field.label}
                        onChange={(event) => {
                          const next = [...settings.fields];
                          next[index] = { ...field, label: event.target.value };
                          setSettings((prev) => ({ ...prev, fields: next }));
                        }}
                        disabled={!canEdit}
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}

                  <div className="rounded border p-2">
                    <Label className="text-xs font-medium">Stream Label</Label>
                    <Input
                      value={settings.stream.label}
                      onChange={(event) => setSettings((prev) => ({ ...prev, stream: { ...prev.stream, label: event.target.value } }))}
                      disabled={!canEdit}
                      className="mt-1 h-8 text-xs"
                    />
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                      <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={settings.stream.enabled} onChange={(event) => setSettings((prev) => ({ ...prev, stream: { ...prev.stream, enabled: event.target.checked } }))} disabled={!canEdit} />Enabled</label>
                      <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={settings.stream.mandatory} onChange={(event) => setSettings((prev) => ({ ...prev, stream: { ...prev.stream, mandatory: event.target.checked } }))} disabled={!canEdit} />Required</label>
                      <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={settings.stream.allowMultiple} onChange={(event) => setSettings((prev) => ({ ...prev, stream: { ...prev.stream, allowMultiple: event.target.checked } }))} disabled={!canEdit} />Multi</label>
                    </div>
                    <Textarea
                      value={settings.stream.options.join("\n")}
                      onChange={(event) => setSettings((prev) => ({ ...prev, stream: { ...prev.stream, options: event.target.value.split("\n").map((i) => i.trim()).filter(Boolean) } }))}
                      disabled={!canEdit}
                      className="mt-2 h-20 text-xs"
                    />
                  </div>

                  <div className="rounded border p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <Label className="text-xs font-medium">Custom Fields</Label>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addCustomField} disabled={!canEdit}><Plus className="mr-1 h-3 w-3" />Add</Button>
                    </div>
                    <div className="space-y-2">
                      {(settings.customFields || []).map((field, index) => (
                        <div key={`${field.key}-${index}`} className="rounded bg-slate-50 p-2">
                          <div className="mb-1.5 grid grid-cols-2 gap-1.5">
                            <Input value={field.label} onChange={(event) => updateCustomField(index, { label: event.target.value })} placeholder="Label" disabled={!canEdit} className="h-8 text-xs" />
                            <Input value={field.key} onChange={(event) => updateCustomField(index, { key: sanitizeCustomFieldKey(event.target.value) })} placeholder="Key" disabled={!canEdit} className="h-8 text-xs" />
                          </div>
                          <div className="flex items-center gap-2">
                            <select value={field.type} onChange={(event) => updateCustomField(index, { type: event.target.value as LeadCustomFieldSetting["type"] })} className="h-8 rounded border border-input bg-background px-2 text-xs" disabled={!canEdit}>
                              {CUSTOM_FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <Input value={field.placeholder || ""} onChange={(event) => updateCustomField(index, { placeholder: event.target.value })} placeholder="Placeholder" disabled={!canEdit} className="h-8 text-xs" />
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-600" onClick={() => removeCustomField(index)} disabled={!canEdit}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ))}
                      {(settings.customFields || []).length === 0 && <p className="py-2 text-center text-xs text-slate-400">No custom fields</p>}
                    </div>
                  </div>

                  <div className="sticky bottom-0 bg-white pt-2">
                    <Button className="w-full text-xs" onClick={() => void saveSettings()} disabled={!canEdit || isSavingSettings}>
                      {isSavingSettings ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                      Save Settings
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void loadLeads()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
          <Button size="sm" className="gap-1.5" onClick={exportToExcel}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 rounded-md">Total: {summary.total}</span>
        <span className="bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 rounded-md">Fresh: {summary.freshCount}</span>
        <span className="bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 rounded-md">Follow-up: {summary.followUpCount}</span>
        <span className="bg-violet-100 px-3 py-1.5 text-xs font-medium text-violet-700 rounded-md">Qualified: {summary.qualifiedCount}</span>
        <span className="bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700 rounded-md">Won: {summary.wonCount}</span>
        <span className="bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-700 rounded-md">Lost: {summary.lostCount}</span>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." className="h-8 text-sm col-span-2" />
            <select value={status} onChange={(event) => setStatus(event.target.value as LeadStatus)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select value={source} onChange={(event) => setSource(event.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
              <option value="all">All Sources</option>
              <option value="enquiry_now">Enquiry Now</option>
              <option value="contact_us">Contact Us</option>
            </select>
            <select value={stream} onChange={(event) => setStream(event.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">All Streams</option>
              {streamOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-8 text-sm" />
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-8 text-sm" />
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => void loadLeads()}>Apply</Button>
            <Button size="sm" variant="outline" onClick={() => { setSearch(""); setStatus("all"); setSource("all"); setStream(""); setFromDate(""); setToDate(""); }}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Leads ({leads.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Lead</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Status</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Stream</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">FU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr
                        key={lead.id}
                        className={`cursor-pointer border-b hover:bg-slate-50 ${selectedLead?.id === lead.id ? "bg-slate-100" : ""}`}
                        onClick={() => void loadLeadDetails(lead.id)}
                      >
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-900">{lead.name}</p>
                          <p className="text-xs text-slate-500">{lead.mobile}</p>
                        </td>
                        <td className="px-3 py-2">{getStatusBadge(lead.status)}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{(lead.streams || []).join(", ") || "-"}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(lead.createdAt)}</td>
                        <td className="px-3 py-2 text-xs font-medium text-slate-700">{lead.followUpCount || 0}</td>
                      </tr>
                    ))}
                    {!isLoading && leads.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-slate-500 text-xs">No leads found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Tabs defaultValue="details">
            <TabsList className="w-full justify-start h-8">
              <TabsTrigger value="details" className="text-xs px-3">Details</TabsTrigger>
              <TabsTrigger value="formbuilder" className="text-xs px-3">Form Builder</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-3">
              <Card>
                <CardHeader className="py-2 px-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Lead Details</CardTitle>
                    {isLoadingDetail && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  {selectedLead ? (
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-slate-900">{selectedLead.name}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedLead.mobile}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {selectedLead.email || "-"}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {selectedLead.address}</p>
                      </div>

                      {selectedLead.extraData && typeof selectedLead.extraData === "object" && selectedLead.extraData.customFieldValues && typeof selectedLead.extraData.customFieldValues === "object" && (
                        <div className="rounded bg-slate-50 p-2 text-xs">
                          <p className="font-medium text-slate-600 mb-1">Custom Fields</p>
                          {Object.entries(selectedLead.extraData.customFieldValues as Record<string, unknown>).map(([key, value]) => (
                            <p key={key} className="text-slate-600"><span className="font-medium">{key}:</span> {String(value ?? "")}</p>
                          ))}
                        </div>
                      )}

                      <Separator />

                      <div className="space-y-1.5">
                        <Label className="text-xs">Status</Label>
                        <select
                          value={selectedLead.status}
                          onChange={(event) => { const nextStatus = event.target.value as Exclude<LeadStatus, "all">; void updateSelectedLeadStatus(nextStatus); }}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                          disabled={!canEdit}
                        >
                          {LEAD_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </div>

                      <Separator />

                      <div className="space-y-1.5">
                        <Label className="text-xs">Follow-up Note</Label>
                        <Textarea
                          value={followUpComment}
                          onChange={(event) => setFollowUpComment(event.target.value)}
                          placeholder="Notes..."
                          className="min-h-[60px] text-sm"
                          disabled={!canEdit}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select value={followUpStatus} onChange={(event) => setFollowUpStatus(event.target.value as Exclude<LeadStatus, "all">)} className="h-8 rounded-md border border-input bg-background px-2 text-xs" disabled={!canEdit}>
                            {LEAD_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                          <Input type="datetime-local" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} disabled={!canEdit} className="h-8 text-xs" />
                        </div>
                        <Button size="sm" className="w-full" onClick={() => void addFollowUp()} disabled={!canEdit || isSavingFollowUp}>
                          {isSavingFollowUp ? "Saving..." : "Add Follow-up"}
                        </Button>
                      </div>

                      <Separator />

                      <div>
                        <Label className="text-xs mb-1.5 block">History</Label>
                        <ScrollArea className="h-[150px] rounded border p-2">
                          <div className="space-y-2">
                            {followUps.map((item) => (
                              <div key={item.id} className="rounded bg-slate-50 p-2">
                                <div className="flex items-center justify-between mb-1">
                                  {getStatusBadge(item.status)}
                                  <span className="text-[10px] text-slate-400">{formatDateTime(item.createdAt)}</span>
                                </div>
                                <p className="text-xs text-slate-700 whitespace-pre-wrap">{item.commentText}</p>
                              </div>
                            ))}
                            {followUps.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No follow-ups</p>}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-6">Select a lead to view details</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="formbuilder" className="mt-3">
              <Card>
                <CardHeader className="py-2 px-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Form Settings</CardTitle>
                    {isLoadingSettings && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-3">
                    {settings.fields.map((field, index) => (
                      <div key={field.key} className="rounded border p-2">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium">{field.label}</p>
                          <div className="flex items-center gap-2 text-[10px]">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={field.enabled} onChange={(event) => { const next = [...settings.fields]; next[index] = { ...field, enabled: event.target.checked }; setSettings((prev) => ({ ...prev, fields: next })); }} disabled={!canEdit} />Enabled
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={field.mandatory} onChange={(event) => { const next = [...settings.fields]; next[index] = { ...field, mandatory: event.target.checked }; setSettings((prev) => ({ ...prev, fields: next })); }} disabled={!canEdit} />Req
                            </label>
                          </div>
                        </div>
                        <Input value={field.label} onChange={(event) => { const next = [...settings.fields]; next[index] = { ...field, label: event.target.value }; setSettings((prev) => ({ ...prev, fields: next })); }} disabled={!canEdit} className="h-7 text-xs" />
                      </div>
                    ))}

                    <div className="rounded border p-2">
                      <Label className="text-xs font-medium">Stream Label</Label>
                      <Input value={settings.stream.label} onChange={(event) => setSettings((prev) => ({ ...prev, stream: { ...prev.stream, label: event.target.value } }))} disabled={!canEdit} className="h-7 text-xs mt-1" />
                      <div className="mt-1.5 flex flex-wrap gap-2 text-[10px]">
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={settings.stream.enabled} onChange={(event) => setSettings((prev) => ({ ...prev, stream: { ...prev.stream, enabled: event.target.checked } }))} disabled={!canEdit} />Enabled</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={settings.stream.mandatory} onChange={(event) => setSettings((prev) => ({ ...prev, stream: { ...prev.stream, mandatory: event.target.checked } }))} disabled={!canEdit} />Required</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={settings.stream.allowMultiple} onChange={(event) => setSettings((prev) => ({ ...prev, stream: { ...prev.stream, allowMultiple: event.target.checked } }))} disabled={!canEdit} />Multi</label>
                      </div>
                      <Textarea value={settings.stream.options.join("\n")} onChange={(event) => setSettings((prev) => ({ ...prev, stream: { ...prev.stream, options: event.target.value.split("\n").map((i) => i.trim()).filter(Boolean) } }))} disabled={!canEdit} className="h-16 text-xs mt-1" />
                    </div>

                    <div className="rounded border p-2">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-medium">Custom Fields</Label>
                        <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={addCustomField} disabled={!canEdit}><Plus className="w-3 h-3" /> Add</Button>
                      </div>
                      <div className="space-y-2">
                        {(settings.customFields || []).map((field, index) => (
                          <div key={`${field.key}-${index}`} className="rounded bg-slate-50 p-2">
                            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                              <Input value={field.label} onChange={(event) => updateCustomField(index, { label: event.target.value })} placeholder="Label" disabled={!canEdit} className="h-7 text-xs" />
                              <Input value={field.key} onChange={(event) => updateCustomField(index, { key: sanitizeCustomFieldKey(event.target.value) })} placeholder="Key" disabled={!canEdit} className="h-7 text-xs" />
                            </div>
                            <div className="flex items-center gap-2">
                              <select value={field.type} onChange={(event) => updateCustomField(index, { type: event.target.value as LeadCustomFieldSetting["type"] })} className="h-7 rounded border border-input bg-background px-1.5 text-xs" disabled={!canEdit}>
                                {CUSTOM_FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <Input value={field.placeholder || ""} onChange={(event) => updateCustomField(index, { placeholder: event.target.value })} placeholder="Placeholder" disabled={!canEdit} className="h-7 text-xs flex-1" />
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-rose-600" onClick={() => removeCustomField(index)} disabled={!canEdit}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                          </div>
                        ))}
                        {(settings.customFields || []).length === 0 && <p className="text-xs text-slate-400 text-center py-2">No custom fields</p>}
                      </div>
                    </div>

                    <Button className="w-full text-xs" onClick={() => void saveSettings()} disabled={!canEdit || isSavingSettings}>
                      {isSavingSettings ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                      Save Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
