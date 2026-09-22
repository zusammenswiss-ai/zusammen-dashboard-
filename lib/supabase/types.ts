// Hand-written types mirroring supabase/schema.sql.
// If you change the schema, update this file to match (or generate with
// `supabase gen types typescript` once you have the Supabase CLI linked).

export type TaskStatus = "Várakozás" | "Teendő" | "Folyamatban" | "Kész";
// The only two statuses a task_templates row can hand a newly-created
// task by default — never "Folyamatban"/"Kész" directly.
export type TemplateDefaultStatus = "Teendő" | "Várakozás";
export type TaskPriority = "Low" | "Medium" | "High";
export type TaskType = "Egyszeri" | "Ismétlődő" | "Kampány";
export type PlanStatus = "Idea" | "Considering" | "Planned";
export type Season = "Spring" | "Summer" | "Autumn" | "Winter";
export type OrderStatus = "New" | "Processing" | "Shipped" | "Done";
export type ContractStatus = "None" | "Signed" | "Failed" | "Expired";
export type RecurrenceType = "Napi" | "Heti" | "Havi" | "Negyedéves" | "Éves";
export type ProductStatus = "Fejlesztés alatt" | "Tesztelés" | "Élő" | "Jövőbeli terv";
export type CampaignStatus = "Tervezve" | "Aktív" | "Lezárva";

export interface SupplierProduct {
  id: string;
  name: string;
  price: string;
  moq: string;
  note: string;
}

export interface Supplier {
  id: string;
  name: string;
  category: string | null;
  country: string | null;
  website: string | null;
  contact_email: string | null;
  phone: string | null;
  whatsapp: string | null;
  products: SupplierProduct[];
  contacted: boolean;
  reply_received: boolean;
  notes: string | null;
  email_text: string | null;
  contract_status: ContractStatus;
  contract_valid_until: string | null;
  created_at: string;
  updated_at: string;
}
export type SupplierInsert = Partial<Omit<Supplier, "id" | "created_at" | "updated_at">> & {
  name: string;
};
export type SupplierUpdate = Partial<Omit<Supplier, "id" | "created_at">>;

export interface TaskItem {
  id: string;
  title: string;
  category: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  assignee: string | null;
  notes: string | null;
  archived_at: string | null;
  // Set when this task was spun off a Marketing content-calendar item via
  // "→ Feladat létrehozása" — a DB trigger flips that item's status to
  // "Kiküldve" the moment this task's status becomes "Kész".
  content_id: string | null;
  // Independent of category — see the comment on this column in
  // supabase/schema.sql. Set automatically by the recurring-template
  // engine (lib/recurring-templates.ts) and by "→ Feladat létrehozása"
  // on Marketing content; otherwise defaults to "Egyszeri".
  task_type: TaskType;
  // Real link into campaigns, only meaningful when task_type = "Kampány"
  // — set via the "Melyik kampányhoz tartozik?" picker.
  campaign_id: string | null;
  // Legacy free-text campaign label from before campaign_id was a real
  // FK (see the campaigns table's comment in supabase/schema.sql) —
  // shown only as a fallback when campaign_id is null, e.g. an older
  // task that hasn't been linked to a real Kampány row yet.
  campaign_label: string | null;
  // Only meaningful while status = "Várakozás" — the day this parked
  // task is worth revisiting. Drives the "⏰ Esedékes az ellenőrzés"
  // card badge, the Áttekintés counter, and the daily digest email; see
  // TaskCard in app/(dashboard)/tasks/page.tsx and
  // app/api/cron/check-date-digest/route.ts.
  check_date: string | null;
  created_at: string;
  updated_at: string;
}
export type TaskInsert = Partial<Omit<TaskItem, "id" | "created_at" | "updated_at">> & {
  title: string;
};
export type TaskUpdate = Partial<Omit<TaskItem, "id" | "created_at">>;

// Named marketing pushes (e.g. "ZUSAMMEN FIRST 20") — distinct from
// MarketingCampaign below (the 4 fixed Évszakos stratégia rows, one per
// season). A Campaign optionally belongs to a season and groups
// together the Feladatok (via TaskItem.campaign_id) and Marketing
// tartalom (via MarketingContent.campaign_id) that serve it.
export interface Campaign {
  id: string;
  name: string;
  season: Season | null;
  status: CampaignStatus;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}
export type CampaignInsert = Partial<Omit<Campaign, "id" | "created_at" | "updated_at">> & {
  name: string;
};
export type CampaignUpdate = Partial<Omit<Campaign, "id" | "created_at">>;

export interface TaskTemplate {
  id: string;
  title: string;
  category: string;
  default_priority: TaskPriority;
  default_assignee: string | null;
  notes_template: string | null;
  is_recurring: boolean;
  // Only meaningful when is_recurring is true — see the Sablonkezelő
  // form (TemplateManagerModal) and the recurrence math in
  // lib/recurring-templates.ts.
  recurrence_type: RecurrenceType | null;
  recurrence_interval: number;
  next_due_date: string | null;
  // Status a task created from this template starts in, and (only when
  // that's "Várakozás") how many days after creation its check_date
  // defaults to — see TemplatePickerModal.
  default_status: TemplateDefaultStatus;
  default_check_offset_days: number | null;
  created_at: string;
}
export type TaskTemplateInsert = Partial<Omit<TaskTemplate, "id" | "created_at">> & {
  title: string;
  category: string;
};
export type TaskTemplateUpdate = Partial<Omit<TaskTemplate, "id" | "created_at">>;

export interface FinanceProduct {
  id: string;
  name: string;
  price: number;
  cogs: number;
  units: number;
  created_at: string;
}
export type FinanceProductInsert = Partial<Omit<FinanceProduct, "id" | "created_at">> & {
  name: string;
};

// The product catalog — see supabase/schema.sql's comment on why
// planned_units lives here (not a separate finance_products row):
// Pénzügyek reads this table directly instead of asking for the same
// product a second time.
export interface Product {
  id: string;
  name: string;
  edition: string | null;
  status: ProductStatus;
  card_asset_id: string | null;
  supplier_id: string | null;
  cogs: number | null;
  cogs_currency: string | null;
  sale_price: number | null;
  // The currency sale_price is actually denominated in — see the
  // comment on this column in supabase/schema.sql for why it exists
  // (previously sale_price silently followed whatever Beállítások →
  // Pénznem was set to). Pénzügyek uses this + cogs_currency with
  // lib/exchange-rates.ts to convert everything to one currency before
  // summing, instead of adding mismatched numbers together.
  sale_price_currency: CurrencyCode;
  description: string | null;
  production_note: string | null;
  image_url: string | null;
  planned_units: number;
  // Which Kártyatervező Kollekció (if any) this termék tartozik hozzá —
  // e.g. the Pear Edition product links to its Pear Edition kollekció.
  collection_id: string | null;
  created_at: string;
  updated_at: string;
}
export type ProductInsert = Partial<Omit<Product, "id" | "created_at" | "updated_at">> & {
  name: string;
};
export type ProductUpdate = Partial<Omit<Product, "id" | "created_at">>;
export type FinanceProductUpdate = Partial<Omit<FinanceProduct, "id" | "created_at">>;

// Kártyatervező (/card-designer) — see the schema.sql comment on
// card_templates/card_collections/collection_cards for why this is a
// separate concept from public.cards (the szöveges tartalom-könyvtár).
export type CardCollectionStatus = "Tervezés" | "Gyártásra kész" | "Gyártásban" | "Élő" | "Archivált";
export type CollectionCardType = "Kérdés" | "Wild Card" | "Gold Card" | "Egyéb";
export type CardTextAlign = "left" | "center" | "right";

export interface CardTemplate {
  id: string;
  name: string;
  manufacturer: string | null;
  cut_width_in: number;
  cut_height_in: number;
  safe_width_in: number;
  safe_height_in: number;
  bleed_width_in: number;
  bleed_height_in: number;
  dpi: number;
  created_at: string;
}
export type CardTemplateInsert = Partial<Omit<CardTemplate, "id" | "created_at">> & {
  name: string;
  cut_width_in: number;
  cut_height_in: number;
  safe_width_in: number;
  safe_height_in: number;
  bleed_width_in: number;
  bleed_height_in: number;
};
export type CardTemplateUpdate = Partial<Omit<CardTemplate, "id" | "created_at">>;

export interface CardCollection {
  id: string;
  name: string;
  description: string | null;
  status: CardCollectionStatus;
  template_id: string | null;
  languages: string[];
  // Közös hátlap-design az egész kollekcióhoz (2. fázis — lásd a
  // schema.sql-en a card_collections back_* oszlopainak komment-jét).
  back_background_color: string | null;
  back_image_url: string | null;
  back_image_x: number;
  back_image_y: number;
  back_image_scale: number;
  // Nyelv-kód → a PDF-ből kinyert hátlap-oldal képe (6. fázis) — lásd
  // CollectionCard.mockup_images komment-jét ugyanerről.
  back_mockup_images: Record<string, string>;
  created_at: string;
  updated_at: string;
}
export type CardCollectionInsert = Partial<Omit<CardCollection, "id" | "created_at" | "updated_at">> & {
  name: string;
};
export type CardCollectionUpdate = Partial<Omit<CardCollection, "id" | "created_at">>;

export interface CollectionCard {
  id: string;
  collection_id: string;
  card_number: string;
  suit: string | null;
  card_type: CollectionCardType;
  text_hu: string | null;
  text_de: string | null;
  text_en: string | null;
  sort_order: number;
  // Front-design (2. fázis) — lásd a schema.sql-en a komment-et: a
  // szöveg tartalma fent van, ez csak a MEGJELENÍTÉST írja le.
  background_color: string | null;
  text_font_size: number;
  text_align: CardTextAlign;
  image_url: string | null;
  image_x: number;
  image_y: number;
  image_scale: number;
  // Nyelv-kód → a PDF-ből kinyert, TÉNYLEGES nyomdakész oldal-kép URL-je
  // (6. fázis) — ha van, a Kártyák galéria ezt mutatja a designer élő
  // rendere helyett. Lásd PdfPageAssignmentModal.
  mockup_images: Record<string, string>;
  created_at: string;
  updated_at: string;
}
export type CollectionCardInsert = Partial<Omit<CollectionCard, "id" | "created_at" | "updated_at">> & {
  collection_id: string;
  card_number: string;
};
export type CollectionCardUpdate = Partial<Omit<CollectionCard, "id" | "created_at">>;

export type CardExportKind = "fronts_only" | "front_back_pairs";
export type CardExportFormat = "png" | "pdf";
export type CardExportSource = "export" | "manual_upload";

// Kártyatervező — 3. fázis: minden "Exportálás" egy új, dátumozott sort
// hoz létre itt (lásd a schema.sql-en a komment-et) — a régebbi exportok
// sosem vesznek el, egy verzió-előzmény listában maradnak elérhetők.
export interface CardExportVersion {
  id: string;
  collection_id: string;
  template_id: string | null;
  language: string;
  kind: CardExportKind;
  format: CardExportFormat;
  card_count: number;
  file_url: string;
  sent_to_manufacturer: boolean;
  sent_at: string | null;
  // 'manual_upload' — nem az app tervezőjéből/exportjából, hanem egy
  // utólag feltöltött, korábban elkészült fájl (pl. a jelenlegi Pear
  // Edition production-fájljai). Lásd ManualVersionUpload.
  source: CardExportSource;
  created_at: string;
}
export type CardExportVersionInsert = Partial<Omit<CardExportVersion, "id" | "created_at">> & {
  collection_id: string;
  language: string;
  kind: CardExportKind;
  format: CardExportFormat;
  card_count: number;
  file_url: string;
};
export type CardExportVersionUpdate = Partial<Omit<CardExportVersion, "id" | "created_at">>;

export type ExpenseType = "Fix költség" | "Változó költség";
export type PaymentMethod = "Bankkártya" | "Banki átutalás" | "Készpénz" | "Egyéb";
export type RevenueStatus = "Kiállítva" | "Kifizetve";
export type BudgetPeriod = "Havi" | "Negyedéves" | "Éves";
export type InvoiceStatus = "Piszkozat" | "Kiállítva" | "Kifizetve";

// Operating costs, independent of a product's COGS — see the comment on
// this table in supabase/schema.sql. Reuses RecurrenceType rather than
// a separate enum (only meaningful when is_recurring is true, same
// convention as TaskTemplate). `type` (Fix/Változó) is what the Fix
// költségek/Változó költségek tabs filter on — independent of
// is_recurring, which only feeds the fedezeti pont havi normalizálása.
// "Rögzítés lezárása" — see the comment on this addition in
// supabase/schema.sql. Shared shape between Expense and Revenue's
// unlock_history, each entry appended (never overwritten) on unlock.
export type UnlockHistoryEntry = { unlocked_at: string; reason: string | null };

export interface Expense {
  id: string;
  description: string;
  category: string;
  type: ExpenseType;
  amount: number;
  currency: CurrencyCode;
  expense_date: string;
  is_recurring: boolean;
  recurrence_type: RecurrenceType | null;
  payment_method: PaymentMethod | string | null;
  // Stored as a getPublicUrl()-shaped string against the private
  // 'receipts' bucket — see lib/signed-storage-url.ts, same pattern as
  // documents.file_path/card_assets.file_url/etc.
  receipt_url: string | null;
  notes: string | null;
  related_supplier_id: string | null;
  related_product_id: string | null;
  is_locked: boolean;
  locked_at: string | null;
  unlock_history: UnlockHistoryEntry[];
  created_at: string;
  updated_at: string;
}
export type ExpenseInsert = Partial<Omit<Expense, "id" | "created_at" | "updated_at">> & {
  description: string;
  amount: number;
};
export type ExpenseUpdate = Partial<Omit<Expense, "id" | "created_at">>;

// Explicitly logged revenue rows — see the comment on this table in
// supabase/schema.sql for how this relates to the Megrendelések-based
// "Tényleges bevétel" summary and the Termékek-based tervezési
// kalkulátor, both of which stay independent of this table.
export interface Revenue {
  id: string;
  revenue_date: string;
  amount: number;
  currency: CurrencyCode;
  source: string;
  related_product_id: string | null;
  notes: string | null;
  status: RevenueStatus | null;
  invoice_id: string | null;
  is_locked: boolean;
  locked_at: string | null;
  unlock_history: UnlockHistoryEntry[];
  created_at: string;
  updated_at: string;
}
export type RevenueInsert = Partial<Omit<Revenue, "id" | "created_at" | "updated_at">> & {
  amount: number;
  source: string;
};
export type RevenueUpdate = Partial<Omit<Revenue, "id" | "created_at">>;

// One planned_amount per category per period — see the comment on this
// table in supabase/schema.sql for why month/quarter aren't enforced
// with a check constraint.
export interface Budget {
  id: string;
  category: string;
  period: BudgetPeriod;
  year: number;
  month: number | null;
  quarter: number | null;
  planned_amount: number;
  currency: CurrencyCode;
  created_at: string;
  updated_at: string;
}
export type BudgetInsert = Partial<Omit<Budget, "id" | "created_at" | "updated_at">> & {
  category: string;
  period: BudgetPeriod;
  year: number;
  planned_amount: number;
};
export type BudgetUpdate = Partial<Omit<Budget, "id" | "created_at">>;

// Svájci QR-számla fejléc — a tételek külön az invoice_items táblában,
// lásd a schema.sql kommentjét.
export interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_address: string | null;
  issue_date: string;
  due_date: string | null;
  currency: CurrencyCode;
  status: InvoiceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export type InvoiceInsert = Partial<Omit<Invoice, "id" | "created_at" | "updated_at">> & {
  invoice_number: string;
  customer_name: string;
};
export type InvoiceUpdate = Partial<Omit<Invoice, "id" | "created_at">>;

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  position: number;
  created_at: string;
}
export type InvoiceItemInsert = Partial<Omit<InvoiceItem, "id" | "created_at">> & {
  invoice_id: string;
  description: string;
};
export type InvoiceItemUpdate = Partial<Omit<InvoiceItem, "id" | "created_at" | "invoice_id">>;

// Negyedéves beszedett/fizetett ÁFA — csak akkor releváns, ha
// company_settings.vat_registered igaz. Lásd a schema.sql kommentjét:
// ez egy előkészített, nem egy ténylegesen bevalláshoz kötött funkció.
export interface VatReturn {
  id: string;
  year: number;
  quarter: number;
  collected_amount: number;
  paid_amount: number;
  currency: CurrencyCode;
  created_at: string;
  updated_at: string;
}
export type VatReturnInsert = Partial<Omit<VatReturn, "id" | "created_at" | "updated_at">> & {
  year: number;
  quarter: number;
};
export type VatReturnUpdate = Partial<Omit<VatReturn, "id" | "created_at">>;

export interface EmailTemplate {
  id: string;
  name: string;
  html_content: string;
  created_at: string;
}
export type EmailTemplateInsert = Partial<Omit<EmailTemplate, "id" | "created_at">> & {
  name: string;
  html_content: string;
};
export type EmailTemplateUpdate = Partial<Omit<EmailTemplate, "id" | "created_at">>;

export interface NewsletterSubscriber {
  id: string;
  name: string | null;
  email: string;
  subscribed_at: string;
  unsubscribed: boolean;
}
export type NewsletterSubscriberInsert = Partial<Omit<NewsletterSubscriber, "id" | "subscribed_at">> & {
  email: string;
};
export type NewsletterSubscriberUpdate = Partial<Omit<NewsletterSubscriber, "id" | "subscribed_at">>;

// Global send-suppression list — see the comment on this table in
// supabase/schema.sql for why it's separate from
// newsletter_subscribers.unsubscribed.
export interface EmailUnsubscribe {
  email: string;
  unsubscribed_at: string;
}
export type EmailUnsubscribeInsert = { email: string };

export interface MarketingCampaign {
  id: string;
  season: Season;
  theme: string | null;
  product_focus: string | null;
  updated_at: string;
}
export type MarketingCampaignUpdate = Partial<Pick<MarketingCampaign, "theme" | "product_focus">>;

export type MarketingContentType = "Instagram poszt" | "Instagram story" | "Email" | "Kampány";
export type MarketingContentStatus = "Ötlet" | "Tervezve" | "Ütemezve" | "Kiküldve";

export interface MarketingContent {
  id: string;
  title: string;
  content_type: MarketingContentType;
  season: Season | null;
  scheduled_date: string;
  copy_text: string | null;
  // Set when the image was uploaded directly for this content item.
  // Mutually exclusive with asset_id in practice (the form only ever
  // sets one) — never both, so the image is never duplicated between a
  // content row and a saved asset.
  image_url: string | null;
  // Set when the image is a saved marketing_assets row instead — look
  // up that asset's image_url to render it rather than copying it here.
  asset_id: string | null;
  status: MarketingContentStatus;
  notes: string | null;
  // Optional link to the Campaign this piece of content serves — shown
  // on that campaign's részletes nézet. Independent of season above
  // (a campaign has its own, separately-set season).
  campaign_id: string | null;
  created_at: string;
  updated_at: string;
}
export type MarketingContentInsert = Partial<
  Omit<MarketingContent, "id" | "created_at" | "updated_at">
> & {
  title: string;
  content_type: MarketingContentType;
  scheduled_date: string;
};
export type MarketingContentUpdate = Partial<Omit<MarketingContent, "id" | "created_at">>;

export type MarketingAssetLanguage = "HU" | "EN" | "DE";
export type MarketingAssetType = "Koncepció" | "Valódi termékfotó" | "Lifestyle";

export interface MarketingAsset {
  id: string;
  title: string;
  language: MarketingAssetLanguage;
  asset_type: MarketingAssetType;
  platform: string | null;
  season: Season | null;
  image_url: string;
  notes: string | null;
  created_at: string;
}
export type MarketingAssetInsert = Partial<Omit<MarketingAsset, "id" | "created_at">> & {
  title: string;
  language: MarketingAssetLanguage;
  image_url: string;
};
export type MarketingAssetUpdate = Partial<Omit<MarketingAsset, "id" | "created_at">>;

export interface Document {
  id: string;
  title: string;
  category: string | null;
  status: string | null;
  notes: string | null;
  file_path: string | null;
  file_name: string | null;
  related_task_id: string | null;
  related_supplier_id: string | null;
  created_at: string;
}
export type DocumentInsert = Partial<Omit<Document, "id" | "created_at">> & {
  title: string;
};
export type DocumentUpdate = Partial<Omit<Document, "id" | "created_at">>;

export interface FuturePlan {
  id: string;
  title: string;
  category: string | null;
  status: PlanStatus;
  description: string | null;
  created_at: string;
}
export type FuturePlanInsert = Partial<Omit<FuturePlan, "id" | "created_at">> & {
  title: string;
};
export type FuturePlanUpdate = Partial<Omit<FuturePlan, "id" | "created_at">>;

export interface Order {
  id: string;
  customer_name: string;
  customer_email: string | null;
  product: string | null;
  // Optional link into the Termékek catalog — see the comment on this
  // column in supabase/schema.sql. product (free text) stays the
  // display/label field either way; this is only what lets Pénzügyek
  // compute a real, COGS-aware árrés for this order.
  product_id: string | null;
  quantity: number;
  unit_price: number | null;
  // See sale_price_currency on Product — same reasoning, same default.
  unit_price_currency: CurrencyCode;
  delivery_date: string | null;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export type OrderInsert = Partial<Omit<Order, "id" | "created_at" | "updated_at">> & {
  customer_name: string;
};
export type OrderUpdate = Partial<Omit<Order, "id" | "created_at">>;

export type PrintStatus = "Piszkozat" | "Nyomdának elküldve" | "Megrendelve" | "Megérkezett";

export interface CardAssetThumbnail {
  label: string;
  url: string;
}

export interface CardAsset {
  id: string;
  language: string;
  version: string;
  file_url: string;
  notes: string | null;
  print_status: PrintStatus;
  supplier_id: string | null;
  order_date: string | null;
  quantity: number | null;
  thumbnails: CardAssetThumbnail[];
  // Melyik Kártyatervező-kollekció production-fájlja ez — a Kártyák
  // galéria és a Kártya-fájlok lista kölcsönös hivatkozásához (5. fázis).
  collection_id: string | null;
  created_at: string;
}
export type CardAssetInsert = Partial<Omit<CardAsset, "id" | "created_at">> & {
  language: string;
  version: string;
  file_url: string;
};
export type CardAssetUpdate = Partial<Omit<CardAsset, "id" | "created_at">>;

export interface PriceQuote {
  id: string;
  card_asset_id: string;
  supplier_id: string | null;
  quantity: number;
  unit_price: number | null;
  currency: string | null;
  total_price: number | null;
  screenshot_url: string | null;
  notes: string | null;
  quote_date: string;
  is_selected: boolean;
  created_at: string;
}
export type PriceQuoteInsert = Partial<Omit<PriceQuote, "id" | "created_at">> & {
  card_asset_id: string;
  quantity: number;
};
export type PriceQuoteUpdate = Partial<Omit<PriceQuote, "id" | "created_at">>;

// Shared draft/testing/published/archived workflow for Rituals and Cards
// (Kártyák / Rituálék menu) — see the "Rituals + Cards" block in
// schema.sql for the full versioning story.
export type ContentStatus = "draft" | "testing" | "published" | "archived";

export interface RitualSnapshot {
  name: string;
  category: string | null;
  duration_minutes: number | null;
  steps: string[];
}
// One entry per save that changed the record — `snapshot` is null for a
// status-only change (no content edit), so the history stays a true log
// of every version *and* every status transition without duplicating
// content on a trivial status flip. Never overwritten, only appended to
// (see components/ContentVersionHistoryModal.tsx).
export interface RitualVersionEntry {
  version: string;
  status: ContentStatus;
  changed_at: string;
  snapshot: RitualSnapshot | null;
}

export interface Ritual {
  id: string;
  name: string;
  category: string | null;
  duration_minutes: number | null;
  steps: string[];
  status: ContentStatus;
  version: string;
  version_history: RitualVersionEntry[];
  created_at: string;
  updated_at: string;
}
export type RitualInsert = Partial<Omit<Ritual, "id" | "created_at" | "updated_at">> & {
  name: string;
};
export type RitualUpdate = Partial<Omit<Ritual, "id" | "created_at" | "updated_at">>;

export interface CardSnapshot {
  title: string;
  category: string | null;
  question: string | null;
  short_description: string | null;
  deep_question: string | null;
  ritual_id: string | null;
  duration_minutes: number | null;
  energy: string | null;
  depth: string | null;
  mode: string | null;
  nfc_id: string | null;
  qr_url: string | null;
  journey: string | null;
}
export interface CardVersionEntry {
  version: string;
  status: ContentStatus;
  changed_at: string;
  snapshot: CardSnapshot | null;
}

export interface ContentCard {
  id: string;
  card_number: number;
  title: string;
  category: string | null;
  question: string | null;
  short_description: string | null;
  deep_question: string | null;
  ritual_id: string | null;
  duration_minutes: number | null;
  energy: string | null;
  depth: string | null;
  mode: string | null;
  nfc_id: string | null;
  qr_url: string | null;
  journey: string | null;
  status: ContentStatus;
  version: string;
  version_history: CardVersionEntry[];
  created_at: string;
  updated_at: string;
}
export type ContentCardInsert = Partial<Omit<ContentCard, "id" | "card_number" | "created_at" | "updated_at">> & {
  title: string;
};
export type ContentCardUpdate = Partial<Omit<ContentCard, "id" | "card_number" | "created_at" | "updated_at">>;

export type LandingLang = "de" | "en";

export interface LandingLetter {
  id: string;
  letter_text: string;
  lang: LandingLang;
  created_at: string;
}
export type LandingLetterInsert = Partial<Omit<LandingLetter, "id" | "created_at">> & {
  letter_text: string;
};

export interface LandingResponse {
  id: string;
  would_buy: string | null;
  price_range: string | null;
  idea: string | null;
  email: string | null;
  box_items: string[];
  lang: LandingLang;
  created_at: string;
}
export type LandingResponseInsert = Partial<Omit<LandingResponse, "id" | "created_at">>;

export interface LandingPageView {
  id: string;
  lang: LandingLang;
  created_at: string;
}
export type LandingPageViewInsert = Partial<Omit<LandingPageView, "id" | "created_at">>;

export interface GoldCardLetter {
  id: string;
  seq_number: number;
  sealed_date: string;
  uploaded_by: string;
  photo_url: string;
  // Who recorded this from /together — the locally-remembered viewer
  // name, auto-filled there (see app/together). Independent of
  // uploaded_by, which is still hand-typed on the admin dashboard.
  added_by: string | null;
  created_at: string;
}
export type GoldCardLetterInsert = Partial<Omit<GoldCardLetter, "id" | "created_at">> & {
  seq_number: number;
  uploaded_by: string;
  photo_url: string;
};

export interface JourneyMemory {
  id: string;
  date: string;
  place: string;
  experience: string;
  note: string | null;
  photo_url: string | null;
  added_by: string | null;
  created_at: string;
}
export type JourneyMemoryInsert = Partial<Omit<JourneyMemory, "id" | "created_at">> & {
  place: string;
  experience: string;
};

export type WildCardName = "Coffee Break" | "Silence" | "Memory" | "Adventure" | "Gratitude";

export interface WildCardCompletion {
  id: string;
  wildcard_name: WildCardName;
  completed_date: string;
  note: string | null;
  added_by: string | null;
  created_at: string;
}
export type WildCardCompletionInsert = Partial<Omit<WildCardCompletion, "id" | "created_at">> & {
  wildcard_name: WildCardName;
};

export interface TogetherSettings {
  id: string;
  access_code: string;
  opening_date: string | null;
  created_at: string;
  updated_at: string;
}
export type TogetherSettingsInsert = Partial<Omit<TogetherSettings, "id" | "created_at" | "updated_at">> & {
  access_code: string;
};
export type TogetherSettingsUpdate = Partial<Omit<TogetherSettings, "id" | "created_at">>;

export type CurrencyCode = "CHF" | "USD" | "EUR";

export interface CompanySettings {
  id: string;
  company_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  email_signature: string | null;
  currency: CurrencyCode;
  gold_card_reminder_enabled: boolean;
  // Naptár .ics feed subscription token — see app/api/calendar/ics/route.ts.
  ics_token: string | null;
  // QR-számla kiállító (creditor) adatai — lásd app/api/finance/invoice-pdf/
  // route.ts. Külön, strukturált mezők, nem a fenti szabad szöveges
  // `address`, mert a swissqrbill csomag pontosan ezt a formát várja.
  iban: string | null;
  billing_street: string | null;
  billing_zip: string | null;
  billing_city: string | null;
  billing_country: string;
  // Pénzügyek → Cash Flow "Jelenlegi bankegyenleg" — see lib/finance-budget.ts.
  bank_balance: number | null;
  // Pénzügyek → ÁFA/MWST — gates whether the negyedéves beszedett/
  // fizetett ÁFA input mezők (vat_returns) show up.
  vat_registered: boolean;
  created_at: string;
  updated_at: string;
}
export type CompanySettingsInsert = Partial<Omit<CompanySettings, "id" | "created_at" | "updated_at">>;
export type CompanySettingsUpdate = Partial<Omit<CompanySettings, "id" | "created_at">>;

// Beállítások → Fiókok & Szolgáltatások — a metadata-only overview of
// third-party services (which email a service is registered under, what
// it's for, when it renews). Deliberately NOT a credentials store: no
// password field exists here or anywhere in the UI, not even encrypted —
// password_manager_note is a fixed display string, never user-editable
// beyond what schema.sql seeds it to.
export interface ServiceAccount {
  id: string;
  service_name: string;
  account_email: string | null;
  purpose: string | null;
  renewal_date: string | null;
  renewal_cost: number | null;
  renewal_currency: CurrencyCode | null;
  notes: string | null;
  password_manager_note: string;
  created_at: string;
  updated_at: string;
}
export type ServiceAccountInsert = Partial<Omit<ServiceAccount, "id" | "created_at" | "updated_at">> & {
  service_name: string;
};
export type ServiceAccountUpdate = Partial<Omit<ServiceAccount, "id" | "created_at">>;

// Beállítások → Jogi dokumentumok — see the "Legal documents" block in
// schema.sql for the full story. Reuses UnlockHistoryEntry (same shape,
// same lock convention as Expense/Revenue above).
export type LegalDocumentType = "Impresszum" | "Adatvédelem";

export interface LegalDocument {
  id: string;
  type: LegalDocumentType;
  title: string;
  slug: string;
  content: string;
  last_updated: string;
  is_locked: boolean;
  locked_at: string | null;
  unlock_history: UnlockHistoryEntry[];
  created_at: string;
  updated_at: string;
}
export type LegalDocumentInsert = Partial<Omit<LegalDocument, "id" | "created_at" | "updated_at">> & {
  type: LegalDocumentType;
  title: string;
  slug: string;
};
export type LegalDocumentUpdate = Partial<Omit<LegalDocument, "id" | "created_at" | "updated_at">>;

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export type CalendarEventInsert = Partial<Omit<CalendarEvent, "id" | "created_at" | "updated_at">> & {
  title: string;
  date: string;
};
export type CalendarEventUpdate = Partial<Omit<CalendarEvent, "id" | "created_at">>;

export interface SurpriseQuestionLog {
  id: string;
  question_text: string;
  created_at: string;
}
export type SurpriseQuestionLogInsert = Partial<Omit<SurpriseQuestionLog, "id" | "created_at">> & {
  question_text: string;
};

export type ShareContactCategory = "Sajtó" | "Influencer" | "Ismerős" | "Egyéb";

export interface ShareContact {
  id: string;
  name: string;
  email: string | null;
  category: ShareContactCategory;
  contacted: boolean;
  email_text: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export type ShareContactInsert = Partial<Omit<ShareContact, "id" | "created_at" | "updated_at">> & {
  name: string;
};
export type ShareContactUpdate = Partial<Omit<ShareContact, "id" | "created_at">>;

export interface DemandLinkShare {
  id: string;
  contact_id: string | null;
  recipient_name: string | null;
  recipient_email: string;
  email_text: string | null;
  created_at: string;
}
export type DemandLinkShareInsert = Partial<Omit<DemandLinkShare, "id" | "created_at">> & {
  recipient_email: string;
};

// gmail_connection is deliberately NOT part of the Database type below —
// that type backs the browser (anon-key) Supabase client, and this table
// has no anon RLS policy at all (see supabase/schema.sql). It's only
// ever touched through the service-role client in
// lib/supabase/serverClient.ts, which uses ServerDatabase instead.
export interface GmailConnection {
  id: string;
  google_email: string | null;
  encrypted_refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  connected_at: string;
  updated_at: string;
}
export type GmailConnectionInsert = Partial<Omit<GmailConnection, "id" | "connected_at" | "updated_at">> & {
  encrypted_refresh_token: string;
};
export type GmailConnectionUpdate = Partial<Omit<GmailConnection, "id" | "connected_at">>;

// Everything Database below has, PLUS gmail_connection — the service-role
// client (lib/supabase/serverClient.ts) bypasses RLS entirely, so it's
// the right client for any trusted server-only code path (a route
// that's either its own-secret-gated — CRON_SECRET, the .ics ?token= —
// or already sits behind proxy.ts's Supabase Auth redirect) that needs
// to touch a table now locked to `auth.uid() is not null`, since that
// server code never carries the browser's session JWT through to
// Postgres the way the browser's own anon-key client does.
export interface ServerDatabase {
  public: {
    Tables: Database["public"]["Tables"] & {
      gmail_connection: {
        Row: GmailConnection;
        Insert: GmailConnectionInsert;
        Update: GmailConnectionUpdate;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export interface Database {
  public: {
    Tables: {
      suppliers: {
        Row: Supplier;
        Insert: SupplierInsert;
        Update: SupplierUpdate;
        Relationships: [];
      };
      tasks: {
        Row: TaskItem;
        Insert: TaskInsert;
        Update: TaskUpdate;
        Relationships: [];
      };
      campaigns: {
        Row: Campaign;
        Insert: CampaignInsert;
        Update: CampaignUpdate;
        Relationships: [];
      };
      task_templates: {
        Row: TaskTemplate;
        Insert: TaskTemplateInsert;
        Update: TaskTemplateUpdate;
        Relationships: [];
      };
      finance_products: {
        Row: FinanceProduct;
        Insert: FinanceProductInsert;
        Update: FinanceProductUpdate;
        Relationships: [];
      };
      marketing_campaigns: {
        Row: MarketingCampaign;
        Insert: Partial<MarketingCampaign>;
        Update: MarketingCampaignUpdate;
        Relationships: [];
      };
      marketing_content: {
        Row: MarketingContent;
        Insert: MarketingContentInsert;
        Update: MarketingContentUpdate;
        Relationships: [];
      };
      marketing_assets: {
        Row: MarketingAsset;
        Insert: MarketingAssetInsert;
        Update: MarketingAssetUpdate;
        Relationships: [];
      };
      documents: {
        Row: Document;
        Insert: DocumentInsert;
        Update: DocumentUpdate;
        Relationships: [];
      };
      future_plans: {
        Row: FuturePlan;
        Insert: FuturePlanInsert;
        Update: FuturePlanUpdate;
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: OrderInsert;
        Update: OrderUpdate;
        Relationships: [];
      };
      card_assets: {
        Row: CardAsset;
        Insert: CardAssetInsert;
        Update: CardAssetUpdate;
        Relationships: [];
      };
      price_quotes: {
        Row: PriceQuote;
        Insert: PriceQuoteInsert;
        Update: PriceQuoteUpdate;
        Relationships: [];
      };
      landing_letters: {
        Row: LandingLetter;
        Insert: LandingLetterInsert;
        Update: Partial<LandingLetter>;
        Relationships: [];
      };
      landing_responses: {
        Row: LandingResponse;
        Insert: LandingResponseInsert;
        Update: Partial<LandingResponse>;
        Relationships: [];
      };
      landing_page_views: {
        Row: LandingPageView;
        Insert: LandingPageViewInsert;
        Update: Partial<LandingPageView>;
        Relationships: [];
      };
      gold_card_letters: {
        Row: GoldCardLetter;
        Insert: GoldCardLetterInsert;
        Update: Partial<Omit<GoldCardLetter, "id" | "created_at">>;
        Relationships: [];
      };
      journey_memories: {
        Row: JourneyMemory;
        Insert: JourneyMemoryInsert;
        Update: Partial<Omit<JourneyMemory, "id" | "created_at">>;
        Relationships: [];
      };
      wild_card_completions: {
        Row: WildCardCompletion;
        Insert: WildCardCompletionInsert;
        Update: Partial<Omit<WildCardCompletion, "id" | "created_at">>;
        Relationships: [];
      };
      surprise_question_log: {
        Row: SurpriseQuestionLog;
        Insert: SurpriseQuestionLogInsert;
        Update: Partial<Omit<SurpriseQuestionLog, "id" | "created_at">>;
        Relationships: [];
      };
      together_settings: {
        Row: TogetherSettings;
        Insert: TogetherSettingsInsert;
        Update: TogetherSettingsUpdate;
        Relationships: [];
      };
      share_contacts: {
        Row: ShareContact;
        Insert: ShareContactInsert;
        Update: ShareContactUpdate;
        Relationships: [];
      };
      demand_link_shares: {
        Row: DemandLinkShare;
        Insert: DemandLinkShareInsert;
        Update: Partial<Omit<DemandLinkShare, "id" | "created_at">>;
        Relationships: [];
      };
      company_settings: {
        Row: CompanySettings;
        Insert: CompanySettingsInsert;
        Update: CompanySettingsUpdate;
        Relationships: [];
      };
      service_accounts: {
        Row: ServiceAccount;
        Insert: ServiceAccountInsert;
        Update: ServiceAccountUpdate;
        Relationships: [];
      };
      legal_documents: {
        Row: LegalDocument;
        Insert: LegalDocumentInsert;
        Update: LegalDocumentUpdate;
        Relationships: [];
      };
      rituals: {
        Row: Ritual;
        Insert: RitualInsert;
        Update: RitualUpdate;
        Relationships: [];
      };
      cards: {
        Row: ContentCard;
        Insert: ContentCardInsert;
        Update: ContentCardUpdate;
        Relationships: [];
      };
      calendar_events: {
        Row: CalendarEvent;
        Insert: CalendarEventInsert;
        Update: CalendarEventUpdate;
        Relationships: [];
      };
      products: {
        Row: Product;
        Insert: ProductInsert;
        Update: ProductUpdate;
        Relationships: [];
      };
      card_templates: {
        Row: CardTemplate;
        Insert: CardTemplateInsert;
        Update: CardTemplateUpdate;
        Relationships: [];
      };
      card_collections: {
        Row: CardCollection;
        Insert: CardCollectionInsert;
        Update: CardCollectionUpdate;
        Relationships: [];
      };
      collection_cards: {
        Row: CollectionCard;
        Insert: CollectionCardInsert;
        Update: CollectionCardUpdate;
        Relationships: [];
      };
      card_export_versions: {
        Row: CardExportVersion;
        Insert: CardExportVersionInsert;
        Update: CardExportVersionUpdate;
        Relationships: [];
      };
      expenses: {
        Row: Expense;
        Insert: ExpenseInsert;
        Update: ExpenseUpdate;
        Relationships: [];
      };
      revenue: {
        Row: Revenue;
        Insert: RevenueInsert;
        Update: RevenueUpdate;
        Relationships: [];
      };
      budgets: {
        Row: Budget;
        Insert: BudgetInsert;
        Update: BudgetUpdate;
        Relationships: [];
      };
      invoices: {
        Row: Invoice;
        Insert: InvoiceInsert;
        Update: InvoiceUpdate;
        Relationships: [];
      };
      invoice_items: {
        Row: InvoiceItem;
        Insert: InvoiceItemInsert;
        Update: InvoiceItemUpdate;
        Relationships: [];
      };
      vat_returns: {
        Row: VatReturn;
        Insert: VatReturnInsert;
        Update: VatReturnUpdate;
        Relationships: [];
      };
      email_templates: {
        Row: EmailTemplate;
        Insert: EmailTemplateInsert;
        Update: EmailTemplateUpdate;
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: NewsletterSubscriber;
        Insert: NewsletterSubscriberInsert;
        Update: NewsletterSubscriberUpdate;
        Relationships: [];
      };
      email_unsubscribes: {
        Row: EmailUnsubscribe;
        Insert: EmailUnsubscribeInsert;
        Update: Partial<EmailUnsubscribe>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

/**
 * Every anon-accessible table name, in the exact order Database.Tables
 * above lists them — read by the Beállítások "Minden adat exportálása"
 * (all of them) and "Minden adat törlése" (all except together_settings
 * and company_settings, kept so a reset doesn't also lock the founder
 * out of the Közös tér link or wipe Márka-adatok — see
 * components/DangerZoneSection.tsx) features. Keep this in sync by hand
 * whenever a table is added to or removed from Database.Tables — there's
 * no way to derive a runtime string array from a TypeScript interface.
 */
export const ANON_TABLE_NAMES = [
  "suppliers",
  "tasks",
  "campaigns",
  "task_templates",
  "finance_products",
  "marketing_campaigns",
  "marketing_content",
  "marketing_assets",
  "documents",
  "future_plans",
  "orders",
  "card_assets",
  "price_quotes",
  "landing_letters",
  "landing_responses",
  "landing_page_views",
  "gold_card_letters",
  "journey_memories",
  "wild_card_completions",
  "surprise_question_log",
  "together_settings",
  "share_contacts",
  "demand_link_shares",
  "calendar_events",
  "products",
  "card_templates",
  "card_collections",
  "collection_cards",
  "card_export_versions",
  "expenses",
  "revenue",
  "budgets",
  "invoices",
  "invoice_items",
  "vat_returns",
  "email_templates",
  "newsletter_subscribers",
  "email_unsubscribes",
  "company_settings",
  "service_accounts",
  "rituals",
  "cards",
  "legal_documents",
] as const satisfies readonly (keyof Database["public"]["Tables"])[];
