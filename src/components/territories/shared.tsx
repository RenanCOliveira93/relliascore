import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pill } from "@/components/diagnosis/primitives";
import { PRIORITY_LABEL, TYPE_LABEL, TERRITORY_PRIORITIES, TERRITORY_TYPES, splitList, type StrategicTerritory, type TerritoryPriority } from "@/lib/territories";

type Body = Record<string, unknown>;
export interface MutateResult { ok: boolean; data?: Body }

/** Calls the territories function; on primary conflict asks for confirmation and retries with replace_primary. */
export function useTerritoryMutate(onDone: () => void) {
  const { toast } = useToast();
  const [pending, setPending] = useState<{ body: Body; current: string; next: string; success?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (body: Body, success?: string): Promise<MutateResult> => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("territories", { body });
    setBusy(false);
    let payload = data as Body | null;
    if (error) {
      const ctx = (error as { context?: Response }).context;
      try { payload = ctx ? await ctx.clone().json() : null; } catch { payload = null; }
      if (payload?.error === "primary_conflict") {
        const c = payload.conflict as { name: string };
        const values = body.values as Body | undefined;
        const s = body.suggestion as Body | undefined;
        setPending({ body, current: c.name, next: String(values?.name ?? s?.name ?? "este território"), success });
        return { ok: false };
      }
      toast({ title: "Não foi possível concluir", description: String(payload?.error ?? "Tente novamente."), variant: "destructive" });
      return { ok: false };
    }
    if (success) toast({ title: success });
    onDone();
    return { ok: true, data: payload ?? undefined };
  };

  const confirmDialog = (
    <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Substituir território principal?</AlertDialogTitle>
          <AlertDialogDescription data-testid="primary-confirm">
            {pending?.current} é atualmente o território principal. Deseja substituir por {pending?.next}?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => { const p = pending; setPending(null); if (p) void call({ ...p.body, replace_primary: true }, p.success); }}>Substituir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { call, busy, confirmDialog };
}

export const PriorityPill = ({ p }: { p: TerritoryPriority }) => (
  <Pill tone={p === "primary" ? "positive" : "neutral"} className="uppercase tracking-wide">{PRIORITY_LABEL[p]}</Pill>
);

const Select = ({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: [string, string][]; label: string }) => (
  <label className="space-y-1 block">
    <span className="text-sm font-medium">{label}</span>
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  </label>
);

export interface TerritoryFormValues {
  name: string; territory_type: string; priority: string; strategic_intent: string; desired_association: string;
  description: string; core_concept: string; target_audience_summary: string; included_topics: string; excluded_topics: string; related_concepts: string;
}
export const formFrom = (t?: StrategicTerritory): TerritoryFormValues => ({
  name: t?.name ?? "", territory_type: t?.territory_type ?? "category", priority: t?.priority ?? "secondary",
  strategic_intent: t?.strategic_intent ?? "", desired_association: t?.desired_association ?? "", description: t?.description ?? "",
  core_concept: t?.core_concept ?? "", target_audience_summary: t?.target_audience_summary ?? "",
  included_topics: (t?.included_topics ?? []).join("\n"), excluded_topics: (t?.excluded_topics ?? []).join("\n"), related_concepts: (t?.related_concepts ?? []).join("\n"),
});

/** Manual creation (short form) and full edit (definition fields). */
export function TerritoryDialog({ open, onOpenChange, initial, full, onSubmit, busy }: {
  open: boolean; onOpenChange: (o: boolean) => void; initial?: StrategicTerritory; full?: boolean; busy: boolean;
  onSubmit: (values: Body) => void;
}) {
  const [f, setF] = useState<TerritoryFormValues>(formFrom(initial));
  const [key, setKey] = useState(initial?.id ?? "new");
  if ((initial?.id ?? "new") !== key) { setKey(initial?.id ?? "new"); setF(formFrom(initial)); }
  const set = (k: keyof TerritoryFormValues) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = () => {
    const v: Body = { name: f.name, territory_type: f.territory_type, priority: f.priority, strategic_intent: f.strategic_intent, desired_association: f.desired_association };
    if (full) Object.assign(v, { description: f.description, core_concept: f.core_concept, target_audience_summary: f.target_audience_summary,
      included_topics: splitList(f.included_topics), excluded_topics: splitList(f.excluded_topics), related_concepts: splitList(f.related_concepts) });
    onSubmit(v);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setF(formFrom(initial)); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar território" : "Adicionar território"}</DialogTitle>
          <DialogDescription>Um território é um tema ou problema pelo qual a marca quer ser reconhecida — não uma palavra-chave.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="t-name">Nome</Label><Input id="t-name" value={f.name} onChange={set("name")} placeholder="Ex: Inteligência de varejo" /></div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo" value={f.territory_type} onChange={(v) => setF({ ...f, territory_type: v })} options={TERRITORY_TYPES.map((t) => [t, TYPE_LABEL[t]])} />
            <Select label="Prioridade" value={f.priority} onChange={(v) => setF({ ...f, priority: v })} options={TERRITORY_PRIORITIES.map((p) => [p, PRIORITY_LABEL[p]])} />
          </div>
          <div className="space-y-1"><Label htmlFor="t-intent">O que queremos que a marca represente neste território?</Label><Textarea id="t-intent" rows={3} value={f.strategic_intent} onChange={set("strategic_intent")} /></div>
          <div className="space-y-1"><Label htmlFor="t-assoc">Associação desejada</Label><Textarea id="t-assoc" rows={2} value={f.desired_association} onChange={set("desired_association")} placeholder="Ex: Nexus Sight é uma solução de inteligência de varejo baseada em visão computacional." /></div>
          {full && (
            <>
              <div className="space-y-1"><Label htmlFor="t-core">Conceito central</Label><Input id="t-core" value={f.core_concept} onChange={set("core_concept")} /></div>
              <div className="space-y-1"><Label htmlFor="t-desc">Descrição</Label><Textarea id="t-desc" rows={2} value={f.description} onChange={set("description")} /></div>
              <div className="space-y-1"><Label htmlFor="t-aud">Público do território</Label><Input id="t-aud" value={f.target_audience_summary} onChange={set("target_audience_summary")} /></div>
              <div className="space-y-1"><Label htmlFor="t-inc">Tópicos incluídos (um por linha)</Label><Textarea id="t-inc" rows={3} value={f.included_topics} onChange={set("included_topics")} /></div>
              <div className="space-y-1"><Label htmlFor="t-exc">Tópicos excluídos (um por linha)</Label><Textarea id="t-exc" rows={2} value={f.excluded_topics} onChange={set("excluded_topics")} /></div>
              <div className="space-y-1"><Label htmlFor="t-rel">Conceitos relacionados (um por linha)</Label><Textarea id="t-rel" rows={2} value={f.related_concepts} onChange={set("related_concepts")} /></div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !f.name.trim()}>{initial ? "Salvar" : "Criar território"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
