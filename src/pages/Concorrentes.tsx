import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import VideoBackground from "@/components/VideoBackground";
import { ArrowLeft, Plus, Pencil, Trash2, Swords, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Empresa {
  id: string;
  nome: string;
}
interface Concorrente {
  id: string;
  nome: string;
  url: string;
  search_query: string;
  empresa_id: string | null;
  created_at: string;
}

const empty = { nome: "", url: "", search_query: "", empresa_id: "" };

const Concorrentes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { toast } = useToast();

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [items, setItems] = useState<Concorrente[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Concorrente | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const [{ data: emp }, { data: con }] = await Promise.all([
      supabase.from("empresas").select("id, nome").eq("workspace_id", activeWorkspace.id).order("nome"),
      supabase.from("concorrentes").select("*").eq("workspace_id", activeWorkspace.id).order("created_at", { ascending: false }),
    ]);
    setEmpresas((emp ?? []) as Empresa[]);
    setItems((con ?? []) as Concorrente[]);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setDialogOpen(true);
  };

  const openEdit = (c: Concorrente) => {
    setEditing(c);
    setForm({
      nome: c.nome,
      url: c.url,
      search_query: c.search_query,
      empresa_id: c.empresa_id ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user || !activeWorkspace) return;
    if (!form.nome.trim() || !form.url.trim() || !form.search_query.trim() || !form.empresa_id) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha empresa, nome, URL e pesquisa.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      workspace_id: activeWorkspace.id,
      empresa_id: form.empresa_id,
      nome: form.nome.trim(),
      url: form.url.trim(),
      search_query: form.search_query.trim(),
    };
    const { error } = editing
      ? await supabase.from("concorrentes").update(payload).eq("id", editing.id)
      : await supabase.from("concorrentes").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Concorrente atualizado" : "Concorrente cadastrado" });
    setDialogOpen(false);
    fetchAll();
  };

  const remove = async () => {
    if (!deleteId) return;
    await supabase.from("concorrentes").delete().eq("id", deleteId);
    setDeleteId(null);
    toast({ title: "Concorrente removido" });
    fetchAll();
  };

  const empresaName = (id: string | null) => empresas.find((e) => e.id === id)?.nome ?? "—";

  return (
    <div className="min-h-screen relative">
      <VideoBackground />
      <div className="relative z-10">
        <header className="border-b border-border/50 backdrop-blur-md bg-background/30">
          <div className="container mx-auto px-4 py-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/home")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Concorrentes</h1>
                <p className="text-sm text-muted-foreground">
                  Análise competitiva semanal automatizada
                </p>
              </div>
            </div>
            <Button onClick={openNew} className="gap-2" disabled={empresas.length === 0}>
              <Plus className="h-4 w-4" />
              Novo Concorrente
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-5xl space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : empresas.length === 0 ? (
            <Card className="backdrop-blur-md bg-card/80 border-border/50">
              <CardContent className="py-12 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Cadastre uma empresa primeiro para depois adicionar concorrentes a ela.
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate("/empresas")}>
                  Ir para Empresas
                </Button>
              </CardContent>
            </Card>
          ) : items.length === 0 ? (
            <Card className="backdrop-blur-md bg-card/80 border-border/50">
              <CardContent className="py-12 text-center space-y-3">
                <Swords className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhum concorrente cadastrado ainda.</p>
                <Button onClick={openNew} variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar concorrente
                </Button>
              </CardContent>
            </Card>
          ) : (
            items.map((c) => (
              <Card key={c.id} className="backdrop-blur-md bg-card/80 border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Swords className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{c.nome}</CardTitle>
                        <CardDescription className="flex items-center gap-1 text-xs truncate">
                          <Globe className="h-3 w-3 shrink-0" />{c.url}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(c.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-muted-foreground">
                  <p><span className="font-medium text-foreground">Empresa:</span> {empresaName(c.empresa_id)}</p>
                  <p><span className="font-medium text-foreground">Pesquisa:</span> {c.search_query}</p>
                  <p className="text-[10px] text-muted-foreground/70 pt-1">
                    ID: <code className="text-foreground">{c.id}</code>
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </main>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Concorrente" : "Novo Concorrente"}</DialogTitle>
            <DialogDescription>
              Dados usados pelo workflow semanal de análise competitiva.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Empresa de referência *</Label>
              <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione uma empresa..." /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nome do concorrente *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>URL do concorrente *</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-1">
              <Label>Pesquisa de referência *</Label>
              <Input value={form.search_query} onChange={(e) => setForm({ ...form, search_query: e.target.value })} placeholder="Mesma pesquisa usada na empresa" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir concorrente?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Concorrentes;
