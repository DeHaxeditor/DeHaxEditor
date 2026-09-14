# DeHax Editor — atualização V2.3.0

Esta versão corrige o erro `401 — Sessão inválida ou expirada` ao finalizar uma compra sem estar logado.

## O que foi corrigido

O frontend enviava `Authorization: Bearer ` mesmo quando não existia sessão autenticada. Em determinados ambientes o cabeçalho chegava ao backend como `Bearer`, e o backend interpretava isso como uma tentativa de autenticação Supabase, sem usar a sessão temporária de checkout.

Na V2.3.0, o cabeçalho `Authorization` só é enviado quando realmente existe um access token. Usuários convidados continuam autenticando o pagamento pelo `checkoutToken` temporário criado pelo checkout.

## Como atualizar

Substitua a V2.2.5 pela V2.3.0 na branch `teste` e aguarde o Branch Deploy.

- Não há migration nova.
- Não há variável nova no Netlify.
- Não é necessário alterar Supabase, R2 ou Mercado Pago.

Depois repita o teste de novo usuário + cartão mensal em uma janela anônima.
