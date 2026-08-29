"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Sprout,
  Sun,
  Leaf,
  Snowflake,
  Check,
  Mail,
  Lock,
  Unlock,
  Plus,
  Trash2,
  ListPlus,
  ArrowRight,
  Image as ImageIcon,
  CalendarClock,
  CalendarPlus,
  Images,
  Upload,
  LibraryBig,
  Send,
} from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  MarketingCampaign,
  MarketingContent,
  MarketingContentType,
  MarketingContentStatus,
  MarketingAsset,
  MarketingAssetLanguage,
  MarketingAssetType,
  Season,
  EmailTemplate,
  NewsletterSubscriber,
} from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import EmailComposeModal from "@/components/EmailComposeModal";
import EmailTemplatesSection from "@/components/EmailTemplatesSection";
import NewsletterSubscribersSection from "@/components/NewsletterSubscribersSection";
import EmailCampaignSendForm from "@/components/EmailCampaignSendForm";
import { useUndoAction } from "@/lib/useUndoAction";
import { SEASON_HU } from "@/lib/labels";
import { formatDate } from "@/lib/format";

const STORAGE_BUCKET = "marketing";
const SEASON_ORDER: Season[] = ["Spring", "Summer", "Autumn", "Winter"];

const SEASON_META: Record<Season, { icon: typeof Sun; accent: string }> = {
  Spring: { icon: Sprout, accent: "bg-forest/10 text-forest" },
  Summer: { icon: Sun, accent: "bg-bronze/15 text-walnut" },
  Autumn: { icon: Leaf, accent: "bg-walnut/15 text-walnut" },
  Winter: { icon: Snowflake, accent: "bg-forest-light/10 text-forest" },
};

const CONTENT_TYPES: MarketingContentType[] = ["Instagram poszt", "Instagram story", "Email", "Kampány"];
const CONTENT_STATUSES: MarketingContentStatus[] = ["Ötlet", "Tervezve", "Ütemezve", "Kiküldve"];
const LANGUAGES: MarketingAssetLanguage[] = ["HU", "EN", "DE"];
const ASSET_TYPES: MarketingAssetType[] = ["Koncepció", "Valódi termékfotó", "Lifestyle"];

const CONTENT_TYPE_STYLES: Record<MarketingContentType, string> = {
  "Instagram poszt": "bg-forest/10 text-forest",
  "Instagram story": "bg-bronze/15 text-walnut",
  Email: "bg-blue-50 text-blue-700",
  Kampány: "bg-walnut/15 text-walnut",
};
const CONTENT_STATUS_STYLES: Record<MarketingContentStatus, string> = {
  Ötlet: "bg-gray-200 text-gray-700",
  Tervezve: "bg-yellow-100 text-yellow-800",
  Ütemezve: "bg-blue-100 text-blue-700",
  Kiküldve: "bg-green-100 text-green-700",
};
// Deliberately loud, high-contrast badges — this distinction exists so a
// "Koncepció" mockup is never mistaken for something safe to actually ship
// (e.g. to the webshop), so it needs to read at a glance, not just on hover.
const ASSET_TYPE_STYLES: Record<MarketingAssetType, string> = {
  Koncepció: "bg-yellow-400 text-yellow-950",
  "Valódi termékfotó": "bg-green-500 text-white",
  Lifestyle: "bg-blue-500 text-white",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type Tab = "seasons" | "calendar" | "assets" | "email";

// What "→ Tartalom létrehozása ebből" hands the content form: enough to
// pre-select the asset in the gallery picker and seed a sensible title —
// the user still fills in date/szöveg/típus themselves.
type ContentPrefill = { assetId: string; title: string; season: Season | null };

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>("seasons");
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [content, setContent] = useState<MarketingContent[]>([]);
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [newsletterSubscribers, setNewsletterSubscribers] = useState<NewsletterSubscriber[]>([]);
  // Just a count — the send-campaign route resolves the actual addresses
  // server-side at send time, so this only needs to inform the checkbox
  // label on EmailCampaignSendForm.
  const [demandEmailCount, setDemandEmailCount] = useState(0);
  // Lightweight — just enough to know which content items already have a
  // linked task, and which task to deep-link to. Not the full TaskItem
  // shape; the Tasks page owns everything else about these rows.
  const [linkedTasks, setLinkedTasks] = useState<{ id: string; content_id: string | null }[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [composeFor, setComposeFor] = useState<MarketingCampaign | null>(null);

  // Lifted out of ContentCalendarSection (rather than kept local there) so
  // that "→ Tartalom létrehozása ebből" on an asset card — rendered under a
  // different tab — can open the content form pre-filled with that asset.
  const [showContentForm, setShowContentForm] = useState(false);
  const [contentPrefill, setContentPrefill] = useState<ContentPrefill | null>(null);

  // Two separate delete-scopes on this page (content vs. assets) get
  // their own undo-hook instance each, matching this app's established
  // "one instance per distinct delete-scope" convention.
  const { pending: pendingUndoContent, schedule: scheduleUndoContent, undoNow: undoNowContent } =
    useUndoAction();
  const { pending: pendingUndoAsset, schedule: scheduleUndoAsset, undoNow: undoNowAsset } = useUndoAction();

  const supabase = getSupabaseClient();

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      setLoading(true);
      setError(null);
      const [campaignsRes, contentRes, assetsRes, tasksRes, templatesRes, newsletterRes, demandRes] =
        await Promise.all([
          supabase.from("marketing_campaigns").select("*"),
          supabase.from("marketing_content").select("*").order("scheduled_date", { ascending: true }),
          supabase.from("marketing_assets").select("*").order("created_at", { ascending: false }),
          supabase.from("tasks").select("id, content_id").not("content_id", "is", null),
          supabase.from("email_templates").select("*").order("created_at", { ascending: false }),
          supabase.from("newsletter_subscribers").select("*").order("subscribed_at", { ascending: false }),
          supabase.from("landing_responses").select("email").not("email", "is", null),
        ]);
      if (campaignsRes.error) setError(campaignsRes.error.message);
      else {
        const sorted = [...(campaignsRes.data ?? [])].sort(
          (a, b) => SEASON_ORDER.indexOf(a.season) - SEASON_ORDER.indexOf(b.season)
        );
        setCampaigns(sorted);
      }
      if (contentRes.error) setError(contentRes.error.message);
      else setContent(contentRes.data ?? []);
      if (assetsRes.error) setError(assetsRes.error.message);
      else setAssets(assetsRes.data ?? []);
      setLinkedTasks(tasksRes.data ?? []);
      if (templatesRes.error) setError(templatesRes.error.message);
      else setTemplates(templatesRes.data ?? []);
      if (newsletterRes.error) setError(newsletterRes.error.message);
      else setNewsletterSubscribers(newsletterRes.data ?? []);
      if (!demandRes.error) {
        const demandRows: { email: string | null }[] = demandRes.data ?? [];
        setDemandEmailCount(new Set(demandRows.map((r) => r.email?.trim().toLowerCase()).filter(Boolean)).size);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const taskIdByContentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of linkedTasks) if (t.content_id) map.set(t.content_id, t.id);
    return map;
  }, [linkedTasks]);

  const assetById = useMemo(() => {
    const map = new Map<string, MarketingAsset>();
    for (const a of assets) map.set(a.id, a);
    return map;
  }, [assets]);

  async function updateCampaign(id: string, patch: Partial<MarketingCampaign>) {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    if (!supabase) return;
    const { error } = await supabase.from("marketing_campaigns").update(patch).eq("id", id);
    if (error) setError(error.message);
  }

  function addContent(item: MarketingContent) {
    setContent((prev) => [...prev, item].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)));
  }

  async function updateContentStatus(id: string, status: MarketingContentStatus) {
    setContent((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    if (!supabase) return;
    const { error } = await supabase.from("marketing_content").update({ status }).eq("id", id);
    if (error) setError(error.message);
  }

  function deleteContent(id: string) {
    if (!supabase) return;
    const removed = content.find((c) => c.id === id);
    if (!removed) return;
    setContent((prev) => prev.filter((c) => c.id !== id));
    scheduleUndoContent(
      `"${removed.title}" törölve.`,
      async () => {
        const { error } = await supabase.from("marketing_content").delete().eq("id", id);
        if (error) setError(error.message);
      },
      () => setContent((prev) => [...prev, removed].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)))
    );
  }

  async function createTaskFromContent(item: MarketingContent) {
    if (!supabase) return;
    const preview = item.copy_text ? item.copy_text.slice(0, 140) : null;
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: `Poszt kiküldése: ${item.title}`,
        category: "Marketing",
        status: "Teendő",
        due_date: item.scheduled_date,
        notes: preview,
        content_id: item.id,
      })
      .select("id, content_id")
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    if (data) setLinkedTasks((prev) => [...prev, data]);
  }

  function addAsset(asset: MarketingAsset) {
    setAssets((prev) => [asset, ...prev]);
  }

  function deleteAsset(id: string) {
    if (!supabase) return;
    const removed = assets.find((a) => a.id === id);
    if (!removed) return;
    setAssets((prev) => prev.filter((a) => a.id !== id));
    scheduleUndoAsset(
      `"${removed.title}" törölve.`,
      async () => {
        const { error } = await supabase.from("marketing_assets").delete().eq("id", id);
        if (error) setError(error.message);
      },
      () => setAssets((prev) => [removed, ...prev])
    );
  }

  function createContentFromAsset(asset: MarketingAsset) {
    setTab("calendar");
    setContentPrefill({ assetId: asset.id, title: asset.title, season: asset.season });
    setShowContentForm(true);
  }

  function addTemplate(template: EmailTemplate) {
    setTemplates((prev) => [template, ...prev]);
  }

  async function deleteTemplate(id: string) {
    if (!supabase) return;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("email_templates").delete().eq("id", id);
    if (error) setError(error.message);
  }

  function addNewsletterSubscriber(subscriber: NewsletterSubscriber) {
    setNewsletterSubscribers((prev) => [subscriber, ...prev]);
  }

  async function deleteNewsletterSubscriber(id: string) {
    if (!supabase) return;
    setNewsletterSubscribers((prev) => prev.filter((s) => s.id !== id));
    const { error } = await supabase.from("newsletter_subscribers").delete().eq("id", id);
    if (error) setError(error.message);
  }

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Marketing" backHref="/" />
        <p className="text-sm text-muted">Csatlakoztasd a Supabase-t a marketing tervezéshez.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Marketing"
        subtitle="Szezonális stratégia, tartalom-naptár és marketing anyagok egy helyen."
        backHref="/"
      />

      {error && <ErrorBanner message={error} />}

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setTab("seasons")}
          className={`btn ${tab === "seasons" ? "btn-bronze" : "btn-ghost"}`}
        >
          Évszakos stratégia
        </button>
        <button
          onClick={() => setTab("calendar")}
          className={`btn ${tab === "calendar" ? "btn-bronze" : "btn-ghost"}`}
        >
          <CalendarClock size={15} /> Tartalom-naptár
          {content.length > 0 && ` (${content.length})`}
        </button>
        <button onClick={() => setTab("assets")} className={`btn ${tab === "assets" ? "btn-bronze" : "btn-ghost"}`}>
          <Images size={15} /> Marketing anyagok
          {assets.length > 0 && ` (${assets.length})`}
        </button>
        <button onClick={() => setTab("email")} className={`btn ${tab === "email" ? "btn-bronze" : "btn-ghost"}`}>
          <Send size={15} /> Email kampányok
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {tab === "seasons" && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onUpdate={(patch) => updateCampaign(campaign.id, patch)}
                  onEmail={() => setComposeFor(campaign)}
                />
              ))}
            </div>
          )}

          {tab === "calendar" && (
            <ContentCalendarSection
              content={content}
              assets={assets}
              assetById={assetById}
              taskIdByContentId={taskIdByContentId}
              showForm={showContentForm}
              onShowFormChange={setShowContentForm}
              prefill={contentPrefill}
              onPrefillConsumed={() => setContentPrefill(null)}
              onAdd={addContent}
              onDelete={deleteContent}
              onStatusChange={updateContentStatus}
              onCreateTask={createTaskFromContent}
            />
          )}

          {tab === "assets" && (
            <AssetLibrarySection
              assets={assets}
              onAdd={addAsset}
              onDelete={deleteAsset}
              onCreateContent={createContentFromAsset}
            />
          )}

          {tab === "email" && (
            <div className="flex flex-col gap-5">
              <EmailTemplatesSection templates={templates} onAdd={addTemplate} onDelete={deleteTemplate} />
              <NewsletterSubscribersSection
                subscribers={newsletterSubscribers}
                onAdd={addNewsletterSubscriber}
                onDelete={deleteNewsletterSubscriber}
              />
              <EmailCampaignSendForm
                templates={templates}
                demandCount={demandEmailCount}
                newsletterCount={newsletterSubscribers.filter((s) => !s.unsubscribed).length}
                onSent={addContent}
              />
            </div>
          )}
        </>
      )}

      {composeFor && (
        <EmailComposeModal
          title={`Email küldése — ${SEASON_HU[composeFor.season]} kampány`}
          defaultSubject={`Zusammen — ${SEASON_HU[composeFor.season]} kampány${composeFor.theme ? `: ${composeFor.theme}` : ""}`}
          defaultBody={
            composeFor.product_focus ? `Szia!\n\n${composeFor.product_focus}\n\n` : "Szia!\n\n"
          }
          onClose={() => setComposeFor(null)}
        />
      )}

      {pendingUndoContent && <UndoToast message={pendingUndoContent.message} onUndo={undoNowContent} />}
      {pendingUndoAsset && <UndoToast message={pendingUndoAsset.message} onUndo={undoNowAsset} />}
    </>
  );
}

function CampaignCard({
  campaign,
  onUpdate,
  onEmail,
}: {
  campaign: MarketingCampaign;
  onUpdate: (patch: Partial<MarketingCampaign>) => void;
  onEmail: () => void;
}) {
  // Locked by default so the card can't be edited by an accidental click —
  // "Feloldás" opens it up for editing, "Rögzítés" saves and locks it back.
  const [locked, setLocked] = useState(true);
  const [theme, setTheme] = useState(campaign.theme ?? "");
  const [productFocus, setProductFocus] = useState(campaign.product_focus ?? "");
  const [saved, setSaved] = useState(false);
  const { icon: Icon, accent } = SEASON_META[campaign.season];

  function unlock() {
    setTheme(campaign.theme ?? "");
    setProductFocus(campaign.product_focus ?? "");
    setLocked(false);
  }

  function cancel() {
    setTheme(campaign.theme ?? "");
    setProductFocus(campaign.product_focus ?? "");
    setLocked(true);
  }

  function commitAndLock() {
    const patch: Partial<MarketingCampaign> = {};
    if (theme !== (campaign.theme ?? "")) patch.theme = theme;
    if (productFocus !== (campaign.product_focus ?? "")) patch.product_focus = productFocus;
    if (Object.keys(patch).length > 0) {
      onUpdate(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
    setLocked(true);
  }

  return (
    <div className={`card p-5 ${locked ? "" : "ring-2 ring-bronze/40"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${accent}`}>
            <Icon size={19} />
          </span>
          <h2 className="font-serif text-xl text-forest">{SEASON_HU[campaign.season]}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs font-medium text-forest">
              <Check size={13} /> Mentve
            </span>
          )}
          <button onClick={onEmail} className="btn btn-ghost !px-2" aria-label="Email küldése">
            <Mail size={15} />
          </button>
          {locked ? (
            <button
              onClick={unlock}
              className="btn btn-ghost !px-2"
              aria-label="Feloldás szerkesztéshez"
              title="Feloldás szerkesztéshez"
            >
              <Lock size={15} />
            </button>
          ) : (
            <button
              onClick={commitAndLock}
              className="btn btn-bronze !px-2"
              aria-label="Rögzítés"
              title="Rögzítés"
            >
              <Unlock size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-medium text-muted">Téma</label>
        {locked ? (
          <p className="rounded-md bg-ivory-dim px-3 py-2 text-sm text-forest">
            {campaign.theme || <span className="text-muted">Nincs megadva</span>}
          </p>
        ) : (
          <input
            className="input"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Kampány témája…"
            autoFocus
          />
        )}
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-muted">Termékfókusz</label>
        {locked ? (
          <p className="whitespace-pre-wrap rounded-md bg-ivory-dim px-3 py-2 text-sm text-forest">
            {campaign.product_focus || <span className="text-muted">Nincs megadva</span>}
          </p>
        ) : (
          <textarea
            className="textarea min-h-24"
            value={productFocus}
            onChange={(e) => setProductFocus(e.target.value)}
            placeholder="Milyen termékeket / csomagokat tolunk előtérbe ebben a szezonban?"
          />
        )}
      </div>

      {!locked && (
        <div className="mt-3 flex justify-end">
          <button onClick={cancel} className="btn btn-ghost text-xs">
            Mégse
          </button>
        </div>
      )}
    </div>
  );
}

const EMPTY_CONTENT_FORM = {
  title: "",
  content_type: "Instagram poszt" as MarketingContentType,
  season: "" as Season | "",
  scheduled_date: todayISO(),
  copy_text: "",
  status: "Ötlet" as MarketingContentStatus,
  notes: "",
};

/** b) Tartalom-naptár — every scheduled post/story/email/campaign, nearest
 * date first (the initial Supabase fetch is already ordered that way and
 * every client-side update re-sorts to match), with month/type/status
 * filters and a "→ Feladat létrehozása" link per item. */
function ContentCalendarSection({
  content,
  assets,
  assetById,
  taskIdByContentId,
  showForm,
  onShowFormChange,
  prefill,
  onPrefillConsumed,
  onAdd,
  onDelete,
  onStatusChange,
  onCreateTask,
}: {
  content: MarketingContent[];
  assets: MarketingAsset[];
  assetById: Map<string, MarketingAsset>;
  taskIdByContentId: Map<string, string>;
  showForm: boolean;
  onShowFormChange: (show: boolean) => void;
  prefill: ContentPrefill | null;
  onPrefillConsumed: () => void;
  onAdd: (item: MarketingContent) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: MarketingContentStatus) => void;
  onCreateTask: (item: MarketingContent) => void;
}) {
  const [monthFilter, setMonthFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | MarketingContentType>("");
  const [statusFilter, setStatusFilter] = useState<"" | MarketingContentStatus>("");

  const filtered = content.filter((c) => {
    if (monthFilter && !c.scheduled_date.startsWith(monthFilter)) return false;
    if (typeFilter && c.content_type !== typeFilter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Hónap</label>
            <input
              type="month"
              className="select !py-1.5 text-xs"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Típus</label>
            <select
              className="select !py-1.5 text-xs"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as MarketingContentType | "")}
            >
              <option value="">Összes</option>
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Státusz</label>
            <select
              className="select !py-1.5 text-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as MarketingContentStatus | "")}
            >
              <option value="">Összes</option>
              {CONTENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          className="btn btn-bronze"
          onClick={() => {
            if (showForm) onPrefillConsumed();
            onShowFormChange(!showForm);
          }}
        >
          <Plus size={16} /> Új tartalom
        </button>
      </div>

      {showForm && (
        <ContentForm
          key={prefill?.assetId ?? "new"}
          assets={assets}
          prefill={prefill}
          onCreated={(item) => {
            onAdd(item);
            onShowFormChange(false);
            onPrefillConsumed();
          }}
          onCancel={() => {
            onShowFormChange(false);
            onPrefillConsumed();
          }}
        />
      )}

      {content.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Még nincs ütemezett tartalom"
          description="Add hozzá az első posztot, storyt vagy emailt — dátum szerint fog megjelenni itt."
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Nincs találat a szűrőkkel" />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              resolvedImageUrl={item.asset_id ? assetById.get(item.asset_id)?.image_url ?? null : item.image_url}
              linkedTaskId={taskIdByContentId.get(item.id) ?? null}
              onDelete={() => onDelete(item.id)}
              onStatusChange={(status) => onStatusChange(item.id, status)}
              onCreateTask={() => onCreateTask(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ContentForm({
  assets,
  prefill,
  onCreated,
  onCancel,
}: {
  assets: MarketingAsset[];
  prefill: ContentPrefill | null;
  onCreated: (item: MarketingContent) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(() =>
    prefill
      ? { ...EMPTY_CONTENT_FORM, title: prefill.title, season: prefill.season ?? "" }
      : EMPTY_CONTENT_FORM
  );
  // "library" reuses a saved marketing_assets image instead of uploading a
  // fresh copy of the same file — arriving via "→ Tartalom létrehozása
  // ebből" starts here, pre-selected on that asset.
  const [imageMode, setImageMode] = useState<"upload" | "library">(prefill ? "library" : "upload");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(prefill?.assetId ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !form.title.trim() || !form.scheduled_date) return;
    setSaving(true);
    setError(null);
    try {
      // Mutually exclusive by construction: exactly one of image_url /
      // asset_id ends up set, so the image is never duplicated between a
      // content row and a saved asset.
      let imageUrl: string | null = null;
      let assetId: string | null = null;
      if (imageMode === "library") {
        assetId = selectedAssetId;
      } else if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `content/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
      }
      const { data, error: insertError } = await supabase
        .from("marketing_content")
        .insert({
          title: form.title.trim(),
          content_type: form.content_type,
          season: form.season || null,
          scheduled_date: form.scheduled_date,
          copy_text: form.copy_text.trim() || null,
          image_url: imageUrl,
          asset_id: assetId,
          status: form.status,
          notes: form.notes.trim() || null,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) onCreated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült menteni a tartalmat.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mb-6 flex animate-fade-in flex-col gap-3 p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
          <input
            className="input"
            required
            autoFocus
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="pl. Tavaszi indulás — teaser poszt"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Típus</label>
          <select
            className="select"
            value={form.content_type}
            onChange={(e) => setForm((f) => ({ ...f, content_type: e.target.value as MarketingContentType }))}
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Évszak</label>
          <select
            className="select"
            value={form.season}
            onChange={(e) => setForm((f) => ({ ...f, season: e.target.value as Season | "" }))}
          >
            <option value="">Nincs</option>
            {SEASON_ORDER.map((s) => (
              <option key={s} value={s}>
                {SEASON_HU[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Dátum *</label>
          <input
            type="date"
            required
            className="input"
            value={form.scheduled_date}
            onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Státusz</label>
          <select
            className="select"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as MarketingContentStatus }))}
          >
            {CONTENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Kép</label>
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => setImageMode("upload")}
            className={`btn !px-3 !py-1.5 text-xs ${imageMode === "upload" ? "btn-bronze" : "btn-ghost"}`}
          >
            <Upload size={13} /> Új kép feltöltése
          </button>
          <button
            type="button"
            onClick={() => setImageMode("library")}
            className={`btn !px-3 !py-1.5 text-xs ${imageMode === "library" ? "btn-bronze" : "btn-ghost"}`}
          >
            <LibraryBig size={13} /> Válassz a mentett anyagokból
          </button>
        </div>

        {imageMode === "upload" ? (
          <input
            type="file"
            accept="image/*"
            className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        ) : assets.length === 0 ? (
          <p className="text-xs text-muted">
            Nincs még mentett marketing anyag — tölts fel egyet a Marketing anyagok fülön.
          </p>
        ) : (
          <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto rounded-md border border-black/5 p-2 sm:grid-cols-6">
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => setSelectedAssetId(asset.id)}
                className={`relative aspect-square overflow-hidden rounded-md ring-2 transition-shadow ${
                  selectedAssetId === asset.id ? "ring-bronze" : "ring-transparent hover:ring-bronze/40"
                }`}
                title={asset.title}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.image_url} alt={asset.title} className="h-full w-full object-cover" />
                {selectedAssetId === asset.id && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-bronze text-white">
                    <Check size={11} />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Poszt-szöveg</label>
        <textarea
          className="textarea min-h-24"
          value={form.copy_text}
          onChange={(e) => setForm((f) => ({ ...f, copy_text: e.target.value }))}
          placeholder="A tényleges caption / szöveg…"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Megjegyzés</label>
        <textarea
          className="textarea min-h-16"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Bármi más, amit érdemes tudni…"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "Tartalom mentése"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </div>
    </form>
  );
}

function ContentCard({
  item,
  resolvedImageUrl,
  linkedTaskId,
  onDelete,
  onStatusChange,
  onCreateTask,
}: {
  item: MarketingContent;
  resolvedImageUrl: string | null;
  linkedTaskId: string | null;
  onDelete: () => void;
  onStatusChange: (status: MarketingContentStatus) => void;
  onCreateTask: () => void;
}) {
  return (
    <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
      {resolvedImageUrl ? (
        <a
          href={resolvedImageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block h-20 w-20 shrink-0 overflow-hidden rounded-md bg-ivory-dim"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolvedImageUrl} alt={item.title} className="h-full w-full object-cover" />
        </a>
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-ivory-dim text-muted/40">
          <ImageIcon size={20} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="font-medium text-forest">{item.title}</p>
          <span className={`badge ${CONTENT_TYPE_STYLES[item.content_type]}`}>{item.content_type}</span>
          {item.season && <span className="badge bg-ivory-dim text-walnut">{SEASON_HU[item.season]}</span>}
          <span className={`badge ${CONTENT_STATUS_STYLES[item.status]}`}>{item.status}</span>
        </div>
        <p className="mt-1 text-xs text-muted">{formatDate(item.scheduled_date)}</p>
        {item.copy_text && <p className="mt-1.5 line-clamp-2 text-sm text-forest">{item.copy_text}</p>}
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-44">
        <select
          className="select !py-1 text-xs"
          value={item.status}
          onChange={(e) => onStatusChange(e.target.value as MarketingContentStatus)}
          aria-label="Státusz módosítása"
        >
          {CONTENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {linkedTaskId ? (
          <Link
            href={`/tasks?open=${linkedTaskId}`}
            className="flex items-center justify-center gap-1 text-xs font-medium text-bronze hover:underline"
          >
            ✓ Feladat létrehozva <ArrowRight size={12} />
          </Link>
        ) : (
          <button onClick={onCreateTask} className="btn btn-ghost text-xs">
            <ListPlus size={13} /> Feladat létrehozása
          </button>
        )}

        <button
          onClick={onDelete}
          className="flex items-center justify-center gap-1 text-xs text-muted/70 hover:text-red-600"
          aria-label="Törlés"
        >
          <Trash2 size={13} /> Törlés
        </button>
      </div>
    </div>
  );
}

const EMPTY_ASSET_FORM = {
  title: "",
  language: "HU" as MarketingAssetLanguage,
  asset_type: "Koncepció" as MarketingAssetType,
  platform: "",
  season: "" as Season | "",
  notes: "",
};

/** c) Marketing anyagok — the image library, grouped by language. */
function AssetLibrarySection({
  assets,
  onAdd,
  onDelete,
  onCreateContent,
}: {
  assets: MarketingAsset[];
  onAdd: (asset: MarketingAsset) => void;
  onDelete: (id: string) => void;
  onCreateContent: (asset: MarketingAsset) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const grouped = LANGUAGES.map((lang) => ({ lang, items: assets.filter((a) => a.language === lang) })).filter(
    (g) => g.items.length > 0
  );

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn btn-bronze" onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> Új anyag hozzáadása
        </button>
      </div>

      {showForm && (
        <AssetForm
          onCreated={(asset) => {
            onAdd(asset);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {assets.length === 0 ? (
        <EmptyState
          icon={Images}
          title="Még nincs feltöltött marketing anyag"
          description="Tölts fel egy képet — nyelvenként csoportosítva jelenik meg itt."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(({ lang, items }) => (
            <div key={lang}>
              <h2 className="mb-2 font-serif text-lg text-forest">{lang}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    onDelete={() => onDelete(asset.id)}
                    onCreateContent={() => onCreateContent(asset)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssetForm({
  onCreated,
  onCancel,
}: {
  onCreated: (asset: MarketingAsset) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(EMPTY_ASSET_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !form.title.trim() || !file) {
      setError("Adj meg egy címet, és tölts fel egy képet.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `assets/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const imageUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;

      const { data, error: insertError } = await supabase
        .from("marketing_assets")
        .insert({
          title: form.title.trim(),
          language: form.language,
          asset_type: form.asset_type,
          platform: form.platform.trim() || null,
          season: form.season || null,
          image_url: imageUrl,
          notes: form.notes.trim() || null,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) onCreated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült menteni az anyagot.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mb-6 flex animate-fade-in flex-col gap-3 p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
          <input
            className="input"
            required
            autoFocus
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="pl. Termékfotó — Wild kártya"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Nyelv</label>
          <select
            className="select"
            value={form.language}
            onChange={(e) => setForm((f) => ({ ...f, language: e.target.value as MarketingAssetLanguage }))}
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Kép típusa</label>
          <select
            className="select"
            value={form.asset_type}
            onChange={(e) => setForm((f) => ({ ...f, asset_type: e.target.value as MarketingAssetType }))}
          >
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Platform</label>
          <input
            className="input"
            value={form.platform}
            onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
            placeholder="pl. Instagram"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Évszak</label>
          <select
            className="select"
            value={form.season}
            onChange={(e) => setForm((f) => ({ ...f, season: e.target.value as Season | "" }))}
          >
            <option value="">Nincs</option>
            {SEASON_ORDER.map((s) => (
              <option key={s} value={s}>
                {SEASON_HU[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Kép feltöltése *</label>
          <input
            type="file"
            accept="image/*"
            required
            className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Megjegyzés</label>
        <textarea
          className="textarea min-h-16"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Bármi más, amit érdemes tudni erről az anyagról…"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "Anyag mentése"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </div>
    </form>
  );
}

function AssetCard({
  asset,
  onDelete,
  onCreateContent,
}: {
  asset: MarketingAsset;
  onDelete: () => void;
  onCreateContent: () => void;
}) {
  return (
    <div className="card overflow-hidden">
      <a
        href={asset.image_url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-square bg-ivory-dim"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.image_url} alt={asset.title} className="h-full w-full object-cover" />
        {/* Overlaid, not just listed below — this must never blend into the
         * rest of the card so a "Koncepció" mockup can't be mistaken for a
         * real product photo further down the line (e.g. webshop upload). */}
        <span
          className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow ${ASSET_TYPE_STYLES[asset.asset_type]}`}
        >
          {asset.asset_type}
        </span>
      </a>
      <div className="p-2.5">
        <p className="truncate text-xs font-medium text-forest" title={asset.title}>
          {asset.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {asset.platform && <span className="badge bg-ivory-dim text-walnut">{asset.platform}</span>}
          {asset.season && <span className="badge bg-ivory-dim text-walnut">{SEASON_HU[asset.season]}</span>}
        </div>
        <button
          onClick={onCreateContent}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-bronze hover:underline"
        >
          <CalendarPlus size={12} /> Tartalom létrehozása ebből
        </button>
        <button onClick={onDelete} className="mt-1.5 flex items-center gap-1 text-xs text-muted/70 hover:text-red-600">
          <Trash2 size={12} /> Törlés
        </button>
      </div>
    </div>
  );
}
