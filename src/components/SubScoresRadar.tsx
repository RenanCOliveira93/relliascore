import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import type { SubScores } from "@/types/analysis";

interface SubScoresRadarProps {
  subScores: SubScores;
}

const labels: Record<keyof SubScores, string> = {
  relevancia_tematica: "Relevância Temática",
  qualidade_conteudo: "Qualidade do Conteúdo",
  autoridade_percebida: "Autoridade Percebida",
  otimizacao_llm: "Otimização LLM",
  clareza_proposta_valor: "Proposta de Valor",
};

const SubScoresRadar = ({ subScores }: SubScoresRadarProps) => {
  const data = Object.entries(subScores).map(([key, value]) => ({
    dimension: labels[key as keyof SubScores],
    score: value,
    fullMark: 100,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Sub-Scores por Dimensão
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={data}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            />
            <Radar
              name="Score"
              dataKey="score"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          {data.map((item) => (
            <div key={item.dimension} className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">{item.dimension}</p>
              <p className="text-lg font-bold text-foreground">{item.score}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SubScoresRadar;
