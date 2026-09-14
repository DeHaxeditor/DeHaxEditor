# Atualização para DeHax Editor V2.2.9

Esta versão corrige especificamente os testes do **cartão semestral** e do **Pix** via Mercado Pago Orders API.

## O que foi corrigido

1. `external_reference` da Orders API agora respeita o limite de **64 caracteres** e usa somente letras, números, hífen/sublinhado. A versão anterior incluía dois UUIDs e `:`, ultrapassando o formato aceito pelo Mercado Pago.
2. No `MP_TEST_MODE=true`, o cartão semestral e o Pix usam **R$ 50,00 somente no sandbox**, conforme os exemplos oficiais da Orders API. O preço comercial continua sendo R$ 59,40 no plano semestral e R$ 19,90 no Pix mensal; em produção o valor real é enviado ao Mercado Pago.
3. O payload de sandbox foi reduzido aos campos dos exemplos oficiais. Campos extras como identificação/issuer no cartão e expiração customizada do Pix são omitidos durante o teste.
4. Os erros `errors: [[Object]]` agora são serializados por completo nos logs e a mensagem exibida passa a incluir `code`, `message` e detalhes quando disponíveis.
5. A interface mostra um aviso claro de que o valor de R$ 50,00 existe apenas no sandbox da Orders API.

## Configuração

Não há migration SQL nova e não há variável nova.

Mantenha:

```text
MP_TEST_MODE=true
MP_ORDERS_PUBLIC_KEY=<Public Key da aplicação Orders usada no teste>
MP_ORDERS_ACCESS_TOKEN=<Access Token da aplicação Orders usado no teste>
```

Não altere as credenciais da assinatura mensal, pois o fluxo mensal recorrente já foi validado.

## Ordem dos testes

1. Semestral → Cartão.
2. Mensal → Pix.
3. Semestral → Pix.

Se houver erro, consulte:

```text
create-card-payment → MP Orders card rejected
create-pix          → MP Orders Pix rejected
```

Na V2.2.9 esses blocos exibem o conteúdo completo de `errors`.
