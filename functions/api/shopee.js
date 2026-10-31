
const SHOPEE_API = "https://open-api.affiliate.shopee.com.br/graphql";

export async function onRequestGet({ env }) {
  try {
    const appId = env.SHOPEE_APP_ID;
    const secret = env.SHOPEE_APP_SECRET;

    if (!appId || !secret) {
      return Response.json(
        { erro: "Credenciais da Shopee não configuradas." },
        { status: 500 }
      );
    }

    const query = `query {
      productOfferV2 {
        nodes {
          itemId
          productName
          imageUrl
          priceMin
          priceMax
          offerLink
          commissionRate
        }
      }
    }`;

    const payload = JSON.stringify({ query });
    const timestamp = Math.floor(Date.now() / 1000);

    const mensagem = appId + timestamp + payload + secret;

    const bytes = new TextEncoder().encode(mensagem);
    const hash = await crypto.subtle.digest("SHA-256", bytes);

    const assinatura = Array.from(new Uint8Array(hash))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");

    const authorization =
      `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${assinatura}`;

    const resposta = await fetch(SHOPEE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization
      },
      body: payload
    });

    const dados = await resposta.json();

    return Response.json({
      status: resposta.ok ? "consulta_realizada" : "erro_http",
      httpStatus: resposta.status,
      dados
    });

  } catch (erro) {
    return Response.json(
      { erro: "Falha na comunicação com a Shopee." },
      { status: 500 }
    );
  }
}
