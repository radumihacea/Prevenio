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
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          created_at: string
          doctor_id: string
          id: string
          patient_id: string | null
          patient_name: string
          patient_phone: string | null
          reason: string | null
          source: string
          status: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          created_at?: string
          doctor_id: string
          id?: string
          patient_id?: string | null
          patient_name: string
          patient_phone?: string | null
          reason?: string | null
          source?: string
          status?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          created_at?: string
          doctor_id?: string
          id?: string
          patient_id?: string | null
          patient_name?: string
          patient_phone?: string | null
          reason?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          auth_email: string | null
          cabinet_name: string | null
          created_at: string
          full_name: string
          id: string
          parafa_code: string
          slug: string
          specialty: string
          work_end_time: string
          work_start_time: string
          working_days: number[]
        }
        Insert: {
          auth_email?: string | null
          cabinet_name?: string | null
          created_at?: string
          full_name: string
          id?: string
          parafa_code: string
          slug: string
          specialty?: string
          work_end_time?: string
          work_start_time?: string
          working_days?: number[]
        }
        Update: {
          auth_email?: string | null
          cabinet_name?: string | null
          created_at?: string
          full_name?: string
          id?: string
          parafa_code?: string
          slug?: string
          specialty?: string
          work_end_time?: string
          work_start_time?: string
          working_days?: number[]
        }
        Relationships: []
      }
      patients: {
        Row: {
          address: string | null
          birth_date: string | null
          cnp: string | null
          conditions: string[]
          created_at: string
          doctor_id: string
          full_name: string
          id: string
          last_bp_check: string | null
          last_lab_date: string | null
          last_visit: string | null
          phone: string | null
          vaccinated_flu: boolean
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          cnp?: string | null
          conditions?: string[]
          created_at?: string
          doctor_id: string
          full_name: string
          id?: string
          last_bp_check?: string | null
          last_lab_date?: string | null
          last_visit?: string | null
          phone?: string | null
          vaccinated_flu?: boolean
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          cnp?: string | null
          conditions?: string[]
          created_at?: string
          doctor_id?: string
          full_name?: string
          id?: string
          last_bp_check?: string | null
          last_lab_date?: string | null
          last_visit?: string | null
          phone?: string | null
          vaccinated_flu?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "patients_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_log: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          message: string
          recipient_name: string | null
          recipient_phone: string
          status: string
          tag: string | null
          template_id: string | null
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          message: string
          recipient_name?: string | null
          recipient_phone: string
          status?: string
          tag?: string | null
          template_id?: string | null
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          message?: string
          recipient_name?: string | null
          recipient_phone?: string
          status?: string
          tag?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_log_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      tokenuri_sms: {
        Row: {
          created_at: string
          expira_la: string
          folosit: boolean
          id: string
          patient_id: string | null
          patient_name: string | null
          phone: string
          token: string
        }
        Insert: {
          created_at?: string
          expira_la?: string
          folosit?: boolean
          id?: string
          patient_id?: string | null
          patient_name?: string | null
          phone: string
          token?: string
        }
        Update: {
          created_at?: string
          expira_la?: string
          folosit?: boolean
          id?: string
          patient_id?: string | null
          patient_name?: string | null
          phone?: string
          token?: string
        }
        Relationships: []
      }
      vaccinations: {
        Row: {
          administered_by: string | null
          administered_date: string
          adverse_reactions: string | null
          created_at: string
          dose_number: number
          id: string
          lot_number: string | null
          manufacturer: string | null
          next_due_date: string | null
          notes: string | null
          patient_id: string
          vaccine_id: string | null
          vaccine_name: string
        }
        Insert: {
          administered_by?: string | null
          administered_date: string
          adverse_reactions?: string | null
          created_at?: string
          dose_number?: number
          id?: string
          lot_number?: string | null
          manufacturer?: string | null
          next_due_date?: string | null
          notes?: string | null
          patient_id: string
          vaccine_id?: string | null
          vaccine_name: string
        }
        Update: {
          administered_by?: string | null
          administered_date?: string
          adverse_reactions?: string | null
          created_at?: string
          dose_number?: number
          id?: string
          lot_number?: string | null
          manufacturer?: string | null
          next_due_date?: string | null
          notes?: string | null
          patient_id?: string
          vaccine_id?: string | null
          vaccine_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccinations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_vaccine_id_fkey"
            columns: ["vaccine_id"]
            isOneToOne: false
            referencedRelation: "vaccine_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccine_catalog: {
        Row: {
          created_at: string
          disease: string
          doses_required: number
          id: string
          interval_months: number | null
          mandatory: boolean
          manufacturer: string | null
          name: string
          notes: string | null
          recommended_age_months: number | null
          seasonal: boolean
        }
        Insert: {
          created_at?: string
          disease: string
          doses_required?: number
          id?: string
          interval_months?: number | null
          mandatory?: boolean
          manufacturer?: string | null
          name: string
          notes?: string | null
          recommended_age_months?: number | null
          seasonal?: boolean
        }
        Update: {
          created_at?: string
          disease?: string
          doses_required?: number
          id?: string
          interval_months?: number | null
          mandatory?: boolean
          manufacturer?: string | null
          name?: string
          notes?: string | null
          recommended_age_months?: number | null
          seasonal?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
