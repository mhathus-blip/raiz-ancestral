-- Raiz Ancestral V12.7: estados de disponibilidade sem exclusão de cadastros.
BEGIN;
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS disponibilidade text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS disponibilidade_observacao text,
  ADD COLUMN IF NOT EXISTS disponibilidade_verificada_em timestamptz,
  ADD COLUMN IF NOT EXISTS disponibilidade_falhas integer NOT NULL DEFAULT 0;
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS raiz_produtos_disponibilidade_check;
ALTER TABLE public.produtos ADD CONSTRAINT raiz_produtos_disponibilidade_check CHECK (disponibilidade IN ('normal','suspeito','fantasma'));
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS raiz_produtos_falhas_check;
ALTER TABLE public.produtos ADD CONSTRAINT raiz_produtos_falhas_check CHECK (disponibilidade_falhas BETWEEN 0 AND 1000);
-- Evitar exposição de itens fantasma inclusive pelo acesso direto à API pública.
DROP POLICY IF EXISTS "Produtos ativos publicos" ON public.produtos;
CREATE POLICY "Produtos ativos publicos" ON public.produtos FOR SELECT TO anon,authenticated
 USING (ativo IS TRUE AND disponibilidade <> 'fantasma');
COMMIT;
