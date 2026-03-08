import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag, AlertTriangle, Lightbulb } from "lucide-react";
import type { KeywordsAnalysis } from "@/types/analysis";

interface KeywordAnalysisProps {
  keywords: KeywordsAnalysis;
}

const KeywordAnalysis = ({ keywords }: KeywordAnalysisProps) => {
  return (
    <div className="space-y-4">
      {keywords.found.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-5 w-5 text-green-500" />
              Palavras-chave Encontradas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {keywords.found.map((kw, i) => (
                <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                  {kw}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {keywords.missing.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Palavras-chave Ausentes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {keywords.missing.map((kw, i) => (
                <Badge key={i} variant="secondary" className="bg-red-500/10 text-red-500 border-red-500/20">
                  {kw}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {keywords.suggested.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Palavras-chave Sugeridas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {keywords.suggested.map((kw, i) => (
                <Badge key={i} variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                  {kw}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default KeywordAnalysis;
