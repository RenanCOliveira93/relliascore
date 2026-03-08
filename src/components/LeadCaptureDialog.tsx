import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileDown, Loader2 } from "lucide-react";
import type { AnalysisResult } from "@/types/analysis";
import { generateAnalysisPdf } from "@/lib/generatePdf";

interface LeadCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: AnalysisResult;
  websiteUrl: string;
  searchQuery: string;
  mode: string;
}

const LeadCaptureDialog = ({
  open,
  onOpenChange,
  result,
  websiteUrl,
  searchQuery,
  mode,
}: LeadCaptureDialogProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha nome e email.",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("leads").insert([{
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        website_url: websiteUrl,
        search_query: searchQuery,
        analysis_mode: mode,
        score: result.score,
        analysis_result: JSON.parse(JSON.stringify(result)),
      }]);

      if (error) throw error;

      // Generate and download PDF
      generateAnalysisPdf(result, websiteUrl, searchQuery, mode);

      toast({
        title: "PDF gerado com sucesso! 📄",
        description: "O download do relatório começou automaticamente.",
      });

      onOpenChange(false);
      setName("");
      setEmail("");
      setPhone("");
    } catch (error) {
      console.error("Lead capture error:", error);
      toast({
        title: "Erro ao enviar",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Exportar Relatório PDF
          </DialogTitle>
          <DialogDescription>
            Preencha seus dados para receber o relatório completo no seu email.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lead-name">Nome *</Label>
            <Input
              id="lead-name"
              placeholder="Seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-email">Email *</Label>
            <Input
              id="lead-email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-phone">Telefone</Label>
            <Input
              id="lead-phone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            {isSubmitting ? "Gerando PDF..." : "Baixar Relatório PDF"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LeadCaptureDialog;
