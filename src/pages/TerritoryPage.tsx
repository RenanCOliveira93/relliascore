import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowLeft, Check, History, Pencil, Plus, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import VideoBackground from "@/components/VideoBackground";
import { Button } from "@/components/ui/button";
import { Pill, Section } from "@/components/diagnosis/primitives";
import { Chips, EmptyLine } from "@/components/brand-profile/parts";
import { activeItems, type RankedItem } from "@/lib/brand-profile";
import {
  AUDIT_LABEL, RELATION_TABLE, TYPE_LABEL, brainUpdatedSinceReview, territoryReadiness,
  type StrategicTerritory, type TerritoryAuditEvent, type TerritoryRelation, type TerritoryRelationKind,
} from "@/lib/territories";
import { PriorityPill, TerritoryDialog, useTerritoryMutate } from "@/components/territories/shared";

type Row = { id: string } & Record<string, unknown>;
const labelOf = (k: TerritoryRelationKind, r: Row) => String((k === "positioning" ? r.statement ?? r.primary_category : k === "differentiator" || k === "claim" ? r.statement : k === "evidence" ? r.title : r.name) ?? "—");
const fmt = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const GROUPS: { kind: TerritoryRelationKind; title: string; empty: string }[] = [
  { kind: "positioning", title: "Posicionamento relacionado", empty: "Nenhum posicionamento relacionado." },
  { kind: "offering", title: "Produtos & Serviços relacionados", empty: "Nenhum produto ou serviço relacionado." },
  { kind: "problem", title: "Problemas relacionados", empty: "Nenhum problema relacionado." },
  { kind: "audience", title: "Públicos relacionados", empty: "Nenhum público relacionado." },
  { kind: "differentiator", title: "Diferenciais relacionados", empty: "Nenhum diferencial relacionado." },
  { kind: "claim", title: "Claims que sustentam este território", empty: "Nenhum claim relacionado a este território." },
  { kind: "evidence", title: "Evidências disponíveis", empty: "Nenhuma evidência relacionada a este território." },
  { kind: "entity", title: "Entidades", empty: "Nenhuma entidade relacionada." },
];

const TerritoryPage = () => {
  const { empresaId, territoryId } = useParams();
  const [t, setT] = useState<StrategicTerritory | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [rels, setRels] = useState<TerritoryRelation[]>([]);
  const [brain, setBrain] = useState<{ id: string; version: number } | null>(null);
  const [catalog, setCatalog] = useState<Record<TerritoryRelationKind, Row[]>>({} as Record<TerritoryRelationKind, Row[]>);
  const [audit, setAudit] = useState<TerritoryAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [adding, setAdding] = useState<TerritoryRelationKind | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  const load = useCallback(async () => {
    if (!empresaId || !territoryId) return;
    const [{ data: terr }, { data: emp }, { data: r }, { data: b }, { data: log }] = await Promise.all([
      supabase.from("brand_territories").select("*").eq("id", territoryId).eq("empresa_id", empresaId).maybeSingle(),
      supabase.from("empresas").select("nome").eq("id", empresaId).maybeSingle(),
      supabase.from("brand_territory_relations").select("*").eq("territory_id", territoryId).order("created_at"),
      supabase.from("brand_brains").select("id, version").eq("empresa_id", empresaId).eq("is_active", true).maybeSingle(),
      supabase.from("brand_audit_log").select("id, action, user_id, created_at, target_id, old_value, new_value").eq("target_table", "brand_territories").eq("target_id", territoryId).order("created_at", { ascending: false }).limit(50),
    ]);
    setT((terr ?? null) as unknown as StrategicTerritory | null);
    setEmpresaNome(emp?.nome ?? "");
    setRels((r ?? []) as unknown as TerritoryRelation[]);
    setBrain(b ?? null);
    setAudit((log ?? []).map((l) => ({ ...l, action: l.action.replace(/^territory_/, "") })) as unknown as TerritoryAuditEvent[]);
    if (b) {
      const kinds = Object.keys(RELATION_TABLE) as TerritoryRelationKind[];
      const lists = await Promise.all(kinds.map((k) => supabase.from(RELATION_TABLE[k] as "brand_offerings").select("*").eq("brand_brain_id", b.id)));
      setCatalog(Object.fromEntries(kinds.map((k, i) => [k, activeItems((lists[i].data ?? []) as unknown as RankedItem[]) as unknown as Row[]])) as Record<TerritoryRelationKind, Row[]>);
    }
    setLoading(false);
  }, [empresaId, territoryId]);
  useEffect(() => { void load(); }, [load]);
  const { call, busy, confirmDialog } = useTerritoryMutate(load);

  const readiness = useMemo(() => territoryReadiness(rels), [rels]);
  const back = <Link to={`/empresas/${empresaId}/brand#territories`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Brand Profile</Link>;
  const shell = (c: React.ReactNode) => (
    <div className="min-h-screen relative"><VideoBackground />
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:py-10 space-y-5">{back}{c}</main>
    </div>
  );
  if (loading) return shell(<p className="text-muted-foreground">Carregando...</p>);
  if (!t) return shell(<Section title="Território não encontrado"><EmptyLine>Este território não existe ou não pertence a você.</EmptyLine></Section>);

  const archived = t.status === "archived";
  const stale = brainUpdatedSinceReview(t, brain?.version ?? null);
  const text = (title: string, v: string | null, empty = "Não definido.") => (
    <Section title={title}>{v ? <p className="text-sm leading-relaxed whitespace-pre-line">{v}</p> : <EmptyLine>{empty}</EmptyLine>}</Section>
  );
  const topics = (title: string, items: string[], empty: string) => (
    <Section title={title}>{items.length ? <Chips items={items} /> : <EmptyLine>{empty}</EmptyLine>}</Section>
  );

  return shell(
    <>
      <section className="rounded-xl border border-border bg-card/70 backdrop-blur-md p-5 sm:p-6 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityPill p={t.priority} /><Pill>{TYPE_LABEL[t.territory_type]}</Pill>
          {archived && <Pill tone="attention">Arquivado</Pill>}
          {t.origin === "brand_brain_suggestion" && <Pill>Sugerido pela RELLIA · aceito por você</Pill>}
        </div>
        <h1 data-testid="territory-title" className="text-2xl sm:text-3xl font-semibold break-words">{t.name}</h1>
        <p className="text-sm text-muted-foreground">Empresa: {empresaNome}</p>
        <div className="flex flex-wrap gap-2">
          {!archived && <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 mr-1" />Editar</Button>}
          {!archived ? <Button size="sm" variant="ghost" onClick={() => call({ action: "archive", territory_id: t.id }, "Território arquivado")}><Archive className="h-4 w-4 mr-1" />Arquivar</Button>
            : <Button size="sm" onClick={() => call({ action: "restore", territory_id: t.id }, "Território restaurado")}><ArchiveRestore className="h-4 w-4 mr-1" />Restaurar</Button>}
          <Button size="sm" variant="ghost" onClick={() => setShowAudit(!showAudit)}><History className="h-4 w-4 mr-1" />Histórico</Button>
        </div>
        {stale && !archived && (
          <div data-testid="brain-updated" className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2">
            <span>Brand Brain atualizado (v{brain?.version}) desde a última revisão deste território (v{t.last_reviewed_brand_brain_version}). Nada foi alterado automaticamente.</span>
            <Button size="sm" variant="outline" onClick={() => call({ action: "mark_reviewed", territory_id: t.id }, "Revisão registrada")}><RefreshCw className="h-3.5 w-3.5 mr-1" />Marcar como revisado</Button>
          </div>
        )}
        {!brain && <p className="text-xs text-muted-foreground">Esta empresa ainda não tem Brand Brain: o território existe, mas conexões com produtos, claims e evidências ficam disponíveis após a análise de marca.</p>}
        {t.origin === "brand_brain_suggestion" && t.suggestion_rationale && <p className="text-xs text-muted-foreground">Motivo da sugestão original (Brand Brain v{t.source_brand_brain_version}): {t.suggestion_rationale}</p>}
      </section>

      {showAudit && (
        <Section title="Histórico de alterações">
          {audit.length === 0 ? <EmptyLine>Sem eventos.</EmptyLine> : <ul data-testid="audit" className="text-sm space-y-1">{audit.map((e) => (
            <li key={e.id} className="flex justify-between gap-3 border-b border-border/40 py-1 last:border-0"><span>{AUDIT_LABEL[`territory_${e.action}`] ?? e.action}</span><span className="text-muted-foreground text-xs">{fmt(e.created_at)}</span></li>
          ))}</ul>}
        </Section>
      )}

      {text("Objetivo estratégico", t.strategic_intent, "Defina o que a marca deve representar neste território.")}
      {text("Associação desejada", t.desired_association)}
      <Section title="Definição do território">
        {t.core_concept || t.description || t.target_audience_summary ? (
          <div className="space-y-2 text-sm">
            {t.core_concept && <p><span className="text-muted-foreground">Conceito central:</span> {t.core_concept}</p>}
            {t.description && <p>{t.description}</p>}
            {t.target_audience_summary && <p><span className="text-muted-foreground">Público:</span> {t.target_audience_summary}</p>}
          </div>
        ) : <EmptyLine>Ainda não definido.</EmptyLine>}
      </Section>
      {topics("Tópicos incluídos", t.included_topics, "Nenhum tópico incluído.")}
      {topics("Tópicos excluídos", t.excluded_topics, "Nenhum tópico excluído.")}
      {topics("Conceitos relacionados", t.related_concepts, "Nenhum conceito relacionado.")}

      {GROUPS.map((g) => {
        const linked = rels.filter((r) => r.relation_kind === g.kind);
        const options = (catalog[g.kind] ?? []).filter((c) => !linked.some((l) => l.item_id === c.id));
        return (
          <Section key={g.kind} id={`rel-${g.kind}`} title={g.title}
            aside={!archived && brain && options.length > 0 ? <Button size="sm" variant="ghost" onClick={() => setAdding(adding === g.kind ? null : g.kind)}><Plus className="h-4 w-4 mr-1" />Relacionar</Button> : undefined}>
            {linked.length === 0 ? <EmptyLine>{g.empty}</EmptyLine> : (
              <ul className="space-y-1.5" data-testid={`rel-list-${g.kind}`}>{linked.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-2 rounded-md border border-border/50 px-3 py-2 text-sm">
                  <span className="min-w-0 break-words">{l.item_label}
                    <span className="block text-[11px] text-muted-foreground">Brand Brain v{l.brand_brain_version}{l.origin === "brand_brain_suggestion" ? " · da sugestão" : ""}{brain && l.brand_brain_id !== brain.id ? " · de uma versão anterior" : ""}</span>
                  </span>
                  {!archived && <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label="Remover relação" onClick={() => call({ action: "relation_remove", territory_id: t.id, relation_id: l.id }, "Relação removida")}><X className="h-3.5 w-3.5" /></Button>}
                </li>
              ))}</ul>
            )}
            {adding === g.kind && (
              <div className="rounded-md border border-dashed border-border p-2 space-y-1">
                <p className="text-xs text-muted-foreground">Itens do Brand Brain ativo (v{brain?.version}):</p>
                {options.map((o) => (
                  <button key={o.id} disabled={busy} className="w-full text-left text-sm rounded px-2 py-1.5 hover:bg-muted/40 flex items-center gap-2"
                    onClick={async () => { const r = await call({ action: "relation_add", territory_id: t.id, kind: g.kind, item_id: o.id }); if (r.ok) setAdding(null); }}>
                    <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{labelOf(g.kind, o)}
                  </button>
                ))}
              </div>
            )}
          </Section>
        );
      })}

      <Section id="readiness" title="Base estratégica" lead="Checklist de fundamentos conectados — não é uma nota.">
        <ul data-testid="readiness" className="space-y-1 text-sm">{readiness.items.map((i) => (
          <li key={i.key} className="flex items-center gap-2">{i.connected ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-muted-foreground" />}<span className={i.connected ? "" : "text-muted-foreground"}>{i.label}</span></li>
        ))}</ul>
        <p className="text-sm font-medium">{readiness.label}</p>
      </Section>

      <TerritoryDialog full open={editOpen} onOpenChange={setEditOpen} initial={t} busy={busy}
        onSubmit={async (values) => { const r = await call({ action: "update", territory_id: t.id, values }, "Território atualizado"); if (r.ok) setEditOpen(false); }} />
      {confirmDialog}
    </>
  );
};

export default TerritoryPage;
