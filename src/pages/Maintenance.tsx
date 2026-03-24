import { Button } from "@/components/ui/button";

export default function Maintenance() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-orange-100 flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white/95 backdrop-blur shadow-xl p-8 text-center space-y-5">
        <div className="inline-flex items-center rounded-full bg-amber-100 px-4 py-1 text-xs font-semibold tracking-wide text-amber-800">
          Scheduled Maintenance
        </div>
        <h1 className="text-3xl font-bold text-slate-900">We are upgrading the platform</h1>
        <p className="text-slate-600 leading-relaxed">
          The website is temporarily unavailable while we complete improvements. Please check back in a few minutes.
        </p>
        <div className="pt-1">
          <Button
            variant="outline"
            className="border-amber-300 text-amber-900 hover:bg-amber-50"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        </div>
      </div>
    </div>
  );
}
