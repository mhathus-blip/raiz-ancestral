# Raiz Ancestral V12.1 — revisão pré-publicação

## Alterações preparadas
- Refinamento do CSS botânico existente: paleta verde-floresta, dourado sutil, vidro líquido com maior contraste, cartões alinhados, imagens com enquadramento proporcional e melhor espaçamento para interação móvel.
- Preservados os SVGs locais de folhagens, as ondas, as campanhas e o HTML/JS do catálogo e painel administrativo.
- Visual reversível pelo parâmetro `?tema=original`, já suportado pelo site.

## Validações estáticas realizadas
- Página pública referencia `/assets/raiz-botanical-liquid-v12.css`.
- Paginação pública configurada em 40 itens por página.
- Arquivo SVG referido pelo CSS existe no repositório.
- Chaves CSS equilibradas; respeito à preferência do usuário por movimento reduzido.
- Código da vitrine temática e do calendário sazonal preservado.

## Auditoria do banco (2026-11-21)
- 108 produtos cadastrados; 107 ativos.
- 67 produtos ativos não têm preço numérico no banco.
- Nenhum produto ativo sem URL de imagem; nenhum produto sem link afiliado ou categoria.
- A interface já tem texto de consulta de preço quando não há valor validado; não fabricar preços ou descontos.

## Verificações necessárias antes de aprovar publicação
- Conferir visualmente em celular e desktop, especialmente legibilidade do texto sobre as folhas e campanhas.
- Conferir a vitrine com 40 itens por página, categorias, busca e ordenação após carregar Supabase.
- Abrir alguns produtos com e sem preço para conferir os links de afiliados e o aviso de preço.
- Testar painel administrativo com login e confirmar que itens inativos não aparecem ao público.
- Testar simulação de datas e campanhas.
- Validar o carregamento e o desempenho em rede móvel.

Nenhuma alteração na produção é autorizada por este arquivo. Publicar somente após aprovação explícita.
