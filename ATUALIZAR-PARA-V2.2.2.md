# DeHax — atualização V2.2.1 → V2.2.2

Esta atualização mantém Supabase, R2 e Mercado Pago já configurados. Não recrie buckets, projeto Supabase, usuários, assets ou plano mensal do Mercado Pago.

## 1. Banco de dados

No Supabase → SQL Editor, execute **uma vez**:

```text
supabase/migration-v2.2.2.sql
```

Ela cria uma tabela privada `checkout_sessions` usada somente pelo backend para permitir que uma conta recém-criada finalize o pagamento antes de confirmar o e-mail. Também adiciona as listas editáveis de vantagens dos planos FREE, mensal e semestral.

> Execute a V2.2.1 antes da V2.2.2 se ainda não tiver executado a migração anterior.

## 2. Publicar a branch `teste`

Substitua os arquivos da V2.2.1 pelos da V2.2.2 e faça um commit na branch `teste`. Como `main` é a production branch e `teste` é Branch Deploy, use a URL `teste--...netlify.app` em todos os testes.

Nenhuma variável nova do Netlify é necessária especificamente para a V2.2.2. Permanecem as variáveis Mercado Pago da V2.2.1 (`MP_PUBLIC_KEY`, tokens de Assinaturas/Orders, `MP_PLAN_ID`, modo de teste e secrets de webhook).

## 3. O que testar

### Checkout de novo usuário

1. Abra `/checkout/?plan=semester` sem estar logado.
2. Informe nome, e-mail e senha.
3. A DeHax cria a conta e o Supabase envia o e-mail de confirmação.
4. O checkout continua aberto mesmo antes da confirmação.
5. Faça o pagamento de teste.
6. Depois da aprovação, a tela avisa que o e-mail precisa ser confirmado antes do primeiro login.
7. Confirme o e-mail e entre normalmente em `/entrar/`.

A DeHax não recebe número completo do cartão, validade ou CVV. O Card Payment Brick do Mercado Pago tokeniza esses dados.

### Checkout de usuário existente

Entre antes de abrir o checkout. Nome e e-mail devem aparecer preenchidos automaticamente, sem campo de senha.

### Landing / planos

O PRO começa sempre no **Semestral**, exibindo R$ 9,90/mês equivalente e o aviso de pagamento integral de R$ 59,40 por 6 meses. O seletor deslizante azul/vermelho alterna para o Mensal. O CTA `QUERO SER PRO` abre o checkout já no plano selecionado.

### Categorias

No Admin → Categorias:

- `Ⅱ` oculta categoria/subcategoria inteira sem apagar arquivos;
- `▶` reativa;
- `×` exclui a categoria/subcategoria e todos os assets vinculados, incluindo os arquivos privados do R2 vinculados aos assets.

O backend também recusa preview/download de assets pertencentes a categoria ou subcategoria pausada.

### Upload em massa

Admin → Assets → `UPLOAD EM MASSA`:

- selecione categoria, subcategoria, acesso e status uma única vez;
- selecione vários arquivos;
- cada arquivo vira um asset próprio;
- o título é gerado do nome do arquivo sem a extensão;
- formato, tamanho e tipo de mídia são detectados automaticamente.

### Vantagens dos planos

Admin → Comunidade & marca → Vantagens dos planos. Cada linha corresponde a uma vantagem. Há listas independentes para FREE, Mensal e Semestral; remover uma linha remove a vantagem da landing.

## 4. Ordem recomendada

1. Executar `migration-v2.2.2.sql`.
2. Commit da V2.2.2 na `teste`.
3. Testar novo usuário + confirmação de e-mail.
4. Testar usuário existente.
5. Testar cartão mensal, cartão semestral, Pix mensal e Pix semestral.
6. Testar categoria pausada/excluída e upload em massa.
