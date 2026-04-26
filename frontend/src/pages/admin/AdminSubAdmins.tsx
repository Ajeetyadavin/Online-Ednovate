import { useEffect, useMemo, useState } from "react";
import { useAdminAuth, type AdminAction, type AdminModuleKey } from "@/context/AdminAuthContext";
import { adminApi } from "@/services/adminApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Shield, Trash2, Users, UserCog, Clock, MapPin, Check, X } from "lucide-react";
import { useConfirm } from "@/context/ConfirmContext";

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
  "masters",
  "coupons",
  "faculty",
  "homepage",
  "users",
  "orders",
  "leads",
  "announcements",
  "technical-support",
  "marketing",
  "settings",
  "subadmins",
  "logs",
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
  const { confirm } = useConfirm();
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
    const isConfirmed = await confirm({ title: "Delete Sub-Admin?", description: `Delete ${item.email}?` });
    if (!isConfirmed) return;
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Users className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sub Admin Management</h1>
            <p className="text-gray-500 text-sm">Create sub-admins and manage their permissions</p>
          </div>
        </div>
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

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-gray-100">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCog className="w-4 h-4 text-orange-600" />
            Create Sub Admin
          </CardTitle>
          <CardDescription>Configure permissions for each module</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Full Name</label>
              <Input 
                placeholder="Enter full name" 
                value={form.name} 
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="h-10 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input 
                placeholder="Enter email" 
                value={form.email} 
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="h-10 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Password</label>
              <Input 
                type="password" 
                placeholder="Enter password" 
                value={form.password} 
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                className="h-10 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="font-semibold text-gray-700 w-48">Module</TableHead>
                  {ACTIONS.map((action) => (
                    <TableHead key={action} className="text-center font-semibold text-gray-700">
                      <span className="uppercase text-xs">{action}</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {MODULES.map((module) => (
                  <TableRow key={module}>
                    <TableCell className="font-medium text-gray-900">{module}</TableCell>
                    {ACTIONS.map((action) => (
                      <TableCell key={`${module}-${action}`} className="text-center">
                        <button
                          type="button"
                          onClick={() => togglePermission(module, action)}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                            form.permissions[module][action]
                              ? "bg-orange-100 text-orange-600"
                              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                          }`}
                        >
                          {form.permissions[module][action] ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </button>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <Switch 
                checked={form.isActive} 
                onCheckedChange={(value) => setForm((prev) => ({ ...prev, isActive: value }))} 
              />
              <span className="text-sm text-gray-700">Account Active</span>
            </div>
            <Button onClick={handleCreate} disabled={!canCreate || isSaving} className="gap-2 bg-orange-600 hover:bg-orange-700">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Sub Admin
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-gray-100">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-600" />
            Sub Admin Accounts
          </CardTitle>
          <CardDescription>Manage accounts and monitor login activity</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-600" />
              <p>Loading accounts...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedItems.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        {item.isSuperAdmin ? (
                          <Badge className="bg-purple-100 text-purple-700">Super Admin</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700">Sub Admin</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{item.email}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last login: {formatDateTime(item.lastLoginAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          IP: {item.lastLoginIp || "-"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
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
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={!canDelete || item.isSuperAdmin}
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {MODULES.filter((module) => item.permissions?.[module]?.read).map((module) => (
                      <Badge key={`${item.id}-${module}`} variant="outline" className="text-xs bg-gray-50">
                        <Shield className="w-3 h-3 mr-1 text-gray-500" />
                        {module}
                      </Badge>
                    ))}
                    {MODULES.filter((module) => item.permissions?.[module]?.create).length === 0 && 
                     MODULES.filter((module) => item.permissions?.[module]?.read).length === 0 && (
                      <span className="text-xs text-gray-400">No permissions assigned</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-gray-100">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-600" />
            Audit Logs
          </CardTitle>
          <CardDescription>Track all admin actions with timestamps and IP addresses</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="w-40 font-semibold text-gray-700">Time</TableHead>
                  <TableHead className="font-semibold text-gray-700">Admin</TableHead>
                  <TableHead className="font-semibold text-gray-700">Action</TableHead>
                  <TableHead className="font-semibold text-gray-700">Module</TableHead>
                  <TableHead className="font-semibold text-gray-700">Target</TableHead>
                  <TableHead className="font-semibold text-gray-700 w-28">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-gray-50">
                    <TableCell className="py-3 whitespace-nowrap text-sm text-gray-600">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-gray-900">
                      {log.admin_email || "system"}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="outline" className="uppercase text-xs font-medium bg-gray-50">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-gray-600">{log.module_key}</TableCell>
                    <TableCell className="py-3 text-xs text-gray-600">{log.target_type || "-"}:{log.target_id || "-"}</TableCell>
                    <TableCell className="py-3 text-xs text-gray-500">{log.ip_address || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
