import { Clock, PlayCircle, Globe, User, ShoppingCart, Check } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { Course } from "@/data/courses";
import { useCart } from "@/context/CartContext";
import { resolveUploadAssetUrl } from "@/lib/runtimeUrls";
import confetti from "canvas-confetti";

interface CourseCardProps {
  course: Course;
}

const CourseCard = ({ course }: CourseCardProps) => {
  const { addToCart, removeFromCart, isInCart } = useCart();
  const navigate = useNavigate();
  const inCart = isInCart(course.id);
  const [justAdded, setJustAdded] = useState(false);
  const thumbnailUrl = resolveUploadAssetUrl(course.thumbnail || course.image || "", "/placeholder.svg");

  const openDetails = () => navigate(`/course/${course.id}`);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDetails}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetails();
        }
      }}
      className={`group cursor-pointer bg-background rounded-xl border border-border overflow-hidden transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 flex flex-col shine-sweep ${justAdded ? "ring-2 ring-accent/40 scale-[1.02]" : ""}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={thumbnailUrl}
          alt={course.title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src.endsWith("/placeholder.svg")) return;
            target.src = "/placeholder.svg";
          }}
        />
        
        {/* Badges */}
        <div className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 flex gap-1">
          {course.isCombo && (
            <span className="bg-primary text-primary-foreground text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md uppercase tracking-wide">
              Combo
            </span>
          )}
          {course.isMaterial && (
            <span className="bg-foreground/80 text-primary-foreground text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md uppercase tracking-wide">
              Material
            </span>
          )}
        </div>
        {course.discount > 0 && (
          <div className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 bg-accent text-accent-foreground text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md animate-pulse">
            {course.discount}% OFF
          </div>
        )}
        {course.deliveryModes && course.deliveryModes.length > 0 && (
          <div className="absolute bottom-1.5 right-1.5 sm:bottom-2.5 sm:right-2.5 flex flex-col gap-0.5">
            {course.deliveryModes.slice(0, 2).map((mode) => (
              <span
                key={mode.id}
                className="bg-green-500/20 text-green-700 dark:text-green-400 text-[7px] sm:text-[8px] font-bold px-1 sm:px-1.5 py-0.5 rounded-sm leading-none whitespace-nowrap"
                title={mode.label}
              >
                {mode.label.length > 10 ? mode.id : mode.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-2 sm:p-3.5 flex-1 flex flex-col">
        <h3 className="font-black text-foreground text-[12px] sm:text-[14px] mb-1 sm:mb-1.5 line-clamp-2 min-h-[2rem] sm:min-h-[2.25rem] leading-tight">{course.title}</h3>
        
        <div className="hidden sm:flex items-center gap-1 text-xs font-bold text-foreground mb-2.5">
          <User className="w-3 h-3" />
          <span>{course.professor}</span>
        </div>

        <div className="flex flex-wrap gap-x-2 sm:gap-x-3 gap-y-0.5 text-[9px] sm:text-[11px] text-muted-foreground mb-2 sm:mb-3 pb-2 sm:pb-3 border-b border-border">
          <span className="flex items-center gap-0.5 sm:gap-1">
            <Globe className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-accent/70" /> {course.language}
          </span>
          {course.lectures > 0 && (
            <span className="hidden sm:flex items-center gap-1">
              <PlayCircle className="w-3 h-3 text-accent/70" /> {course.lectures}
            </span>
          )}
          {course.hours > 0 && (
            <span className="flex items-center gap-0.5 sm:gap-1">
              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-accent/70" /> {course.hours}h
            </span>
          )}
        </div>

        <div className="mt-auto">
          <div className="flex items-baseline gap-1 sm:gap-2 mb-2 sm:mb-3">
            <span className="text-sm sm:text-lg font-extrabold text-foreground">₹{course.price.toLocaleString()}</span>
            {course.originalPrice > course.price && (
              <span className="text-[9px] sm:text-xs text-muted-foreground line-through">₹{course.originalPrice.toLocaleString()}</span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-1 sm:gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] sm:text-[11px] h-7 sm:h-8 rounded-lg font-semibold w-full sm:flex-1 tap-bounce hover:scale-105 transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                openDetails();
              }}
            >
              Details
            </Button>
            <Button
              size="sm"
              className={`text-[10px] sm:text-[11px] h-7 sm:h-8 rounded-lg font-semibold shadow-sm w-full sm:flex-1 flex items-center justify-center gap-1 tap-bounce transition-all duration-300 ${
                inCart
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground scale-105"
                  : "bg-accent hover:bg-accent/90 text-accent-foreground hover:scale-105"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (inCart) {
                  removeFromCart(course.id);
                  setJustAdded(false);
                } else {
                  addToCart(course);
                  setJustAdded(true);
                  setTimeout(() => setJustAdded(false), 1000);
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  confetti({
                    particleCount: 50,
                    spread: 60,
                    origin: {
                      x: (rect.left + rect.width / 2) / window.innerWidth,
                      y: (rect.top + rect.height / 2) / window.innerHeight,
                    },
                    colors: ["#E53935", "#1A3A6E", "#FFD700", "#4CAF50"],
                    scalar: 0.7,
                    gravity: 1.2,
                    ticks: 80,
                  });
                }
              }}
            >
              {inCart ? <Check className="w-3 h-3" /> : <ShoppingCart className="w-3 h-3" />}
              {inCart ? "Added" : "Add to Cart"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseCard;
