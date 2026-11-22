# Raiz Ancestral V12.5 — Central de oportunidades (prévia, ainda não publicada)

## Objetivo
O administrador pesquisa oportunidades de anúncios na Shopee, recebe sugestões na fila privada, confere os anúncios e decide quais merecem cadastro. Nunca ativar nem publicar produtos automaticamente.

## Fluxo de aprovação
1. Acessar /admin/ e autenticar via Supabase.
2. Pesquisar por tema (usa /api/shopee-sugestoes, com credenciais de afiliado no servidor).
3. Conferir anúncio real, link de afiliado e preço indicativo; enviar à fila.
4. Selecionar categoria e **aprovar como rascunho INATIVO**, ou descartar.
5. Conferir e ativar manualmente o rascunho no gerenciador original de produtos.

## Monitoramento
- Consulta iniciada manualmente ou opção diária no **próprio navegador ADM** (localStorage); executa no máximo três termos por abertura/dia.
- Não funciona com o painel fechado; **não há cron job / rastreador de internet 24 horas instalado**.
- Compara preço da primeira consulta com o da consulta mais recente, se ambos forem numéricos válidos. A variação é descrita como **queda observada**, não desconto anunciado.
- Sem ligação de API funcional ou link afiliado válido, a oferta não pode ser adicionada. Sem preço de referência, não se calcula percentual.
- Sugestão de produto ≠ confirmação de identidade; marca, peso, variação, prazo, frete e preço exigem revisão.

## Arquivos
- `supabase/migrations/20261121_raiz_oportunidades_admin.sql`: tabela privada com políticas RLS para administrador. **APLICADA EM 21/11/2026**, confirmada no Supabase (RLS ativa, 3 políticas, 0 oportunidades, 153 produtos preservados).
- `functions/api/oportunidades-admin.js`: GET/POST/PATCH, sempre valida JWT e `is_raiz_admin`.
- `assets/raiz-oportunidades-admin.js`: central privada de triagem.
- `functions/api/shopee-sugestoes.js`: inclui link oficial de afiliado, somente se domínio Shopee autorizado.
- `admin/index.html`: carrega o módulo novo sem alterar login existente.

## Ativação — exige aprovação separada
1. Concluído: estrutura da fila aplicada no Supabase e validação estática das políticas RLS.
2. Validar login e permissões da tabela com conta autorizada e anônima.
3. Verificar a integração real da Shopee com consulta a produto de teste e links HTTPS válidos.
4. Testar cadastro de rascunho, rejeição, duplicatas e ausência de preço.
5. Publicar o módulo aprovado no painel; verificar a implantação na Cloudflare e validar o funcionamento em sessão autenticada.
6. Para rastreio 24/7, configurar futuramente Workers Cron e fonte oficial com limites de consulta, controle de custo e credenciais protegidas.

**Nenhum dado existente da tabela produtos foi modificado nesta etapa.**
