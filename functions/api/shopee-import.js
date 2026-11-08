
export async function onRequestGet({ request, env }) {
  const configurado = {
    shopee: Boolean(env.SHOPEE_APP_ID && env.SHOPEE_APP_SECRET),
    supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
  };

  return Response.json({
    status: "modo_simulacao",
    mensagem: "Importacao desativada. Nenhum produto sera gravado.",
    configurado
  });
}
