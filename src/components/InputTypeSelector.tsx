import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, FileText } from "lucide-react";
import type { InputType } from "@/types/analysis";

interface InputTypeSelectorProps {
  inputType: InputType;
  onInputTypeChange: (type: InputType) => void;
}

const InputTypeSelector = ({ inputType, onInputTypeChange }: InputTypeSelectorProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Fonte de Análise</label>
      <Tabs value={inputType} onValueChange={(v) => onInputTypeChange(v as InputType)}>
        <TabsList className="grid w-full grid-cols-2 h-14">
          <TabsTrigger value="webpage" className="flex items-center gap-2 h-full">
            <Globe className="h-4 w-4" />
            <div className="text-left">
              <div className="text-sm font-medium">Webpage</div>
              <div className="text-xs text-muted-foreground hidden sm:block">Site publicado</div>
            </div>
          </TabsTrigger>
          <TabsTrigger value="text" className="flex items-center gap-2 h-full">
            <FileText className="h-4 w-4" />
            <div className="text-left">
              <div className="text-sm font-medium">Texto</div>
              <div className="text-xs text-muted-foreground hidden sm:block">Pré-publicação</div>
            </div>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
};

export default InputTypeSelector;
