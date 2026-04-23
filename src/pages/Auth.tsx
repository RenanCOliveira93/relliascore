import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Loader2, Eye, EyeOff, MailCheck, ArrowLeft, KeyRound } from "lucide-react";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signupSuccessEmail, setSignupSuccessEmail] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  // Only auto-redirect to /home for already-authenticated users (login)
  // Not after signup, since signup requires email confirmation.
  useEffect(() => {
    if (user && !signupSuccessEmail) navigate("/home", { replace: true });
  }, [user, navigate, signupSuccessEmail]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      toast({ title: "Bem-vindo de volta! 🎉" });
      navigate("/home");
    } catch (error: any) {
      toast({ title: "Erro no login", description: error.message === "Invalid login credentials" ? "Email ou senha incorretos." : error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Senha fraca", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) throw error;
      setSignupSuccessEmail(email.trim());
    } catch (error: any) {
      toast({ title: "Erro no cadastro", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      {/* Dynamic background */}
      <div className="fixed inset-0 z-0">
        <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover">
          <source src="https://cdn.pixabay.com/video/2020/05/25/40130-424930032_large.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <span className="text-2xl font-bold">RELLIA</span>
          </div>
          <p className="text-muted-foreground text-sm">Acesse sua área de diagnóstico</p>
        </div>

        {signupSuccessEmail ? (
          // ====== Highly visible email confirmation screen ======
          <Card className="backdrop-blur-xl bg-card/90 border-2 border-primary/40 shadow-2xl shadow-primary/20 animate-fade-in">
            <CardContent className="pt-8 pb-6 text-center space-y-5">
              <div className="mx-auto h-20 w-20 rounded-full bg-primary/15 border-2 border-primary/40 flex items-center justify-center animate-pulse">
                <MailCheck className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">
                  Confirme seu e-mail 📧
                </h2>
                <p className="text-base text-foreground/90 leading-relaxed">
                  Enviamos um <span className="font-semibold text-primary">link de confirmação</span> para:
                </p>
                <div className="px-4 py-3 rounded-lg bg-primary/10 border border-primary/30">
                  <p className="font-mono text-sm font-semibold text-primary break-all">
                    {signupSuccessEmail}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground pt-2">
                  Clique no link enviado para ativar sua conta. Verifique a caixa de spam se não encontrar.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSignupSuccessEmail(null);
                  setName("");
                  setEmail("");
                  setPassword("");
                }}
                className="w-full gap-2 mt-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para o login
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="backdrop-blur-xl bg-card/70 border-border/50 shadow-2xl">
            <Tabs defaultValue="login">
              <CardHeader className="pb-4">
                <TabsList className="w-full">
                  <TabsTrigger value="login" className="flex-1">Entrar</TabsTrigger>
                  <TabsTrigger value="signup" className="flex-1">Criar Conta</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="login" className="mt-0">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input id="login-email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="bg-input/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Senha</Label>
                      <div className="relative">
                        <Input id="login-password" type={showPassword ? "text" : "password"} placeholder="Sua senha" value={password} onChange={e => setPassword(e.target.value)} required className="bg-input/50 pr-10" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="text-right -mt-2">
                      <button
                        type="button"
                        onClick={() => { setForgotEmail(email); setForgotSent(false); setForgotOpen(true); }}
                        className="text-xs text-primary hover:underline"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>
                    <Button type="submit" className="w-full h-11" disabled={isLoading}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Entrar
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-0">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Nome</Label>
                      <Input id="signup-name" placeholder="Seu nome completo" value={name} onChange={e => setName(e.target.value)} required className="bg-input/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input id="signup-email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="bg-input/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Senha</Label>
                      <div className="relative">
                        <Input id="signup-password" type={showPassword ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="bg-input/50 pr-10" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-11" disabled={isLoading}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Criar Conta
                    </Button>
                  </form>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade.
        </p>
      </div>
    </div>
  );
};

export default Auth;
