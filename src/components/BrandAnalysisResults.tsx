import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare, Target, Layers, Palette, FileText, Tag, Lightbulb,
  TrendingUp, TrendingDown, Crosshair, Sparkles, BarChart3, Monitor, CheckCircle, FileDown,
  Search, Globe, Linkedin, Instagram
} from "lucide-react";
import type { BrandAnalysisResult } from "@/types/brand-analysis";
import { generateBrandPdf } from "@/lib/generateBrandPdf";
import { useEffect, useState } from "react";

interface BrandAnalysisResultsProps {
  result: BrandAnalysisResult;
  mode?: string;
  sources?: {
    website?: string;
    linkedin?: string;
    instagram?: string;
    description?: string;
  };
}

const BrandAnalysisResults = ({ result, mode = "business", sources = {} }: BrandAnalysisResultsProps) => {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = result.consistencia_score / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= result.consistencia_score) {
        setAnimatedScore(result.consistencia_score);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [result.consistencia_score]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return "from-green-500/20 to-green-500/5";
    if (score >= 60) return "from-yellow-500/20 to-yellow-500/5";
    if (score >= 40) return "from-orange-500/20 to-orange-500/5";
    return "from-red-500/20 to-red-500/5";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Pinned analysis context (input data the user provided) */}
      {(sources.description || sources.website || sources.linkedin || sources.instagram) && (
        <Card className="border-primary/30 bg-primary/5 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-primary">
              <Search className="h-4 w-4" />
              Dados analisados
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2 text-sm">
            {sources.description && (
              <div>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Descrição</span>
                <p className="text-foreground/90 mt-0.5 whitespace-pre-wrap">{sources.description}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-1">
              {sources.website && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[220px]">{sources.website}</span>
                </span>
              )}
              {sources.linkedin && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Linkedin className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[220px]">{sources.linkedin}</span>
                </span>
              )}
              {sources.instagram && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Instagram className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[220px]">{sources.instagram}</span>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export PDF Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => generateBrandPdf(result, mode, sources)}
          className="gap-2"
        >
          <FileDown className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Consistency Score */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getScoreGradient(result.consistencia_score)} border border-border p-8`}>
        <div className="flex flex-col items-center justify-center">
          <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider">Consistência da Marca</p>
          <div className="relative">
            <span className={`text-8xl font-bold ${getScoreColor(result.consistencia_score)}`}>{animatedScore}</span>
            <span className={`text-4xl ${getScoreColor(result.consistencia_score)}`}>%</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground leading-relaxed">{result.resumo_marca}</p>
        </CardContent>
      </Card>

      {/* Identity Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              Tom de Voz
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{result.tom_de_voz}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Target className="h-4 w-4" />
              Público-alvo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{result.publico_alvo}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Layers className="h-4 w-4" />
              Nicho
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{result.nicho}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Palette className="h-4 w-4" />
              Estilo Visual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{result.estilo_visual}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Crosshair className="h-4 w-4" />
              Diferencial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{result.diferencial}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed deep sections */}
      <Tabs defaultValue="analysis" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="analysis" className="text-xs sm:text-sm py-2">Análise</TabsTrigger>
          <TabsTrigger value="strengths" className="text-xs sm:text-sm py-2">Forças/Fracos</TabsTrigger>
          <TabsTrigger value="keywords" className="text-xs sm:text-sm py-2">Keywords</TabsTrigger>
          <TabsTrigger value="colors" className="text-xs sm:text-sm py-2">Cores</TabsTrigger>
          <TabsTrigger value="topics" className="text-xs sm:text-sm py-2">Temas</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Posicionamento
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground leading-relaxed">{result.posicionamento}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Comunicação
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground leading-relaxed">{result.comunicacao_analise}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                Presença Digital
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground leading-relaxed">{result.presenca_digital}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strengths">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Pontos Fortes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {result.pontos_fortes.map((p, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>{p}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  Pontos Fracos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {result.pontos_fracos.map((p, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-red-500 mt-1">•</span>{p}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Recomendações Estratégicas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2">
                {result.recomendacoes.map((r, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-1">{i + 1}.</span>{r}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keywords">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                Palavras-chave da Marca
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {result.palavras_chave.map((kw, i) => (
                  <Badge key={i} variant="secondary" className="text-sm px-3 py-1">
                    {kw}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="colors">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Cores da Marca
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-6">
                {result.cores_marca.map((cor, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div
                      className="w-16 h-16 rounded-xl border border-border shadow-sm"
                      style={{ backgroundColor: cor.hex }}
                    />
                    <span className="text-xs text-muted-foreground font-mono">{cor.hex}</span>
                    <span className="text-xs text-muted-foreground">{cor.nome}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="topics">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Temas Sugeridos
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3">
                {result.temas_sugeridos.map((tema, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    {tema}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BrandAnalysisResults;
