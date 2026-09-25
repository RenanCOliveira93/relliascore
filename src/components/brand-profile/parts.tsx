import { useState, type ReactNode } from "react";
import { Check, Eye, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pill } from "@/components/diagnosis/primitives";
import { cn } from "@/lib/utils";
import { confidenceLabel, knowledgeStatus, STATUS_LABELS, SOURCE_TYPE_LABELS, type RankedItem } from "@/lib/brand-profile";
import { ITEM_FIELDS, formValues, type FieldDef, type ItemTable } from "@/lib/brand-profile-fields";
import type { BrandKnowledgeStatus, BrandSource } from "@/types/brand-brain";

const STATUS_TONE: Record<BrandKnowledgeStatus, "positive" | "attention" | "neutral" | "problem"> = {
  user_edit: "positive", human_confirmed: "positive", declared: "neutral", observed: "neutral", inferred: "attention", rejected: "problem",
};
export const StatusPill = ({ status }: { status: BrandKnowledgeStatus }) => <Pill tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Pill>;

const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

export const ProvenanceButton = ({ item, observation }: { item: RankedItem & { observed_at?: string; source_url?: string | null; evidence?: string | null; reviewed_at?: string | null }; observation?: (RankedItem & { evidence?: string | null }) | null }) => {
  const sources: BrandSource[] = item.sources?.length ? item.sources : [{ source_type: item.source_type, source_url: item.source_url ?? null, evidence: item.evidence ?? null, confidence: item.confidence, explicit_or_inferred: item.explicit_or_inferred, observed_at: item.observed_at ?? "" }];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5 mr-1" />Ver origem</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs space-y-3" align="end">
        {item.origin === "user_edit" ? (
          <p>Informação definida por você{item.reviewed_at ? ` em ${fmt(item.reviewed_at)}` : ""}. Representa o que a empresa afirma sobre si.</p>
        ) : null}
        {item.origin === "extraction" && sources.map((s, i) => (
          <div key={i} className="space-y-1 border-b border-border/50 pb-2 last:border-0">
            <p className="font-medium">{SOURCE_TYPE_LABELS[s.source_type]}{s.source_url ? <> — <a className="underline break-all" href={s.source_url} target="_blank" rel="noreferrer">{s.source_url}</a></> : null}</p>
            {s.evidence ? <p className="text-muted-foreground">“{s.evidence}”</p> : <p className="text-muted-foreground">Sem trecho registrado.</p>}
            <p className="text-muted-foreground">Observado em {fmt(s.observed_at)} · {s.explicit_or_inferred === "explicit" ? "Explícito" : "Inferido"}</p>
            <p className="text-muted-foreground">Confiança da extração: {confidenceLabel(s.confidence)} ({Math.round(s.confidence * 100)}%)</p>
          </div>
        ))}
        {item.human_status === "confirmed" && <p className="text-success">Confirmado por você em {fmt(item.reviewed_at)}. Confirmação não é evidência externa.</p>}
        {item.human_status === "rejected" && <p className="text-destructive">Rejeitado por você em {fmt(item.reviewed_at)}.</p>}
        {observation && <p className="text-muted-foreground">Observação original preservada: “{(observation as unknown as { name?: string; statement?: string; title?: string }).name ?? (observation as unknown as { statement?: string }).statement ?? (observation as unknown as { title?: string }).title ?? "—"}”</p>}
      </PopoverContent>
    </Popover>
  );
};

export interface ItemActions {
  readOnly: boolean;
  onEdit?: () => void; onConfirm?: () => void; onReject?: () => void; onReset?: () => void; onDelete?: () => void;
}
export const ItemActionsBar = ({ item, a }: { item: RankedItem; a: ItemActions }) => {
  if (a.readOnly) return null;
  const extracted = item.origin === "extraction";
  return (
    <div className="flex flex-wrap gap-1">
      {a.onEdit && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={a.onEdit}><Pencil className="h-3.5 w-3.5 mr-1" />Corrigir</Button>}
      {extracted && item.human_status === "none" && a.onConfirm && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={a.onConfirm}><Check className="h-3.5 w-3.5 mr-1" />Confirmar</Button>}
      {extracted && item.human_status === "none" && a.onReject && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={a.onReject}><X className="h-3.5 w-3.5 mr-1" />Rejeitar</Button>}
      {extracted && item.human_status !== "none" && a.onReset && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={a.onReset}><RotateCcw className="h-3.5 w-3.5 mr-1" />Desfazer revisão</Button>}
      {!extracted && a.onDelete && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={a.onDelete}><Trash2 className="h-3.5 w-3.5 mr-1" />Remover</Button>}
    </div>
  );
};

export const KnowledgeCard = ({ item, title, subtitle, children, actions, observation }: { item: RankedItem; title: ReactNode; subtitle?: ReactNode; children?: ReactNode; actions: ItemActions; observation?: RankedItem | null }) => {
  const status = knowledgeStatus(item);
  return (
    <div data-testid="knowledge-card" className={cn("rounded-lg border border-border bg-background/40 p-4 space-y-2", status === "inferred" && "border-dashed", status === "rejected" && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-snug break-words">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <StatusPill status={status} />
      </div>
      {children && <div className="text-sm text-muted-foreground space-y-1">{children}</div>}
      <div className="flex flex-wrap items-center justify-between gap-1 pt-1">
        <ItemActionsBar item={item} a={actions} />
        <ProvenanceButton item={item} observation={observation} />
      </div>
    </div>
  );
};

export const Chips = ({ items }: { items: string[] }) =>
  items.length ? <div className="flex flex-wrap gap-1">{items.map((t) => <span key={t} className="rounded-md bg-muted/50 px-2 py-0.5 text-xs text-foreground/80">{t}</span>)}</div> : null;

export const AddButton = ({ onClick, label = "Adicionar" }: { onClick: () => void; label?: string }) => (
  <Button variant="outline" size="sm" onClick={onClick}><Plus className="h-4 w-4 mr-1" />{label}</Button>
);

export const EmptyLine = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;

// ---------- editor ----------
function ListInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => { const s = draft.trim(); if (s && !value.includes(s)) onChange([...value, s]); setDraft(""); };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-xs">
            {t}<button type="button" aria-label={`Remover ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Digite e pressione Enter" />
        <Button type="button" variant="outline" size="sm" onClick={add}>Incluir</Button>
      </div>
    </div>
  );
}

function ColorsInput({ value, onChange }: { value: { hex: string; name: string | null }[]; onChange: (v: { hex: string; name: string | null }[]) => void }) {
  const [hex, setHex] = useState("#");
  const valid = /^#[0-9a-f]{6}$/i.test(hex);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((c) => (
          <span key={c.hex} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
            <span className="h-4 w-4 rounded border border-border" style={{ backgroundColor: c.hex }} />{c.hex}
            <button type="button" aria-label={`Remover ${c.hex}`} onClick={() => onChange(value.filter((x) => x.hex !== c.hex))}><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={hex} onChange={(e) => setHex(e.target.value)} placeholder="#1A2B3C" className="w-32" />
        <Button type="button" variant="outline" size="sm" disabled={!valid} onClick={() => { onChange([...value.filter((c) => c.hex.toUpperCase() !== hex.toUpperCase()), { hex: hex.toUpperCase(), name: null }]); setHex("#"); }}>Incluir cor</Button>
      </div>
    </div>
  );
}

export function FieldControl({ def, value, onChange }: { def: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  if (def.kind === "textarea") return <Textarea rows={3} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  if (def.kind === "list") return <ListInput value={(value as string[]) ?? []} onChange={onChange} />;
  if (def.kind === "colors") return <ColorsInput value={(value as { hex: string; name: string | null }[]) ?? []} onChange={onChange} />;
  if (def.kind === "enum") return (
    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={String(value)} onChange={(e) => onChange(e.target.value)}>
      {def.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
  return <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
}

export function ItemEditor({ open, onOpenChange, table, item, title, onSave, note }: {
  open: boolean; onOpenChange: (o: boolean) => void; table: ItemTable; item?: Record<string, unknown>; title: string; note?: string;
  onSave: (values: Record<string, unknown>) => Promise<boolean>;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => formValues(table, item));
  const [saving, setSaving] = useState(false);
  const defs = ITEM_FIELDS[table];
  const missing = defs.some((d) => "required" in d && d.required && !String(values[d.key] ?? "").trim());
  const submit = async () => {
    setSaving(true);
    const clean = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, typeof v === "string" && !v.trim() ? null : v]));
    const ok = await onSave(clean);
    setSaving(false);
    if (ok) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {note && <DialogDescription>{note}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4">
          {defs.map((d) => (
            <div key={d.key} className="space-y-1.5">
              <label className="text-sm font-medium">{d.label}{"required" in d && d.required ? " *" : ""}</label>
              <FieldControl def={d} value={values[d.key]} onChange={(v) => setValues((p) => ({ ...p, [d.key]: v }))} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={missing || saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
