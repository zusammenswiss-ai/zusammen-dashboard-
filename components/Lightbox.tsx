"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Full-size image viewer — replaces "click an uploaded photo → it just
 * downloads" across the app (Dokumentumok, Kártya-fájlok, Marketing
 * anyagok, Journey emlékek, Termékek, árajánlat-képek) with an in-place
 * preview. Closes on the X button, a click on the darkened backdrop, or
 * Escape. Deliberately not used for the Gold Card Letters envelope photo
 * — that one is blurred/sealed by design (see GoldCardLettersSection)
 * and is never meant to be viewable full-size from the dashboard.
 */
export default function Lightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex animate-fade-in items-center justify-center bg-black/85 p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white/90 hover:bg-black/60 hover:text-white sm:right-6 sm:top-6"
        aria-label="Bezárás"
      >
        <X size={22} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-md object-contain shadow-2xl"
      />
    </div>
  );
}
