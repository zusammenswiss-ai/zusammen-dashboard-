// Postafiók — a besorolási szabálymotor kiértékelője (feladat 5/B/e
// pont). Szerver-only (service-role kliens) — csak az IMAP-szinkronból
// (lib/mail-sync.ts) és a szabály-teszt API route-ból importálható.
//
// A szabályok feltételei ÉS-kapcsoltak egy szabályon belül, a szabályok
// maguk sorrend szerint (mail_rules.sort_order) kerülnek kiértékelésre,
// az ELSŐ illeszkedő szabály nyer (nem kumulálódnak) — ez felel meg a
// feladat "a szabályok sorrendje állítható" megfogalmazásának. A kézi
// besorolás (area_is_manual/owner_is_manual) SOHA nem íródik felül —
// lásd minden egyes action alkalmazásánál a manual-flag ellenőrzést.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MailRule, MailRuleCondition, MailRuleAction, ServerDatabase } from "@/lib/supabase/types";

export type MailRuleContext = {
  fromAddr: string | null;
  toAddrs: string[];
  subject: string;
  accountId: string;
  hasAttachment: boolean;
};

export type KnownSenderMatch = { type: "signup" | "customer" | "supplier"; id: string; label: string } | null;

/** A feladat 5/B/e pontja explicit feltétel-típusa: "a feladó ismert-e
 * (jelentkező / vevő / beszállító)". A FROM cím alapján dönt — bejövő
 * levélnél ez mindig a tényleges feladó, ezért ez a függvény csak
 * fromAddr-t néz (a kimenő, Sent-mappából szinkronizált levelek
 * jelentkező-társítása már a sync saját logikájában külön történik,
 * lásd lib/mail-sync.ts resolveSignupId). */
export async function resolveKnownSender(supabase: SupabaseClient<ServerDatabase>, fromAddr: string | null): Promise<KnownSenderMatch> {
  if (!fromAddr) return null;
  const lowered = fromAddr.toLowerCase();

  const { data: signup } = await supabase.from("first20_signups").select("id, first_name").eq("email", lowered).maybeSingle();
  if (signup) return { type: "signup", id: signup.id, label: signup.first_name };

  const { data: order } = await supabase.from("orders").select("id, customer_name").ilike("customer_email", lowered).limit(1).maybeSingle();
  if (order) return { type: "customer", id: order.id, label: order.customer_name };

  const { data: supplier } = await supabase.from("suppliers").select("id, name").ilike("contact_email", lowered).limit(1).maybeSingle();
  if (supplier) return { type: "supplier", id: supplier.id, label: supplier.name };

  return null;
}

function evaluateCondition(condition: MailRuleCondition, ctx: MailRuleContext, knownSender: KnownSenderMatch): boolean {
  switch (condition.type) {
    case "sender_known":
      return Boolean(knownSender) && (!condition.value || knownSender?.type === condition.value);
    case "sender_domain":
      return Boolean(ctx.fromAddr && condition.value && ctx.fromAddr.toLowerCase().endsWith(`@${condition.value.toLowerCase()}`));
    case "sender_address":
      return Boolean(ctx.fromAddr && condition.value && ctx.fromAddr.toLowerCase() === condition.value.toLowerCase());
    case "subject_contains":
      return Boolean(condition.value && ctx.subject.toLowerCase().includes(condition.value.toLowerCase()));
    case "account_id":
      return ctx.accountId === condition.value;
    case "has_attachment":
      return ctx.hasAttachment;
    default:
      return false;
  }
}

export function findMatchingRule(rules: MailRule[], ctx: MailRuleContext, knownSender: KnownSenderMatch): MailRule | null {
  const enabled = [...rules].filter((r) => r.enabled).sort((a, b) => a.sort_order - b.sort_order);
  for (const rule of enabled) {
    if (rule.conditions.length === 0) continue;
    if (rule.conditions.every((c) => evaluateCondition(c, ctx, knownSender))) return rule;
  }
  return null;
}

const ENTITY_TYPE_BY_SENDER_TYPE: Record<Exclude<KnownSenderMatch, null>["type"], "signup" | "order" | "supplier"> = {
  signup: "signup",
  customer: "order",
  supplier: "supplier",
};

/** Egy illeszkedő szabály műveleteinek alkalmazása egy már létező
 * szálra. A `create_task` művelet a feladat 5/B/f pontját követi:
 * szálanként legfeljebb egy nyitott feladat, a terület
 * auto_task_enabled/auto_task_due_days beállítása szerint. */
export async function applyRuleActions(
  supabase: SupabaseClient<ServerDatabase>,
  threadId: string,
  actions: MailRuleAction[],
  knownSender: KnownSenderMatch,
  ruleName: string
): Promise<void> {
  const { data: thread } = await supabase.from("mail_threads").select("*").eq("id", threadId).maybeSingle();
  if (!thread) return;

  const update: Record<string, unknown> = {};
  const activity: { action: string; detail: Record<string, unknown> }[] = [];

  for (const action of actions) {
    switch (action.type) {
      case "set_area":
        if (!thread.area_is_manual && action.value && action.value !== thread.area) {
          update.area = action.value;
          activity.push({ action: "area_changed", detail: { from: thread.area, to: action.value, by_rule: ruleName } });
        }
        break;
      case "set_owner":
        if (!thread.owner_is_manual && action.value && action.value !== thread.owner) {
          update.owner = action.value;
          activity.push({ action: "owner_changed", detail: { from: thread.owner, to: action.value, by_rule: ruleName } });
        }
        break;
      case "set_priority":
        if (action.value && action.value !== thread.priority) {
          update.priority = action.value;
          activity.push({ action: "priority_changed", detail: { from: thread.priority, to: action.value, by_rule: ruleName } });
        }
        break;
      case "set_label":
        if (action.value) await applyLabel(supabase, threadId, action.value);
        break;
      case "link_known_sender":
        if (knownSender) await linkKnownSender(supabase, threadId, knownSender);
        break;
      case "create_task":
        await createAutoTaskIfNeeded(supabase, threadId, update.area as string | undefined, thread.subject, ruleName);
        break;
      case "create_support_ticket":
        await createSupportTicketIfNeeded(supabase, threadId, thread.subject, ruleName);
        break;
      // "mark_unread": nincs külön teendő — egy új bejövő levél eleve
      // olvasatlan (read_at NULL), ez a művelet csak kompatibilitási
      // helyőrző a feladat action-listájából.
      default:
        break;
    }
  }

  if (Object.keys(update).length > 0) {
    await supabase.from("mail_threads").update(update).eq("id", threadId);
  }
  if (activity.length > 0) {
    await supabase.from("mail_activity").insert(activity.map((a) => ({ thread_id: threadId, actor: `rule:${ruleName}`, action: a.action, detail: a.detail })));
  }
}

async function applyLabel(supabase: SupabaseClient<ServerDatabase>, threadId: string, labelName: string): Promise<void> {
  let { data: label } = await supabase.from("mail_labels").select("id").eq("name", labelName).maybeSingle();
  if (!label) {
    const { data: created } = await supabase.from("mail_labels").insert({ name: labelName }).select("id").single();
    label = created ?? null;
  }
  if (label) await supabase.from("mail_thread_labels").upsert({ thread_id: threadId, label_id: label.id });
}

async function linkKnownSender(supabase: SupabaseClient<ServerDatabase>, threadId: string, knownSender: NonNullable<KnownSenderMatch>): Promise<void> {
  const entityType = ENTITY_TYPE_BY_SENDER_TYPE[knownSender.type];
  await supabase.from("mail_thread_links").upsert({ thread_id: threadId, entity_type: entityType, entity_id: knownSender.id }, { onConflict: "thread_id,entity_type,entity_id" });
}

async function createAutoTaskIfNeeded(
  supabase: SupabaseClient<ServerDatabase>,
  threadId: string,
  appliedArea: string | undefined,
  subject: string,
  ruleName: string
): Promise<void> {
  const { data: existingOpen } = await supabase.from("tasks").select("id").eq("mail_thread_id", threadId).neq("status", "Kész").limit(1).maybeSingle();
  if (existingOpen) return;

  const { data: thread } = await supabase.from("mail_threads").select("area, owner").eq("id", threadId).maybeSingle();
  const area = appliedArea || thread?.area || "unsorted";
  const { data: areaRow } = await supabase.from("mail_areas").select("*").eq("key", area).maybeSingle();
  if (areaRow && !areaRow.auto_task_enabled) return;

  const dueDate = areaRow?.auto_task_due_days
    ? new Date(Date.now() + areaRow.auto_task_due_days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : null;

  await supabase.from("tasks").insert({
    title: `Válasz: ${subject}`,
    category: areaRow?.label || area,
    task_type: "Egyszeri",
    status: "Teendő",
    due_date: dueDate,
    assignee: thread?.owner ?? null,
    mail_thread_id: threadId,
    notes: `Automatikusan létrehozva a "${ruleName}" Postafiók-szabály alapján.`,
  });
  await supabase.from("mail_activity").insert({ thread_id: threadId, actor: `rule:${ruleName}`, action: "task_created", detail: { title: `Válasz: ${subject}` } });
}

/** A feladat 5/B/e pontjának "ügyfélszolgálati címre érkező levél →
 * új eset" alapszabálya. Szálanként legfeljebb egy esetet nyit (ha a
 * szál már kapcsolva van egy support_tickets sorhoz, nem csinál
 * újat) — ugyanaz a "ne duplikálj" elv, mint a feladat-létrehozásnál. */
async function createSupportTicketIfNeeded(
  supabase: SupabaseClient<ServerDatabase>,
  threadId: string,
  subject: string,
  ruleName: string
): Promise<void> {
  const { data: existingLink } = await supabase
    .from("mail_thread_links")
    .select("entity_id")
    .eq("thread_id", threadId)
    .eq("entity_type", "support_ticket")
    .limit(1)
    .maybeSingle();
  if (existingLink) return;

  const { data: latestInbound } = await supabase
    .from("mail_messages")
    .select("from_addr, from_name")
    .eq("thread_id", threadId)
    .eq("direction", "in")
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      customer_name: latestInbound?.from_name || latestInbound?.from_addr || "Ismeretlen feladó",
      contact: latestInbound?.from_addr ?? null,
      channel: "Email",
      topic: "Egyéb",
      notes: `Automatikusan létrehozva a Postafiók "${subject}" szála alapján ("${ruleName}" szabály).`,
    })
    .select("id")
    .single();
  if (ticketError || !ticket) return;

  await supabase.from("mail_thread_links").upsert(
    { thread_id: threadId, entity_type: "support_ticket", entity_id: ticket.id },
    { onConflict: "thread_id,entity_type,entity_id" }
  );
  await supabase
    .from("mail_activity")
    .insert({ thread_id: threadId, actor: `rule:${ruleName}`, action: "support_ticket_created", detail: { ticket_id: ticket.id } });
}
