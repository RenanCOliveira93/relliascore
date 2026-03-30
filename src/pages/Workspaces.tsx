import { useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Building2, Pencil, Trash2, Plus, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import VideoBackground from "@/components/VideoBackground";

const Workspaces = () => {
  const { workspaces, activeWorkspace, setActiveWorkspaceId, createWorkspace, renameWorkspace, deleteWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState("");
  const [renameName, setRenameName] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const ws = await createWorkspace(newName.trim());
    if (ws) setActiveWorkspaceId(ws.id);
    setNewName("");
    setCreateOpen(false);
    setCreating(false);
  };

  const handleRename = async () => {
    if (!renameName.trim()) return;
    await renameWorkspace(renameId, renameName.trim());
    setRenameOpen(false);
  };

  const handleDelete = async () => {
    await deleteWorkspace(deleteId);
    setDeleteOpen(false);
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
              <h1 className="text-xl font-semibold">Gerenciar Espaços</h1>
              <p className="text-sm text-muted-foreground">Organize seus clientes em espaços separados</p>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Espaço
            </Button>
          </div>

          <div className="grid gap-4">
            {workspaces.map((ws) => (
              <Card
                key={ws.id}
                className={`backdrop-blur-md bg-card/80 border-border/50 ${ws.id === activeWorkspace?.id ? "ring-2 ring-primary/50" : ""}`}
              >
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{ws.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Criado em {new Date(ws.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    {ws.id === activeWorkspace?.id && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Ativo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {ws.id !== activeWorkspace?.id && (
                      <Button variant="outline" size="sm" onClick={() => setActiveWorkspaceId(ws.id)}>
                        Ativar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setRenameId(ws.id); setRenameName(ws.name); setRenameOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {workspaces.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { setDeleteId(ws.id); setDeleteOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo Espaço</DialogTitle></DialogHeader>
          <Input placeholder="Nome do espaço" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>{creating ? "Criando..." : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Renomear Espaço</DialogTitle></DialogHeader>
          <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleRename()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancelar</Button>
            <Button onClick={handleRename} disabled={!renameName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Excluir Espaço</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza? As análises vinculadas a este espaço perderão a associação.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Workspaces;
