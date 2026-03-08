import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, FileText, Target, AlertCircle } from "lucide-react";
import type { CompatibilityDiagnostic as DiagnosticType } from "@/types/analysis";

interface CompatibilityDiagnosticProps {
  diagnostic: DiagnosticType;
}

const CompatibilityDiagnostic = ({ diagnostic }: CompatibilityDiagnosticProps) => {
  const getCompatColor = (pct: number) => {
    if (pct >= 80) return "text-green-500";
    if (pct >= 60) return "text-yellow-500";
    if (pct >= 40) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-4">
      {/* Compatibility percentage */}
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-muted-foreground mb-1">Compatibilidade Conteúdo vs Pesquisa</p>
          <span className={`text-5xl font-bold ${getCompatColor(diagnostic.compatibility_percentage)}`}>
            {diagnostic.compatibility_percentage}%
          </span>
        </CardContent>
      </Card>

      {/* Side by side comparison */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              Conteúdo Atual
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {diagnostic.conteudo_atual}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Conteúdo Ideal
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {diagnostic.conteudo_ideal}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gap Analysis */}
      {diagnostic.gap_analysis.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Lacunas Identificadas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {diagnostic.gap_analysis.map((gap, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ArrowRight className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  {gap}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CompatibilityDiagnostic;
