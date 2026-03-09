

# Plano: Adicionar modo "Texto" como fonte de analise

## Resumo

Adicionar um seletor "Webpage" vs "Texto" no formulario. Quando "Webpage" esta selecionado, tudo funciona como hoje. Quando "Texto" esta selecionado, o campo de URL e substituido por um textarea para o usuario colar o texto que pretende publicar. A edge function recebe o texto diretamente (sem fetch) e ajusta o prompt para analisar conteudo pre-publicacao, incluindo exemplos de como seria um texto ideal (proximo a 100%).

## Alteracoes

### 1. Tipos (`src/types/analysis.ts`)
- Adicionar `InputType = "webpage" | "text"`
- Adicionar campo opcional `ideal_example: string` no `AnalysisResult` para conter o exemplo de texto ideal

### 2. Formulario (`src/pages/Index.tsx`)
- Novo state `inputType: "webpage" | "text"` (default: "webpage")
- Renderizar seletor (tabs ou toggle) abaixo do `AnalysisModeTabs` com opcoes "Webpage" e "Texto"
- Condicional: se `webpage`, mostra campo URL; se `text`, mostra textarea grande para colar o texto
- Enviar para a edge function: `inputType`, e `content` (texto direto) ou `websiteUrl` conforme o caso
- Validacao ajustada: exigir URL ou texto conforme o modo

### 3. Edge Function (`supabase/functions/analyze-relevance/index.ts`)
- Aceitar novo parametro `inputType` e `content` (texto direto)
- Se `inputType === "text"`: pular fetch de URL, usar `content` diretamente
- Ajustar prompt para contexto pre-publicacao: "Este texto ainda nao foi publicado. Analise como se fosse ser postado. Alem da analise padrao, forneça um exemplo de como seria um texto ideal (score proximo a 100%) baseado no conteudo fornecido."
- Adicionar `ideal_example` ao schema do tool calling (string com o texto modelo)
- Se `inputType === "webpage"`: manter comportamento atual, tambem adicionar `ideal_example` com exemplo de conteudo ideal para a pagina

### 4. Resultados (`src/components/ScoreDisplay.tsx`)
- Adicionar seção ou tab para exibir o `ideal_example` quando presente -- um card "Exemplo Ideal" com o texto modelo formatado

### 5. PDF (`src/lib/generatePdf.ts`)
- Incluir seção "Exemplo Ideal" no PDF quando `ideal_example` estiver presente

### 6. Lead Capture (`src/components/LeadCaptureDialog.tsx`)
- Passar `inputType` para contexto (minor -- apenas para o PDF saber se era texto ou webpage)

## Fluxo do usuario

```text
[Perfil: Influencer/Empresa]
         |
[Fonte: Webpage | Texto]   <-- NOVO
         |
   ┌─────┴─────┐
   |            |
[URL field] [Textarea]
   |            |
[Pesquisa/Problema]
   |
[Analisar]
   |
[Resultados + Exemplo Ideal]
```

