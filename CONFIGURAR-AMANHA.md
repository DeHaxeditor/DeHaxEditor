# DeHax V2.2.8 — Checklist de configuração

Use este arquivo amanhã como ordem de trabalho. O código já está preparado; aqui entram apenas contas, chaves, conteúdo e testes reais.

## 1. Supabase

- Criar/abrir projeto.
- Executar `supabase/schema.sql`.
- Copiar `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Criar sua conta real em `/entrar/` e promover para `role='admin'`.
- Confirmar que `/admin/` abre com sua conta real.

## 2. Cloudflare R2

Criar:

- `dehax-assets` — **privado**: arquivos, previews, saídas do VOD.
- `dehax-media` — **público**: logo, capas, thumbnails e imagens do site.

Configurar CORS usando:

- `docs/R2-CORS.json`
- `docs/R2-MEDIA-CORS.json`

Preencher no Netlify:

```text
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=dehax-assets
R2_MEDIA_BUCKET=dehax-media
R2_MEDIA_PUBLIC_URL=https://...
DOWNLOAD_HASH_SALT=
DOWNLOAD_DAILY_LIMIT=1000
```

## 3. Conteúdo pelo Admin

Em **Site público**:

- hero da home;
- logo;
- preview/timeline;
- portfólio e thumbnails;
- ferramentas;
- sobre;
- contato.

Em **Comunidade & marca**:

- identidade;
- textos da landing;
- vídeo hero;
- 3 vídeos “Assets na prática”;
- Discord/WhatsApp;
- preço;
- preço mensal (R$ 19,90);
- preço semestral equivalente (R$ 9,90/mês) e total à vista (R$ 59,40);
- Meta Pixel;
- dados comerciais/suporte.

Em **Categorias**:

- revisar categorias;
- criar todas as subcategorias desejadas;
- testar pausar/reativar uma categoria inteira;
- testar exclusão em lote e upload em massa;
- editar as vantagens FREE, Mensal e Semestral.

Depois cadastrar assets e tutoriais reais.

## 4. Mercado Pago — checkout corrigido

Antes do deploy da V2.2.3:

- se ainda não fez: executar `supabase/migration-v2.2.1.sql`;
- se você já está na V2.2.2, não há migration adicional; mantenha `migration-v2.2.1.sql` e `migration-v2.2.2.sql` já aplicadas;
- manter o plano mensal `DeHax PRO` no Mercado Pago em R$ 19,90/mês;
- pegar a **Public Key** da aplicação de cartão/assinaturas;
- usar token de cartão/assinaturas separado do token Orders/Pix;
- no ambiente de teste, usar uma conta compradora de teste do Mercado Pago para cartão.

Netlify:

```text
MP_PUBLIC_KEY=
MP_SUBSCRIPTIONS_ACCESS_TOKEN=
MP_ORDERS_ACCESS_TOKEN=
MP_PLAN_ID=
MP_TEST_MODE=true
MP_TEST_SUBSCRIPTION_PAYER_EMAIL=EMAIL_TESTE_COMPRADOR
MP_TEST_PIX_PAYER_EMAIL=test_user_br@testuser.com
MP_SUBSCRIPTIONS_WEBHOOK_SECRET=
MP_ORDERS_WEBHOOK_SECRET=
```

Webhooks em `https://SEU-DOMINIO/.netlify/functions/mp-webhook`:

- cartão/assinaturas: `subscription_preapproval` e `payment`;
- Orders/Pix: `order`.

Testar:

- mensal R$ 19,90/mês: Card Payment Brick dentro da DeHax → assinatura recorrente autorizada → PRO;
- cancelamento mensal: para novas cobranças, preservando o acesso até o fim do período já pago;
- semestral cartão: R$ 59,40 em 1x → 6 meses de PRO;
- mensal Pix: R$ 19,90 → Order/QR → período configurado (30 dias por padrão), com renovação antecipada sem perda de dias;
- semestral Pix: R$ 59,40 → Order/QR → 6 meses de PRO após confirmação;
- confirmar que número completo do cartão, validade e CVV não aparecem no Supabase/logs da DeHax.

## 5. VOD Downloader

Publicar `services/vod-worker/` em um host Docker/container.

No worker:

```text
VOD_INTERNAL_TOKEN=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=dehax-assets
VOD_MAX_FILESIZE=8G
```

No Netlify:

```text
VOD_SERVICE_URL=https://...
VOD_INTERNAL_TOKEN=mesmo-token
```

Testar YouTube, Twitch e Kick com conteúdo autorizado.

## 6. Meta / CRM

- Inserir o Pixel ID no Admin.
- Aceitar marketing em um navegador de teste e validar PageView.
- Validar `Lead`, `InitiateCheckout` e `Purchase`.
- Fazer visita com UTM e `fbclid` de teste.
- Conferir em **CRM & acessos** e exportar CSV.

## 7. Legal e produção

- Preencher nome/documento/e-mail reais.
- Revisar `/privacidade/`, `/termos/` e `/cookies/` juridicamente antes das vendas.
- Confirmar o fluxo do direito de arrependimento/reembolso.
- Confirmar licenças de músicas, memes, SFX, vídeos e demais assets redistribuídos.

## 8. Teste final

Testar em desktop e celular:

- FREE;
- PRO mensal recorrente no cartão;
- PRO semestral em cartão 1x;
- PRO semestral em Pix;
- tutorial com liberação programada;
- download de asset;
- pausa individual/global;
- VOD Downloader;
- categorias/subcategorias;
- busca/filtros;
- cancelamento da recorrência;
- checkout;
- banner de cookies;
- landing de anúncio;
- ausência de rolagem lateral mobile.


### V2.2.8 — Orders
Para cartão semestral e Pix em teste, configure `MP_ORDERS_PUBLIC_KEY` e `MP_ORDERS_ACCESS_TOKEN` com o par de **Credenciais de teste** da aplicação Checkout API via Orders API. O mensal recorrente continua usando as credenciais de Assinaturas.
