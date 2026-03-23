import { useEffect, useMemo, useState } from "react";
import { useAdminAuth, type AdminAction, type AdminModuleKey } from "@/context/AdminAuthContext";
import { adminApi } from "@/services/adminApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Shield, Trash2 } from "lucide-react";

type PermissionCell = Record<AdminAction, boolean>;
type PermissionMap = Record<AdminModuleKey, PermissionCell>;

type SubAdminItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isSuperAdmin?: boolean;
  permissions: PermissionMap;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
  lastLoginIp?: string;
};

type AuditLogItem = {
  id: number;
  admin_email?: string;
  action: string;
  module_key: string;
  target_type?: string;
  target_id?: string;
  ip_address?: string;
  created_at: string;
  details?: Record<string, unknown>;
};

const MODULES: AdminModuleKey[] = [
  "dashboard",
  "courses",
  "course-content",
  "categories",
  "coupons",
  "faculty",
  "homepage",
  "users",
  "orders",
  "announcements",
  "technical-support",
  "marketing",
  "settings",
  "subadmins",
];

const ACTIONS: AdminAction[] = ["read", "create", "edit", "delete"];

const buildDefaultPermissions = (): PermissionMap =>
  Object.fromEntries(
    MODULES.map((module) => [module, { read: false, create: false, edit: false, delete: false }]),
  ) as PermissionMap;

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdminSubAdmins() {
  const { hasPermission } = useAdminAuth();
  const [items, setItems] = useState<SubAdminItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "sub_admin",
    isActive: true,
    permissions: buildDefaultPermissions(),
  });

  const canCreate = hasPermission("subadmins", "create");
  const canEdit = hasPermission("subadmins", "edit");
  const canDelete = hasPermission("subadmins", "delete");

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [subAdminsResponse, auditResponse] = await Promise.all([
        adminApi.listSubAdmins(),
        adminApi.listAdminAuditLogs(150),
      ]);
      setItems((subAdminsResponse.items || []) as SubAdminItem[]);
      setAuditLogs((auditResponse.items || []) as AuditLogItem[]);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sub-admin module");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const togglePermission = (module: AdminModuleKey, action: AdminAction) => {
    setForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [module]: {
          ...prev.permissions[module],
          [action]: !prev.permissions[module][action],
        },
      },
    }));
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError("Name, email and password required");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      await adminApi.createSubAdmin({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        isActive: form.isActive,
        permissions: form.permissions,
      });
      setSuccess("Sub-admin created successfully");
      setForm({
        name: "",
        email: "",
        password: "",
        role: "sub_admin",
        isActive: true,
        permissions: buildDefaultPermissions(),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sub-admin");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (item: SubAdminItem, isActive: boolean) => {
    if (!canEdit || item.isSuperAdmin) return;
    try {
      await adminApi.updateSubAdmin(item.id, {
        ...item,
        isActive,
        password: "",
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleDelete = async (item: SubAdminItem) => {
    if (!canDelete || item.isSuperAdmin) return;
    if (!confirm(`Delete ${item.email}?`)) return;
    try {
      await adminApi.deleteSubAdmin(item.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete sub-admin");
    }
  };

  const sortedItems = useMemo(() => [...items].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))), [items]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sub Admin Management</h1>
        <p className="text-gray-600 mt-1">Create sub-admins, assign module permissions, and track every action log.</p>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create Sub Admin</CardTitle>
          <CardDescription>Configure who can read, create, edit, or delete for each module.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="Full name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            <Input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Module</th>
                  {ACTIONS.map((action) => (
                    <th key={action} className="text-center p-2 uppercase text-xs">{action}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((module) => (
                  <tr key={module} className="border-t">
                    <td className="p-2 font-medium">{module}</td>
                    {ACTIONS.map((action) => (
                      <td key={`${module}-${action}`} className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={form.permissions[module][action]}
                          onChange={() => togglePermission(module, action)}
                          className="w-4 h-4"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(value) => setForm((prev) => ({ ...prev, isActive: value }))} />
              <span className="text-sm text-gray-700">Account Active</span>
            </div>
            <Button onClick={handleCreate} disabled={!canCreate || isSaving} className="gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Sub Admin
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sub Admin Accounts</CardTitle>
          <CardDescription>Enable/disable accounts and monitor last login IP/time.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-gray-500">Loading accounts...</div>
          ) : (
            <div className="space-y-3">
              {sortedItems.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        {item.isSuperAdmin ? <Badge>Super Admin</Badge> : <Badge variant="secondary">Sub Admin</Badge>}
                      </div>
                      <p className="text-sm text-gray-600">{item.email}</p>
                      <p className="text-xs text-gray-500 mt-1">Last login: {formatDateTime(item.lastLoginAt)} | IP: {item.lastLoginIp || "-"}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">Active</span>
                        <Switch
                          checked={item.isActive}
                          disabled={!canEdit || item.isSuperAdmin}
                          onCheckedChange={(value) => handleToggleActive(item, value)}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-red-600"
                        disabled={!canDelete || item.isSuperAdmin}
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {MODULES.filter((module) => item.permissions?.[module]?.read).map((module) => (
                      <Badge key={`${item.id}-${module}`} variant="outline" className="text-xs">
                        <Shield className="w-3 h-3 mr-1" />
                        {module}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>Every login and action (create/edit/delete/view) is logged with IP and timestamp.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Admin</th>
                  <th className="text-left p-2">Action</th>
                  <th className="text-left p-2">Module</th>
                  <th className="text-left p-2">Target</th>
                  <th className="text-left p-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="p-2">{log.admin_email || "system"}</td>
                    <td className="p-2 uppercase font-medium">{log.action}</td>
                    <td className="p-2">{log.module_key}</td>
                    <td className="p-2">{log.target_type || "-"}:{log.target_id || "-"}</td>
                    <td className="p-2">{log.ip_address || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
