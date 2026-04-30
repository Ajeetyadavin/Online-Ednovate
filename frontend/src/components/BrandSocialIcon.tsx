type BrandSocialIconProps = {
  brand: "facebook" | "instagram" | "youtube" | "linkedin" | "whatsapp" | "twitter";
  className?: string;
};

const baseClasses = "inline-flex items-center justify-center overflow-hidden rounded-xl text-white shadow-sm";

const WhatsAppGlyph = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
    <path d="M12.04 2.003a9.93 9.93 0 0 0-8.46 15.13L2 22l5.03-1.54A9.93 9.93 0 1 0 12.04 2.003Zm0 18.06a8.03 8.03 0 0 1-4.1-1.12l-.29-.17-2.98.91.92-2.9-.19-.3a8.03 8.03 0 1 1 6.64 3.58Zm4.62-6.5c-.25-.12-1.48-.73-1.7-.81-.23-.08-.39-.12-.55.12-.16.25-.64.8-.78.97-.14.16-.28.18-.53.06-.25-.13-1.06-.39-2.01-1.24-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.01-.39.11-.52.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.47-.4-.4-.55-.41h-.47c-.16 0-.42.06-.63.31-.21.25-.8.77-.8 1.87 0 1.1.81 2.16.92 2.31.11.16 1.58 2.41 3.83 3.38.54.23.96.37 1.3.48.54.17 1.03.15 1.41.09.43-.06 1.32-.54 1.51-1.07.19-.53.19-.99.13-1.08-.05-.09-.21-.15-.46-.27Z" />
  </svg>
);

const BrandSocialIcon = ({ brand, className = "h-10 w-10" }: BrandSocialIconProps) => {
  if (brand === "facebook") {
    return (
      <span className={`${baseClasses} ${className} rounded-full bg-[#1877F2]`}>
        <span className="translate-y-1 text-[30px] font-black leading-none">f</span>
      </span>
    );
  }

  if (brand === "instagram") {
    return (
      <span className={`${baseClasses} ${className} bg-[radial-gradient(circle_at_30%_110%,#fdf497_0%,#fdf497_13%,#fd5949_32%,#d6249f_58%,#285AEB_100%)]`}>
        <span className="relative h-[56%] w-[56%] rounded-lg border-[2.5px] border-white">
          <span className="absolute left-1/2 top-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.2px] border-white" />
          <span className="absolute right-[13%] top-[13%] h-[12%] w-[12%] rounded-full bg-white" />
        </span>
      </span>
    );
  }

  if (brand === "youtube") {
    return (
      <span className={`${baseClasses} ${className} rounded-lg bg-[#FF0000]`}>
        <span className="ml-0.5 h-0 w-0 border-y-[8px] border-l-[13px] border-y-transparent border-l-white" />
      </span>
    );
  }

  if (brand === "linkedin") {
    return (
      <span className={`${baseClasses} ${className} rounded-md bg-[#0A66C2]`}>
        <span className="text-[23px] font-black leading-none tracking-tight">in</span>
      </span>
    );
  }

  if (brand === "whatsapp") {
    return (
      <span className={`${baseClasses} ${className} rounded-full bg-[#25D366]`}>
        <WhatsAppGlyph className="h-[72%] w-[72%]" />
      </span>
    );
  }

  return (
    <span className={`${baseClasses} ${className} rounded-full bg-black`}>
      <span className="text-lg font-black leading-none">X</span>
    </span>
  );
};

export { BrandSocialIcon, WhatsAppGlyph };
