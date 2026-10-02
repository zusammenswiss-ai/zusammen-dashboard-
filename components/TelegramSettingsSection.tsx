"use client";

import { useCallback, useEffect, useState } from "react";
import { Send, Check, ShieldCheck, KeyRound, Trash2, RefreshCw, Webhook, Users, UserPlus, Copy } from "lucide-react";
import { Spinner } from "@/components/Feedback";
import type { TelegramTrustedUser, TelegramInviteCode } from "@/lib/supabase/types";

type Status = {
  botTokenConfigured: boolean;
  chatId: string | null;
  notificationsEnabled: boolean;
  webhookActive: boolean;
};

/**
 * Beállítások → "Telegram" — kimenő (napi emlékeztetők Telegramon is) és
 * bejövő (a botnak küldött bármilyen üzenetből gyors Feladat lesz)
 * összekapcsolás, ugyanaz a minta, mint az Email küldés menünél: a bot
 * token adatbázisban, titkosítva tárolva, nem Vercel env var.
 */
export default function TelegramSettingsSection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [botTokenInput, setBotTokenInput] = useState("");
  const [chatIdInput, setChatIdInput] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clearingToken, setClearingToken] = useState(false);
  const [fetchingChatId, setFetchingChatId] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [togglingWebhook, setTogglingWebhook] = useState(false);

  const [trustedUsers, setTrustedUsers] = useState<TelegramTrustedUser[]>([]);
  const [inviteCodes, setInviteCodes] = useState<TelegramInviteCode[]>([]);
  const [inviteLabel, setInviteLabel] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [revokingCodeId, setRevokingCodeId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, usersRes, codesRes] = await Promise.all([
        fetch("/api/telegram-settings"),
        fetch("/api/telegram-settings/trusted-users"),
        fetch("/api/telegram-settings/invite-codes"),
      ]);
      const data = (await statusRes.json()) as Status;
      setStatus(data);
      setChatIdInput(data.chatId ?? "");
      setNotificationsEnabled(data.notificationsEnabled);
      const usersData = await usersRes.json();
      if (usersData.ok) setTrustedUsers(usersData.users);
      const codesData = await codesRes.json();
      if (codesData.ok) setInviteCodes(codesData.codes);
    } catch {
      setError("Nem sikerült betölteni a Telegram beállításokat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setCreatingInvite(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/telegram-settings/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: inviteLabel }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Nem sikerült meghívó kódot generálni.");
      setInviteCodes(data.codes);
      setInviteLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült meghívó kódot generálni.");
    } finally {
      setCreatingInvite(false);
    }
  }

  async function revokeInvite(id: string) {
    setRevokingCodeId(id);
    setError(null);
    try {
      const res = await fetch(`/api/telegram-settings/invite-codes?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) setInviteCodes(data.codes);
    } finally {
      setRevokingCodeId(null);
    }
  }

  async function removeUser(id: string) {
    setRemovingUserId(id);
    setError(null);
    try {
      const res = await fetch(`/api/telegram-settings/trusted-users?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) setTrustedUsers(data.users);
    } finally {
      setRemovingUserId(null);
    }
  }

  async function copyInviteInstructions(code: string) {
    const text = `Szia! Csatlakozz a Telegram-botomhoz: nyisd meg a botot, és küldd el neki ezt az üzenetet: /csatlakozas ${code}`;
    try {
      await navigator.clipboard.writeText(text);
      setInfo("Meghívó szöveg vágólapra másolva.");
    } catch {
      // Clipboard API nem minden böngészőben/kontextusban elérhető — a
      // kód amúgy is látható a listában, kézzel is kimásolható.
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/telegram-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: botTokenInput.trim() || undefined,
          chatId: chatIdInput,
          notificationsEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Nem sikerült menteni.");
      setStatus(data.status);
      setBotTokenInput("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült menteni.");
    } finally {
      setSaving(false);
    }
  }

  async function clearToken() {
    setClearingToken(true);
    setError(null);
    try {
      const res = await fetch("/api/telegram-settings/clear-token", { method: "POST" });
      const data = await res.json();
      if (data.status) setStatus(data.status);
    } finally {
      setClearingToken(false);
    }
  }

  async function fetchChatId() {
    setFetchingChatId(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/telegram-settings/fetch-chat-id", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Nem sikerült lekérni a chat ID-t.");
      setStatus(data.status);
      setChatIdInput(data.status.chatId ?? "");
      setInfo("Chat ID sikeresen lekérve és elmentve.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült lekérni a chat ID-t.");
    } finally {
      setFetchingChatId(false);
    }
  }

  async function sendTest() {
    setSendingTest(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/telegram-settings/test-message", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Nem sikerült elküldeni a teszt üzenetet.");
      setInfo("Teszt üzenet elküldve — nézd meg a Telegramot.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült elküldeni a teszt üzenetet.");
    } finally {
      setSendingTest(false);
    }
  }

  async function toggleWebhook() {
    setTogglingWebhook(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/telegram-settings/webhook", { method: status?.webhookActive ? "DELETE" : "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Nem sikerült módosítani a webhookot.");
      setStatus(data.status);
      setInfo(data.status.webhookActive ? "Bejövő üzenetek bekapcsolva." : "Bejövő üzenetek kikapcsolva.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült módosítani a webhookot.");
    } finally {
      setTogglingWebhook(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="card max-w-xl p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Send size={18} className="text-bronze" />
        <h2 className="font-serif text-lg text-forest">Telegram</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted">
        Kimenő: a napi emlékeztető és a „Várakozás” ellenőrzés-digest email mellett Telegramon is kiküldve. Bejövő:
        amit a saját botodnak üzensz, abból azonnal Feladat lesz a dashboardon.
      </p>
      <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-ivory-dim px-3 py-2 text-xs text-muted">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-bronze" />
        Beállítás: 1) Telegramban keress rá a @BotFather-re, küldj neki <code>/newbot</code>-ot, kövesd az
        utasításokat, másold ki a kapott API-tokent. 2) Illeszd be ide, mentsd el. 3) Nyisd meg a saját botodat
        Telegramban, küldj neki bármilyen üzenetet. 4) Kattints a „Chat ID lekérése” gombra.
      </p>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      {info && !error && <p className="mt-3 text-xs text-forest">{info}</p>}

      <form onSubmit={save} className="mt-4 flex flex-col gap-4">
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
            <KeyRound size={12} /> Bot token
          </label>
          <input
            type="password"
            className="input"
            value={botTokenInput}
            onChange={(e) => setBotTokenInput(e.target.value)}
            placeholder={status?.botTokenConfigured ? "•••••••••••••••• (beállítva — üresen hagyva változatlan marad)" : "123456:ABC-DEF..."}
            autoComplete="off"
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="text-xs text-muted">{status?.botTokenConfigured ? "Beállítva (titkosítva tárolva)." : "Még nincs beállítva."}</p>
            {status?.botTokenConfigured && (
              <button
                type="button"
                onClick={clearToken}
                disabled={clearingToken}
                className="flex shrink-0 items-center gap-1 text-xs text-muted/70 hover:text-red-600"
              >
                <Trash2 size={12} /> {clearingToken ? "Törlés…" : "Token törlése"}
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Chat ID</label>
          <div className="flex items-center gap-2">
            <input className="input flex-1" value={chatIdInput} onChange={(e) => setChatIdInput(e.target.value)} placeholder="pl. 123456789" />
            <button
              type="button"
              onClick={fetchChatId}
              disabled={fetchingChatId || !status?.botTokenConfigured}
              className="btn btn-ghost shrink-0 !px-3 !py-1.5 text-xs"
            >
              <RefreshCw size={13} /> {fetchingChatId ? "Lekérés…" : "Chat ID lekérése"}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-forest">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          Napi emlékeztetők küldése Telegramon is
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="btn btn-primary w-fit">
            {saving ? "Mentés…" : "Mentés"}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-xs font-medium text-forest">
              <Check size={13} /> Mentve
            </span>
          )}
          <button
            type="button"
            onClick={sendTest}
            disabled={sendingTest || !status?.botTokenConfigured || !status?.chatId}
            className="btn btn-ghost !px-3 !py-1.5 text-xs"
          >
            <Send size={13} /> {sendingTest ? "Küldés…" : "Teszt üzenet küldése"}
          </button>
        </div>
      </form>

      <div className="mt-5 rounded-lg border border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Webhook size={15} className={status?.webhookActive ? "text-forest" : "text-muted"} />
            <span className="text-forest">Bejövő üzenetek: {status?.webhookActive ? "bekapcsolva" : "kikapcsolva"}</span>
          </div>
          <button
            type="button"
            onClick={toggleWebhook}
            disabled={togglingWebhook || !status?.botTokenConfigured || !status?.chatId}
            className="btn btn-ghost shrink-0 !px-3 !py-1.5 text-xs"
          >
            {togglingWebhook ? "…" : status?.webhookActive ? "Kikapcsolás" : "Bekapcsolás"}
          </button>
        </div>
        {status?.webhookActive && (
          <p className="mt-2 text-xs text-muted">
            Sima üzenet → gyors <strong>Feladat</strong>. <code>/ugyfel Ügyfél neve | jegyzet</code> → gyors{" "}
            <strong>Megkeresés</strong> az Ügyfélszolgálat modulban (a „ | ” és utána a név elhagyható, akkor az
            egész szöveg jegyzetként kerül be). Bárki más, aki ismeretlenül ír a botnak, automatikusan{" "}
            <strong>Megkeresést</strong> kap az Ügyfélszolgálatban — ők nem tudnak Feladatot létrehozni.
          </p>
        )}
      </div>

      {status?.webhookActive && (
        <div className="mt-5 rounded-lg border border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Users size={15} className="text-bronze" />
            <span className="text-forest">Csapattagok</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Egy meghívó kóddal csatlakozott csapattag ugyanúgy tud Feladatot/Megkeresést rögzíteni a botban, mint te.
          </p>

          {trustedUsers.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {trustedUsers.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2 rounded-md bg-ivory-dim px-3 py-1.5 text-sm">
                  <span className="text-forest">{u.label}</span>
                  <button
                    type="button"
                    onClick={() => removeUser(u.id)}
                    disabled={removingUserId === u.id}
                    className="flex shrink-0 items-center gap-1 text-xs text-muted/70 hover:text-red-600"
                  >
                    <Trash2 size={12} /> {removingUserId === u.id ? "Törlés…" : "Eltávolítás"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={createInvite} className="mt-3 flex items-center gap-2">
            <input
              className="input flex-1"
              value={inviteLabel}
              onChange={(e) => setInviteLabel(e.target.value)}
              placeholder="Csapattag neve, pl. Peti"
            />
            <button type="submit" disabled={creatingInvite} className="btn btn-ghost shrink-0 !px-3 !py-1.5 text-xs">
              <UserPlus size={13} /> {creatingInvite ? "Generálás…" : "Meghívó kód"}
            </button>
          </form>

          {inviteCodes.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {inviteCodes.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-md bg-ivory-dim px-3 py-1.5 text-sm">
                  <div>
                    <span className="font-mono text-forest">{c.code}</span>
                    <span className="ml-2 text-xs text-muted">{c.label} — érvényes {new Date(c.expires_at).toLocaleString("hu-HU")}-ig</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyInviteInstructions(c.code)}
                      className="flex items-center gap-1 text-xs text-muted/70 hover:text-forest"
                    >
                      <Copy size={12} /> Másolás
                    </button>
                    <button
                      type="button"
                      onClick={() => revokeInvite(c.id)}
                      disabled={revokingCodeId === c.id}
                      className="flex items-center gap-1 text-xs text-muted/70 hover:text-red-600"
                    >
                      <Trash2 size={12} /> {revokingCodeId === c.id ? "…" : "Visszavonás"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">
            Küldd el a csapattagnak a kódot (pl. WhatsAppon), ő pedig a botban a{" "}
            <code>/csatlakozas KÓD</code> üzenettel aktiválja. A kód 24 órán belül lejár, és csak egyszer
            használható fel.
          </p>
        </div>
      )}
    </div>
  );
}
