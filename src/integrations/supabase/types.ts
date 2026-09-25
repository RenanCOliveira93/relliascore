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
      analises: {
        Row: {
          action_plan: Json | null
          ai_crawler_access: Json | null
          analysis_mode: string | null
          citation_readiness: Json | null
          content_claims: Json | null
          content_score: number | null
          content_score_partial: boolean | null
          created_at: string
          current_vs_ideal: Json | null
          dados_marca: Json | null
          dim_citation_readiness: number | null
          dim_entity_clarity: number | null
          dim_evidence_authority: number | null
          dim_semantic_relevance: number | null
          dim_technical_geo: number | null
          empresa_id: string | null
          entity_clarity: Json | null
          entity_signals: Json | null
          evidence_readiness: Json | null
          id: string
          improvements: Json | null
          input_type: string | null
          keywords_analysis: Json | null
          optimized_version: string | null
          origem: string
          page_type: string | null
          page_type_confidence: number | null
          page_type_source: string | null
          request_id: string | null
          schema_version: string | null
          score: number | null
          score_dimensions: Json | null
          score_version: string | null
          search_query: string | null
          strengths: Json | null
          structured_data_recommendations: Json | null
          sub_scores: Json | null
          summary: string | null
          technical_geo_coverage: number | null
          technical_geo_critical_issues: Json | null
          technical_geo_quick_wins: Json | null
          technical_geo_rules: Json | null
          technical_geo_version: string | null
          technical_signals: Json | null
          tipo: string
          user_id: string
          website_url: string | null
          weights_applied: Json | null
          workspace_id: string
        }
        Insert: {
          action_plan?: Json | null
          ai_crawler_access?: Json | null
          analysis_mode?: string | null
          citation_readiness?: Json | null
          content_claims?: Json | null
          content_score?: number | null
          content_score_partial?: boolean | null
          created_at?: string
          current_vs_ideal?: Json | null
          dados_marca?: Json | null
          dim_citation_readiness?: number | null
          dim_entity_clarity?: number | null
          dim_evidence_authority?: number | null
          dim_semantic_relevance?: number | null
          dim_technical_geo?: number | null
          empresa_id?: string | null
          entity_clarity?: Json | null
          entity_signals?: Json | null
          evidence_readiness?: Json | null
          id?: string
          improvements?: Json | null
          input_type?: string | null
          keywords_analysis?: Json | null
          optimized_version?: string | null
          origem?: string
          page_type?: string | null
          page_type_confidence?: number | null
          page_type_source?: string | null
          request_id?: string | null
          schema_version?: string | null
          score?: number | null
          score_dimensions?: Json | null
          score_version?: string | null
          search_query?: string | null
          strengths?: Json | null
          structured_data_recommendations?: Json | null
          sub_scores?: Json | null
          summary?: string | null
          technical_geo_coverage?: number | null
          technical_geo_critical_issues?: Json | null
          technical_geo_quick_wins?: Json | null
          technical_geo_rules?: Json | null
          technical_geo_version?: string | null
          technical_signals?: Json | null
          tipo: string
          user_id: string
          website_url?: string | null
          weights_applied?: Json | null
          workspace_id: string
        }
        Update: {
          action_plan?: Json | null
          ai_crawler_access?: Json | null
          analysis_mode?: string | null
          citation_readiness?: Json | null
          content_claims?: Json | null
          content_score?: number | null
          content_score_partial?: boolean | null
          created_at?: string
          current_vs_ideal?: Json | null
          dados_marca?: Json | null
          dim_citation_readiness?: number | null
          dim_entity_clarity?: number | null
          dim_evidence_authority?: number | null
          dim_semantic_relevance?: number | null
          dim_technical_geo?: number | null
          empresa_id?: string | null
          entity_clarity?: Json | null
          entity_signals?: Json | null
          evidence_readiness?: Json | null
          id?: string
          improvements?: Json | null
          input_type?: string | null
          keywords_analysis?: Json | null
          optimized_version?: string | null
          origem?: string
          page_type?: string | null
          page_type_confidence?: number | null
          page_type_source?: string | null
          request_id?: string | null
          schema_version?: string | null
          score?: number | null
          score_dimensions?: Json | null
          score_version?: string | null
          search_query?: string | null
          strengths?: Json | null
          structured_data_recommendations?: Json | null
          sub_scores?: Json | null
          summary?: string | null
          technical_geo_coverage?: number | null
          technical_geo_critical_issues?: Json | null
          technical_geo_quick_wins?: Json | null
          technical_geo_rules?: Json | null
          technical_geo_version?: string | null
          technical_signals?: Json | null
          tipo?: string
          user_id?: string
          website_url?: string | null
          weights_applied?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analises_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analises_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      analises_competitivas: {
        Row: {
          concorrente_id: string
          created_at: string
          empresa_id: string | null
          id: string
          score: number | null
          sub_scores: Json | null
          summary: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          concorrente_id: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          score?: number | null
          sub_scores?: Json | null
          summary?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          concorrente_id?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          score?: number | null
          sub_scores?: Json | null
          summary?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analises_competitivas_concorrente_id_fkey"
            columns: ["concorrente_id"]
            isOneToOne: false
            referencedRelation: "concorrentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analises_competitivas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analises_competitivas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_analyses: {
        Row: {
          brand_brain_id: string | null
          created_at: string
          description: string
          id: string
          instagram: string | null
          linkedin: string | null
          mode: string
          result: Json
          user_id: string
          website: string | null
          workspace_id: string | null
        }
        Insert: {
          brand_brain_id?: string | null
          created_at?: string
          description: string
          id?: string
          instagram?: string | null
          linkedin?: string | null
          mode?: string
          result: Json
          user_id: string
          website?: string | null
          workspace_id?: string | null
        }
        Update: {
          brand_brain_id?: string | null
          created_at?: string
          description?: string
          id?: string
          instagram?: string | null
          linkedin?: string | null
          mode?: string
          result?: Json
          user_id?: string
          website?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_analyses_brand_brain_id_fkey"
            columns: ["brand_brain_id"]
            isOneToOne: false
            referencedRelation: "brand_brains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_analyses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_audiences: {
        Row: {
          audience_type: string
          brand_brain_id: string
          carried_from_id: string | null
          confidence: number
          created_at: string
          description: string | null
          evidence: string | null
          explicit_or_inferred: string
          id: string
          industries: string[]
          name: string
          needs: string[]
          observed_at: string
          origin: string
          problems: string[]
          roles: string[]
          source_type: string
          source_url: string | null
          sources: Json
          updated_at: string
        }
        Insert: {
          audience_type: string
          brand_brain_id: string
          carried_from_id?: string | null
          confidence: number
          created_at?: string
          description?: string | null
          evidence?: string | null
          explicit_or_inferred: string
          id?: string
          industries?: string[]
          name: string
          needs?: string[]
          observed_at?: string
          origin?: string
          problems?: string[]
          roles?: string[]
          source_type: string
          source_url?: string | null
          sources?: Json
          updated_at?: string
        }
        Update: {
          audience_type?: string
          brand_brain_id?: string
          carried_from_id?: string | null
          confidence?: number
          created_at?: string
          description?: string | null
          evidence?: string | null
          explicit_or_inferred?: string
          id?: string
          industries?: string[]
          name?: string
          needs?: string[]
          observed_at?: string
          origin?: string
          problems?: string[]
          roles?: string[]
          source_type?: string
          source_url?: string | null
          sources?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_audiences_brand_brain_id_fkey"
            columns: ["brand_brain_id"]
            isOneToOne: false
            referencedRelation: "brand_brains"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_brains: {
        Row: {
          business_model: string | null
          company_name: string | null
          created_at: string
          empresa_id: string
          extraction_confidence: number | null
          field_provenance: Json
          geographic_markets: string[]
          id: string
          is_active: boolean
          languages: string[]
          last_analyzed_at: string
          long_description: string | null
          mission: string | null
          model_version: string
          positioning: string | null
          positioning_conflicts: Json
          primary_category: string | null
          primary_domain: string | null
          request_id: string | null
          secondary_categories: string[]
          short_description: string | null
          sources_status: Json
          status: string
          suggested_pages: Json
          target_summary: string | null
          tone_summary: string | null
          updated_at: string
          user_id: string
          value_proposition: string | null
          version: number
          visual_summary: string | null
          workspace_id: string
        }
        Insert: {
          business_model?: string | null
          company_name?: string | null
          created_at?: string
          empresa_id: string
          extraction_confidence?: number | null
          field_provenance?: Json
          geographic_markets?: string[]
          id?: string
          is_active?: boolean
          languages?: string[]
          last_analyzed_at?: string
          long_description?: string | null
          mission?: string | null
          model_version?: string
          positioning?: string | null
          positioning_conflicts?: Json
          primary_category?: string | null
          primary_domain?: string | null
          request_id?: string | null
          secondary_categories?: string[]
          short_description?: string | null
          sources_status?: Json
          status?: string
          suggested_pages?: Json
          target_summary?: string | null
          tone_summary?: string | null
          updated_at?: string
          user_id: string
          value_proposition?: string | null
          version: number
          visual_summary?: string | null
          workspace_id: string
        }
        Update: {
          business_model?: string | null
          company_name?: string | null
          created_at?: string
          empresa_id?: string
          extraction_confidence?: number | null
          field_provenance?: Json
          geographic_markets?: string[]
          id?: string
          is_active?: boolean
          languages?: string[]
          last_analyzed_at?: string
          long_description?: string | null
          mission?: string | null
          model_version?: string
          positioning?: string | null
          positioning_conflicts?: Json
          primary_category?: string | null
          primary_domain?: string | null
          request_id?: string | null
          secondary_categories?: string[]
          short_description?: string | null
          sources_status?: Json
          status?: string
          suggested_pages?: Json
          target_summary?: string | null
          tone_summary?: string | null
          updated_at?: string
          user_id?: string
          value_proposition?: string | null
          version?: number
          visual_summary?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_brains_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_brains_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_claims: {
        Row: {
          brand_brain_id: string
          carried_from_id: string | null
          claim_type: string
          confidence: number
          created_at: string
          evidence: string | null
          evidence_refs: string[]
          explicit_or_inferred: string
          id: string
          observed_at: string
          origin: string
          source_type: string
          source_url: string | null
          sources: Json
          statement: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          brand_brain_id: string
          carried_from_id?: string | null
          claim_type: string
          confidence: number
          created_at?: string
          evidence?: string | null
          evidence_refs?: string[]
          explicit_or_inferred: string
          id?: string
          observed_at?: string
          origin?: string
          source_type: string
          source_url?: string | null
          sources?: Json
          statement: string
          updated_at?: string
          verification_status: string
        }
        Update: {
          brand_brain_id?: string
          carried_from_id?: string | null
          claim_type?: string
          confidence?: number
          created_at?: string
          evidence?: string | null
          evidence_refs?: string[]
          explicit_or_inferred?: string
          id?: string
          observed_at?: string
          origin?: string
          source_type?: string
          source_url?: string | null
          sources?: Json
          statement?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_claims_brand_brain_id_fkey"
            columns: ["brand_brain_id"]
            isOneToOne: false
            referencedRelation: "brand_brains"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_differentiators: {
        Row: {
          brand_brain_id: string
          carried_from_id: string | null
          category: string
          confidence: number
          created_at: string
          evidence: string | null
          explicit_or_inferred: string
          id: string
          observed_at: string
          origin: string
          source_type: string
          source_url: string | null
          sources: Json
          statement: string
          updated_at: string
        }
        Insert: {
          brand_brain_id: string
          carried_from_id?: string | null
          category: string
          confidence: number
          created_at?: string
          evidence?: string | null
          explicit_or_inferred: string
          id?: string
          observed_at?: string
          origin?: string
          source_type: string
          source_url?: string | null
          sources?: Json
          statement: string
          updated_at?: string
        }
        Update: {
          brand_brain_id?: string
          carried_from_id?: string | null
          category?: string
          confidence?: number
          created_at?: string
          evidence?: string | null
          explicit_or_inferred?: string
          id?: string
          observed_at?: string
          origin?: string
          source_type?: string
          source_url?: string | null
          sources?: Json
          statement?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_differentiators_brand_brain_id_fkey"
            columns: ["brand_brain_id"]
            isOneToOne: false
            referencedRelation: "brand_brains"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_entities: {
        Row: {
          brand_brain_id: string
          carried_from_id: string | null
          confidence: number
          created_at: string
          description: string | null
          entity_type: string
          evidence: string | null
          explicit_or_inferred: string
          id: string
          name: string
          observed_at: string
          origin: string
          relationship: string | null
          source_type: string
          source_url: string | null
          sources: Json
          updated_at: string
        }
        Insert: {
          brand_brain_id: string
          carried_from_id?: string | null
          confidence: number
          created_at?: string
          description?: string | null
          entity_type: string
          evidence?: string | null
          explicit_or_inferred: string
          id?: string
          name: string
          observed_at?: string
          origin?: string
          relationship?: string | null
          source_type: string
          source_url?: string | null
          sources?: Json
          updated_at?: string
        }
        Update: {
          brand_brain_id?: string
          carried_from_id?: string | null
          confidence?: number
          created_at?: string
          description?: string | null
          entity_type?: string
          evidence?: string | null
          explicit_or_inferred?: string
          id?: string
          name?: string
          observed_at?: string
          origin?: string
          relationship?: string | null
          source_type?: string
          source_url?: string | null
          sources?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_entities_brand_brain_id_fkey"
            columns: ["brand_brain_id"]
            isOneToOne: false
            referencedRelation: "brand_brains"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_evidence: {
        Row: {
          brand_brain_id: string
          carried_from_id: string | null
          confidence: number
          created_at: string
          description: string | null
          evidence: string | null
          evidence_type: string
          explicit_or_inferred: string
          id: string
          observed_at: string
          origin: string
          source_type: string
          source_url: string | null
          sources: Json
          title: string
          updated_at: string
          value: string | null
        }
        Insert: {
          brand_brain_id: string
          carried_from_id?: string | null
          confidence: number
          created_at?: string
          description?: string | null
          evidence?: string | null
          evidence_type: string
          explicit_or_inferred: string
          id?: string
          observed_at?: string
          origin?: string
          source_type: string
          source_url?: string | null
          sources?: Json
          title: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          brand_brain_id?: string
          carried_from_id?: string | null
          confidence?: number
          created_at?: string
          description?: string | null
          evidence?: string | null
          evidence_type?: string
          explicit_or_inferred?: string
          id?: string
          observed_at?: string
          origin?: string
          source_type?: string
          source_url?: string | null
          sources?: Json
          title?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_evidence_brand_brain_id_fkey"
            columns: ["brand_brain_id"]
            isOneToOne: false
            referencedRelation: "brand_brains"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_offerings: {
        Row: {
          brand_brain_id: string
          carried_from_id: string | null
          category: string | null
          confidence: number
          created_at: string
          description: string | null
          evidence: string | null
          explicit_or_inferred: string
          id: string
          name: string
          observed_at: string
          origin: string
          problems_solved: string[]
          source_type: string
          source_url: string | null
          sources: Json
          target_audience: string | null
          type: string
          updated_at: string
          value_proposition: string | null
        }
        Insert: {
          brand_brain_id: string
          carried_from_id?: string | null
          category?: string | null
          confidence: number
          created_at?: string
          description?: string | null
          evidence?: string | null
          explicit_or_inferred: string
          id?: string
          name: string
          observed_at?: string
          origin?: string
          problems_solved?: string[]
          source_type: string
          source_url?: string | null
          sources?: Json
          target_audience?: string | null
          type: string
          updated_at?: string
          value_proposition?: string | null
        }
        Update: {
          brand_brain_id?: string
          carried_from_id?: string | null
          category?: string | null
          confidence?: number
          created_at?: string
          description?: string | null
          evidence?: string | null
          explicit_or_inferred?: string
          id?: string
          name?: string
          observed_at?: string
          origin?: string
          problems_solved?: string[]
          source_type?: string
          source_url?: string | null
          sources?: Json
          target_audience?: string | null
          type?: string
          updated_at?: string
          value_proposition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_offerings_brand_brain_id_fkey"
            columns: ["brand_brain_id"]
            isOneToOne: false
            referencedRelation: "brand_brains"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_positioning: {
        Row: {
          alternative_categories: string[]
          brand_brain_id: string
          carried_from_id: string | null
          confidence: number
          created_at: string
          differentiators: string[]
          evidence: string | null
          explicit_or_inferred: string
          id: string
          kind: string
          observed_at: string
          origin: string
          primary_category: string | null
          source_type: string
          source_url: string | null
          sources: Json
          statement: string | null
          target_market: string | null
          updated_at: string
          value_proposition: string | null
        }
        Insert: {
          alternative_categories?: string[]
          brand_brain_id: string
          carried_from_id?: string | null
          confidence: number
          created_at?: string
          differentiators?: string[]
          evidence?: string | null
          explicit_or_inferred: string
          id?: string
          kind: string
          observed_at?: string
          origin?: string
          primary_category?: string | null
          source_type: string
          source_url?: string | null
          sources?: Json
          statement?: string | null
          target_market?: string | null
          updated_at?: string
          value_proposition?: string | null
        }
        Update: {
          alternative_categories?: string[]
          brand_brain_id?: string
          carried_from_id?: string | null
          confidence?: number
          created_at?: string
          differentiators?: string[]
          evidence?: string | null
          explicit_or_inferred?: string
          id?: string
          kind?: string
          observed_at?: string
          origin?: string
          primary_category?: string | null
          source_type?: string
          source_url?: string | null
          sources?: Json
          statement?: string | null
          target_market?: string | null
          updated_at?: string
          value_proposition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_positioning_brand_brain_id_fkey"
            columns: ["brand_brain_id"]
            isOneToOne: false
            referencedRelation: "brand_brains"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_problems: {
        Row: {
          affected_audience: string[]
          brand_brain_id: string
          carried_from_id: string | null
          confidence: number
          created_at: string
          description: string | null
          evidence: string | null
          explicit_or_inferred: string
          id: string
          name: string
          observed_at: string
          origin: string
          related_offerings: string[]
          source_type: string
          source_url: string | null
          sources: Json
          updated_at: string
        }
        Insert: {
          affected_audience?: string[]
          brand_brain_id: string
          carried_from_id?: string | null
          confidence: number
          created_at?: string
          description?: string | null
          evidence?: string | null
          explicit_or_inferred: string
          id?: string
          name: string
          observed_at?: string
          origin?: string
          related_offerings?: string[]
          source_type: string
          source_url?: string | null
          sources?: Json
          updated_at?: string
        }
        Update: {
          affected_audience?: string[]
          brand_brain_id?: string
          carried_from_id?: string | null
          confidence?: number
          created_at?: string
          description?: string | null
          evidence?: string | null
          explicit_or_inferred?: string
          id?: string
          name?: string
          observed_at?: string
          origin?: string
          related_offerings?: string[]
          source_type?: string
          source_url?: string | null
          sources?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_problems_brand_brain_id_fkey"
            columns: ["brand_brain_id"]
            isOneToOne: false
            referencedRelation: "brand_brains"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_visual_identity: {
        Row: {
          accent_colors: Json
          brand_brain_id: string
          carried_from_id: string | null
          confidence: number
          consistency_notes: string | null
          created_at: string
          detected_fonts: string[]
          evidence: string | null
          explicit_or_inferred: string
          id: string
          imagery_style: string | null
          logo_url: string | null
          observed_at: string
          origin: string
          primary_colors: Json
          secondary_colors: Json
          source_type: string
          source_url: string | null
          sources: Json
          updated_at: string
          visual_style: string | null
        }
        Insert: {
          accent_colors?: Json
          brand_brain_id: string
          carried_from_id?: string | null
          confidence: number
          consistency_notes?: string | null
          created_at?: string
          detected_fonts?: string[]
          evidence?: string | null
          explicit_or_inferred: string
          id?: string
          imagery_style?: string | null
          logo_url?: string | null
          observed_at?: string
          origin?: string
          primary_colors?: Json
          secondary_colors?: Json
          source_type: string
          source_url?: string | null
          sources?: Json
          updated_at?: string
          visual_style?: string | null
        }
        Update: {
          accent_colors?: Json
          brand_brain_id?: string
          carried_from_id?: string | null
          confidence?: number
          consistency_notes?: string | null
          created_at?: string
          detected_fonts?: string[]
          evidence?: string | null
          explicit_or_inferred?: string
          id?: string
          imagery_style?: string | null
          logo_url?: string | null
          observed_at?: string
          origin?: string
          primary_colors?: Json
          secondary_colors?: Json
          source_type?: string
          source_url?: string | null
          sources?: Json
          updated_at?: string
          visual_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_visual_identity_brand_brain_id_fkey"
            columns: ["brand_brain_id"]
            isOneToOne: false
            referencedRelation: "brand_brains"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_voice: {
        Row: {
          brand_brain_id: string
          carried_from_id: string | null
          communication_style: string | null
          complexity_level: string | null
          confidence: number
          created_at: string
          emotional_style: string | null
          evidence: string | null
          explicit_or_inferred: string
          formality: string | null
          id: string
          observed_at: string
          origin: string
          recurring_phrases: string[]
          source_type: string
          source_url: string | null
          sources: Json
          tone_traits: string[]
          updated_at: string
          vocabulary_avoided: string[]
          vocabulary_preferred: string[]
        }
        Insert: {
          brand_brain_id: string
          carried_from_id?: string | null
          communication_style?: string | null
          complexity_level?: string | null
          confidence: number
          created_at?: string
          emotional_style?: string | null
          evidence?: string | null
          explicit_or_inferred: string
          formality?: string | null
          id?: string
          observed_at?: string
          origin?: string
          recurring_phrases?: string[]
          source_type: string
          source_url?: string | null
          sources?: Json
          tone_traits?: string[]
          updated_at?: string
          vocabulary_avoided?: string[]
          vocabulary_preferred?: string[]
        }
        Update: {
          brand_brain_id?: string
          carried_from_id?: string | null
          communication_style?: string | null
          complexity_level?: string | null
          confidence?: number
          created_at?: string
          emotional_style?: string | null
          evidence?: string | null
          explicit_or_inferred?: string
          formality?: string | null
          id?: string
          observed_at?: string
          origin?: string
          recurring_phrases?: string[]
          source_type?: string
          source_url?: string | null
          sources?: Json
          tone_traits?: string[]
          updated_at?: string
          vocabulary_avoided?: string[]
          vocabulary_preferred?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "brand_voice_brand_brain_id_fkey"
            columns: ["brand_brain_id"]
            isOneToOne: false
            referencedRelation: "brand_brains"
            referencedColumns: ["id"]
          },
        ]
      }
      concorrentes: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          search_query: string
          url: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          search_query: string
          url: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          search_query?: string
          url?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concorrentes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concorrentes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          analise_marca_ativa: boolean
          created_at: string
          descricao: string | null
          id: string
          instagram_url: string | null
          linkedin_url: string | null
          monitoramento_ativo: boolean
          nome: string
          search_query: string
          updated_at: string
          url: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          analise_marca_ativa?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          monitoramento_ativo?: boolean
          nome: string
          search_query: string
          updated_at?: string
          url: string
          user_id: string
          workspace_id: string
        }
        Update: {
          analise_marca_ativa?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          monitoramento_ativo?: boolean
          nome?: string
          search_query?: string
          updated_at?: string
          url?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          analysis_mode: string | null
          analysis_result: Json | null
          convertido: boolean
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          score: number | null
          search_query: string | null
          sub_scores: Json | null
          summary: string | null
          website_url: string | null
        }
        Insert: {
          analysis_mode?: string | null
          analysis_result?: Json | null
          convertido?: boolean
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          score?: number | null
          search_query?: string | null
          sub_scores?: Json | null
          summary?: string | null
          website_url?: string | null
        }
        Update: {
          analysis_mode?: string | null
          analysis_result?: Json | null
          convertido?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          score?: number | null
          search_query?: string | null
          sub_scores?: Json | null
          summary?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          dados: Json | null
          id: string
          lida: boolean
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          id?: string
          lida?: boolean
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          dados?: Json | null
          id?: string
          lida?: boolean
          mensagem?: string
          tipo?: string
          titulo?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_de_acao: {
        Row: {
          action: string
          affected_dimension: string | null
          analise_id: string | null
          category: string | null
          concluida: boolean
          created_at: string
          empresa_id: string | null
          id: string
          impact: string | null
          priority: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          affected_dimension?: string | null
          analise_id?: string | null
          category?: string | null
          concluida?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          impact?: string | null
          priority: string
          user_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          affected_dimension?: string | null
          analise_id?: string | null
          category?: string | null
          concluida?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          impact?: string | null
          priority?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_de_acao_analise_id_fkey"
            columns: ["analise_id"]
            isOneToOne: false
            referencedRelation: "analises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_de_acao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_de_acao_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          name?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_buckets: {
        Row: {
          bucket_key: string
          count: number
          endpoint: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          count?: number
          endpoint: string
          window_start: string
        }
        Update: {
          bucket_key?: string
          count?: number
          endpoint?: string
          window_start?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          analyses_limit: number
          analyses_used: number
          created_at: string
          id: string
          period_start: string
          plan: Database["public"]["Enums"]["app_plan"]
          updated_at: string
          user_id: string
        }
        Insert: {
          analyses_limit?: number
          analyses_used?: number
          created_at?: string
          id?: string
          period_start?: string
          plan?: Database["public"]["Enums"]["app_plan"]
          updated_at?: string
          user_id: string
        }
        Update: {
          analyses_limit?: number
          analyses_used?: number
          created_at?: string
          id?: string
          period_start?: string
          plan?: Database["public"]["Enums"]["app_plan"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workspace_api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_webhooks: {
        Row: {
          created_at: string
          events: string[]
          failure_count: number
          id: string
          is_active: boolean
          last_error: string | null
          last_triggered_at: string | null
          name: string
          secret: string | null
          success_count: number
          url: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_triggered_at?: string | null
          name: string
          secret?: string | null
          success_count?: number
          url: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_triggered_at?: string | null
          name?: string
          secret?: string | null
          success_count?: number
          url?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_webhooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          analise_competitiva_ativa: boolean
          analise_marca_ativa: boolean
          created_at: string
          id: string
          logo_url: string | null
          monitoramento_ativo: boolean
          name: string
          score_alert_threshold: number
          user_id: string
        }
        Insert: {
          analise_competitiva_ativa?: boolean
          analise_marca_ativa?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          monitoramento_ativo?: boolean
          name: string
          score_alert_threshold?: number
          user_id: string
        }
        Update: {
          analise_competitiva_ativa?: boolean
          analise_marca_ativa?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          monitoramento_ativo?: boolean
          name?: string
          score_alert_threshold?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_key: string
          p_max: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      increment_analysis_usage: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      persist_brand_brain: {
        Args: {
          p_empresa_id: string
          p_payload: Json
          p_request_id: string
          p_user_id: string
          p_workspace_id: string
        }
        Returns: {
          brand_brain_id: string
          version: number
        }[]
      }
      record_webhook_delivery: {
        Args: { p_error?: string; p_success: boolean; p_webhook_id: string }
        Returns: undefined
      }
      refund_analysis_usage: { Args: { p_user_id: string }; Returns: undefined }
      validate_api_key: {
        Args: { p_key_hash: string }
        Returns: {
          key_id: string
          user_id: string
          workspace_id: string
        }[]
      }
    }
    Enums: {
      app_plan: "free" | "pro" | "premium"
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
      app_plan: ["free", "pro", "premium"],
    },
  },
} as const
