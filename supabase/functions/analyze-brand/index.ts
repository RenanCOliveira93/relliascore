import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

function getRateLimitKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, RATE_LIMIT_WINDOW_MS);

function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(hostname)) return true;
    if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(hostname)) return true;
    if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;
    if (!['http:', 'https:'].includes(url.protocol)) return true;
    return false;
  } catch {
    return true;
  }
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }
    if (isPrivateUrl(formattedUrl)) return "";
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(formattedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RelliaAnalyzer/1.0)' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const html = await response.text();
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 10000);
  } catch {
    return "";
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = getRateLimitKey(req);
  if (isRateLimited(clientIp)) {
    return new Response(
      JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { website, linkedin, instagram, description, mode = "business" } = await req.json();

    if (!description || typeof description !== 'string' || description.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Descrição é obrigatória (mínimo 10 caracteres)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Erro interno ao processar análise.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch content from provided links
    const contents: string[] = [];
    if (website) {
      const c = await fetchPageContent(website);
      if (c) contents.push(`[SITE] ${c}`);
    }
    if (linkedin) {
      const c = await fetchPageContent(linkedin);
      if (c) contents.push(`[LINKEDIN] ${c}`);
    }
    if (instagram) {
      const c = await fetchPageContent(instagram);
      if (c) contents.push(`[INSTAGRAM] ${c}`);
    }

    const modeLabel = mode === "influencer" ? "Influencer / Marca Pessoal" : "Empresa / Empreendimento";

    const systemPrompt = `Você é um especialista sênior em branding, posicionamento de marca, comunicação digital e análise de presença online. Sua análise deve ser profunda, detalhada e acionável.

Perfil: ${modeLabel}

Analise a marca de forma completa e holística, cobrindo:
- Tom de voz e personalidade da comunicação
- Público-alvo identificado
- Nicho de mercado
- Estilo visual percebido
- Resumo completo da marca
- Palavras-chave que definem a marca
- Cores da marca (extraia das páginas ou sugira com base no posicionamento)
- Temas de conteúdo sugeridos
- Pontos fortes da marca
- Pontos fracos e vulnerabilidades
- Posicionamento no mercado
- Diferencial competitivo
- Consistência da marca (score 0-100)
- Análise da comunicação
- Presença digital
- Recomendações estratégicas

Seja detalhado, específico e fundamentado. Não use frases genéricas.`;

    const userPrompt = `Analise esta marca:

Descrição fornecida:
${description}

${website ? `Site: ${website}` : ''}
${linkedin ? `LinkedIn: ${linkedin}` : ''}
${instagram ? `Instagram: ${instagram}` : ''}

Conteúdo extraído das páginas:
${contents.length > 0 ? contents.join('\n\n') : 'Nenhum conteúdo extraído dos links.'}

Faça a análise completa usando a função fornecida.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "deliver_brand_analysis",
              description: "Deliver the complete brand analysis",
              parameters: {
                type: "object",
                properties: {
                  tom_de_voz: { type: "string", description: "Tom de voz da marca (ex: Profissional, Autoritário, Acessível)" },
                  publico_alvo: { type: "string", description: "Descrição detalhada do público-alvo" },
                  nicho: { type: "string", description: "Nicho de mercado" },
                  estilo_visual: { type: "string", description: "Estilo visual percebido" },
                  resumo_marca: { type: "string", description: "Resumo completo da marca em 3-5 frases" },
                  palavras_chave: { type: "array", items: { type: "string" }, description: "8-12 palavras-chave da marca" },
                  cores_marca: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        hex: { type: "string", description: "Código hex da cor" },
                        nome: { type: "string", description: "Nome descritivo da cor" }
                      },
                      required: ["hex", "nome"]
                    },
                    description: "4-6 cores da marca"
                  },
                  temas_sugeridos: { type: "array", items: { type: "string" }, description: "5-8 temas de conteúdo sugeridos" },
                  pontos_fortes: { type: "array", items: { type: "string" }, description: "Pontos fortes da marca" },
                  pontos_fracos: { type: "array", items: { type: "string" }, description: "Pontos fracos e vulnerabilidades" },
                  posicionamento: { type: "string", description: "Análise do posicionamento no mercado" },
                  diferencial: { type: "string", description: "Diferencial competitivo identificado" },
                  consistencia_score: { type: "number", description: "Score de consistência da marca (0-100)" },
                  comunicacao_analise: { type: "string", description: "Análise detalhada da comunicação" },
                  presenca_digital: { type: "string", description: "Análise da presença digital" },
                  recomendacoes: { type: "array", items: { type: "string" }, description: "5-8 recomendações estratégicas" }
                },
                required: ["tom_de_voz", "publico_alvo", "nicho", "estilo_visual", "resumo_marca", "palavras_chave", "cores_marca", "temas_sugeridos", "pontos_fortes", "pontos_fracos", "posicionamento", "diferencial", "consistencia_score", "comunicacao_analise", "presenca_digital", "recomendacoes"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "deliver_brand_analysis" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erro ao processar análise");
    }

    const aiResponse = await response.json();

    let result;
    try {
      const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        result = typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
    }

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Não foi possível processar a análise da marca.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in analyze-brand:", error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar análise.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
