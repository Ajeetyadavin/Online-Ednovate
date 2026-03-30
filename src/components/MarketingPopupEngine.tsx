import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X, Megaphone, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlatformData } from "@/context/PlatformDataContext";
import { marketingApi, type ActiveMarketingCampaign } from "@/services/marketingApi";
import EnquiryModal from "@/components/EnquiryModal";

const SESSION_KEY = "ednovate_marketing_session_id";

const getMarketingSessionId = () => {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = `mkt-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  sessionStorage.setItem(SESSION_KEY, next);
  return next;
};

const extractCourseIdFromPath = (pathName: string) => {
  const learnMatch = pathName.match(/^\/learn\/([^/]+)/);
  if (learnMatch?.[1]) return learnMatch[1];
  const courseMatch = pathName.match(/^\/course\/([^/]+)/);
  if (courseMatch?.[1]) return courseMatch[1];
  return "";
};

const normalizeUploadUrl = (url?: string) => {
  const value = String(url || "").trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/uploads/")) return value.replace(/^\/uploads\//, "/api/uploads/");
  return value;
};

const MarketingPopupEngine = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { courses } = usePlatformData();

  const [activeCampaign, setActiveCampaign] = useState<ActiveMarketingCampaign | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);
  const [sessionId] = useState(() => getMarketingSessionId());
  const pageStartRef = useRef<number>(Date.now());
  const lastShownCampaignRef = useRef<number | null>(null);

  const pathName = location.pathname;
  const courseId = useMemo(() => extractCourseIdFromPath(pathName), [pathName]);
  const linkedCourse = useMemo(() => courses.find((course) => course.id === courseId), [courses, courseId]);
  const subject = linkedCourse?.subcategory || linkedCourse?.category || "";
  const language = linkedCourse?.language || "";

  const loadCampaign = async () => {
    try {
      const pageSeconds = Math.max(0, Math.floor((Date.now() - pageStartRef.current) / 1000));
      const response = await marketingApi.getActiveCampaigns({
        path: pathName,
        sessionId,
        pageSeconds,
        courseId,
        subject,
        language,
      });
      const first = response.items?.[0] || null;
      if (!first) {
        setActiveCampaign(null);
        setIsVisible(false);
        return;
      }

      setActiveCampaign(first);
      setIsVisible(true);
    } catch {
      // Ignore marketing fetch errors so learning flow is never blocked.
    }
  };

  useEffect(() => {
    pageStartRef.current = Date.now();
    setIsVisible(false);
    setActiveCampaign(null);
    setIsEnquiryModalOpen(false);

    void loadCampaign();
    const timer = window.setInterval(() => {
      void loadCampaign();
    }, 15000);

    return () => window.clearInterval(timer);
  }, [pathName, sessionId, courseId, subject, language]);

  useEffect(() => {
    if (!activeCampaign || !isVisible) return;
    if (lastShownCampaignRef.current === activeCampaign.id) return;

    lastShownCampaignRef.current = activeCampaign.id;
    void marketingApi.trackEvent({
      campaignId: activeCampaign.id,
      eventType: "shown",
      sessionId,
      pathName,
    }).catch(() => {});
  }, [activeCampaign, isVisible, sessionId, pathName]);

  const handleDismiss = () => {
    if (!activeCampaign) return;
    setIsVisible(false);
    setIsEnquiryModalOpen(false);
    void marketingApi.trackEvent({
      campaignId: activeCampaign.id,
      eventType: "dismissed",
      sessionId,
      pathName,
    }).catch(() => {});
  };

  const handleCtaClick = () => {
    if (!activeCampaign) return;
    void marketingApi.trackEvent({
      campaignId: activeCampaign.id,
      eventType: "clicked",
      sessionId,
      pathName,
    }).catch(() => {});

    if (activeCampaign.ctaUrl) {
      if (activeCampaign.ctaUrl.startsWith("http://") || activeCampaign.ctaUrl.startsWith("https://")) {
        window.open(activeCampaign.ctaUrl, "_blank", "noopener,noreferrer");
      } else {
        navigate(activeCampaign.ctaUrl);
      }
    }
  };

  if (!activeCampaign || !isVisible) return null;

  const resolvedMediaUrl = normalizeUploadUrl(activeCampaign.mediaUrl);

  if (activeCampaign.contentType === "enquiry_form") {
    return (
      <EnquiryModal
        open={isEnquiryModalOpen || isVisible}
        onOpenChange={(open) => {
          setIsEnquiryModalOpen(open);
          if (!open) {
            handleDismiss();
          }
        }}
      />
    );
  }

  const isAlert = activeCampaign.contentType === "alert";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4">
      <div className={`w-full max-w-xl rounded-2xl border bg-white shadow-2xl overflow-hidden ${isAlert ? "border-amber-200" : "border-slate-200"}`}>
        <div className={`px-5 py-3 flex items-center justify-between ${isAlert ? "bg-amber-50" : "bg-slate-50"}`}>
          <div className="flex items-center gap-2">
            {isAlert ? <AlertTriangle className="w-4 h-4 text-amber-600" /> : <Megaphone className="w-4 h-4 text-cyan-700" />}
            <p className="text-sm font-bold text-slate-900">{activeCampaign.title}</p>
            <Badge variant="secondary" className="text-[10px] uppercase">{activeCampaign.contentType}</Badge>
          </div>
          {activeCampaign.isDismissible && (
            <button
              type="button"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              onClick={handleDismiss}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {activeCampaign.message && (
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{activeCampaign.message}</p>
          )}

          {(activeCampaign.contentType === "banner" || activeCampaign.contentType === "text" || activeCampaign.contentType === "alert") && resolvedMediaUrl && (
            <img src={resolvedMediaUrl} alt={activeCampaign.title} className="w-full rounded-xl border border-slate-200 max-h-64 object-cover" />
          )}

          {activeCampaign.contentType === "video" && resolvedMediaUrl && (
            <video controls autoPlay muted className="w-full rounded-xl border border-slate-200 max-h-80 bg-black" src={resolvedMediaUrl} />
          )}

          {activeCampaign.contentType === "pdf" && resolvedMediaUrl && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <iframe title={activeCampaign.title} src={resolvedMediaUrl} className="w-full h-80" />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            {activeCampaign.isDismissible && (
              <Button variant="outline" onClick={handleDismiss}>Close</Button>
            )}
            {activeCampaign.ctaText && activeCampaign.ctaUrl && (
              <Button className="gap-1.5" onClick={handleCtaClick}>
                {activeCampaign.ctaText} <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketingPopupEngine;
