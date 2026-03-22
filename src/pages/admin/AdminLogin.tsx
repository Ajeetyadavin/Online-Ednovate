import { useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Mail, AlertCircle, Loader2 } from "lucide-react";

export default function AdminLogin() {
  const { isAuthenticated, login, isLoading } = useAdminAuth();
  const [email, setEmail] = useState("admin@ednovate.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || "Login failed");
    }

    setIsSubmitting(false);
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

              <div className="pt-4 border-t border-orange-100 bg-orange-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
                <p className="text-xs font-semibold text-gray-700 mb-2">Demo Credentials:</p>
                <p className="text-xs text-gray-600">📧 Email: admin@ednovate.com</p>
                <p className="text-xs text-gray-600">🔐 Password: admin123</p>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-gray-500 text-xs mt-6">Protected Admin Area © Ednovate {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
