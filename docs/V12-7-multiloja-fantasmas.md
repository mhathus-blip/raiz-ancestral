# Raiz Ancestral V12.7 — Multiloja e Produtos Fantasmas

## Comportamento
- **normal**: produto pode ser exibido publicamente quando `ativo=true`.
- **suspeito**: produto permanece visível; a Shopee não retornou o item na API de afiliados. Não significa, isoladamente, exclusão.
- **fantasma**: cadastro preservado no Supabase, mas oculto da leitura pública por política RLS; restaurável pelo administrador. O estado `ativo` original não é apagado.
- Erros de rede, credenciais ou respostas inesperadas não modificam a disponibilidade.
- A API Shopee consulta IDs de anúncios reconhecidos. Ausência retornada = suspeita; **não coloca fantasma automaticamente**, porque a API de afiliados pode não listar anúncios ainda existentes.
- Amazon, Magalu, Mercado Livre e outras lojas: oportunidades podem entrar manualmente, usando links de afiliado fornecidos pelo administrador; verificação automática depende de integração oficial futura.
- Verificação diária opcional, ao abrir o ADM, com lote de até quatro anúncios e cursor rotativo. **Não é monitoramento 24h.**
- Nenhum produto foi deletado nem recebeu estado fantasma na implantação.

## Dados e segurança
- `supabase/migrations/20261121_raiz_fantasma_disponibilidade.sql` adiciona 4 colunas e ajusta política pública de SELECT; as políticas de administrador permanecem.
- `supabase/migrations/20261121_raiz_oportunidades_multiloja.sql` permite origens `shopee_api` e `manual`, adiciona loja à fila.
- As migrações foram aplicadas no projeto Supabase, com retorno de sucesso.
- `functions/api/disponibilidade-admin.js`: requer JWT + `is_raiz_admin`, faz consultas Shopee somente com credenciais no servidor e permite marcar/restaurar.
- `functions/api/oportunidades-admin.js`: aceita entradas manuais de qualquer loja com HTTPS validado, sem alegar desconto automático.
- `assets/raiz-fantasmas-admin.js`: monitor e ações somente após login.
- `assets/raiz-oportunidades-admin.js`: cadastrar oportunidades manuais e encaminhar como rascunhos inativos.

## Testes executados
- Verificação de sintaxe JavaScript e scripts embutidos.
- Supabase: produtos atuais mantidos, estados iniciais normais, política pública exclui fantasmas; sem criar um fantasma de teste em produção.
- Não foi testado um anúncio real como removido nem foi realizada mutação de produtos existentes durante os testes.
- Falta confirmar a navegação autenticada e o retorno efetivo da API de afiliados em dispositivo do proprietário.

## Limitações / evolução
- Sem cron job/Worker 24/7 ou integração Amazon/Magalu autenticada.
- Nunca trocar link de afiliado automaticamente, nem inventar preço/desconto.
- Para ativação 24/7, adicionar integração oficial, agendamento Cloudflare Worker e limites/cotas com auditoria de falsos positivos.
