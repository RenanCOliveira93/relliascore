import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Cpu } from "lucide-react";
import type { TechnicalGeoAudit as Audit, RuleStatus } from "@/types/analysis";

const STATUS_LABEL: Record<RuleStatus, string> = {
  pass: "OK", warning: "Atenção", fail: "Falha", not_applicable: "Não se aplica", unavailable: "Não medido",
};
const STATUS_VARIANT: Record<RuleStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pass: "default", warning: "secondary", fail: "destructive", not_applicable: "outline", unavailable: "outline",
};
const VERDICT: Record<string, string> = { allowed: "permitido", blocked: "bloqueado", no_rule: "sem regra" };

const TechnicalGeoAudit = ({ audit }: { audit: Audit }) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2">
        <Cpu className="h-5 w-5 text-primary" />
        Technical GEO
      </CardTitle>
      <p className="text-xs text-muted-foreground">
        Nota {Math.round(audit.score)} · Cobertura {Math.round(audit.coverage * 100)}% · Tipo de página: {audit.page_type.page_type} (confiança {Math.round(audit.page_type.confidence * 100)}%) · regras v{audit.technical_geo_version}
      </p>
    </CardHeader>
    <CardContent className="pt-0 space-y-4">
      {audit.critical_issues.length > 0 && (
        <div>
          <p className="text-sm font-medium text-destructive mb-1">Problemas críticos</p>
          <ul className="space-y-1">
            {audit.critical_issues.map((c) => (
              <li key={c.rule_id} className="text-sm text-muted-foreground">• {c.label}: {c.evidence} {c.recommendation}</li>
            ))}
          </ul>
        </div>
      )}
      {audit.quick_wins.length > 0 && (
        <div>
          <p className="text-sm font-medium text-foreground mb-1">Ganhos rápidos</p>
          <ul className="space-y-1">
            {audit.quick_wins.map((q) => (
              <li key={q.rule_id} className="text-sm text-muted-foreground">• {q.label}: {q.recommendation ?? q.evidence}</li>
            ))}
          </ul>
        </div>
      )}
      <Accordion type="single" collapsible>
        <AccordionItem value="rules">
          <AccordionTrigger className="text-sm">Todas as regras ({audit.rules.length})</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2">
              {audit.rules.map((r) => (
                <li key={r.id} className="text-sm flex items-start justify-between gap-3 border-b border-border/50 pb-2">
                  <div>
                    <p className="text-foreground">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.evidence}</p>
                    {r.recommendation && <p className="text-xs text-muted-foreground">→ {r.recommendation}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    {r.score !== null && <p className="text-xs text-muted-foreground mt-1">{r.score}/{r.max_points}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
        {audit.ai_crawler_access && audit.ai_crawler_access.crawlers.length > 0 && (
          <AccordionItem value="robots">
            <AccordionTrigger className="text-sm">robots.txt e robôs conhecidos</AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1">
                {audit.ai_crawler_access.crawlers.map((c) => (
                  <li key={c.token} className="text-xs text-muted-foreground">
                    {c.token} ({c.operator}, {c.category === "search" ? "busca" : c.category === "training" ? "treinamento" : "não classificado"}): {VERDICT[c.verdict] ?? c.verdict}{c.matched_rule ? ` — ${c.matched_rule}` : ""}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-2">{audit.ai_crawler_access.note}</p>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </CardContent>
  </Card>
);

export default TechnicalGeoAudit;
