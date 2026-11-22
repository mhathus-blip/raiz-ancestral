-- Raiz Ancestral V12.7: entradas manuais multiloja na fila administrativa privada.
BEGIN;
ALTER TABLE public.raiz_oportunidades ADD COLUMN IF NOT EXISTS loja text NOT NULL DEFAULT 'Shopee';
ALTER TABLE public.raiz_oportunidades DROP CONSTRAINT IF EXISTS raiz_oportunidades_origem_check;
ALTER TABLE public.raiz_oportunidades ADD CONSTRAINT raiz_oportunidades_origem_check CHECK(origem IN ('shopee_api','manual'));
ALTER TABLE public.raiz_oportunidades DROP CONSTRAINT IF EXISTS raiz_oportunidades_loja_check;
ALTER TABLE public.raiz_oportunidades ADD CONSTRAINT raiz_oportunidades_loja_check CHECK(length(trim(loja)) BETWEEN 2 AND 55);
COMMIT;