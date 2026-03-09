import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Lightbulb, Sparkles } from "lucide-react";
import SubScoresRadar from "./SubScoresRadar";
import CompatibilityDiagnostic from "./CompatibilityDiagnostic";
import ActionPlan from "./ActionPlan";
import KeywordAnalysis from "./KeywordAnalysis";
import type { AnalysisResult } from "@/types/analysis";

interface ScoreDisplayProps {
  result: AnalysisResult;
}

const ScoreDisplay = ({ result }: ScoreDisplayProps) => {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = result.score / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= result.score) {
        setAnimatedScore(result.score);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [result.score]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excelente";
    if (score >= 60) return "Bom";
    if (score >= 40) return "Regular";
    return "Baixo";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return "from-green-500/20 to-green-500/5";
    if (score >= 60) return "from-yellow-500/20 to-yellow-500/5";
    if (score >= 40) return "from-orange-500/20 to-orange-500/5";
    return "from-red-500/20 to-red-500/5";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Main Score */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getScoreGradient(result.score)} border border-border p-8`}>
        <div className="flex flex-col items-center justify-center">
          <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider">LLM Relevance Score</p>
          <div className="relative">
            <span className={`text-8xl font-bold ${getScoreColor(result.score)}`}>{animatedScore}</span>
            <span className={`text-4xl ${getScoreColor(result.score)}`}>%</span>
          </div>
          <Badge variant="outline" className={`mt-4 text-lg px-4 py-1 ${getScoreColor(result.score)} border-current`}>
            {getScoreLabel(result.score)}
          </Badge>
        </div>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/5"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-primary/5"></div>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground leading-relaxed">{result.summary}</p>
        </CardContent>
      </Card>

      {/* Tabbed Results */}
      <Tabs defaultValue="scores" className="w-full">
        <TabsList className={`grid w-full ${result.ideal_example ? 'grid-cols-6' : 'grid-cols-5'} h-auto`}>
          <TabsTrigger value="scores" className="text-xs sm:text-sm py-2">Scores</TabsTrigger>
          <TabsTrigger value="diagnostic" className="text-xs sm:text-sm py-2">Diagnóstico</TabsTrigger>
          <TabsTrigger value="action" className="text-xs sm:text-sm py-2">Plano</TabsTrigger>
          <TabsTrigger value="keywords" className="text-xs sm:text-sm py-2">Keywords</TabsTrigger>
          {result.ideal_example && (
            <TabsTrigger value="ideal" className="text-xs sm:text-sm py-2">Ideal</TabsTrigger>
          )}
          <TabsTrigger value="details" className="text-xs sm:text-sm py-2">Detalhes</TabsTrigger>
        </TabsList>

        <TabsContent value="scores">
          {result.sub_scores && <SubScoresRadar subScores={result.sub_scores} />}
        </TabsContent>

        <TabsContent value="diagnostic">
          {result.compatibility_diagnostic && (
            <CompatibilityDiagnostic diagnostic={result.compatibility_diagnostic} />
          )}
        </TabsContent>

        <TabsContent value="action">
          {result.action_plan && result.action_plan.length > 0 ? (
            <ActionPlan actions={result.action_plan} />
          ) : (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">Nenhuma ação identificada.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="keywords">
          {result.keywords_analysis && <KeywordAnalysis keywords={result.keywords_analysis} />}
        </TabsContent>

        {result.ideal_example && (
          <TabsContent value="ideal">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Exemplo Ideal
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3">
                  Exemplo de conteúdo otimizado que alcançaria um score próximo a 100%:
                </p>
                <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.ideal_example}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="details">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Pontos Fortes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>{s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Sugestões de Melhoria
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {result.improvements.map((imp, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-yellow-500 mt-1">•</span>{imp}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScoreDisplay;
