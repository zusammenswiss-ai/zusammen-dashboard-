// Szerver-only — ez a fájl küld a Postafiók modulon keresztül (lásd
// lib/mail-send.ts — NEM Brevón, a feladat "Zusammen-First20-Jelentkezok-
// Email-Code-Prompt" 2) pontja helyett ez a modul küld) és ír a
// first20_emails/first20_signups táblákba, ezért csak API route-okból
// (app/api/marketing/first20/send, app/api/cron/first20-emails) szabad
// importálni, soha "use client" komponensből. A tényleges sablon-
// tartalom lib/first20-emails.ts-ben él (az importálható mindkét
// oldalról) — ez a fájl csak a küldést, a naplózást és a
// dupla-küldés elleni védelmet végzi.
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServerDatabase, First20Signup, First20Email, First20EmailType, First20Language } from "@/lib/supabase/types";
import { sendAndLogMail } from "@/lib/mail-send";
import { renderFirst20Email } from "@/lib/first20-emails";
import { legalDocumentUrl } from "@/lib/legal-links";
import { SITE_URL } from "@/lib/site-url";
import { FIRST20_RESEND_COOLDOWN_MS } from "@/lib/first20-signup-status";

// "Teszt küldés magamnak" mindig ide megy, szerveroldalon kikényszerítve
// — a kliens sosem adhat át másik "teszt" cél-címet, lásd a send route
// kommentjét.
export const FIRST20_FOUNDER_TEST_EMAIL = "keresztesibarbara5@gmail.com";

function kitUrl(lang: First20Signup["language_choice"]): string {
  return `${SITE_URL}/first20-kit/kit-${lang}.pdf`;
}

function feedbackUrl(token: string): string {
  return `${SITE_URL}/first20/feedback/${token}`;
}

/** Minden jelentkezőnek kell egy token, mielőtt bármilyen e-mailt
 * küldünk neki (a Készlet/Emlékeztető levél is a {{feedback_url}}-hoz
 * vezető útvonalon landol előbb-utóbb) — a migráció a meglévő sorokat
 * visszamenőleg pótolta, ez itt a biztonsági háló minden ÚJ sorhoz,
 * ha valamiért mégsem lenne token (pl. az /api/first20/signup route-ot
 * valaki megkerülve, direkt SQL-lel vett fel egy sort). */
export async function ensureSignupToken(
  supabase: SupabaseClient<ServerDatabase>,
  signup: First20Signup
): Promise<string> {
  if (signup.token) return signup.token;
  const token = randomBytes(16).toString("hex");
  const { data, error } = await supabase
    .from("first20_signups")
    .update({ token })
    .eq("id", signup.id)
    .select()
    .single();
  if (error || !data?.token) throw new Error(error?.message || "Nem sikerült tokent generálni a jelentkezőhöz.");
  return data.token;
}

/** Az adott típusra, 24 órán belül volt-e már (sikeres) küldés ehhez a
 * jelentkezőhöz — a "Küldés" gomb ez alapján kér explicit megerősítést
 * ismételt küldés előtt. */
export async function findRecentSend(
  supabase: SupabaseClient<ServerDatabase>,
  signupId: string,
  type: First20EmailType
): Promise<First20Email | null> {
  const since = new Date(Date.now() - FIRST20_RESEND_COOLDOWN_MS).toISOString();
  const { data } = await supabase
    .from("first20_emails")
    .select("*")
    .eq("signup_id", signupId)
    .eq("type", type)
    .eq("status", "sent")
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

type SendParams = {
  supabase: SupabaseClient<ServerDatabase>;
  signup: First20Signup;
  type: First20EmailType;
  trigger: "manual" | "auto";
  sentBy: string | null;
  /** Ha megvan adva, a tényleges e-mail EZT a cél-címet kapja (teszt
   * küldés), és a jelentkező sorát/időbélyegeit nem érinti a küldés —
   * csak egy first20_emails napló-sor készül róla, trigger mindig
   * "manual" marad, és a dedup-ellenőrzés sem fut rá. */
  testOverrideEmail?: string;
  customSubject?: string;
  customBodyText?: string;
  /** Ha meg van adva, EZEN a nyelven megy ki a levél a jelentkező saját
   * language_choice-ától függetlenül (pl. ha valaki magyarul jelentkezett,
   * de a founder németül szeretné elküldeni neki a Készlet-emailt). A
   * first20_emails.language naplósor is ezt a tényleges nyelvet rögzíti,
   * nem a jelentkező törzsadatát. */
  language?: First20Language;
};

type SendResult =
  | { ok: true; email: First20Email; signup: First20Signup }
  | { ok: false; error: string };

/** A tényleges küldés — egyetlen hely, amit a kézi "Küldés" gomb
 * (app/api/marketing/first20/send) ÉS a napi cron
 * (app/api/cron/first20-emails) is hív, hogy a kettő sosem térjen el
 * egymástól. Mindig beír egy first20_emails sort (sikeres és
 * sikertelen küldésnél is), és sikeres, valódi (nem teszt) küldésnél
 * frissíti a jelentkező megfelelő időbélyegét/státuszát/email_error
 * mezőjét is. */
export async function sendFirst20Email(params: SendParams): Promise<SendResult> {
  const { supabase, signup, type, trigger, sentBy, testOverrideEmail, customSubject, customBodyText } = params;

  let token: string;
  try {
    token = await ensureSignupToken(supabase, signup);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Nem sikerült tokent generálni." };
  }

  const lang = params.language ?? signup.language_choice;
  const privacyBase = await legalDocumentUrl(supabase, "Adatvédelem");
  const privacyUrl = lang === "hu" ? privacyBase : `${privacyBase}?lang=${lang}`;

  const { subject, html } = renderFirst20Email(
    type,
    lang,
    { firstName: signup.first_name, kitUrl: kitUrl(lang), feedbackUrl: feedbackUrl(token), orderLanguage: signup.order_language },
    { privacyUrl, unsubscribeHref: "{unsubscribe}", customSubject, customBodyText }
  );

  const isTest = Boolean(testOverrideEmail);
  const recipientEmail = testOverrideEmail ?? signup.email;
  const recipientName = isTest ? null : signup.first_name;

  const { data: emailRow, error: insertError } = await supabase
    .from("first20_emails")
    .insert({
      signup_id: signup.id,
      type,
      language: lang,
      subject,
      status: "queued",
      trigger: isTest ? "manual" : trigger,
      sent_by: sentBy,
    })
    .select()
    .single();
  if (insertError || !emailRow) {
    return { ok: false, error: insertError?.message || "Nem sikerült naplózni az e-mailt." };
  }

  const result = await sendAndLogMail({
    supabase,
    to: recipientEmail,
    toName: recipientName,
    subject: `${subject}${isTest ? " [TESZT]" : ""}`,
    html,
    signupId: isTest ? null : signup.id,
    sentVia: "campaign",
    sentBy,
    skipLogging: isTest,
  });

  const { data: updatedEmailRow } = await supabase
    .from("first20_emails")
    .update(
      result.ok
        ? { status: "sent", sent_at: new Date().toISOString(), error: null, provider_message_id: result.messageId }
        : { status: "failed", error: result.error }
    )
    .eq("id", emailRow.id)
    .select()
    .single();

  if (isTest) {
    // Teszt küldés — a jelentkező sorát szándékosan nem érinti.
    return result.ok
      ? { ok: true, email: updatedEmailRow ?? emailRow, signup }
      : { ok: false, error: result.error };
  }

  const signupPatch: Partial<First20Signup> = {};
  if (result.ok) {
    signupPatch.email_error = null;
    if (type === "kit") {
      signupPatch.kit_sent_at = new Date().toISOString();
      if (signup.status === "Jelentkezett") signupPatch.status = "Kit elküldve";
    } else if (type === "reminder") {
      signupPatch.reminder_sent_at = new Date().toISOString();
    } else if (type === "feedback") {
      signupPatch.feedback_mail_sent_at = new Date().toISOString();
    }
  } else {
    signupPatch.email_error = result.error;
  }

  const { data: updatedSignup, error: signupUpdateError } = await supabase
    .from("first20_signups")
    .update(signupPatch)
    .eq("id", signup.id)
    .select()
    .single();

  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  if (signupUpdateError || !updatedSignup) {
    // A levél kiment és naplózva van — csak a jelentkező saját
    // időbélyegeinek frissítése futott hibára. Ezt jelezzük, de nem
    // mondjuk sikertelennek a küldést magát.
    return { ok: true, email: updatedEmailRow ?? emailRow, signup };
  }
  return { ok: true, email: updatedEmailRow ?? emailRow, signup: updatedSignup };
}
