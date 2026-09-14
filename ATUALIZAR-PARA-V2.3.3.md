# Atualizar DeHax V2.3.2 → V2.3.3

A V2.3.3 corrige definitivamente a ação de cancelamento para contas FREE e adiciona retenção de assinantes, suporte/reembolso e um ID público de compra usado no atendimento.

## 1. Banco de dados — obrigatório

No Supabase SQL Editor execute **uma única vez**:

`supabase/migration-v2.3.3.sql`

Ela:

- adiciona `purchase_code` aos pagamentos e cria IDs no padrão `DHX-...` também para compras antigas;
- cria `subscription_exit_feedback` para registrar o motivo da desistência;
- cria `retention_offers` para controlar descontos de permanência;
- cria `refund_requests` para as solicitações enviadas pela área de Suporte;
- cria as configurações `retention_discount_percent=10`, `retention_monthly_cycles=3` e `refund_request_days=7`.

## 2. Variáveis Netlify — e-mail pós-pagamento

A confirmação de cadastro e recuperação de senha continuam saindo pelo SMTP do Supabase. Já o novo **e-mail de compra confirmada** é disparado pelo backend da DeHax via API do Resend.

Adicione em `Netlify > Site configuration > Environment variables`:

```text
RESEND_API_KEY=sua_chave_send_only_do_resend
RESEND_FROM_EMAIL=no-reply@auth.dehax.com.br
RESEND_FROM_NAME=DeHax Editor
```

Use uma API Key do Resend com permissão **somente de envio** e, de preferência, restrita ao domínio `auth.dehax.com.br`. Não coloque essa chave no frontend, `runtime-config.js` ou repositório público.

Quando um pagamento é confirmado, o e-mail informa o plano, valor, data e o **ID da compra**. O ID também aparece no histórico financeiro do membro e no Admin.

## 3. Cancelamento e retenção

### FREE

A ação de cancelamento fica oculta por `hidden`, `display:none` e pela regra de plano no JavaScript. Uma conta FREE não abre o modal de cancelamento.

### PRO Mensal recorrente

Antes de cancelar, o membro precisa escolher **um único motivo obrigatório**. O botão principal/colorido é **MANTER ASSINATURA COM 10% OFF**.

Ao aceitar:

- o backend consulta a assinatura real no Mercado Pago;
- reduz o valor em 10%;
- registra a oferta para **3 cobranças mensais**;
- a função agendada `manage-retention-discounts` acompanha as faturas e restaura o valor original após a terceira cobrança aprovada.

Se o usuário insistir em cancelar, a recorrência é encerrada e o período já pago continua preservado.

### PRO Semestral

O semestral atual da DeHax é uma compra única de 6 meses e **não possui renovação automática**. Por isso, a oferta de permanência reserva **10% de desconto para a próxima compra semestral**, em vez de alterar uma cobrança futura inexistente. Quando o membro fizer a próxima compra de 6 meses, o checkout e o backend usam automaticamente o valor com desconto e marcam a oferta como resgatada.

## 4. Nova área Suporte

No rodapé da barra lateral, **SUPORTE** aparece ao lado de **CONFIGURAÇÕES**.

A área contém cinco FAQs sobre tokens, biblioteca, assinatura, conta/senha e reembolso. A FAQ de reembolso abre um formulário que exige:

- ID da compra;
- telefone;
- CPF válido;
- rua/avenida, número, complemento opcional, bairro, cidade, UF e CEP.

O backend confirma que o ID pertence ao usuário logado e que a compra está em status pago. A solicitação só é registrada dentro de **7 dias da compra**. Depois do prazo, a plataforma informa que a janela encerrou.

## 5. Admin — Suporte & reembolsos

O Control Center recebe uma nova página **Suporte & reembolsos** com:

- solicitações recebidas e dados completos do formulário;
- status `pending`, `reviewing`, `approved`, `rejected` e `completed`;
- histórico recente de compras com ID `DHX-...`;
- resumo dos motivos informados por membros que pensaram em cancelar;
- contagem de ofertas de retenção ativas.

## 6. Testes obrigatórios antes de publicar

1. Entrar com conta FREE e confirmar que **CANCELAR RECORRÊNCIA não aparece**.
2. PRO Mensal recorrente: abrir cancelamento, confirmar que motivo é obrigatório e que **MANTER ASSINATURA** é o botão principal.
3. Em conta mensal de teste, aceitar a oferta e conferir no Mercado Pago se o valor da assinatura caiu 10%.
4. PRO Semestral: confirmar que o texto explica que não existe renovação automática e oferece 10% na próxima compra.
5. Compra nova: confirmar recebimento do e-mail com ID `DHX-...` e exibição do mesmo ID no histórico e no Admin.
6. Reembolso com uma compra de até 7 dias: enviar e conferir no Admin.
7. Tentar reembolso com ID de outra conta, ID inexistente e compra fora do prazo; todos devem ser bloqueados.
8. Alterar o status do pedido de reembolso no Admin.

## 7. Observação sobre a função de 3 meses

`manage-retention-discounts.mjs` é uma Scheduled Function diária do Netlify. Em Branch Deploy/preview, funções agendadas podem não executar automaticamente. Para validar em testes, use o ambiente de produção ou execute a função manualmente quando aplicável. Em produção ela verifica diariamente as faturas do Mercado Pago e restaura o valor original depois das três cobranças com desconto.
