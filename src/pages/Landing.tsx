import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Brain, Target, TrendingUp, ChevronRight, BarChart3, Zap, Shield, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleCTA = () => {
    navigate(user ? "/home" : "/auth");
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 border-b border-border/30 backdrop-blur-md bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-bold tracking-tight">RELLIA SCORE</span>
          </div>
          <Button onClick={handleCTA} variant="outline" size="sm" className="gap-1.5">
            {user ? "Ir para Painel" : "Entrar"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-20 pb-28 lg:pt-32 lg:pb-36">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
            <Zap className="h-3.5 w-3.5" />
            Diagnóstico inteligente para a era da IA
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            Seu conteúdo é relevante
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              para as IAs?
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Descubra como ChatGPT, Gemini e outras IAs enxergam seu site.
            Receba um score, sub-scores detalhados e um plano de ação para
            dominar as recomendações dos LLMs.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={handleCTA} size="lg" className="h-13 px-8 text-base gap-2 shadow-lg shadow-primary/20">
              Analisar meu conteúdo
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })} variant="outline" size="lg" className="h-13 px-8 text-base">
              Como funciona
            </Button>
          </div>

          {/* Hero visual — abstract metrics mockup */}
          <div className="mt-16 relative mx-auto max-w-3xl">
            <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-8 shadow-2xl">
              <div className="grid grid-cols-3 gap-6">
                {[
                  { label: "Score Geral", value: "87", color: "text-green-400" },
                  { label: "Relevância Temática", value: "92", color: "text-primary" },
                  { label: "Otimização LLM", value: "78", color: "text-accent" },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <p className={`text-4xl lg:text-5xl font-bold font-mono ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-primary to-accent" />
              </div>
            </div>
            {/* Glow behind card */}
            <div className="absolute inset-0 -z-10 bg-primary/10 blur-[60px] rounded-3xl" />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="relative z-10 py-20 bg-card/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-4">
            Tudo que você precisa para
            <span className="text-primary"> dominar os LLMs</span>
          </h2>
          <p className="text-center text-muted-foreground mb-14 max-w-xl mx-auto">
            Análise completa com inteligência artificial para posicionar seu conteúdo nas respostas dos modelos de linguagem.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: BarChart3, title: "Score Detalhado", desc: "5 sub-scores em radar chart para visão completa" },
              { icon: Target, title: "Palavras-chave", desc: "Encontradas, ausentes e sugeridas para otimização" },
              { icon: Brain, title: "Diagnóstico de IA", desc: "Análise de compatibilidade com múltiplos LLMs" },
              { icon: TrendingUp, title: "Plano de Ação", desc: "Passos prioritários para melhorar seu ranking" },
            ].map((item) => (
              <div
                key={item.title}
                className="group p-6 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm hover:border-primary/30 hover:bg-card/80 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="relative z-10 py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-14">
            Como funciona
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Insira seu conteúdo", desc: "URL de uma página web ou cole um texto que pretende publicar." },
              { step: "02", title: "Defina a pesquisa", desc: "Digite como um usuário pesquisaria em uma IA — o cenário que você quer dominar." },
              { step: "03", title: "Receba o diagnóstico", desc: "Score completo, radar de sub-scores, análise de keywords e plano de ação priorizado." },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="text-5xl font-bold font-mono text-primary/15 mb-3">{item.step}</div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof / numbers */}
      <section className="relative z-10 py-16 bg-card/30 border-y border-border/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "5", label: "Sub-scores analisados" },
              { value: "50+", label: "Fatores avaliados" },
              { value: "3s", label: "Tempo médio de análise" },
              { value: "PDF", label: "Relatório exportável" },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-3xl font-bold font-mono text-primary">{item.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 py-24">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <div className="p-10 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
            <div className="relative z-10">
              <Shield className="h-10 w-10 text-primary mx-auto mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                Pronto para otimizar seu conteúdo?
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Crie sua conta gratuita e descubra como as IAs veem seu site. Leva menos de 30 segundos.
              </p>
              <Button onClick={handleCTA} size="lg" className="h-13 px-10 text-base gap-2 shadow-lg shadow-primary/20">
                Começar agora — é grátis
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/30 py-8">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>RELLIA SCORE</span>
          </div>
          <p>Diagnóstico de Relevância para Inteligências Artificiais</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
