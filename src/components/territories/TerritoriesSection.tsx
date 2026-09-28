import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ArchiveRestore, ExternalLink, Pencil, Plus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pill, Section } from "@/components/diagnosis/primitives";
import { EmptyLine } from "@/components/brand-profile/parts";
import { BREADTH_LABEL, KIND_LABEL, TYPE_LABEL, sortTerritories, territoryReadiness, type StrategicTerritory, type TerritoryRelation, type TerritorySuggestion } from "@/lib/territories";
import { PriorityPill, TerritoryDialog, useTerritoryMutate } from "./shared";

export function TerritoriesSection({ empresaId, hasBrain }: { empresaId: string; hasBrain: boolean }) {
  const navigate = useNavigate();
  const [list, setList] = useState<StrategicTerritory[]>([]);
  const [rels, setRels] = useState<Pick<TerritoryRelation, "territory_id" | "relation_kind">[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<StrategicTerritory | "new" | null>(null);
  const [sugOpen, setSugOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<TerritorySuggestion[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from("brand_territories").select("*").eq("empresa_id", empresaId),
      supabase.from("brand_territory_relations").select("territory_id, relation_kind").eq("empresa_id", empresaId),
    ]);
    setList(sortTerritories((t ?? []) as unknown as StrategicTerritory[]));
    setRels((r ?? []) as unknown as Pick<TerritoryRelation, "territory_id" | "relation_kind">[]);
  }, [empresaId]);
  useEffect(() => { void load(); }, [load]);
  const { call, busy, confirmDialog } = useTerritoryMutate(load);

  const suggest = async () => {
    setSugOpen(true); setSuggestions(null); setAdded(new Set());
    const r = await call({ action: "suggest", empresa_id: empresaId });
    setSuggestions(r.ok ? ((r.data?.suggestions ?? []) as TerritorySuggestion[]) : []);
  };

  const visible = list.filter((t) => showArchived || t.status !== "archived");
  const archivedCount = list.filter((t) => t.status === "archived").length;

  return (
    <Section id="territories" title="Territórios estratégicos" lead="Defina os temas e problemas pelos quais esta marca quer ser reconhecida."
      aside={<div className="flex flex-wrap gap-2 justify-end">
        {hasBrain && <Button size="sm" variant="outline" onClick={suggest} disabled={busy}><Sparkles className="h-4 w-4 mr-1" />Sugerir com Brand Brain</Button>}
        <Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4 mr-1" />Adicionar território</Button>
      </div>}>
      <p className="text-xs text-muted-foreground">O Brand Profile mostra quem a marca é. Os territórios mostram pelo que ela quer ser reconhecida.</p>
      {visible.length === 0 ? <EmptyLine>Nenhum território definido ainda.</EmptyLine> : (
        <div data-testid="territory-list" className="grid gap-3 sm:grid-cols-2">
          {visible.map((t) => {
            const rd = territoryReadiness(rels.filter((r) => r.territory_id === t.id));
            return (
              <article key={t.id} data-testid="territory-card" className={`rounded-lg border border-border bg-background/40 p-4 space-y-2 ${t.status === "archived" ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <PriorityPill p={t.priority} />
                  <Pill>{TYPE_LABEL[t.territory_type]}</Pill>
                  {t.status === "archived" && <Pill tone="attention">Arquivado</Pill>}
                  {t.status === "draft" && <Pill>Rascunho</Pill>}
                  {t.origin === "brand_brain_suggestion" && <Pill>Sugerido pela RELLIA</Pill>}
                </div>
                <h4 className="font-semibold break-words">{t.name}</h4>
                {t.strategic_intent && <p className="text-sm text-muted-foreground line-clamp-2">{t.strategic_intent}</p>}
                <p className="text-xs text-muted-foreground">{rd.label}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => navigate(`/empresas/${empresaId}/territorios/${t.id}`)}><ExternalLink className="h-3.5 w-3.5 mr-1" />Abrir</Button>
                  {t.status !== "archived" ? (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(t)}><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => call({ action: "archive", territory_id: t.id }, "Território arquivado")}><Archive className="h-3.5 w-3.5 mr-1" />Arquivar</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => call({ action: "restore", territory_id: t.id }, "Território restaurado")}><ArchiveRestore className="h-3.5 w-3.5 mr-1" />Restaurar</Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {archivedCount > 0 && <button className="text-xs underline text-muted-foreground" onClick={() => setShowArchived(!showArchived)}>{showArchived ? "Ocultar arquivados" : `Mostrar arquivados (${archivedCount})`}</button>}

      <TerritoryDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} initial={editing && editing !== "new" ? editing : undefined} busy={busy}
        onSubmit={async (values) => {
          const r = editing === "new" || editing === null
            ? await call({ action: "create", empresa_id: empresaId, values }, "Território criado")
            : await call({ action: "update", territory_id: editing.id, values }, "Território atualizado");
          if (r.ok) setEditing(null);
        }} />

      <Dialog open={sugOpen} onOpenChange={setSugOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sugestões com base no Brand Brain</DialogTitle>
            <DialogDescription>Sugestões não são territórios. Adicione apenas os que representam a estratégia da marca.</DialogDescription>
          </DialogHeader>
          {suggestions === null ? <p className="text-sm text-muted-foreground">Analisando o Brand Brain...</p>
            : suggestions.length === 0 ? <EmptyLine>Nenhuma sugestão com base suficiente no Brand Brain.</EmptyLine>
            : <div data-testid="suggestions" className="space-y-3">{suggestions.map((s) => (
              <article key={s.name} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold">{s.name}</h4>
                  <Button size="sm" disabled={added.has(s.name) || busy} onClick={async () => {
                    const r = await call({ action: "accept_suggestion", empresa_id: empresaId, suggestion: s, priority: "secondary" }, "Território adicionado");
                    if (r.ok) setAdded(new Set([...added, s.name]));
                  }}>{added.has(s.name) ? "Adicionado" : "Adicionar"}</Button>
                </div>
                <div className="flex flex-wrap gap-1.5"><Pill>{TYPE_LABEL[s.type]}</Pill><Pill>Amplitude: {BREADTH_LABEL[s.breadth]}</Pill><Pill>confiança {Math.round(s.confidence * 100)}%</Pill></div>
                {s.rationale && <p className="text-sm"><span className="text-muted-foreground">Por que a RELLIA sugeriu:</span> {s.rationale}</p>}
                <div className="text-xs text-muted-foreground">Baseado em: {s.supporting_brand_items.map((i) => `${KIND_LABEL[i.kind]} “${i.label}”`).join(" · ")}</div>
              </article>
            ))}</div>}
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </Section>
  );
}
