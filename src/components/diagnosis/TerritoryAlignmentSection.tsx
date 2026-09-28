import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import type { AnalysisResult } from "@/types/analysis";
import { bandLabel, toneOf, type Tone } from "@/lib/diagnosis";
import {
  PRIORITY_SHORT, TA_FINDING_LABEL, TA_GAP_LABEL, TA_LABELS, TA_ORDER, territoryLink, territoryRefLabel, territoryUnavailableNotes, topicTexts,
} from "@/lib/territory-alignment-view";
import { Bar, Confidence, Pill, Section, TONE_TEXT } from "./primitives";

const pct = (w?: number) => (typeof w === "number" ? `${Math.round(w * 1000) / 10}%`.replace(".", ",") : "—");
const PRI: Record<string, Tone> = { high: "problem", medium: "attention", low: "neutral" };
const PRI_LABEL: Record<string, string> = { high: "Alta", medium: "Média", low: "Baixa" };

const TerritoryAlignmentSection = ({ r }: { r: AnalysisResult }) => {
  const dims = r.territory_alignment_dimensions; const s = r.territory_snapshot;
  if (!dims || !s) return null;
  const notes = territoryUnavailableNotes(r);
  const cov = r.territory_topic_coverage;
  const link = territoryLink(s);
  const conflicts = (r.territory_findings ?? []).filter((f) => f.type === "excluded_concept_conflict" || f.type === "territory_conflict" || f.type === "semantic_drift");
  const outdated = s.relations.filter((x) => x.source_version_outdated).length;

  return (
    <Section id="territory-alignment" title="Contribuição para o território"
      lead={`${s.territory_name} · ${PRIORITY_SHORT[s.priority]} · Territory Alignment ${r.territory_alignment_version}${r.territory_alignment_partial ? " · parcial" : ""}`}>
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2" data-testid="territory-header">
        {s.strategic_intent && <p><span className="text-foreground/80">Intenção estratégica:</span> {s.strategic_intent}</p>}
        {s.desired_association && <p><span className="text-foreground/80">Associação desejada:</span> {s.desired_association}</p>}
        <p>Fundamentos: {s.readiness.label}{outdated > 0 && ` · ${outdated} conexão(ões) de versão anterior do Brand Profile`}</p>
        {link && <Link to={link} className="inline-flex items-center gap-1 text-primary hover:underline">Ver território<ExternalLink className="h-3 w-3" /></Link>}
      </div>

      <ul className="divide-y divide-border/60 mt-3" data-testid="territory-dimensions">
        {TA_ORDER.map((k) => {
          const d = dims[k]; const na = !d?.available || d.score === null; const t: Tone = na ? "neutral" : toneOf(d.score as number);
          return (
            <li key={k} className="py-3 grid gap-2 sm:grid-cols-[1fr,auto] sm:items-center">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{TA_LABELS[k]}</span>
                  <Pill tone={t}>{na ? "N/D — fora do cálculo" : bandLabel(d.score as number)}</Pill>
                  {!na && <span className="text-[11px] text-muted-foreground">peso {pct(r.territory_alignment_weights_applied?.[k])}</span>}
                </div>
                <Bar value={na ? null : d.score} tone={t} />
                {d?.reason && <p className="text-xs text-muted-foreground leading-relaxed">{d.reason}</p>}
              </div>
              <div className="flex items-baseline gap-2 sm:justify-end">
                <span className={`text-2xl font-semibold tabular-nums ${TONE_TEXT[t]}`}>{na ? "N/D" : Math.round(d.score as number)}</span>
                {!na && <Confidence value={d.confidence} />}
              </div>
            </li>
          );
        })}
      </ul>

      {r.territory_alignment_partial && notes.length > 0 && (
        <div className="rounded-md border border-border bg-background/40 p-3 text-xs text-muted-foreground space-y-1">
          <p className="text-foreground/80 font-medium">Score parcial — pesos redistribuídos entre as dimensões disponíveis.</p>
          {notes.map((n, i) => <p key={i}>{n}</p>)}
        </div>
      )}

      {cov && (cov.topics_present.length + cov.relevant_topics_missing.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2 mt-3 text-sm" data-testid="territory-topics">
          <div><p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Subtópicos presentes</p>
            <div className="flex flex-wrap gap-1.5">{topicTexts(cov.topics_present, s).map((t) => <Pill key={t} tone="positive">{t}</Pill>)}{!cov.topics_present.length && <span className="text-xs text-muted-foreground">Nenhum</span>}</div></div>
          <div><p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Relevantes e ausentes</p>
            <div className="flex flex-wrap gap-1.5">{topicTexts(cov.relevant_topics_missing, s).map((t) => <Pill key={t} tone="attention">{t}</Pill>)}{!cov.relevant_topics_missing.length && <span className="text-xs text-muted-foreground">Nenhum</span>}</div></div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 mt-4">
        {!!r.territory_strengths?.length && (
          <div><p className="text-sm font-medium mb-2">O que já reforça o território</p>
            <ul className="space-y-2">{r.territory_strengths.slice(0, 5).map((x, i) => (
              <li key={i} className="text-sm"><p>{x.statement}</p><p className="text-xs text-muted-foreground italic">“{x.content_evidence}”</p></li>))}</ul></div>
        )}
        {!!r.territory_gaps?.length && (
          <div><p className="text-sm font-medium mb-2">Lacunas territoriais</p>
            <ul className="space-y-2">{r.territory_gaps.slice(0, 5).map((x, i) => (
              <li key={i} className="text-sm"><Pill>{TA_GAP_LABEL[x.gap_type] ?? x.gap_type}</Pill> <span>{x.statement}</span>
                {territoryRefLabel(x.territory_reference, s) && <p className="text-xs text-muted-foreground">Ref.: {territoryRefLabel(x.territory_reference, s)}</p>}</li>))}</ul></div>
        )}
      </div>

      {conflicts.length > 0 && (
        <div className="mt-4"><p className="text-sm font-medium mb-2">Pontos de atenção</p>
          <ul className="space-y-2">{conflicts.slice(0, 5).map((f, i) => (
            <li key={i} className="text-sm"><Pill tone="attention">{TA_FINDING_LABEL[f.type] ?? f.type}</Pill> {f.statement}
              {f.content_evidence && <p className="text-xs text-muted-foreground italic">“{f.content_evidence}”</p>}</li>))}</ul></div>
      )}

      {!!r.territory_next_actions?.length && (
        <div className="mt-4" data-testid="territory-actions"><p className="text-sm font-medium mb-2">Próximas ações para o território</p>
          <ol className="space-y-2 list-decimal pl-5">{r.territory_next_actions.slice(0, 5).map((a, i) => (
            <li key={i} className="text-sm"><span>{a.text}</span> <Pill tone={PRI[a.priority]}>{PRI_LABEL[a.priority]}</Pill> <span className="text-[11px] text-muted-foreground">{TA_LABELS[a.dimension]}</span></li>))}</ol></div>
      )}
      <p className="text-[11px] text-muted-foreground mt-4">Snapshot do território salvo no momento da análise; alterações posteriores no território não mudam este resultado.</p>
    </Section>
  );
};

export default TerritoryAlignmentSection;
