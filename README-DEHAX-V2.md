# DeHax Editor — Plataforma de Membros V2.2

A V2.2 mantém a identidade visual aprovada da DeHax e amplia a plataforma para funcionar como um ecossistema completo de aquisição, membros, biblioteca, tutoriais, VOD Downloader, checkout e administração.

## O que mudou nesta versão

- **Categorias + subcategorias de assets** gerenciáveis no Admin. Você pode criar, renomear e remover categorias/subcategorias sem alterar código e escolher ambas ao cadastrar um asset.
- **Selects personalizados DeHax** em vez da janela nativa clara do navegador/Windows, mantendo o visual escuro da plataforma.
- **Admin separado e mais completo** em `/admin/`: assets, categorias, subcategorias, tutoriais, usuários, CRM/acessos, downloads, VOD, **site público/portfólio**, landing, identidade visual e operação.
- **CMS visual do site inteiro**: a home pública/portfólio agora pode ser editada no Control Center (hero, imagens, portfólio, miniaturas, ferramentas, sobre e contato), além da landing da comunidade (textos, logo, cores, vídeo hero, três vídeos de demonstração, preço, Discord, WhatsApp, Meta Pixel e dados comerciais).
- **CRM inicial** com page views/eventos, origem, UTM, `fbclid`, campanhas e usuários, preparado para remarketing com consentimento.
- **VOD Downloader web** na área de membros, logo abaixo de Início, disponível para FREE e PRO. Suporta análise e download autorizado de YouTube/Twitch/Kick, qualidade, MP4/MP3, cortes, legendas, thumbnail e playlist.
- **Cursor glow** aplicado ao site principal, landing da comunidade e área de membros.
- **Correção mobile** para evitar rolagem lateral involuntária e manter o conteúdo centralizado.
- **Landing `/comunidade/`** com seção “Assets na prática” e três vídeos antes dos planos, seguida de CTA.
- **Botões unificados** com o efeito vermelho/ciano usado na página principal.
- **Checkout `/checkout/`**: cartão via página hospedada do Mercado Pago; Pix gerado e exibido dentro da DeHax sem coletar dados bancários/cartão no site.
- **Acesso Pix automático** após confirmação do pagamento e retorno para a área de membros.
- **Assinatura recorrente no cartão** via Mercado Pago Assinaturas, com cancelamento da recorrência pela área Minha Conta.
- **Tutorial com liberação programada**: cada tutorial pode ter `0, 7, 14...` dias de espera a partir da primeira ativação PRO. O exemplo inicial usa 7 dias e é apresentado como bônus com liberação programada; isso não altera direitos legais de arrependimento/cancelamento.
- `/privacidade/`, `/termos/` e `/cookies/` atualizados como base operacional.
- Limite de segurança inicial aumentado para **1.000 downloads por 24h**, alterável no Admin.

---

# Arquitetura

| Área | Tecnologia |
|---|---|
| Site, landing, membros e Admin | HTML/CSS/JavaScript no Netlify |
| Login e banco | Supabase |
| Assets privados | Cloudflare R2 privado |
| Logo, capas e imagens públicas | Cloudflare R2 Media público separado |
| Tutoriais | YouTube não listado |
| Cartão recorrente | Mercado Pago Assinaturas / checkout hospedado |
| Pix | Mercado Pago Orders API + QR exibido localmente |
| Backend do site | Netlify Functions |
| VOD Downloader | Serviço Docker separado com FastAPI + yt-dlp + ffmpeg |
| CRM inicial | Supabase + eventos próprios + Meta Pixel opcional |

## Por que o VOD usa um serviço separado

Netlify Functions não são adequadas para downloads/transcodificações longas com `yt-dlp` e `ffmpeg`. Por isso a interface fica dentro da DeHax, mas o processamento roda em um pequeno container persistente. As Netlify Functions fazem a ponte autenticada entre o membro e esse serviço.

A versão web **não recebe nem envia cookies do navegador do usuário**. Recursos que dependem de sessão autenticada do Chrome/Edge continuam sendo responsabilidade do aplicativo desktop; isso evita enviar cookies sensíveis para o servidor.

---

# 1. Testar a V2.2 localmente

No Windows, extraia o ZIP e dê dois cliques em:

```text
INICIAR-DEMO.bat
```

Ele abre `http://localhost:8765/entrar/`.

Você terá:

- **Demo FREE** — conteúdo PRO visível e bloqueado;
- **Demo PRO** — acesso aos assets/tutoriais, com um tutorial demonstrando liberação programada de 7 dias;
- **Demo ADMIN** — Control Center completo.

Na demo, pagamentos, uploads, downloads reais e o processamento VOD dependente do servidor ficam simulados ou indisponíveis até as integrações abaixo serem configuradas.

---

# 2. Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**.
3. Execute `supabase/schema.sql` inteiro.
4. Se você já tinha executado a V2.1, o final do arquivo contém a migração da V2.2 e pode ser executado novamente; revise mensagens de conflito antes de publicar em produção.
5. Em Authentication, configure login por e-mail/senha.
6. Cadastre sua conta em `/entrar/`.
7. Promova sua conta a admin:

```sql
update public.profiles
set role = 'admin'
where email = 'SEU_EMAIL';
```

8. Copie para o Netlify:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend.

### O banco agora inclui

- `asset_categories`
- `asset_subcategories`
- categorias/subcategorias ligadas aos assets
- `analytics_events`
- `payment_orders`
- `vod_history`
- `pro_started_at`
- `access_expires_at`
- `tutorials.unlock_after_days`
- configurações de landing/identidade/Meta/checkout

---

# 3. Cloudflare R2

Use **dois buckets**.

### A. Bucket privado — arquivos de membros

Exemplo:

```text
R2_BUCKET=dehax-assets
```

Aqui ficam ZIP, WAV, MP4, presets, LUTs e previews privados. O usuário nunca recebe a pasta nem uma URL permanente. A Function valida a conta e gera acesso temporário.

Configure o CORS com `docs/R2-CORS.json`.

### B. Bucket público de mídia — CMS visual

Exemplo:

```text
R2_MEDIA_BUCKET=dehax-media
R2_MEDIA_PUBLIC_URL=https://media.seudominio.com
```

Aqui ficam logo, capas, thumbnails e imagens que precisam carregar diretamente no site/landing. Use domínio público/custom domain do bucket e configure o CORS com `docs/R2-MEDIA-CORS.json`.

Credenciais usadas pelo backend:

```text
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=dehax-assets
R2_MEDIA_BUCKET=dehax-media
R2_MEDIA_PUBLIC_URL=
```

---

# 4. Mercado Pago

## Cartão — checkout definitivo do Mercado Pago

A DeHax **não possui campos de cartão**. O botão de cartão chama a Function `create-subscription`, cria/associa a assinatura e redireciona o membro para o `init_point` hospedado pelo Mercado Pago.

Configure:

```text
MP_ACCESS_TOKEN=APP_USR-...
MP_PLAN_ID=SEU_PREAPPROVAL_PLAN_ID
```

O plano deve ser recorrente, por exemplo mensal.

Após a autorização, o webhook atualiza o perfil para PRO. O retorno da compra volta a `/checkout/?retorno=cartao`; a tela aguarda a confirmação e então envia o usuário à área de membros.

Na área **Minha Conta**, uma assinatura recorrente ativa mostra **Cancelar recorrência**. O backend cancela o `preapproval` no Mercado Pago. Quando o provedor informa uma `next_payment_date` futura, a plataforma preserva o acesso até essa data e bloqueia novas cobranças.

## Pix — QR dentro da DeHax

O botão Pix usa a Orders API no backend. A tela recebe apenas os dados necessários para exibir:

- QR Code;
- código Pix copia e cola;
- status do pedido.

A tela consulta o status do pedido. Quando o Mercado Pago confirma o pagamento, o backend libera PRO e redireciona para `/app/`.

O número de dias concedidos por uma compra Pix é configurável no Admin em **Site & conteúdo** (`pix_access_days`). O padrão é 30 dias.

## Webhook

Configure no Mercado Pago:

```text
https://SEU-DOMINIO/.netlify/functions/mp-webhook
```

O backend não confia apenas no corpo recebido: ele consulta o pedido/assinatura diretamente no Mercado Pago antes de liberar acesso.

---

# 5. VOD Downloader web

A interface está em:

```text
/app/#downloader
```

Ela aparece para FREE e PRO.

O worker está em:

```text
services/vod-worker/
```

Para produção, publique esse diretório em um host que aceite Docker/container persistente e configure nele:

```text
VOD_INTERNAL_TOKEN=TOKEN_LONGO
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=dehax-assets
VOD_MAX_FILESIZE=8G
```

No Netlify, configure o mesmo token e a URL do worker:

```text
VOD_SERVICE_URL=https://SEU-WORKER
VOD_INTERNAL_TOKEN=TOKEN_LONGO
```

O worker suporta:

- YouTube, Twitch e Kick;
- análise de título/thumbnail/duração;
- qualidade automática ou até 1080p/1440p/4K conforme disponível;
- MP4/melhor formato/MP3;
- início e fim do corte;
- corte preciso via ffmpeg;
- legendas;
- thumbnail;
- playlist;
- entrega por link temporário do R2;
- histórico em `vod_history`.

Use apenas em conteúdos que o membro tem autorização para baixar/processar e respeite os termos das plataformas de origem.

---

# 6. Admin / Control Center

Acesse:

```text
/admin/
```

## Assets

- cadastrar/editar/remover;
- FREE/PRO;
- categoria e subcategoria;
- busca e filtros;
- thumbnail/capa;
- arquivo privado e preview;
- publicar/rascunho/pausar;
- ativar/desativar download;
- ativar/desativar preview;
- destaque.

## Categorias

- criar/remover categorias;
- criar/remover subcategorias;
- relacionar subcategoria à categoria;
- usar as opções imediatamente no cadastro de asset.

## Tutoriais

- título, descrição, categoria e thumbnail;
- vídeo do YouTube não listado;
- FREE/PRO;
- `unlock_after_days` para conteúdo com liberação programada.

O ID do vídeo PRO fica na fonte privada e só é entregue após a validação do membro. YouTube não listado continua não sendo DRM: um membro autorizado pode tecnicamente descobrir/compartilhar o link.

## Usuários

- plano atual;
- origem/atribuição;
- conceder/remover PRO manualmente;
- suspender/reativar conta.

## CRM & acessos

A base registra, quando permitido pelas preferências do visitante:

- page view;
- cliques de CTA;
- URL/caminho;
- referrer;
- UTM source/medium/campaign/content/term;
- `fbclid`;
- sessão/visitante anônimo;
- usuário autenticado, quando houver;
- data/hora.

A tela mostra métricas básicas, origem/campanhas e eventos recentes. Para volume grande, evolua depois para paginação e relatórios agregados.

## Site público

A aba **Site público** substitui a necessidade de editar `content/site.json` no dia a dia. Ela controla:

- nome/status;
- três linhas do hero e texto de abertura;
- textos dos botões;
- logo;
- imagem de preview, timeline e foto da seção Sobre;
- portfólio com vídeos do YouTube, categorias, destaque e thumbnail própria;
- faixa animada;
- ferramentas/skills;
- textos e destaques da seção Sobre;
- contato, redes e rodapé.

As imagens podem ser enviadas diretamente pelo Admin para o bucket público de mídia. O arquivo `content/site.json` permanece como fallback para o site nunca ficar sem conteúdo.

## Comunidade & marca

Sem editar código, você pode trocar:

- vermelho/ciano/fundo;
- logo por URL ou upload;
- eyebrow/título/texto/CTA da landing;
- vídeo principal;
- três vídeos “Assets na prática” + títulos;
- preço exibido;
- dias de acesso do Pix;
- Discord/WhatsApp;
- Meta Pixel ID;
- e-mail de suporte;
- nome/documento do negócio.

## Operação

- limite de downloads em 24h;
- pausa global de downloads;
- mensagem de manutenção.

A configuração inicial é **1.000 downloads/24h**, deliberadamente alta para não atrapalhar um editor em uso normal. Você pode aumentar ainda mais pelo Admin.

---

# 7. CRM, Cookies e Meta remarketing

`assets/js/tracking.js` cria uma camada própria de eventos e preserva UTMs/`fbclid`.

O banner separa:

- necessários;
- analytics;
- marketing.

Analytics e Meta Pixel ficam desligados por padrão até a escolha correspondente. O Pixel pode ser definido no Admin; quando marketing estiver autorizado, ele é carregado.

A base já está pronta para futuramente criar públicos de remarketing, medir campanhas e expandir eventos como `ViewContent`, `Lead`, `InitiateCheckout` e `Purchase` após validarmos a operação real.

---

# 8. Landing `/comunidade/`

A landing mantém o visual aprovado e agora possui:

1. hero em vídeo;
2. benefícios/biblioteca;
3. tutoriais/comunidade;
4. **Assets na prática — três vídeos configuráveis**;
5. CTA de membro imediatamente após os vídeos;
6. planos;
7. Discord/WhatsApp e fechamento.

O glow que acompanha o cursor também está ativo aqui, respeitando `prefers-reduced-motion` e sendo desativado em dispositivos touch.

No mobile, `overflow-x` e componentes largos foram limitados para impedir a rolagem lateral involuntária.

---

# 9. Checkout e direitos do consumidor

A página `/checkout/` mostra os dois caminhos de pagamento sem coletar cartão localmente.

As páginas-base incluem:

- `/privacidade/`
- `/termos/`
- `/cookies/`

Os Termos informam, de forma destacada, o direito de arrependimento aplicável a contratação online conforme a legislação brasileira, além da possibilidade de cancelar a assinatura recorrente sem multa. O tutorial com liberação programada é descrito como bônus programado e **não é usado para restringir ou renunciar direitos legais**.

**Importante:** estes textos são uma base técnica/operacional. Antes do lançamento comercial, preencha os dados reais da empresa/responsável e submeta os documentos a uma revisão jurídica profissional.

---

# 10. Variáveis de ambiente — checklist

Use `.env.example`:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=dehax-assets
R2_MEDIA_BUCKET=dehax-media
R2_MEDIA_PUBLIC_URL=https://media.seudominio.com
DOWNLOAD_HASH_SALT=STRING_LONGA
DOWNLOAD_DAILY_LIMIT=1000

MP_ACCESS_TOKEN=
MP_PLAN_ID=

VOD_SERVICE_URL=
VOD_INTERNAL_TOKEN=

META_PIXEL_ID=
DEHAX_DEMO_MODE=false
```

---

# 11. Deploy Netlify

`netlify.toml` já contém:

- build `npm run build`;
- publish `.`;
- Functions em `netlify/functions`;
- headers básicos de segurança;
- rotas amigáveis existentes.

Depois de configurar as variáveis:

```bash
npm run check
npm run build
```

Publique no Netlify.

---

# 12. Ordem recomendada para a configuração de amanhã

1. **Supabase** — executar schema, chaves e admin real.
2. **R2 privado + R2 Media** — criar buckets, domínio público da mídia, API e CORS.
3. **Admin** — colocar textos, logo, vídeos, categorias e assets reais.
4. **Mercado Pago** — aplicação, plano recorrente, produção, webhook e teste Pix/cartão.
5. **VOD Worker** — publicar container e preencher URL/token.
6. **Meta** — definir Pixel, validar consentimento e eventos.
7. **Legal** — preencher responsável/suporte e revisar os textos antes de abrir vendas.
8. Fazer um teste ponta a ponta com uma conta FREE, uma PRO, um Pix real de valor de teste e uma assinatura de cartão em ambiente apropriado.

---

# Estrutura principal

```text
/
├── index.html
├── comunidade/
├── entrar/
├── app/
├── admin/
├── checkout/
├── privacidade/
├── termos/
├── cookies/
├── cms/
├── assets/
│   ├── brand/
│   ├── css/
│   └── js/
├── netlify/functions/
├── services/vod-worker/
├── supabase/schema.sql
├── docs/
├── .env.example
├── INICIAR-DEMO.bat
└── netlify.toml
```

## Direitos/licenças dos assets

Antes de disponibilizar músicas, memes, trechos de filmes/séries, SFX ou outros materiais de terceiros para download, confirme que a DeHax possui permissão/licença para redistribuição. Um acesso fechado ou pago não cria, por si só, direito de redistribuir material protegido.
