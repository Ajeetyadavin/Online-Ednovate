import type { CSSProperties } from "react";
import { usePlatformData } from "@/context/PlatformDataContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const BRAND = "#E74623";

const AnnouncementBar = () => {
  const { announcements } = usePlatformData();
  const visibleAnnouncements = announcements.filter((a) => a.isVisible);
  const { settings } = useSiteSettings();
  const speedSeconds = settings.header.announcementSpeedSeconds || 18;
  const announcementBarSettings = settings.header.announcementBar;

  const liveLabel = announcementBarSettings?.liveLabel || "LIVE";
  const backgroundColor = announcementBarSettings?.backgroundColor || "#FFFFFF";
  const borderColor = announcementBarSettings?.borderColor || BRAND;
  const badgeBackgroundColor = announcementBarSettings?.badgeBackgroundColor || BRAND;
  const badgeTextColor = announcementBarSettings?.badgeTextColor || "#FFFFFF";
  const textColor = announcementBarSettings?.textColor || "#5C1A0D";
  const titleColor = announcementBarSettings?.titleColor || textColor;
  const bulletColor = announcementBarSettings?.bulletColor || BRAND;
  const fontSizePx = announcementBarSettings?.fontSizePx || 14;
  const mobileFontSizePx = announcementBarSettings?.mobileFontSizePx || 12;

  if (visibleAnnouncements.length === 0) return null;

  const doubled = [...visibleAnnouncements, ...visibleAnnouncements];

  return (
    <>
      <style>{`
        @keyframes aticker-ring {
          0%   { transform: translate(-50%, -50%) scale(0.6); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(2);   opacity: 0; }
        }
        @keyframes aticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .aticker-ring {
          animation: aticker-ring 1.8s ease-out infinite;
        }
        .aticker-track {
          animation: aticker-scroll var(--ticker-duration, 18s) linear infinite;
        }
        .aticker-track:hover {
          animation-play-state: paused;
        }
        @media (max-width: 639px) {
          .announcement-bar-wrap {
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
            height: 38px !important;
          }
          .aticker-label-block {
            width: 76px !important;
            gap: 5px !important;
          }
          .aticker-live-text {
            font-size: 9px !important;
          }
          .aticker-left-fade {
            left: 76px !important;
            width: 24px !important;
          }
          .aticker-scroll-container {
            left: 76px !important;
          }
          .aticker-item-text {
            font-size: var(--ticker-mobile-font-size, 12px) !important;
            padding: 0 18px !important;
          }
        }
      `}</style>

      <section className="bg-background">
        <div
          className="announcement-bar-wrap"
          style={{
            position: "relative",
            background: backgroundColor,
            border: `1.5px solid ${borderColor}`,
            borderRadius: "10px",
            height: "44px",
            overflow: "hidden",
            display: "flex",
            alignItems: "stretch",
            ["--ticker-mobile-font-size" as string]: `${mobileFontSizePx}px`,
          }}
        >
          {/* ── Left label block ── */}
          <div
            className="aticker-label-block"
            style={{
              background: badgeBackgroundColor,
              flexShrink: 0,
              width: "100px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "0 14px",
              zIndex: 3,
              position: "relative",
            }}
          >
            {/* Pulse dot with animated ring */}
            <span
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "14px",
                height: "14px",
                flexShrink: 0,
              }}
            >
              <span
                className="aticker-ring"
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  border: `1.5px solid ${badgeTextColor}`,
                  opacity: 0.6,
                }}
              />
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: badgeTextColor,
                  flexShrink: 0,
                  position: "relative",
                  zIndex: 1,
                }}
              />
            </span>

            {/* LIVE label */}
            <span
              className="aticker-live-text"
              style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: "10px",
                fontWeight: 800,
                color: badgeTextColor,
                letterSpacing: "0.1em",
                whiteSpace: "nowrap",
              }}
            >
              {liveLabel}
            </span>
          </div>

          {/* ── Left fade ── */}
          <div
            className="aticker-left-fade"
            style={{
              position: "absolute",
              left: "100px",
              top: 0,
              bottom: 0,
              width: "40px",
              background: `linear-gradient(to right, ${backgroundColor}, transparent)`,
              zIndex: 2,
              pointerEvents: "none",
            }}
          />

          {/* ── Right fade ── */}
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: "60px",
              background: `linear-gradient(to left, ${backgroundColor}, transparent)`,
              zIndex: 2,
              pointerEvents: "none",
            }}
          />

          {/* ── Scrolling track container ── */}
          <div
            className="aticker-scroll-container"
            style={{
              position: "absolute",
              left: "100px",
              right: 0,
              top: 0,
              bottom: 0,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              className="aticker-track"
              style={{
                display: "flex",
                alignItems: "center",
                whiteSpace: "nowrap",
                ["--ticker-duration" as string]: `${speedSeconds}s`,
              } as CSSProperties}
            >
              {doubled.map((item, i) => (
                <span
                  key={i}
                  className="aticker-item-text"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: `${fontSizePx}px`,
                    fontWeight: 400,
                    color: textColor,
                    padding: "0 30px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      fontWeight: 500,
                      color: titleColor,
                    }}
                  >
                    {item.title}:
                  </span>
                  {item.content}
                  <span style={{ color: bulletColor, fontSize: "18px", lineHeight: "1" }}>•</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default AnnouncementBar;
