import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowLeft, Sparkles, Zap, Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription, PLAN_CONFIG } from "@/hooks/useSubscription";

interface PlanFeature {
  label: string;
  free: boolean | string;
  pro: boolean | string;
  premium: boolean | string;
}

const features: PlanFeature[] = [
  { label: "Análises de relevância por mês", free: "5", pro: "50", premium: "Ilimitadas" },
  { label: "Análise de marca", free: false, pro: true, premium: true },
  { label: "Modo Texto (pré-publicação)", free: false, pro: true, premium: true },
  { label: "Exportação em PDF", free: false, pro: true, premium: true },
  { label: "Workspaces (espaços)", free: "1", pro: "10", premium: "Ilimitados" },
  { label: "Exemplo ideal de conteúdo", free: false, pro: true, premium: true },
  { label: "Gráfico radar de sub-scores", free: true, pro: true, premium: true },
  { label: "Histórico de análises", free: true, pro: true, premium: true },
  { label: "Suporte prioritário", free: false, pro: false, premium: true },
  { label: "API de integração", free: false, pro: false, premium: true },
];

const plans = [
  {
    key: "free" as const,
    name: "Grátis",
    price: "R$ 0",
    period: "/mês",
    description: "Ideal para conhecer a plataforma e fazer seus primeiros diagnósticos.",
    icon: Zap,
    cta: "Começar Grátis",
    popular: false,
  },
  {
    key: "pro" as const,
    name: "PRO",
    price: "R$ 97",
    period: "/mês",
    description: "Para profissionais e consultores que precisam de análises frequentes e recursos avançados.",
    icon: Sparkles,
    cta: "Assinar PRO",
    popular: true,
  },
  {
    key: "premium" as const,
    name: "Premium",
    price: "R$ 297",
    period: "/mês",
    description: "Para agências e equipes que exigem volume ilimitado, suporte dedicado e integrações.",
    icon: Crown,
    cta: "Assinar Premium",
    popular: false,
  },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="text-sm font-semibold text-foreground">{value}</span>;
  }
  return value ? (
    <Check className="h-5 w-5 text-green-400" />
  ) : (
    <X className="h-5 w-5 text-muted-foreground/40" />
  );
}

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const currentPlan = subscription?.plan ?? "free";

  const handleSelect = (planKey: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    // For now, free plan just goes to home; paid plans would go to checkout
    if (planKey === "free") {
      navigate("/home");
    }
    // TODO: integrate Stripe checkout for pro/premium
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 border-b border-border/30 backdrop-blur-md bg-background/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xl font-bold tracking-tight">RELLIA</span>
          </button>
          <Button variant="outline" size="sm" onClick={() => navigate(user ? "/home" : "/auth")}>
            {user ? "Ir para o App" : "Entrar"}
          </Button>
        </div>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 px-4 py-1.5 text-sm">
            Planos & Preços
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Escolha o plano ideal{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              para você
            </span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Do diagnóstico inicial à gestão completa de múltiplos clientes. Escale conforme sua necessidade.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {plans.map((plan) => {
            const isCurrentPlan = user && currentPlan === plan.key;
            return (
              <Card
                key={plan.key}
                className={`relative flex flex-col transition-all duration-300 hover:scale-[1.02] ${
                  plan.popular
                    ? "border-primary/50 shadow-lg shadow-primary/10 bg-card"
                    : "border-border/50 bg-card/80"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1 text-xs font-bold">
                      MAIS POPULAR
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className={`mx-auto mb-3 p-3 rounded-xl ${plan.popular ? "bg-primary/10" : "bg-secondary"}`}>
                    <plan.icon className={`h-7 w-7 ${plan.popular ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="text-sm min-h-[48px]">{plan.description}</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 pt-6">
                  <ul className="space-y-3">
                    {features.map((f) => {
                      const val = f[plan.key];
                      const isAvailable = val !== false;
                      return (
                        <li key={f.label} className={`flex items-center gap-3 ${!isAvailable ? "opacity-40" : ""}`}>
                          <FeatureValue value={val} />
                          <span className="text-sm text-foreground/80">{f.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>

                <CardFooter className="pt-4">
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                    disabled={!!isCurrentPlan}
                    onClick={() => handleSelect(plan.key)}
                  >
                    {isCurrentPlan ? "Plano Atual" : plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Comparison Table */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-center mb-8">Comparação detalhada</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground w-1/3">Recurso</th>
                  {plans.map((p) => (
                    <th key={p.key} className="text-center py-4 px-4 text-sm font-bold text-foreground">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => (
                  <tr key={f.label} className={`border-b border-border/30 ${i % 2 === 0 ? "bg-card/30" : ""}`}>
                    <td className="py-3 px-4 text-sm text-foreground/80">{f.label}</td>
                    {plans.map((p) => (
                      <td key={p.key} className="py-3 px-4 text-center">
                        <div className="flex justify-center">
                          <FeatureValue value={f[p.key]} />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8">Perguntas Frequentes</h2>
          <div className="space-y-6 text-left">
            {[
              { q: "Posso trocar de plano a qualquer momento?", a: "Sim! Você pode fazer upgrade ou downgrade quando quiser. O valor será ajustado proporcionalmente." },
              { q: "O que acontece quando atinjo o limite de análises?", a: "Você será notificado e poderá fazer upgrade para continuar analisando. Seus dados e histórico permanecem salvos." },
              { q: "Workspaces extras contam no limite?", a: "Sim. O plano Grátis permite 1 workspace, o PRO até 10, e o Premium é ilimitado. Ideal para consultores com múltiplos clientes." },
              { q: "Existe contrato de fidelidade?", a: "Não. Todos os planos são mensais e sem fidelidade. Cancele quando quiser." },
            ].map((faq) => (
              <div key={faq.q} className="p-5 rounded-lg bg-card/60 border border-border/30">
                <h3 className="font-semibold text-foreground mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
