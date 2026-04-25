import { useEffect, useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import VideoBackground from "@/components/VideoBackground";
import {
  ArrowLeft, KeyRound, Webhook, Plus, Trash2, Copy, Check, ExternalLink, Power,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  is_active: boolean;
  success_count: number;
  failure_count: number;
  last_triggered_at: string | null;
  last_error: string | null;
  created_at: string;
}

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const PUBLIC_API_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/public-api`;

const Integrations = () => {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();
  const { toast } = useToast();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [hooks, setHooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create key dialog
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Delete key
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);

  // Create webhook dialog
  const [hookDialogOpen, setHookDialogOpen] = useState(false);
  const [newHook, setNewHook] = useState({
    name: "",
    url: "",
    secret: "",
    analysis: true,
    brand: true,
  });
  const [creatingHook, setCreatingHook] = useState(false);

  // Delete webhook
  const [deleteHookId, setDeleteHookId] = useState<string | null>(null);

  const load = async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const [{ data: k }, { data: h }] = await Promise.all([
      supabase
        .from("workspace_api_keys")
        .select("*")
        .eq("workspace_id", activeWorkspace.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("workspace_webhooks")
        .select("*")
        .eq("workspace_id", activeWorkspace.id)
        .order("created_at", { ascending: false }),
    ]);
    setKeys((k ?? []) as ApiKey[]);
    setHooks((h ?? []) as WebhookRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id]);

  // ---------- API Keys ----------
  const generateKeyValue = () => {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    const b64 = btoa(String.fromCharCode(...arr))
      .replace(/\+/g, "")
      .replace(/\//g, "")
      .replace(/=/g, "");
    return `rl_${b64}`;
  };

  const sha256Hex = async (s: string) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const handleCreateKey = async () => {
    if (!activeWorkspace || !newKeyName.trim()) return;
    setCreatingKey(true);
    const value = generateKeyValue();
    const hash = await sha256Hex(value);
    const prefix = value.substring(0, 10);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCreatingKey(false);
      return;
    }
    const { error } = await supabase.from("workspace_api_keys").insert({
      workspace_id: activeWorkspace.id,
      user_id: user.id,
      name: newKeyName.trim(),
      key_prefix: prefix,
      key_hash: hash,
    });
    setCreatingKey(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setNewKeyValue(value);
    setNewKeyName("");
    await load();
  };

  const toggleKey = async (id: string, active: boolean) => {
    await supabase.from("workspace_api_keys").update({ is_active: active }).eq("id", id);
    await load();
  };

  const handleDeleteKey = async () => {
    if (!deleteKeyId) return;
    await supabase.from("workspace_api_keys").delete().eq("id", deleteKeyId);
    setDeleteKeyId(null);
    await load();
  };

  // ---------- Webhooks ----------
  const handleCreateHook = async () => {
    if (!activeWorkspace || !newHook.name.trim() || !newHook.url.trim()) return;
    try { new URL(newHook.url); } catch {
      toast({ title: "URL inválida", variant: "destructive" });
      return;
    }
    setCreatingHook(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreatingHook(false); return; }
    const events: string[] = [];
    if (newHook.analysis) events.push("analysis.completed");
    if (newHook.brand) events.push("brand_analysis.completed");

    const { error } = await supabase.from("workspace_webhooks").insert({
      workspace_id: activeWorkspace.id,
      user_id: user.id,
      name: newHook.name.trim(),
      url: newHook.url.trim(),
      secret: newHook.secret.trim() || null,
      events,
    });
    setCreatingHook(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setNewHook({ name: "", url: "", secret: "", analysis: true, brand: true });
    setHookDialogOpen(false);
    toast({ title: "Webhook criado" });
    await load();
  };

  const toggleHook = async (id: string, active: boolean) => {
    await supabase.from("workspace_webhooks").update({ is_active: active }).eq("id", id);
    await load();
  };

  const handleDeleteHook = async () => {
    if (!deleteHookId) return;
    await supabase.from("workspace_webhooks").delete().eq("id", deleteHookId);
    setDeleteHookId(null);
    await load();
  };

  const copy = async (txt: string) => {
    await navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
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
              <h1 className="text-2xl font-bold">Integrações & Automações</h1>
              <p className="text-sm text-muted-foreground">
                Conecte o RELLIA ao n8n, Zapier, Make e seu CRM via API e webhooks.
              </p>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-5xl">
          {!activeWorkspace ? (
            <p className="text-muted-foreground">Selecione um espaço de trabalho.</p>
          ) : (
            <Tabs defaultValue="keys" className="space-y-6">
              <Card className="bg-card/40 backdrop-blur-md border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Identificadores deste espaço</CardTitle>
                  <CardDescription>
                    Forneça estes IDs ao time RELLIA para configurar suas automações no n8n.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-32 shrink-0">Workspace ID</span>
                    <code className="flex-1 text-xs bg-background/40 px-2 py-1 rounded border border-border/50 truncate">
                      {activeWorkspace.id}
                    </code>
                    <Button size="icon" variant="ghost" onClick={() => copy(activeWorkspace.id)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-32 shrink-0">Nome</span>
                    <code className="flex-1 text-xs bg-background/40 px-2 py-1 rounded border border-border/50 truncate">
                      {activeWorkspace.name}
                    </code>
                  </div>
                </CardContent>
              </Card>

              <TabsList>
                <TabsTrigger value="keys" className="gap-2">
                  <KeyRound className="h-4 w-4" /> API Keys
                </TabsTrigger>
                <TabsTrigger value="webhooks" className="gap-2">
                  <Webhook className="h-4 w-4" /> Webhooks
                </TabsTrigger>
                <TabsTrigger value="docs" className="gap-2">
                  <ExternalLink className="h-4 w-4" /> Documentação
                </TabsTrigger>
              </TabsList>

              {/* ---------------- API KEYS TAB ---------------- */}
              <TabsContent value="keys">
                <Card className="bg-card/40 backdrop-blur-md border-border/50">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle>API Keys do espaço "{activeWorkspace.name}"</CardTitle>
                      <CardDescription>
                        Use estas chaves para disparar análises a partir do n8n, Zapier ou seu backend.
                      </CardDescription>
                    </div>
                    <Button onClick={() => { setNewKeyValue(null); setKeyDialogOpen(true); }} className="gap-2">
                      <Plus className="h-4 w-4" /> Nova chave
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <p className="text-muted-foreground text-sm">Carregando...</p>
                    ) : keys.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Nenhuma chave criada ainda.</p>
                    ) : (
                      <div className="space-y-2">
                        {keys.map((k) => (
                          <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-background/40">
                            <KeyRound className="h-4 w-4 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{k.name}</span>
                                {!k.is_active && <Badge variant="secondary">Inativa</Badge>}
                              </div>
                              <code className="text-xs text-muted-foreground">{k.key_prefix}••••••••</code>
                              <p className="text-xs text-muted-foreground">
                                Último uso: {k.last_used_at ? new Date(k.last_used_at).toLocaleString("pt-BR") : "nunca"}
                              </p>
                            </div>
                            <Switch
                              checked={k.is_active}
                              onCheckedChange={(v) => toggleKey(k.id, v)}
                              aria-label="Ativar/desativar chave"
                            />
                            <Button variant="ghost" size="icon" onClick={() => setDeleteKeyId(k.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ---------------- WEBHOOKS TAB ---------------- */}
              <TabsContent value="webhooks">
                <Card className="bg-card/40 backdrop-blur-md border-border/50">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle>Webhooks de saída</CardTitle>
                      <CardDescription>
                        O RELLIA envia um POST com o resultado da análise para a URL configurada.
                      </CardDescription>
                    </div>
                    <Button onClick={() => setHookDialogOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" /> Novo webhook
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <p className="text-muted-foreground text-sm">Carregando...</p>
                    ) : hooks.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Nenhum webhook configurado.</p>
                    ) : (
                      <div className="space-y-2">
                        {hooks.map((h) => (
                          <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-background/40">
                            <Webhook className="h-4 w-4 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium truncate">{h.name}</span>
                                {!h.is_active && <Badge variant="secondary">Pausado</Badge>}
                                {h.events.map((e) => (
                                  <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                                ))}
                              </div>
                              <code className="text-xs text-muted-foreground truncate block">{h.url}</code>
                              <p className="text-xs text-muted-foreground">
                                ✓ {h.success_count} · ✗ {h.failure_count}
                                {h.last_triggered_at && ` · último: ${new Date(h.last_triggered_at).toLocaleString("pt-BR")}`}
                                {h.last_error && ` · erro: ${h.last_error}`}
                              </p>
                            </div>
                            <Switch
                              checked={h.is_active}
                              onCheckedChange={(v) => toggleHook(h.id, v)}
                              aria-label="Ativar/pausar webhook"
                            />
                            <Button variant="ghost" size="icon" onClick={() => setDeleteHookId(h.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ---------------- DOCS TAB ---------------- */}
              <TabsContent value="docs">
                <Card className="bg-card/40 backdrop-blur-md border-border/50">
                  <CardHeader>
                    <CardTitle>Como usar a API pública</CardTitle>
                    <CardDescription>Compatível com n8n, Zapier, Make ou qualquer cliente HTTP.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 text-sm">
                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">Endpoint base</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="bg-background/60 px-3 py-2 rounded border border-border/50 flex-1 text-xs break-all">
                          {PUBLIC_API_BASE}
                        </code>
                        <Button size="icon" variant="ghost" onClick={() => copy(PUBLIC_API_BASE)}>
                          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">Autenticação</Label>
                      <p className="mt-1 text-muted-foreground">
                        Envie sua API key no header <code className="text-foreground">X-API-Key</code>.
                      </p>
                    </div>

                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">POST /analyze · análise de relevância</Label>
                      <pre className="bg-background/60 p-3 rounded border border-border/50 text-xs overflow-x-auto mt-1">
{`curl -X POST ${PUBLIC_API_BASE}/analyze \\
  -H "X-API-Key: rl_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "websiteUrl": "https://exemplo.com",
    "searchQuery": "melhor consultor SEO",
    "mode": "business",
    "inputType": "webpage"
  }'`}
                      </pre>
                    </div>

                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">POST /analyze-brand · análise de marca</Label>
                      <pre className="bg-background/60 p-3 rounded border border-border/50 text-xs overflow-x-auto mt-1">
{`curl -X POST ${PUBLIC_API_BASE}/analyze-brand \\
  -H "X-API-Key: rl_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "website": "https://exemplo.com",
    "linkedin": "https://linkedin.com/company/exemplo",
    "description": "Empresa de consultoria...",
    "mode": "business"
  }'`}
                      </pre>
                    </div>

                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">Webhooks</Label>
                      <p className="mt-1 text-muted-foreground">
                        Quando uma análise termina (via app ou API), o RELLIA envia um POST JSON para
                        cada webhook ativo do espaço. Eventos disponíveis:
                        <code className="ml-1 text-foreground">analysis.completed</code>,
                        <code className="ml-1 text-foreground">brand_analysis.completed</code>.
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        Se você definir um <strong>secret</strong>, validamos a entrega com HMAC-SHA256
                        no header <code className="text-foreground">X-Rellia-Signature: sha256=...</code>.
                      </p>
                      <pre className="bg-background/60 p-3 rounded border border-border/50 text-xs overflow-x-auto mt-2">
{`{
  "event": "analysis.completed",
  "workspace_id": "uuid...",
  "timestamp": "2025-01-01T12:00:00Z",
  "data": {
    "score": 78,
    "sub_scores": { ... },
    "action_plan": [ ... ],
    "summary": "..."
  }
}`}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>

      {/* ----- Create API Key Dialog ----- */}
      <Dialog open={keyDialogOpen} onOpenChange={(o) => { setKeyDialogOpen(o); if (!o) { setNewKeyValue(null); setNewKeyName(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{newKeyValue ? "Sua nova API Key" : "Nova API Key"}</DialogTitle>
            <DialogDescription>
              {newKeyValue
                ? "Copie agora — não será possível visualizá-la novamente."
                : "Dê um nome para identificar onde esta chave será usada."}
            </DialogDescription>
          </DialogHeader>

          {newKeyValue ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <code className="bg-background/60 px-3 py-2 rounded border border-border/50 flex-1 text-xs break-all">
                  {newKeyValue}
                </code>
                <Button size="icon" variant="ghost" onClick={() => copy(newKeyValue)}>
                  {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Guarde em um local seguro. O RELLIA armazena apenas o hash.
              </p>
            </div>
          ) : (
            <Input
              placeholder="Ex: n8n produção"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateKey()}
            />
          )}

          <DialogFooter>
            {newKeyValue ? (
              <Button onClick={() => { setKeyDialogOpen(false); setNewKeyValue(null); }}>Concluir</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setKeyDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateKey} disabled={!newKeyName.trim() || creatingKey}>
                  {creatingKey ? "Gerando..." : "Gerar chave"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----- Delete Key Confirm ----- */}
      <AlertDialog open={!!deleteKeyId} onOpenChange={(o) => !o && setDeleteKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Integrações que usam esta chave deixarão de funcionar imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteKey}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ----- Create Webhook Dialog ----- */}
      <Dialog open={hookDialogOpen} onOpenChange={setHookDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo webhook</DialogTitle>
            <DialogDescription>
              Receba um POST sempre que uma análise for concluída neste espaço.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="hook-name">Nome</Label>
              <Input
                id="hook-name"
                placeholder="Ex: Slack do time"
                value={newHook.name}
                onChange={(e) => setNewHook({ ...newHook, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="hook-url">URL de destino</Label>
              <Input
                id="hook-url"
                placeholder="https://n8n.exemplo.com/webhook/..."
                value={newHook.url}
                onChange={(e) => setNewHook({ ...newHook, url: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="hook-secret">Secret (opcional, HMAC-SHA256)</Label>
              <Input
                id="hook-secret"
                placeholder="Deixe vazio para não assinar"
                value={newHook.secret}
                onChange={(e) => setNewHook({ ...newHook, secret: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Eventos</Label>
              <div className="flex items-center justify-between p-2 rounded border border-border/50">
                <span className="text-sm"><code>analysis.completed</code> · análise de relevância</span>
                <Switch
                  checked={newHook.analysis}
                  onCheckedChange={(v) => setNewHook({ ...newHook, analysis: v })}
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded border border-border/50">
                <span className="text-sm"><code>brand_analysis.completed</code> · análise de marca</span>
                <Switch
                  checked={newHook.brand}
                  onCheckedChange={(v) => setNewHook({ ...newHook, brand: v })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHookDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreateHook}
              disabled={creatingHook || !newHook.name.trim() || !newHook.url.trim() || (!newHook.analysis && !newHook.brand)}
            >
              {creatingHook ? "Salvando..." : "Criar webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----- Delete Webhook Confirm ----- */}
      <AlertDialog open={!!deleteHookId} onOpenChange={(o) => !o && setDeleteHookId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              As próximas análises não serão mais enviadas para esta URL.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteHook}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Integrations;
