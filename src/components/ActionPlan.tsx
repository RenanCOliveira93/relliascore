import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rocket, Zap, Clock } from "lucide-react";
import type { ActionPlanItem } from "@/types/analysis";

interface ActionPlanProps {
  actions: ActionPlanItem[];
}

const priorityConfig = {
  alta: { label: "Alta", icon: Zap, className: "bg-red-500/10 text-red-500 border-red-500/20" },
  media: { label: "Média", icon: Rocket, className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  baixa: { label: "Baixa", icon: Clock, className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
};

const categoryLabels: Record<string, string> = {
  conteudo: "Conteúdo",
  tecnico: "Técnico",
  autoridade: "Autoridade",
  estrutura: "Estrutura",
};

const ActionPlan = ({ actions }: ActionPlanProps) => {
  const sorted = [...actions].sort((a, b) => {
    const order = { alta: 0, media: 1, baixa: 2 };
    return order[a.priority] - order[b.priority];
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          Plano de Ação
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {sorted.map((item, i) => {
            const config = priorityConfig[item.priority];
            const Icon = config.icon;
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                <div className={`p-1.5 rounded ${config.className}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.action}</p>
                  <p className="text-xs text-muted-foreground mt-1">Impacto: {item.impact}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {categoryLabels[item.category] || item.category}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${config.className}`}>
                      Prioridade {config.label}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default ActionPlan;
