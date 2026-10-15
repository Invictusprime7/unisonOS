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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_agent_registry: {
        Row: {
          allowed_tools: Json
          created_at: string
          default_config: Json
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          system_prompt: string
          tier: Database["public"]["Enums"]["agent_tier"]
          ui_kind: Database["public"]["Enums"]["agent_ui_kind"] | null
          updated_at: string
          version: string
        }
        Insert: {
          allowed_tools?: Json
          created_at?: string
          default_config?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          system_prompt: string
          tier?: Database["public"]["Enums"]["agent_tier"]
          ui_kind?: Database["public"]["Enums"]["agent_ui_kind"] | null
          updated_at?: string
          version?: string
        }
        Update: {
          allowed_tools?: Json
          created_at?: string
          default_config?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          system_prompt?: string
          tier?: Database["public"]["Enums"]["agent_tier"]
          ui_kind?: Database["public"]["Enums"]["agent_ui_kind"] | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      ai_builder_proposals: {
        Row: {
          applied_at: string | null
          apply_result: Json | null
          business_id: string | null
          created_at: string
          dry_run_report: Json | null
          id: string
          kind: Database["public"]["Enums"]["ai_builder_proposal_kind"]
          payload: Json
          project_id: string | null
          proposed_by: string
          rationale: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["ai_builder_proposal_status"]
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          apply_result?: Json | null
          business_id?: string | null
          created_at?: string
          dry_run_report?: Json | null
          id?: string
          kind: Database["public"]["Enums"]["ai_builder_proposal_kind"]
          payload?: Json
          project_id?: string | null
          proposed_by: string
          rationale?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["ai_builder_proposal_status"]
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          apply_result?: Json | null
          business_id?: string | null
          created_at?: string
          dry_run_report?: Json | null
          id?: string
          kind?: Database["public"]["Enums"]["ai_builder_proposal_kind"]
          payload?: Json
          project_id?: string | null
          proposed_by?: string
          rationale?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["ai_builder_proposal_status"]
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_builder_proposals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_builder_proposals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_builder_proposals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_builder_proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_code_patterns: {
        Row: {
          code_snippet: string
          created_at: string | null
          description: string | null
          id: string
          pattern_type: string
          success_rate: number | null
          tags: string[] | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          code_snippet: string
          created_at?: string | null
          description?: string | null
          id?: string
          pattern_type: string
          success_rate?: number | null
          tags?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          code_snippet?: string
          created_at?: string | null
          description?: string | null
          id?: string
          pattern_type?: string
          success_rate?: number | null
          tags?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      ai_events: {
        Row: {
          business_id: string
          claimed_run_id: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          intent: string
          locked_at: string | null
          locked_by: string | null
          payload: Json
          plugin_instance_id: string | null
          processed_at: string | null
          status: Database["public"]["Enums"]["agent_event_status"]
        }
        Insert: {
          business_id: string
          claimed_run_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          intent: string
          locked_at?: string | null
          locked_by?: string | null
          payload?: Json
          plugin_instance_id?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["agent_event_status"]
        }
        Update: {
          business_id?: string
          claimed_run_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          intent?: string
          locked_at?: string | null
          locked_by?: string | null
          payload?: Json
          plugin_instance_id?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["agent_event_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ai_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_events_claimed_run_fk"
            columns: ["claimed_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_events_plugin_instance_id_fkey"
            columns: ["plugin_instance_id"]
            isOneToOne: false
            referencedRelation: "ai_plugin_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_learning_sessions: {
        Row: {
          ai_response: string
          code_generated: string | null
          created_at: string | null
          feedback_score: number | null
          id: string
          session_type: string
          technologies_used: string[] | null
          user_id: string | null
          user_prompt: string
          was_successful: boolean | null
        }
        Insert: {
          ai_response: string
          code_generated?: string | null
          created_at?: string | null
          feedback_score?: number | null
          id?: string
          session_type: string
          technologies_used?: string[] | null
          user_id?: string | null
          user_prompt: string
          was_successful?: boolean | null
        }
        Update: {
          ai_response?: string
          code_generated?: string | null
          created_at?: string | null
          feedback_score?: number | null
          id?: string
          session_type?: string
          technologies_used?: string[] | null
          user_id?: string | null
          user_prompt?: string
          was_successful?: boolean | null
        }
        Relationships: []
      }
      ai_plugin_instances: {
        Row: {
          agent_id: string
          business_id: string
          config: Json
          created_at: string
          id: string
          is_enabled: boolean
          placement_key: string
          project_id: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          business_id: string
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          placement_key?: string
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          business_id?: string
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          placement_key?: string
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_plugin_instances_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_plugin_instances_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_plugin_instances_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_plugin_instances_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_plugin_instances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_plugin_state: {
        Row: {
          created_at: string
          id: string
          plugin_instance_id: string
          state: Json
          state_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          plugin_instance_id: string
          state?: Json
          state_key?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          plugin_instance_id?: string
          state?: Json
          state_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_plugin_state_plugin_instance_id_fkey"
            columns: ["plugin_instance_id"]
            isOneToOne: false
            referencedRelation: "ai_plugin_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_request_logs: {
        Row: {
          completion_tokens: number | null
          created_at: string
          error_message: string | null
          id: string
          latency_ms: number | null
          model: string
          prompt_tokens: number | null
          provider: string
          status_code: number | null
          success: boolean
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          model: string
          prompt_tokens?: number | null
          provider: string
          status_code?: number | null
          success?: boolean
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          model?: string
          prompt_tokens?: number | null
          provider?: string
          status_code?: number | null
          success?: boolean
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_runs: {
        Row: {
          business_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          event_id: string | null
          id: string
          input_payload: Json
          latency_ms: number | null
          output_payload: Json | null
          plugin_instance_id: string | null
          status: Database["public"]["Enums"]["agent_event_status"]
          tokens_used: number | null
          tool_calls: Json | null
        }
        Insert: {
          business_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          input_payload?: Json
          latency_ms?: number | null
          output_payload?: Json | null
          plugin_instance_id?: string | null
          status?: Database["public"]["Enums"]["agent_event_status"]
          tokens_used?: number | null
          tool_calls?: Json | null
        }
        Update: {
          business_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          input_payload?: Json
          latency_ms?: number | null
          output_payload?: Json | null
          plugin_instance_id?: string | null
          status?: Database["public"]["Enums"]["agent_event_status"]
          tokens_used?: number | null
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ai_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_plugin_instance_id_fkey"
            columns: ["plugin_instance_id"]
            isOneToOne: false
            referencedRelation: "ai_plugin_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          business_id: string | null
          changes: Json | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          resource_id: string | null
          resource_name: string | null
          resource_type: string
          status: string
          user_agent: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          action: string
          business_id?: string | null
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_name?: string | null
          resource_type: string
          status?: string
          user_agent?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          action?: string
          business_id?: string | null
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_name?: string | null
          resource_type?: string
          status?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_events: {
        Row: {
          business_id: string
          created_at: string | null
          dedupe_key: string | null
          id: string
          intent: string
          payload: Json | null
          processed_at: string | null
          status: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          dedupe_key?: string | null
          id?: string
          intent: string
          payload?: Json | null
          processed_at?: string | null
          status?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          dedupe_key?: string | null
          id?: string
          intent?: string
          payload?: Json | null
          processed_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_recipe_packs: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          industry: string
          is_published: boolean | null
          name: string
          pack_id: string
          recipes: Json | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          industry: string
          is_published?: boolean | null
          name: string
          pack_id: string
          recipes?: Json | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          industry?: string
          is_published?: boolean | null
          name?: string
          pack_id?: string
          recipes?: Json | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      availability_slots: {
        Row: {
          business_id: string
          created_at: string
          ends_at: string
          id: string
          is_booked: boolean
          project_id: string | null
          service_id: string | null
          starts_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          ends_at: string
          id?: string
          is_booked?: boolean
          project_id?: string | null
          service_id?: string | null
          starts_at: string
        }
        Update: {
          business_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          is_booked?: boolean
          project_id?: string | null
          service_id?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_date: string
          booking_time: string
          business_id: string | null
          created_at: string | null
          customer_email: string
          customer_name: string
          customer_phone: string | null
          duration_minutes: number | null
          ends_at: string | null
          ghl_calendar_id: string | null
          ghl_contact_id: string | null
          id: string
          metadata: Json | null
          notes: string | null
          service_id: string | null
          service_name: string
          session_id: string | null
          starts_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          booking_date: string
          booking_time: string
          business_id?: string | null
          created_at?: string | null
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          ghl_calendar_id?: string | null
          ghl_contact_id?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          service_id?: string | null
          service_name: string
          session_id?: string | null
          starts_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          booking_date?: string
          booking_time?: string
          business_id?: string | null
          created_at?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          ghl_calendar_id?: string | null
          ghl_contact_id?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          service_id?: string | null
          service_name?: string
          session_id?: string | null
          starts_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_kits: {
        Row: {
          colors: Json | null
          created_at: string | null
          document_id: string
          fonts: string[] | null
          id: string
          logo_url: string | null
        }
        Insert: {
          colors?: Json | null
          created_at?: string | null
          document_id: string
          fonts?: string[] | null
          id?: string
          logo_url?: string | null
        }
        Update: {
          colors?: Json | null
          created_at?: string | null
          document_id?: string
          fonts?: string[] | null
          id?: string
          logo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_kits_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      builder_chat_history: {
        Row: {
          draft_id: string
          messages: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          draft_id: string
          messages?: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          draft_id?: string
          messages?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "builder_chat_history_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: true
            referencedRelation: "builder_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      builder_drafts: {
        Row: {
          business_id: string | null
          code: string
          created_at: string
          editor_code: string | null
          id: string
          last_revision_id: string | null
          metadata: Json | null
          name: string | null
          project_id: string | null
          site_id: string | null
          template_id: string | null
          updated_at: string
          user_id: string
          vfs_files: Json | null
        }
        Insert: {
          business_id?: string | null
          code: string
          created_at?: string
          editor_code?: string | null
          id?: string
          last_revision_id?: string | null
          metadata?: Json | null
          name?: string | null
          project_id?: string | null
          site_id?: string | null
          template_id?: string | null
          updated_at?: string
          user_id: string
          vfs_files?: Json | null
        }
        Update: {
          business_id?: string | null
          code?: string
          created_at?: string
          editor_code?: string | null
          id?: string
          last_revision_id?: string | null
          metadata?: Json | null
          name?: string | null
          project_id?: string | null
          site_id?: string | null
          template_id?: string | null
          updated_at?: string
          user_id?: string
          vfs_files?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "builder_drafts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builder_drafts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builder_drafts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builder_drafts_last_revision_id_fkey"
            columns: ["last_revision_id"]
            isOneToOne: false
            referencedRelation: "site_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builder_drafts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      builder_envelope_runs: {
        Row: {
          blocking_count: number
          business_id: string | null
          confidence: number | null
          created_at: string
          domains: string[]
          draft_id: string | null
          envelope: Json
          envelope_source: string | null
          id: string
          mode: string | null
          model_used: string | null
          out_of_scope_count: number
          outcome: string
          outcome_detail: Json | null
          project_id: string | null
          prompt: string | null
          provider_used: string | null
          repair_accepted: boolean
          repair_attempted: boolean
          request_kinds: string[]
          touched_files: string[]
          unmet_count: number
          updated_at: string
          user_id: string | null
          verification: Json
          verification_checked: boolean
          verification_passed: boolean | null
        }
        Insert: {
          blocking_count?: number
          business_id?: string | null
          confidence?: number | null
          created_at?: string
          domains?: string[]
          draft_id?: string | null
          envelope?: Json
          envelope_source?: string | null
          id?: string
          mode?: string | null
          model_used?: string | null
          out_of_scope_count?: number
          outcome?: string
          outcome_detail?: Json | null
          project_id?: string | null
          prompt?: string | null
          provider_used?: string | null
          repair_accepted?: boolean
          repair_attempted?: boolean
          request_kinds?: string[]
          touched_files?: string[]
          unmet_count?: number
          updated_at?: string
          user_id?: string | null
          verification?: Json
          verification_checked?: boolean
          verification_passed?: boolean | null
        }
        Update: {
          blocking_count?: number
          business_id?: string | null
          confidence?: number | null
          created_at?: string
          domains?: string[]
          draft_id?: string | null
          envelope?: Json
          envelope_source?: string | null
          id?: string
          mode?: string | null
          model_used?: string | null
          out_of_scope_count?: number
          outcome?: string
          outcome_detail?: Json | null
          project_id?: string | null
          prompt?: string | null
          provider_used?: string | null
          repair_accepted?: boolean
          repair_attempted?: boolean
          request_kinds?: string[]
          touched_files?: string[]
          unmet_count?: number
          updated_at?: string
          user_id?: string | null
          verification?: Json
          verification_checked?: boolean
          verification_passed?: boolean | null
        }
        Relationships: []
      }
      business_automation_settings: {
        Row: {
          automations_enabled: boolean | null
          business_days: number[] | null
          business_hours_enabled: boolean | null
          business_hours_end: string | null
          business_hours_start: string | null
          business_id: string
          created_at: string | null
          dedupe_window_minutes: number | null
          default_sender_email: string | null
          default_sender_name: string | null
          default_sender_phone: string | null
          honor_stop_keywords: boolean | null
          id: string
          max_messages_per_contact_per_day: number | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          require_consent_for_email: boolean | null
          require_consent_for_sms: boolean | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          automations_enabled?: boolean | null
          business_days?: number[] | null
          business_hours_enabled?: boolean | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          business_id: string
          created_at?: string | null
          dedupe_window_minutes?: number | null
          default_sender_email?: string | null
          default_sender_name?: string | null
          default_sender_phone?: string | null
          honor_stop_keywords?: boolean | null
          id?: string
          max_messages_per_contact_per_day?: number | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          require_consent_for_email?: boolean | null
          require_consent_for_sms?: boolean | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          automations_enabled?: boolean | null
          business_days?: number[] | null
          business_hours_enabled?: boolean | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          business_id?: string
          created_at?: string | null
          dedupe_window_minutes?: number | null
          default_sender_email?: string | null
          default_sender_name?: string | null
          default_sender_phone?: string | null
          honor_stop_keywords?: boolean | null
          id?: string
          max_messages_per_contact_per_day?: number | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          require_consent_for_email?: boolean | null
          require_consent_for_sms?: boolean | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_automation_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_automation_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_automation_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
        ]
      }
      business_design_preferences: {
        Row: {
          business_id: string
          created_at: string
          design_preset: string | null
          template_category: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          design_preset?: string | null
          template_category?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          design_preset?: string | null
          template_category?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      business_installs: {
        Row: {
          business_id: string
          id: string
          installed_at: string
          installed_by: string | null
          packs: string[]
          status: string
          system_type: string
        }
        Insert: {
          business_id: string
          id?: string
          installed_at?: string
          installed_by?: string | null
          packs?: string[]
          status?: string
          system_type: string
        }
        Update: {
          business_id?: string
          id?: string
          installed_at?: string
          installed_by?: string | null
          packs?: string[]
          status?: string
          system_type?: string
        }
        Relationships: []
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      business_recipe_toggles: {
        Row: {
          business_id: string
          custom_config: Json | null
          enabled: boolean | null
          id: string
          recipe_id: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          custom_config?: Json | null
          enabled?: boolean | null
          id?: string
          recipe_id: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          custom_config?: Json | null
          enabled?: boolean | null
          id?: string
          recipe_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_recipe_toggles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_recipe_toggles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_recipe_toggles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
        ]
      }
      business_setup_progress: {
        Row: {
          business_id: string
          completed_at: string | null
          config: Json
          created_at: string
          id: string
          status: string
          step_id: string
          updated_at: string
        }
        Insert: {
          business_id: string
          completed_at?: string | null
          config?: Json
          created_at?: string
          id?: string
          status?: string
          step_id: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          completed_at?: string | null
          config?: Json
          created_at?: string
          id?: string
          status?: string
          step_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_setup_progress_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_setup_progress_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_setup_progress_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: Json
          brand_color: string | null
          created_at: string
          description: string | null
          email: string | null
          hours: Json
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          notification_email: string | null
          notification_phone: string | null
          owner_id: string
          phone: string | null
          settings: Json
          slug: string | null
          social_links: Json
          tagline: string | null
          timezone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: Json
          brand_color?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          hours?: Json
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          notification_email?: string | null
          notification_phone?: string | null
          owner_id: string
          phone?: string | null
          settings?: Json
          slug?: string | null
          social_links?: Json
          tagline?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: Json
          brand_color?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          hours?: Json
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          notification_email?: string | null
          notification_phone?: string | null
          owner_id?: string
          phone?: string | null
          settings?: Json
          slug?: string | null
          social_links?: Json
          tagline?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          quantity: number
          session_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          session_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          session_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_collections: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          kind: string
          manual_item_ids: string[]
          name: string
          project_id: string | null
          rules: Json
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind: string
          manual_item_ids?: string[]
          name: string
          project_id?: string | null
          rules?: Json
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          manual_item_ids?: string[]
          name?: string
          project_id?: string | null
          rules?: Json
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_collections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_collections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_collections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_collections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          mode: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          component_data: Json | null
          content: string
          conversation_id: string
          created_at: string
          has_code: boolean | null
          id: string
          role: string
        }
        Insert: {
          component_data?: Json | null
          content: string
          conversation_id: string
          created_at?: string
          has_code?: boolean | null
          id?: string
          role: string
        }
        Update: {
          component_data?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string
          has_code?: boolean | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      clips: {
        Row: {
          clip_in: number
          clip_out: number
          created_at: string | null
          effects: Json | null
          id: string
          src: string
          timeline_start: number
          track_id: string
          transforms: Json | null
        }
        Insert: {
          clip_in?: number
          clip_out?: number
          created_at?: string | null
          effects?: Json | null
          id?: string
          src: string
          timeline_start?: number
          track_id: string
          transforms?: Json | null
        }
        Update: {
          clip_in?: number
          clip_out?: number
          created_at?: string | null
          effects?: Json | null
          id?: string
          src?: string
          timeline_start?: number
          track_id?: string
          transforms?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "clips_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          task_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          task_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          task_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_supabase_projects: {
        Row: {
          backend_manifest: Json
          business_id: string
          created_at: string
          health_status: Json
          id: string
          mode: string
          project_ref: string | null
          project_url: string | null
          provider: string
          provisioning_status: string
          publishable_key: string | null
          schema_version: number
          secret_key_ciphertext: string | null
          site_id: string | null
          unison_project_id: string
          updated_at: string
        }
        Insert: {
          backend_manifest?: Json
          business_id: string
          created_at?: string
          health_status?: Json
          id?: string
          mode?: string
          project_ref?: string | null
          project_url?: string | null
          provider?: string
          provisioning_status?: string
          publishable_key?: string | null
          schema_version?: number
          secret_key_ciphertext?: string | null
          site_id?: string | null
          unison_project_id: string
          updated_at?: string
        }
        Update: {
          backend_manifest?: Json
          business_id?: string
          created_at?: string
          health_status?: Json
          id?: string
          mode?: string
          project_ref?: string | null
          project_url?: string | null
          provider?: string
          provisioning_status?: string
          publishable_key?: string | null
          schema_version?: number
          secret_key_ciphertext?: string | null
          site_id?: string | null
          unison_project_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_entries: {
        Row: {
          archived_at: string | null
          business_id: string
          content_type_id: string
          created_at: string
          created_by: string | null
          data: Json
          id: string
          locale: string
          project_id: string | null
          published_at: string | null
          scheduled_publish_at: string | null
          site_id: string | null
          slug: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          business_id: string
          content_type_id: string
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          locale?: string
          project_id?: string | null
          published_at?: string | null
          scheduled_publish_at?: string | null
          site_id?: string | null
          slug?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          business_id?: string
          content_type_id?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          locale?: string
          project_id?: string | null
          published_at?: string | null
          scheduled_publish_at?: string | null
          site_id?: string | null
          slug?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_entries_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "content_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_entries_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      content_entry_revisions: {
        Row: {
          business_id: string
          change_summary: string | null
          created_at: string
          created_by: string | null
          entry_id: string
          id: string
          project_id: string | null
          revision_number: number
          snapshot: Json
        }
        Insert: {
          business_id: string
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          entry_id: string
          id?: string
          project_id?: string | null
          revision_number: number
          snapshot: Json
        }
        Update: {
          business_id?: string
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          entry_id?: string
          id?: string
          project_id?: string | null
          revision_number?: number
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "content_entry_revisions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_entry_revisions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_entry_revisions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_entry_revisions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "content_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      content_publish_events: {
        Row: {
          actor_id: string | null
          business_id: string
          created_at: string
          entry_id: string
          event_type: string
          id: string
          metadata: Json
          project_id: string | null
          revision_id: string | null
        }
        Insert: {
          actor_id?: string | null
          business_id: string
          created_at?: string
          entry_id: string
          event_type: string
          id?: string
          metadata?: Json
          project_id?: string | null
          revision_id?: string | null
        }
        Update: {
          actor_id?: string | null
          business_id?: string
          created_at?: string
          entry_id?: string
          event_type?: string
          id?: string
          metadata?: Json
          project_id?: string | null
          revision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_publish_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_publish_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_publish_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_publish_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "content_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_publish_events_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "content_entry_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      content_types: {
        Row: {
          api_key: string
          business_id: string
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          field_schema: Json
          id: string
          project_id: string | null
          updated_at: string
          updated_by: string | null
          workflow: Json
        }
        Insert: {
          api_key: string
          business_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name: string
          field_schema?: Json
          id?: string
          project_id?: string | null
          updated_at?: string
          updated_by?: string | null
          workflow?: Json
        }
        Update: {
          api_key?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string
          field_schema?: Json
          id?: string
          project_id?: string | null
          updated_at?: string
          updated_by?: string | null
          workflow?: Json
        }
        Relationships: [
          {
            foreignKeyName: "content_types_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_types_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_types_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_type: string
          business_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          description: string | null
          id: string
          lead_id: string | null
          metadata: Json
          scheduled_at: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          activity_type: string
          business_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json
          scheduled_at?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          business_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json
          scheduled_at?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_automations: {
        Row: {
          actions: Json | null
          business_id: string | null
          conditions: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          project_id: string | null
          trigger_event: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          actions?: Json | null
          business_id?: string | null
          conditions?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          project_id?: string | null
          trigger_event: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          actions?: Json | null
          business_id?: string | null
          conditions?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          project_id?: string | null
          trigger_event?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_automations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          company: string | null
          created_at: string | null
          custom_fields: Json | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          source: string | null
          tags: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          source?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          source?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      crm_deals: {
        Row: {
          contact_id: string | null
          created_at: string | null
          expected_close_date: string | null
          id: string
          lead_id: string | null
          stage: string | null
          title: string
          updated_at: string | null
          user_id: string | null
          value: number | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          stage?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
          value?: number | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          stage?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_email_templates: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string | null
          id: string
          name: string
          subject: string
          updated_at: string | null
          user_id: string | null
          variables: string[] | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          id?: string
          name: string
          subject: string
          updated_at?: string | null
          user_id?: string | null
          variables?: string[] | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          id?: string
          name?: string
          subject?: string
          updated_at?: string | null
          user_id?: string | null
          variables?: string[] | null
        }
        Relationships: []
      }
      crm_form_submissions: {
        Row: {
          created_at: string | null
          data: Json
          form_id: string
          form_name: string | null
          id: string
          ip_address: string | null
          source_url: string | null
          user_agent: string | null
          workflow_triggered: boolean | null
        }
        Insert: {
          created_at?: string | null
          data?: Json
          form_id: string
          form_name?: string | null
          id?: string
          ip_address?: string | null
          source_url?: string | null
          user_agent?: string | null
          workflow_triggered?: boolean | null
        }
        Update: {
          created_at?: string | null
          data?: Json
          form_id?: string
          form_name?: string | null
          id?: string
          ip_address?: string | null
          source_url?: string | null
          user_agent?: string | null
          workflow_triggered?: boolean | null
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          business_id: string | null
          contact_id: string | null
          created_at: string | null
          email: string | null
          id: string
          intent: string | null
          metadata: Json
          name: string | null
          notes: string | null
          source: string | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string | null
          value: number | null
        }
        Insert: {
          business_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          intent?: string | null
          metadata?: Json
          name?: string | null
          notes?: string | null
          source?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
          value?: number | null
        }
        Update: {
          business_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          intent?: string | null
          metadata?: Json
          name?: string | null
          notes?: string | null
          source?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_workflow_jobs: {
        Row: {
          action_config: Json | null
          action_type: string
          created_at: string | null
          error_message: string | null
          id: string
          processed_at: string | null
          result: Json | null
          retry_count: number | null
          scheduled_at: string | null
          status: string | null
          step_index: number
          workflow_run_id: string | null
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          result?: Json | null
          retry_count?: number | null
          scheduled_at?: string | null
          status?: string | null
          step_index?: number
          workflow_run_id?: string | null
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          result?: Json | null
          retry_count?: number | null
          scheduled_at?: string | null
          status?: string | null
          step_index?: number
          workflow_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_workflow_jobs_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "crm_workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_workflow_runs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          result: Json | null
          started_at: string | null
          status: string | null
          trigger_data: Json | null
          workflow_id: string | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          result?: Json | null
          started_at?: string | null
          status?: string | null
          trigger_data?: Json | null
          workflow_id?: string | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          result?: Json | null
          started_at?: string | null
          status?: string | null
          trigger_data?: Json | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "crm_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_workflows: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          steps: Json | null
          trigger_config: Json | null
          trigger_type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          steps?: Json | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          steps?: Json | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      design_templates: {
        Row: {
          canvas_data: Json
          created_at: string
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          canvas_data: Json
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          canvas_data?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_history: {
        Row: {
          created_at: string | null
          created_by: string
          document_id: string
          id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string | null
          created_by: string
          document_id: string
          id?: string
          snapshot: Json
        }
        Update: {
          created_at?: string | null
          created_by?: string
          document_id?: string
          id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "document_history_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string | null
          id: string
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      featured_offers: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          cta_href: string | null
          cta_intent: string | null
          cta_label: string | null
          description: string | null
          discount_label: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          metadata: Json
          project_id: string | null
          sort_order: number
          starts_at: string | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          cta_href?: string | null
          cta_intent?: string | null
          cta_label?: string | null
          description?: string | null
          discount_label?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json
          project_id?: string | null
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          cta_href?: string | null
          cta_intent?: string | null
          cta_label?: string | null
          description?: string | null
          discount_label?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json
          project_id?: string | null
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_offers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_offers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_offers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
        ]
      }
      file_access_tokens: {
        Row: {
          created_at: string | null
          expires_at: string | null
          file_id: string | null
          id: string
          session_id: string
          token: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          file_id?: string | null
          id?: string
          session_id: string
          token?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          file_id?: string | null
          id?: string
          session_id?: string
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_access_tokens_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      file_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      file_versions: {
        Row: {
          created_at: string | null
          created_by: string
          file_id: string
          id: string
          size: number
          storage_path: string
          version_number: number
        }
        Insert: {
          created_at?: string | null
          created_by: string
          file_id: string
          id?: string
          size: number
          storage_path: string
          version_number: number
        }
        Update: {
          created_at?: string | null
          created_by?: string
          file_id?: string
          id?: string
          size?: number
          storage_path?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "file_versions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string | null
          folder_path: string | null
          id: string
          is_favorite: boolean | null
          mime_type: string
          name: string
          size: number
          storage_path: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          folder_path?: string | null
          id?: string
          is_favorite?: boolean | null
          mime_type: string
          name: string
          size: number
          storage_path: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          folder_path?: string | null
          id?: string
          is_favorite?: boolean | null
          mime_type?: string
          name?: string
          size?: number
          storage_path?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      form_definitions: {
        Row: {
          business_id: string
          created_at: string
          destination: Json
          external_id: string
          fields: Json
          id: string
          intent: string
          is_active: boolean
          name: string
          project_id: string | null
          site_id: string | null
          success_behavior: Json
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          destination?: Json
          external_id: string
          fields?: Json
          id?: string
          intent: string
          is_active?: boolean
          name: string
          project_id?: string | null
          site_id?: string | null
          success_behavior?: Json
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          destination?: Json
          external_id?: string
          fields?: Json
          id?: string
          intent?: string
          is_active?: boolean
          name?: string
          project_id?: string | null
          site_id?: string | null
          success_behavior?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_definitions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_definitions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_definitions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_definitions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_pages: {
        Row: {
          created_at: string | null
          html_content: string | null
          id: string
          prompt: string
          schema: Json
          theme_tokens: Json | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          html_content?: string | null
          id?: string
          prompt: string
          schema: Json
          theme_tokens?: Json | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          html_content?: string | null
          id?: string
          prompt?: string
          schema?: Json
          theme_tokens?: Json | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ghl_event_reactions: {
        Row: {
          action_config: Json
          action_type: string
          business_id: string
          created_at: string
          created_by: string | null
          enabled: boolean
          event_type: string
          id: string
          last_triggered_at: string | null
          name: string
          pipeline_filter: string | null
          project_id: string | null
          stage_filter: string | null
          trigger_count: number
          updated_at: string
          workflow_filter: string | null
        }
        Insert: {
          action_config?: Json
          action_type: string
          business_id: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          event_type: string
          id?: string
          last_triggered_at?: string | null
          name: string
          pipeline_filter?: string | null
          project_id?: string | null
          stage_filter?: string | null
          trigger_count?: number
          updated_at?: string
          workflow_filter?: string | null
        }
        Update: {
          action_config?: Json
          action_type?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          event_type?: string
          id?: string
          last_triggered_at?: string | null
          name?: string
          pipeline_filter?: string | null
          project_id?: string | null
          stage_filter?: string | null
          trigger_count?: number
          updated_at?: string
          workflow_filter?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ghl_event_reactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_event_reactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_event_reactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_event_reactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_webhook_events: {
        Row: {
          business_id: string | null
          contact_id: string | null
          created_at: string
          event_type: string
          headers: Json
          id: string
          location_id: string | null
          opportunity_id: string | null
          payload: Json
          pipeline_id: string | null
          previous_stage_id: string | null
          process_error: string | null
          processed: boolean
          processed_at: string | null
          project_id: string | null
          signature: string | null
          stage_id: string | null
          workflow_id: string | null
        }
        Insert: {
          business_id?: string | null
          contact_id?: string | null
          created_at?: string
          event_type: string
          headers?: Json
          id?: string
          location_id?: string | null
          opportunity_id?: string | null
          payload?: Json
          pipeline_id?: string | null
          previous_stage_id?: string | null
          process_error?: string | null
          processed?: boolean
          processed_at?: string | null
          project_id?: string | null
          signature?: string | null
          stage_id?: string | null
          workflow_id?: string | null
        }
        Update: {
          business_id?: string | null
          contact_id?: string | null
          created_at?: string
          event_type?: string
          headers?: Json
          id?: string
          location_id?: string | null
          opportunity_id?: string | null
          payload?: Json
          pipeline_id?: string | null
          previous_stage_id?: string | null
          process_error?: string | null
          processed?: boolean
          processed_at?: string | null
          project_id?: string | null
          signature?: string | null
          stage_id?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ghl_webhook_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_webhook_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_webhook_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_webhook_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      image_slot_events: {
        Row: {
          business_id: string | null
          created_at: string
          id: string
          new_src: string | null
          old_src: string | null
          section: string | null
          slot_id: string
          slot_type: string | null
          user_id: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          id?: string
          new_src?: string | null
          old_src?: string | null
          section?: string | null
          slot_id: string
          slot_type?: string | null
          user_id?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          id?: string
          new_src?: string | null
          old_src?: string | null
          section?: string | null
          slot_id?: string
          slot_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "image_slot_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_slot_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_slot_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
        ]
      }
      installed_recipe_packs: {
        Row: {
          business_id: string
          enabled: boolean | null
          id: string
          installed_at: string | null
          pack_id: string
        }
        Insert: {
          business_id: string
          enabled?: boolean | null
          id?: string
          installed_at?: string | null
          pack_id: string
        }
        Update: {
          business_id?: string
          enabled?: boolean | null
          id?: string
          installed_at?: string | null
          pack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installed_recipe_packs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installed_recipe_packs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installed_recipe_packs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installed_recipe_packs_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "automation_recipe_packs"
            referencedColumns: ["pack_id"]
          },
        ]
      }
      intent_bindings: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          handler: string
          id: string
          intent: string
          payload_defaults: Json
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          handler: string
          id?: string
          intent: string
          payload_defaults?: Json
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          handler?: string
          id?: string
          intent?: string
          payload_defaults?: Json
        }
        Relationships: []
      }
      intent_execution_log: {
        Row: {
          binding_id: string | null
          business_id: string
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          intent: string
          payload: Json
          project_id: string | null
          recipes_triggered: string[]
          result_data: Json
          result_status: string
          source: string
          source_url: string | null
          workflows_triggered: string[]
        }
        Insert: {
          binding_id?: string | null
          business_id: string
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          intent: string
          payload?: Json
          project_id?: string | null
          recipes_triggered?: string[]
          result_data?: Json
          result_status?: string
          source?: string
          source_url?: string | null
          workflows_triggered?: string[]
        }
        Update: {
          binding_id?: string | null
          business_id?: string
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          intent?: string
          payload?: Json
          project_id?: string | null
          recipes_triggered?: string[]
          result_data?: Json
          result_status?: string
          source?: string
          source_url?: string | null
          workflows_triggered?: string[]
        }
        Relationships: []
      }
      layers: {
        Row: {
          adjustments: Json | null
          blend: Database["public"]["Enums"]["blend_mode"]
          created_at: string | null
          id: string
          kind: Database["public"]["Enums"]["layer_kind"]
          locked: boolean
          masks: Json | null
          opacity: number
          page_id: string
          payload: Json
          sort_order: number
          transform: Json
          visible: boolean
        }
        Insert: {
          adjustments?: Json | null
          blend?: Database["public"]["Enums"]["blend_mode"]
          created_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["layer_kind"]
          locked?: boolean
          masks?: Json | null
          opacity?: number
          page_id: string
          payload?: Json
          sort_order?: number
          transform?: Json
          visible?: boolean
        }
        Update: {
          adjustments?: Json | null
          blend?: Database["public"]["Enums"]["blend_mode"]
          created_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["layer_kind"]
          locked?: boolean
          masks?: Json | null
          opacity?: number
          page_id?: string
          payload?: Json
          sort_order?: number
          transform?: Json
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "layers_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          business_id: string
          created_at: string
          email: string
          id: string
          message: string | null
          metadata: Json | null
          name: string | null
          phone: string | null
          source: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          metadata?: Json | null
          name?: string | null
          phone?: string | null
          source?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          name?: string | null
          phone?: string | null
          source?: string | null
        }
        Relationships: []
      }
      lucide_icon_registry: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          industry_relevance: string[] | null
          name: string
          subcategory: string | null
          tags: string[] | null
          use_cases: string[] | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          industry_relevance?: string[] | null
          name: string
          subcategory?: string | null
          tags?: string[] | null
          use_cases?: string[] | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          industry_relevance?: string[] | null
          name?: string
          subcategory?: string | null
          tags?: string[] | null
          use_cases?: string[] | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          available: boolean
          business_id: string
          category: string | null
          created_at: string
          currency: string
          description: string | null
          dietary_tags: string[]
          featured: boolean
          id: string
          image_url: string | null
          metadata: Json
          name: string
          price_cents: number
          project_id: string | null
          slug: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          available?: boolean
          business_id: string
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          dietary_tags?: string[]
          featured?: boolean
          id?: string
          image_url?: string | null
          metadata?: Json
          name: string
          price_cents?: number
          project_id?: string | null
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          available?: boolean
          business_id?: string
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          dietary_tags?: string[]
          featured?: boolean
          id?: string
          image_url?: string | null
          metadata?: Json
          name?: string
          price_cents?: number
          project_id?: string | null
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_state: {
        Row: {
          business_name: string | null
          completed: boolean
          created_at: string
          current_step: string | null
          industry: string | null
          project_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name?: string | null
          completed?: boolean
          created_at?: string
          current_step?: string | null
          industry?: string | null
          project_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string | null
          completed?: boolean
          created_at?: string
          current_step?: string | null
          industry?: string | null
          project_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          business_id: string | null
          created_at: string | null
          currency: string | null
          customer_email: string
          customer_name: string | null
          id: string
          items: Json
          metadata: Json | null
          payment_intent_id: string | null
          payment_method: string | null
          session_id: string | null
          shipping_address: Json | null
          status: string | null
          subtotal: number
          tax: number | null
          total: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email: string
          customer_name?: string | null
          id?: string
          items: Json
          metadata?: Json | null
          payment_intent_id?: string | null
          payment_method?: string | null
          session_id?: string | null
          shipping_address?: Json | null
          status?: string | null
          subtotal: number
          tax?: number | null
          total: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string
          customer_name?: string | null
          id?: string
          items?: Json
          metadata?: Json | null
          payment_intent_id?: string | null
          payment_method?: string | null
          session_id?: string | null
          shipping_address?: Json | null
          status?: string | null
          subtotal?: number
          tax?: number | null
          total?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      page_graphs: {
        Row: {
          business_id: string
          created_at: string
          id: string
          nav_index: Json
          pages: Json
          project_id: string
          updated_at: string
          version: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          nav_index?: Json
          pages?: Json
          project_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          nav_index?: Json
          pages?: Json
          project_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      page_sections: {
        Row: {
          created_at: string | null
          id: string
          page_id: string | null
          schema: Json
          section_type: string
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          page_id?: string | null
          schema: Json
          section_type: string
          sort_order?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          page_id?: string | null
          schema?: Json
          section_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "page_sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "generated_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          background: Json | null
          created_at: string | null
          document_id: string
          height: number
          id: string
          sort_order: number
          width: number
        }
        Insert: {
          background?: Json | null
          created_at?: string | null
          document_id: string
          height?: number
          id?: string
          sort_order?: number
          width?: number
        }
        Update: {
          background?: Json | null
          created_at?: string | null
          document_id?: string
          height?: number
          id?: string
          sort_order?: number
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "pages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_projects: {
        Row: {
          business_id: string
          client_name: string | null
          completed_at: string | null
          cover_image_url: string | null
          created_at: string
          external_url: string | null
          featured: boolean
          gallery: Json
          id: string
          metadata: Json
          project_id: string | null
          sort_order: number
          subtitle: string | null
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          business_id: string
          client_name?: string | null
          completed_at?: string | null
          cover_image_url?: string | null
          created_at?: string
          external_url?: string | null
          featured?: boolean
          gallery?: Json
          id?: string
          metadata?: Json
          project_id?: string | null
          sort_order?: number
          subtitle?: string | null
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          client_name?: string | null
          completed_at?: string | null
          cover_image_url?: string | null
          created_at?: string
          external_url?: string | null
          featured?: boolean
          gallery?: Json
          id?: string
          metadata?: Json
          project_id?: string | null
          sort_order?: number
          subtitle?: string | null
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_projects_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_projects_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_projects_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_plans: {
        Row: {
          billing_interval: string | null
          business_id: string
          created_at: string
          cta_intent: string | null
          currency: string
          description: string | null
          features: Json
          highlighted: boolean
          id: string
          is_active: boolean
          metadata: Json
          name: string
          price_cents: number
          project_id: string | null
          slug: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          billing_interval?: string | null
          business_id: string
          created_at?: string
          cta_intent?: string | null
          currency?: string
          description?: string | null
          features?: Json
          highlighted?: boolean
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          price_cents?: number
          project_id?: string | null
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          billing_interval?: string | null
          business_id?: string
          created_at?: string
          cta_intent?: string | null
          currency?: string
          description?: string | null
          features?: Json
          highlighted?: boolean
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          price_cents?: number
          project_id?: string | null
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_plans_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_plans_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_plans_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          business_id: string | null
          category: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          featured: boolean
          id: string
          image_url: string | null
          inventory_count: number | null
          is_active: boolean | null
          metadata: Json | null
          name: string
          price: number
          project_id: string | null
          slug: string | null
          sort_order: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          business_id?: string | null
          category?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          inventory_count?: number | null
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          price: number
          project_id?: string | null
          slug?: string | null
          sort_order?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          business_id?: string | null
          category?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          inventory_count?: number | null
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          price?: number
          project_id?: string | null
          slug?: string | null
          sort_order?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string | null
          id: string
          project_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_page_seo: {
        Row: {
          canonical_url: string | null
          created_at: string
          description: string | null
          id: string
          json_ld_data: Json | null
          json_ld_type: string | null
          keywords: string[] | null
          no_index: boolean | null
          og_description: string | null
          og_image_url: string | null
          og_title: string | null
          page_key: string
          project_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          json_ld_data?: Json | null
          json_ld_type?: string | null
          keywords?: string[] | null
          no_index?: boolean | null
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          page_key: string
          project_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          json_ld_data?: Json | null
          json_ld_type?: string | null
          keywords?: string[] | null
          no_index?: boolean | null
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          page_key?: string
          project_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_seo: {
        Row: {
          business_id: string
          canonical_base_url: string | null
          created_at: string
          facebook_app_id: string | null
          favicon_url: string | null
          generate_sitemap: boolean | null
          id: string
          json_ld_data: Json | null
          json_ld_type: string | null
          og_image_url: string | null
          project_id: string
          robots_txt: string | null
          site_description: string
          site_keywords: string[] | null
          site_title: string
          twitter_handle: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          canonical_base_url?: string | null
          created_at?: string
          facebook_app_id?: string | null
          favicon_url?: string | null
          generate_sitemap?: boolean | null
          id?: string
          json_ld_data?: Json | null
          json_ld_type?: string | null
          og_image_url?: string | null
          project_id: string
          robots_txt?: string | null
          site_description?: string
          site_keywords?: string[] | null
          site_title?: string
          twitter_handle?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          canonical_base_url?: string | null
          created_at?: string
          facebook_app_id?: string | null
          favicon_url?: string | null
          generate_sitemap?: boolean | null
          id?: string
          json_ld_data?: Json | null
          json_ld_type?: string | null
          og_image_url?: string | null
          project_id?: string
          robots_txt?: string | null
          site_description?: string
          site_keywords?: string[] | null
          site_title?: string
          twitter_handle?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          active_published_revision_id: string | null
          business_id: string | null
          created_at: string | null
          custom_domain: string | null
          description: string | null
          id: string
          name: string
          owner_id: string
          publish_status: string
          published_at: string | null
          settings: Json
          site_id: string | null
          slug: string | null
          status: string
          template_type: string | null
          updated_at: string | null
        }
        Insert: {
          active_published_revision_id?: string | null
          business_id?: string | null
          created_at?: string | null
          custom_domain?: string | null
          description?: string | null
          id?: string
          name: string
          owner_id: string
          publish_status?: string
          published_at?: string | null
          settings?: Json
          site_id?: string | null
          slug?: string | null
          status?: string
          template_type?: string | null
          updated_at?: string | null
        }
        Update: {
          active_published_revision_id?: string | null
          business_id?: string | null
          created_at?: string | null
          custom_domain?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          publish_status?: string
          published_at?: string | null
          settings?: Json
          site_id?: string | null
          slug?: string | null
          status?: string
          template_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_active_published_revision_id_fkey"
            columns: ["active_published_revision_id"]
            isOneToOne: false
            referencedRelation: "site_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          business_id: string | null
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          risk_level: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          risk_level?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          risk_level?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          business_id: string
          category: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          featured: boolean
          id: string
          image_url: string | null
          is_active: boolean
          metadata: Json
          name: string
          price_cents: number | null
          project_id: string | null
          slug: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          business_id: string
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          featured?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          metadata?: Json
          name: string
          price_cents?: number | null
          project_id?: string | null
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          featured?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          metadata?: Json
          name?: string
          price_cents?: number | null
          project_id?: string | null
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      shared_files: {
        Row: {
          created_at: string | null
          expires_at: string | null
          file_id: string
          id: string
          is_public: boolean | null
          permission: string
          public_token: string | null
          shared_by: string
          shared_with: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          file_id: string
          id?: string
          is_public?: boolean | null
          permission?: string
          public_token?: string | null
          shared_by: string
          shared_with?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          file_id?: string
          id?: string
          is_public?: boolean | null
          permission?: string
          public_token?: string | null
          shared_by?: string
          shared_with?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      site_builds: {
        Row: {
          context: Json
          created_at: string
          current_stage: string | null
          finished_at: string | null
          id: string
          mode: string
          site_id: string
          started_at: string | null
          status: string
          version: number
        }
        Insert: {
          context?: Json
          created_at?: string
          current_stage?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          site_id: string
          started_at?: string | null
          status?: string
          version?: number
        }
        Update: {
          context?: Json
          created_at?: string
          current_stage?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          site_id?: string
          started_at?: string | null
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_builds_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_bundles: {
        Row: {
          build_id: string | null
          bundle: Json
          created_at: string
          id: string
          revision_id: string | null
          schema_version: number
          site_id: string
          version: string
        }
        Insert: {
          build_id?: string | null
          bundle?: Json
          created_at?: string
          id?: string
          revision_id?: string | null
          schema_version?: number
          site_id: string
          version?: string
        }
        Update: {
          build_id?: string | null
          bundle?: Json
          created_at?: string
          id?: string
          revision_id?: string | null
          schema_version?: number
          site_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_bundles_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "site_builds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_bundles_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "site_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_bundles_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_capabilities: {
        Row: {
          capability_id: string
          created_at: string
          enabled_by: string | null
          site_id: string
          status: string
        }
        Insert: {
          capability_id: string
          created_at?: string
          enabled_by?: string | null
          site_id: string
          status?: string
        }
        Update: {
          capability_id?: string
          created_at?: string
          enabled_by?: string | null
          site_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_capabilities_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_data_bindings: {
        Row: {
          binding_type: string
          business_id: string
          collection_id: string | null
          created_at: string
          display_mapping: Json
          fallback_mode: string
          filters: Json
          id: string
          limit_count: number | null
          page_path: string
          project_id: string
          section_id: string
          slot_key: string | null
          snapshot_id: string | null
          sort: Json
          source_kind: string
          source_table: string
          updated_at: string
        }
        Insert: {
          binding_type?: string
          business_id: string
          collection_id?: string | null
          created_at?: string
          display_mapping?: Json
          fallback_mode?: string
          filters?: Json
          id?: string
          limit_count?: number | null
          page_path: string
          project_id: string
          section_id: string
          slot_key?: string | null
          snapshot_id?: string | null
          sort?: Json
          source_kind: string
          source_table: string
          updated_at?: string
        }
        Update: {
          binding_type?: string
          business_id?: string
          collection_id?: string | null
          created_at?: string
          display_mapping?: Json
          fallback_mode?: string
          filters?: Json
          id?: string
          limit_count?: number | null
          page_path?: string
          project_id?: string
          section_id?: string
          slot_key?: string | null
          snapshot_id?: string | null
          sort?: Json
          source_kind?: string
          source_table?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_data_bindings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_data_bindings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_data_bindings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_data_bindings_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "catalog_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_data_bindings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_intent_bindings: {
        Row: {
          business_id: string
          created_at: string
          element_key: string
          element_label: string | null
          enabled: boolean
          id: string
          intent: string
          intent_confidence: number
          last_triggered_at: string | null
          page_path: string
          payload_schema: Json
          project_id: string
          recipe_ids: string[]
          trigger_count: number
          updated_at: string
          workflow_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          element_key: string
          element_label?: string | null
          enabled?: boolean
          id?: string
          intent: string
          intent_confidence?: number
          last_triggered_at?: string | null
          page_path?: string
          payload_schema?: Json
          project_id: string
          recipe_ids?: string[]
          trigger_count?: number
          updated_at?: string
          workflow_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          element_key?: string
          element_label?: string | null
          enabled?: boolean
          id?: string
          intent?: string
          intent_confidence?: number
          last_triggered_at?: string | null
          page_path?: string
          payload_schema?: Json
          project_id?: string
          recipe_ids?: string[]
          trigger_count?: number
          updated_at?: string
          workflow_id?: string | null
        }
        Relationships: []
      }
      site_profiles: {
        Row: {
          business_id: string
          overrides: Json
          project_id: string
          updated_at: string
        }
        Insert: {
          business_id: string
          overrides?: Json
          project_id: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          overrides?: Json
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_profiles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_revisions: {
        Row: {
          backend_ops_applied: Json
          business_id: string
          created_at: string
          created_by: string
          diagnostics: Json
          draft_id: string
          id: string
          parent_revision_id: string | null
          patch_json: Json
          playground_state: Json
          project_id: string
          publish_blockers: Json
          publish_ready: boolean
          readiness_report: Json
          runtime_manifest: Json
          site_bundle_snapshot: Json
          source: string
          status: string
          vfs_files: Json
          vfs_hash: string | null
        }
        Insert: {
          backend_ops_applied?: Json
          business_id: string
          created_at?: string
          created_by: string
          diagnostics?: Json
          draft_id: string
          id?: string
          parent_revision_id?: string | null
          patch_json?: Json
          playground_state?: Json
          project_id: string
          publish_blockers?: Json
          publish_ready?: boolean
          readiness_report?: Json
          runtime_manifest?: Json
          site_bundle_snapshot?: Json
          source: string
          status?: string
          vfs_files?: Json
          vfs_hash?: string | null
        }
        Update: {
          backend_ops_applied?: Json
          business_id?: string
          created_at?: string
          created_by?: string
          diagnostics?: Json
          draft_id?: string
          id?: string
          parent_revision_id?: string | null
          patch_json?: Json
          playground_state?: Json
          project_id?: string
          publish_blockers?: Json
          publish_ready?: boolean
          readiness_report?: Json
          runtime_manifest?: Json
          site_bundle_snapshot?: Json
          source?: string
          status?: string
          vfs_files?: Json
          vfs_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_revisions_parent_revision_id_fkey"
            columns: ["parent_revision_id"]
            isOneToOne: false
            referencedRelation: "site_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      site_runtime_configs: {
        Row: {
          api_version: string
          attribution_required: boolean
          created_at: string
          external_deploy_allowed: boolean
          public_runtime_enabled: boolean
          settings: Json
          site_id: string
          updated_at: string
        }
        Insert: {
          api_version?: string
          attribution_required?: boolean
          created_at?: string
          external_deploy_allowed?: boolean
          public_runtime_enabled?: boolean
          settings?: Json
          site_id: string
          updated_at?: string
        }
        Update: {
          api_version?: string
          attribution_required?: boolean
          created_at?: string
          external_deploy_allowed?: boolean
          public_runtime_enabled?: boolean
          settings?: Json
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_runtime_configs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          business_id: string
          created_at: string
          current_build_id: string | null
          id: string
          name: string
          owner_user_id: string
          settings: Json
          slug: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          current_build_id?: string | null
          id?: string
          name: string
          owner_user_id: string
          settings?: Json
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          current_build_id?: string | null
          id?: string
          name?: string
          owner_user_id?: string
          settings?: Json
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
        ]
      }
      system_packs: {
        Row: {
          created_at: string
          id: string
          manifest: Json
          name: string
          required_intents: string[]
          version: string
        }
        Insert: {
          created_at?: string
          id: string
          manifest?: Json
          name: string
          required_intents?: string[]
          version?: string
        }
        Update: {
          created_at?: string
          id?: string
          manifest?: Json
          name?: string
          required_intents?: string[]
          version?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          business_id: string | null
          created_at: string | null
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          metadata: Json
          priority: string | null
          project_id: string
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          business_id?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json
          priority?: string | null
          project_id: string
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          business_id?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json
          priority?: string | null
          project_id?: string
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      template_versions: {
        Row: {
          canvas_data: Json
          created_at: string
          created_by: string
          id: string
          template_id: string
          version_number: number
        }
        Insert: {
          canvas_data: Json
          created_at?: string
          created_by: string
          id?: string
          template_id: string
          version_number: number
        }
        Update: {
          canvas_data?: Json
          created_at?: string
          created_by?: string
          id?: string
          template_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "design_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          author_avatar_url: string | null
          author_name: string
          author_role: string | null
          business_id: string
          created_at: string
          featured: boolean
          id: string
          metadata: Json
          project_id: string | null
          quote: string
          rating: number | null
          sort_order: number
          source: string | null
          updated_at: string
        }
        Insert: {
          author_avatar_url?: string | null
          author_name: string
          author_role?: string | null
          business_id: string
          created_at?: string
          featured?: boolean
          id?: string
          metadata?: Json
          project_id?: string | null
          quote: string
          rating?: number | null
          sort_order?: number
          source?: string | null
          updated_at?: string
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string
          author_role?: string | null
          business_id?: string
          created_at?: string
          featured?: boolean
          id?: string
          metadata?: Json
          project_id?: string | null
          quote?: string
          rating?: number | null
          sort_order?: number
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonials_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonials_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
        ]
      }
      timelines: {
        Row: {
          created_at: string | null
          document_id: string
          duration: number
          fps: number
          id: string
        }
        Insert: {
          created_at?: string | null
          document_id: string
          duration?: number
          fps?: number
          id?: string
        }
        Update: {
          created_at?: string | null
          document_id?: string
          duration?: number
          fps?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timelines_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          created_at: string | null
          id: string
          sort_order: number
          timeline_id: string
          type: Database["public"]["Enums"]["track_type"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          sort_order?: number
          timeline_id: string
          type: Database["public"]["Enums"]["track_type"]
        }
        Update: {
          created_at?: string | null
          id?: string
          sort_order?: number
          timeline_id?: string
          type?: Database["public"]["Enums"]["track_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tracks_timeline_id_fkey"
            columns: ["timeline_id"]
            isOneToOne: false
            referencedRelation: "timelines"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          business_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          resource_id: string | null
          resource_type: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
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
      user_subscriptions: {
        Row: {
          ai_generations_reset_at: string | null
          ai_generations_used: number | null
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          projects_count: number | null
          status: string
          storage_used_mb: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          team_members_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_generations_reset_at?: string | null
          ai_generations_used?: number | null
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          projects_count?: number | null
          status?: string
          storage_used_mb?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          team_members_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_generations_reset_at?: string | null
          ai_generations_used?: number | null
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          projects_count?: number | null
          status?: string
          storage_used_mb?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          team_members_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vfs_snapshots: {
        Row: {
          business_id: string | null
          created_at: string
          files: Json
          id: string
          label: string
          metadata: Json | null
          project_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          files?: Json
          id?: string
          label?: string
          metadata?: Json | null
          project_id?: string | null
          source?: string
          user_id: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          files?: Json
          id?: string
          label?: string
          metadata?: Json | null
          project_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vfs_snapshots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vfs_snapshots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vfs_snapshots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vfs_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      business_storefronts: {
        Row: {
          brand_color: string | null
          description: string | null
          hours: Json | null
          id: string | null
          industry: string | null
          logo_url: string | null
          name: string | null
          slug: string | null
          tagline: string | null
          website: string | null
        }
        Insert: {
          brand_color?: string | null
          description?: string | null
          hours?: Json | null
          id?: string | null
          industry?: string | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          tagline?: string | null
          website?: string | null
        }
        Update: {
          brand_color?: string | null
          description?: string | null
          hours?: Json | null
          id?: string | null
          industry?: string | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          tagline?: string | null
          website?: string | null
        }
        Relationships: []
      }
      businesses_public: {
        Row: {
          address: Json | null
          brand_color: string | null
          description: string | null
          hours: Json | null
          id: string | null
          industry: string | null
          logo_url: string | null
          name: string | null
          slug: string | null
          social_links: Json | null
          tagline: string | null
          timezone: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: Json | null
          brand_color?: string | null
          description?: string | null
          hours?: Json | null
          id?: string | null
          industry?: string | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          social_links?: Json | null
          tagline?: string | null
          timezone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: Json | null
          brand_color?: string | null
          description?: string | null
          hours?: Json | null
          id?: string | null
          industry?: string | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          social_links?: Json | null
          tagline?: string | null
          timezone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      business_apply_profile_command: {
        Args: { p_business_id: string; p_patch: Json }
        Returns: string
      }
      business_has_permission: {
        Args: { p_business_id: string; p_permission: string }
        Returns: boolean
      }
      cms_apply_content_entry_command: {
        Args: {
          p_action: string
          p_actor_id: string
          p_business_id: string
          p_change_summary?: string
          p_content_type_id?: string
          p_data?: Json
          p_entry_id?: string
          p_locale?: string
          p_site_id?: string
          p_slug?: string
          p_target_status?: string
          p_title?: string
        }
        Returns: {
          archived_at: string | null
          business_id: string
          content_type_id: string
          created_at: string
          created_by: string | null
          data: Json
          id: string
          locale: string
          project_id: string | null
          published_at: string | null
          scheduled_publish_at: string | null
          site_id: string | null
          slug: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "content_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      commit_canonical_site_revision_v2: {
        Args: {
          p_active_page_path: string
          p_backend_ops_applied: Json
          p_business_id: string
          p_diagnostics: Json
          p_draft_id: string
          p_parent_revision_id: string
          p_patch_json: Json
          p_playground_state: Json
          p_project_id: string
          p_publish_blockers: Json
          p_publish_ready: boolean
          p_readiness_report: Json
          p_runtime_manifest: Json
          p_site_bundle_snapshot: Json
          p_source: string
          p_status: string
          p_vfs_files: Json
          p_vfs_hash: string
        }
        Returns: string
      }
      commit_canonical_site_revision_v2_full: {
        Args: {
          p_active_page_path: string
          p_backend_ops_applied: Json
          p_business_id: string
          p_diagnostics: Json
          p_draft_id: string
          p_parent_revision_id: string
          p_patch_json: Json
          p_playground_state: Json
          p_project_id: string
          p_publish_blockers: Json
          p_publish_ready: boolean
          p_readiness_report: Json
          p_runtime_manifest: Json
          p_site_bundle_snapshot: Json
          p_source: string
          p_status: string
          p_vfs_files: Json
          p_vfs_hash: string
        }
        Returns: string
      }
      current_session_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_pattern_usage: {
        Args: { pattern_id: string }
        Returns: undefined
      }
      is_business_admin: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      is_business_member: { Args: { _business_id: string }; Returns: boolean }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      jsonb_is_object: { Args: { j: Json }; Returns: boolean }
      jsonb_is_string_array: { Args: { j: Json }; Returns: boolean }
      reassign_project_business: {
        Args: { _project_id: string; _target_business_id: string }
        Returns: undefined
      }
      resolve_project_backend: { Args: { p_project_id: string }; Returns: Json }
      resolve_published_site_backend: {
        Args: { p_project_id: string }
        Returns: Json
      }
      user_business_role: {
        Args: { _business_id: string; _user_id: string }
        Returns: string
      }
      validate_file_share_token: {
        Args: { _file_id: string; _token: string }
        Returns: boolean
      }
    }
    Enums: {
      agent_event_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      agent_tier: "free" | "pro" | "enterprise" | "system"
      agent_ui_kind: "hidden" | "widget" | "modal" | "inline"
      ai_builder_proposal_kind:
        | "sql_migration"
        | "edge_function"
        | "config_change"
      ai_builder_proposal_status:
        | "pending"
        | "approved"
        | "rejected"
        | "applied"
        | "failed"
      app_role: "admin" | "user"
      blend_mode:
        | "normal"
        | "multiply"
        | "screen"
        | "overlay"
        | "darken"
        | "lighten"
        | "color-dodge"
        | "color-burn"
        | "hard-light"
        | "soft-light"
        | "difference"
        | "exclusion"
      document_type: "design" | "video"
      layer_kind: "image" | "text" | "shape" | "group" | "video" | "audio"
      track_type: "video" | "audio" | "overlay"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      agent_event_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      agent_tier: ["free", "pro", "enterprise", "system"],
      agent_ui_kind: ["hidden", "widget", "modal", "inline"],
      ai_builder_proposal_kind: [
        "sql_migration",
        "edge_function",
        "config_change",
      ],
      ai_builder_proposal_status: [
        "pending",
        "approved",
        "rejected",
        "applied",
        "failed",
      ],
      app_role: ["admin", "user"],
      blend_mode: [
        "normal",
        "multiply",
        "screen",
        "overlay",
        "darken",
        "lighten",
        "color-dodge",
        "color-burn",
        "hard-light",
        "soft-light",
        "difference",
        "exclusion",
      ],
      document_type: ["design", "video"],
      layer_kind: ["image", "text", "shape", "group", "video", "audio"],
      track_type: ["video", "audio", "overlay"],
    },
  },
} as const
