import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { websiteUrl, searchQuery, mode = "business" } = await req.json();
    
    if (!websiteUrl || !searchQuery) {
      return new Response(
        JSON.stringify({ error: 'URL do site e consulta de pesquisa são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing relevance for URL: ${websiteUrl} with query: ${searchQuery}, mode: ${mode}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch website content
    let websiteContent = "";
    try {
      const response = await fetch(websiteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LLMScoreAnalyzer/1.0)'
        }
      });
      const html = await response.text();
      websiteContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 15000);
    } catch (fetchError) {
      console.error("Error fetching website:", fetchError);
      websiteContent = `Não foi possível acessar o conteúdo do site ${websiteUrl}. Analisando apenas a URL.`;
    }

    const modeContext = mode === "influencer"
      ? `O contexto é de um INFLUENCER / MARCA PESSOAL. Foque em: autoridade pessoal, presença digital, tom de voz autêntico, engajamento percebido, conexão com a audiência, storytelling, prova social e posicionamento como referência no nicho.`
      : `O contexto é de uma EMPRESA / EMPREENDIMENTO. Foque em: SEO técnico, autoridade de domínio, proposta de valor clara, conversão, competitividade no mercado, credibilidade institucional e otimização para buscas comerciais.`;

    const systemPrompt = `Você é um especialista em SEO, GEO (Generative Engine Optimization) e análise de conteúdo digital. ${modeContext}

Sua tarefa é fazer uma análise COMPLETA e DETALHADA do conteúdo de um site em relação a uma pesquisa específica que um usuário faria em um LLM/IA.`;

    const userPrompt = `Analise o seguinte conteúdo do site e determine sua relevância para a pesquisa fornecida.

URL do Site: ${websiteUrl}
Modo de Análise: ${mode === "influencer" ? "Influencer / Marca Pessoal" : "Empresa / Empreendimento"}

Conteúdo do Site:
${websiteContent}

Pesquisa/Problema do Usuário:
"${searchQuery}"

Faça uma análise completa usando a função fornecida.`;

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
                      conteudo_atual: { type: "string", description: "Resumo do que a página comunica atualmente" },
                      conteudo_ideal: { type: "string", description: "O que a página deveria comunicar para a pesquisa" },
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
                  }
                },
                required: ["score", "summary", "strengths", "improvements", "sub_scores", "compatibility_diagnostic", "action_plan", "keywords_analysis"],
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

    // Extract from tool call
    let analysisResult;
    try {
      const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        analysisResult = typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      } else {
        // Fallback: try content
        const content = aiResponse.choices?.[0]?.message?.content;
        if (content) {
          const clean = content.replace(/```json\n?|\n?```/g, '').trim();
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
        keywords_analysis: { found: [], missing: [], suggested: [] }
      };
    }

    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in analyze-relevance:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
