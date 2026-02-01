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
      announcement_attachments: {
        Row: {
          announcement_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
        }
        Insert: {
          announcement_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
        }
        Update: {
          announcement_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_attachments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_deliveries: {
        Row: {
          announcement_id: string
          attempts: number
          channel: string
          created_at: string
          error_message: string | null
          id: string
          last_attempt_at: string | null
          recipient_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
        }
        Insert: {
          announcement_id: string
          attempts?: number
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          recipient_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Update: {
          announcement_id?: string
          attempts?: number
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          recipient_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_deliveries_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_deliveries_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "announcement_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_recipients: {
        Row: {
          announcement_id: string
          created_at: string
          employee_id: string
          id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          employee_id: string
          id?: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_recipients_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_recipients_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_recipients_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          message: string
          recipients_snapshot: Json | null
          sent_at: string | null
          status: Database["public"]["Enums"]["announcement_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          message: string
          recipients_snapshot?: Json | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["announcement_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          message?: string
          recipients_snapshot?: Json | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["announcement_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          actor_user_id: string
          correction_request_id: string | null
          created_at: string
          details: Json | null
          employee_id: string | null
          id: string
          project_id: string | null
          time_entry_id: string | null
        }
        Insert: {
          action_type: string
          actor_user_id: string
          correction_request_id?: string | null
          created_at?: string
          details?: Json | null
          employee_id?: string | null
          id?: string
          project_id?: string | null
          time_entry_id?: string | null
        }
        Update: {
          action_type?: string
          actor_user_id?: string
          correction_request_id?: string | null
          created_at?: string
          details?: Json | null
          employee_id?: string | null
          id?: string
          project_id?: string | null
          time_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_correction_request_id_fkey"
            columns: ["correction_request_id"]
            isOneToOne: false
            referencedRelation: "correction_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_requests: {
        Row: {
          created_at: string
          id: string
          new_end_time: string | null
          new_entry_date: string | null
          new_project_id: string | null
          new_start_time: string | null
          request_reason: string
          request_type: string
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["correction_request_status"]
          time_entry_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_end_time?: string | null
          new_entry_date?: string | null
          new_project_id?: string | null
          new_start_time?: string | null
          request_reason: string
          request_type?: string
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["correction_request_status"]
          time_entry_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_end_time?: string | null
          new_entry_date?: string | null
          new_project_id?: string | null
          new_start_time?: string | null
          request_reason?: string
          request_type?: string
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["correction_request_status"]
          time_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_requests_new_project_id_fkey"
            columns: ["new_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_requests_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_allowed_projects: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          project_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_allowed_projects_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_allowed_projects_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_allowed_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_contact_channels: {
        Row: {
          channel_identifier: string
          channel_type: string
          created_at: string
          employee_id: string
          id: string
          is_verified: boolean
          updated_at: string
        }
        Insert: {
          channel_identifier: string
          channel_type?: string
          created_at?: string
          employee_id: string
          id?: string
          is_verified?: boolean
          updated_at?: string
        }
        Update: {
          channel_identifier?: string
          channel_type?: string
          created_at?: string
          employee_id?: string
          id?: string
          is_verified?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_contact_channels_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_contact_channels_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          afm: string | null
          assigned_user_id: string | null
          bank_name: string | null
          created_at: string
          employee_code: string
          first_name: string
          hire_date: string | null
          iban: string | null
          id: string
          id_number: string | null
          id_type: string | null
          last_name: string
          notes: string | null
          overtime_hourly_rate: number
          phone: string | null
          regular_end_time: string
          regular_hourly_rate: number
          regular_rate_all_in: number
          regular_start_time: string
          specialty_id: string
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
        }
        Insert: {
          afm?: string | null
          assigned_user_id?: string | null
          bank_name?: string | null
          created_at?: string
          employee_code: string
          first_name: string
          hire_date?: string | null
          iban?: string | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          last_name: string
          notes?: string | null
          overtime_hourly_rate?: number
          phone?: string | null
          regular_end_time?: string
          regular_hourly_rate?: number
          regular_rate_all_in?: number
          regular_start_time?: string
          specialty_id: string
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Update: {
          afm?: string | null
          assigned_user_id?: string | null
          bank_name?: string | null
          created_at?: string
          employee_code?: string
          first_name?: string
          hire_date?: string | null
          iban?: string | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          last_name?: string
          notes?: string | null
          overtime_hourly_rate?: number
          phone?: string | null
          regular_end_time?: string
          regular_hourly_rate?: number
          regular_rate_all_in?: number
          regular_start_time?: string
          specialty_id?: string
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      locked_periods: {
        Row: {
          end_date: string
          id: string
          is_active: boolean
          locked_at: string
          locked_by: string
          start_date: string
          unlocked_at: string | null
          unlocked_by: string | null
        }
        Insert: {
          end_date: string
          id?: string
          is_active?: boolean
          locked_at?: string
          locked_by: string
          start_date: string
          unlocked_at?: string | null
          unlocked_by?: string | null
        }
        Update: {
          end_date?: string
          id?: string
          is_active?: boolean
          locked_at?: string
          locked_by?: string
          start_date?: string
          unlocked_at?: string | null
          unlocked_by?: string | null
        }
        Relationships: []
      }
      module_actions: {
        Row: {
          action_key: string
          created_at: string
          description: string | null
          id: string
          module_key: string
        }
        Insert: {
          action_key: string
          created_at?: string
          description?: string | null
          id?: string
          module_key: string
        }
        Update: {
          action_key?: string
          created_at?: string
          description?: string | null
          id?: string
          module_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_actions_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
        ]
      }
      modules: {
        Row: {
          is_active: boolean
          key: string
          name: string
        }
        Insert: {
          is_active?: boolean
          key: string
          name: string
        }
        Update: {
          is_active?: boolean
          key?: string
          name?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          created_at: string
          id: string
          is_winner: boolean | null
          lead_time: string | null
          notes: string | null
          price: number | null
          rfq_id: string
          supplier_id: string
          validity_date: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_winner?: boolean | null
          lead_time?: string | null
          notes?: string | null
          price?: number | null
          rfq_id: string
          supplier_id: string
          validity_date?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_winner?: boolean | null
          lead_time?: string | null
          notes?: string | null
          price?: number | null
          rfq_id?: string
          supplier_id?: string
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_audit_logs: {
        Row: {
          actor_user_id: string | null
          change_type: string
          created_at: string
          details: Json
          id: string
          target_user_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          change_type: string
          created_at?: string
          details: Json
          id?: string
          target_user_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          change_type?: string
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      permission_template_actions: {
        Row: {
          action_key: string
          allowed: boolean
          template_id: string
        }
        Insert: {
          action_key: string
          allowed?: boolean
          template_id: string
        }
        Update: {
          action_key?: string
          allowed?: boolean
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_template_actions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "permission_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_template_modules: {
        Row: {
          can_access: boolean
          module_key: string
          template_id: string
        }
        Insert: {
          can_access?: boolean
          module_key: string
          template_id: string
        }
        Update: {
          can_access?: boolean
          module_key?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_template_modules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "permission_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_template_permissions: {
        Row: {
          allowed: boolean
          permission_key: string
          template_id: string
        }
        Insert: {
          allowed?: boolean
          permission_key: string
          template_id: string
        }
        Update: {
          allowed?: boolean
          permission_key?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_template_permissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "permission_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      po_lines: {
        Row: {
          description: string
          id: string
          po_id: string
          qty: number | null
          uom: string | null
        }
        Insert: {
          description: string
          id?: string
          po_id: string
          qty?: number | null
          uom?: string | null
        }
        Update: {
          description?: string
          id?: string
          po_id?: string
          qty?: number | null
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pr_attachments: {
        Row: {
          created_at: string
          file_path: string
          filename: string
          id: string
          pr_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          filename: string
          id?: string
          pr_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          filename?: string
          id?: string
          pr_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pr_attachments_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          full_name: string | null
          id: string
          is_active: boolean
          preferred_language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          preferred_language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          preferred_language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          assigned_shipyard_company: string
          created_at: string
          customer_company_afm: string | null
          customer_company_name: string
          id: string
          project_code: string
          project_name: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          assigned_shipyard_company?: string
          created_at?: string
          customer_company_afm?: string | null
          customer_company_name?: string
          id?: string
          project_code: string
          project_name: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          assigned_shipyard_company?: string
          created_at?: string
          customer_company_afm?: string | null
          customer_company_name?: string
          id?: string
          project_code?: string
          project_name?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          created_at: string
          id: string
          po_number: string
          pr_id: string
          status: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          po_number: string
          pr_id: string
          status?: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          id?: string
          po_number?: string
          pr_id?: string
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          needed_by: string | null
          pr_number: string
          pricing_model: string | null
          priority: string | null
          project_id: string
          qty: number | null
          scope_of_work: string | null
          status: string
          type: string
          uom: string | null
          vessel_or_job: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          id?: string
          needed_by?: string | null
          pr_number: string
          pricing_model?: string | null
          priority?: string | null
          project_id: string
          qty?: number | null
          scope_of_work?: string | null
          status?: string
          type: string
          uom?: string | null
          vessel_or_job?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          needed_by?: string | null
          pr_number?: string
          pricing_model?: string | null
          priority?: string | null
          project_id?: string
          qty?: number | null
          scope_of_work?: string | null
          status?: string
          type?: string
          uom?: string | null
          vessel_or_job?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      receiving: {
        Row: {
          id: string
          notes: string | null
          po_line_id: string
          received_at: string
          received_by: string
          received_qty: number | null
        }
        Insert: {
          id?: string
          notes?: string | null
          po_line_id: string
          received_at?: string
          received_by: string
          received_qty?: number | null
        }
        Update: {
          id?: string
          notes?: string | null
          po_line_id?: string
          received_at?: string
          received_by?: string
          received_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receiving_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "po_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      request_offer_attachments: {
        Row: {
          created_at: string | null
          file_path: string
          filename: string
          id: string
          request_offer_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_path: string
          filename: string
          id?: string
          request_offer_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_path?: string
          filename?: string
          id?: string
          request_offer_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_offer_attachments_request_offer_id_fkey"
            columns: ["request_offer_id"]
            isOneToOne: false
            referencedRelation: "request_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      request_offer_recipients: {
        Row: {
          email_used: string | null
          error_message: string | null
          id: string
          request_offer_id: string | null
          sent_at: string | null
          status: string | null
          supplier_id: string | null
        }
        Insert: {
          email_used?: string | null
          error_message?: string | null
          id?: string
          request_offer_id?: string | null
          sent_at?: string | null
          status?: string | null
          supplier_id?: string | null
        }
        Update: {
          email_used?: string | null
          error_message?: string | null
          id?: string
          request_offer_id?: string | null
          sent_at?: string | null
          status?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_offer_recipients_request_offer_id_fkey"
            columns: ["request_offer_id"]
            isOneToOne: false
            referencedRelation: "request_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_offer_recipients_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      request_offers: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          message_to_recipients: string | null
          project_name: string | null
          qty: number | null
          ro_number: string | null
          sent_at: string | null
          status: string | null
          title: string
          type: string
          uom: string | null
          vessel_or_job: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          message_to_recipients?: string | null
          project_name?: string | null
          qty?: number | null
          ro_number?: string | null
          sent_at?: string | null
          status?: string | null
          title: string
          type: string
          uom?: string | null
          vessel_or_job?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          message_to_recipients?: string | null
          project_name?: string | null
          qty?: number | null
          ro_number?: string | null
          sent_at?: string | null
          status?: string | null
          title?: string
          type?: string
          uom?: string | null
          vessel_or_job?: string | null
        }
        Relationships: []
      }
      rfq_attachments: {
        Row: {
          created_at: string | null
          file_path: string
          filename: string
          id: string
          rfq_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          file_path: string
          filename: string
          id?: string
          rfq_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          file_path?: string
          filename?: string
          id?: string
          rfq_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_attachments_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_suppliers: {
        Row: {
          id: string
          rfq_id: string
          status: string | null
          supplier_id: string
        }
        Insert: {
          id?: string
          rfq_id: string
          status?: string | null
          supplier_id: string
        }
        Update: {
          id?: string
          rfq_id?: string
          status?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_suppliers_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          created_at: string
          deadline: string | null
          id: string
          pr_id: string
          rfq_number: string
          status: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          id?: string
          pr_id: string
          rfq_number: string
          status?: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          id?: string
          pr_id?: string
          rfq_number?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_acceptance: {
        Row: {
          accepted: boolean | null
          accepted_at: string | null
          id: string
          notes: string | null
          po_id: string
        }
        Insert: {
          accepted?: boolean | null
          accepted_at?: string | null
          id?: string
          notes?: string | null
          po_id: string
        }
        Update: {
          accepted?: boolean | null
          accepted_at?: string | null
          id?: string
          notes?: string | null
          po_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_acceptance_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      specialties: {
        Row: {
          code: string
          created_at: string
          id: string
          name_el: string
          name_en: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name_el: string
          name_en: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name_el?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      specialty_sequences: {
        Row: {
          current_sequence: number
          specialty_id: string
        }
        Insert: {
          current_sequence?: number
          specialty_id: string
        }
        Update: {
          current_sequence?: number
          specialty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialty_sequences_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: true
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          category: string | null
          contact_name: string | null
          country: string
          created_at: string
          email: string | null
          id: string
          is_preferred: boolean | null
          name: string
          notes: string | null
          phone: string | null
          supplier_type: string | null
          vat_number: string
        }
        Insert: {
          category?: string | null
          contact_name?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          is_preferred?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          supplier_type?: string | null
          vat_number?: string
        }
        Update: {
          category?: string | null
          contact_name?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          is_preferred?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          supplier_type?: string | null
          vat_number?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          created_at: string
          created_by: string
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          duration_minutes: number
          employee_id: string
          end_time: string
          entry_date: string
          id: string
          is_deleted: boolean
          overtime_minutes: number
          project_id: string
          regular_minutes: number
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          duration_minutes?: number
          employee_id: string
          end_time: string
          entry_date: string
          id?: string
          is_deleted?: boolean
          overtime_minutes?: number
          project_id: string
          regular_minutes?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          duration_minutes?: number
          employee_id?: string
          end_time?: string
          entry_date?: string
          id?: string
          is_deleted?: boolean
          overtime_minutes?: number
          project_id?: string
          regular_minutes?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_access: {
        Row: {
          can_access: boolean
          created_at: string
          granted_by: string | null
          module_key: string
          user_id: string
        }
        Insert: {
          can_access?: boolean
          created_at?: string
          granted_by?: string | null
          module_key: string
          user_id: string
        }
        Update: {
          can_access?: boolean
          created_at?: string
          granted_by?: string | null
          module_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_module_access_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
        ]
      }
      user_module_actions: {
        Row: {
          action_key: string
          allowed: boolean
          created_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          action_key: string
          allowed?: boolean
          created_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          action_key?: string
          allowed?: boolean
          created_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_module_actions_action_key_fkey"
            columns: ["action_key"]
            isOneToOne: false
            referencedRelation: "module_actions"
            referencedColumns: ["action_key"]
          },
        ]
      }
      user_permission_templates: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          template_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          template_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_templates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "permission_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          allowed: boolean
          permission_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed?: boolean
          permission_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed?: boolean
          permission_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      viber_link_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          employee_id: string
          expires_at: string
          id: string
          used_at: string | null
          used_by_viber_user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          employee_id: string
          expires_at: string
          id?: string
          used_at?: string | null
          used_by_viber_user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          employee_id?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          used_by_viber_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "viber_link_codes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viber_link_codes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_limited"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      employees_limited: {
        Row: {
          employee_code: string | null
          first_name: string | null
          hire_date: string | null
          id: string | null
          last_name: string | null
          notes: string | null
          phone: string | null
          regular_end_time: string | null
          regular_start_time: string | null
          specialty_id: string | null
          status: Database["public"]["Enums"]["employee_status"] | null
        }
        Insert: {
          employee_code?: string | null
          first_name?: string | null
          hire_date?: string | null
          id?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          regular_end_time?: string | null
          regular_start_time?: string | null
          specialty_id?: string | null
          status?: Database["public"]["Enums"]["employee_status"] | null
        }
        Update: {
          employee_code?: string | null
          first_name?: string | null
          hire_date?: string | null
          id?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          regular_end_time?: string | null
          regular_start_time?: string | null
          specialty_id?: string | null
          status?: Database["public"]["Enums"]["employee_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_access_employee: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
      get_all_users_with_profiles: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          email_confirmed_at: string
          full_name: string
          is_active: boolean
          last_sign_in_at: string
          role: string
          user_id: string
        }[]
      }
      get_permission_audit_logs: {
        Args: { _limit?: number }
        Returns: {
          actor_user_id: string
          change_type: string
          created_at: string
          details: Json
          id: string
          target_user_id: string
        }[]
      }
      get_user_base_role: { Args: { _user_id: string }; Returns: string }
      get_user_email: { Args: { _user_id: string }; Returns: string }
      has_action_permission: {
        Args: { _action_key: string; _user_id: string }
        Returns: boolean
      }
      has_elevated_role: { Args: { _user_id: string }; Returns: boolean }
      has_module_access: {
        Args: { _module_key: string; _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      initialize_user_permissions: {
        Args: {
          _granted_by: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_timekeeper_only: { Args: { _user_id: string }; Returns: boolean }
      is_today_athens: { Args: { _date: string }; Returns: boolean }
      is_user_active: { Args: { _user_id: string }; Returns: boolean }
      recompute_user_permissions: {
        Args: { _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      announcement_status: "draft" | "pending" | "sent" | "partial" | "failed"
      app_role: "admin" | "hr" | "timekeeper"
      app_role_v2: "admin" | "employee"
      correction_request_status: "pending" | "approved" | "rejected"
      delivery_status: "pending" | "sent" | "failed"
      employee_status: "active" | "inactive"
      project_status: "OPEN" | "CLOSED"
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
      announcement_status: ["draft", "pending", "sent", "partial", "failed"],
      app_role: ["admin", "hr", "timekeeper"],
      app_role_v2: ["admin", "employee"],
      correction_request_status: ["pending", "approved", "rejected"],
      delivery_status: ["pending", "sent", "failed"],
      employee_status: ["active", "inactive"],
      project_status: ["OPEN", "CLOSED"],
    },
  },
} as const
