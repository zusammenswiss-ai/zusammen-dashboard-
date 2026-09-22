"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Trash2,
  Type,
  Image as ImageIcon,
  Square,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Check,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Save,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CardLayoutTemplate, CardTemplate, CardTextAlign, DesignLayer, ImageDesignLayer } from "@/lib/supabase/types";
import BackButton from "@/components/BackButton";
import { CARD_COLOR_PALETTE, computeGuideRects, readableTextColor } from "@/lib/card-canvas";
import { templatePixelDims } from "@/lib/card-template";
import { createImageLayer, createShapeLayer, createTextLayer, snapValue, FONT_OPTIONS } from "@/lib/card-layers";
import { resolveSignedUrls } from "@/lib/signed-storage-url";
import { errorMessage } from "@/lib/errors";

const STORAGE_BUCKET = "card-designer";
const PREVIEW_WIDTH_PX = 300;
const MIN_SIZE_FRACTION = 0.03;
const SNAP_THRESHOLD = 0.02;

type DragMode = "move" | "resize";
interface DragState {
  id: string;
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

function cloneLayersWithNewIds(layers: DesignLayer[]): DesignLayer[] {
  return layers.map((l) => ({ ...l, id: crypto.randomUUID() }));
}

/**
 * Réteg-alapú vizuális kártya-/hátlap-szerkesztő (9. fázis) — a korábbi
 * CardCanvasEditor (egy fix kép + egy fix szövegblokk) helyett: itt
 * tetszőleges számú kép/szöveg/alakzat réteg adható hozzá, mindegyik
 * szabadon húzható és a sarkánál átméretezhető, igazítási
 * segédvonalakkal (középre/szélekhez) a vászon és a safe-zóna
 * széleihez. A bleed/cut/safe segédvonalak (ugyanaz a geometria, mint
 * eddig, lásd lib/card-canvas.ts) ki/be kapcsolhatók.
 */
export default function LayeredCardEditor({
  template,
  title,
  backgroundColor,
  layers: initialLayers,
  languageCodes,
  questionTextByLang,
  layoutTemplates,
  onSave,
  onLayoutTemplateCreated,
  onClose,
}: {
  template: CardTemplate;
  title: string;
  backgroundColor: string | null;
  layers: DesignLayer[];
  /** Nyelv-kódok az egyéni szövegrétegek nyelvenkénti tartalmához és az
   * előnézet-fülekhez (pl. kollekció nyelvei, vagy ["HU"] ha nincs). */
  languageCodes: string[];
  /** Csak a kártya-előlap szerkesztésénél nem null — a 'question'
   * forrású szövegrétegek ebből olvassák az élő előnézet szövegét,
   * nyelvenként. A hátlap-szerkesztő null-t ad, mert nincs kártyánkénti
   * kérdés-szöveg a hátlaphoz. */
  questionTextByLang: Record<string, string> | null;
  layoutTemplates: CardLayoutTemplate[];
  onSave: (layers: DesignLayer[], backgroundColor: string | null) => Promise<void>;
  onLayoutTemplateCreated: (t: CardLayoutTemplate) => void;
  onClose: () => void;
}) {
  const supabase = getSupabaseClient();
  const [form, setForm] = useState<{ backgroundColor: string | null; layers: DesignLayer[] }>({
    backgroundColor,
    layers: initialLayers,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGuides, setShowGuides] = useState(true);
  const [langIndex, setLangIndex] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ x?: number; y?: number }>({});
  const [signedImageUrls, setSignedImageUrls] = useState<Map<string, string>>(new Map());
  const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const activeLang = languageCodes[langIndex] ?? languageCodes[0] ?? "HU";
  const selected = form.layers.find((l) => l.id === selectedId) ?? null;
  const guides = computeGuideRects(template);
  const pixelDims = templatePixelDims(template);
  const previewHeightPx = PREVIEW_WIDTH_PX * (template.bleed_height_in / template.bleed_width_in);

  // Kép-rétegek tárolt URL-jei aláírt URL-re oldva (privát bucket) — csak
  // akkor fut újra, ha maga az URL-halmaz változik (nem minden húzásnál).
  const imageUrlsKey = form.layers
    .filter((l): l is ImageDesignLayer => l.type === "image")
    .map((l) => l.url)
    .join("|");
  useEffect(() => {
    if (!supabase || !imageUrlsKey) return;
    resolveSignedUrls(supabase, STORAGE_BUCKET, imageUrlsKey.split("|")).then((resolved) =>
      setSignedImageUrls((prev) => new Map([...prev, ...resolved]))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- imageUrlsKey a stabil, tartalom-alapú újrafuttatási kulcs
  }, [imageUrlsKey]);

  useEffect(() => {
    if (!drag) return;
    function onMove(e: PointerEvent) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || !drag) return;
      const dxFrac = (e.clientX - drag.startClientX) / rect.width;
      const dyFrac = (e.clientY - drag.startClientY) / rect.height;
      const nextGuides: { x?: number; y?: number } = {};
      setForm((f) => ({
        ...f,
        layers: f.layers.map((l) => {
          if (l.id !== drag.id) return l;
          if (drag.mode === "move") {
            let x = Math.min(Math.max(drag.startX + dxFrac, 0), 1 - l.width);
            let y = Math.min(Math.max(drag.startY + dyFrac, 0), 1 - l.height);
            const candX = [0, guides.safe.insetXPct / 100, 0.5 - l.width / 2, 1 - guides.safe.insetXPct / 100 - l.width, 1 - l.width];
            const candY = [0, guides.safe.insetYPct / 100, 0.5 - l.height / 2, 1 - guides.safe.insetYPct / 100 - l.height, 1 - l.height];
            const snappedX = snapValue(x, candX, SNAP_THRESHOLD);
            const snappedY = snapValue(y, candY, SNAP_THRESHOLD);
            if (snappedX !== x) nextGuides.x = snappedX + l.width / 2;
            if (snappedY !== y) nextGuides.y = snappedY + l.height / 2;
            x = snappedX;
            y = snappedY;
            return { ...l, x, y };
          }
          const width = Math.min(Math.max(drag.startWidth + dxFrac, MIN_SIZE_FRACTION), 1 - l.x);
          const height = Math.min(Math.max(drag.startHeight + dyFrac, MIN_SIZE_FRACTION), 1 - l.y);
          return { ...l, width, height };
        }),
      }));
      setSnapGuides(nextGuides);
    }
    function onUp() {
      setDrag(null);
      setSnapGuides({});
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- guides csak a sablontól függ, nem kell újrafigyelni
  }, [drag]);

  function updateLayer(id: string, patch: Partial<DesignLayer>) {
    setForm((f) => ({ ...f, layers: f.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as DesignLayer) : l)) }));
  }

  function deleteLayer(id: string) {
    setForm((f) => ({ ...f, layers: f.layers.filter((l) => l.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }

  function moveLayer(id: string, direction: "up" | "down") {
    setForm((f) => {
      const idx = f.layers.findIndex((l) => l.id === id);
      const swapWith = direction === "up" ? idx + 1 : idx - 1;
      if (idx === -1 || swapWith < 0 || swapWith >= f.layers.length) return f;
      const next = [...f.layers];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return { ...f, layers: next };
    });
  }

  function addTextLayer(source: "question" | "custom") {
    const layer = createTextLayer({ source, color: readableTextColor(form.backgroundColor) });
    setForm((f) => ({ ...f, layers: [...f.layers, layer] }));
    setSelectedId(layer.id);
  }

  function addShapeLayer() {
    const layer = createShapeLayer();
    setForm((f) => ({ ...f, layers: [...f.layers, layer] }));
    setSelectedId(layer.id);
  }

  async function handleImageFile(file: File) {
    if (!supabase) return;
    setError(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const storedUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
      const resolved = await resolveSignedUrls(supabase, STORAGE_BUCKET, [storedUrl]);
      setSignedImageUrls((prev) => new Map([...prev, ...resolved]));
      const layer = createImageLayer(storedUrl);
      setForm((f) => ({ ...f, layers: [...f.layers, layer] }));
      setSelectedId(layer.id);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült feltölteni a képet."));
    }
  }

  function loadLayoutTemplate(templateId: string) {
    const t = layoutTemplates.find((lt) => lt.id === templateId);
    if (!t) return;
    setForm((f) => ({ ...f, layers: cloneLayersWithNewIds(t.layers) }));
    setSelectedId(null);
  }

  async function saveLayoutTemplate() {
    if (!supabase || !templateName.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("card_layout_templates")
      .insert({ name: templateName.trim(), layers: form.layers })
      .select()
      .single();
    setSaving(false);
    if (insertError) {
      setError(errorMessage(insertError, "Nem sikerült elmenteni a sablont."));
      return;
    }
    if (data) onLayoutTemplateCreated(data);
    setShowSaveTemplateForm(false);
    setTemplateName("");
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(form.layers, form.backgroundColor);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült menteni a design-t."));
    } finally {
      setSaving(false);
    }
  }

  function contentFor(layer: DesignLayer): string {
    if (layer.type !== "text") return "";
    if (layer.source === "question") return questionTextByLang?.[activeLang] ?? "";
    return layer.content[activeLang] ?? Object.values(layer.content)[0] ?? "";
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-fade-in card flex max-h-full w-full max-w-5xl flex-col overflow-hidden"
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
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Vászon */}
            <div className="flex shrink-0 flex-col items-center gap-2">
              <div
                ref={canvasRef}
                onClick={(e) => {
                  if (e.target === canvasRef.current) setSelectedId(null);
                }}
                className="relative select-none overflow-hidden rounded-sm shadow-md"
                style={{ width: PREVIEW_WIDTH_PX, height: previewHeightPx, backgroundColor: form.backgroundColor ?? "#F3EFE7" }}
              >
                {form.layers.map((layer) => {
                  const boxStyle = {
                    left: `${layer.x * 100}%`,
                    top: `${layer.y * 100}%`,
                    width: `${layer.width * 100}%`,
                    height: `${layer.height * 100}%`,
                  };
                  const isSelected = layer.id === selectedId;
                  return (
                    <div
                      key={layer.id}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelectedId(layer.id);
                        setDrag({
                          id: layer.id,
                          mode: "move",
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          startX: layer.x,
                          startY: layer.y,
                          startWidth: layer.width,
                          startHeight: layer.height,
                        });
                      }}
                      className={`absolute cursor-move touch-none ${isSelected ? "outline outline-2 outline-bronze" : ""}`}
                      style={boxStyle}
                    >
                      {layer.type === "image" && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={signedImageUrls.get(layer.url) ?? undefined} alt="" className="h-full w-full object-fill" />
                      )}
                      {layer.type === "shape" && <div className="h-full w-full" style={{ backgroundColor: layer.color }} />}
                      {layer.type === "text" && (
                        <div
                          className="flex h-full w-full items-center overflow-hidden whitespace-pre-wrap leading-tight"
                          style={{
                            color: layer.color,
                            fontSize: (layer.fontSize * PREVIEW_WIDTH_PX) / pixelDims.width,
                            fontFamily: layer.fontFamily,
                            textAlign: layer.align,
                            justifyContent: layer.align === "left" ? "flex-start" : layer.align === "right" ? "flex-end" : "center",
                          }}
                        >
                          <span>{contentFor(layer)}</span>
                        </div>
                      )}
                      {isSelected && (
                        <div
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setDrag({
                              id: layer.id,
                              mode: "resize",
                              startClientX: e.clientX,
                              startClientY: e.clientY,
                              startX: layer.x,
                              startY: layer.y,
                              startWidth: layer.width,
                              startHeight: layer.height,
                            });
                          }}
                          className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-bronze"
                        />
                      )}
                    </div>
                  );
                })}

                {snapGuides.x !== undefined && (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 w-px bg-bronze"
                    style={{ left: `${snapGuides.x * 100}%` }}
                  />
                )}
                {snapGuides.y !== undefined && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 h-px bg-bronze"
                    style={{ top: `${snapGuides.y * 100}%` }}
                  />
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
                {template.name} — {pixelDims.width}×{pixelDims.height} px
              </p>
              <button type="button" onClick={() => setShowGuides((v) => !v)} className="btn btn-ghost !px-2.5 !py-1.5 text-xs">
                {showGuides ? <EyeOff size={13} /> : <Eye size={13} />}
                {showGuides ? "Segédvonalak elrejtése" : "Segédvonalak mutatása"}
              </button>

              {languageCodes.length > 1 && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {languageCodes.map((code, i) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLangIndex(i)}
                      className={`badge cursor-pointer border ${
                        langIndex === i ? "border-bronze bg-bronze text-white" : "border-border bg-white text-muted"
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Eszköztár + rétegek + tulajdonságok */}
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Háttérszín</label>
                <div className="flex flex-wrap items-center gap-2">
                  {CARD_COLOR_PALETTE.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      title={c.name}
                      onClick={() => setForm((f) => ({ ...f, backgroundColor: c.hex }))}
                      className={`h-8 w-8 rounded-full border-2 ${
                        form.backgroundColor === c.hex ? "border-bronze" : "border-border"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.backgroundColor ?? "#F3EFE7"}
                    onChange={(e) => setForm((f) => ({ ...f, backgroundColor: e.target.value }))}
                    className="h-8 w-8 cursor-pointer rounded-md border border-border p-0.5"
                    title="Egyedi szín"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Réteg hozzáadása</label>
                <div className="flex flex-wrap gap-2">
                  {questionTextByLang && (
                    <button type="button" onClick={() => addTextLayer("question")} className="btn btn-ghost !px-2.5 !py-1.5 text-xs">
                      <Type size={13} /> Kérdés-szöveg
                    </button>
                  )}
                  <button type="button" onClick={() => addTextLayer("custom")} className="btn btn-ghost !px-2.5 !py-1.5 text-xs">
                    <Type size={13} /> Szövegdoboz
                  </button>
                  <label className="btn btn-ghost cursor-pointer !px-2.5 !py-1.5 text-xs">
                    <ImageIcon size={13} /> Kép
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImageFile(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button type="button" onClick={addShapeLayer} className="btn btn-ghost !px-2.5 !py-1.5 text-xs">
                    <Square size={13} /> Alakzat / csík
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Rétegek (felülről lefelé)</label>
                {form.layers.length === 0 ? (
                  <p className="text-xs text-muted">Még nincs réteg — adj hozzá egyet a fenti gombokkal.</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {[...form.layers].reverse().map((layer) => {
                      const label =
                        layer.type === "image" ? "Kép" : layer.type === "shape" ? "Alakzat" : layer.source === "question" ? "Kérdés-szöveg" : `Szöveg: ${contentFor(layer) || "(üres)"}`;
                      return (
                        <div
                          key={layer.id}
                          onClick={() => setSelectedId(layer.id)}
                          className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
                            layer.id === selectedId ? "border-bronze bg-bronze/5" : "border-border"
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate">{label}</span>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveLayer(layer.id, "up");
                              }}
                              className="rounded p-1 text-muted hover:bg-ivory-dim hover:text-forest"
                              aria-label="Előrébb hozás"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveLayer(layer.id, "down");
                              }}
                              className="rounded p-1 text-muted hover:bg-ivory-dim hover:text-forest"
                              aria-label="Hátrébb küldés"
                            >
                              <ArrowDown size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteLayer(layer.id);
                              }}
                              className="rounded p-1 text-muted hover:bg-ivory-dim hover:text-red-600"
                              aria-label="Réteg törlése"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {selected && (
                <div className="rounded-md border border-border p-3">
                  <p className="mb-2 text-xs font-medium text-bronze">Kijelölt réteg tulajdonságai</p>
                  {selected.type === "text" && (
                    <div className="flex flex-col gap-3">
                      {selected.source === "custom" &&
                        languageCodes.map((code) => (
                          <div key={code}>
                            <label className="mb-1 block text-xs font-medium text-muted">Szöveg ({code})</label>
                            <textarea
                              className="textarea min-h-14 text-sm"
                              value={selected.content[code] ?? ""}
                              onChange={(e) =>
                                updateLayer(selected.id, { content: { ...selected.content, [code]: e.target.value } })
                              }
                            />
                          </div>
                        ))}
                      {selected.source === "question" && (
                        <p className="text-xs text-muted">
                          Ez a réteg a kártya kérdés-szövegét mutatja — a tartalmat a kártya adatainál (Szöveg mezők) tudod
                          szerkeszteni.
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs text-muted">Betűméret</label>
                          <input
                            type="number"
                            min="8"
                            max="300"
                            className="input w-20 !py-1 text-xs"
                            value={selected.fontSize}
                            onChange={(e) => updateLayer(selected.id, { fontSize: Number(e.target.value) || 1 })}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          {(["left", "center", "right"] as CardTextAlign[]).map((align) => {
                            const Icon = align === "left" ? AlignLeft : align === "right" ? AlignRight : AlignCenter;
                            return (
                              <button
                                key={align}
                                type="button"
                                onClick={() => updateLayer(selected.id, { align })}
                                className={`rounded-md p-1.5 ${
                                  selected.align === align ? "bg-bronze text-white" : "text-muted hover:bg-ivory-dim"
                                }`}
                                aria-label={`Szöveg igazítása: ${align}`}
                              >
                                <Icon size={14} />
                              </button>
                            );
                          })}
                        </div>
                        <input
                          type="color"
                          value={selected.color}
                          onChange={(e) => updateLayer(selected.id, { color: e.target.value })}
                          className="h-7 w-7 cursor-pointer rounded-md border border-border p-0.5"
                          title="Szövegszín"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted">Betűtípus</label>
                        <select
                          className="select"
                          value={selected.fontFamily}
                          onChange={(e) => updateLayer(selected.id, { fontFamily: e.target.value })}
                        >
                          {FONT_OPTIONS.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  {selected.type === "shape" && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted">Szín</label>
                      <input
                        type="color"
                        value={selected.color}
                        onChange={(e) => updateLayer(selected.id, { color: e.target.value })}
                        className="h-7 w-7 cursor-pointer rounded-md border border-border p-0.5"
                      />
                    </div>
                  )}
                  {selected.type === "image" && (
                    <label className="btn btn-ghost cursor-pointer !px-2.5 !py-1.5 text-xs">
                      <ImageIcon size={13} /> Kép cseréje
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !supabase) return;
                          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                          const path = `${crypto.randomUUID()}-${safeName}`;
                          const { error: uploadError } = await supabase.storage
                            .from(STORAGE_BUCKET)
                            .upload(path, file, { upsert: false });
                          if (uploadError) {
                            setError(errorMessage(uploadError, "Nem sikerült feltölteni a képet."));
                            return;
                          }
                          const storedUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
                          const resolved = await resolveSignedUrls(supabase, STORAGE_BUCKET, [storedUrl]);
                          setSignedImageUrls((prev) => new Map([...prev, ...resolved]));
                          updateLayer(selected.id, { url: storedUrl });
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                  <p className="mt-3 text-[11px] text-muted">Húzd a rétegre kattintva a mozgatáshoz, a jobb alsó sarkánál az átméretezéshez.</p>
                </div>
              )}

              <div className="border-t border-border pt-4">
                <label className="mb-1.5 block text-xs font-medium text-muted">Elrendezés sablonok</label>
                <div className="flex flex-wrap items-center gap-2">
                  {layoutTemplates.length > 0 && (
                    <select className="select w-auto" defaultValue="" onChange={(e) => e.target.value && loadLayoutTemplate(e.target.value)}>
                      <option value="">Sablon betöltése…</option>
                      {layoutTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {showSaveTemplateForm ? (
                    <>
                      <input
                        className="input w-auto !py-1.5 text-xs"
                        autoFocus
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="pl. Kérdéskártya alap layout"
                      />
                      <button type="button" onClick={() => void saveLayoutTemplate()} disabled={saving || !templateName.trim()} className="btn btn-ghost !px-2.5 !py-1.5 text-xs">
                        <Save size={13} /> Mentés
                      </button>
                      <button type="button" onClick={() => setShowSaveTemplateForm(false)} className="btn btn-ghost !px-2.5 !py-1.5 text-xs">
                        Mégse
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setShowSaveTemplateForm(true)} className="btn btn-ghost !px-2.5 !py-1.5 text-xs">
                      <Save size={13} /> Mentés sablonként
                    </button>
                  )}
                </div>
              </div>

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
