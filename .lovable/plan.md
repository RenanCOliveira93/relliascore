

# Plano: Landing Page + Autenticacao + Area de Membros

## Resumo

Mover a ferramenta atual para `/home` (rota protegida), criar uma landing page de alta conversao em `/`, implementar autenticacao com email/senha, e remover o dialog de captura de lead do PDF (download direto).

## Alteracoes

### 1. Database: tabela `profiles`
- Criar tabela `profiles` (id uuid PK referenciando auth.users, name, avatar_url, created_at)
- Trigger para auto-criar profile no signup
- RLS: usuarios leem/atualizam apenas seu proprio perfil

### 2. Autenticacao
- Criar `src/pages/Auth.tsx` com formulario de login/cadastro (email + senha)
- Background com video ou animacao similar ao VideoBackground, visual profissional
- Tabs para alternar entre Login e Cadastro
- Campos: nome (apenas no cadastro), email, senha
- Redirect para `/home` apos login

### 3. Rotas e protecao
- `src/App.tsx`: reorganizar rotas
  - `/` → nova Landing Page
  - `/auth` → pagina de autenticacao
  - `/home` → ferramenta atual (protegida)
- Criar componente `ProtectedRoute` que redireciona para `/auth` se nao autenticado
- Auth context/hook para gerenciar sessao

### 4. Landing Page (`src/pages/Landing.tsx`)
- Hero section: titulo impactante sobre otimizacao para IA, com gradientes e animacoes
- Video background reutilizando o componente existente
- Secao de beneficios com icones (3-4 cards)
- Secao "Como funciona" em 3 passos
- Secao de preview/mockup mostrando a interface da ferramenta
- Secao de prova social / numeros
- CTA final com botao "Comecar Agora" → `/auth`
- Footer com links

### 5. Remover LeadCaptureDialog do fluxo PDF
- Em `src/pages/Index.tsx` (que vira `/home`): o botao "Exportar PDF" chama `generateAnalysisPdf` diretamente, sem abrir dialog
- Manter o componente `LeadCaptureDialog` pode ser removido ou mantido para uso futuro

### 6. Arquivos novos/modificados

| Arquivo | Acao |
|---|---|
| `src/pages/Landing.tsx` | Criar - landing page completa |
| `src/pages/Auth.tsx` | Criar - tela de login/cadastro |
| `src/components/ProtectedRoute.tsx` | Criar - wrapper de rota protegida |
| `src/hooks/useAuth.tsx` | Criar - hook de autenticacao |
| `src/pages/Index.tsx` | Mover logica para rota `/home`, remover lead dialog do PDF |
| `src/App.tsx` | Atualizar rotas |
| Migration SQL | Criar tabela profiles + trigger |

### 7. Fluxo do usuario

```text
[/] Landing Page
    |
    v
[CTA "Comecar"] --> [/auth] Login/Cadastro
                        |
                        v (autenticado)
                    [/home] Ferramenta LLM Score
                        |
                    [Exportar PDF] --> download direto (sem dialog)
```

