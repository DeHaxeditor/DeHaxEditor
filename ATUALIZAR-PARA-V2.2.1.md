# DeHax — atualização V2.2 → V2.2.1

Este arquivo é para o ambiente que **já está com Supabase e R2 funcionando**. Não recrie banco, buckets, usuários ou assets.

## 1. Atualize a branch `teste`

Substitua os arquivos da V2.2 pelos da V2.2.1 e faça o deploy da branch `teste`.

## 2. Supabase — obrigatório antes de testar checkout

Abra **SQL Editor** e execute uma vez:

```text
supabase/migration-v2.2.1.sql
```

A migração:

- adiciona `plan_code`, `payment_method` e `access_granted_at` em `payment_orders`;
- libera `card_once` como tipo de pagamento;
- cria os preços mensal/semestral nas configurações;
- cria uma função transacional para conceder os 6 meses do semestral de forma idempotente.

## 3. Netlify — Mercado Pago

Adicione/ajuste:

```text
MP_PUBLIC_KEY=
MP_SUBSCRIPTIONS_ACCESS_TOKEN=
MP_ORDERS_ACCESS_TOKEN=
MP_PLAN_ID=
MP_TEST_MODE=true
MP_TEST_SUBSCRIPTION_PAYER_EMAIL=EMAIL_DA_CONTA_TESTE_COMPRADOR
MP_TEST_PIX_PAYER_EMAIL=test_user_br@testuser.com
MP_SUBSCRIPTIONS_WEBHOOK_SECRET=
MP_ORDERS_WEBHOOK_SECRET=
```

### O que vai em cada uma

- `MP_PUBLIC_KEY`: Public Key da aplicação usada pelo Card Payment Brick/cartões. Para o teste da assinatura, use a chave da mesma aplicação/conta vendedora de teste que corresponde ao token da assinatura.
- `MP_SUBSCRIPTIONS_ACCESS_TOKEN`: token usado para `/preapproval` e `/v1/payments` de cartão.
- `MP_ORDERS_ACCESS_TOKEN`: Access Token da aplicação Orders/Pix. No sandbox, use a credencial de teste da Orders API.
- `MP_PLAN_ID`: mantenha o ID do plano mensal DeHax PRO já criado.
- `MP_TEST_SUBSCRIPTION_PAYER_EMAIL`: e-mail da **conta Mercado Pago compradora de teste**.
- `MP_TEST_PIX_PAYER_EMAIL`: mantenha `test_user_br@testuser.com` no sandbox do Pix.
- Os dois `*_WEBHOOK_SECRET` são os segredos de assinatura dos webhooks das respectivas aplicações.

`MP_ACCESS_TOKEN` antigo pode permanecer como fallback, mas as variáveis separadas acima têm prioridade.

## 4. Webhooks

Mesma URL:

```text
https://teste--SEU-SITE.netlify.app/.netlify/functions/mp-webhook
```

Na aplicação de cartão/assinaturas habilite:

```text
subscription_preapproval
payment
```

Na aplicação Orders/Pix habilite:

```text
order
```

Se tudo estiver em uma única aplicação, os eventos podem apontar para a mesma URL e `MP_WEBHOOK_SECRET` pode servir como fallback. Se forem aplicações diferentes, prefira os dois segredos separados.

## 5. Planos implementados

### Mensal

```text
R$ 19,90 / mês
recorrente no cartão
cancelamento sem multa
```

O cartão é preenchido no Card Payment Brick dentro da DeHax e tokenizado pelo Mercado Pago. A DeHax não persiste número completo, validade ou CVV.

**Atenção:** o preço exibido no Admin deve continuar igual ao preço real do `MP_PLAN_ID`. Alterar apenas o Admin não altera o plano recorrente no Mercado Pago. A V2.2.1 verifica essa igualdade no backend e bloqueia a contratação se os valores divergirem.

### Semestral

```text
R$ 9,90/mês equivalente
R$ 59,40 total
pagamento único
6 meses de acesso
sem renovação automática
```

Cartão: **1x, sem parcelamento**.

Pix: pagamento único pelo total.

Comparação com seis mensalidades de R$ 19,90:

```text
6 x R$ 19,90 = R$ 119,40
semestral     = R$ 59,40
economia      = R$ 60,00 (~50%)
```

## 6. Cancelamento mensal

A V2.2.1 **não retira o PRO imediatamente** de quem já pagou o ciclo mensal.

Ao cancelar:

1. o Mercado Pago recebe `status=canceled` e para de renovar;
2. a DeHax registra o cancelamento;
3. o acesso continua até a próxima data de cobrança/fim do ciclo já pago;
4. depois disso o usuário volta para FREE.

## 7. Teste recomendado

Use uma conta DeHax FREE real.

1. Abra `/checkout/`.
2. Teste mensal com cartão de teste do Mercado Pago.
3. Confirme no Supabase: `plan=pro`, `subscription_status=authorized`, `subscription_id` preenchido.
4. Cancele e confirme que o status vira `canceled` mas `access_expires_at` mantém o período já pago.
5. Em outra conta FREE, teste semestral cartão em 1x.
6. Confirme `subscription_status=semester_active` e `access_expires_at` aproximadamente 6 meses à frente.
7. Teste criação de Pix semestral. No sandbox da Orders API, a geração da Order/QR é o teste principal; a confirmação de liquidação completa deve ser validada depois em ambiente apropriado.
8. Confira miniaturas de assets de vídeo e imagem na biblioteca.

## 8. Produção

Antes de abrir vendas:

- `MP_TEST_MODE=false`;
- trocar tokens/chaves para credenciais reais correspondentes;
- revisar webhook e assinatura `x-signature`;
- fazer uma compra real controlada de baixo valor/fluxo final;
- revisar Termos, Privacidade e Cookies com dados comerciais reais e revisão jurídica.


## Ajuste Pix mensal / renovação antecipada

Esta revisão da V2.2.1 mantém o mesmo nome de versão e acrescenta:

- Pix também no plano mensal de R$ 19,90;
- mensal via Pix = pagamento avulso, com 30 dias por padrão (`pix_access_days`);
- semestral via Pix = 6 meses;
- renovação antecipada sem perda de dias: o novo período começa após `access_expires_at` quando ele ainda estiver no futuro;
- aviso dentro da área de membros antes do vencimento (`renewal_notice_days`, padrão 7);
- campos no Admin para alterar dias do Pix mensal e antecedência do aviso.

Como esta revisão altera a função SQL `grant_fixed_pro_for_order`, use o arquivo **atualizado** `supabase/migration-v2.2.1.sql` quando for fazer a migração. Se ainda não executou a migração V2.2.1, execute somente a versão atual do arquivo.

A renovação automática via Pix não foi ativada nesta integração customizada. O checkout interno mantém Pix via QR/Orders como renovação manual e cartão mensal como recorrência automática.


### V2.2.9 — Orders
Para cartão semestral e Pix em teste, configure `MP_ORDERS_PUBLIC_KEY` e `MP_ORDERS_ACCESS_TOKEN` com o par de **Credenciais de teste** da aplicação Checkout API via Orders API. O mensal recorrente continua usando as credenciais de Assinaturas.
