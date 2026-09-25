import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { TechnicalGeoAudit as Audit } from "@/types/analysis";
import { crawlerGroups, groupRules, RULE_STATUS_LABEL, ruleTone, toneOf, verdictLabel, type Tone } from "@/lib/diagnosis";
import { Pill, Section, TONE_TEXT, Help } from "@/components/diagnosis/primitives";

const PAGE_TYPE: Record<string, string> = {
  homepage: "Homepage", article: "Artigo", product: "Produto", service: "Serviço", category: "Categoria",
  about: "Sobre", contact: "Contato", landing: "Landing page", profile: "Perfil", other: "Outro", unknown: "Não identificado",
};
export const pageTypeLabel = (t?: string) => (t ? PAGE_TYPE[t] ?? t : "—");

const verdictTone = (v: string): Tone => (v === "allowed" ? "positive" : v === "blocked" ? "attention" : "neutral");

const TechnicalGeoAudit = ({ audit }: { audit: Audit }) => {
  const groups = groupRules(audit.rules);
  const crawlers = audit.ai_crawler_access ? crawlerGroups(audit) : null;
  return (
    <Section
      id="technical-geo"
      title="Technical GEO"
      lead="Estrutura técnica verificada diretamente na página, com regras determinísticas."
      aside={<span className={`text-3xl font-bold tabular-nums ${TONE_TEXT[toneOf(audit.score)]}`}>{Math.round(audit.score)}</span>}
    >
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span>Tipo: <span className="text-foreground">{pageTypeLabel(audit.page_type.page_type)}</span></span>
        <span className="inline-flex items-center gap-1">Cobertura {Math.round(audit.coverage * 100)}% <Help text="Parte das regras que puderam ser medidas nesta página. Regras não aplicáveis ou não medidas não entram na nota." /></span>
        <span>Regras v{audit.technical_geo_version}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Problemas críticos</p>
          {audit.critical_issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum problema técnico crítico identificado.</p>
          ) : (
            <ul className="space-y-2">
              {audit.critical_issues.map((c) => (
                <li key={c.rule_id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium text-foreground">{c.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.evidence}</p>
                  {c.recommendation && <p className="text-xs text-foreground/90 mt-1">{c.recommendation}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Ganhos rápidos</p>
          {audit.quick_wins.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum ganho rápido pendente.</p>
          ) : (
            <ul className="space-y-2">
              {audit.quick_wins.map((q) => (
                <li key={q.rule_id} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium text-foreground">{q.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{q.recommendation ?? q.evidence}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Accordion type="multiple" className="w-full">
        {crawlers && (
          <AccordionItem value="crawlers">
            <AccordionTrigger className="text-sm">Acesso de crawlers</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Este painel mostra apenas o que o robots.txt permite ou bloqueia. Permitir acesso não garante indexação, treinamento, citação ou recomendação.</p>
              {crawlers.map((g) => (
                <div key={g.key}>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{g.label}</p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {g.items.map((c) => (
                      <li key={c.token} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
                        <span className="truncate">{c.token}{c.operator && <span className="text-xs text-muted-foreground"> · {c.operator}</span>}</span>
                        <Pill tone={verdictTone(c.verdict)}>{verdictLabel(c.verdict)}</Pill>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {audit.ai_crawler_access?.note && <p className="text-xs text-muted-foreground">{audit.ai_crawler_access.note}</p>}
            </AccordionContent>
          </AccordionItem>
        )}
        <AccordionItem value="rules">
          <AccordionTrigger className="text-sm">Auditoria completa ({audit.rules.length} regras)</AccordionTrigger>
          <AccordionContent className="space-y-5">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <p className="text-sm font-medium">{g.label}</p>
                  <span className="text-[11px] text-muted-foreground">{g.counts.pass} aprovadas · {g.counts.warning} atenção · {g.counts.fail} falharam</span>
                </div>
                <ul className="space-y-2">
                  {g.items.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3 border-b border-border/40 pb-2 text-sm">
                      <div className="min-w-0">
                        <p className="text-foreground">{r.label}</p>
                        <p className="text-xs text-muted-foreground">{r.evidence}</p>
                        {r.recommendation && r.status !== "pass" && <p className="text-xs text-foreground/80 mt-0.5">{r.recommendation}</p>}
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <Pill tone={ruleTone(r.status)}>{RULE_STATUS_LABEL[r.status]}</Pill>
                        {r.score !== null && <p className="text-[11px] text-muted-foreground">{r.score}/{r.max_points}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Section>
  );
};

export default TechnicalGeoAudit;
