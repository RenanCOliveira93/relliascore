import { useEffect, useState } from "react";
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
    empresaId: string | null;
  }) => void;
  isAnalyzing: boolean;
  empresas?: BrandFormEmpresa[];
  initialEmpresaId?: string | null;
}

export interface BrandFormEmpresa { id: string; nome: string; url: string; linkedin_url: string | null; instagram_url: string | null; descricao: string | null }

const BrandAnalysisForm = ({ onAnalyze, isAnalyzing, empresas = [], initialEmpresaId = null }: BrandAnalysisFormProps) => {
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<AnalysisMode>("business");
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  // Explicit company context: selecting a company pre-fills its sources; the id is sent to the server.
  const selectEmpresa = (id: string | null) => {
    setEmpresaId(id);
    const e = empresas.find((x) => x.id === id);
    if (!e) return;
    setWebsite(e.url ?? "");
    setLinkedin(e.linkedin_url ?? "");
    setInstagram(e.instagram_url ?? "");
    if (e.descricao) setDescription(e.descricao);
  };
  useEffect(() => {
    if (initialEmpresaId && empresas.some((e) => e.id === initialEmpresaId)) selectEmpresa(initialEmpresaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmpresaId, empresas]);

  const handleSubmit = () => {
    onAnalyze({ website, linkedin, instagram, description, mode, empresaId });
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

        {empresas.length > 0 && (
          <div className="space-y-2">
            <label htmlFor="brand-empresa" className="text-sm font-medium">Empresa</label>
            <select
              id="brand-empresa"
              aria-label="Empresa"
              className="h-11 w-full rounded-md border border-input bg-input/50 px-3 text-sm"
              value={empresaId ?? ""}
              onChange={(e) => selectEmpresa(e.target.value || null)}
            >
              <option value="">Nenhuma (não salva no Brand Profile)</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">Com uma empresa selecionada, o resultado atualiza o Brand Profile dela.</p>
          </div>
        )}

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
