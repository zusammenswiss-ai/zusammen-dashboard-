// Postafiók — IMAP/SMTP kapcsolat-építés egy mail_accounts sorból, és a
// "Kapcsolat tesztelése" gomb logikája. Szerver-only (imapflow/nodemailer
// sosem fusson a böngészőben) — csak API route-okból és a küldő/szinkron
// lib-ekből importálható.
//
// A Dashboard Vercelen szerver nélküli függvényekben fut — nincs tartós
// IMAP-kapcsolat, minden IMAP-művelet rövid életű: nyit, dolgozik,
// `logout()`-tal zár (lásd a feladat "KALAPOS" megjegyzését a 3.
// pontban). Ez a modul mindig egy teljes connect→use→logout ciklust ad
// vissza egy helperben, sosem tart nyitva kapcsolatot hívások között.
import { ImapFlow } from "imapflow";
import nodemailer, { type Transporter } from "nodemailer";
import { decryptMailSecret } from "@/lib/mail-crypto";
import type { MailAccount, MailSecureMode } from "@/lib/supabase/types";

function imapSecureToOptions(mode: MailSecureMode): { secure: boolean } {
  // imapflow secure:true = közvetlen TLS; secure:false = STARTTLS-t
  // automatikusan felajánlja, ha a szerver támogatja (IMAP-nál nincs
  // külön "kényszerített STARTTLS" kapcsoló, lásd imapflow doksi).
  return { secure: mode !== "starttls" && mode !== "none" };
}

export function createImapClient(account: MailAccount): ImapFlow {
  const password = decryptMailSecret(account.password_encrypted);
  return new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    ...imapSecureToOptions(account.imap_secure),
    auth: { user: account.username, pass: password },
    // false = ne naplózzon semmit — a feladat 5. pontja explicit tiltja
    // a jelszó/levéltartalom szerver-naplóba írását, és az imapflow
    // alapértelmezett logger-je IMAP-parancsokat (köztük a LOGIN sort)
    // írna ki.
    logger: false,
    disableAutoIdle: true,
  });
}

export function createSmtpTransport(account: MailAccount): Transporter {
  const password = decryptMailSecret(account.password_encrypted);
  return nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: account.smtp_secure === "tls",
    requireTLS: account.smtp_secure === "starttls",
    auth: { user: account.username, pass: password },
  });
}

type ProtocolTestResult = { ok: true } | { ok: false; error: string };

/** Egy-egy IMAP/SMTP hibaüzenetet alakít érthető magyar szöveggé —
 * "hibás jelszó, hibás port, tanúsítvány hiba" (a feladat 1. pontja). A
 * node-imap/SMTP könyvtárak nyers hibaüzenetei angolul és gyakran
 * kódszerűek, ezért a leggyakoribb esetekre mintázunk, a többinél a
 * nyers üzenetet adjuk tovább (jobb egy angol hibaüzenet, mint semmi). */
function friendlyError(err: unknown, protocol: "IMAP" | "SMTP"): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  const code = (err as { code?: string; responseCode?: number })?.code;
  if (lower.includes("authenticationfailed") || lower.includes("invalid credentials") || code === "EAUTH" || lower.includes("535")) {
    return `${protocol}: hibás felhasználónév vagy jelszó.`;
  }
  if (lower.includes("econnrefused")) {
    return `${protocol}: a szerver elutasította a kapcsolatot — ellenőrizd a host/port beállítást.`;
  }
  if (lower.includes("etimedout") || lower.includes("timeout")) {
    return `${protocol}: időtúllépés — ellenőrizd a host/port beállítást és hogy a szerver elérhető-e.`;
  }
  if (lower.includes("cert") || lower.includes("self signed") || lower.includes("unable to verify")) {
    return `${protocol}: TLS-tanúsítvány hiba — ellenőrizd a host nevet és a biztonsági beállítást (TLS/STARTTLS).`;
  }
  if (lower.includes("enotfound") || lower.includes("getaddrinfo")) {
    return `${protocol}: a megadott szervernév nem található — ellenőrizd a host beállítást.`;
  }
  return `${protocol}: ${raw}`;
}

/** IMAP belépés + azonnali kilépés (nem olvas, nem jelöl meg semmit
 * olvasottnak — a feladat 6. pontja tiltja, hogy fejlesztés közben
 * bármit megnyisson/elolvasson). SMTP: nodemailer `verify()`, ami
 * belép, de nem küld semmit. */
export async function testMailAccountConnection(
  account: MailAccount
): Promise<{ imap: ProtocolTestResult; smtp: ProtocolTestResult }> {
  const imapResult = await (async (): Promise<ProtocolTestResult> => {
    const client = createImapClient(account);
    try {
      await client.connect();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: friendlyError(err, "IMAP") };
    } finally {
      try {
        client.close();
      } catch {
        // A kapcsolat már valószínűleg nem él — a close() hibáját nem
        // érdemes a felhasználónak megmutatni a valódi teszt-eredmény
        // helyett.
      }
    }
  })();

  const smtpResult = await (async (): Promise<ProtocolTestResult> => {
    const transport = createSmtpTransport(account);
    try {
      await transport.verify();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: friendlyError(err, "SMTP") };
    } finally {
      transport.close();
    }
  })();

  return { imap: imapResult, smtp: smtpResult };
}
