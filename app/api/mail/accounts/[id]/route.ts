import { NextResponse } from "next/server";
import { deleteMailAccount, updateMailAccount } from "@/lib/mail-accounts";
import type { MailSecureMode } from "@/lib/supabase/types";

type Body = {
  name?: string;
  email?: string;
  from_name?: string | null;
  imap_host?: string;
  imap_port?: number;
  imap_secure?: MailSecureMode;
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: MailSecureMode;
  username?: string;
  password?: string;
  signature_html?: string | null;
  signature_text?: string | null;
  is_default?: boolean;
  is_active?: boolean;
};

// PATCH /api/mail/accounts/[id] — csak a megadott mezők frissülnek;
// `password` kihagyva = a meglévő titkosított jelszó megmarad (a
// böngésző sosem kapja vissza, hogy legyen mit "módosítatlanul hagyni").
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ ok: false, error: "Érvénytelen kérés." }, { status: 400 });

  const result = await updateMailAccount(id, body);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, account: result.account });
}

// DELETE /api/mail/accounts/[id]?deleteMessages=true — a feladat 1.
// pontja explicit kéri a választást: a levelek maradjanak vagy
// törlődjenek a fiókkal együtt.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const deleteMessages = url.searchParams.get("deleteMessages") === "true";

  const result = await deleteMailAccount(id, deleteMessages);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
