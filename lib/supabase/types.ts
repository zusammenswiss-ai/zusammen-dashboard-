// Hand-written types mirroring supabase/schema.sql.
// If you change the schema, update this file to match (or generate with
// `supabase gen types typescript` once you have the Supabase CLI linked).

export type TaskStatus = "Teendő" | "Folyamatban" | "Kész";
export type TaskPriority = "Low" | "Medium" | "High";
export type PlanStatus = "Idea" | "Considering" | "Planned";
export type Season = "Spring" | "Summer" | "Autumn" | "Winter";
export type OrderStatus = "New" | "Processing" | "Shipped" | "Done";
export type ContractStatus = "None" | "Signed" | "Failed" | "Expired";
export type RecurrenceType = "Napi" | "Heti" | "Havi" | "Negyedéves" | "Éves";

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
  created_at: string;
  updated_at: string;
}
export type TaskInsert = Partial<Omit<TaskItem, "id" | "created_at" | "updated_at">> & {
  title: string;
};
export type TaskUpdate = Partial<Omit<TaskItem, "id" | "created_at">>;

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
export type FinanceProductUpdate = Partial<Omit<FinanceProduct, "id" | "created_at">>;

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
  quantity: number;
  unit_price: number | null;
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
  created_at: string;
  updated_at: string;
}
export type CompanySettingsInsert = Partial<Omit<CompanySettings, "id" | "created_at" | "updated_at">>;
export type CompanySettingsUpdate = Partial<Omit<CompanySettings, "id" | "created_at">>;

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

export interface ServerDatabase {
  public: {
    Tables: {
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
      calendar_events: {
        Row: CalendarEvent;
        Insert: CalendarEventInsert;
        Update: CalendarEventUpdate;
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
  "gold_card_letters",
  "journey_memories",
  "wild_card_completions",
  "surprise_question_log",
  "together_settings",
  "share_contacts",
  "demand_link_shares",
  "calendar_events",
  "company_settings",
] as const satisfies readonly (keyof Database["public"]["Tables"])[];
