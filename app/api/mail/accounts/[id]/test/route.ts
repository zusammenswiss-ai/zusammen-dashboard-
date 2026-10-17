import { NextResponse } from "next/server";
import { getMailAccountRaw } from "@/lib/mail-accounts";
import { testMailAccountConnection } from "@/lib/mail-transport";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { isMailEncryptionConfigured } from "@/lib/mail-crypto";
import { MAIL_ENCRYPTION_MISSING_ERROR } from "@/lib/mail-accounts";

// POST /api/mail/accounts/[id]/test — "Kapcsolat tesztelése" gomb:
// belép IMAP-on és SMTP-n is (nem olvas/küld semmit), és mindkét
// eredményt külön jelzi érthető hibaüzenettel. Az eredmény a fiók
// last_test_* mezőibe is elmentődik, hogy a Fiókok lista mutathassa az
// utolsó teszt idejét/állapotát anélkül, hogy újra le kéne futtatni.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isMailEncryptionConfigured()) {
    return NextResponse.json({ ok: false, error: MAIL_ENCRYPTION_MISSING_ERROR }, { status: 500 });
  }

  const { id } = await params;
  const account = await getMailAccountRaw(id);
  if (!account) return NextResponse.json({ ok: false, error: "A fiók nem található." }, { status: 404 });

  const { imap, smtp } = await testMailAccountConnection(account);
  const bothOk = imap.ok && smtp.ok;
  const combinedError = [!imap.ok ? (imap as { error: string }).error : null, !smtp.ok ? (smtp as { error: string }).error : null]
    .filter(Boolean)
    .join(" ");

  const supabase = getSupabaseServiceClient();
  if (supabase) {
    await supabase
      .from("mail_accounts")
      .update({
        last_test_at: new Date().toISOString(),
        last_test_ok: bothOk,
        last_test_error: bothOk ? null : combinedError,
      })
      .eq("id", id);
  }

  return NextResponse.json({ ok: true, imap, smtp });
}
