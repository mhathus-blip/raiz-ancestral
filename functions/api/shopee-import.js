
export async function onRequestGet({ env }) {
  const configurado = {
    shopee: Boolean(
      env.SHOPEE_APP_ID && env.SHOPEE_APP_SECRET
    ),
    supabase: Boolean(
      env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY
    )
  };

  if (!configurado.supabase) {
    return Response.json({
      status: "configuracao_incompleta",
      configurado,
      mensagem: "Faltam variaveis para testar o Supabase."
    });
  }

  try {
    const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/produtos?select=id&limit=1`;

    const resposta = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY
      }
    });

    return Response.json({
      status: resposta.ok
        ? "conexao_supabase_ok"
        : "erro_conexao_supabase",
      httpStatus: resposta.status,
      configurado,
      modo: "somente_leitura",
      mensagem: "Nenhum produto foi modificado."
    });
  } catch (erro) {
    return Response.json({
      status: "falha_comunicacao",
      modo: "somente_leitura",
      mensagem: "Nao foi possivel conectar ao Supabase."
    });
  }
}
