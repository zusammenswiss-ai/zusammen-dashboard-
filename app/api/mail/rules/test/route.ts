import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { resolveKnownSender, findMatchingRule } from "@/lib/mail-rules-engine";
import type { MailRuleCondition, MailRuleAction } from "@/lib/supabase/types";

type Body = {
  mailMessageId?: string;
  fromAddr?: string;
  subject?: string;
  accountId?: string;
  hasAttachment?: boolean;
  conditions?: MailRuleCondition[];
  actions?: MailRuleAction[];
};

// POST /api/mail/rules/test — "egy szabály tesztelhető egy teljes
// levélen" (feladat 5/B/e pont). Egy már szinkronizált levélen (mailMessageId)
// vagy kézzel megadott mezőkön teszteli, hogy MELYIK engedélyezett
// szabály illeszkedne rá — ha conditions/actions is meg van adva, azt a
// (még el nem mentett) szabályt is beleszámítja a sorrend végén, hogy
// egy szerkesztés alatt álló új szabályt is tesztelni lehessen mentés
// előtt.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ ok: false, error: "Érvénytelen kérés." }, { status: 400 });

  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });

  let fromAddr = body.fromAddr ?? null;
  let toAddrs: string[] = [];
  let subject = body.subject ?? "";
  let accountId = body.accountId ?? "";
  let hasAttachment = body.hasAttachment ?? false;

  if (body.mailMessageId) {
    const { data: message } = await supabase.from("mail_messages").select("*").eq("id", body.mailMessageId).maybeSingle();
    if (!message) return NextResponse.json({ ok: false, error: "A levél nem található." }, { status: 404 });
    fromAddr = message.from_addr;
    toAddrs = message.to_addrs ?? [];
    subject = message.subject ?? "";
    accountId = message.account_id;
    hasAttachment = message.has_attachments;
  }

  const knownSender = await resolveKnownSender(supabase, fromAddr);

  const { data: existingRules } = await supabase.from("mail_rules").select("*").eq("enabled", true);
  const candidateRules = [...(existingRules ?? [])];
  if (body.conditions) {
    candidateRules.push({
      id: "__draft__",
      name: "(ez a szabály — még mentés előtt)",
      enabled: true,
      sort_order: -1, // elsőként értékelődjön ki, hogy a szerkesztett szabály eredménye látszódjon
      conditions: body.conditions,
      actions: body.actions ?? [],
      created_at: "",
      updated_at: "",
    });
  }

  const matched = findMatchingRule(candidateRules, { fromAddr, toAddrs, subject, accountId, hasAttachment }, knownSender);

  return NextResponse.json({
    ok: true,
    matchedRule: matched ? { id: matched.id, name: matched.name } : null,
    knownSender,
  });
}
