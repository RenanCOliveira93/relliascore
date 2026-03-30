import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Linkedin, Instagram, Scan } from "lucide-react";
import AnalysisModeTabs from "./AnalysisModeTabs";
import type { AnalysisMode } from "@/types/analysis";

interface BrandAnalysisFormProps {
  onAnalyze: (data: {
    website: string;
    linkedin: string;
    instagram: string;
    description: string;
    mode: AnalysisMode;
  }) => void;
  isAnalyzing: boolean;
}

const BrandAnalysisForm = ({ onAnalyze, isAnalyzing }: BrandAnalysisFormProps) => {
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<AnalysisMode>("business");

  const handleSubmit = () => {
    onAnalyze({ website, linkedin, instagram, description, mode });
  };

  const isValid = description.trim().length >= 10;

  return (
    <Card className="backdrop-blur-md bg-card/80 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scan className="h-5 w-5" />
          Análise de Marca
        </CardTitle>
        <CardDescription>
          Preencha seus dados para uma análise profunda da sua marca pela perspectiva da IA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <AnalysisModeTabs mode={mode} onModeChange={setMode} />

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Site
            </label>
            <Input
              placeholder="https://seusite.com.br"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="h-11 bg-input/50 backdrop-blur-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Linkedin className="h-4 w-4 text-muted-foreground" />
              LinkedIn
            </label>
            <Input
              placeholder="https://linkedin.com/in/seu-perfil"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              className="h-11 bg-input/50 backdrop-blur-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Instagram className="h-4 w-4 text-muted-foreground" />
            Instagram
          </label>
          <Input
            placeholder="https://instagram.com/seu-perfil"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            className="h-11 bg-input/50 backdrop-blur-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Sobre você / sua empresa</label>
          <Textarea
            placeholder="Descreva sua marca, o que faz, qual o seu mercado, seus diferenciais..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="bg-input/50 backdrop-blur-sm"
          />
          <p className="text-xs text-muted-foreground">
            Quanto mais detalhes, melhor será a análise (mínimo 10 caracteres)
          </p>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!isValid || isAnalyzing}
          className="w-full h-12 text-lg"
          size="lg"
        >
          <Scan className="mr-2 h-5 w-5" />
          {isAnalyzing ? "Analisando marca..." : "Analisar Marca"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default BrandAnalysisForm;
