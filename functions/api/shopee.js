
export async function onRequestGet({ env }) {
  const appIdConfigurado = Boolean(env.SHOPEE_APP_ID);
  const senhaConfigurada = Boolean(env.SHOPEE_APP_SECRET);

  return Response.json({
    servico: "Raiz Ancestral - Shopee",
    status: "online",
    appIdConfigurado,
    senhaConfigurada
  });
}
