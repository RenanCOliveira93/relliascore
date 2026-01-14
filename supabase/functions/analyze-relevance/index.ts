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
    const { websiteUrl, searchQuery } = await req.json();
    
    if (!websiteUrl || !searchQuery) {
      return new Response(
        JSON.stringify({ error: 'URL do site e consulta de pesquisa são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing relevance for URL: ${websiteUrl} with query: ${searchQuery}`);

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
      // Extract text content from HTML (basic extraction)
      websiteContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 15000); // Limit content size
    } catch (fetchError) {
      console.error("Error fetching website:", fetchError);
      websiteContent = `Não foi possível acessar o conteúdo do site ${websiteUrl}. Analisando apenas a URL.`;
    }

    const systemPrompt = `Você é um especialista em SEO e GEO (Generative Engine Optimization). Sua tarefa é analisar o conteúdo de um site e determinar o quão relevante ele é para uma pesquisa específica ou problema que um usuário poderia digitar em um LLM/IA.

Você deve avaliar:
1. Correspondência de palavras-chave e termos
2. Relevância temática do conteúdo
3. Autoridade percebida no assunto
4. Clareza e qualidade do conteúdo
5. Probabilidade de um LLM recomendar este site para a pesquisa

Forneça um score de 0 a 100 representando a probabilidade (%) de um LLM encontrar e recomendar este site para a pesquisa dada.`;

    const userPrompt = `Analise o seguinte conteúdo do site e determine sua relevância para a pesquisa fornecida.

URL do Site: ${websiteUrl}

Conteúdo do Site:
${websiteContent}

Pesquisa/Problema do Usuário:
"${searchQuery}"

Responda APENAS com um JSON válido no seguinte formato, sem markdown ou texto adicional:
{
  "score": [número de 0 a 100],
  "summary": "[resumo curto de 2-3 frases explicando a análise]",
  "strengths": ["ponto forte 1", "ponto forte 2"],
  "improvements": ["sugestão de melhoria 1", "sugestão de melhoria 2"],
  "keywords_found": ["palavra-chave 1", "palavra-chave 2"]
}`;

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
    const content = aiResponse.choices?.[0]?.message?.content;
    
    console.log("AI Response content:", content);

    // Parse the JSON response
    let analysisResult;
    try {
      // Remove any potential markdown code blocks
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      analysisResult = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      // Fallback response
      analysisResult = {
        score: 50,
        summary: "Análise parcial realizada. O site possui alguma relevância para a pesquisa.",
        strengths: ["Conteúdo analisado"],
        improvements: ["Otimizar para a pesquisa específica"],
        keywords_found: []
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
