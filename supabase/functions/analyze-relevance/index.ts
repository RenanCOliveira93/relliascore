import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiter (per edge function instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per IP per window

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

// Periodically clean up expired entries to prevent memory leaks
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIp = getRateLimitKey(req);
  if (isRateLimited(clientIp)) {
    return new Response(
      JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { websiteUrl, searchQuery, mode = "business", inputType = "webpage", content } = await req.json();

    // Input validation
    if (inputType !== "webpage" && inputType !== "text") {
      return new Response(
        JSON.stringify({ error: 'Tipo de entrada inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (inputType === "webpage" && !websiteUrl) {
      return new Response(
        JSON.stringify({ error: 'URL do site é obrigatória para análise de webpage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (inputType === "text" && !content) {
      return new Response(
        JSON.stringify({ error: 'Texto é obrigatório para análise de texto' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Consulta de pesquisa inválida (máximo 2000 caracteres)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (inputType === "text" && (typeof content !== 'string' || content.length > 50000)) {
      return new Response(
        JSON.stringify({ error: 'Texto inválido (máximo 50000 caracteres)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SSRF protection for webpage mode
    if (inputType === "webpage") {
      let formattedUrl = websiteUrl;
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl;
      }
      if (isPrivateUrl(formattedUrl)) {
        return new Response(
          JSON.stringify({ error: 'URL não permitida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Analyzing relevance - inputType: ${inputType}, mode: ${mode}, query length: ${searchQuery.length}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: 'Erro interno ao processar análise.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get content based on input type
    let analysisContent = "";
    let sourceLabel = "";

    if (inputType === "text") {
      analysisContent = content.substring(0, 15000);
      sourceLabel = "Texto fornecido pelo usuário (pré-publicação)";
    } else {
      sourceLabel = `URL: ${websiteUrl}`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(websiteUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LLMScoreAnalyzer/1.0)' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const html = await response.text();
        analysisContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 15000);
      } catch (fetchError) {
        console.error("Error fetching website:", fetchError);
        analysisContent = `Não foi possível acessar o conteúdo do site ${websiteUrl}. Analisando apenas a URL.`;
      }
    }

    const modeContext = mode === "influencer"
      ? `O contexto é de um INFLUENCER / MARCA PESSOAL. Foque em: autoridade pessoal, presença digital, tom de voz autêntico, engajamento percebido, conexão com a audiência, storytelling, prova social e posicionamento como referência no nicho.`
      : `O contexto é de uma EMPRESA / EMPREENDIMENTO. Foque em: SEO técnico, autoridade de domínio, proposta de valor clara, conversão, competitividade no mercado, credibilidade institucional e otimização para buscas comerciais.`;

    const textContext = inputType === "text"
      ? `IMPORTANTE: Este texto ainda NÃO foi publicado. O usuário está analisando o conteúdo ANTES de publicar. Analise como se fosse ser postado. Além da análise padrão, forneça um exemplo completo de como seria um texto ideal (score próximo a 100%) baseado no conteúdo fornecido. O exemplo ideal deve ser um texto pronto para publicação, mantendo a essência do original mas otimizado para máxima relevância.`
      : `Além da análise padrão, forneça um exemplo de conteúdo ideal (score próximo a 100%) que a página deveria ter para ser perfeitamente relevante para a pesquisa.`;

    const systemPrompt = `Você é um especialista em SEO, GEO (Generative Engine Optimization) e análise de conteúdo digital. ${modeContext}

${textContext}

Sua tarefa é fazer uma análise COMPLETA e DETALHADA do conteúdo em relação a uma pesquisa específica que um usuário faria em um LLM/IA.`;

    const userPrompt = `Analise o seguinte conteúdo e determine sua relevância para a pesquisa fornecida.

Fonte: ${sourceLabel}
Tipo de Entrada: ${inputType === "text" ? "Texto pré-publicação" : "Webpage publicada"}
Modo de Análise: ${mode === "influencer" ? "Influencer / Marca Pessoal" : "Empresa / Empreendimento"}

Conteúdo:
${analysisContent}

Pesquisa/Problema do Usuário:
"${searchQuery}"

Faça uma análise completa usando a função fornecida. Inclua obrigatoriamente o campo ideal_example com um exemplo detalhado de conteúdo otimizado.`;

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
              name: "deliver_analysis",
              description: "Deliver the complete analysis result with all dimensions",
              parameters: {
                type: "object",
                properties: {
                  score: { type: "number", description: "Score geral de 0 a 100" },
                  summary: { type: "string", description: "Resumo de 2-3 frases da análise" },
                  strengths: { type: "array", items: { type: "string" }, description: "Lista de pontos fortes" },
                  improvements: { type: "array", items: { type: "string" }, description: "Lista de sugestões de melhoria" },
                  sub_scores: {
                    type: "object",
                    properties: {
                      relevancia_tematica: { type: "number" },
                      qualidade_conteudo: { type: "number" },
                      autoridade_percebida: { type: "number" },
                      otimizacao_llm: { type: "number" },
                      clareza_proposta_valor: { type: "number" }
                    },
                    required: ["relevancia_tematica", "qualidade_conteudo", "autoridade_percebida", "otimizacao_llm", "clareza_proposta_valor"]
                  },
                  compatibility_diagnostic: {
                    type: "object",
                    properties: {
                      conteudo_atual: { type: "string", description: "Resumo do que o conteúdo comunica atualmente" },
                      conteudo_ideal: { type: "string", description: "O que o conteúdo deveria comunicar para a pesquisa" },
                      gap_analysis: { type: "array", items: { type: "string" }, description: "Lista de lacunas entre atual e ideal" },
                      compatibility_percentage: { type: "number" }
                    },
                    required: ["conteudo_atual", "conteudo_ideal", "gap_analysis", "compatibility_percentage"]
                  },
                  action_plan: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        priority: { type: "string", enum: ["alta", "media", "baixa"] },
                        action: { type: "string" },
                        impact: { type: "string" },
                        category: { type: "string", enum: ["conteudo", "tecnico", "autoridade", "estrutura"] }
                      },
                      required: ["priority", "action", "impact", "category"]
                    }
                  },
                  keywords_analysis: {
                    type: "object",
                    properties: {
                      found: { type: "array", items: { type: "string" } },
                      missing: { type: "array", items: { type: "string" } },
                      suggested: { type: "array", items: { type: "string" } }
                    },
                    required: ["found", "missing", "suggested"]
                  },
                  ideal_example: { type: "string", description: "Exemplo completo de conteúdo otimizado que alcançaria score próximo a 100%. Deve ser um texto detalhado e pronto para uso, baseado no conteúdo analisado." }
                },
                required: ["score", "summary", "strengths", "improvements", "sub_scores", "compatibility_diagnostic", "action_plan", "keywords_analysis", "ideal_example"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "deliver_analysis" } }
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
          JSON.stringify({ error: "Créditos insuficientes. Por favor, adicione créditos à sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erro ao processar análise");
    }

    const aiResponse = await response.json();
    console.log("AI Response:", JSON.stringify(aiResponse));

    let analysisResult;
    try {
      const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        analysisResult = typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      } else {
        const contentStr = aiResponse.choices?.[0]?.message?.content;
        if (contentStr) {
          const clean = contentStr.replace(/```json\n?|\n?```/g, '').trim();
          analysisResult = JSON.parse(clean);
        }
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
    }

    if (!analysisResult) {
      analysisResult = {
        score: 50,
        summary: "Análise parcial realizada.",
        strengths: ["Conteúdo analisado"],
        improvements: ["Otimizar para a pesquisa específica"],
        sub_scores: { relevancia_tematica: 50, qualidade_conteudo: 50, autoridade_percebida: 50, otimizacao_llm: 50, clareza_proposta_valor: 50 },
        compatibility_diagnostic: { conteudo_atual: "Não foi possível determinar.", conteudo_ideal: "Não foi possível determinar.", gap_analysis: [], compatibility_percentage: 50 },
        action_plan: [],
        keywords_analysis: { found: [], missing: [], suggested: [] },
        ideal_example: ""
      };
    }

    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in analyze-relevance:", error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar análise.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
