-- Raiz Ancestral V12.5 — fila privada de oportunidades.
-- APLICAR SOMENTE APÓS REVISÃO. Não publica produtos nem ativa promoções.
begin;
create table if not exists public.raiz_oportunidades (
  id bigint generated always as identity primary key,
  origem text not null default 'shopee_api' check (origem in ('shopee_api')),
  item_externo text not null check (length(item_externo) between 3 and 60),
  nome text not null check (length(nome) between 3 and 250),
  link_afiliado text not null check (length(link_afiliado) between 12 and 1800),
  imagem_url text check (imagem_url is null or length(imagem_url)<=1800),
  preco_indicativo numeric(12,2) check (preco_indicativo is null or preco_indicativo>0),
  preco_base numeric(12,2) check (preco_base is null or preco_base>0),
  categoria_sugerida text,
  status text not null default 'pendente' check(status in ('pendente','descartada','selecionada')),
  produto_id bigint references public.produtos(id) on delete set null,
  observacao text,
  consultado_em timestamptz not null default now(),
  revisado_em timestamptz,
  created_at timestamptz not null default now(),
  unique (origem,item_externo)
);
create index if not exists raiz_oportunidades_status_idx on public.raiz_oportunidades(status,consultado_em desc);
alter table public.raiz_oportunidades enable row level security;
revoke all on public.raiz_oportunidades from public, anon, authenticated;
grant select,insert,update on public.raiz_oportunidades to authenticated;
grant usage,select on sequence public.raiz_oportunidades_id_seq to authenticated;
drop policy if exists raiz_oportunidades_sel_adm on public.raiz_oportunidades;
create policy raiz_oportunidades_sel_adm on public.raiz_oportunidades for select to authenticated using ((select public.is_raiz_admin()));
drop policy if exists raiz_oportunidades_ins_adm on public.raiz_oportunidades;
create policy raiz_oportunidades_ins_adm on public.raiz_oportunidades for insert to authenticated with check ((select public.is_raiz_admin()));
drop policy if exists raiz_oportunidades_upd_adm on public.raiz_oportunidades;
create policy raiz_oportunidades_upd_adm on public.raiz_oportunidades for update to authenticated using ((select public.is_raiz_admin())) with check ((select public.is_raiz_admin()));
commit;
