import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Search, Globe, Sparkles, FileDown, LogOut, Scan, Lock, Crown } from "lucide-react";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useSubscription } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";
import RobotAnimation from "@/components/RobotAnimation";
import ScoreDisplay from "@/components/ScoreDisplay";
import AnalysisModeTabs from "@/components/AnalysisModeTabs";
import InputTypeSelector from "@/components/InputTypeSelector";
import VideoBackground from "@/components/VideoBackground";
import BrandAnalysisForm from "@/components/BrandAnalysisForm";
import BrandAnalysisResults from "@/components/BrandAnalysisResults";
import BrandAnalysisHistory from "@/components/BrandAnalysisHistory";
import { generateAnalysisPdf } from "@/lib/generatePdf";
import { supabase } from "@/integrations/supabase/client";
import type { AnalysisResult, AnalysisMode, InputType } from "@/types/analysis";
import type { BrandAnalysisResult } from "@/types/brand-analysis";

const Index = () => {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [textContent, setTextContent] = useState("");
  const [mode, setMode] = useState<AnalysisMode>("business");
  const [inputType, setInputType] = useState<InputType>("webpage");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // Brand analysis state
  const [isBrandAnalyzing, setIsBrandAnalyzing] = useState(false);
  const [brandResult, setBrandResult] = useState<BrandAnalysisResult | null>(null);
  const [brandMode, setBrandMode] = useState<AnalysisMode>("business");
  const [brandHistoryKey, setBrandHistoryKey] = useState(0);

  const { toast } = useToast();
  const { signOut, user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { planConfig, canAnalyze, remainingAnalyses, incrementUsage, subscription } = useSubscription();

  const handleAnalyze = async () => {
    if (!canAnalyze) {
      toast({ title: "Limite atingido", description: "Você atingiu o limite de análises do seu plano. Faça upgrade para continuar.", variant: "destructive" });
      return;
    }
    if (inputType === "text" && !planConfig.canUseTextMode) {
      toast({ title: "Recurso PRO", description: "Análise de texto está disponível a partir do plano PRO.", variant: "destructive" });
      return;
    }

    if (inputType === "webpage") {
      if (!websiteUrl.trim() || !searchQuery.trim()) {
        toast({ title: "Campos obrigatórios", description: "Por favor, preencha a URL do site e a pesquisa.", variant: "destructive" });
        return;
      }
      let formattedUrl = websiteUrl.trim();
      if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
        formattedUrl = "https://" + formattedUrl;
      }
      try { new URL(formattedUrl); } catch {
        toast({ title: "URL inválida", description: "Por favor, insira uma URL válida.", variant: "destructive" });
        return;
      }
      setIsAnalyzing(true);
      setResult(null);
      try {
        const allowed = await incrementUsage();
        if (!allowed) throw new Error("Limite de análises atingido.");
        const { data, error } = await supabase.functions.invoke('analyze-relevance', {
          body: { websiteUrl: formattedUrl, searchQuery: searchQuery.trim(), mode, inputType: "webpage" }
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        setResult(data);
        toast({ title: "Análise concluída!", description: "Veja o diagnóstico completo do seu site." });
      } catch (error) {
        console.error("Analysis error:", error);
        toast({ title: "Erro na análise", description: error instanceof Error ? error.message : "Ocorreu um erro ao analisar o site.", variant: "destructive" });
      } finally {
        setIsAnalyzing(false);
      }
    } else {
      if (!textContent.trim() || !searchQuery.trim()) {
        toast({ title: "Campos obrigatórios", description: "Por favor, preencha o texto e a pesquisa.", variant: "destructive" });
        return;
      }
      setIsAnalyzing(true);
      setResult(null);
      try {
        const allowed = await incrementUsage();
        if (!allowed) throw new Error("Limite de análises atingido.");
        const { data, error } = await supabase.functions.invoke('analyze-relevance', {
          body: { content: textContent.trim(), searchQuery: searchQuery.trim(), mode, inputType: "text" }
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        setResult(data);
        toast({ title: "Análise concluída!", description: "Veja o diagnóstico completo do seu texto." });
      } catch (error) {
        console.error("Analysis error:", error);
        toast({ title: "Erro na análise", description: error instanceof Error ? error.message : "Ocorreu um erro ao analisar o texto.", variant: "destructive" });
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleBrandAnalyze = async (data: {
    website: string;
    linkedin: string;
    instagram: string;
    description: string;
    mode: AnalysisMode;
  }) => {
    if (!canAnalyze) {
      toast({ title: "Limite atingido", description: "Você atingiu o limite de análises do seu plano.", variant: "destructive" });
      return;
    }
    if (!planConfig.canUseBrandAnalysis) {
      toast({ title: "Recurso PRO", description: "Análise de marca está disponível a partir do plano PRO.", variant: "destructive" });
      return;
    }
    setIsBrandAnalyzing(true);
    setBrandResult(null);
    setBrandMode(data.mode);
    try {
      const allowed = await incrementUsage();
      if (!allowed) throw new Error("Limite de análises atingido.");
      const { data: result, error } = await supabase.functions.invoke('analyze-brand', {
        body: data
      });
      if (error) throw error;
      if (result.error) throw new Error(result.error);
      setBrandResult(result);

      if (user) {
        await supabase.from("brand_analyses").insert({
          user_id: user.id,
          mode: data.mode,
          website: data.website || null,
          linkedin: data.linkedin || null,
          instagram: data.instagram || null,
          description: data.description,
          result: result as any,
          workspace_id: activeWorkspace?.id ?? null,
        });
        setBrandHistoryKey((k) => k + 1);
      }

      toast({ title: "Análise concluída!", description: "Veja o diagnóstico completo da sua marca." });
    } catch (error) {
      console.error("Brand analysis error:", error);
      toast({ title: "Erro na análise", description: error instanceof Error ? error.message : "Ocorreu um erro ao analisar a marca.", variant: "destructive" });
    } finally {
      setIsBrandAnalyzing(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setWebsiteUrl("");
    setSearchQuery("");
    setTextContent("");
  };

  const handleBrandReset = () => {
    setBrandResult(null);
  };

  const displaySource = inputType === "webpage" ? websiteUrl : "Texto fornecido";

  return (
    <div className="min-h-screen relative">
      <VideoBackground />

      <div className="relative z-10">
        <header className="border-b border-border/50 backdrop-blur-md bg-background/30">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center backdrop-blur-sm">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">RELLIA</h1>
                  <p className="text-sm text-muted-foreground">Diagnóstico Completo de Relevância para IA</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="gap-1.5 text-xs">
                  <Crown className="h-3 w-3" />
                  {subscription?.plan === "premium" ? "Premium" : subscription?.plan === "pro" ? "PRO" : "Grátis"}
                  {remainingAnalyses !== null && (
                    <span className="text-muted-foreground">• {remainingAnalyses} restantes</span>
                  )}
                </Badge>
                <WorkspaceSwitcher />
                <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-muted-foreground">
                  <LogOut className="h-4 w-4" />
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Tabs defaultValue="relevance" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 h-12">
              <TabsTrigger value="relevance" className="text-sm gap-2 h-10">
                <Search className="h-4 w-4" />
                Análise de Relevância
              </TabsTrigger>
              <TabsTrigger value="brand" className="text-sm gap-2 h-10">
                <Scan className="h-4 w-4" />
                Análise de Marca
                {!planConfig.canUseBrandAnalysis && <Lock className="h-3 w-3 ml-1 opacity-50" />}
              </TabsTrigger>
            </TabsList>

            {/* ========== RELEVANCE TAB ========== */}
            <TabsContent value="relevance">
              {!isAnalyzing && !result && (
                <div className="space-y-8">
                  <div className="text-center space-y-4 py-8">
                    <h2 className="text-4xl font-bold tracking-tight">
                      Descubra seu Score de
                      <span className="text-primary"> Relevância LLM</span>
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                      Diagnóstico completo com sub-scores, plano de ação, análise de compatibilidade
                      e palavras-chave para otimizar seu conteúdo para IAs.
                    </p>
                  </div>

                  <Card className="backdrop-blur-md bg-card/80 border-border/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        Configurar Análise
                      </CardTitle>
                      <CardDescription>Escolha o perfil, a fonte, e configure sua análise</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <AnalysisModeTabs mode={mode} onModeChange={setMode} />
                      <InputTypeSelector inputType={inputType} onInputTypeChange={(t) => {
                        if (t === "text" && !planConfig.canUseTextMode) {
                          toast({ title: "Recurso PRO", description: "Análise de texto está disponível a partir do plano PRO.", variant: "destructive" });
                          return;
                        }
                        setInputType(t);
                      }} />

                      {inputType === "webpage" ? (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">URL do Site</label>
                          <Input
                            placeholder="https://exemplo.com ou https://exemplo.com/servicos"
                            value={websiteUrl}
                            onChange={(e) => setWebsiteUrl(e.target.value)}
                            className="h-12 bg-input/50 backdrop-blur-sm"
                          />
                          <p className="text-xs text-muted-foreground">Pode ser a página inicial ou uma página específica</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Texto para Análise</label>
                          <Textarea
                            placeholder="Cole aqui o texto que pretende publicar..."
                            value={textContent}
                            onChange={(e) => setTextContent(e.target.value)}
                            rows={8}
                            className="bg-input/50 backdrop-blur-sm"
                          />
                          <p className="text-xs text-muted-foreground">Cole o conteúdo que pretende publicar para receber sugestões antes da publicação</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Pesquisa ou Problema</label>
                        <Textarea
                          placeholder={mode === "influencer"
                            ? "Ex: 'Quem é referência em marketing digital no Brasil?'"
                            : "Ex: 'Melhor software para gestão de projetos'"
                          }
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          rows={3}
                          className="bg-input/50 backdrop-blur-sm"
                        />
                        <p className="text-xs text-muted-foreground">Digite como um usuário pesquisaria em uma IA</p>
                      </div>

                      <Button onClick={handleAnalyze} className="w-full h-12 text-lg" size="lg">
                        <Search className="mr-2 h-5 w-5" />
                        Analisar Relevância
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="grid md:grid-cols-3 gap-4 pt-8">
                    {[
                      { step: "1", title: "Escolha o perfil", description: "Influencer ou Empresa" },
                      { step: "2", title: "Insira conteúdo e pesquisa", description: "URL ou texto + consulta" },
                      { step: "3", title: "Receba o diagnóstico", description: "Score, plano de ação e mais" },
                    ].map((item) => (
                      <div key={item.step} className="text-center p-6 rounded-lg border border-border/50 bg-card/60 backdrop-blur-md">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center mx-auto mb-3">
                          {item.step}
                        </div>
                        <h3 className="font-medium mb-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isAnalyzing && <RobotAnimation />}

              {result && !isAnalyzing && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-2xl font-bold">Resultado da Análise</h2>
                      <p className="text-muted-foreground text-sm mt-1 truncate max-w-md">{displaySource}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        onClick={() => generateAnalysisPdf(result, displaySource, searchQuery, mode)}
                        className="gap-2"
                      >
                        <FileDown className="h-4 w-4" />
                        Exportar PDF
                      </Button>
                      <Button variant="outline" onClick={handleReset}>Nova Análise</Button>
                    </div>
                  </div>
                  <ScoreDisplay result={result} />
                </div>
              )}
            </TabsContent>

            {/* ========== BRAND TAB ========== */}
            <TabsContent value="brand">
              {!isBrandAnalyzing && !brandResult && (
                <div className="space-y-8">
                  <div className="text-center space-y-4 py-8">
                    <h2 className="text-4xl font-bold tracking-tight">
                      Análise Profunda da
                      <span className="text-primary"> Sua Marca</span>
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                      Descubra como a IA enxerga sua marca: tom de voz, público, posicionamento,
                      cores, comunicação e recomendações estratégicas.
                    </p>
                  </div>

                  <BrandAnalysisHistory
                    refreshKey={brandHistoryKey}
                    onViewResult={(res, m) => {
                      setBrandResult(res);
                      setBrandMode(m as AnalysisMode);
                    }}
                  />

                  <BrandAnalysisForm onAnalyze={handleBrandAnalyze} isAnalyzing={isBrandAnalyzing} />
                </div>
              )}

              {isBrandAnalyzing && <RobotAnimation />}

              {brandResult && !isBrandAnalyzing && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <h2 className="text-2xl font-bold">Diagnóstico da Marca</h2>
                    <Button variant="outline" onClick={handleBrandReset}>Nova Análise</Button>
                  </div>
                  <BrandAnalysisResults result={brandResult} mode={brandMode} />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>

        <footer className="border-t border-border/50 mt-auto backdrop-blur-md bg-background/30">
          <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
            RELLIA - Diagnóstico Completo de Relevância para Inteligências Artificiais
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Index;
