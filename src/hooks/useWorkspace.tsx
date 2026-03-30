import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspaceId: (id: string) => void;
  loading: boolean;
  createWorkspace: (name: string) => Promise<Workspace | null>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaces: [],
  activeWorkspace: null,
  setActiveWorkspaceId: () => {},
  loading: true,
  createWorkspace: async () => null,
  renameWorkspace: async () => {},
  deleteWorkspace: async () => {},
  refreshWorkspaces: async () => {},
});

export const WorkspaceProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setActiveId(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: true });

    const list = (data ?? []) as Workspace[];
    setWorkspaces(list);

    // Restore persisted active or default to first
    const stored = localStorage.getItem(`rellia_workspace_${user.id}`);
    const valid = list.find((w) => w.id === stored);
    setActiveId(valid ? valid.id : list[0]?.id ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const setActiveWorkspaceId = (id: string) => {
    setActiveId(id);
    if (user) localStorage.setItem(`rellia_workspace_${user.id}`, id);
  };

  const createWorkspace = async (name: string): Promise<Workspace | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("workspaces")
      .insert({ user_id: user.id, name })
      .select()
      .single();
    if (error || !data) return null;
    const ws = data as Workspace;
    setWorkspaces((prev) => [...prev, ws]);
    return ws;
  };

  const renameWorkspace = async (id: string, name: string) => {
    await supabase.from("workspaces").update({ name }).eq("id", id);
    setWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...w, name } : w)));
  };

  const deleteWorkspace = async (id: string) => {
    await supabase.from("workspaces").delete().eq("id", id);
    setWorkspaces((prev) => {
      const next = prev.filter((w) => w.id !== id);
      if (activeId === id && next.length > 0) setActiveWorkspaceId(next[0].id);
      return next;
    });
  };

  const activeWorkspace = workspaces.find((w) => w.id === activeId) ?? null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        setActiveWorkspaceId,
        loading,
        createWorkspace,
        renameWorkspace,
        deleteWorkspace,
        refreshWorkspaces: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => useContext(WorkspaceContext);
