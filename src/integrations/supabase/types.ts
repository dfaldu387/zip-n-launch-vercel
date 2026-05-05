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
      analytics_behavior_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          page_path: string | null
          previous_page: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          page_path?: string | null
          previous_page?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          page_path?: string | null
          previous_page?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_behavior_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "analytics_user_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_pattern_events: {
        Row: {
          action: string
          association_id: string | null
          browser: string | null
          created_at: string
          device_type: string | null
          difficulty_level: string | null
          discipline: string | null
          id: string
          pattern_id: string | null
          time_spent_seconds: number | null
          user_id: string | null
          version_id: string | null
        }
        Insert: {
          action: string
          association_id?: string | null
          browser?: string | null
          created_at?: string
          device_type?: string | null
          difficulty_level?: string | null
          discipline?: string | null
          id?: string
          pattern_id?: string | null
          time_spent_seconds?: number | null
          user_id?: string | null
          version_id?: string | null
        }
        Update: {
          action?: string
          association_id?: string | null
          browser?: string | null
          created_at?: string
          device_type?: string | null
          difficulty_level?: string | null
          discipline?: string | null
          id?: string
          pattern_id?: string | null
          time_spent_seconds?: number | null
          user_id?: string | null
          version_id?: string | null
        }
        Relationships: []
      }
      analytics_performance_logs: {
        Row: {
          browser: string | null
          created_at: string
          device_type: string | null
          error_message: string | null
          error_stack: string | null
          id: string
          load_time_ms: number | null
          metric_type: string
          network_type: string | null
          page_path: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_type?: string | null
          error_message?: string | null
          error_stack?: string | null
          id?: string
          load_time_ms?: number | null
          metric_type: string
          network_type?: string | null
          page_path?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_type?: string | null
          error_message?: string | null
          error_stack?: string | null
          id?: string
          load_time_ms?: number | null
          metric_type?: string
          network_type?: string | null
          page_path?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_user_sessions: {
        Row: {
          browser: string | null
          created_at: string
          device_type: string | null
          duration_seconds: number | null
          id: string
          ip_hash: string | null
          session_end: string | null
          session_start: string
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_type?: string | null
          duration_seconds?: number | null
          id?: string
          ip_hash?: string | null
          session_end?: string | null
          session_start?: string
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_type?: string | null
          duration_seconds?: number | null
          id?: string
          ip_hash?: string | null
          session_end?: string | null
          session_start?: string
          user_id?: string | null
        }
        Relationships: []
      }
      arena_session_classes: {
        Row: {
          arena_session_id: string
          class_template_id: string
          created_at: string
          id: string
          quantity: number
          reset_between: boolean
        }
        Insert: {
          arena_session_id: string
          class_template_id: string
          created_at?: string
          id?: string
          quantity?: number
          reset_between?: boolean
        }
        Update: {
          arena_session_id?: string
          class_template_id?: string
          created_at?: string
          id?: string
          quantity?: number
          reset_between?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "arena_session_classes_arena_session_id_fkey"
            columns: ["arena_session_id"]
            isOneToOne: false
            referencedRelation: "arena_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_session_classes_class_template_id_fkey"
            columns: ["class_template_id"]
            isOneToOne: false
            referencedRelation: "class_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_sessions: {
        Row: {
          arena_id: string
          calculation_mode: string
          created_at: string
          date: string
          id: string
          session_name: string
          show_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arena_id: string
          calculation_mode?: string
          created_at?: string
          date: string
          id?: string
          session_name: string
          show_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arena_id?: string
          calculation_mode?: string
          created_at?: string
          date?: string
          id?: string
          session_name?: string
          show_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_sessions_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_sessions_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      arenas: {
        Row: {
          arena_type: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          show_id: string | null
          surface_type: string | null
          updated_at: string | null
          user_id: string | null
          venue_id: string | null
        }
        Insert: {
          arena_type?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          show_id?: string | null
          surface_type?: string | null
          updated_at?: string | null
          user_id?: string | null
          venue_id?: string | null
        }
        Update: {
          arena_type?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          show_id?: string | null
          surface_type?: string | null
          updated_at?: string | null
          user_id?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arenas_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arenas_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          arena_id: string | null
          created_at: string | null
          end_time: string
          id: string
          role_code: string | null
          shift_date: string
          show_id: string | null
          start_time: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          arena_id?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          role_code?: string | null
          shift_date: string
          show_id?: string | null
          start_time: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          arena_id?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          role_code?: string | null
          shift_date?: string
          show_id?: string | null
          start_time?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["role_code"]
          },
          {
            foreignKeyName: "assignments_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      association_assets: {
        Row: {
          asset_type: string
          association_id: string
          class_name: string
          created_at: string | null
          file_name: string | null
          file_path: string | null
          file_url: string | null
          id: string
          pattern_number: string | null
          updated_at: string | null
          uploaded_by: string | null
          year: number | null
        }
        Insert: {
          asset_type: string
          association_id: string
          class_name: string
          created_at?: string | null
          file_name?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          pattern_number?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          year?: number | null
        }
        Update: {
          asset_type?: string
          association_id?: string
          class_name?: string
          created_at?: string | null
          file_name?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          pattern_number?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          year?: number | null
        }
        Relationships: []
      }
      associations: {
        Row: {
          abbreviation: string | null
          color: string | null
          description: string | null
          id: string
          is_group: boolean | null
          is_open_show: boolean | null
          logo: string | null
          name: string
          position: string
          sort_order: number | null
          sub_association_info: Json | null
        }
        Insert: {
          abbreviation?: string | null
          color?: string | null
          description?: string | null
          id: string
          is_group?: boolean | null
          is_open_show?: boolean | null
          logo?: string | null
          name: string
          position?: string
          sort_order?: number | null
          sub_association_info?: Json | null
        }
        Update: {
          abbreviation?: string | null
          color?: string | null
          description?: string | null
          id?: string
          is_group?: boolean | null
          is_open_show?: boolean | null
          logo?: string | null
          name?: string
          position?: string
          sort_order?: number | null
          sub_association_info?: Json | null
        }
        Relationships: []
      }
      availability: {
        Row: {
          available_date: string
          created_at: string | null
          employee_id: string | null
          end_time: string
          id: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          available_date: string
          created_at?: string | null
          employee_id?: string | null
          end_time: string
          id?: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          available_date?: string
          created_at?: string | null
          employee_id?: string | null
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      class_template_equipment: {
        Row: {
          class_template_id: string
          created_at: string
          equipment_id: string
          id: string
          quantity: number
        }
        Insert: {
          class_template_id: string
          created_at?: string
          equipment_id: string
          id?: string
          quantity?: number
        }
        Update: {
          class_template_id?: string
          created_at?: string
          equipment_id?: string
          id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_template_equipment_class_template_id_fkey"
            columns: ["class_template_id"]
            isOneToOne: false
            referencedRelation: "class_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_template_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_items"
            referencedColumns: ["id"]
          },
        ]
      }
      class_templates: {
        Row: {
          created_at: string
          default_arena_type: string | null
          discipline_id: string
          id: string
          name: string
          setup_notes: string | null
          staff_notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_arena_type?: string | null
          discipline_id: string
          id?: string
          name: string
          setup_notes?: string | null
          staff_notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_arena_type?: string | null
          discipline_id?: string
          id?: string
          name?: string
          setup_notes?: string | null
          staff_notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_templates_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          association_id: string | null
          category: string | null
          created_at: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          association_id?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          association_id?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_log: {
        Row: {
          comm_type: string
          content: string | null
          employee_id: string | null
          id: string
          sent_at: string | null
          show_id: string | null
          status: string | null
        }
        Insert: {
          comm_type: string
          content?: string | null
          employee_id?: string | null
          id?: string
          sent_at?: string | null
          show_id?: string | null
          status?: string | null
        }
        Update: {
          comm_type?: string
          content?: string | null
          employee_id?: string | null
          id?: string
          sent_at?: string | null
          show_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comms_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comms_log_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      creatives: {
        Row: {
          approved: boolean | null
          created_at: string | null
          file_path: string | null
          file_url: string | null
          height: number | null
          id: string
          sponsor_id: string | null
          type: string
          width: number | null
        }
        Insert: {
          approved?: boolean | null
          created_at?: string | null
          file_path?: string | null
          file_url?: string | null
          height?: number | null
          id?: string
          sponsor_id?: string | null
          type: string
          width?: number | null
        }
        Update: {
          approved?: boolean | null
          created_at?: string | null
          file_path?: string | null
          file_url?: string | null
          height?: number | null
          id?: string
          sponsor_id?: string | null
          type?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creatives_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          last_name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      discipline_associations: {
        Row: {
          association_id: string | null
          discipline_id: string | null
          id: string
          sub_association_type: string | null
        }
        Insert: {
          association_id?: string | null
          discipline_id?: string | null
          id?: string
          sub_association_type?: string | null
        }
        Update: {
          association_id?: string | null
          discipline_id?: string | null
          id?: string
          sub_association_type?: string | null
        }
        Relationships: []
      }
      discipline_equipment: {
        Row: {
          created_at: string
          discipline_id: string
          equipment_id: string
          id: string
          is_optional: boolean
          module_name: string | null
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discipline_id: string
          equipment_id: string
          id?: string
          is_optional?: boolean
          module_name?: string | null
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discipline_id?: string
          equipment_id?: string
          id?: string
          is_optional?: boolean
          module_name?: string | null
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discipline_equipment_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discipline_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_items"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplines: {
        Row: {
          association_id: string | null
          category: string | null
          city: string | null
          description: string | null
          discipline_group: string | null
          id: string
          name: string
          open_divisions: boolean | null
          pattern_type: string | null
          rules_json: Json | null
          sort_order: number | null
          sub_association_type: string | null
        }
        Insert: {
          association_id?: string | null
          category?: string | null
          city?: string | null
          description?: string | null
          discipline_group?: string | null
          id?: string
          name: string
          open_divisions?: boolean | null
          pattern_type?: string | null
          rules_json?: Json | null
          sort_order?: number | null
          sub_association_type?: string | null
        }
        Update: {
          association_id?: string | null
          category?: string | null
          city?: string | null
          description?: string | null
          discipline_group?: string | null
          id?: string
          name?: string
          open_divisions?: boolean | null
          pattern_type?: string | null
          rules_json?: Json | null
          sort_order?: number | null
          sub_association_type?: string | null
        }
        Relationships: []
      }
      distribution_plan: {
        Row: {
          arena_id: string
          created_at: string
          date: string | null
          discipline_id: string | null
          equipment_id: string
          id: string
          notes: string | null
          planned_qty: number
          show_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arena_id: string
          created_at?: string
          date?: string | null
          discipline_id?: string | null
          equipment_id: string
          id?: string
          notes?: string | null
          planned_qty?: number
          show_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arena_id?: string
          created_at?: string
          date?: string | null
          discipline_id?: string | null
          equipment_id?: string
          id?: string
          notes?: string | null
          planned_qty?: number
          show_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribution_plan_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_plan_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_plan_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_plan_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      division_levels: {
        Row: {
          division_id: string | null
          id: string
          name: string
          pattern_media: string | null
          sort_order: number | null
        }
        Insert: {
          division_id?: string | null
          id?: string
          name: string
          pattern_media?: string | null
          sort_order?: number | null
        }
        Update: {
          division_id?: string | null
          id?: string
          name?: string
          pattern_media?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "division_levels_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          association_id: string | null
          id: string
          name: string
          sort_order: number | null
          sub_association_type: string | null
        }
        Insert: {
          association_id?: string | null
          id?: string
          name: string
          sort_order?: number | null
          sub_association_type?: string | null
        }
        Update: {
          association_id?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          sub_association_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "divisions_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_stays: {
        Row: {
          check_in_date: string | null
          check_out_date: string | null
          created_at: string | null
          employee_id: string | null
          hotel_id: string | null
          id: string
          notes: string | null
          room_details: string | null
          show_id: string | null
          updated_at: string | null
        }
        Insert: {
          check_in_date?: string | null
          check_out_date?: string | null
          created_at?: string | null
          employee_id?: string | null
          hotel_id?: string | null
          id?: string
          notes?: string | null
          room_details?: string | null
          show_id?: string | null
          updated_at?: string | null
        }
        Update: {
          check_in_date?: string | null
          check_out_date?: string | null
          created_at?: string | null
          employee_id?: string | null
          hotel_id?: string | null
          id?: string
          notes?: string | null
          room_details?: string | null
          show_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_stays_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_stays_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_stays_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean | null
          certifications: Json | null
          created_at: string | null
          email: string
          full_name: string
          home_airport: string | null
          id: string
          phone: string | null
          roles: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          certifications?: Json | null
          created_at?: string | null
          email: string
          full_name: string
          home_airport?: string | null
          id?: string
          phone?: string | null
          roles?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          certifications?: Json | null
          created_at?: string | null
          email?: string
          full_name?: string
          home_airport?: string | null
          id?: string
          phone?: string | null
          roles?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ep_approvals: {
        Row: {
          approver_roles: string[] | null
          audit: Json | null
          created_at: string
          created_by: string | null
          decision: string | null
          decision_at: string | null
          deleted_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          notes: string | null
          requested_by: string | null
          updated_at: string
          updated_by: string | null
          version: number | null
        }
        Insert: {
          approver_roles?: string[] | null
          audit?: Json | null
          created_at?: string
          created_by?: string | null
          decision?: string | null
          decision_at?: string | null
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          notes?: string | null
          requested_by?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number | null
        }
        Update: {
          approver_roles?: string[] | null
          audit?: Json | null
          created_at?: string
          created_by?: string | null
          decision?: string | null
          decision_at?: string | null
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          notes?: string | null
          requested_by?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number | null
        }
        Relationships: []
      }
      ep_associations: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          meta: Json | null
          name: string
          rulebook_url: string | null
          season_year: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          meta?: Json | null
          name: string
          rulebook_url?: string | null
          season_year?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          meta?: Json | null
          name?: string
          rulebook_url?: string | null
          season_year?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ep_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          payload: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      ep_classes: {
        Row: {
          arena: string | null
          association_id: string | null
          class_date: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          division: string | null
          id: string
          level: string | null
          meta: Json | null
          number: string | null
          show_id: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          arena?: string | null
          association_id?: string | null
          class_date?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          division?: string | null
          id?: string
          level?: string | null
          meta?: Json | null
          number?: string | null
          show_id: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          arena?: string | null
          association_id?: string | null
          class_date?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          division?: string | null
          id?: string
          level?: string | null
          meta?: Json | null
          number?: string | null
          show_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ep_classes_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "ep_associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ep_classes_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "ep_shows"
            referencedColumns: ["id"]
          },
        ]
      }
      ep_distributions: {
        Row: {
          access_code: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expires_at: string | null
          id: string
          items: Json | null
          meta: Json | null
          method: string | null
          scope: string | null
          show_id: string
          target_role: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access_code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          items?: Json | null
          meta?: Json | null
          method?: string | null
          scope?: string | null
          show_id: string
          target_role?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access_code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          items?: Json | null
          meta?: Json | null
          method?: string | null
          scope?: string | null
          show_id?: string
          target_role?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ep_distributions_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "ep_shows"
            referencedColumns: ["id"]
          },
        ]
      }
      ep_packets: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          meta: Json | null
          output_pdf_url: string | null
          packet_type: string | null
          pages: Json | null
          show_id: string
          status: string | null
          theme: string | null
          title: string
          updated_at: string
          updated_by: string | null
          version: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          meta?: Json | null
          output_pdf_url?: string | null
          packet_type?: string | null
          pages?: Json | null
          show_id: string
          status?: string | null
          theme?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          meta?: Json | null
          output_pdf_url?: string | null
          packet_type?: string | null
          pages?: Json | null
          show_id?: string
          status?: string | null
          theme?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ep_packets_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "ep_shows"
            referencedColumns: ["id"]
          },
        ]
      }
      ep_patterns: {
        Row: {
          ai_file_url: string | null
          association_id: string | null
          checksum: string | null
          code: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          discipline: string | null
          division: string | null
          id: string
          level: string | null
          level_category: string | null
          meta: Json | null
          obstacles: Json | null
          optional_maneuvers: string | null
          parent_pattern_id: string | null
          pattern_set_number: number | null
          pdf_asset_url: string | null
          preview_image_url: string | null
          required_maneuvers: string | null
          source: string | null
          status: string | null
          svg_asset_url: string | null
          tags: string | null
          theme: string | null
          title: string
          updated_at: string
          updated_by: string | null
          version: number | null
        }
        Insert: {
          ai_file_url?: string | null
          association_id?: string | null
          checksum?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discipline?: string | null
          division?: string | null
          id?: string
          level?: string | null
          level_category?: string | null
          meta?: Json | null
          obstacles?: Json | null
          optional_maneuvers?: string | null
          parent_pattern_id?: string | null
          pattern_set_number?: number | null
          pdf_asset_url?: string | null
          preview_image_url?: string | null
          required_maneuvers?: string | null
          source?: string | null
          status?: string | null
          svg_asset_url?: string | null
          tags?: string | null
          theme?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number | null
        }
        Update: {
          ai_file_url?: string | null
          association_id?: string | null
          checksum?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discipline?: string | null
          division?: string | null
          id?: string
          level?: string | null
          level_category?: string | null
          meta?: Json | null
          obstacles?: Json | null
          optional_maneuvers?: string | null
          parent_pattern_id?: string | null
          pattern_set_number?: number | null
          pdf_asset_url?: string | null
          preview_image_url?: string | null
          required_maneuvers?: string | null
          source?: string | null
          status?: string | null
          svg_asset_url?: string | null
          tags?: string | null
          theme?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ep_patterns_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "ep_associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ep_patterns_parent_pattern_id_fkey"
            columns: ["parent_pattern_id"]
            isOneToOne: false
            referencedRelation: "ep_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      ep_scoresheet_templates: {
        Row: {
          association_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          discipline: string | null
          fields_schema: Json | null
          id: string
          meta: Json | null
          pdf_template_url: string | null
          updated_at: string
          updated_by: string | null
          version: number | null
        }
        Insert: {
          association_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discipline?: string | null
          fields_schema?: Json | null
          id?: string
          meta?: Json | null
          pdf_template_url?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number | null
        }
        Update: {
          association_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discipline?: string | null
          fields_schema?: Json | null
          id?: string
          meta?: Json | null
          pdf_template_url?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ep_scoresheet_templates_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "ep_associations"
            referencedColumns: ["id"]
          },
        ]
      }
      ep_scoresheets: {
        Row: {
          autofilled_fields: Json | null
          class_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          meta: Json | null
          obstacle_abbrev: string[] | null
          obstacle_text: string[] | null
          pattern_id: string
          pdf_render_url: string | null
          placings: Json | null
          results_pdf_url: string | null
          status: string | null
          template_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          autofilled_fields?: Json | null
          class_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          meta?: Json | null
          obstacle_abbrev?: string[] | null
          obstacle_text?: string[] | null
          pattern_id: string
          pdf_render_url?: string | null
          placings?: Json | null
          results_pdf_url?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          autofilled_fields?: Json | null
          class_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          meta?: Json | null
          obstacle_abbrev?: string[] | null
          obstacle_text?: string[] | null
          pattern_id?: string
          pdf_render_url?: string | null
          placings?: Json | null
          results_pdf_url?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ep_scoresheets_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "ep_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ep_scoresheets_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "ep_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ep_scoresheets_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ep_scoresheet_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ep_show_associations: {
        Row: {
          association_id: string
          show_id: string
        }
        Insert: {
          association_id: string
          show_id: string
        }
        Update: {
          association_id?: string
          show_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ep_show_associations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "ep_associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ep_show_associations_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "ep_shows"
            referencedColumns: ["id"]
          },
        ]
      }
      ep_shows: {
        Row: {
          city: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_date: string | null
          id: string
          meta: Json | null
          name: string
          start_date: string | null
          state: string | null
          timezone: string | null
          updated_at: string
          updated_by: string | null
          venue: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          meta?: Json | null
          name: string
          start_date?: string | null
          state?: string | null
          timezone?: string | null
          updated_at?: string
          updated_by?: string | null
          venue?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          meta?: Json | null
          name?: string
          start_date?: string | null
          state?: string | null
          timezone?: string | null
          updated_at?: string
          updated_by?: string | null
          venue?: string | null
        }
        Relationships: []
      }
      ep_tasks: {
        Row: {
          assigned_to: string | null
          attachments: string[] | null
          audit: Json | null
          comments: Json | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          meta: Json | null
          status: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          attachments?: string[] | null
          audit?: Json | null
          comments?: Json | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta?: Json | null
          status?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          attachments?: string[] | null
          audit?: Json | null
          comments?: Json | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta?: Json | null
          status?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      equipment: {
        Row: {
          asset_tag: string | null
          assigned_to: string | null
          created_at: string | null
          equipment_type: string
          id: string
          notes: string | null
          show_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          asset_tag?: string | null
          assigned_to?: string | null
          created_at?: string | null
          equipment_type: string
          id?: string
          notes?: string | null
          show_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_tag?: string | null
          assigned_to?: string | null
          created_at?: string | null
          equipment_type?: string
          id?: string
          notes?: string | null
          show_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_items: {
        Row: {
          category: string
          condition: string
          created_at: string
          default_home_location_id: string | null
          description: string | null
          id: string
          name: string
          notes: string | null
          total_qty_owned: number
          unit_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          condition?: string
          created_at?: string
          default_home_location_id?: string | null
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          total_qty_owned?: number
          unit_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          condition?: string
          created_at?: string
          default_home_location_id?: string | null
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          total_qty_owned?: number
          unit_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_items_default_home_location_fk"
            columns: ["default_home_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_requirements: {
        Row: {
          aggregation_date: string | null
          aggregation_level: string
          arena_session_id: string | null
          calculated_at: string
          calculation_details: Json
          created_at: string
          equipment_id: string
          id: string
          required_qty: number
          shortage_qty: number
          show_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aggregation_date?: string | null
          aggregation_level?: string
          arena_session_id?: string | null
          calculated_at?: string
          calculation_details?: Json
          created_at?: string
          equipment_id: string
          id?: string
          required_qty?: number
          shortage_qty?: number
          show_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aggregation_date?: string | null
          aggregation_level?: string
          arena_session_id?: string | null
          calculated_at?: string
          calculation_details?: Json
          created_at?: string
          equipment_id?: string
          id?: string
          required_qty?: number
          shortage_qty?: number
          show_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_requirements_arena_session_id_fkey"
            columns: ["arena_session_id"]
            isOneToOne: false
            referencedRelation: "arena_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_requirements_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_requirements_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_transactions: {
        Row: {
          arena_id: string | null
          assigned_to: string | null
          created_at: string
          crew_name: string | null
          equipment_id: string
          from_arena_id: string | null
          id: string
          notes: string | null
          quantity: number
          show_id: string
          to_arena_id: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arena_id?: string | null
          assigned_to?: string | null
          created_at?: string
          crew_name?: string | null
          equipment_id: string
          from_arena_id?: string | null
          id?: string
          notes?: string | null
          quantity: number
          show_id: string
          to_arena_id?: string | null
          transaction_date?: string
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arena_id?: string | null
          assigned_to?: string | null
          created_at?: string
          crew_name?: string | null
          equipment_id?: string
          from_arena_id?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          show_id?: string
          to_arena_id?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_transactions_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_transactions_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_transactions_from_arena_id_fkey"
            columns: ["from_arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_transactions_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_transactions_to_arena_id_fkey"
            columns: ["to_arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          associations: Json | null
          created_at: string | null
          disciplines: Json | null
          end_date: string
          id: string
          judges: Json | null
          location: string | null
          name: string
          officials: Json | null
          pattern_book_id: string | null
          show_facebook: string | null
          show_type: string | null
          show_website: string | null
          start_date: string
          status: string | null
          thumbnail_url: string | null
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          associations?: Json | null
          created_at?: string | null
          disciplines?: Json | null
          end_date: string
          id?: string
          judges?: Json | null
          location?: string | null
          name: string
          officials?: Json | null
          pattern_book_id?: string | null
          show_facebook?: string | null
          show_type?: string | null
          show_website?: string | null
          start_date: string
          status?: string | null
          thumbnail_url?: string | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          associations?: Json | null
          created_at?: string | null
          disciplines?: Json | null
          end_date?: string
          id?: string
          judges?: Json | null
          location?: string | null
          name?: string
          officials?: Json | null
          pattern_book_id?: string | null
          show_facebook?: string | null
          show_type?: string | null
          show_website?: string | null
          start_date?: string
          status?: string | null
          thumbnail_url?: string | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: []
      }
      hotels: {
        Row: {
          address: string | null
          block_code: string | null
          cancellation_policy: string | null
          created_at: string | null
          id: string
          name: string
          show_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          block_code?: string | null
          cancellation_policy?: string | null
          created_at?: string | null
          id?: string
          name: string
          show_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          block_code?: string | null
          cancellation_policy?: string | null
          created_at?: string | null
          id?: string
          name?: string
          show_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotels_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      judge_favorites: {
        Row: {
          association_id: string
          class_id: string | null
          created_at: string | null
          creator_note: string | null
          discipline_id: string
          id: string
          judge_id: string
          pattern_id: number
          rank: number
          updated_at: string | null
        }
        Insert: {
          association_id: string
          class_id?: string | null
          created_at?: string | null
          creator_note?: string | null
          discipline_id: string
          id?: string
          judge_id: string
          pattern_id: number
          rank: number
          updated_at?: string | null
        }
        Update: {
          association_id?: string
          class_id?: string | null
          created_at?: string | null
          creator_note?: string | null
          discipline_id?: string
          id?: string
          judge_id?: string
          pattern_id?: number
          rank?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      judge_notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_read: boolean
          judge_email: string
          judge_name: string | null
          message: string
          notification_type: string
          project_id: string
          project_name: string
          read_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_read?: boolean
          judge_email: string
          judge_name?: string | null
          message: string
          notification_type?: string
          project_id: string
          project_name: string
          read_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_read?: boolean
          judge_email?: string
          judge_name?: string | null
          message?: string
          notification_type?: string
          project_id?: string
          project_name?: string
          read_at?: string | null
        }
        Relationships: []
      }
      locations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketing_content: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          link_url: string | null
          slot: string
          title: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          slot: string
          title?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          slot?: string
          title?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          add_ons: Json | null
          created_at: string | null
          currency: string | null
          id: string
          invoice_id: string | null
          package_id: string | null
          paid_at: string | null
          price: number
          sponsor_id: string | null
        }
        Insert: {
          add_ons?: Json | null
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_id?: string | null
          package_id?: string | null
          paid_at?: string | null
          price: number
          sponsor_id?: string | null
        }
        Update: {
          add_ons?: Json | null
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_id?: string | null
          package_id?: string | null
          paid_at?: string | null
          price?: number
          sponsor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          annual_price: number | null
          base_price: number | null
          created_at: string | null
          cta_text: string | null
          exclusivity_level: string | null
          features: string[]
          id: string
          is_active: boolean | null
          is_annual_only: boolean | null
          is_intro_offer: boolean | null
          is_popular: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          annual_price?: number | null
          base_price?: number | null
          created_at?: string | null
          cta_text?: string | null
          exclusivity_level?: string | null
          features: string[]
          id?: string
          is_active?: boolean | null
          is_annual_only?: boolean | null
          is_intro_offer?: boolean | null
          is_popular?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          annual_price?: number | null
          base_price?: number | null
          created_at?: string | null
          cta_text?: string | null
          exclusivity_level?: string | null
          features?: string[]
          id?: string
          is_active?: boolean | null
          is_annual_only?: boolean | null
          is_intro_offer?: boolean | null
          is_popular?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      pattern_accessory_documents: {
        Row: {
          created_at: string | null
          document_type: string
          file_name: string
          file_path: string
          file_url: string
          id: string
          pattern_id: string
        }
        Insert: {
          created_at?: string | null
          document_type: string
          file_name: string
          file_path: string
          file_url: string
          id?: string
          pattern_id: string
        }
        Update: {
          created_at?: string | null
          document_type?: string
          file_name?: string
          file_path?: string
          file_url?: string
          id?: string
          pattern_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pattern_accessory_documents_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      pattern_associations: {
        Row: {
          association_id: string
          difficulty: string | null
          id: string
          pattern_id: string
        }
        Insert: {
          association_id: string
          difficulty?: string | null
          id?: string
          pattern_id: string
        }
        Update: {
          association_id?: string
          difficulty?: string | null
          id?: string
          pattern_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pattern_associations_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      pattern_change_history: {
        Row: {
          action: string
          admin_email: string | null
          admin_id: string | null
          changes: Json
          created_at: string | null
          id: string
          pattern_set_name: string
          user_id: string
        }
        Insert: {
          action: string
          admin_email?: string | null
          admin_id?: string | null
          changes?: Json
          created_at?: string | null
          id?: string
          pattern_set_name: string
          user_id: string
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_id?: string | null
          changes?: Json
          created_at?: string | null
          id?: string
          pattern_set_name?: string
          user_id?: string
        }
        Relationships: []
      }
      pattern_divisions: {
        Row: {
          association_id: string
          division_group: string
          division_level: string
          id: string
          pattern_id: string
        }
        Insert: {
          association_id: string
          division_group: string
          division_level: string
          id?: string
          pattern_id: string
        }
        Update: {
          association_id?: string
          division_group?: string
          division_level?: string
          id?: string
          pattern_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pattern_divisions_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      patterns: {
        Row: {
          approved_associations: Json | null
          approved_at: string | null
          approved_by: string | null
          approved_package: Json | null
          class_name: string
          created_at: string | null
          discipline_sequence_number: number | null
          display_name: string | null
          file_path: string | null
          file_url: string | null
          final_file_url: string | null
          hierarchy_order: number | null
          id: string
          is_custom: boolean | null
          last_modified_at: string | null
          last_modified_by: string | null
          level: string | null
          name: string
          original_associations: Json | null
          original_file_name: string | null
          pattern_identifier: string | null
          pattern_set_name: string | null
          preview_image_url: string | null
          project_id: string | null
          publication_status: string | null
          rejected_at: string | null
          rejection_reason: string | null
          review_status: string | null
          scoresheet_id: number | null
          updated_at: string | null
          user_id: string
          verbiage: string | null
        }
        Insert: {
          approved_associations?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          approved_package?: Json | null
          class_name: string
          created_at?: string | null
          discipline_sequence_number?: number | null
          display_name?: string | null
          file_path?: string | null
          file_url?: string | null
          final_file_url?: string | null
          hierarchy_order?: number | null
          id?: string
          is_custom?: boolean | null
          last_modified_at?: string | null
          last_modified_by?: string | null
          level?: string | null
          name: string
          original_associations?: Json | null
          original_file_name?: string | null
          pattern_identifier?: string | null
          pattern_set_name?: string | null
          preview_image_url?: string | null
          project_id?: string | null
          publication_status?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          review_status?: string | null
          scoresheet_id?: number | null
          updated_at?: string | null
          user_id: string
          verbiage?: string | null
        }
        Update: {
          approved_associations?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          approved_package?: Json | null
          class_name?: string
          created_at?: string | null
          discipline_sequence_number?: number | null
          display_name?: string | null
          file_path?: string | null
          file_url?: string | null
          final_file_url?: string | null
          hierarchy_order?: number | null
          id?: string
          is_custom?: boolean | null
          last_modified_at?: string | null
          last_modified_by?: string | null
          level?: string | null
          name?: string
          original_associations?: Json | null
          original_file_name?: string | null
          pattern_identifier?: string | null
          pattern_set_name?: string | null
          preview_image_url?: string | null
          project_id?: string | null
          publication_status?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          review_status?: string | null
          scoresheet_id?: number | null
          updated_at?: string | null
          user_id?: string
          verbiage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patterns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_rates: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          ot_multiplier: number | null
          rate_type: string
          role_code: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          ot_multiplier?: number | null
          rate_type: string
          role_code?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          ot_multiplier?: number | null
          rate_type?: string
          role_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_rates_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["role_code"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          code: string
          id: number
          name: string
        }
        Insert: {
          category: string
          code: string
          id?: number
          name: string
        }
        Update: {
          category?: string
          code?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      plan_changes: {
        Row: {
          changed_at: string
          created_at: string
          id: string
          new_price_id: string | null
          new_tier: string | null
          old_price_id: string | null
          old_tier: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          created_at?: string
          id?: string
          new_price_id?: string | null
          new_tier?: string | null
          old_price_id?: string | null
          old_tier?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          created_at?: string
          id?: string
          new_price_id?: string | null
          new_tier?: string | null
          old_price_id?: string | null
          old_tier?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          associations_allowed: string[] | null
          avatar_url: string | null
          free_pattern_book_used: boolean | null
          full_name: string | null
          id: string
          permissions: string[] | null
          role: string | null
          shows_allowed: string[] | null
          stripe_customer_id: string | null
          subscription_current_period_end: string | null
          subscription_status: string | null
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          associations_allowed?: string[] | null
          avatar_url?: string | null
          free_pattern_book_used?: boolean | null
          full_name?: string | null
          id: string
          permissions?: string[] | null
          role?: string | null
          shows_allowed?: string[] | null
          stripe_customer_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          associations_allowed?: string[] | null
          avatar_url?: string | null
          free_pattern_book_used?: boolean | null
          full_name?: string | null
          id?: string
          permissions?: string[] | null
          role?: string | null
          shows_allowed?: string[] | null
          stripe_customer_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_assets: {
        Row: {
          asset_type: string | null
          created_at: string | null
          custom_name: string | null
          customer_id: string | null
          file_name: string | null
          file_url: string | null
          id: string
          project_id: string | null
        }
        Insert: {
          asset_type?: string | null
          created_at?: string | null
          custom_name?: string | null
          customer_id?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          project_id?: string | null
        }
        Update: {
          asset_type?: string | null
          created_at?: string | null
          custom_name?: string | null
          customer_id?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          mode: string | null
          project_data: Json | null
          project_name: string | null
          project_type: string | null
          schedule: Json | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          mode?: string | null
          project_data?: Json | null
          project_name?: string | null
          project_type?: string | null
          schedule?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          mode?: string | null
          project_data?: Json | null
          project_name?: string | null
          project_type?: string | null
          schedule?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount_cents: number
          created_at: string | null
          currency: string | null
          id: string
          metadata: Json | null
          product_type: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          product_type: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          product_type?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_code: string
          role_code: string
        }
        Insert: {
          permission_code: string
          role_code: string
        }
        Update: {
          permission_code?: string
          role_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "role_permissions_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["role_code"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          id: string
          min_call_time_minutes: number | null
          name: string
          role_code: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          min_call_time_minutes?: number | null
          name: string
          role_code: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          min_call_time_minutes?: number | null
          name?: string
          role_code?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      schedule_events: {
        Row: {
          arena_id: string
          class_id: string | null
          created_at: string | null
          end_time: string
          event_date: string
          id: string
          notes: string | null
          project_id: string | null
          start_time: string
          title: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          arena_id: string
          class_id?: string | null
          created_at?: string | null
          end_time: string
          event_date: string
          id?: string
          notes?: string | null
          project_id?: string | null
          start_time: string
          title?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          arena_id?: string
          class_id?: string | null
          created_at?: string | null
          end_time?: string
          event_date?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          start_time?: string
          title?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          assignment_id: string | null
          break_minutes: number | null
          created_at: string | null
          employee_id: string | null
          id: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          assignment_id?: string | null
          break_minutes?: number | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          assignment_id?: string | null
          break_minutes?: number | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      show_fees: {
        Row: {
          amount: number
          apply_per_judge: boolean | null
          association_specific: string | null
          created_at: string | null
          due_date: string | null
          id: string
          late_fee_amount: number | null
          name: string
          notes: string | null
          payment_timing: string | null
          project_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          apply_per_judge?: boolean | null
          association_specific?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          late_fee_amount?: number | null
          name: string
          notes?: string | null
          payment_timing?: string | null
          project_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          apply_per_judge?: boolean | null
          association_specific?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          late_fee_amount?: number | null
          name?: string
          notes?: string | null
          payment_timing?: string | null
          project_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "show_fees_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      show_staff: {
        Row: {
          association_id: string | null
          cards_held: string | null
          created_at: string
          day_fee: number | null
          email: string | null
          employment_end_date: string | null
          employment_start_date: string | null
          has_overtime: boolean | null
          id: string
          name: string | null
          overtime_hours_threshold: number | null
          overtime_rate_per_hour: number | null
          phone: string | null
          project_id: string | null
          reimbursable_expenses: Json | null
          role_id: string
          updated_at: string
        }
        Insert: {
          association_id?: string | null
          cards_held?: string | null
          created_at?: string
          day_fee?: number | null
          email?: string | null
          employment_end_date?: string | null
          employment_start_date?: string | null
          has_overtime?: boolean | null
          id?: string
          name?: string | null
          overtime_hours_threshold?: number | null
          overtime_rate_per_hour?: number | null
          phone?: string | null
          project_id?: string | null
          reimbursable_expenses?: Json | null
          role_id: string
          updated_at?: string
        }
        Update: {
          association_id?: string | null
          cards_held?: string | null
          created_at?: string
          day_fee?: number | null
          email?: string | null
          employment_end_date?: string | null
          employment_start_date?: string | null
          has_overtime?: boolean | null
          id?: string
          name?: string | null
          overtime_hours_threshold?: number | null
          overtime_rate_per_hour?: number | null
          phone?: string | null
          project_id?: string | null
          reimbursable_expenses?: Json | null
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_staff_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_staff_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["role_code"]
          },
        ]
      }
      site_branding: {
        Row: {
          background_url: string | null
          id: string
          logo_url: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          background_url?: string | null
          id: string
          logo_url?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          background_url?: string | null
          id?: string
          logo_url?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sponsors: {
        Row: {
          category: string | null
          contact_email: string | null
          created_at: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string | null
          tier: string | null
          updated_at: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          contact_email?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string | null
          tier?: string | null
          updated_at?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          contact_email?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string | null
          tier?: string | null
          updated_at?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          tier: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          tier: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string
          stripe_subscription_id?: string
          tier?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string | null
          description: string
          due_time: string | null
          id: string
          is_completed: boolean | null
          shift_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          due_time?: string | null
          id?: string
          is_completed?: boolean | null
          shift_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          due_time?: string | null
          id?: string
          is_completed?: boolean | null
          shift_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      tbl_maneuvers: {
        Row: {
          created_at: string | null
          id: number
          instruction: string
          pattern_id: number | null
          step_no: number
        }
        Insert: {
          created_at?: string | null
          id?: never
          instruction: string
          pattern_id?: number | null
          step_no: number
        }
        Update: {
          created_at?: string | null
          id?: never
          instruction?: string
          pattern_id?: number | null
          step_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "tbl_maneuvers_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "tbl_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      tbl_pattern_media: {
        Row: {
          association_abbrev: string | null
          created_at: string | null
          discipline: string | null
          file_name: string | null
          file_path: string | null
          file_url: string | null
          id: number
          image_url: string
          page_no: number | null
          pattern_id: number | null
          pattern_version: string | null
          storage_path: string | null
        }
        Insert: {
          association_abbrev?: string | null
          created_at?: string | null
          discipline?: string | null
          file_name?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: never
          image_url: string
          page_no?: number | null
          pattern_id?: number | null
          pattern_version?: string | null
          storage_path?: string | null
        }
        Update: {
          association_abbrev?: string | null
          created_at?: string | null
          discipline?: string | null
          file_name?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: never
          image_url?: string
          page_no?: number | null
          pattern_id?: number | null
          pattern_version?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbl_pattern_media_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "tbl_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      tbl_patterns: {
        Row: {
          association_name: string
          created_at: string | null
          discipline: string
          division: string
          division_level: string | null
          id: number
          maneuvers_range: string | null
          page_no: number | null
          pattern_date: string | null
          pattern_version: string | null
          pdf_file_name: string | null
        }
        Insert: {
          association_name: string
          created_at?: string | null
          discipline: string
          division: string
          division_level?: string | null
          id?: never
          maneuvers_range?: string | null
          page_no?: number | null
          pattern_date?: string | null
          pattern_version?: string | null
          pdf_file_name?: string | null
        }
        Update: {
          association_name?: string
          created_at?: string | null
          discipline?: string
          division?: string
          division_level?: string | null
          id?: never
          maneuvers_range?: string | null
          page_no?: number | null
          pattern_date?: string | null
          pattern_version?: string | null
          pdf_file_name?: string | null
        }
        Relationships: []
      }
      tbl_pdf_uploads: {
        Row: {
          created_at: string | null
          file_name: string
          id: number
          processed: boolean | null
          processed_at: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          id?: never
          processed?: boolean | null
          processed_at?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          id?: never
          processed?: boolean | null
          processed_at?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      tbl_scoresheet: {
        Row: {
          association_abbrev: string | null
          city_state: string | null
          created_at: string
          discipline: string | null
          file_name: string
          file_path: string | null
          id: number
          image_url: string | null
          pattern_id: number | null
          pattern_version: string | null
          storage_path: string | null
        }
        Insert: {
          association_abbrev?: string | null
          city_state?: string | null
          created_at?: string
          discipline?: string | null
          file_name?: string
          file_path?: string | null
          id?: number
          image_url?: string | null
          pattern_id?: number | null
          pattern_version?: string | null
          storage_path?: string | null
        }
        Update: {
          association_abbrev?: string | null
          city_state?: string | null
          created_at?: string
          discipline?: string | null
          file_name?: string
          file_path?: string | null
          id?: number
          image_url?: string | null
          pattern_id?: number | null
          pattern_version?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tbl_scoresheet_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "tbl_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved_by: string | null
          clock_in: string | null
          clock_out: string | null
          created_at: string | null
          id: string
          shift_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          approved_by?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          id?: string
          shift_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_by?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          id?: string
          shift_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      travel: {
        Row: {
          arrival_datetime: string | null
          created_at: string | null
          departure_datetime: string | null
          details: Json | null
          employee_id: string | null
          id: string
          show_id: string | null
          travel_type: string
          updated_at: string | null
        }
        Insert: {
          arrival_datetime?: string | null
          created_at?: string | null
          departure_datetime?: string | null
          details?: Json | null
          employee_id?: string | null
          id?: string
          show_id?: string | null
          travel_type: string
          updated_at?: string | null
        }
        Update: {
          arrival_datetime?: string | null
          created_at?: string | null
          departure_datetime?: string | null
          details?: Json | null
          employee_id?: string | null
          id?: string
          show_id?: string | null
          travel_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travel_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_purposes: {
        Row: {
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          id: string
          name: string
          sort_order?: number | null
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          name: string
          show_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          name: string
          show_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          name?: string
          show_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_rejected_patterns: { Args: never; Returns: undefined }
      get_auth_user_emails: {
        Args: { user_ids: string[] }
        Returns: {
          created_at: string
          email: string
          id: string
        }[]
      }
      get_my_permissions: { Args: never; Returns: string[] }
      get_my_role: { Args: never; Returns: string }
      get_my_shows: {
        Args: never
        Returns: {
          city: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_date: string | null
          id: string
          meta: Json | null
          name: string
          start_date: string | null
          state: string | null
          timezone: string | null
          updated_at: string
          updated_by: string | null
          venue: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ep_shows"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_pattern_creator_id: {
        Args: { p_pattern_id: string }
        Returns: string
      }
      has_permission: { Args: { p_permission_code: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_assigned_to_show: {
        Args: { show_id_to_check: string }
        Returns: boolean
      }
      search_classes: {
        Args: { keyword: string }
        Returns: {
          association_id: string
          category: string
          id: string
          name: string
          sort_order: number
        }[]
      }
      search_disciplines: {
        Args: { keyword: string }
        Returns: {
          association_id: string | null
          category: string | null
          city: string | null
          description: string | null
          discipline_group: string | null
          id: string
          name: string
          open_divisions: boolean | null
          pattern_type: string | null
          rules_json: Json | null
          sort_order: number | null
          sub_association_type: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "disciplines"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_divisions: {
        Args: { keyword: string }
        Returns: {
          association_id: string | null
          id: string
          name: string
          sort_order: number | null
          sub_association_type: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "divisions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
