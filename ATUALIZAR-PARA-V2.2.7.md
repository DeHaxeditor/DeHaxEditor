# DeHax V2.2.7 — diagnóstico/correção da assinatura Mercado Pago

Esta versão é uma atualização pequena sobre a V2.2.6 e **não exige migration do Supabase nem novas variáveis no Netlify**.

## O que mudou

- A criação da assinatura mensal com plano associado agora envia ao `/preapproval` apenas os campos necessários ao nosso fluxo:
  - `preapproval_plan_id`
  - `external_reference`
  - `payer_email`
  - `card_token_id`
  - `status: authorized`
- Foram removidos `reason` e `back_url` do POST da assinatura. Com plano associado, esses campos não são obrigatórios e as configurações do plano são reutilizadas pelo Mercado Pago.
- Em `MP_TEST_MODE=true`, a Function `create-subscription` registra um diagnóstico seguro do plano e da tentativa (status/valor/moeda/IDs do plano, e-mail mascarado e tamanho do CardToken), **sem imprimir Access Token, Public Key ou CardToken**.
- Se o Mercado Pago rejeitar a criação, a resposta estruturada do provedor também é registrada nos logs para facilitar a homologação.
- Assets locais foram versionados como `?v=2.2.7` para evitar cache de JavaScript antigo.

## Como atualizar

1. Substitua a V2.2.6 pela V2.2.7 na branch `teste`.
2. Faça o commit e aguarde o Branch Deploy.
3. Não execute SQL.
4. Não altere as credenciais que já foram conferidas.
5. Repita o teste de cartão mensal com um CardToken novo (o CardToken é de uso único).

Se ainda houver erro, abra `Netlify > Functions > create-subscription > Logs` e envie apenas os blocos `MP subscription diagnostic` e `MP preapproval rejected`, sem compartilhar credenciais.
