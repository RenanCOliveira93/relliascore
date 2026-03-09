export type AnalysisMode = "influencer" | "business";
export type InputType = "webpage" | "text";

export interface SubScores {
  relevancia_tematica: number;
  qualidade_conteudo: number;
  autoridade_percebida: number;
  otimizacao_llm: number;
  clareza_proposta_valor: number;
}

export interface CompatibilityDiagnostic {
  conteudo_atual: string;
  conteudo_ideal: string;
  gap_analysis: string[];
  compatibility_percentage: number;
}

export interface ActionPlanItem {
  priority: "alta" | "media" | "baixa";
  action: string;
  impact: string;
  category: "conteudo" | "tecnico" | "autoridade" | "estrutura";
}

export interface KeywordsAnalysis {
  found: string[];
  missing: string[];
  suggested: string[];
}

export interface AnalysisResult {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  sub_scores: SubScores;
  compatibility_diagnostic: CompatibilityDiagnostic;
  action_plan: ActionPlanItem[];
  keywords_analysis: KeywordsAnalysis;
  ideal_example?: string;
}
