import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertTriangle, Lightbulb, Tag } from "lucide-react";

interface AnalysisResult {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  keywords_found: string[];
}

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
          <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider">
            LLM Relevance Score
          </p>
          <div className="relative">
            <span className={`text-8xl font-bold ${getScoreColor(result.score)}`}>
              {animatedScore}
            </span>
            <span className={`text-4xl ${getScoreColor(result.score)}`}>%</span>
          </div>
          <Badge 
            variant="outline" 
            className={`mt-4 text-lg px-4 py-1 ${getScoreColor(result.score)} border-current`}
          >
            {getScoreLabel(result.score)}
          </Badge>
        </div>
        
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/5"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-primary/5"></div>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground leading-relaxed">
            {result.summary}
          </p>
        </CardContent>
      </Card>

      {/* Details Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Strengths */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Pontos Fortes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {result.strengths.map((strength, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-green-500 mt-1">•</span>
                  {strength}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Improvements */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Sugestões de Melhoria
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {result.improvements.map((improvement, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-yellow-500 mt-1">•</span>
                  {improvement}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Keywords */}
      {result.keywords_found.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Palavras-chave Encontradas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {result.keywords_found.map((keyword, index) => (
                <Badge key={index} variant="secondary">
                  {keyword}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ScoreDisplay;
