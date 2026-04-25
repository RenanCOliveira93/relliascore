import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VideoBackground from "@/components/VideoBackground";
import { ArrowLeft, History, FileText, Sparkles, Swords } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Empresa {
  id: string;
  nome: string;
}
interface Analise {
  id: string;
  tipo: string;
  score: number | null;
  summary: string | null;
  origem: string;
  empresa_id: string | null;
  created_at: string;
}
interface AnaliseComp {
  id: string;
  score: number | null;
  summary: string | null;
  empresa_id: string | null;
  concorrente_id: string;
  created_at: string;
}

const Historico = () => {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [comp, setComp] = useState<AnaliseComp[]>([]);
  const [concorrentes, setConcorrentes] = useState<{ id: string; nome: string }[]>([]);
  const [tab, setTab] = useState<"todos" | "conteudo" | "marca" | "competitiva">("todos");
  const [empresaFilter, setEmpresaFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const [{ data: emp }, { data: an }, { data: co }, { data: con }] = await Promise.all([
      supabase.from("empresas").select("id, nome").eq("workspace_id", activeWorkspace.id),
      supabase.from("analises").select("*").eq("workspace_id", activeWorkspace.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("analises_competitivas").select("*").eq("workspace_id", activeWorkspace.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("concorrentes").select("id, nome").eq("workspace_id", activeWorkspace.id),
    ]);
    setEmpresas((emp ?? []) as Empresa[]);
    setAnalises((an ?? []) as Analise[]);
    setComp((co ?? []) as AnaliseComp[]);
    setConcorrentes((con ?? []) as { id: string; nome: string }[]);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const empresaName = (id: string | null) => empresas.find((e) => e.id === id)?.nome ?? "Sem empresa";
  const concorrenteName = (id: string) => concorrentes.find((c) => c.id === id)?.nome ?? "—";

  const filteredAnalises = useMemo(() => {
    return analises.filter((a) => {
      if (empresaFilter !== "all" && a.empresa_id !== empresaFilter) return false;
      if (tab === "conteudo") return a.tipo === "conteudo";
      if (tab === "marca") return a.tipo === "marca";
      if (tab === "competitiva") return false;
      return true;
    });
  }, [analises, empresaFilter, tab]);

  const filteredComp = useMemo(() => {
    if (tab === "conteudo" || tab === "marca") return [];
    return comp.filter((c) => empresaFilter === "all" || c.empresa_id === empresaFilter);
  }, [comp, empresaFilter, tab]);

  const scoreColor = (s: number | null) => {
    if (s === null) return "text-muted-foreground";
    if (s >= 80) return "text-emerald-400";
    if (s >= 60) return "text-amber-400";
    return "text-red-400";
  };

  const tipoIcon = (tipo: string) => {
    if (tipo === "marca") return <Sparkles className="h-4 w-4 text-primary" />;
    return <FileText className="h-4 w-4 text-primary" />;
  };

  return (
    <div className="min-h-screen relative">
      <VideoBackground />
      <div className="relative z-10">
        <header className="border-b border-border/50 backdrop-blur-md bg-background/30">
          <div className="container mx-auto px-4 py-6 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/home")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Histórico de Análises</h1>
              <p className="text-sm text-muted-foreground">
                Resultados das automações e análises manuais ({activeWorkspace?.name})
              </p>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-5xl space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList>
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
                <TabsTrigger value="marca">Marca</TabsTrigger>
                <TabsTrigger value="competitiva">Competitiva</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : filteredAnalises.length === 0 && filteredComp.length === 0 ? (
            <Card className="backdrop-blur-md bg-card/80 border-border/50">
              <CardContent className="py-12 text-center space-y-3">
                <History className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhuma análise encontrada com esses filtros.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {filteredAnalises.map((a) => (
                <Card key={a.id} className="backdrop-blur-md bg-card/80 border-border/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {tipoIcon(a.tipo)}
                        <div className="min-w-0">
                          <CardTitle className="text-base capitalize">{a.tipo} — {empresaName(a.empresa_id)}</CardTitle>
                          <CardDescription className="text-xs">
                            {new Date(a.created_at).toLocaleString("pt-BR")} · origem: {a.origem}
                          </CardDescription>
                        </div>
                      </div>
                      {a.score !== null && (
                        <div className={`text-2xl font-bold ${scoreColor(a.score)}`}>{a.score}</div>
                      )}
                    </div>
                  </CardHeader>
                  {a.summary && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3">{a.summary}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
              {filteredComp.map((c) => (
                <Card key={c.id} className="backdrop-blur-md bg-card/80 border-border/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Swords className="h-4 w-4 text-primary" />
                        <div className="min-w-0">
                          <CardTitle className="text-base">Competitiva — {concorrenteName(c.concorrente_id)}</CardTitle>
                          <CardDescription className="text-xs">
                            {new Date(c.created_at).toLocaleString("pt-BR")} · empresa: {empresaName(c.empresa_id)}
                          </CardDescription>
                        </div>
                      </div>
                      {c.score !== null && (
                        <div className={`text-2xl font-bold ${scoreColor(c.score)}`}>{c.score}</div>
                      )}
                    </div>
                  </CardHeader>
                  {c.summary && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3">{c.summary}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Historico;
