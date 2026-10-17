"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, FlaskConical, Loader2, X, Check } from "lucide-react";
import type { MailRule, MailRuleCondition, MailRuleAction, MailArea } from "@/lib/supabase/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import { errorMessage } from "@/lib/errors";

const CONDITION_TYPES: { value: MailRuleCondition["type"]; label: string; needsValue: boolean }[] = [
  { value: "sender_known", label: "Feladó ismert (jelentkező/vevő/beszállító)", needsValue: true },
  { value: "sender_domain", label: "Feladó domainje", needsValue: true },
  { value: "sender_address", label: "Feladó pontos címe", needsValue: true },
  { value: "subject_contains", label: "Tárgy tartalmazza", needsValue: true },
  { value: "account_id", label: "Melyik fiókra érkezett", needsValue: true },
  { value: "has_attachment", label: "Van csatolmánya", needsValue: false },
];

const ACTION_TYPES: { value: MailRuleAction["type"]; label: string; needsValue: boolean }[] = [
  { value: "set_area", label: "Terület beállítása", needsValue: true },
  { value: "set_label", label: "Címke hozzáadása", needsValue: true },
  { value: "set_owner", label: "Felelős beállítása", needsValue: true },
  { value: "set_priority", label: "Prioritás beállítása", needsValue: true },
  { value: "link_known_sender", label: "Kapcsolás az ismert feladóhoz", needsValue: false },
  { value: "create_task", label: "Feladat létrehozása", needsValue: false },
  { value: "mark_unread", label: "Maradjon olvasatlan", needsValue: false },
];

/** Postafiók → Szabályok — egyszerű, adatvezérelt szabálymotor
 * kezelőfelülete (feladat 5/B/e pont). A kiértékelés maga
 * lib/mail-rules-engine.ts-ben él, ez csak a CRUD + sorrend + teszt UI. */
export default function MailRulesSection() {
  const [rules, setRules] = useState<MailRule[]>([]);
  const [areas, setAreas] = useState<MailArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<"new" | string | null>(null);

  const supabase = getSupabaseClient();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mail/rules");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Nem sikerült betölteni a szabályokat.");
      setRules(data.rules);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült betölteni a szabályokat."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase.from("mail_areas").select("*").order("sort_order");
      setAreas(data ?? []);
    })();
  }, [supabase]);

  async function toggleEnabled(rule: MailRule) {
    await fetch(`/api/mail/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    void load();
  }

  async function move(index: number, direction: -1 | 1) {
    const newOrder = [...rules];
    const target = index + direction;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    setRules(newOrder);
    await fetch("/api/mail/rules/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: newOrder.map((r) => r.id) }),
    });
    void load();
  }

  async function handleDelete(rule: MailRule) {
    if (!window.confirm(`Biztosan törlöd a(z) "${rule.name}" szabályt?`)) return;
    await fetch(`/api/mail/rules/${rule.id}`, { method: "DELETE" });
    void load();
  }

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Sorrend szerint, az első illeszkedő szabály nyer. A kézi besorolást egy szabály soha nem írja felül.
        </p>
        <button type="button" className="btn btn-bronze shrink-0 !px-3 !py-1.5 text-xs" onClick={() => setShowForm(showForm === "new" ? null : "new")}>
          <Plus size={14} /> Új szabály
        </button>
      </div>

      {showForm === "new" && (
        <RuleForm
          areas={areas}
          onCancel={() => setShowForm(null)}
          onSaved={() => {
            setShowForm(null);
            void load();
          }}
        />
      )}

      {rules.length === 0 ? (
        <EmptyState icon={FlaskConical} title="Még nincs szabály" description="Vedd fel az elsőt az 'Új szabály' gombbal." />
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule, i) =>
            showForm === rule.id ? (
              <RuleForm
                key={rule.id}
                rule={rule}
                areas={areas}
                onCancel={() => setShowForm(null)}
                onSaved={() => {
                  setShowForm(null);
                  void load();
                }}
              />
            ) : (
              <div key={rule.id} className={`rounded-xl border p-3 ${rule.enabled ? "border-border bg-white" : "border-border bg-ivory-dim/40 opacity-60"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-muted hover:text-forest disabled:opacity-30">
                        <ArrowUp size={12} />
                      </button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === rules.length - 1} className="text-muted hover:text-forest disabled:opacity-30">
                        <ArrowDown size={12} />
                      </button>
                    </div>
                    <span className="text-sm font-medium text-forest">{rule.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input type="checkbox" checked={rule.enabled} onChange={() => void toggleEnabled(rule)} /> Bekapcsolva
                    </label>
                    <button type="button" onClick={() => setShowForm(rule.id)} className="btn btn-ghost !px-2 !py-1 text-xs">
                      Szerkesztés
                    </button>
                    <button type="button" onClick={() => void handleDelete(rule)} className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1 text-[11px] text-muted">
                  {rule.conditions.map((c, idx) => (
                    <span key={idx} className="badge bg-ivory-dim text-walnut">
                      {CONDITION_TYPES.find((t) => t.value === c.type)?.label} {c.value && `= ${c.value}`}
                    </span>
                  ))}
                  <span>→</span>
                  {rule.actions.map((a, idx) => (
                    <span key={idx} className="badge bg-forest-light/15 text-forest">
                      {ACTION_TYPES.find((t) => t.value === a.type)?.label} {a.value && `= ${a.value}`}
                    </span>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      <RuleTester />
    </div>
  );
}

function RuleForm({
  rule,
  areas,
  onCancel,
  onSaved,
}: {
  rule?: MailRule;
  areas: MailArea[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [conditions, setConditions] = useState<MailRuleCondition[]>(rule?.conditions ?? []);
  const [actions, setActions] = useState<MailRuleAction[]>(rule?.actions ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("A szabály neve kötelező.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const endpoint = rule ? `/api/mail/rules/${rule.id}` : "/api/mail/rules";
      const method = rule ? "PATCH" : "POST";
      const res = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), conditions, actions }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Nem sikerült menteni.");
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült menteni."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-bronze/30 bg-ivory-dim/40 p-4">
      {error && <ErrorBanner message={error} />}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Szabály neve *</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Feltételek (ÉS-kapcsolva)</p>
        {conditions.map((c, i) => (
          <div key={i} className="mb-1.5 flex gap-1.5">
            <select
              className="select flex-1 !text-xs"
              value={c.type}
              onChange={(e) => setConditions(conditions.map((x, idx) => (idx === i ? { ...x, type: e.target.value as MailRuleCondition["type"] } : x)))}
            >
              {CONDITION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {CONDITION_TYPES.find((t) => t.value === c.type)?.needsValue && (
              <input
                className="input flex-1 !text-xs"
                placeholder="érték"
                value={c.value ?? ""}
                onChange={(e) => setConditions(conditions.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))}
              />
            )}
            <button type="button" onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))} className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setConditions([...conditions, { type: "sender_known" }])} className="btn btn-ghost !py-1 text-xs">
          <Plus size={12} /> Feltétel hozzáadása
        </button>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Műveletek</p>
        {actions.map((a, i) => (
          <div key={i} className="mb-1.5 flex gap-1.5">
            <select
              className="select flex-1 !text-xs"
              value={a.type}
              onChange={(e) => setActions(actions.map((x, idx) => (idx === i ? { ...x, type: e.target.value as MailRuleAction["type"] } : x)))}
            >
              {ACTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {ACTION_TYPES.find((t) => t.value === a.type)?.needsValue &&
              (a.type === "set_area" ? (
                <select className="select flex-1 !text-xs" value={a.value ?? ""} onChange={(e) => setActions(actions.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))}>
                  <option value="">— válassz —</option>
                  {areas.map((ar) => (
                    <option key={ar.key} value={ar.key}>
                      {ar.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input flex-1 !text-xs"
                  placeholder="érték"
                  value={a.value ?? ""}
                  onChange={(e) => setActions(actions.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))}
                />
              ))}
            <button type="button" onClick={() => setActions(actions.filter((_, idx) => idx !== i))} className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setActions([...actions, { type: "set_area" }])} className="btn btn-ghost !py-1 text-xs">
          <Plus size={12} /> Művelet hozzáadása
        </button>
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Mégse
        </button>
        <button type="button" className="btn btn-bronze" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Mentés
        </button>
      </div>
    </div>
  );
}

function RuleTester() {
  const [fromAddr, setFromAddr] = useState("");
  const [subject, setSubject] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ matchedRule: { name: string } | null; knownSender: { type: string; label: string } | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runTest() {
    setTesting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/mail/rules/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromAddr: fromAddr.trim() || null, subject }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "A teszt nem futott le.");
      setResult(data);
    } catch (err) {
      setError(errorMessage(err, "A teszt nem futott le."));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-forest">
        <FlaskConical size={15} className="text-bronze" /> Szabály tesztelése
      </h4>
      <p className="mb-2 text-xs text-muted">Add meg egy minta-levél feladóját és tárgyát — megmutatjuk, melyik (bekapcsolt) szabály illeszkedne rá.</p>
      <div className="flex flex-wrap gap-2">
        <input className="input flex-1 text-xs" placeholder="feladó@pelda.ch" value={fromAddr} onChange={(e) => setFromAddr(e.target.value)} />
        <input className="input flex-1 text-xs" placeholder="tárgy" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <button type="button" onClick={() => void runTest()} disabled={testing} className="btn btn-bronze !py-1.5 text-xs">
          {testing ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />} Teszt
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {result && (
        <p className="mt-2 text-xs text-forest">
          {result.knownSender && (
            <>
              Ismert feladó: <strong>{result.knownSender.label}</strong> ({result.knownSender.type}).{" "}
            </>
          )}
          {result.matchedRule ? (
            <>
              Illeszkedő szabály: <strong>{result.matchedRule.name}</strong>
            </>
          ) : (
            "Nincs illeszkedő szabály — Besorolatlan marad."
          )}
        </p>
      )}
    </div>
  );
}
