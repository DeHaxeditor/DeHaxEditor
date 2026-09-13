# DeHax V2.2 — Checklist de configuração

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
- dias do Pix;
- Meta Pixel;
- dados comerciais/suporte.

Em **Categorias**:

- revisar categorias;
- criar todas as subcategorias desejadas.

Depois cadastrar assets e tutoriais reais.

## 4. Mercado Pago

- Criar aplicação de produção.
- Criar plano de assinatura recorrente.
- Copiar `MP_ACCESS_TOKEN` e `MP_PLAN_ID`.
- Configurar webhook em `https://SEU-DOMINIO/.netlify/functions/mp-webhook`.
- Testar cartão: deve abrir checkout do Mercado Pago, retornar e liberar PRO.
- Testar Pix: QR deve aparecer na DeHax, confirmar e liberar PRO.
- Testar “Cancelar recorrência” em Minha Conta.

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
- PRO cartão;
- PRO Pix;
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
