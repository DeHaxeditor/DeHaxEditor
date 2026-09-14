# Atualizar para DeHax V2.3.0

Não há migration SQL nova.

Esta versão corrige o ambiente do Mercado Pago para os pagamentos avulsos:

- assinatura mensal recorrente continua no fluxo de Assinaturas;
- cartão semestral e Pix passam a usar a Orders API com credenciais próprias de teste;
- o Card Brick usa uma Public Key diferente no semestral quando necessário.

## Netlify — adicionar duas variáveis

Na aplicação do Mercado Pago usada para **Checkout API via Orders API**, abra **Testes > Credenciais de teste** e configure no Netlify (All scopes):

```text
MP_ORDERS_PUBLIC_KEY=<Public Key de TESTE da aplicação Orders>
MP_ORDERS_ACCESS_TOKEN=<Access Token de TESTE da aplicação Orders>
```

Mantenha as credenciais que já funcionaram no mensal:

```text
MP_PUBLIC_KEY=<Public Key da aplicação da conta vendedora de teste>
MP_SUBSCRIPTIONS_ACCESS_TOKEN=<Access Token dessa mesma aplicação>
MP_PLAN_ID=<plano mensal já validado>
MP_TEST_MODE=true
MP_TEST_SUBSCRIPTION_PAYER_EMAIL=<conta compradora de teste>
MP_TEST_PIX_PAYER_EMAIL=test_user_br@testuser.com
```

Se `MP_SUBSCRIPTIONS_ACCESS_TOKEN` ainda não existir, o sistema mantém fallback para `MP_ACCESS_TOKEN`, mas é recomendado cadastrar a variável explícita.

Depois faça um Branch Deploy novo e teste novamente o semestral no cartão e o Pix.
