

# Plano de Melhorias -- LLM Score

## Visao Geral

Transformar a ferramenta de um simples "score" em uma plataforma de diagnostico completa com dois modos de uso, resultados ricos e plano de acao.

---

## 1. Dois Modos de Analise (Tabs na Home)

Adicionar tabs no formulario para o usuario escolher seu perfil:

- **Influencer / Marca Pessoal** -- foco em autoridade pessoal, presenca digital, tom de voz, engajamento percebido
- **Empresa / Empreendimento** -- foco em SEO tecnico, autoridade de dominio, conversao, competitividade

Cada modo ajusta o prompt da LLM para gerar insights especificos ao contexto.

## 2. Resultado Expandido (Nova Estrutura de Dados)

O retorno da analise passa a incluir:

```text
score (geral)
sub_scores:
  - relevancia_tematica (0-100)
  - qualidade_conteudo (0-100)  
  - autoridade_percebida (0-100)
  - otimizacao_llm (0-100)
  - clareza_proposta_valor (0-100)

compatibility_diagnostic:
  - conteudo_atual (resumo do que a pagina comunica)
  - conteudo_ideal (o que deveria comunicar para a pesquisa)
  - gap_analysis (lista de lacunas entre atual vs ideal)
  - compatibility_percentage (%)

action_plan:
  - priority: alta/media/baixa
  - action: texto descritivo
  - impact: estimativa de impacto no score
  - category: "conteudo" | "tecnico" | "autoridade" | "estrutura"

competitors_comparison:
  - ideal_benchmark (como seria um site 100% otimizado)
  - missing_elements (o que falta vs o benchmark)

keywords_analysis:
  - found: [palavras presentes]
  - missing: [palavras que deveriam estar]
  - suggested: [palavras recomendadas]
```

## 3. Interface de Resultados (Tabs/Seções)

A tela de resultado sera dividida em seções navegaveis:

- **Score Geral** -- score animado + sub-scores em grafico radar (recharts)
- **Diagnostico** -- comparacao "conteudo atual vs ideal" lado a lado, com gap analysis
- **Plano de Acao** -- lista priorizada de acoes com impacto estimado, agrupadas por categoria
- **Palavras-chave** -- encontradas, ausentes e sugeridas com badges coloridas
- **Pontos Fortes e Fracos** -- cards com icones, ja existente mas expandido

## 4. Alteracoes Tecnicas

### Edge Function (`analyze-relevance/index.ts`)
- Receber parametro `mode: "influencer" | "business"` 
- Expandir o prompt para solicitar toda a estrutura de dados acima
- Usar tool calling para garantir JSON estruturado

### Novos Componentes
- `AnalysisModeTabs` -- seletor de modo influencer/empresa
- `SubScoresRadar` -- grafico radar com recharts para sub-scores
- `CompatibilityDiagnostic` -- comparacao atual vs ideal
- `ActionPlan` -- lista priorizada de acoes
- `KeywordAnalysis` -- palavras encontradas/ausentes/sugeridas
- Refatorar `ScoreDisplay` para orquestrar as novas seções

### Pagina Index
- Adicionar tabs de modo no formulario
- Passar modo para a edge function
- Exibir resultados com as novas seções

## 5. Sem Banco de Dados

Tudo continua client-side, sem persistencia. A analise e feita por chamada e exibida na tela.

---

## Resumo de Entregas

| Item | Descricao |
|------|-----------|
| Modos | Influencer vs Empresa com prompts distintos |
| Sub-scores | 5 dimensoes em grafico radar |
| Diagnostico | Atual vs Ideal + gap analysis |
| Plano de Acao | Acoes priorizadas com impacto |
| Keywords | Encontradas, ausentes e sugeridas |
| UI | Seções navegaveis nos resultados |

