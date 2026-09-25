import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/diagnosis";

export const TONE_TEXT: Record<Tone, string> = {
  positive: "text-success",
  attention: "text-warning",
  problem: "text-destructive",
  neutral: "text-muted-foreground",
};
const TONE_PILL: Record<Tone, string> = {
  positive: "bg-success/10 text-success border-success/30",
  attention: "bg-warning/10 text-warning border-warning/30",
  problem: "bg-destructive/10 text-destructive border-destructive/30",
  neutral: "bg-muted/40 text-muted-foreground border-border",
};

export const Pill = ({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) => (
  <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", TONE_PILL[tone], className)}>{children}</span>
);

export const Help = ({ text }: { text: string }) => (
  <TooltipProvider delayDuration={150}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="Ajuda" className="text-muted-foreground hover:text-foreground">
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const Section = ({ id, title, lead, children, aside }: { id?: string; title?: string; lead?: string; children: ReactNode; aside?: ReactNode }) => (
  <section id={id} className="rounded-xl border border-border bg-card/70 backdrop-blur-md p-5 sm:p-6 space-y-4">
    <header className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        {title && <h3 className="text-base sm:text-lg font-semibold text-foreground">{title}</h3>}
        {lead && <p className="text-sm text-muted-foreground leading-relaxed">{lead}</p>}
      </div>
      {aside}
    </header>
    {children}
  </section>
);

export const Confidence = ({ value }: { value?: number }) =>
  typeof value === "number" ? <span className="text-[11px] text-muted-foreground">confiança {Math.round(value * 100)}%</span> : null;

export const Bar = ({ value, tone }: { value: number | null; tone: Tone }) => (
  <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
    {value !== null && <div className={cn("h-full rounded-full", tone === "positive" ? "bg-success" : tone === "attention" ? "bg-warning" : tone === "problem" ? "bg-destructive" : "bg-muted")} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />}
  </div>
);
