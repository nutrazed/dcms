/**
 * Supabase Database Types
 * Auto-generated via: pnpm db:types
 * Regenerate after any schema migration with: supabase gen types typescript --local
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type DocumentStatus    = 'draft' | 'under_review' | 'approved' | 'obsolete'
export type DocumentType      = 'policy' | 'procedure' | 'work_instruction' | 'form' | 'record'
export type SecurityClass     = 'public' | 'internal' | 'confidential' | 'restricted'
export type UserRole          = 'admin' | 'editor' | 'reviewer' | 'viewer'
export type ReviewerStatus    = 'pending' | 'approved' | 'rejected' | 'abstained'

export interface Database {
   __InternalSupabase: {
    PostgrestVersion: '12'
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          id:          string
          full_name:   string
          department:  string
          role:        UserRole
          avatar_url:  string | null
          created_at:  string
          updated_at:  string
        }
        Insert: {
          id:          string
          full_name:   string
          department:  string
          role?:       UserRole
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      folders: {
        Row: {
          id:               string
          parent_id:        string | null
          name:             string
          path:             string
          functional_area:  string
          owner_dept:       string
          created_by:       string | null
          created_at:       string
        }
        Insert: {
          id?:              string
          parent_id?:       string | null
          name:             string
          path:             string
          functional_area:  string
          owner_dept:       string
          created_by?:      string | null
          created_at?:      string
        }
        Update: Partial<Database['public']['Tables']['folders']['Insert']>
      }
      documents: {
        Row: {
          id:                   string
          folder_id:            string
          doc_code:             string
          title:                string
          doc_type:             DocumentType
          functional_area:      string
          owner_id:             string | null
          current_rev_id:       string | null
          status:               DocumentStatus
          security_class:       SecurityClass
          retention_years:      number
          effective_date:       string | null
          review_due_date:      string | null  // generated column
          fts_vector:           string | null  // generated column
          tags:                 string[]
          applicable_standards: string[]
          deleted_at:           string | null
          created_at:           string
          updated_at:           string
        }
        Insert: {
          id?:                   string
          folder_id:             string
          doc_code:              string
          title:                 string
          doc_type:              DocumentType
          functional_area:       string
          owner_id?:             string | null
          current_rev_id?:       string | null
          status?:               DocumentStatus
          security_class?:       SecurityClass
          retention_years?:      number
          effective_date?:       string | null
          tags?:                 string[]
          applicable_standards?: string[]
          deleted_at?:           string | null
          created_at?:           string
          updated_at?:           string
        }
        Update: Partial<Database['public']['Tables']['documents']['Insert']>
      }
      revisions: {
        Row: {
          id:              string
          document_id:     string
          major:           number
          minor:           number
          version_label:   string  // generated column
          storage_path:    string
          file_hash:       string
          change_summary:  string
          authored_by:     string
          approved_by:     string | null
          approved_at:     string | null
          esig_hash:       string | null
          created_at:      string
        }
        Insert: {
          id?:             string
          document_id:     string
          major?:          number
          minor?:          number
          storage_path:    string
          file_hash:       string
          change_summary:  string
          authored_by:     string
          approved_by?:    string | null
          approved_at?:    string | null
          esig_hash?:      string | null
          created_at?:     string
        }
        Update: Partial<Database['public']['Tables']['revisions']['Insert']>
      }
      audit_logs: {
        Row: {
          id:           number
          event_type:   string
          actor_id:     string
          document_id:  string | null
          revision_id:  string | null
          ip_address:   string | null
          user_agent:   string | null
          metadata:     Json
          prev_hash:    string | null
          row_hash:     string
          logged_at:    string
        }
        Insert: {
          id?:          number
          event_type:   string
          actor_id:     string
          document_id?: string | null
          revision_id?: string | null
          ip_address?:  string | null
          user_agent?:  string | null
          metadata?:    Json
          prev_hash?:   string | null
          row_hash:     string
          logged_at?:   string
        }
        Update: never  // Audit logs are immutable
      }
      document_reviewers: {
        Row: {
          id:           string
          document_id:  string
          reviewer_id:  string
          status:       ReviewerStatus
          comments:     string | null
          reviewed_at:  string | null
          assigned_at:  string
        }
        Insert: {
          id?:          string
          document_id:  string
          reviewer_id:  string
          status?:      ReviewerStatus
          comments?:    string | null
          reviewed_at?: string | null
          assigned_at?: string
        }
        Update: Partial<Pick<Database['public']['Tables']['document_reviewers']['Row'],
          'status' | 'comments' | 'reviewed_at'>>
      }
      notifications: {
        Row: {
          id:           string
          user_id:      string
          type:         string
          title:        string
          body:         string | null
          document_id:  string | null
          read_at:      string | null
          created_at:   string
        }
        Insert: {
          id?:          string
          user_id:      string
          type:         string
          title:        string
          body?:        string | null
          document_id?: string | null
          read_at?:     string | null
          created_at?:  string
        }
        Update: Partial<Pick<Database['public']['Tables']['notifications']['Row'], 'read_at'>>
      }
    }
    Views:     { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums:     { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
