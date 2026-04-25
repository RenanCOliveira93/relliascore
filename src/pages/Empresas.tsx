import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  ArrowLeft,
  Building2,
  Plus,
  Pencil,
  Trash2,
  Globe,
  Linkedin,
  Instagram,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Empresa {
  id: string;
  nome: string;
  url: string;
  search_query: string;
  monitoramento_ativo: boolean;
  analise_marca_ativa: boolean;
  linkedin_url: string | null;
  instagram_url: string | null;
  descricao: string | null;
  created_at: string;
}

const empty = {
  nome: "",
  url: "",
  search_query: "",
  linkedin_url: "",
  instagram_url: "",
  descricao: "",
  monitoramento_ativo: true,
  analise_marca_ativa: false,
};

const Empresas = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchEmpresas = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const { data } = await supabase
      .from("empresas")
      .select("*")
      .eq("workspace_id", activeWorkspace.id)
      .order("created_at", { ascending: false });
    setEmpresas((data ?? []) as Empresa[]);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setDialogOpen(true);
  };

  const openEdit = (e: Empresa) => {
    setEditing(e);
    setForm({
      nome: e.nome,
      url: e.url,
      search_query: e.search_query,
      linkedin_url: e.linkedin_url ?? "",
      instagram_url: e.instagram_url ?? "",
      descricao: e.descricao ?? "",
      monitoramento_ativo: e.monitoramento_ativo,
      analise_marca_ativa: e.analise_marca_ativa,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user || !activeWorkspace) return;
    if (!form.nome.trim() || !form.url.trim() || !form.search_query.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, URL e a pesquisa de referência.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      workspace_id: activeWorkspace.id,
      nome: form.nome.trim(),
      url: form.url.trim(),
      search_query: form.search_query.trim(),
      linkedin_url: form.linkedin_url.trim() || null,
      instagram_url: form.instagram_url.trim() || null,
      descricao: form.descricao.trim() || null,
      monitoramento_ativo: form.monitoramento_ativo,
      analise_marca_ativa: form.analise_marca_ativa,
    };
    const { error } = editing
      ? await supabase.from("empresas").update(payload).eq("id", editing.id)
      : await supabase.from("empresas").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Empresa atualizada" : "Empresa criada" });
    setDialogOpen(false);
    fetchEmpresas();
  };

  const remove = async () => {
    if (!deleteId) return;
    await supabase.from("empresas").delete().eq("id", deleteId);
    setDeleteId(null);
    toast({ title: "Empresa removida" });
    fetchEmpresas();
  };

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
                <h1 className="text-xl font-semibold">Empresas Monitoradas</h1>
                <p className="text-sm text-muted-foreground">
                  Cadastro usado pelas automações da RELLIA ({activeWorkspace?.name})
                </p>
              </div>
            </div>
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Empresa
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-5xl space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : empresas.length === 0 ? (
            <Card className="backdrop-blur-md bg-card/80 border-border/50">
              <CardContent className="py-12 text-center space-y-3">
                <Building2 className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma empresa cadastrada neste espaço.
                </p>
                <Button onClick={openNew} variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Cadastrar primeira empresa
                </Button>
              </CardContent>
            </Card>
          ) : (
            empresas.map((e) => (
              <Card key={e.id} className="backdrop-blur-md bg-card/80 border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Building2 className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{e.nome}</CardTitle>
                        <CardDescription className="flex items-center gap-1 text-xs truncate">
                          <Globe className="h-3 w-3 shrink-0" />
                          {e.url}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(e.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-2 py-0.5 rounded-full ${e.monitoramento_ativo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      Monitoramento {e.monitoramento_ativo ? "ON" : "OFF"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full ${e.analise_marca_ativa ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      Análise de marca {e.analise_marca_ativa ? "ON" : "OFF"}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Pesquisa de referência:</span> {e.search_query}
                  </p>
                  {(e.linkedin_url || e.instagram_url) && (
                    <div className="flex gap-3 text-muted-foreground pt-1">
                      {e.linkedin_url && (
                        <span className="inline-flex items-center gap-1"><Linkedin className="h-3 w-3" />{e.linkedin_url}</span>
                      )}
                      {e.instagram_url && (
                        <span className="inline-flex items-center gap-1"><Instagram className="h-3 w-3" />{e.instagram_url}</span>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 pt-1">
                    ID: <code className="text-foreground">{e.id}</code>
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </main>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
            <DialogDescription>
              Estes dados são usados pelas automações n8n da RELLIA para monitorar essa empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Acme Ltda" />
            </div>
            <div className="space-y-1">
              <Label>URL do site *</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-1">
              <Label>Pesquisa de referência *</Label>
              <Input value={form.search_query} onChange={(e) => setForm({ ...form, search_query: e.target.value })} placeholder="O que um cliente perguntaria a uma IA para encontrar você?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="flex items-center gap-1"><Linkedin className="h-3 w-3" />LinkedIn</Label>
                <Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/..." />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1"><Instagram className="h-3 w-3" />Instagram</Label>
                <Input value={form.instagram_url} onChange={(e) => setForm({ ...form, instagram_url: e.target.value })} placeholder="https://instagram.com/..." />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Descrição (usada na análise de marca)</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Quem é a empresa, o que faz, posicionamento..." rows={3} />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div>
                <p className="text-sm font-medium">Monitoramento semanal</p>
                <p className="text-xs text-muted-foreground">Análise de relevância automática toda segunda às 8h</p>
              </div>
              <Switch checked={form.monitoramento_ativo} onCheckedChange={(v) => setForm({ ...form, monitoramento_ativo: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Análise de marca semanal</p>
                <p className="text-xs text-muted-foreground">Análise de identidade toda terça às 9h</p>
              </div>
              <Switch checked={form.analise_marca_ativa} onCheckedChange={(v) => setForm({ ...form, analise_marca_ativa: v })} />
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
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              As análises e o histórico vinculados a esta empresa perderão a referência.
            </AlertDialogDescription>
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

export default Empresas;
