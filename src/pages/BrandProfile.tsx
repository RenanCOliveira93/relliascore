import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Brain, Check, History, Link2, Pencil, RefreshCw, RotateCcw, Scan, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import VideoBackground from "@/components/VideoBackground";
import { Pill, Section } from "@/components/diagnosis/primitives";
import { AddButton, Chips, EmptyLine, ItemEditor, KnowledgeCard, StatusPill, type ItemActions } from "@/components/brand-profile/parts";
import {
  activeItems, comparePositioning, completeness, evidenceForClaim, groupDifferentiators, groupEntities, preferredField,
  rejectedItems, sourceLine, supersededObservation, voicePreview, type RankedItem,
} from "@/lib/brand-profile";
import {
  AUDIENCE_TYPES, CLAIM_STATUS, CLAIM_TYPES, DIFF_CATEGORIES, EVIDENCE_TYPES, OFFERING_TYPES, RELATIONSHIP_LABELS, SUMMARY_FIELDS, type ItemTable,
} from "@/lib/brand-profile-fields";
import type {
  BrandBrainVersion, BrandFieldOverride, BrandProfileView, ClaimEvidenceRelationship, OverrideField,
  BrandOffering, BrandAudience, BrandProblem, BrandDifferentiator, BrandClaim, BrandEvidence, BrandEntity, BrandPositioning, BrandVoice, BrandVisualIdentity,
} from "@/types/brand-brain";

interface Empresa { id: string; nome: string; url: string; workspace_id: string; linkedin_url: string | null; instagram_url: string | null; descricao: string | null }
interface VersionRow { id: string; version: number; is_active: boolean; created_at: string; status: string }

const TABLES: ItemTable[] = ["brand_offerings", "brand_audiences", "brand_problems", "brand_differentiators", "brand_claims", "brand_evidence", "brand_entities", "brand_positioning", "brand_voice", "brand_visual_identity"];
const fmt = (d: string) => new Date(d).toLocaleDateString("pt-BR");
const hostOf = (u: string) => { try { return new URL(/^https?:\/\//.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, ""); } catch { return u; } };

async function loadView(brainId: string): Promise<BrandProfileView | null> {
  const { data: brain } = await supabase.from("brand_brains").select("*").eq("id", brainId).maybeSingle();
  if (!brain) return null;
  const [children, overrides, links] = await Promise.all([
    Promise.all(TABLES.map((t) => supabase.from(t).select("*").eq("brand_brain_id", brainId).order("created_at"))),
    supabase.from("brand_field_overrides").select("*").eq("brand_brain_id", brainId),
    supabase.from("brand_claim_evidence").select("*").eq("brand_brain_id", brainId),
  ]);
  const rows = (i: number) => (children[i].data ?? []) as unknown[];
  return {
    brain: brain as unknown as BrandBrainVersion, readOnly: !brain.is_active,
    overrides: (overrides.data ?? []) as unknown as BrandFieldOverride[], links: (links.data ?? []) as unknown as ClaimEvidenceRelationship[],
    offerings: rows(0) as BrandOffering[], audiences: rows(1) as BrandAudience[], problems: rows(2) as BrandProblem[],
    differentiators: rows(3) as BrandDifferentiator[], claims: rows(4) as BrandClaim[], evidence: rows(5) as BrandEvidence[],
    entities: rows(6) as BrandEntity[], positioning_items: rows(7) as BrandPositioning[], voice: rows(8) as BrandVoice[], visual_identity: rows(9) as BrandVisualIdentity[],
  };
}

type EditorState = { table: ItemTable; item?: Record<string, unknown> & { id: string }; title: string; note?: string } | null;

const BrandProfile = () => {
  const { id: empresaId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [view, setView] = useState<BrandProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editor, setEditor] = useState<EditorState>(null);
  const [fieldEdit, setFieldEdit] = useState<{ field: OverrideField; label: string; list?: boolean; value: string } | null>(null);
  const [linkFor, setLinkFor] = useState<BrandClaim | null>(null);
  const [showVersions, setShowVersions] = useState(false);

  const empresa = empresas.find((e) => e.id === empresaId) ?? null;
  const versionParam = params.get("version");

  const refresh = useCallback(async () => {
    if (!activeWorkspace || !empresaId) return;
    setLoading(true);
    const { data: emps } = await supabase.from("empresas").select("id,nome,url,workspace_id,linkedin_url,instagram_url,descricao").eq("workspace_id", activeWorkspace.id).order("nome");
    setEmpresas((emps ?? []) as Empresa[]);
    const { data: vs } = await supabase.from("brand_brains").select("id,version,is_active,created_at,status").eq("empresa_id", empresaId).order("version", { ascending: false });
    const list = (vs ?? []) as VersionRow[];
    setVersions(list);
    const target = list.find((v) => v.id === versionParam) ?? list.find((v) => v.is_active) ?? null;
    setView(target ? await loadView(target.id) : null);
    setLoading(false);
  }, [activeWorkspace, empresaId, versionParam]);

  useEffect(() => { refresh(); }, [refresh]);

  const mutate = async (body: Record<string, unknown>, success?: string): Promise<boolean> => {
    if (!view) return false;
    const { data, error } = await supabase.functions.invoke("brand-profile", { body: { brand_brain_id: view.brain.id, ...body } });
    const msg = (data as { error?: string } | null)?.error;
    if (error || msg) {
      let m = msg;
      if (!m && error && "context" in error) { try { m = (await (error as { context: Response }).context.json()).error; } catch { /* ignore */ } }
      toast({ title: "Não foi possível salvar", description: m ?? "Tente novamente.", variant: "destructive" });
      return false;
    }
    if (success) toast({ title: success });
    await refresh();
    return true;
  };

  const actionsFor = (table: ItemTable, item: RankedItem & Record<string, unknown>, label: string): ItemActions => ({
    readOnly: !!view?.readOnly,
    onEdit: () => setEditor({ table, item: item as Record<string, unknown> & { id: string }, title: `Corrigir ${label}`, note: item.origin === "extraction" ? "A observação original da RELLIA fica preservada; sua versão passa a ser a preferencial." : undefined }),
    onConfirm: () => mutate({ action: "item_confirm", table, id: item.id }, "Confirmado"),
    onReject: () => mutate({ action: "item_reject", table, id: item.id }, "Marcado como incorreto"),
    onReset: () => mutate({ action: "item_reset", table, id: item.id }),
    onDelete: () => mutate({ action: "item_delete", table, id: item.id }, "Removido"),
  });

  const runUpdate = async () => {
    if (!empresa || !activeWorkspace) return;
    const desc = (empresa.descricao ?? "").trim();
    if (desc.length < 10) { navigate(`/home?tab=brand&empresa=${empresa.id}`); return; }
    setUpdating(true);
    const body = { website: empresa.url, linkedin: empresa.linkedin_url ?? "", instagram: empresa.instagram_url ?? "", description: desc, mode: "business", workspaceId: activeWorkspace.id, empresaId: empresa.id };
    const { data, error } = await supabase.functions.invoke("analyze-brand", { body });
    setUpdating(false);
    const bb = (data as { brand_brain?: { persisted: boolean; version?: number; brand_brain_id?: string } } | null)?.brand_brain;
    if (error || !data || (data as { error?: string }).error) { toast({ title: "A análise não foi concluída", description: "A versão atual foi mantida.", variant: "destructive" }); return; }
    if (user) await supabase.from("brand_analyses").insert({ user_id: user.id, mode: "business", website: empresa.url, linkedin: empresa.linkedin_url, instagram: empresa.instagram_url, description: desc, result: data, workspace_id: activeWorkspace.id, brand_brain_id: bb?.persisted ? bb.brand_brain_id : null });
    toast(bb?.persisted ? { title: `Brand Brain v${bb.version} ativo`, description: "Suas edições, confirmações e rejeições foram mantidas." } : { title: "Análise concluída sem nova versão", description: "Não houve conhecimento estruturado suficiente; a versão atual foi mantida." });
    setParams({});
    refresh();
  };

  const derived = useMemo(() => {
    if (!view) return null;
    return {
      pos: comparePositioning(view.positioning_items),
      comp: completeness(view),
      diffs: groupDifferentiators(view.differentiators),
      entities: groupEntities(view.entities),
      voice: activeItems(view.voice)[0] ?? null,
      visual: activeItems(view.visual_identity)[0] ?? null,
      rejected: TABLES.reduce((n, _t, i) => n + rejectedItems([view.offerings, view.audiences, view.problems, view.differentiators, view.claims, view.evidence, view.entities, view.positioning_items, view.voice, view.visual_identity][i] as RankedItem[]).length, 0),
    };
  }, [view]);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" size="sm" onClick={() => navigate("/empresas")}><ArrowLeft className="h-4 w-4 mr-1" />Empresas</Button>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Empresa atual:</span>
        <select aria-label="Empresa atual" className="h-9 rounded-md border border-input bg-background px-2 text-sm max-w-[220px]" value={empresaId} onChange={(e) => navigate(`/empresas/${e.target.value}/brand`)}>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </label>
    </div>
  );

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen relative">
      <VideoBackground />
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:py-10 space-y-6">{header}{children}</main>
    </div>
  );

  if (loading && !view) return shell(<p className="text-muted-foreground">Carregando...</p>);
  if (!empresa) return shell(<Section title="Empresa não encontrada"><EmptyLine>Esta empresa não pertence ao espaço atual.</EmptyLine></Section>);
  if (!view || !derived) return shell(
    <section data-testid="brand-empty" className="rounded-xl border border-border bg-card/70 backdrop-blur-md p-8 text-center space-y-4">
      <Brain className="h-10 w-10 mx-auto text-muted-foreground" />
      <h1 className="text-xl font-semibold">{empresa.nome}</h1>
      <p className="text-muted-foreground">A RELLIA ainda não construiu o perfil desta marca.</p>
      <Button onClick={() => navigate(`/home?tab=brand&empresa=${empresa.id}`)}><Scan className="h-4 w-4 mr-2" />Analisar marca</Button>
    </section>
  );

  const { brain, readOnly } = view;
  const pf = (f: OverrideField) => preferredField(brain, view.overrides, f);
  const active = versions.find((v) => v.is_active);

  const summaryRow = (f: typeof SUMMARY_FIELDS[number]) => {
    const p = pf(f.field);
    const display = Array.isArray(p.value) ? p.value : p.value;
    return (
      <div key={f.field} className="space-y-1 py-3 border-b border-border/40 last:border-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</p>
          <div className="flex items-center gap-1">
            {p.status === "user_edit" && <StatusPill status="user_edit" />}
            {p.status === "human_confirmed" && <StatusPill status="human_confirmed" />}
            {p.status === "observed" && brain.field_provenance[f.field]?.explicit_or_inferred === "inferred" && <StatusPill status="inferred" />}
          </div>
        </div>
        {display === null ? <EmptyLine>Ainda não sabemos.</EmptyLine> : Array.isArray(display) ? <Chips items={display} /> : <p className="text-sm leading-relaxed">{display}</p>}
        {p.status === "user_edit" && p.observed && <p className="text-xs text-muted-foreground">Observado pela RELLIA: {Array.isArray(p.observed) ? p.observed.join(", ") : p.observed}</p>}
        {!readOnly && (
          <div className="flex flex-wrap gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setFieldEdit({ field: f.field, label: f.label, list: f.list, value: Array.isArray(display) ? display.join(", ") : display ?? "" })}><Pencil className="h-3.5 w-3.5 mr-1" />Corrigir</Button>
            {p.status === "observed" && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => mutate({ action: "field_confirm", field: f.field }, "Confirmado")}><Check className="h-3.5 w-3.5 mr-1" />Confirmar</Button>}
            {p.override && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => mutate({ action: "field_clear", field: f.field })}><RotateCcw className="h-3.5 w-3.5 mr-1" />Voltar ao observado</Button>}
          </div>
        )}
      </div>
    );
  };

  const offeringCards = activeItems(view.offerings).map((o) => (
    <KnowledgeCard key={o.id} item={o} title={o.name} subtitle={[OFFERING_TYPES[o.type], o.category].filter(Boolean).join(" · ")} actions={actionsFor("brand_offerings", o as never, "produto/serviço")} observation={supersededObservation(view.offerings, o)}>
      {o.description && <p>{o.description}</p>}
      {o.target_audience && <p><span className="text-foreground/80">Público:</span> {o.target_audience}</p>}
      {o.value_proposition && <p><span className="text-foreground/80">Proposta de valor:</span> {o.value_proposition}</p>}
      <Chips items={o.problems_solved} />
    </KnowledgeCard>
  ));

  const addBtn = (table: ItemTable, title: string) => !readOnly && <AddButton onClick={() => setEditor({ table, title })} />;

  return shell(
    <>
      {readOnly && (
        <div data-testid="readonly-banner" className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2">
          <span>Você está vendo a versão v{brain.version} (somente leitura).</span>
          <Button size="sm" variant="outline" onClick={() => setParams({})}>Voltar à versão ativa</Button>
        </div>
      )}

      {/* Header */}
      <section className="rounded-xl border border-border bg-card/70 backdrop-blur-md p-5 sm:p-6 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Brand Profile · o entendimento atual da RELLIA sobre a marca</p>
            <h1 className="text-2xl sm:text-3xl font-semibold break-words">{(pf("company_name").value as string) ?? empresa.nome}</h1>
            <p className="text-sm text-muted-foreground">{brain.primary_domain ?? hostOf(empresa.url)}{pf("primary_category").value ? ` · ${pf("primary_category").value}` : ""}</p>
            {pf("short_description").value && <p className="text-sm max-w-2xl">{pf("short_description").value as string}</p>}
          </div>
          {!readOnly && <Button onClick={runUpdate} disabled={updating}><RefreshCw className={`h-4 w-4 mr-2 ${updating ? "animate-spin" : ""}`} />{updating ? "Analisando..." : "Atualizar análise"}</Button>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Pill>Brand Brain v{brain.version}{brain.is_active ? " · ativa" : ""}</Pill>
          <Pill>{brain.status === "reviewed" ? "Revisado" : brain.status === "draft" ? "Rascunho" : "Extraído"}</Pill>
          <span>Última análise: {fmt(brain.last_analyzed_at)}</span>
          <button className="underline inline-flex items-center gap-1" onClick={() => setShowVersions(true)}><History className="h-3 w-3" />Ver versões anteriores</button>
        </div>
        <div data-testid="completeness" className="text-sm">
          <span className="font-medium">Completude do perfil:</span> {derived.comp.label}
          <div className="mt-2 flex flex-wrap gap-1">{derived.comp.areas.map((a) => <Pill key={a.key} tone={a.filled ? "positive" : "neutral"}>{a.label}</Pill>)}</div>
        </div>
      </section>

      <Section title="Visão geral da marca">
        <div>{SUMMARY_FIELDS.map(summaryRow)}</div>
      </Section>

      <Section title="Posicionamento" aside={addBtn("brand_positioning", "Definir como a marca se define")}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Como a marca se define</h3>
            {activeItems(view.positioning_items).filter((p) => p.kind === "declared").map((p) => (
              <KnowledgeCard key={p.id} item={p} title={p.statement ?? p.primary_category ?? "—"} subtitle={p.primary_category ?? undefined} actions={actionsFor("brand_positioning", p as never, "posicionamento")}>
                {p.value_proposition && <p>{p.value_proposition}</p>}
              </KnowledgeCard>
            ))}
            {!derived.pos.declared && <EmptyLine>Nenhum posicionamento declarado.</EmptyLine>}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Como a presença analisada comunica a marca</h3>
            {activeItems(view.positioning_items).filter((p) => p.kind === "observed").map((p) => (
              <KnowledgeCard key={p.id} item={p} title={p.statement ?? p.primary_category ?? "—"} subtitle={p.primary_category ?? undefined} actions={{ ...actionsFor("brand_positioning", p as never, "posicionamento"), onEdit: undefined }}>
                {p.value_proposition && <p>{p.value_proposition}</p>}
              </KnowledgeCard>
            ))}
            {!derived.pos.observed && <EmptyLine>Nenhum posicionamento observado nas fontes analisadas.</EmptyLine>}
          </div>
        </div>
        {derived.pos.message && <p data-testid="positioning-verdict" className={`text-sm ${derived.pos.verdict === "consistent" ? "text-success" : "text-warning"}`}>{derived.pos.message}</p>}
      </Section>

      <Section title="Produtos & Serviços" aside={addBtn("brand_offerings", "Adicionar produto/serviço")}>
        <div className="grid gap-3 md:grid-cols-2">{offeringCards}</div>
        {!offeringCards.length && <EmptyLine>Nenhum produto ou serviço identificado.</EmptyLine>}
      </Section>

      <Accordion type="multiple" className="space-y-3">
        <Block value="audiences" title="Públicos" count={activeItems(view.audiences).length} aside={addBtn("brand_audiences", "Adicionar público")}>
          <div className="grid gap-3 md:grid-cols-2">{activeItems(view.audiences).map((a) => (
            <KnowledgeCard key={a.id} item={a} title={a.name} subtitle={AUDIENCE_TYPES[a.audience_type]} actions={actionsFor("brand_audiences", a as never, "público")} observation={supersededObservation(view.audiences, a)}>
              {a.description && <p>{a.description}</p>}
              <Chips items={[...a.needs, ...a.problems]} /><Chips items={[...a.industries, ...a.roles]} />
            </KnowledgeCard>
          ))}</div>
        </Block>

        <Block value="problems" title="Problemas que a marca resolve" count={activeItems(view.problems).length} aside={addBtn("brand_problems", "Adicionar problema")}>
          <div className="grid gap-3 md:grid-cols-2">{activeItems(view.problems).map((p) => (
            <KnowledgeCard key={p.id} item={p} title={p.name} actions={actionsFor("brand_problems", p as never, "problema")} observation={supersededObservation(view.problems, p)}>
              {p.description && <p>{p.description}</p>}
              {p.related_offerings.length > 0 && <p className="text-xs">Relacionado a: {p.related_offerings.join(", ")}</p>}
            </KnowledgeCard>
          ))}</div>
        </Block>

        <Block value="differentiators" title="Diferenciais" count={activeItems(view.differentiators).length} aside={addBtn("brand_differentiators", "Adicionar diferencial")}>
          {(["declared", "observed", "inferred"] as const).map((g) => derived.diffs[g].length > 0 && (
            <div key={g} className="space-y-2">
              <h3 className="text-sm font-medium">{g === "declared" ? "Declarados" : g === "observed" ? "Observados" : "Inferidos (não comunicados explicitamente)"}</h3>
              <div className="grid gap-3 md:grid-cols-2">{derived.diffs[g].map((d) => (
                <KnowledgeCard key={d.id} item={d} title={d.statement} subtitle={DIFF_CATEGORIES[d.category]} actions={actionsFor("brand_differentiators", d as never, "diferencial")} />
              ))}</div>
            </div>
          ))}
        </Block>

        <Block value="claims" title="Claims & Evidências" count={activeItems(view.claims).length} aside={addBtn("brand_claims", "Adicionar afirmação")}>
          <div className="space-y-3">{activeItems(view.claims).map((c) => {
            const ev = evidenceForClaim(c.id, view.links, activeItems(view.evidence));
            return (
              <KnowledgeCard key={c.id} item={c} title={`“${c.statement}”`} subtitle={`${CLAIM_TYPES[c.claim_type]} · ${CLAIM_STATUS[c.verification_status]}`} actions={actionsFor("brand_claims", c as never, "afirmação")}>
                {ev.length ? (
                  <ul className="space-y-1">{ev.map(({ link, evidence }) => (
                    <li key={link.id} className="flex items-center justify-between gap-2 text-xs">
                      <span>{RELATIONSHIP_LABELS[link.relationship_type]}: <span className="text-foreground/90">{evidence.title}</span> ({EVIDENCE_TYPES[evidence.evidence_type]})</span>
                      {!readOnly && <button aria-label="Remover ligação" onClick={() => mutate({ action: "link_remove", id: link.id })}><X className="h-3 w-3" /></button>}
                    </li>
                  ))}</ul>
                ) : <p className="text-xs">Nenhuma evidência cadastrada para esta afirmação.</p>}
                {!readOnly && activeItems(view.evidence).length > 0 && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setLinkFor(c)}><Link2 className="h-3.5 w-3.5 mr-1" />Relacionar evidência</Button>}
              </KnowledgeCard>
            );
          })}</div>
        </Block>

        <Block value="evidence" title="Evidências" count={activeItems(view.evidence).length} aside={addBtn("brand_evidence", "Adicionar evidência")}>
          <div className="grid gap-3 md:grid-cols-2">{activeItems(view.evidence).map((e) => (
            <KnowledgeCard key={e.id} item={e} title={e.title} subtitle={EVIDENCE_TYPES[e.evidence_type]} actions={actionsFor("brand_evidence", e as never, "evidência")}>
              {e.description && <p>{e.description}</p>}
              {e.value && <p><span className="text-foreground/80">Resultado:</span> {e.value}</p>}
              {e.origin === "user_edit" && e.source_url && <a className="text-xs underline break-all" href={e.source_url} target="_blank" rel="noreferrer">{e.source_url}</a>}
            </KnowledgeCard>
          ))}</div>
        </Block>

        <Block value="entities" title="Entidades associadas" count={activeItems(view.entities).length} aside={addBtn("brand_entities", "Adicionar entidade")}>
          {derived.entities.map((g) => (
            <div key={g.type} className="space-y-2">
              <h3 className="text-sm font-medium">{g.label}</h3>
              <div className="grid gap-3 md:grid-cols-2">{g.items.map((e) => (
                <KnowledgeCard key={e.id} item={e} title={e.name} subtitle={e.relationship ?? undefined} actions={actionsFor("brand_entities", e as never, "entidade")}>{e.description && <p>{e.description}</p>}</KnowledgeCard>
              ))}</div>
            </div>
          ))}
        </Block>

        <Block value="voice" title="Voz da marca" count={derived.voice ? 1 : 0} aside={!derived.voice ? addBtn("brand_voice", "Definir voz da marca") : undefined}>
          {derived.voice && (
            <KnowledgeCard item={derived.voice} title={derived.voice.tone_traits.join(", ") || "Voz da marca"} subtitle={derived.voice.communication_style ?? undefined} actions={{ ...actionsFor("brand_voice", derived.voice as never, "voz"), onReject: undefined }}>
              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                <p>Complexidade: {derived.voice.complexity_level ?? "—"}</p><p>Formalidade: {derived.voice.formality ?? "—"}</p>
                <p className="sm:col-span-2">Estilo emocional: {derived.voice.emotional_style ?? "—"}</p>
              </div>
              {derived.voice.vocabulary_preferred.length > 0 && <><p className="text-xs">Prefere:</p><Chips items={derived.voice.vocabulary_preferred} /></>}
              {derived.voice.vocabulary_avoided.length > 0 && <><p className="text-xs">Evita:</p><Chips items={derived.voice.vocabulary_avoided} /></>}
              {derived.voice.recurring_phrases.length > 0 && <ul className="text-xs list-disc pl-4">{derived.voice.recurring_phrases.map((p) => <li key={p}>“{p}”</li>)}</ul>}
              {voicePreview(derived.voice) && <p className="text-xs italic">{voicePreview(derived.voice)}</p>}
            </KnowledgeCard>
          )}
        </Block>

        <Block value="visual" title="Identidade visual" count={derived.visual ? 1 : 0} aside={!derived.visual ? addBtn("brand_visual_identity", "Definir identidade visual") : undefined}>
          {derived.visual && (
            <KnowledgeCard item={derived.visual} title={derived.visual.visual_style ?? "Identidade visual"} actions={{ ...actionsFor("brand_visual_identity", derived.visual as never, "identidade visual"), onReject: undefined }}>
              {(["primary_colors", "secondary_colors", "accent_colors"] as const).map((k) => derived.visual![k].length > 0 && (
                <div key={k} className="flex flex-wrap gap-2">{derived.visual![k].map((c) => (
                  <span key={c.hex} className="inline-flex items-center gap-1.5 text-xs"><span className="h-6 w-6 rounded border border-border" style={{ backgroundColor: c.hex }} />{c.hex}{c.name ? ` · ${c.name}` : ""}</span>
                ))}</div>
              ))}
              {derived.visual.detected_fonts.length > 0 && <p className="text-xs">Fontes: {derived.visual.detected_fonts.join(", ")}</p>}
              {derived.visual.logo_url && <img src={derived.visual.logo_url} alt="Logo" className="h-10 object-contain" />}
              {derived.visual.imagery_style && <p className="text-xs">Imagens: {derived.visual.imagery_style}</p>}
              {derived.visual.consistency_notes && <p className="text-xs">{derived.visual.consistency_notes}</p>}
            </KnowledgeCard>
          )}
        </Block>

        <Block value="sources" title="Fontes analisadas">
          <ul data-testid="sources" className="text-sm space-y-1">{brain.sources_status.map((s) => (
            <li key={s.source} className={s.status === "fetched" ? "" : "text-muted-foreground"}>{sourceLine(s)}{s.reason ? <span className="text-xs"> · {s.reason}</span> : null}</li>
          ))}</ul>
          <p className="text-xs text-muted-foreground">Uma fonte inacessível (por exemplo, LinkedIn pedindo login) não é um problema da marca; apenas não foi usada.</p>
        </Block>

        {derived.rejected > 0 && (
          <Block value="rejected" title="Itens rejeitados" count={derived.rejected}>
            <p className="text-xs text-muted-foreground">Continuam guardados para histórico e não são usados como conhecimento. Se reaparecerem numa nova análise, continuam rejeitados.</p>
            <div className="grid gap-3 md:grid-cols-2">{TABLES.flatMap((t, i) => rejectedItems([view.offerings, view.audiences, view.problems, view.differentiators, view.claims, view.evidence, view.entities, view.positioning_items, view.voice, view.visual_identity][i] as unknown as (RankedItem & Record<string, unknown>)[]).map((r) => (
              <KnowledgeCard key={r.id} item={r} title={String(r.name ?? r.statement ?? r.title ?? "Item")} actions={actionsFor(t, r, "item")} />
            )))}</div>
          </Block>
        )}
      </Accordion>

      {editor && (
        <ItemEditor key={editor.item?.id ?? editor.table} open onOpenChange={(o) => !o && setEditor(null)} table={editor.table} item={editor.item} title={editor.title} note={editor.note}
          onSave={(values) => editor.item ? mutate({ action: "item_update", table: editor.table, id: editor.item.id, data: values }, "Salvo") : mutate({ action: "item_create", table: editor.table, data: values }, "Adicionado")} />
      )}

      <Dialog open={!!fieldEdit} onOpenChange={(o) => !o && setFieldEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Corrigir: {fieldEdit?.label}</DialogTitle><DialogDescription>O valor observado pela RELLIA fica preservado; o seu passa a ser o preferencial.</DialogDescription></DialogHeader>
          {fieldEdit?.list
            ? <Input value={fieldEdit.value} onChange={(e) => setFieldEdit({ ...fieldEdit, value: e.target.value })} placeholder="Separe por vírgulas" />
            : <Textarea rows={4} value={fieldEdit?.value ?? ""} onChange={(e) => fieldEdit && setFieldEdit({ ...fieldEdit, value: e.target.value })} />}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFieldEdit(null)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!fieldEdit) return;
              const value = fieldEdit.list ? fieldEdit.value.split(",").map((s) => s.trim()).filter(Boolean) : fieldEdit.value;
              if (await mutate({ action: "field_set", field: fieldEdit.field, value }, "Salvo")) setFieldEdit(null);
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LinkDialog claim={linkFor} evidence={activeItems(view.evidence)} onClose={() => setLinkFor(null)} onLink={(evidence_id, relationship_type) => mutate({ action: "link_add", claim_id: linkFor!.id, evidence_id, relationship_type }, "Evidência relacionada")} />

      <Dialog open={showVersions} onOpenChange={setShowVersions}>
        <DialogContent>
          <DialogHeader><DialogTitle>Versões do Brand Brain</DialogTitle><DialogDescription>Versões anteriores abrem somente para leitura.</DialogDescription></DialogHeader>
          <ul className="space-y-2">{versions.map((v) => (
            <li key={v.id}>
              <button className="w-full text-left rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40" onClick={() => { setShowVersions(false); setParams(v.is_active ? {} : { version: v.id }); }}>
                v{v.version}{v.is_active ? " — ativa" : ""} — {fmt(v.created_at)}{v.id === brain.id ? " (aberta)" : ""}
              </button>
            </li>
          ))}</ul>
          {active && <p className="text-xs text-muted-foreground">Versão ativa: v{active.version}</p>}
        </DialogContent>
      </Dialog>

      <p className="text-center text-xs text-muted-foreground"><Link to="/empresas" className="underline">Voltar para Empresas</Link></p>
    </>
  );
};

function Block({ value, title, count, aside, children }: { value: string; title: string; count?: number; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <AccordionItem value={value} className="rounded-xl border border-border bg-card/70 backdrop-blur-md px-5 sm:px-6">
      <AccordionTrigger className="hover:no-underline">
        <span className="flex items-center gap-2 text-base font-semibold">{title}{count !== undefined && <Pill>{count}</Pill>}</span>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 pb-5">
        {aside && <div className="flex justify-end">{aside}</div>}
        {children}
        {count === 0 && <EmptyLine>Ainda não sabemos. Você pode adicionar manualmente.</EmptyLine>}
      </AccordionContent>
    </AccordionItem>
  );
}

function LinkDialog({ claim, evidence, onClose, onLink }: { claim: BrandClaim | null; evidence: BrandEvidence[]; onClose: () => void; onLink: (id: string, rel: string) => Promise<boolean> }) {
  const [ev, setEv] = useState("");
  const [rel, setRel] = useState("supports");
  useEffect(() => { setEv(evidence[0]?.id ?? ""); setRel("supports"); }, [claim, evidence]);
  return (
    <Dialog open={!!claim} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Relacionar evidência</DialogTitle><DialogDescription>“{claim?.statement}”</DialogDescription></DialogHeader>
        <select aria-label="Evidência" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={ev} onChange={(e) => setEv(e.target.value)}>
          {evidence.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <select aria-label="Relação" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={rel} onChange={(e) => setRel(e.target.value)}>
          {Object.entries(RELATIONSHIP_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!ev} onClick={async () => { if (await onLink(ev, rel)) onClose(); }}>Relacionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BrandProfile;
