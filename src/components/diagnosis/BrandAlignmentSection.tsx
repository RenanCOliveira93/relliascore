import { Link } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { AnalysisResult } from "@/types/analysis";
import type { BADimension } from "@/types/brand-alignment";
import { bandLabel, toneOf, type Tone } from "@/lib/diagnosis";
import {
  BA_LABELS, BA_ORDER, BASIS_LABEL, CLAIM_CLASS_LABEL, ENTITY_STATUS_LABEL, GAP_TYPE_LABEL, POSITIONING_STATUS_LABEL,
  profileLink, profileSectionFor, unavailableNotes,
} from "@/lib/brand-alignment-view";
import { Bar, Confidence, Pill, Section, TONE_TEXT } from "./primitives";

const SEV: Record<string, { label: string; tone: Tone }> = {
  high: { label: "Alta", tone: "problem" }, medium: { label: "Média", tone: "attention" }, low: { label: "Baixa", tone: "neutral" }, info: { label: "Info", tone: "neutral" },
};
const pct = (w?: number) => (typeof w === "number" ? `${Math.round(w * 1000) / 10}%`.replace(".", ",") : "—");

const ProfileLink = ({ r, refId, label = "Ver no Brand Profile" }: { r: AnalysisResult; refId: string | null; label?: string }) => {
  const href = profileLink(r.empresa_id ?? r.brand_context_snapshot?.empresa_id, profileSectionFor(refId, r.brand_context_snapshot));
  if (!href || !refId) return null;
  return <Link to={href} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">{label}<ExternalLink className="h-3 w-3" /></Link>;
};

const BrandAlignmentSection = ({ r }: { r: AnalysisResult }) => {
  const dims = r.brand_alignment_dimensions;
  if (!dims) return null;
  const notes = unavailableNotes(r);
  const byDim = (k: BADimension) => ({
    findings: (r.brand_alignment_findings ?? []).filter((f) => f.dimension === k),
    recs: (r.brand_recommendations ?? []).filter((x) => x.dimension === k),
  });

  return (
    <Section id="brand-alignment" title="Alinhamento com a marca"
      lead={`Brand Brain v${r.brand_context_snapshot?.brand_brain_version ?? "?"} · Brand Alignment ${r.brand_alignment_version}${r.brand_alignment_partial ? " · parcial" : ""}`}>
      <ul className="divide-y divide-border/60" data-testid="brand-dimensions">
        {BA_ORDER.map((k) => {
          const d = dims[k]; const na = !d?.available || d.score === null; const t: Tone = na ? "neutral" : toneOf(d.score as number);
          return (
            <li key={k} className="py-3 grid gap-2 sm:grid-cols-[1fr,auto] sm:items-center">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{BA_LABELS[k]}</span>
                  <Pill tone={t}>{na ? "N/D — fora do cálculo" : k === "positioning" && d.status ? POSITIONING_STATUS_LABEL[d.status] : bandLabel(d.score as number)}</Pill>
                  {!na && <span className="text-[11px] text-muted-foreground">peso {pct(r.brand_alignment_weights_applied?.[k])}</span>}
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
      {r.brand_alignment_partial && notes.length > 0 && (
        <div className="rounded-md border border-border bg-background/40 p-3 text-xs text-muted-foreground space-y-1">
          <p className="text-foreground/80 font-medium">Score parcial — pesos redistribuídos entre as dimensões disponíveis.</p>
          {notes.map((n, i) => <p key={i}>{n}</p>)}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">O que o conteúdo reforça</p>
          {(r.brand_strengths ?? []).length ? (
            <ul className="space-y-2">{r.brand_strengths!.slice(0, 4).map((s, i) => (
              <li key={i} className="text-sm flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" /><span>{s.statement}<span className="block text-xs text-muted-foreground">“{s.content_evidence}”</span></span></li>
            ))}</ul>
          ) : <p className="text-sm text-muted-foreground">Nenhum reforço de marca identificado com evidência no conteúdo.</p>}
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Lacunas de marca</p>
          {(r.brand_gaps ?? []).length ? (
            <ul className="space-y-2">{r.brand_gaps!.slice(0, 4).map((g, i) => (
              <li key={i} className="text-sm space-y-1">
                <div className="flex flex-wrap items-center gap-2"><Pill tone={g.gap_type === "inconsistency" ? "attention" : "neutral"}>{GAP_TYPE_LABEL[g.gap_type]}</Pill><ProfileLink r={r} refId={g.brand_reference} /></div>
                <p>{g.statement}</p>
              </li>
            ))}</ul>
          ) : <p className="text-sm text-muted-foreground">Nenhuma lacuna relevante identificada.</p>}
        </div>
      </div>

      <Collapsible>
        <CollapsibleTrigger className="group inline-flex items-center gap-1 text-sm text-primary hover:underline">
          Ver diagnóstico completo da marca <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4" data-testid="brand-full">
          {BA_ORDER.map((k) => {
            const d = dims[k]; const { findings, recs } = byDim(k);
            return (
              <div key={k} className="rounded-lg border border-border bg-background/40 p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{BA_LABELS[k]}</p>
                  <span className="text-sm tabular-nums text-muted-foreground">{d?.available && d.score !== null ? Math.round(d.score) : "N/D"}</span>
                </div>
                {d?.reason && <p className="text-sm text-muted-foreground">{d.reason}</p>}
                {d?.evidence?.length ? <div className="text-xs text-muted-foreground space-y-0.5">{d.evidence.map((e, i) => <p key={i} className="border-l-2 border-border pl-2">Conteúdo: “{e}”</p>)}</div> : null}
                {d?.brand_refs?.length ? <div className="flex flex-wrap gap-2">{d.brand_refs.slice(0, 3).map((ref) => <ProfileLink key={ref} r={r} refId={ref} />)}</div> : null}
                {findings.map((f, i) => (
                  <div key={i} className="rounded-md border border-border/60 p-3 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={SEV[f.severity].tone}>Severidade {SEV[f.severity].label}</Pill>
                      {f.classification && <Pill>{CLAIM_CLASS_LABEL[f.classification] ?? f.classification}</Pill>}
                      {f.basis && <span className="text-[11px] text-muted-foreground">base: {BASIS_LABEL[f.basis]}</span>}
                      <Confidence value={f.confidence} />
                    </div>
                    <p className="text-sm">{f.statement}</p>
                    {f.brand_evidence && <p className="text-xs text-muted-foreground">Brand Profile: {f.brand_evidence}</p>}
                    {f.recommendation && <p className="text-xs text-foreground/80">Recomendação: {f.recommendation}</p>}
                    <ProfileLink r={r} refId={f.brand_reference} label={k === "claim_evidence" ? "Revisar claims da marca" : "Ver no Brand Profile"} />
                  </div>
                ))}
                {recs.length > 0 && <ul className="space-y-1">{recs.map((x, i) => <li key={i} className="text-sm flex gap-2"><span className="text-primary">→</span>{x.text}</li>)}</ul>}
              </div>
            );
          })}
          <div className="rounded-lg border border-border bg-background/40 p-4 space-y-2">
            <p className="text-sm font-medium">Consistência de entidades</p>
            {(r.brand_entity_consistency ?? []).length ? (
              <ul className="space-y-1.5">{r.brand_entity_consistency!.map((e, i) => (
                <li key={i} className="text-sm flex flex-wrap items-center gap-2">
                  <span>{e.mention}</span>
                  <Pill tone={e.status === "consistent" ? "positive" : e.status === "conflict" ? "problem" : e.status === "ambiguous" ? "attention" : "neutral"}>{ENTITY_STATUS_LABEL[e.status]}</Pill>
                  {e.note && <span className="text-xs text-muted-foreground">{e.note}</span>}
                  <ProfileLink r={r} refId={e.brand_reference} />
                </li>
              ))}</ul>
            ) : <p className="text-sm text-muted-foreground">Nenhuma inconsistência de entidade identificada.</p>}
          </div>
          <p className="text-[11px] text-muted-foreground">“Não encontrada no Brand Profile” não significa que a informação seja falsa — apenas que ela não está registrada no perfil da marca. Alterações no Brand Profile são feitas na página da empresa.</p>
        </CollapsibleContent>
      </Collapsible>
    </Section>
  );
};

export default BrandAlignmentSection;
