# Raiz Ancestral V12.8 — Verificação de ofertas a cada seis horas

## Visão geral
- Um **Cloudflare Worker** separado, com Cron Trigger `0 */6 * * *` (UTC), chama exclusivamente o endpoint privado `POST /api/cron-garimpo`.
- Horários no Brasil (UTC-3): **03h, 09h, 15h, 21h**.
- Endpoint exige token `RAIZ_GARIMPO_CRON_TOKEN` com valor idêntico no Worker e na configuração de produção do Pages. **Nunca colocar o token no GitHub ou navegador.**
- Endpoint utiliza `SHOPEE_APP_ID`, `SHOPEE_APP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_URL`, disponíveis como variáveis de produção exclusivamente no Pages.
- Até quatro temas fixos por ciclo: chá de camomila, infusor para chá, sementes para horta e chá de hibisco. Não há consulta descontrolada.
- As ofertas são consultadas na API de afiliados da Shopee. **São sugestões, não descontos promocionais comprovados.**
- Não envia WhatsApp nem SMS. O ADM exibe o último ciclo, erros, oportunidades novas e quedas de preços observadas, além do botão para marcar alertas como vistos.
- Nenhum produto é ativado, editado ou publicado automaticamente. O administrador aprova ou descarta.
- `raiz_garimpo_execucoes` registra horários, quantidade de consultas, itens encontrados, novos, atualizados e falhas.
- `raiz_oportunidades` registra `detectado_automaticamente` e `visto_em` sem eliminar oportunidades antigas; cada anúncio tem chave única `(origem,item_externo)`.
- O monitor do ADM permanece protegido por JWT + `is_raiz_admin` + RLS.

## Publicação
1. Aplicar `supabase/migrations/20261122_raiz_garimpo_6h.sql` (já realizado).
2. Implantar o código do Pages, verificar produção e variáveis de ambiente existentes.
3. Criar Worker `raiz-ancestral-garimpo-6h` usando `workers/raiz-garimpo-cron/index.js`.
4. Gerar token forte aleatório, gravá-lo como segredo em **ambos** Pages produção e Worker. Nunca publicar o segredo.
5. Configurar Cron Trigger `0 */6 * * *` apenas após confirmar ambos os segredos.
6. Confirmar status do agendamento, do último deploy e os dados no histórico protegido.
7. Monitorar o histórico no ADM após a primeira execução. Sem simular uma oferta real ou marcar sucesso na ausência de execução.

## Restrições
- O Worker precisa de permissão para executar agendamentos e o Pages precisa aceitar alterações de variáveis.
- A API da Shopee pode devolver erros, limites ou sugestões sem link afiliado. Em caso de falha o monitor mostrará o erro e os cadastros existentes continuam intactos.
- Não há varredura Amazon/Magalu enquanto não houver integrações oficiais próprias.
- Não há recálculo de descontos públicos ou valores no catálogo de vendas.
- Verificação gratuita depende das cotas e do plano atual de Cloudflare e das regras da plataforma afiliada.
