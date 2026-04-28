import { Clock, Globe, ShoppingCart, Check, FileText, Target } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { ManagedTestPaper } from "@/context/PlatformDataContext";
import { useCart } from "@/context/CartContext";
import { resolveUploadAssetUrl } from "@/lib/runtimeUrls";
import confetti from "canvas-confetti";

interface TestPaperCardProps {
  paper: ManagedTestPaper;
}

const TestPaperCard = ({ paper }: TestPaperCardProps) => {
  const { addToCart, removeFromCart, isInCart } = useCart();
  const navigate = useNavigate();
  const inCart = isInCart(paper.id);
  const [justAdded, setJustAdded] = useState(false);
  const thumbnailUrl = resolveUploadAssetUrl(paper.thumbnailUrl || "", "");
  const openDetails = () => navigate(`/test-series/${paper.id}`);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inCart) {
      removeFromCart(paper.id);
      setJustAdded(false);
      return;
    }
    addToCart(paper);
    setJustAdded(true);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ["#E53935", "#1A3A6E", "#FFD700", "#4CAF50"],
      scalar: 0.7,
      gravity: 1.2,
      ticks: 80,
    });
    setTimeout(() => setJustAdded(false), 1000);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDetails}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetails();
        }
      }}
      className={`group cursor-pointer bg-background rounded-xl border border-border overflow-hidden transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 flex flex-col shine-sweep ${justAdded ? "ring-2 ring-accent/40 scale-[1.02]" : ""}`}
    >
      {/* Visual Header */}
      <div className="relative aspect-video bg-gradient-to-br from-accent/10 via-accent/5 to-background flex items-center justify-center overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={paper.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <>
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_25%_25%,#000_1px,transparent_1px)] bg-[length:20px_20px]"></div>
            </div>
            <div className="relative bg-background p-4 rounded-2xl shadow-sm border border-accent/20 group-hover:scale-110 transition-transform duration-500">
              <FileText className="w-10 h-10 text-accent" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-background">
                <Check className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
          </>
        )}
        {thumbnailUrl && <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/25 to-transparent" />}
        
        <div className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5">
          <span className="bg-primary text-primary-foreground text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md uppercase tracking-wide shadow-sm">
            {paper.nature}
          </span>
        </div>
        
        {paper.originalPrice && paper.originalPrice > paper.price && (
          <div className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 bg-accent text-accent-foreground text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md">
            SAVE ₹{(paper.originalPrice - paper.price).toLocaleString()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-2 sm:p-3.5 flex-1 flex flex-col text-left">
        <div className="flex items-start justify-between gap-2 mb-1 sm:mb-1.5">
          <h3 className="font-black text-foreground text-[12px] sm:text-[14px] line-clamp-2 min-h-[2rem] sm:min-h-[2.25rem] leading-tight flex-1 text-left">
            {paper.title}
          </h3>
          <span className="hidden sm:inline-flex text-[10px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded uppercase">
            {paper.paperCode}
          </span>
        </div>
        
        <div className="flex flex-wrap gap-x-2 sm:gap-x-3 gap-y-0.5 text-[9px] sm:text-[11px] text-muted-foreground mb-2 sm:mb-3 pb-2 sm:pb-3 border-b border-border">
          <span className="flex items-center gap-0.5 sm:gap-1 font-medium">
            <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-accent/70" /> {paper.totalTime} Mins
          </span>
          <span className="flex items-center gap-0.5 sm:gap-1 font-medium">
            <Target className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-500/70" /> {paper.passingPercent}%
          </span>
          <span className="hidden sm:flex items-center gap-1 font-medium">
            <Globe className="w-3 h-3 text-blue-500/70" /> {paper.attemptsAllowed > 1 ? `${paper.attemptsAllowed} Attempts` : "Single Attempt"}
          </span>
        </div>

        <div className="mt-auto">
          <div className="flex items-baseline gap-1 sm:gap-2 mb-2 sm:mb-3">
            <span className="text-sm sm:text-lg font-extrabold text-foreground">₹{paper.price.toLocaleString()}</span>
            {paper.originalPrice && paper.originalPrice > paper.price && (
              <span className="text-[9px] sm:text-xs text-muted-foreground line-through">
                ₹{paper.originalPrice.toLocaleString()}
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-1 sm:gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openDetails();
              }}
              className="text-[10px] sm:text-[11px] h-7 sm:h-8 rounded-lg font-semibold w-full sm:flex-1 tap-bounce hover:scale-105 transition-transform"
            >
              Details
            </Button>
            <Button
              size="sm"
              onClick={handleAddToCart}
              className={`text-[10px] sm:text-[11px] h-7 sm:h-8 rounded-lg font-semibold shadow-sm w-full sm:flex-1 flex items-center justify-center gap-1 tap-bounce transition-all duration-300 ${
                inCart 
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground scale-105" 
                  : "bg-accent hover:bg-accent/90 text-accent-foreground hover:scale-105"
              }`}
            >
              {inCart ? (
                <>
                  <Check className="w-3 h-3" /> Added
                </>
              ) : (
                <>
                  <ShoppingCart className="w-3 h-3" /> Add to Cart
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPaperCard;
