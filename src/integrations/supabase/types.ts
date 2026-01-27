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
      agents: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string
          id: string
          is_active: boolean | null
          updated_at: string | null
          whatsapp_phone: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          whatsapp_phone: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          whatsapp_phone?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          agent_id: string
          attended: boolean | null
          checked_in_at: string | null
          confirmed: boolean | null
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          scheduled_date: string
          scheduled_time: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          attended?: boolean | null
          checked_in_at?: string | null
          confirmed?: boolean | null
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          scheduled_date: string
          scheduled_time: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          attended?: boolean | null
          checked_in_at?: string | null
          confirmed?: boolean | null
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          scheduled_date?: string
          scheduled_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          attendance_date: string
          class_id: string
          created_at: string
          id: string
          marked_by: string | null
          notes: string | null
          status: string
          student_id: string
        }
        Insert: {
          attendance_date: string
          class_id: string
          created_at?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          status: string
          student_id: string
        }
        Update: {
          attendance_date?: string
          class_id?: string
          created_at?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      call_logs: {
        Row: {
          agent_id: string
          call_type: string
          created_at: string
          duration_seconds: number | null
          id: string
          lead_id: string
          notes: string | null
          result: string
          scheduled_callback_at: string | null
        }
        Insert: {
          agent_id: string
          call_type: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          lead_id: string
          notes?: string | null
          result: string
          scheduled_callback_at?: string | null
        }
        Update: {
          agent_id?: string
          call_type?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          lead_id?: string
          notes?: string | null
          result?: string
          scheduled_callback_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      class_enrollments: {
        Row: {
          class_id: string
          created_at: string
          enrollment_id: string
          id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          enrollment_id: string
          id?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          enrollment_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          course_id: string
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean | null
          max_students: number | null
          name: string
          room: string | null
          schedule: Json | null
          start_date: string
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_students?: number | null
          name: string
          room?: string | null
          schedule?: Json | null
          start_date: string
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_students?: number | null
          name?: string
          room?: string | null
          schedule?: Json | null
          start_date?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      content_progress: {
        Row: {
          completed_at: string | null
          content_id: string
          created_at: string
          enrollment_id: string
          id: string
          started_at: string | null
          total_seconds: number | null
          updated_at: string
          watched_seconds: number
        }
        Insert: {
          completed_at?: string | null
          content_id: string
          created_at?: string
          enrollment_id: string
          id?: string
          started_at?: string | null
          total_seconds?: number | null
          updated_at?: string
          watched_seconds?: number
        }
        Update: {
          completed_at?: string | null
          content_id?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          started_at?: string | null
          total_seconds?: number | null
          updated_at?: string
          watched_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_progress_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "lesson_contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          created_at: string
          discount: number | null
          enrollment_id: string
          id: string
          installments: number
          notes: string | null
          payment_day: number
          signed_at: string | null
          signed_document_url: string | null
          status: string
          total_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount?: number | null
          enrollment_id: string
          id?: string
          installments?: number
          notes?: string | null
          payment_day?: number
          signed_at?: string | null
          signed_document_url?: string | null
          status?: string
          total_value: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount?: number | null
          enrollment_id?: string
          id?: string
          installments?: number
          notes?: string | null
          payment_day?: number
          signed_at?: string | null
          signed_document_url?: string | null
          status?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          duration_hours: number | null
          id: string
          is_active: boolean
          modality: Database["public"]["Enums"]["course_modality"]
          name: string
          price: number | null
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_active?: boolean
          modality?: Database["public"]["Enums"]["course_modality"]
          name: string
          price?: number | null
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_active?: boolean
          modality?: Database["public"]["Enums"]["course_modality"]
          name?: string
          price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      csv_imports: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_log: Json | null
          failed_rows: number | null
          file_name: string
          id: string
          imported_by: string | null
          imported_rows: number | null
          status: string | null
          total_rows: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_log?: Json | null
          failed_rows?: number | null
          file_name: string
          id?: string
          imported_by?: string | null
          imported_rows?: number | null
          status?: string | null
          total_rows: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_log?: Json | null
          failed_rows?: number | null
          file_name?: string
          id?: string
          imported_by?: string | null
          imported_rows?: number | null
          status?: string | null
          total_rows?: number
        }
        Relationships: []
      }
      custom_fields: {
        Row: {
          created_at: string | null
          entity_type: string
          field_label: string
          field_name: string
          field_type: string
          id: string
          is_active: boolean | null
          is_required: boolean | null
          options: Json | null
          order_index: number | null
        }
        Insert: {
          created_at?: string | null
          entity_type?: string
          field_label: string
          field_name: string
          field_type: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          options?: Json | null
          order_index?: number | null
        }
        Update: {
          created_at?: string | null
          entity_type?: string
          field_label?: string
          field_name?: string
          field_type?: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          options?: Json | null
          order_index?: number | null
        }
        Relationships: []
      }
      enrollment_history: {
        Row: {
          changed_by: string | null
          created_at: string
          enrollment_id: string
          from_status: Database["public"]["Enums"]["academic_status"] | null
          id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["academic_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          enrollment_id: string
          from_status?: Database["public"]["Enums"]["academic_status"] | null
          id?: string
          notes?: string | null
          to_status: Database["public"]["Enums"]["academic_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          enrollment_id?: string
          from_status?: Database["public"]["Enums"]["academic_status"] | null
          id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["academic_status"]
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_history_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          certificate_issued: boolean | null
          certificate_issued_at: string | null
          class_id: string | null
          completed_at: string | null
          course_id: string
          created_at: string
          enrolled_at: string
          enrollment_type: Database["public"]["Enums"]["enrollment_type"] | null
          grade: number | null
          id: string
          influencer_name: string | null
          lead_id: string | null
          notes: string | null
          progress_percentage: number | null
          referral_agent_code: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["academic_status"]
          student_age: number | null
          student_id: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          certificate_issued?: boolean | null
          certificate_issued_at?: string | null
          class_id?: string | null
          completed_at?: string | null
          course_id: string
          created_at?: string
          enrolled_at?: string
          enrollment_type?:
            | Database["public"]["Enums"]["enrollment_type"]
            | null
          grade?: number | null
          id?: string
          influencer_name?: string | null
          lead_id?: string | null
          notes?: string | null
          progress_percentage?: number | null
          referral_agent_code?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["academic_status"]
          student_age?: number | null
          student_id: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          certificate_issued?: boolean | null
          certificate_issued_at?: string | null
          class_id?: string | null
          completed_at?: string | null
          course_id?: string
          created_at?: string
          enrolled_at?: string
          enrollment_type?:
            | Database["public"]["Enums"]["enrollment_type"]
            | null
          grade?: number | null
          id?: string
          influencer_name?: string | null
          lead_id?: string | null
          notes?: string | null
          progress_percentage?: number | null
          referral_agent_code?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["academic_status"]
          student_age?: number | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      influencers: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      lead_custom_values: {
        Row: {
          created_at: string | null
          field_id: string
          id: string
          lead_id: string
          updated_at: string | null
          value_boolean: boolean | null
          value_date: string | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string | null
          field_id: string
          id?: string
          lead_id: string
          updated_at?: string | null
          value_boolean?: boolean | null
          value_date?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string | null
          field_id?: string
          id?: string
          lead_id?: string
          updated_at?: string | null
          value_boolean?: boolean | null
          value_date?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_custom_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_custom_values_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["lead_status"] | null
          id: string
          lead_id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["lead_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          lead_id: string
          notes?: string | null
          to_status: Database["public"]["Enums"]["lead_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          lead_id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["lead_status"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          ad_name: string | null
          ad_set: string | null
          assigned_agent_id: string | null
          assigned_producer_id: string | null
          attended_at: string | null
          campaign: string | null
          course_interest_id: string | null
          created_at: string
          email: string | null
          enrolled_at: string | null
          external_id: string | null
          external_source: string | null
          full_name: string
          guardian_name: string | null
          id: string
          lost_at: string | null
          notes: string | null
          phone: string
          proposal_at: string | null
          scheduled_at: string | null
          source: Database["public"]["Enums"]["lead_source"]
          source_id: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          ad_name?: string | null
          ad_set?: string | null
          assigned_agent_id?: string | null
          assigned_producer_id?: string | null
          attended_at?: string | null
          campaign?: string | null
          course_interest_id?: string | null
          created_at?: string
          email?: string | null
          enrolled_at?: string | null
          external_id?: string | null
          external_source?: string | null
          full_name: string
          guardian_name?: string | null
          id?: string
          lost_at?: string | null
          notes?: string | null
          phone: string
          proposal_at?: string | null
          scheduled_at?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          source_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          ad_name?: string | null
          ad_set?: string | null
          assigned_agent_id?: string | null
          assigned_producer_id?: string | null
          attended_at?: string | null
          campaign?: string | null
          course_interest_id?: string | null
          created_at?: string
          email?: string | null
          enrolled_at?: string | null
          external_id?: string | null
          external_source?: string | null
          full_name?: string
          guardian_name?: string | null
          id?: string
          lost_at?: string | null
          notes?: string | null
          phone?: string
          proposal_at?: string | null
          scheduled_at?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          source_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_producer_id_fkey"
            columns: ["assigned_producer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "leads_course_interest_id_fkey"
            columns: ["course_interest_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_contents: {
        Row: {
          content_text: string | null
          content_type: Database["public"]["Enums"]["content_type"]
          content_url: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          is_active: boolean
          lesson_id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          content_text?: string | null
          content_type?: Database["public"]["Enums"]["content_type"]
          content_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          lesson_id: string
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          content_text?: string | null
          content_type?: Database["public"]["Enums"]["content_type"]
          content_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          lesson_id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_contents_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          enrollment_id: string
          id: string
          last_position_seconds: number | null
          lesson_id: string
          progress_percentage: number
          started_at: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          last_position_seconds?: number | null
          lesson_id: string
          progress_percentage?: number
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          last_position_seconds?: number | null
          lesson_id?: string
          progress_percentage?: number
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean
          module_id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          module_id: string
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          module_id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          due_date: string
          id: string
          installment_number: number
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      student_profiles: {
        Row: {
          available_for_casting: boolean | null
          bio: string | null
          bust_cm: number | null
          created_at: string
          eye_color: string | null
          followers_count: number | null
          hair_color: string | null
          height_cm: number | null
          hip_cm: number | null
          id: string
          instagram_handle: string | null
          portfolio_url: string | null
          shoe_size: number | null
          skin_tone: string | null
          tiktok_handle: string | null
          updated_at: string
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
          youtube_channel: string | null
        }
        Insert: {
          available_for_casting?: boolean | null
          bio?: string | null
          bust_cm?: number | null
          created_at?: string
          eye_color?: string | null
          followers_count?: number | null
          hair_color?: string | null
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          instagram_handle?: string | null
          portfolio_url?: string | null
          shoe_size?: number | null
          skin_tone?: string | null
          tiktok_handle?: string | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
          youtube_channel?: string | null
        }
        Update: {
          available_for_casting?: boolean | null
          bio?: string | null
          bust_cm?: number | null
          created_at?: string
          eye_color?: string | null
          followers_count?: number | null
          hair_color?: string | null
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          instagram_handle?: string | null
          portfolio_url?: string | null
          shoe_size?: number | null
          skin_tone?: string | null
          tiktok_handle?: string | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
          youtube_channel?: string | null
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
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      academic_status:
        | "ativo"
        | "em_curso"
        | "inadimplente"
        | "evasao"
        | "concluido"
        | "trancado"
      app_role:
        | "admin"
        | "gestor"
        | "agente_comercial"
        | "recepcao"
        | "professor"
        | "produtor"
        | "scouter"
        | "aluno"
      content_type: "video" | "text" | "file" | "quiz"
      course_modality: "presencial" | "online" | "hibrido"
      enrollment_type:
        | "modelo_agenciado_maxfama"
        | "modelo_agenciado_popschool"
        | "indicacao_influencia"
        | "indicacao_aluno"
      lead_source:
        | "whatsapp"
        | "instagram"
        | "facebook"
        | "google"
        | "indicacao"
        | "site"
        | "presencial"
        | "outro"
      lead_status:
        | "lead"
        | "em_atendimento"
        | "agendado"
        | "confirmado"
        | "compareceu"
        | "proposta"
        | "matriculado"
        | "perdido"
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
      academic_status: [
        "ativo",
        "em_curso",
        "inadimplente",
        "evasao",
        "concluido",
        "trancado",
      ],
      app_role: [
        "admin",
        "gestor",
        "agente_comercial",
        "recepcao",
        "professor",
        "produtor",
        "scouter",
        "aluno",
      ],
      content_type: ["video", "text", "file", "quiz"],
      course_modality: ["presencial", "online", "hibrido"],
      enrollment_type: [
        "modelo_agenciado_maxfama",
        "modelo_agenciado_popschool",
        "indicacao_influencia",
        "indicacao_aluno",
      ],
      lead_source: [
        "whatsapp",
        "instagram",
        "facebook",
        "google",
        "indicacao",
        "site",
        "presencial",
        "outro",
      ],
      lead_status: [
        "lead",
        "em_atendimento",
        "agendado",
        "confirmado",
        "compareceu",
        "proposta",
        "matriculado",
        "perdido",
      ],
    },
  },
} as const
