import { useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Mail, AlertCircle, Loader2 } from "lucide-react";

export default function AdminLogin() {
  const { isAuthenticated, login, isLoading } = useAdminAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [isConfirmingLogin, setIsConfirmingLogin] = useState(false);
  const redirectTo = typeof location.state === "object" && location.state && "from" in location.state
    ? String((location.state as { from?: { pathname?: string } }).from?.pathname || "/admin/dashboard")
    : "/admin/dashboard";

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await login(email, password);
    if (!result.success) {
      if (result.requiresConfirmation) {
        setConfirmationMessage(result.error || "This account is already logged in from another place. Do you want to login here?");
        setShowConfirmModal(true);
      } else {
        setError(result.error || "Login failed");
      }
    } else {
      setError("");
    }

    setIsSubmitting(false);
  };

  const handleConfirmLogin = async () => {
    setIsConfirmingLogin(true);
    const forcedResult = await login(email, password, { forceLogin: true });
    if (!forcedResult.success) {
      setError(forcedResult.error || "Login failed");
      setShowConfirmModal(false);
    } else {
      setError("");
      setShowConfirmModal(false);
    }
    setIsConfirmingLogin(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-orange-50 to-orange-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-2000" />

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">E</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Ednovate</h1>
          <p className="text-gray-600 font-medium">Admin Control Panel</p>
          <p className="text-gray-500 text-sm mt-1">Manage courses, students & content</p>
        </div>

        {/* Login Card */}
        <Card className="border-0 shadow-2xl bg-white">
          <CardHeader className="space-y-2 pb-6 border-b border-orange-100">
            <CardTitle className="text-2xl text-gray-900">Welcome Back</CardTitle>
            <CardDescription className="text-gray-600">Sign in to your admin account</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-orange-400" />
                  <Input
                    type="email"
                    placeholder="admin@ednovate.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting || isLoading}
                    className="pl-10 bg-gray-50 border-gray-200 focus:bg-white focus:border-orange-400 transition"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-orange-400" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting || isLoading}
                    className="pl-10 bg-gray-50 border-gray-200 focus:bg-white focus:border-orange-400 transition"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="w-full h-11 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold shadow-lg"
              >
                {isSubmitting || isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In to Admin"
                )}
              </Button>

            </form>
          </CardContent>
        </Card>

        <p className="text-center text-gray-500 text-xs mt-6">Protected Admin Area © Ednovate {new Date().getFullYear()}</p>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-6">
              <h2 className="text-xl font-bold text-gray-900">Account Already Active</h2>
              <p className="mt-1 text-sm text-gray-600">Session detected from another location</p>
            </div>
            
            <div className="px-6 py-6">
              <div className="mb-6 space-y-3">
                <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-900 font-medium">{confirmationMessage}</p>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <p>Your account is currently logged in from another location. If you continue, that session will be logged out.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isConfirmingLogin}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLogin}
                  disabled={isConfirmingLogin}
                  className="flex-1 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isConfirmingLogin && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isConfirmingLogin ? "Logging in..." : "Login Here"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
