# DeHax V2.2.9 — correção do checkout travado

Esta versão corrige o checkout preso em **“Preparando checkout...”**.

## Causa corrigida
Os arquivos em `/assets/` estavam sendo enviados com `Cache-Control: ... immutable` por 1 ano, embora os nomes (`checkout.js`, `dehax-api.js` etc.) continuassem iguais entre versões. Isso podia fazer HTML novo carregar JavaScript antigo e interromper o checkout antes da inicialização.

## O que mudou
- cache bust `?v=2.2.9` nos assets locais das páginas;
- assets mutáveis passam a revalidar em vez de ficarem imutáveis por um ano;
- inicialização do checkout ganhou timeout defensivo para não ficar eternamente em “Preparando checkout...” caso uma consulta externa demore;
- nenhuma migration nova;
- nenhuma variável nova no Netlify.

## Atualização
Substitua a V2.2.3 pela V2.2.9 na branch `teste` e faça um commit. Não execute SQL e não altere credenciais.
