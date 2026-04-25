import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  created_at: string;
  workspace_id: string;
}

const NotificationBell = () => {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [items, setItems] = useState<Notificacao[]>([]);
  const [open, setOpen] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!user || !activeWorkspace) return;
    const { data } = await supabase
      .from("notificacoes")
      .select("*")
      .eq("workspace_id", activeWorkspace.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as Notificacao[]);
  }, [user, activeWorkspace]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Realtime
  useEffect(() => {
    if (!activeWorkspace) return;
    const channel = supabase
      .channel(`notificacoes-${activeWorkspace.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificacoes",
          filter: `workspace_id=eq.${activeWorkspace.id}`,
        },
        () => fetchItems(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeWorkspace, fetchItems]);

  const unread = items.filter((i) => !i.lida).length;

  const markAllRead = async () => {
    if (!activeWorkspace) return;
    await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("workspace_id", activeWorkspace.id)
      .eq("lida", false);
    fetchItems();
  };

  const markRead = async (id: string) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    fetchItems();
  };

  const remove = async (id: string) => {
    await supabase.from("notificacoes").delete().eq("id", id);
    fetchItems();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Notificações</span>
            {unread > 0 && (
              <Badge variant="secondary" className="h-5 text-[10px]">
                {unread} novas
              </Badge>
            )}
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3 w-3" />
              Marcar lidas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[420px]">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação ainda.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 hover:bg-accent/40 transition-colors cursor-pointer ${
                    !n.lida ? "bg-primary/5" : ""
                  }`}
                  onClick={() => !n.lida && markRead(n.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {!n.lida && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                        <p className="text-sm font-medium truncate">
                          {n.titulo}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {n.mensagem}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {new Date(n.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-50 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(n.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
