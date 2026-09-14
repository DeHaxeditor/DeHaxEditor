# DeHax Editor — atualização V2.2.7

Esta versão corrige o fluxo do Card Payment Brick durante os testes.

## O que mudou

- impede duas ou mais montagens simultâneas do Card Payment Brick;
- remove a segunda chamada concorrente ao Brick na inicialização do checkout;
- uma tentativa incompleta não deixa mais o checkout travado em uma sessão temporária ao recarregar a página;
- erros do Brick agora aparecem com o código/detalhe retornado pelo Mercado Pago, em vez de apenas uma mensagem genérica;
- quando a confirmação de e-mail está temporariamente desligada no Supabase, o checkout não informa incorretamente que o usuário precisa confirmar o e-mail;
- não há migration nova e não há variável nova no Netlify.

## Atualização

Substitua a V2.2.4 pela V2.2.7 na branch `teste` e faça um Branch Deploy.

Não execute SQL adicional.
