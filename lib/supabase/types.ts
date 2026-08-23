// Hand-written types mirroring supabase/schema.sql.
// If you change the schema, update this file to match (or generate with
// `supabase gen types typescript` once you have the Supabase CLI linked).

export type TaskStatus = "Teendő" | "Folyamatban" | "Kész";
export type TaskPriority = "Low" | "Medium" | "High";
export type PlanStatus = "Idea" | "Considering" | "Planned";
export type Season = "Spring" | "Summer" | "Autumn" | "Winter";
export type OrderStatus = "New" | "Processing" | "Shipped" | "Done";
export type ContractStatus = "None" | "Signed" | "Failed" | "Expired";

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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
