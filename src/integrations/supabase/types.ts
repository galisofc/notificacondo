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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      apartments: {
        Row: {
          area_sqm: number | null
          block_id: string
          created_at: string
          floor: number | null
          id: string
          monthly_fee: number | null
          number: string
          updated_at: string
        }
        Insert: {
          area_sqm?: number | null
          block_id: string
          created_at?: string
          floor?: number | null
          id?: string
          monthly_fee?: number | null
          number: string
          updated_at?: string
        }
        Update: {
          area_sqm?: number | null
          block_id?: string
          created_at?: string
          floor?: number | null
          id?: string
          monthly_fee?: number | null
          number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apartments_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      blocks: {
        Row: {
          condominium_id: string
          created_at: string
          description: string | null
          floors: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          condominium_id: string
          created_at?: string
          description?: string | null
          floors?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          condominium_id?: string
          created_at?: string
          description?: string | null
          floors?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_condominium_id_fkey"
            columns: ["condominium_id"]
            isOneToOne: false
            referencedRelation: "condominiums"
            referencedColumns: ["id"]
          },
        ]
      }
      condominium_transfers: {
        Row: {
          condominium_id: string
          created_at: string
          from_owner_id: string
          id: string
          notes: string | null
          to_owner_id: string
          transferred_at: string
          transferred_by: string
        }
        Insert: {
          condominium_id: string
          created_at?: string
          from_owner_id: string
          id?: string
          notes?: string | null
          to_owner_id: string
          transferred_at?: string
          transferred_by: string
        }
        Update: {
          condominium_id?: string
          created_at?: string
          from_owner_id?: string
          id?: string
          notes?: string | null
          to_owner_id?: string
          transferred_at?: string
          transferred_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "condominium_transfers_condominium_id_fkey"
            columns: ["condominium_id"]
            isOneToOne: false
            referencedRelation: "condominiums"
            referencedColumns: ["id"]
          },
        ]
      }
      condominiums: {
        Row: {
          address: string | null
          address_number: string | null
          city: string | null
          cnpj: string | null
          convention_url: string | null
          created_at: string
          id: string
          internal_rules_url: string | null
          name: string
          neighborhood: string | null
          owner_id: string
          phone: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          city?: string | null
          cnpj?: string | null
          convention_url?: string | null
          created_at?: string
          id?: string
          internal_rules_url?: string | null
          name: string
          neighborhood?: string | null
          owner_id: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_number?: string | null
          city?: string | null
          cnpj?: string | null
          convention_url?: string | null
          created_at?: string
          id?: string
          internal_rules_url?: string | null
          name?: string
          neighborhood?: string | null
          owner_id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      cron_job_controls: {
        Row: {
          created_at: string
          function_name: string
          paused: boolean
          paused_at: string | null
          paused_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          function_name: string
          paused?: boolean
          paused_at?: string | null
          paused_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          function_name?: string
          paused?: boolean
          paused_at?: string | null
          paused_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      decisions: {
        Row: {
          created_at: string
          decided_at: string
          decided_by: string
          decision: Database["public"]["Enums"]["occurrence_status"]
          id: string
          justification: string
          occurrence_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string
          decided_by: string
          decision: Database["public"]["Enums"]["occurrence_status"]
          id?: string
          justification: string
          occurrence_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string
          decided_by?: string
          decision?: Database["public"]["Enums"]["occurrence_status"]
          id?: string
          justification?: string
          occurrence_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      defense_attachments: {
        Row: {
          created_at: string
          defense_id: string
          description: string | null
          file_type: string
          file_url: string
          id: string
        }
        Insert: {
          created_at?: string
          defense_id: string
          description?: string | null
          file_type: string
          file_url: string
          id?: string
        }
        Update: {
          created_at?: string
          defense_id?: string
          description?: string | null
          file_type?: string
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "defense_attachments_defense_id_fkey"
            columns: ["defense_id"]
            isOneToOne: false
            referencedRelation: "defenses"
            referencedColumns: ["id"]
          },
        ]
      }
      defenses: {
        Row: {
          content: string
          created_at: string
          deadline: string
          id: string
          occurrence_id: string
          resident_id: string
          submitted_at: string
        }
        Insert: {
          content: string
          created_at?: string
          deadline: string
          id?: string
          occurrence_id: string
          resident_id: string
          submitted_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          deadline?: string
          id?: string
          occurrence_id?: string
          resident_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "defenses_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defenses_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_function_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          ended_at: string | null
          error_message: string | null
          function_name: string
          id: string
          result: Json | null
          started_at: string
          status: string
          trigger_type: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          ended_at?: string | null
          error_message?: string | null
          function_name: string
          id?: string
          result?: Json | null
          started_at?: string
          status?: string
          trigger_type?: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          ended_at?: string | null
          error_message?: string | null
          function_name?: string
          id?: string
          result?: Json | null
          started_at?: string
          status?: string
          trigger_type?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      fines: {
        Row: {
          acknowledged_at: string | null
          amount: number
          created_at: string
          due_date: string
          id: string
          multiplier: number
          notified_at: string | null
          occurrence_id: string
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          resident_id: string
          status: Database["public"]["Enums"]["fine_status"]
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          amount: number
          created_at?: string
          due_date: string
          id?: string
          multiplier?: number
          notified_at?: string | null
          occurrence_id: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          resident_id: string
          status?: Database["public"]["Enums"]["fine_status"]
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          multiplier?: number
          notified_at?: string | null
          occurrence_id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          resident_id?: string
          status?: Database["public"]["Enums"]["fine_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fines_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fines_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          condominium_id: string
          created_at: string
          description: string | null
          due_date: string
          id: string
          invoice_number: string | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          period_end: string
          period_start: string
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          condominium_id: string
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          invoice_number?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          period_end: string
          period_start: string
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          condominium_id?: string
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          invoice_number?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          period_end?: string
          period_start?: string
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_condominium_id_fkey"
            columns: ["condominium_id"]
            isOneToOne: false
            referencedRelation: "condominiums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      mercadopago_config: {
        Row: {
          access_token_encrypted: string
          created_at: string
          id: string
          is_active: boolean
          is_sandbox: boolean
          notification_url: string | null
          public_key: string | null
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          notification_url?: string | null
          public_key?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          notification_url?: string | null
          public_key?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      mercadopago_webhook_logs: {
        Row: {
          created_at: string
          data_id: string | null
          error_message: string | null
          event_action: string | null
          event_type: string
          id: string
          ip_address: string | null
          payload: Json
          processing_duration_ms: number | null
          processing_result: Json | null
          processing_status: string
          received_at: string
          signature_valid: boolean | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          data_id?: string | null
          error_message?: string | null
          event_action?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          payload: Json
          processing_duration_ms?: number | null
          processing_result?: Json | null
          processing_status?: string
          received_at?: string
          signature_valid?: boolean | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          data_id?: string | null
          error_message?: string | null
          event_action?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          payload?: Json
          processing_duration_ms?: number | null
          processing_result?: Json | null
          processing_status?: string
          received_at?: string
          signature_valid?: boolean | null
          user_agent?: string | null
        }
        Relationships: []
      }
      notifications_sent: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          delivered_at: string | null
          device_info: Json | null
          id: string
          ip_address: string | null
          location_info: Json | null
          message_content: string
          occurrence_id: string
          read_at: string | null
          resident_id: string
          secure_link: string
          secure_link_token: string
          sent_at: string
          sent_via: string
          user_agent: string | null
          zpro_message_id: string | null
          zpro_status: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          delivered_at?: string | null
          device_info?: Json | null
          id?: string
          ip_address?: string | null
          location_info?: Json | null
          message_content: string
          occurrence_id: string
          read_at?: string | null
          resident_id: string
          secure_link: string
          secure_link_token: string
          sent_at?: string
          sent_via?: string
          user_agent?: string | null
          zpro_message_id?: string | null
          zpro_status?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          delivered_at?: string | null
          device_info?: Json | null
          id?: string
          ip_address?: string | null
          location_info?: Json | null
          message_content?: string
          occurrence_id?: string
          read_at?: string | null
          resident_id?: string
          secure_link?: string
          secure_link_token?: string
          sent_at?: string
          sent_via?: string
          user_agent?: string | null
          zpro_message_id?: string | null
          zpro_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_sent_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sent_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrence_evidences: {
        Row: {
          created_at: string
          description: string | null
          file_type: string
          file_url: string
          id: string
          occurrence_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_type: string
          file_url: string
          id?: string
          occurrence_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_type?: string
          file_url?: string
          id?: string
          occurrence_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrence_evidences_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrences: {
        Row: {
          apartment_id: string | null
          block_id: string | null
          civil_code_article: string | null
          condominium_id: string
          convention_article: string | null
          created_at: string
          description: string
          id: string
          internal_rules_article: string | null
          legal_basis: string | null
          location: string | null
          occurred_at: string
          registered_by: string
          resident_id: string | null
          status: Database["public"]["Enums"]["occurrence_status"]
          title: string
          type: Database["public"]["Enums"]["occurrence_type"]
          updated_at: string
        }
        Insert: {
          apartment_id?: string | null
          block_id?: string | null
          civil_code_article?: string | null
          condominium_id: string
          convention_article?: string | null
          created_at?: string
          description: string
          id?: string
          internal_rules_article?: string | null
          legal_basis?: string | null
          location?: string | null
          occurred_at: string
          registered_by: string
          resident_id?: string | null
          status?: Database["public"]["Enums"]["occurrence_status"]
          title: string
          type: Database["public"]["Enums"]["occurrence_type"]
          updated_at?: string
        }
        Update: {
          apartment_id?: string | null
          block_id?: string | null
          civil_code_article?: string | null
          condominium_id?: string
          convention_article?: string | null
          created_at?: string
          description?: string
          id?: string
          internal_rules_article?: string | null
          legal_basis?: string | null
          location?: string | null
          occurred_at?: string
          registered_by?: string
          resident_id?: string | null
          status?: Database["public"]["Enums"]["occurrence_status"]
          title?: string
          type?: Database["public"]["Enums"]["occurrence_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrences_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_condominium_id_fkey"
            columns: ["condominium_id"]
            isOneToOne: false
            referencedRelation: "condominiums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          color: string
          created_at: string
          description: string | null
          display_order: number
          fines_limit: number
          id: string
          is_active: boolean
          mercadopago_plan_id: string | null
          name: string
          notifications_limit: number
          price: number
          slug: string
          updated_at: string
          warnings_limit: number
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          fines_limit?: number
          id?: string
          is_active?: boolean
          mercadopago_plan_id?: string | null
          name: string
          notifications_limit?: number
          price?: number
          slug: string
          updated_at?: string
          warnings_limit?: number
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          fines_limit?: number
          id?: string
          is_active?: boolean
          mercadopago_plan_id?: string | null
          name?: string
          notifications_limit?: number
          price?: number
          slug?: string
          updated_at?: string
          warnings_limit?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cpf: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      residents: {
        Row: {
          apartment_id: string
          cpf: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_owner: boolean
          is_responsible: boolean
          move_in_date: string | null
          move_out_date: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          apartment_id: string
          cpf?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_owner?: boolean
          is_responsible?: boolean
          move_in_date?: string | null
          move_out_date?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          apartment_id?: string
          cpf?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_owner?: boolean
          is_responsible?: boolean
          move_in_date?: string | null
          move_out_date?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "residents_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          active: boolean
          condominium_id: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          fines_limit: number
          fines_used: number
          id: string
          is_trial: boolean
          mercado_pago_subscription_id: string | null
          mercadopago_preapproval_id: string | null
          notifications_limit: number
          notifications_used: number
          plan: Database["public"]["Enums"]["plan_type"]
          trial_ends_at: string | null
          updated_at: string
          warnings_limit: number
          warnings_used: number
        }
        Insert: {
          active?: boolean
          condominium_id?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          fines_limit?: number
          fines_used?: number
          id?: string
          is_trial?: boolean
          mercado_pago_subscription_id?: string | null
          mercadopago_preapproval_id?: string | null
          notifications_limit?: number
          notifications_used?: number
          plan?: Database["public"]["Enums"]["plan_type"]
          trial_ends_at?: string | null
          updated_at?: string
          warnings_limit?: number
          warnings_used?: number
        }
        Update: {
          active?: boolean
          condominium_id?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          fines_limit?: number
          fines_used?: number
          id?: string
          is_trial?: boolean
          mercado_pago_subscription_id?: string | null
          mercadopago_preapproval_id?: string | null
          notifications_limit?: number
          notifications_used?: number
          plan?: Database["public"]["Enums"]["plan_type"]
          trial_ends_at?: string | null
          updated_at?: string
          warnings_limit?: number
          warnings_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_condominium_id_fkey"
            columns: ["condominium_id"]
            isOneToOne: true
            referencedRelation: "condominiums"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      whatsapp_config: {
        Row: {
          api_key: string
          api_url: string
          app_url: string | null
          created_at: string
          id: string
          instance_id: string
          is_active: boolean
          provider: string
          updated_at: string
        }
        Insert: {
          api_key: string
          api_url: string
          app_url?: string | null
          created_at?: string
          id?: string
          instance_id: string
          is_active?: boolean
          provider?: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          api_url?: string
          app_url?: string | null
          created_at?: string
          id?: string
          instance_id?: string
          is_active?: boolean
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          content: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          content: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_cron_job_pause_status: {
        Args: never
        Returns: {
          function_name: string
          paused: boolean
          paused_at: string
        }[]
      }
      get_cron_job_runs: {
        Args: never
        Returns: {
          command: string
          database: string
          end_time: string
          job_pid: number
          jobid: number
          return_message: string
          runid: number
          start_time: string
          status: string
          username: string
        }[]
      }
      get_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          database: string
          jobid: number
          jobname: string
          nodename: string
          nodeport: number
          schedule: string
          username: string
        }[]
      }
      get_rls_status: {
        Args: never
        Returns: {
          policy_count: number
          rls_enabled: boolean
          table_name: string
        }[]
      }
      get_user_condominium_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner_of_apartment: {
        Args: { _apartment_id: string; _user_id: string }
        Returns: boolean
      }
      is_resident_of_apartment: {
        Args: { _apartment_id: string; _user_id: string }
        Returns: boolean
      }
      is_resident_of_condominium: {
        Args: { _condominium_id: string; _user_id: string }
        Returns: boolean
      }
      toggle_cron_job: { Args: { p_jobid: number }; Returns: boolean }
      toggle_cron_job_pause: {
        Args: { p_function_name: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "sindico" | "morador"
      fine_status: "em_aberto" | "pago" | "vencido"
      occurrence_status:
        | "registrada"
        | "notificado"
        | "em_defesa"
        | "analisando"
        | "arquivada"
        | "advertido"
        | "multado"
      occurrence_type: "advertencia" | "notificacao" | "multa"
      plan_type: "start" | "essencial" | "profissional" | "enterprise"
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
      app_role: ["super_admin", "sindico", "morador"],
      fine_status: ["em_aberto", "pago", "vencido"],
      occurrence_status: [
        "registrada",
        "notificado",
        "em_defesa",
        "analisando",
        "arquivada",
        "advertido",
        "multado",
      ],
      occurrence_type: ["advertencia", "notificacao", "multa"],
      plan_type: ["start", "essencial", "profissional", "enterprise"],
    },
  },
} as const
