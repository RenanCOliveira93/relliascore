

# Automações com n8n para o RELLIA

Ótima pergunta. O n8n pode transformar o RELLIA de uma ferramenta de diagnóstico pontual em uma **plataforma de monitoramento e ação contínua**. Abaixo, ideias organizadas por valor estratégico para consultores e empresas.

---

## 1. Monitoramento Recorrente (alto valor para consultores)

**Re-análise automática agendada**
- Workflow n8n roda semanalmente/mensalmente para cada cliente (workspace).
- Dispara a edge function `analyze-relevance` ou `analyze-brand` automaticamente.
- Salva resultado no histórico → consultor abre na segunda-feira e já tem dados frescos.

**Alerta de queda de score**
- n8n compara score atual vs anterior.
- Se cair X pontos → envia alerta no Slack/Email/WhatsApp do consultor.
- Permite agir antes do cliente perceber.

---

## 2. Notificações Multi-canal

**Relatórios automáticos para clientes**
- Toda segunda-feira, n8n gera o PDF consolidado do workspace e envia por email ao cliente final.
- Template white-label com logo do consultor.

**Integrações de aviso**
- Análise concluída → notificação no Slack/Discord/Telegram da equipe.
- Score crítico (<40) → email urgente para o gestor.

---

## 3. Captação e Onboarding (geração de leads)

**Análise gratuita via formulário externo**
- Landing page externa (Typeform, Tally) → n8n recebe webhook → chama edge function → envia PDF de análise por email.
- Lead entra automaticamente no CRM (HubSpot, Pipedrive).

**Trigger via redes sociais**
- Menção no LinkedIn/Twitter da marca do consultor → n8n captura → roda análise da empresa que mencionou → envia relatório personalizado como abordagem comercial.

---

## 4. Integração com CRM e Vendas

**Sync com HubSpot/Pipedrive**
- Cada workspace (cliente) vira um deal/contato no CRM.
- Score atualizado vira propriedade do contato.
- Permite segmentar campanhas por nível de maturidade do cliente.

**Follow-up automático pós-análise**
- Análise concluída → n8n agenda email de follow-up em D+3, D+7, D+15 com dicas baseadas no score.

---

## 5. Conteúdo e Action Plan Automatizado

**Plano de ação → tarefas no Trello/Notion/ClickUp**
- Os itens do "Action Plan" gerado pela IA viram tickets automaticamente no board do cliente.
- Consultor entrega valor sem digitar nada.

**Geração de conteúdo otimizado**
- Após análise, n8n usa as palavras-chave ausentes + LLM (OpenAI/Gemini) para gerar rascunhos de artigos otimizados.
- Salva em Google Docs / Notion do cliente.

---

## 6. Comparativo Competitivo

**Análise de concorrentes em lote**
- Consultor cadastra 5 URLs de concorrentes do cliente.
- n8n roda análise de todos semanalmente.
- Gera ranking comparativo automático em planilha (Google Sheets).

---

## 7. Webhooks Reversos (RELLIA → n8n)

**Necessário implementar no RELLIA:**
- Webhook configurável por workspace que dispara a cada análise concluída.
- Payload com: score, sub-scores, plano de ação, workspace_id.
- Permite ao usuário criar **qualquer** automação no n8n a partir desse evento.

---

## Como Implementar (próximos passos sugeridos)

| Prioridade | Funcionalidade no RELLIA | Esforço |
|---|---|---|
| 1 | **Endpoint API público** (com API key por workspace) para disparar análises via n8n | Médio |
| 2 | **Webhooks de saída** configuráveis por workspace (URL + evento) | Médio |
| 3 | **Agendamento nativo** de re-análises (cron) — alternativa sem n8n | Baixo |
| 4 | **Template oficial n8n** publicado na biblioteca deles ("RELLIA Monitor") | Baixo |
| 5 | Integração nativa com **HubSpot/Slack** via connectors Lovable | Baixo |

---

## Recomendação

Comece pelos itens **1 e 2** (API pública + webhooks). Eles destravam **todas** as automações acima sem o RELLIA precisar implementar cada integração individualmente — o n8n (ou Zapier/Make) faz o resto. É o caminho de maior alavancagem.

Posso implementar a infraestrutura de **API pública com API keys por workspace + webhooks de saída**, que é a base para todas essas automações?

