import { useEffect, useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  DIMENSION_LABELS, type AnalysisResult, type CitationKey, type ClarityStatus, type EntityClarityKey,
} from "@/types/analysis";
import {
  DIMENSION_ORDER, basisLabel, bandLabel, claimCounts, CLAIM_STATUS_LABEL, executiveSummary, groupActionsByDimension,
  groupEntities, importantClaims, mergeActions, sanitizeOptimized, strengthsOf, SUPPORT_TYPE_LABEL, toneOf, topPriorities,
  weightedBreakdown, type DisplayAction, type Tone,
} from "@/lib/diagnosis";
import TechnicalGeoAudit, { pageTypeLabel } from "@/components/TechnicalGeoAudit";
import { Bar, Confidence, Help, Pill, Section, TONE_TEXT } from "./primitives";

export interface DiagnosisContext { source?: string; query?: string; inputType?: "webpage" | "text" }

const SCORE_HELP = "O RELLIA Content Score mede o quanto este conteúdo está preparado para comunicar seu tema, entidade, evidências e estrutura a sistemas de busca e IA. Ele não representa diretamente a frequência com que ChatGPT, Gemini, Claude ou outras IAs recomendam esta marca.";
const PARTIAL_HELP = "Technical GEO não se aplica a textos pré-publicação. O score foi calculado usando apenas as dimensões de conteúdo.";

const CLARITY_LABEL: Record<EntityClarityKey, string> = {
  primary_entity: "Entidade principal", entity_name_clear: "Nome", category_clear: "Categoria", offering_clear: "Oferta",
  audience_clear: "Público", problem_clear: "Problema", value_proposition_clear: "Proposta de valor", differentiators_clear: "Diferenciais",
};
const CLARITY_STATE: Record<ClarityStatus, { label: string; tone: Tone }> = {
  clear: { label: "Claro", tone: "positive" }, partial: { label: "Parcial", tone: "attention" }, absent: { label: "Ausente", tone: "problem" },
};
const CITATION_LABEL: Record<CitationKey, string> = {
  self_contained_facts: "Fatos autocontidos", clear_definitions: "Definições claras", direct_answers: "Respostas diretas",
  contextualized_numbers: "Números contextualizados", descriptive_headings: "Headings descritivos",
  claim_evidence_connection: "Relação afirmação/evidência", extractable_passages: "Trechos extraíveis",
};
const PRIORITY: Record<string, { label: string; tone: Tone }> = {
  alta: { label: "Alta", tone: "problem" }, media: { label: "Média", tone: "attention" }, baixa: { label: "Baixa", tone: "neutral" },
};
const pct = (w: number | null) => (w === null ? "—" : `${(w * 100).toFixed(w * 100 % 1 ? 1 : 0).replace(".", ",")}%`);
const num = (n: number) => n.toFixed(2).replace(".", ",");

const ActionCard = ({ a, compact = false }: { a: DisplayAction; compact?: boolean }) => (
  <li className="rounded-lg border border-border bg-background/40 p-4 space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <Pill tone={PRIORITY[a.priority]?.tone}>Prioridade {PRIORITY[a.priority]?.label}</Pill>
      {a.dimensions.map((d) => <Pill key={d}>{DIMENSION_LABELS[d]}</Pill>)}
      <span className="text-[11px] text-muted-foreground">{basisLabel(a.basis)}</span>
      <Confidence value={a.confidence} />
    </div>
    <p className="text-sm font-medium text-foreground leading-relaxed">{a.action}</p>
    {!compact && a.reason && <p className="text-sm text-muted-foreground"><span className="text-foreground/80">Motivo: </span>{a.reason}</p>}
    {!compact && a.evidence && <p className="text-xs text-muted-foreground border-l-2 border-border pl-2">Evidência: {a.evidence}</p>}
    {a.origins.length > 1 && <p className="text-[11px] text-muted-foreground">Origens: {a.origins.join(" + ")}</p>}
  </li>
);

const DiagnosisView = ({ result: r, context = {} }: { result: AnalysisResult; context?: DiagnosisContext }) => {
  const isText = context.inputType ? context.inputType === "text" : !r.technical_geo && !!r.content_score_partial;
  const score = Math.round(r.content_score ?? r.score);
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    let cur = 0; const step = Math.max(1, score / 40);
    const t = setInterval(() => { cur += step; if (cur >= score) { setAnimated(score); clearInterval(t); } else setAnimated(Math.floor(cur)); }, 25);
    return () => clearInterval(t);
  }, [score]);

  const actions = useMemo(() => mergeActions(r.action_plan, r.technical_geo), [r]);
  const priorities = useMemo(() => topPriorities(actions, r, 5), [actions, r]);
  const strengths = useMemo(() => strengthsOf(r), [r]);
  const summary = useMemo(() => executiveSummary(r, priorities), [r, priorities]);
  const breakdown = useMemo(() => weightedBreakdown(r), [r]);
  const claims = claimCounts(r.content_claims);
  const entities = groupEntities(r.entity_signals);
  const optimized = sanitizeOptimized(r.ideal_example);
  const [copied, setCopied] = useState(false);
  const tone = toneOf(score);

  const copy = async () => {
    await navigator.clipboard.writeText(optimized);
    setCopied(true); toast.success("Texto copiado"); setTimeout(() => setCopied(false), 1800);
  };

  const citationGaps = r.citation_readiness
    ? (Object.entries(r.citation_readiness.factors) as [CitationKey, { score: number; evidence?: string; confidence: number }][])
    : [];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 1. Score + contexto */}
      <section className="rounded-xl border border-border bg-card/80 backdrop-blur-md p-6 sm:p-8">
        <div className="grid gap-6 md:grid-cols-[auto,1fr] md:items-center">
          <div className="text-center md:text-left md:pr-8 md:border-r md:border-border">
            <p className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">RELLIA Content Score <Help text={SCORE_HELP} /></p>
            <p className={`text-7xl sm:text-8xl font-bold tabular-nums leading-none mt-2 ${TONE_TEXT[tone]}`}>{animated}</p>
            <div className="mt-3 flex flex-wrap justify-center md:justify-start gap-2">
              <Pill>Score 2.0</Pill>
              {isText && <Pill>Análise de conteúdo</Pill>}
              {r.content_score_partial && <span className="inline-flex items-center gap-1"><Pill>Score parcial</Pill><Help text={PARTIAL_HELP} /></span>}
            </div>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {!isText && context.source && <div className="sm:col-span-2 min-w-0"><dt className="text-xs text-muted-foreground">Página analisada</dt><dd className="break-all text-foreground/90">{context.source}</dd></div>}
            {context.query && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Intenção analisada</dt><dd className="italic text-foreground/90">"{context.query}"</dd></div>}
            {r.technical_geo && <div><dt className="text-xs text-muted-foreground">Tipo de página</dt><dd>{pageTypeLabel(r.technical_geo.page_type.page_type)}</dd></div>}
            {r.technical_geo && <div><dt className="text-xs text-muted-foreground">Technical GEO Coverage</dt><dd className="text-muted-foreground">{Math.round(r.technical_geo.coverage * 100)}%</dd></div>}
          </dl>
        </div>
      </section>

      {/* 2. Diagnóstico */}
      <Section title="Diagnóstico">
        <p className="text-sm sm:text-base leading-relaxed text-foreground/90">{summary}</p>
      </Section>

      {/* 3. Composição */}
      <Section title="Composição do Score" lead="Cinco dimensões, cada uma com o peso aplicado nesta análise.">
        <ul className="divide-y divide-border/60">
          {DIMENSION_ORDER.map((k) => {
            const d = r.score_dimensions?.[k];
            const row = breakdown.rows.find((x) => x.key === k)!;
            const na = !d || !d.available || d.score === null;
            const t = na ? "neutral" : toneOf(d!.score);
            return (
              <li key={k} className="py-3 grid gap-2 sm:grid-cols-[1fr,auto] sm:items-center">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{DIMENSION_LABELS[k]}</span>
                    <Pill tone={t}>{na ? "N/D — não aplicável" : bandLabel(d!.score)}</Pill>
                    {!na && <span className="text-[11px] text-muted-foreground">peso {pct(row.weight)}</span>}
                  </div>
                  <Bar value={na ? null : d!.score} tone={t} />
                  {d?.reason && <p className="text-xs text-muted-foreground leading-relaxed">{d.reason}</p>}
                </div>
                <div className="flex items-baseline gap-2 sm:justify-end">
                  <span className={`text-2xl font-semibold tabular-nums ${TONE_TEXT[t]}`}>{na ? "N/D" : Math.round(d!.score as number)}</span>
                  {!na && <Confidence value={d!.confidence} />}
                </div>
              </li>
            );
          })}
        </ul>
        {breakdown.usesPersistedWeights && (
          <Collapsible>
            <CollapsibleTrigger className="group inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Como este score foi calculado? <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 rounded-lg border border-border bg-background/40 p-4 text-sm space-y-1.5">
              {breakdown.rows.map((row) => (
                <div key={row.key} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="tabular-nums">{row.available ? `${Math.round(row.score as number)} × ${pct(row.weight)} = ${num(row.contribution as number)}` : "N/D (peso redistribuído)"}</span>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-border pt-2 font-medium">
                <span>Resultado ponderado</span>
                <span className="tabular-nums">{num(breakdown.weighted as number)} → {breakdown.rounded}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">Pesos registrados na própria análise{r.content_score_partial ? " (redistribuídos porque Technical GEO não se aplica a texto)" : ""}.</p>
            </CollapsibleContent>
          </Collapsible>
        )}
      </Section>

      {/* 4. Prioridades */}
      <Section title="O que corrigir primeiro" lead={priorities.length ? `As ${priorities.length} ações com maior prioridade.` : undefined}>
        {priorities.length ? <ul className="space-y-3">{priorities.map((a) => <ActionCard key={a.key} a={a} />)}</ul>
          : <p className="text-sm text-muted-foreground">Nenhuma ação prioritária identificada.</p>}
      </Section>

      {/* 5. Pontos fortes */}
      {strengths.length > 0 && (
        <Section title="O que já está funcionando">
          <ul className="grid gap-2 sm:grid-cols-2">
            {strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground/90"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />{s}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* 6–13 Detalhes */}
      <Accordion type="multiple" className="space-y-3">
        {r.entity_clarity && (
          <AccordionItem value="entity" className="rounded-xl border border-border bg-card/70 px-5">
            <AccordionTrigger className="text-left"><span>A IA consegue entender quem você é?</span></AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Esta análise verifica se o conteúdo deixa claros a entidade, categoria, oferta, público e proposta de valor.</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(CLARITY_LABEL) as EntityClarityKey[]).map((k) => {
                  const it = r.entity_clarity![k]; if (!it) return null;
                  const st = CLARITY_STATE[it.status];
                  return (
                    <li key={k} className="rounded-md border border-border/60 p-3">
                      <Collapsible>
                        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-sm">
                          <span className="text-left">{CLARITY_LABEL[k]}{it.value && <span className="text-muted-foreground">: {it.value}</span>}</span>
                          <Pill tone={st.tone}>{st.label}</Pill>
                        </CollapsibleTrigger>
                        {it.evidence && <CollapsibleContent className="pt-2 text-xs text-muted-foreground">Evidência: {it.evidence} · <Confidence value={it.confidence} /></CollapsibleContent>}
                      </Collapsible>
                    </li>
                  );
                })}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}

        {r.content_claims && (
          <AccordionItem value="claims" className="rounded-xl border border-border bg-card/70 px-5">
            <AccordionTrigger className="text-left">Suas afirmações estão sustentadas?</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <p className="text-xs text-muted-foreground">A RELLIA está avaliando se a própria página apresenta suporte para a afirmação. Isto não é uma verificação externa de veracidade.</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                {([["Encontradas", claims.total, "neutral"], ["Com suporte", claims.supported, "positive"], ["Parciais", claims.partially_supported, "attention"], ["Sem suporte", claims.unsupported, "problem"], ["Desconhecidas", claims.unknown, "neutral"]] as [string, number, Tone][]).map(([l, v, t]) => (
                  <div key={l} className="rounded-md border border-border/60 p-2"><p className={`text-xl font-semibold ${TONE_TEXT[t]}`}>{v}</p><p className="text-[11px] text-muted-foreground">{l}</p></div>
                ))}
              </div>
              <ul className="space-y-2">
                {importantClaims(r.content_claims).map((c, i) => (
                  <li key={i} className="rounded-md border border-border/60 p-3 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={c.support_status === "supported" ? "positive" : c.support_status === "partially_supported" ? "attention" : c.support_status === "unsupported" ? "problem" : "neutral"}>{CLAIM_STATUS_LABEL[c.support_status]}</Pill>
                      <span className="text-[11px] text-muted-foreground">Suporte: {SUPPORT_TYPE_LABEL[c.support_type] ?? c.support_type}</span>
                      <Confidence value={c.confidence} />
                    </div>
                    <p className="text-sm">{c.summary}</p>
                    {c.evidence && <p className="text-xs text-muted-foreground">Evidência: {c.evidence}</p>}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}

        {r.citation_readiness && (
          <AccordionItem value="citation" className="rounded-xl border border-border bg-card/70 px-5">
            <AccordionTrigger className="text-left">Seu conteúdo é fácil de usar como referência?</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Esta dimensão mede se o conteúdo apresenta fatos, definições e respostas em uma estrutura que facilita sua extração e utilização como evidência. Ela não garante que uma IA citará esta página.</p>
              <ul className="space-y-2.5">
                {citationGaps.sort((a, b) => a[1].score - b[1].score).map(([k, f]) => (
                  <li key={k} className="space-y-1">
                    <div className="flex justify-between text-sm"><span>{CITATION_LABEL[k] ?? k}</span><span className={`tabular-nums ${TONE_TEXT[toneOf(f.score)]}`}>{Math.round(f.score)}</span></div>
                    <Bar value={f.score} tone={toneOf(f.score)} />
                    {f.evidence && f.score < 60 && <p className="text-xs text-muted-foreground">{f.evidence}</p>}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="tech" className="rounded-xl border border-border bg-card/70 px-5">
          <AccordionTrigger className="text-left">Technical GEO</AccordionTrigger>
          <AccordionContent>
            {r.technical_geo ? <TechnicalGeoAudit audit={r.technical_geo} />
              : <p className="text-sm text-muted-foreground">N/D — Technical GEO não se aplica a textos pré-publicação.</p>}
          </AccordionContent>
        </AccordionItem>

        {r.keywords_analysis && (
          <AccordionItem value="topics" className="rounded-xl border border-border bg-card/70 px-5">
            <AccordionTrigger className="text-left">Tópicos & Termos</AccordionTrigger>
            <AccordionContent className="space-y-4">
              {([["Tópicos e termos encontrados", r.keywords_analysis.found, "positive"], ["Tópicos ausentes", r.keywords_analysis.missing, "attention"], ["Sugestões", r.keywords_analysis.suggested, "neutral"]] as [string, string[], Tone][]).map(([l, list, t]) =>
                list?.length ? (
                  <div key={l}><p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{l}</p>
                    <div className="flex flex-wrap gap-1.5">{list.map((w, i) => <Pill key={i} tone={t}>{w}</Pill>)}</div></div>
                ) : null)}
            </AccordionContent>
          </AccordionItem>
        )}

        {entities.length > 0 && (
          <AccordionItem value="entities" className="rounded-xl border border-border bg-card/70 px-5">
            <AccordionTrigger className="text-left">Entidades identificadas</AccordionTrigger>
            <AccordionContent className="space-y-4">
              {entities.map((g) => (
                <div key={g.type}><p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{g.label}</p>
                  <ul className="space-y-1.5">{g.items.map((e, i) => (
                    <li key={i} className="text-sm">
                      <Collapsible>
                        <CollapsibleTrigger className="flex flex-wrap items-center gap-2 text-left">
                          <span>{e.name}</span>
                          <Pill tone={e.explicit_or_inferred === "explicit" ? "positive" : "neutral"}>{e.explicit_or_inferred === "explicit" ? "Explícita" : "Inferida"}</Pill>
                          <Confidence value={e.confidence} />
                        </CollapsibleTrigger>
                        {e.evidence && <CollapsibleContent className="pt-1 text-xs text-muted-foreground">Evidência: {e.evidence}</CollapsibleContent>}
                      </Collapsible>
                    </li>))}</ul>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        {actions.length > 0 && (
          <AccordionItem value="plan" className="rounded-xl border border-border bg-card/70 px-5">
            <AccordionTrigger className="text-left">Plano de ação completo ({actions.length})</AccordionTrigger>
            <AccordionContent className="space-y-5">
              {groupActionsByDimension(actions).map((g) => (
                <div key={g.key} className="space-y-2">
                  <p className="text-sm font-medium">{g.label}</p>
                  {(["alta", "media", "baixa"] as const).map((p) => g.byPriority[p].length ? (
                    <ul key={p} className="space-y-2">{g.byPriority[p].map((a) => <ActionCard key={a.key} a={a} compact />)}</ul>
                  ) : null)}
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        {optimized && (
          <AccordionItem value="optimized" className="rounded-xl border border-border bg-card/70 px-5">
            <AccordionTrigger className="text-left">{isText ? "Ver texto otimizado" : "Ver versão otimizada"}</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Esta versão aplica as recomendações identificadas nesta análise. Na futura etapa Brand Intelligence, ela também utilizará o posicionamento, tom de voz e territórios estratégicos da marca.{!isText && " Use como referência: não é necessário substituir a página inteira."}</p>
              <div className="flex justify-end"><Button size="sm" variant="outline" onClick={copy} className="gap-2">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}Copiar</Button></div>
              <div className="rounded-lg border border-border bg-background/40 p-4"><p className="text-sm leading-relaxed whitespace-pre-wrap">{optimized}</p></div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
};

export default DiagnosisView;
