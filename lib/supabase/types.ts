// Hand-written types mirroring supabase/schema.sql.
// If you change the schema, update this file to match (or generate with
// `supabase gen types typescript` once you have the Supabase CLI linked).

export type TaskStatus = "Teendő" | "Folyamatban" | "Kész";
export type TaskPriority = "Low" | "Medium" | "High";
export type PlanStatus = "Idea" | "Considering" | "Planned";
export type Season = "Spring" | "Summer" | "Autumn" | "Winter";
export type OrderStatus = "New" | "Processing" | "Shipped" | "Done";

export interface Supplier {
  id: string;
  name: string;
  category: string | null;
  contacted: boolean;
  reply_received: boolean;
  notes: string | null;
  email_text: string | null;
  contact_email: string | null;
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
  created_at: string;
  updated_at: string;
}
export type TaskInsert = Partial<Omit<TaskItem, "id" | "created_at" | "updated_at">> & {
  title: string;
};
export type TaskUpdate = Partial<Omit<TaskItem, "id" | "created_at">>;

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
