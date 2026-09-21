"use client";

import { useEffect, useRef, useState } from "react";
import { X, Upload, Trash2, AlignLeft, AlignCenter, AlignRight, Eye, EyeOff, Check } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CardTemplate, CardTextAlign } from "@/lib/supabase/types";
import BackButton from "@/components/BackButton";
import { CARD_COLOR_PALETTE, computeGuideRects, readableTextColor } from "@/lib/card-canvas";
import { templatePixelDims } from "@/lib/card-template";
import { resolveSignedUrl } from "@/lib/signed-storage-url";
import { errorMessage } from "@/lib/errors";

const STORAGE_BUCKET = "card-designer";
const PREVIEW_WIDTH_PX = 280;

export type CardDesign = {
  background_color: string | null;
  image_url: string | null;
  image_x: number;
  image_y: number;
  image_scale: number;
  text_font_size: number;
  text_align: CardTextAlign;
};

/**
 * Egyszerű, vizuális Kártyaszerkesztő — közös komponens a kártya-előlap
 * (`showText`, nyelvenkénti szöveg-előnézettel) és a kollekció közös
 * hátlapja (nincs szöveg) szerkesztéséhez is. A vászon pontosan a
 * sablon bleed-arányában jelenik meg, rajta a bleed/cut/safe
 * segédvonalakkal (ki/be kapcsolható) — lásd lib/card-canvas.ts a
 * geometria-számításért.
 */
export default function CardCanvasEditor({
  template,
  title,
  design,
  showText,
  previewTexts,
  onSave,
  onClose,
}: {
  template: CardTemplate;
  title: string;
  design: CardDesign;
  /** false a kollekció közös hátlapjánál — nincs kártyánkénti szöveg. */
  showText: boolean;
  /** Nyelv-kód → szöveg, csak showText=true esetén releváns. */
  previewTexts: { code: string; text: string }[];
  onSave: (design: CardDesign) => Promise<void>;
  onClose: () => void;
}) {
  const supabase = getSupabaseClient();
  const [form, setForm] = useState<CardDesign>(design);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [showGuides, setShowGuides] = useState(true);
  const [langIndex, setLangIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (imageFile) {
      const objectUrl = URL.createObjectURL(imageFile);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImagePreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    if (!supabase || !form.image_url) {
      setImagePreviewUrl(null);
      return;
    }
    resolveSignedUrl(supabase, STORAGE_BUCKET, form.image_url).then((url) => {
      if (!cancelled) setImagePreviewUrl(url);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is a stable singleton, re-resolving only needs to react to image_url/imageFile
  }, [form.image_url, imageFile]);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: PointerEvent) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      setForm((f) => ({ ...f, image_x: x, image_y: y }));
    }
    function onUp() {
      setDragging(false);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  async function uploadImage(file: File): Promise<string | null> {
    if (!supabase) return null;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;
    return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const imageUrl = imageFile ? await uploadImage(imageFile) : form.image_url;
      await onSave({ ...form, image_url: imageUrl });
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült menteni a design-t."));
    } finally {
      setSaving(false);
    }
  }

  const previewHeightPx = PREVIEW_WIDTH_PX * (template.bleed_height_in / template.bleed_width_in);
  const guides = computeGuideRects(template);
  const pixelDims = templatePixelDims(template);
  const textColor = readableTextColor(form.background_color);
  const previewFontPx = (form.text_font_size * PREVIEW_WIDTH_PX) / pixelDims.width;
  const activeText = previewTexts[langIndex]?.text ?? "";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-fade-in card flex max-h-full w-full max-w-4xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <BackButton onClick={onClose} label="Vissza a kollekcióhoz" />
            <h2 className="font-serif text-xl text-forest">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest"
            aria-label="Bezárás"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <div
                ref={canvasRef}
                className="relative select-none overflow-hidden rounded-sm shadow-md"
                style={{
                  width: PREVIEW_WIDTH_PX,
                  height: previewHeightPx,
                  backgroundColor: form.background_color ?? "#F3EFE7",
                }}
              >
                {imagePreviewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreviewUrl}
                    alt=""
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    className="absolute cursor-move touch-none"
                    style={{
                      width: `${form.image_scale * 100}%`,
                      left: `${form.image_x * 100}%`,
                      top: `${form.image_y * 100}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                )}

                {showText && activeText && (
                  <div
                    className="absolute flex items-center whitespace-pre-wrap p-1"
                    style={{
                      left: `${guides.safe.insetXPct}%`,
                      right: `${guides.safe.insetXPct}%`,
                      top: `${guides.safe.insetYPct}%`,
                      bottom: `${guides.safe.insetYPct}%`,
                      color: textColor,
                      fontSize: previewFontPx,
                      textAlign: form.text_align,
                      justifyContent:
                        form.text_align === "left" ? "flex-start" : form.text_align === "right" ? "flex-end" : "center",
                    }}
                  >
                    <span>{activeText}</span>
                  </div>
                )}

                {showGuides && (
                  <>
                    <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-red-500/70" />
                    <div
                      className="pointer-events-none absolute border border-black/50"
                      style={{
                        left: `${guides.cut.insetXPct}%`,
                        right: `${guides.cut.insetXPct}%`,
                        top: `${guides.cut.insetYPct}%`,
                        bottom: `${guides.cut.insetYPct}%`,
                      }}
                    />
                    <div
                      className="pointer-events-none absolute border border-dashed border-forest/70"
                      style={{
                        left: `${guides.safe.insetXPct}%`,
                        right: `${guides.safe.insetXPct}%`,
                        top: `${guides.safe.insetYPct}%`,
                        bottom: `${guides.safe.insetYPct}%`,
                      }}
                    />
                  </>
                )}
              </div>
              <p className="text-center text-[11px] text-muted">
                {template.name} — {templatePixelDims(template).width}×{templatePixelDims(template).height} px
              </p>
              <button
                type="button"
                onClick={() => setShowGuides((v) => !v)}
                className="btn btn-ghost !px-2.5 !py-1.5 text-xs"
              >
                {showGuides ? <EyeOff size={13} /> : <Eye size={13} />}
                {showGuides ? "Segédvonalak elrejtése" : "Segédvonalak mutatása"}
              </button>
              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 border border-red-500/70" /> Bleed
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 border border-black/50" /> Cut
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 border border-dashed border-forest/70" /> Safe
                </span>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Háttérszín</label>
                <div className="flex flex-wrap items-center gap-2">
                  {CARD_COLOR_PALETTE.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      title={c.name}
                      onClick={() => setForm((f) => ({ ...f, background_color: c.hex }))}
                      className={`h-8 w-8 rounded-full border-2 ${
                        form.background_color === c.hex ? "border-bronze" : "border-border"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.background_color ?? "#F3EFE7"}
                    onChange={(e) => setForm((f) => ({ ...f, background_color: e.target.value }))}
                    className="h-8 w-8 cursor-pointer rounded-md border border-border p-0.5"
                    title="Egyedi szín"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Kép / logó</label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="btn btn-ghost cursor-pointer !px-3 !py-1.5 text-xs">
                    <Upload size={13} /> {form.image_url || imageFile ? "Kép cseréje" : "Kép feltöltése"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {(form.image_url || imageFile) && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setForm((f) => ({ ...f, image_url: null }));
                      }}
                      className="btn btn-ghost !px-2.5 !py-1.5 text-xs"
                    >
                      <Trash2 size={13} /> Eltávolítás
                    </button>
                  )}
                </div>
                {(form.image_url || imageFile) && (
                  <div className="mt-2">
                    <label className="mb-1 block text-xs font-medium text-muted">
                      Méret ({Math.round(form.image_scale * 100)}%) — húzd a képet a vásznon a pozicionáláshoz
                    </label>
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.01"
                      value={form.image_scale}
                      onChange={(e) => setForm((f) => ({ ...f, image_scale: Number(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {showText && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted">Szöveg</label>
                  {previewTexts.length > 1 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {previewTexts.map((t, i) => (
                        <button
                          key={t.code}
                          type="button"
                          onClick={() => setLangIndex(i)}
                          className={`badge cursor-pointer border ${
                            langIndex === i ? "border-bronze bg-bronze text-white" : "border-border bg-white text-muted"
                          }`}
                        >
                          {t.code}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-muted">Betűméret</label>
                      <input
                        type="number"
                        min="8"
                        max="300"
                        className="input w-20 !py-1 text-xs"
                        value={form.text_font_size}
                        onChange={(e) => setForm((f) => ({ ...f, text_font_size: Number(e.target.value) || 1 }))}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      {(["left", "center", "right"] as CardTextAlign[]).map((align) => {
                        const Icon = align === "left" ? AlignLeft : align === "right" ? AlignRight : AlignCenter;
                        return (
                          <button
                            key={align}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, text_align: align }))}
                            className={`rounded-md p-1.5 ${
                              form.text_align === align ? "bg-bronze text-white" : "text-muted hover:bg-ivory-dim"
                            }`}
                            aria-label={`Szöveg igazítása: ${align}`}
                          >
                            <Icon size={14} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          <button type="button" onClick={() => void handleSave()} disabled={saving} className="btn btn-primary">
            <Check size={14} /> {saving ? "Mentés…" : "Design mentése"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Mégse
          </button>
        </div>
      </div>
    </div>
  );
}
