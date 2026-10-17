import { NextResponse } from "next/server";
import { createMailAccount, listMailAccounts } from "@/lib/mail-accounts";
import type { MailSecureMode } from "@/lib/supabase/types";

// GET /api/mail/accounts — Postafiók → Fiókok lista (jelszó nélkül,
// lásd lib/mail-accounts.ts toAccountSummary).
export async function GET() {
  const result = await listMailAccounts();
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, accounts: result.accounts });
}

type Body = {
  name?: string;
  email?: string;
  from_name?: string;
  imap_host?: string;
  imap_port?: number;
  imap_secure?: MailSecureMode;
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: MailSecureMode;
  username?: string;
  password?: string;
  signature_html?: string;
  signature_text?: string;
  is_default?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/mail/accounts — új postafiók felvétele. A jelszó itt kerül
// titkosításra (lib/mail-crypto.ts) — soha nem tárolódik nyers alakban.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.name?.trim()) return NextResponse.json({ ok: false, error: "Név megadása kötelező." }, { status: 400 });
  if (!body.email?.trim() || !EMAIL_RE.test(body.email.trim())) {
    return NextResponse.json({ ok: false, error: "Érvénytelen e-mail cím." }, { status: 400 });
  }
  if (!body.username?.trim()) return NextResponse.json({ ok: false, error: "Felhasználónév megadása kötelező." }, { status: 400 });
  if (!body.password?.trim()) return NextResponse.json({ ok: false, error: "Jelszó megadása kötelező." }, { status: 400 });

  const result = await createMailAccount({
    name: body.name.trim(),
    email: body.email.trim(),
    from_name: body.from_name?.trim() || null,
    imap_host: body.imap_host?.trim() || "mail.infomaniak.com",
    imap_port: body.imap_port ?? 993,
    imap_secure: body.imap_secure ?? "tls",
    smtp_host: body.smtp_host?.trim() || "mail.infomaniak.com",
    smtp_port: body.smtp_port ?? 465,
    smtp_secure: body.smtp_secure ?? "tls",
    username: body.username.trim(),
    password: body.password,
    signature_html: body.signature_html ?? null,
    signature_text: body.signature_text ?? null,
    is_default: body.is_default ?? false,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, account: result.account });
}
