import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Trash2, Eye, ChevronDown, ChevronUp } from "lucide-react";
import type { BrandAnalysisResult } from "@/types/brand-analysis";

interface BrandAnalysisRecord {
  id: string;
  created_at: string;
  mode: string;
  website: string | null;
  linkedin: string | null;
  instagram: string | null;
  description: string;
  result: BrandAnalysisResult;
}

interface BrandAnalysisHistoryProps {
  onViewResult: (result: BrandAnalysisResult, mode: string) => void;
  refreshKey?: number;
}

const BrandAnalysisHistory = ({ onViewResult, refreshKey }: BrandAnalysisHistoryProps) => {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [records, setRecords] = useState<BrandAnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("brand_analyses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (activeWorkspace) {
      query = query.eq("workspace_id", activeWorkspace.id);
    }

    const { data, error } = await query;
    if (!error && data) {
      setRecords(data as unknown as BrandAnalysisRecord[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [user, refreshKey, activeWorkspace?.id]);

  const handleDelete = async (id: string) => {
    await supabase.from("brand_analyses").delete().eq("id", id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  if (loading) return null;
  if (records.length === 0) return null;

  return (
    <Card className="backdrop-blur-md bg-card/80 border-border/50">
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Análises ({records.length})
          </span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 space-y-3">
          {records.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-xs">
                    {record.mode === "influencer" ? "Influencer" : "Empresa"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(record.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm truncate text-muted-foreground">
                  {record.website || record.description.slice(0, 60)}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onViewResult(record.result, record.mode)}
                  title="Ver resultado"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(record.id)}
                  title="Excluir"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
};

export default BrandAnalysisHistory;
