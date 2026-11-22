-- Raiz Ancestral V12.8: notificações privadas e histórico de varreduras agendadas.
BEGIN;
ALTER TABLE public.raiz_oportunidades
 ADD COLUMN IF NOT EXISTS detectado_automaticamente boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS visto_em timestamptz;
CREATE INDEX IF NOT EXISTS raiz_oportunidades_alertas_idx
 ON public.raiz_oportunidades(consultado_em DESC)
 WHERE status='pendente' AND detectado_automaticamente IS TRUE AND visto_em IS NULL;
CREATE TABLE IF NOT EXISTS public.raiz_garimpo_execucoes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 janela_utc timestamptz NOT NULL UNIQUE,
 iniciado_em timestamptz NOT NULL DEFAULT now(),
 concluido_em timestamptz,
 situacao text NOT NULL DEFAULT 'executando' CHECK(situacao IN ('executando','concluido','parcial','erro')),
 termos_consultados integer NOT NULL DEFAULT 0 CHECK(termos_consultados>=0),
 encontrados integer NOT NULL DEFAULT 0 CHECK(encontrados>=0),
 novos integer NOT NULL DEFAULT 0 CHECK(novos>=0),
 atualizados integer NOT NULL DEFAULT 0 CHECK(atualizados>=0),
 observacao text
);
ALTER TABLE public.raiz_garimpo_execucoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.raiz_garimpo_execucoes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.raiz_garimpo_execucoes TO authenticated;
DROP POLICY IF EXISTS raiz_garimpo_execucoes_admin_select ON public.raiz_garimpo_execucoes;
CREATE POLICY raiz_garimpo_execucoes_admin_select
 ON public.raiz_garimpo_execucoes FOR SELECT TO authenticated
 USING ((SELECT public.is_raiz_admin()));
COMMIT;