import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Building2 } from "lucide-react";
import type { AnalysisMode } from "@/types/analysis";

interface AnalysisModeTabsProps {
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
}

const AnalysisModeTabs = ({ mode, onModeChange }: AnalysisModeTabsProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Perfil de Análise</label>
      <Tabs value={mode} onValueChange={(v) => onModeChange(v as AnalysisMode)}>
        <TabsList className="grid w-full grid-cols-2 h-14">
          <TabsTrigger value="influencer" className="flex items-center gap-2 h-full">
            <User className="h-4 w-4" />
            <div className="text-left">
              <div className="text-sm font-medium">Influencer</div>
              <div className="text-xs text-muted-foreground hidden sm:block">Marca Pessoal</div>
            </div>
          </TabsTrigger>
          <TabsTrigger value="business" className="flex items-center gap-2 h-full">
            <Building2 className="h-4 w-4" />
            <div className="text-left">
              <div className="text-sm font-medium">Empresa</div>
              <div className="text-xs text-muted-foreground hidden sm:block">Empreendimento</div>
            </div>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
};

export default AnalysisModeTabs;
