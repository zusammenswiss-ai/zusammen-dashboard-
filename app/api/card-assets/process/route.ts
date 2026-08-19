import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import sharp from "sharp";
import type { Database } from "@/lib/supabase/types";

// Runs after the browser has already uploaded a card-asset ZIP straight to
// Supabase Storage (see the Kártya-fájlok page) — this route only receives
// the storage *path* (a small JSON body), downloads the ZIP server-side,
// and picks out up to 4 representative preview images by filename pattern
// (front/back/wild/goldcard), thumbnails them, and uploads the thumbnails
// back to Storage. Keeping the actual (potentially large) print file out of
// this route's request/response bodies avoids Vercel's serverless payload
// limits — only the download/upload to Storage itself needs to handle the
// full file size, and that happens server-to-Storage, not through this
// function's HTTP body.
export const runtime = "nodejs";
export const maxDuration = 60;

const STORAGE_BUCKET = "card-assets";
const THUMB_LABELS = ["front", "back", "wild", "goldcard"] as const;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });
  }

  let path: string;
  try {
    const body = await request.json();
    if (!body?.path || typeof body.path !== "string") throw new Error("missing path");
    path = body.path;
  } catch {
    return NextResponse.json({ ok: false, error: "Hiányzó vagy hibás 'path' mező." }, { status: 400 });
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const { data: fileBlob, error: downloadError } = await supabase.storage.from(STORAGE_BUCKET).download(path);
  if (downloadError || !fileBlob) {
    return NextResponse.json(
      { ok: false, error: downloadError?.message ?? "Nem sikerült letölteni a fájlt." },
      { status: 500 }
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(Buffer.from(await fileBlob.arrayBuffer()));
  } catch {
    // Not a valid/readable ZIP — not fatal, the asset itself still saves,
    // it just won't have preview thumbnails.
    return NextResponse.json({ ok: true, thumbnails: [] });
  }

  const imageEntries = Object.values(zip.files).filter((f) => !f.dir && IMAGE_EXT.test(f.name));

  const thumbnails: { label: string; url: string }[] = [];
  for (const label of THUMB_LABELS) {
    const entry = imageEntries.find((f) => f.name.toLowerCase().includes(label));
    if (!entry) continue;
    try {
      const imageBuffer = Buffer.from(await entry.async("arraybuffer"));
      const thumbBuffer = await sharp(imageBuffer)
        .resize({ width: 300, withoutEnlargement: true })
        .jpeg({ quality: 72 })
        .toBuffer();
      const thumbPath = `${path}-thumb-${label}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(thumbPath, thumbBuffer, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) continue;
      const url = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(thumbPath).data.publicUrl;
      thumbnails.push({ label, url });
    } catch {
      // Skip just this one preview and keep going with the rest.
      continue;
    }
  }

  return NextResponse.json({ ok: true, thumbnails });
}
