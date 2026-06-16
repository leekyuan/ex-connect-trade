export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      error_logs: {
        Row: {
          created_at: string
          id: string
          message: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      exchange_api_keys: {
        Row: {
          api_key: string
          api_secret: string
          created_at: string
          exchange: string
          id: string
          passphrase: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          api_secret: string
          created_at?: string
          exchange: string
          id?: string
          passphrase?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          api_key?: string
          api_secret?: string
          created_at?: string
          exchange?: string
          id?: string
          passphrase?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_trades: {
        Row: {
          entry_at: string
          entry_price: number
          exit_at: string | null
          exit_price: number | null
          id: string
          leverage: number
          note: string | null
          pnl_pct: number | null
          pnl_usdt: number | null
          quantity: number
          side: string
          status: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          user_id: string
        }
        Insert: {
          entry_at?: string
          entry_price: number
          exit_at?: string | null
          exit_price?: number | null
          id?: string
          leverage?: number
          note?: string | null
          pnl_pct?: number | null
          pnl_usdt?: number | null
          quantity: number
          side: string
          status?: string
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          user_id?: string
        }
        Update: {
          entry_at?: string
          entry_price?: number
          exit_at?: string | null
          exit_price?: number | null
          id?: string
          leverage?: number
          note?: string | null
          pnl_pct?: number | null
          pnl_usdt?: number | null
          quantity?: number
          side?: string
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          user_id?: string
        }
        Relationships: []
      }
      price_alerts: {
        Row: {
          condition: string
          created_at: string
          id: string
          notify_telegram: boolean
          symbol: string
          target_price: number
          triggered: boolean
          triggered_at: string | null
          user_id: string
        }
        Insert: {
          condition: string
          created_at?: string
          id?: string
          notify_telegram?: boolean
          symbol: string
          target_price: number
          triggered?: boolean
          triggered_at?: string | null
          user_id?: string
        }
        Update: {
          condition?: string
          created_at?: string
          id?: string
          notify_telegram?: boolean
          symbol?: string
          target_price?: number
          triggered?: boolean
          triggered_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          onboarding_completed: boolean
          updated_at: string
          user_id: string
          user_preferences: Json
        }
        Insert: {
          created_at?: string
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
          user_preferences?: Json
        }
        Update: {
          created_at?: string
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
          user_preferences?: Json
        }
        Relationships: []
      }
      signal_history: {
        Row: {
          confidence: number
          created_at: string
          entry_price: number
          id: string
          metadata: Json | null
          pnl_pct: number | null
          reasons: Json | null
          resolved_at: string | null
          resolved_price: number | null
          side: string
          sl_price: number | null
          source: string | null
          status: string
          strength: string
          symbol: string
          timeframe: string
          tp1_price: number | null
          tp2_price: number | null
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          entry_price: number
          id?: string
          metadata?: Json | null
          pnl_pct?: number | null
          reasons?: Json | null
          resolved_at?: string | null
          resolved_price?: number | null
          side: string
          sl_price?: number | null
          source?: string | null
          status?: string
          strength?: string
          symbol: string
          timeframe?: string
          tp1_price?: number | null
          tp2_price?: number | null
          user_id?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          entry_price?: number
          id?: string
          metadata?: Json | null
          pnl_pct?: number | null
          reasons?: Json | null
          resolved_at?: string | null
          resolved_price?: number | null
          side?: string
          sl_price?: number | null
          source?: string | null
          status?: string
          strength?: string
          symbol?: string
          timeframe?: string
          tp1_price?: number | null
          tp2_price?: number | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_settings: {
        Row: {
          chat_id: string
          created_at: string
          enabled: boolean
          id: string
          min_confidence: number
          notify_daytrading: boolean
          notify_price_alerts: boolean
          notify_scalping: boolean
          notify_swing: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          min_confidence?: number
          notify_daytrading?: boolean
          notify_price_alerts?: boolean
          notify_scalping?: boolean
          notify_swing?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          min_confidence?: number
          notify_daytrading?: boolean
          notify_price_alerts?: boolean
          notify_scalping?: boolean
          notify_swing?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_history: {
        Row: {
          closed_at: string | null
          entry_price: number
          exchange: string
          exit_price: number | null
          id: string
          leverage: number
          metadata: Json | null
          opened_at: string
          order_type: string
          pnl: number | null
          pnl_percent: number | null
          quantity: number
          side: string
          status: string
          strategy: string | null
          symbol: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          entry_price: number
          exchange: string
          exit_price?: number | null
          id?: string
          leverage?: number
          metadata?: Json | null
          opened_at?: string
          order_type?: string
          pnl?: number | null
          pnl_percent?: number | null
          quantity: number
          side?: string
          status?: string
          strategy?: string | null
          symbol: string
          user_id?: string
        }
        Update: {
          closed_at?: string | null
          entry_price?: number
          exchange?: string
          exit_price?: number | null
          id?: string
          leverage?: number
          metadata?: Json | null
          opened_at?: string
          order_type?: string
          pnl?: number | null
          pnl_percent?: number | null
          quantity?: number
          side?: string
          status?: string
          strategy?: string | null
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_journal: {
        Row: {
          created_at: string
          emotion_score: number | null
          entry_plan: string | null
          followed_rules: boolean | null
          id: string
          outcome: string | null
          pnl_pct: number | null
          review: string | null
          rule_violations: Json | null
          screenshot_url: string | null
          side: string
          symbol: string
          tags: string[] | null
          trade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emotion_score?: number | null
          entry_plan?: string | null
          followed_rules?: boolean | null
          id?: string
          outcome?: string | null
          pnl_pct?: number | null
          review?: string | null
          rule_violations?: Json | null
          screenshot_url?: string | null
          side: string
          symbol: string
          tags?: string[] | null
          trade_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          emotion_score?: number | null
          entry_plan?: string | null
          followed_rules?: boolean | null
          id?: string
          outcome?: string | null
          pnl_pct?: number | null
          review?: string | null
          rule_violations?: Json | null
          screenshot_url?: string | null
          side?: string
          symbol?: string
          tags?: string[] | null
          trade_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_logs: {
        Row: {
          created_at: string
          entry_price: number
          exchange: string
          id: string
          leverage: number
          position_size: number
          result: Json | null
          sl_price: number
          status: string
          symbol: string
          tp_split_ratio: number
          tp1_price: number
          tp2_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_price: number
          exchange: string
          id?: string
          leverage: number
          position_size: number
          result?: Json | null
          sl_price: number
          status?: string
          symbol: string
          tp_split_ratio: number
          tp1_price: number
          tp2_price: number
          user_id?: string
        }
        Update: {
          created_at?: string
          entry_price?: number
          exchange?: string
          id?: string
          leverage?: number
          position_size?: number
          result?: Json | null
          sl_price?: number
          status?: string
          symbol?: string
          tp_split_ratio?: number
          tp1_price?: number
          tp2_price?: number
          user_id?: string
        }
        Relationships: []
      }
      trading_rules: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          rule_text: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          rule_text: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          rule_text?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_settings: {
        Row: {
          auto_trade_enabled: boolean
          created_at: string
          default_leverage: number
          exchange: string
          id: string
          strategy_params: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_trade_enabled?: boolean
          created_at?: string
          default_leverage?: number
          exchange?: string
          id?: string
          strategy_params?: Json | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          auto_trade_enabled?: boolean
          created_at?: string
          default_leverage?: number
          exchange?: string
          id?: string
          strategy_params?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
