"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Target,
  LayoutDashboard,
  ListTodo,
  FolderOpen,
  CalendarClock,
  Send,
  Users,
  Wallet,
  LineChart,
  NotebookPen,
  Rocket,
  Unlock,
  Check,
  Trash2,
  Mail,
} from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  Campaign,
  CampaignStatus,
  CampaignType,
  TaskItem,
  MarketingContent,
  MarketingAsset,
  Document,
  Expense,
} from "@/lib/supabase/types";
import { CAMPAIGN_STATUSES, CAMPAIGN_STATUS_STYLES, CAMPAIGN_TYPES, SEASON_HU } from "@/lib/labels";
import { CAMPAIGN_CHANNELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { resolveSignedUrls, resolveSignedUrlsForPaths } from "@/lib/signed-storage-url";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import LockControls from "@/components/finance/LockControls";
import CampaignClosureForm from "@/components/campaign/CampaignClosureForm";
import CampaignOverviewTab from "@/components/campaign/CampaignOverviewTab";
import CampaignTasksTab from "@/components/campaign/CampaignTasksTab";
import CampaignDocumentsTab from "@/components/campaign/CampaignDocumentsTab";
import CampaignContentTab from "@/components/campaign/CampaignContentTab";
import CampaignEmailTab from "@/components/campaign/CampaignEmailTab";
import CampaignMailTab from "@/components/campaign/CampaignMailTab";
import CampaignPartnersTab from "@/components/campaign/CampaignPartnersTab";
import CampaignCostsTab from "@/components/campaign/CampaignCostsTab";
import CampaignKpiTab from "@/components/campaign/CampaignKpiTab";
import CampaignLogTab from "@/components/campaign/CampaignLogTab";
import First20SignupsSection from "@/components/First20SignupsSection";

const MARKETING_BUCKET = "marketing";
const DOCUMENTS_BUCKET = "documents";

type Tab = "overview" | "tasks" | "documents" | "content" | "email" | "mail" | "partners" | "costs" | "kpis" | "log" | "signups";

const BASE_TABS: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Áttekintés", icon: LayoutDashboard },
  { key: "tasks", label: "Feladatok", icon: ListTodo },
  { key: "documents", label: "Dokumentumok", icon: FolderOpen },
  { key: "content", label: "Tartalom", icon: CalendarClock },
  { key: "email", label: "E-mail", icon: Send },
  { key: "mail", label: "Levelek", icon: Mail },
  { key: "partners", label: "Partnerek", icon: Users },
  { key: "costs", label: "Költségek", icon: Wallet },
  { key: "kpis", label: "Eredmények", icon: LineChart },
  { key: "log", label: "Napló", icon: NotebookPen },
];

/** Kampány részletoldal — minden, ami egy kampányhoz tartozik (feladat,
 * dokumentum, tartalom, e-mail, partner, költség, eredmény, napló) egy
 * helyen, fülekre bontva. Ez váltja fel a korábbi CampaignDetailModal
 * modalt — a /marketing?campaign=<id> régi deep link erre a lapra
 * irányít át (lásd app/(dashboard)/marketing/page.tsx). */
export default function CampaignDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [content, setContent] = useState<MarketingContent[]>([]);
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [allAssets, setAllAssets] = useState<MarketingAsset[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [openSignupId, setOpenSignupId] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);
  const [draft, setDraft] = useState<{
    status: CampaignStatus;
    type: CampaignType;
    goal: string;
    audience: string;
    owner: string;
    budget_planned: string;
    channels: string[];
    start_date: string;
    end_date: string;
    description: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showClosureForm, setShowClosureForm] = useState(false);

  const supabase = getSupabaseClient();

  const load = useCallback(async () => {
    if (!supabase || !slug) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    const { data: campaignRow, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (campaignError) {
      setError(campaignError.message);
      setLoading(false);
      return;
    }
    if (!campaignRow) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setCampaign(campaignRow);

    const [tasksRes, contentRes, assetsRes, allAssetsRes, documentsRes, expensesRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("campaign_id", campaignRow.id).order("created_at", { ascending: false }),
      supabase
        .from("marketing_content")
        .select("*")
        .eq("campaign_id", campaignRow.id)
        .order("scheduled_date", { ascending: true }),
      supabase.from("marketing_assets").select("*").eq("campaign_id", campaignRow.id).order("created_at", { ascending: false }),
      supabase.from("marketing_assets").select("*").is("campaign_id", null).order("created_at", { ascending: false }),
      supabase.from("documents").select("*").eq("campaign_id", campaignRow.id).order("created_at", { ascending: false }),
      supabase.from("expenses").select("*").eq("campaign_id", campaignRow.id).order("expense_date", { ascending: false }),
    ]);
    if (tasksRes.error) setError(tasksRes.error.message);
    else setTasks(tasksRes.data ?? []);
    if (!contentRes.error) setContent(contentRes.data ?? []);
    if (!assetsRes.error) setAssets(assetsRes.data ?? []);
    if (!allAssetsRes.error) setAllAssets(allAssetsRes.data ?? []);
    if (!documentsRes.error) setDocuments(documentsRes.data ?? []);
    if (!expensesRes.error) setExpenses(expensesRes.data ?? []);

    const imageUrls = [...(assetsRes.data ?? []), ...(allAssetsRes.data ?? [])].map((a) => a.image_url);
    const docPaths = (documentsRes.data ?? []).map((d) => d.file_path);
    const [assetSigned, docSigned] = await Promise.all([
      resolveSignedUrls(supabase, MARKETING_BUCKET, imageUrls),
      resolveSignedUrlsForPaths(supabase, DOCUMENTS_BUCKET, docPaths),
    ]);
    setSignedUrls(new Map([...assetSigned, ...docSigned]));

    setLoading(false);
  }, [supabase, slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void load();
  }, [supabase, load]);

  // Deep link a Feladatok Kanban-kártya jelentkező-badge-jéhez:
  // /marketing/kampanyok/<slug>?tab=signups&signup=<id> — ugyanaz a
  // "?open="-szerű minta, mint /tasks-on.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get("tab");
    const signupId = params.get("signup");
    if (requestedTab === "signups") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab("signups");
    }
    if (signupId) {
      setOpenSignupId(signupId);
    }
    if (requestedTab || signupId) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  function unlock() {
    if (!campaign) return;
    setDraft({
      status: campaign.status,
      type: campaign.type,
      goal: campaign.goal ?? "",
      audience: campaign.audience ?? "",
      owner: campaign.owner ?? "",
      budget_planned: campaign.budget_planned != null ? String(campaign.budget_planned) : "",
      channels: campaign.channels,
      start_date: campaign.start_date ?? "",
      end_date: campaign.end_date ?? "",
      description: campaign.description ?? "",
    });
    setLocked(false);
  }

  async function updateCampaign(patch: Partial<Campaign>) {
    if (!supabase || !campaign) return;
    const { data, error: updateError } = await supabase
      .from("campaigns")
      .update(patch)
      .eq("id", campaign.id)
      .select()
      .single();
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (data) setCampaign(data);
  }

  async function commitAndLock() {
    if (!draft || saving) return;
    setSaving(true);
    const wasNotClosed = campaign?.status !== "Lezárva";
    const nowClosed = draft.status === "Lezárva";
    await updateCampaign({
      status: draft.status,
      type: draft.type,
      goal: draft.goal.trim() || null,
      audience: draft.audience.trim() || null,
      owner: draft.owner.trim() || null,
      budget_planned: draft.budget_planned.trim() ? Number(draft.budget_planned) : null,
      channels: draft.channels,
      start_date: draft.start_date || null,
      end_date: draft.end_date || null,
      description: draft.description.trim() || null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    setLocked(true);
    setSaving(false);
    if (wasNotClosed && nowClosed) setShowClosureForm(true);
  }

  async function handleLockCampaign() {
    if (!supabase || !campaign) return;
    const { data, error: lockError } = await supabase
      .from("campaigns")
      .update({ is_locked: true, locked_at: new Date().toISOString() })
      .eq("id", campaign.id)
      .select()
      .single();
    if (lockError) throw new Error(errorMessage(lockError, "Nem sikerült lezárni a rögzítést."));
    if (data) setCampaign(data);
  }

  async function handleUnlockCampaign(reason: string | null) {
    if (!supabase || !campaign) return;
    const nextHistory = [...campaign.unlock_history, { unlocked_at: new Date().toISOString(), reason }];
    const { data, error: unlockError } = await supabase
      .from("campaigns")
      .update({ is_locked: false, unlock_history: nextHistory })
      .eq("id", campaign.id)
      .select()
      .single();
    if (unlockError) throw new Error(errorMessage(unlockError, "Nem sikerült feloldani a zárolást."));
    if (data) setCampaign(data);
  }

  async function handleDeleteCampaign() {
    if (!supabase || !campaign) return;
    if (!window.confirm(`Biztosan törlöd a "${campaign.name}" kampányt? A hozzá tartozó feladatok, anyagok, tartalmak és kiadások megmaradnak, csak a kampány-kapcsolatuk szakad meg. Ez nem vonható vissza.`)) {
      return;
    }
    const { error: deleteError } = await supabase.from("campaigns").delete().eq("id", campaign.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.push("/marketing");
  }

  function toggleChannel(ch: string) {
    setDraft((d) => {
      if (!d) return d;
      const has = d.channels.includes(ch);
      return { ...d, channels: has ? d.channels.filter((c) => c !== ch) : [...d.channels, ch] };
    });
  }

  const taskDone = useMemo(() => tasks.filter((t) => t.status === "Kész" && !t.archived_at).length, [tasks]);
  const taskTotal = useMemo(() => tasks.filter((t) => !t.archived_at).length, [tasks]);

  const tabs = useMemo(() => {
    if (campaign?.type === "First 20") {
      return [...BASE_TABS, { key: "signups" as Tab, label: "Jelentkezők", icon: Rocket }];
    }
    return BASE_TABS;
  }, [campaign]);

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Kampány" backHref="/marketing" />
        <p className="text-sm text-muted">Csatlakoztasd a Supabase-t a kampányok kezeléséhez.</p>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Kampány" backHref="/marketing" />
        <Spinner />
      </>
    );
  }

  if (notFound || !campaign) {
    return (
      <>
        <PageHeader title="Kampány" backHref="/marketing" />
        <EmptyState icon={Target} title="Nem találtuk ezt a kampányt" description="Lehet, hogy törölve lett, vagy hibás a link." />
      </>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push("/marketing")}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-forest"
          >
            ← Vissza a Kampányokhoz
          </button>
          <h1 className="font-serif text-2xl font-medium text-forest sm:text-3xl">{campaign.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`badge ${CAMPAIGN_STATUS_STYLES[campaign.status]}`}>{campaign.status}</span>
            <span className="badge bg-ivory-dim text-walnut">{campaign.type}</span>
            {campaign.season && <span className="badge bg-ivory-dim text-walnut">{SEASON_HU[campaign.season]}</span>}
            {(campaign.start_date || campaign.end_date) && (
              <span className="text-xs text-muted">
                {campaign.start_date ? formatDate(campaign.start_date) : "…"} – {campaign.end_date ? formatDate(campaign.end_date) : "…"}
              </span>
            )}
          </div>
          {campaign.goal && <p className="mt-2 max-w-xl text-sm text-muted">{campaign.goal}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs font-medium text-forest">
              <Check size={13} /> Mentve
            </span>
          )}
          {campaign.is_locked ? (
            <LockControls
              isLocked
              lockedAt={campaign.locked_at}
              unlockHistory={campaign.unlock_history}
              onLock={handleLockCampaign}
              onUnlock={handleUnlockCampaign}
            />
          ) : locked ? (
            <>
              <button onClick={unlock} className="btn btn-ghost text-xs">
                <Unlock size={13} /> Szerkesztés
              </button>
              <LockControls
                isLocked={false}
                lockedAt={null}
                unlockHistory={campaign.unlock_history}
                onLock={handleLockCampaign}
                onUnlock={handleUnlockCampaign}
              />
              <button onClick={handleDeleteCampaign} className="flex items-center gap-1 text-xs text-muted/70 hover:text-red-600" title="Kampány törlése">
                <Trash2 size={13} /> Törlés
              </button>
            </>
          ) : (
            <>
              <button onClick={commitAndLock} className="btn btn-bronze text-xs" disabled={saving}>
                <Check size={13} /> {saving ? "Mentés…" : "Mentés"}
              </button>
              <button onClick={() => setLocked(true)} className="btn btn-ghost text-xs" disabled={saving}>
                Mégse
              </button>
            </>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {!locked && draft && (
        <div className="card mb-6 grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Státusz</label>
            <select
              className="select"
              value={draft.status}
              onChange={(e) => setDraft((d) => (d ? { ...d, status: e.target.value as CampaignStatus } : d))}
            >
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Típus</label>
            <select
              className="select"
              value={draft.type}
              onChange={(e) => setDraft((d) => (d ? { ...d, type: e.target.value as CampaignType } : d))}
            >
              {CAMPAIGN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Felelős</label>
            <input
              className="input"
              value={draft.owner}
              onChange={(e) => setDraft((d) => (d ? { ...d, owner: e.target.value } : d))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Kezdés</label>
            <input
              type="date"
              className="input"
              value={draft.start_date}
              onChange={(e) => setDraft((d) => (d ? { ...d, start_date: e.target.value } : d))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Vége</label>
            <input
              type="date"
              className="input"
              value={draft.end_date}
              onChange={(e) => setDraft((d) => (d ? { ...d, end_date: e.target.value } : d))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Tervezett büdzsé (CHF)</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={draft.budget_planned}
              onChange={(e) => setDraft((d) => (d ? { ...d, budget_planned: e.target.value } : d))}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-muted">Cél</label>
            <input
              className="input"
              value={draft.goal}
              onChange={(e) => setDraft((d) => (d ? { ...d, goal: e.target.value } : d))}
              placeholder="pl. 20 jelentkező 7 nap alatt"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-muted">Célközönség</label>
            <input
              className="input"
              value={draft.audience}
              onChange={(e) => setDraft((d) => (d ? { ...d, audience: e.target.value } : d))}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-muted">Csatornák</label>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_CHANNELS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`badge cursor-pointer border ${
                    draft.channels.includes(ch) ? "border-bronze bg-bronze text-white" : "border-border bg-white text-muted"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-muted">Leírás</label>
            <textarea
              className="textarea min-h-20"
              value={draft.description}
              onChange={(e) => setDraft((d) => (d ? { ...d, description: e.target.value } : d))}
            />
          </div>
        </div>
      )}

      {campaign.status === "Lezárva" && (
        <CampaignClosureForm
          campaign={campaign}
          onSaved={(c) => setCampaign(c)}
          autoOpen={showClosureForm}
          onAutoOpenDone={() => setShowClosureForm(false)}
        />
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`btn !py-1.5 text-xs ${tab === key ? "btn-bronze" : "btn-ghost"}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <CampaignOverviewTab
          campaign={campaign}
          tasks={tasks}
          taskDone={taskDone}
          taskTotal={taskTotal}
          onOpenTab={setTab}
        />
      )}
      {tab === "tasks" && <CampaignTasksTab campaign={campaign} tasks={tasks} onChanged={load} />}
      {tab === "documents" && (
        <CampaignDocumentsTab
          campaign={campaign}
          documents={documents}
          assets={assets}
          allAssets={allAssets}
          signedUrls={signedUrls}
          onChanged={load}
        />
      )}
      {tab === "content" && <CampaignContentTab content={content} />}
      {tab === "email" && <CampaignEmailTab campaign={campaign} content={content.filter((c) => c.content_type === "Email")} />}
      {tab === "mail" && <CampaignMailTab campaign={campaign} />}
      {tab === "partners" && <CampaignPartnersTab campaign={campaign} />}
      {tab === "costs" && <CampaignCostsTab campaign={campaign} expenses={expenses} />}
      {tab === "kpis" && <CampaignKpiTab campaign={campaign} />}
      {tab === "log" && <CampaignLogTab campaign={campaign} />}
      {tab === "signups" && campaign.type === "First 20" && (
        <First20SignupsSection
          campaign={campaign}
          onCampaignUpdated={setCampaign}
          openSignupId={openSignupId}
          onSignupOpened={() => setOpenSignupId(null)}
        />
      )}
    </>
  );
}
