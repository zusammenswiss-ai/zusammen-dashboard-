"use client";

import { useEffect, useState } from "react";
import { QrCode, Copy, Check, Download, Share2 } from "lucide-react";

type Lang = "de" | "en";

const LANG_LABEL: Record<Lang, string> = { de: "Deutsch", en: "English" };

/**
 * "Megosztható link és QR kód" — the modern, self-contained way to hand
 * the /landing funnel to someone in person (a QR code they scan) or
 * digitally (copy the link, or the native share sheet on mobile/supported
 * desktop browsers). Deliberately reads window.location.origin rather
 * than SITE_URL (see lib/site-url.ts's comment on why that constant
 * resolves wrong from a "use client" component) so the link and QR code
 * always match whatever domain is actually live right now.
 */
export default function ShareLinkSection() {
  const [lang, setLang] = useState<Lang>("de");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
    setCanNativeShare(typeof navigator.share === "function");
  }, []);

  const shareUrl = origin ? `${origin}/landing${lang === "en" ? "?lang=en" : ""}` : "";
  const qrSrc = shareUrl ? `/api/qr?url=${encodeURIComponent(shareUrl)}` : "";

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API can be unavailable — the link is still selectable
      // and visible on the page, so nothing is actually lost.
    }
  }

  async function nativeShare() {
    if (!shareUrl) return;
    try {
      await navigator.share({
        title: "Zusammen — Where conversations become memories.",
        url: shareUrl,
      });
    } catch {
      // AbortError when the user just cancels the share sheet — not an error worth surfacing.
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <QrCode size={18} className="text-bronze" />
        <h2 className="font-serif text-lg text-forest">Megosztható link és QR kód</h2>
      </div>
      <p className="mt-1 text-sm text-muted">
        A publikus /landing oldal linkje és egy nyomtatható QR kód — kártyán, csomagoláson, vagy egyszerűen
        elküldve is használható.
      </p>

      <div className="mt-4 flex gap-2">
        {(["de", "en"] as Lang[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={`badge cursor-pointer border ${
              lang === l ? "border-bronze bg-bronze text-white" : "border-border bg-white text-muted"
            }`}
          >
            {LANG_LABEL[l]}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-lg border border-border bg-white p-2">
          {qrSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrSrc} alt="QR kód a Landing oldalhoz" className="h-full w-full object-contain" />
          ) : (
            <QrCode size={28} className="text-muted/40" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Link</label>
            <input className="input font-mono text-xs" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyLink} className="btn btn-primary" disabled={!shareUrl}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Másolva" : "Link másolása"}
            </button>
            {canNativeShare && (
              <button type="button" onClick={nativeShare} className="btn btn-ghost" disabled={!shareUrl}>
                <Share2 size={15} /> Megosztás
              </button>
            )}
            <a
              href={qrSrc}
              download="zusammen-landing-qr.png"
              className={`btn btn-ghost ${shareUrl ? "" : "pointer-events-none opacity-50"}`}
            >
              <Download size={15} /> QR kód letöltése
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
