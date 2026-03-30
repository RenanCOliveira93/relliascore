export interface BrandAnalysisInput {
  website?: string;
  linkedin?: string;
  instagram?: string;
  description: string;
  mode: "influencer" | "business";
}

export interface BrandAnalysisResult {
  tom_de_voz: string;
  publico_alvo: string;
  nicho: string;
  estilo_visual: string;
  resumo_marca: string;
  palavras_chave: string[];
  cores_marca: { hex: string; nome: string }[];
  temas_sugeridos: string[];
  pontos_fortes: string[];
  pontos_fracos: string[];
  posicionamento: string;
  diferencial: string;
  consistencia_score: number;
  comunicacao_analise: string;
  presenca_digital: string;
  recomendacoes: string[];
}
