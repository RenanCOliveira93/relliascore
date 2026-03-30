

# Plano: Workspaces para Consultores + Melhorias Estrategicas

## Conceito

Transformar o RELLIA em uma plataforma multi-cliente para consultores. Cada usuario pode criar **Espacos** (workspaces), onde cada espaco representa um cliente. Historicos, analises e dados ficam isolados por espaco. Usuarios que nao sao consultores usam um espaco padrao automatico.

---

## 1. Workspaces (Espaços)

### Banco de dados

```text
workspaces
  id uuid PK
  user_id uuid (owner)
  name text ("Minha Empresa" ou "Cliente X")
  logo_url text (opcional)
  created_at timestamptz

brand_analyses
  + workspace_id uuid FK → workspaces.id  (nova coluna)
```

- Ao criar conta, um workspace padrao "Meu Espaco" e criado automaticamente
- Consultor pode criar N workspaces, um por cliente
- Todas as analises (relevancia e marca) ficam vinculadas ao workspace ativo
- RLS garante que so o dono acessa seus workspaces e analises

### UI

- Sidebar ou dropdown no header para trocar de espaco ativo
- Pagina de gerenciamento de espacos: criar, renomear, excluir
- Badge com nome do espaco ativo visivel em todas as telas
- Historico filtrado automaticamente pelo espaco selecionado

---

## 2. Melhorias Adicionais Sugeridas

### 2a. Dashboard por Workspace
- Visao geral do cliente: ultimo score de relevancia, score de marca, evolucao ao longo do tempo
- Mini-cards com metricas resumidas
- Grafico de evolucao dos scores (linha temporal)

### 2b. Comparativo Entre Analises
- Dentro de um workspace, comparar 2 analises lado a lado
- Mostrar evolucao: "Score subiu de 45 para 72" com destaque visual
- Util para consultor mostrar progresso ao cliente

### 2c. Notas e Anotacoes por Workspace
- Campo de notas livres por workspace (o consultor anota observacoes sobre o cliente)
- Notas vinculadas a analises especificas ("nesta analise notei que...")

### 2d. Relatorio Consolidado para Cliente
- PDF/relatorio que agrupa varias analises de um workspace
- Ideal para o consultor entregar ao cliente como deliverable
- Inclui evolucao, recomendacoes acumuladas, progresso

### 2e. Tags e Status por Workspace
- Tags customizaveis: "Em andamento", "Concluido", "Aguardando cliente"
- Filtros no painel de espacos

---

## 3. Alteracoes Tecnicas

### Database (migrations)
1. Criar tabela `workspaces` com RLS (user_id = auth.uid())
2. Adicionar coluna `workspace_id` em `brand_analyses` (nullable inicialmente, depois migrar dados existentes para workspace padrao)
3. Criar tabela `workspace_notes` (id, workspace_id, content, created_at)
4. Trigger: ao criar profile, criar workspace padrao automaticamente

### Frontend
| Arquivo | Mudanca |
|---------|---------|
| Novo: `src/hooks/useWorkspace.tsx` | Context provider com workspace ativo, lista de workspaces, CRUD |
| Novo: `src/components/WorkspaceSwitcher.tsx` | Dropdown no header para trocar workspace |
| Novo: `src/pages/Workspaces.tsx` | Gerenciamento de espacos |
| Novo: `src/components/WorkspaceDashboard.tsx` | Dashboard resumo do workspace |
| `src/pages/Index.tsx` | Filtrar historico por workspace_id, passar workspace_id nas insercoes |
| `src/components/BrandAnalysisHistory.tsx` | Filtrar por workspace_id |
| `src/App.tsx` | Adicionar rota `/workspaces`, envolver com WorkspaceProvider |

### Fluxo

```text
[Login] → [/home]
              |
    ┌─────────┴──────────┐
    |                     |
[Workspace Switcher]   [Analises]
    |                     |
[Criar/Trocar]      [Filtrado por workspace]
    |
[Dashboard do Workspace]
    |
[Historico + Notas + Comparativo]
```

---

## 4. Prioridade de Implementacao

| Fase | Item | Impacto |
|------|------|---------|
| 1 | Tabela workspaces + workspace padrao | Base de tudo |
| 2 | Workspace switcher no header | UX principal |
| 3 | Vincular analises ao workspace | Isolamento de dados |
| 4 | Dashboard por workspace | Valor para consultor |
| 5 | Notas por workspace | Organizacao |
| 6 | Comparativo entre analises | Demonstrar progresso |
| 7 | Relatorio consolidado PDF | Deliverable profissional |

Sugiro implementar as fases 1-3 primeiro (estrutura base) e depois iterar nas fases 4-7.

