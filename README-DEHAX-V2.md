# DeHax Editor — Plataforma de Membros V2.2.5

A V2.2.3 mantém a identidade visual aprovada da DeHax e simplifica o checkout para que cadastro e pagamento aconteçam na mesma tela, além de corrigir a criação de usuários via Supabase Auth.

## Destaques da V2.2.3

- categorias e subcategorias podem ser pausadas/reativadas inteiras; assets vinculados somem da biblioteca e o backend bloqueia acesso enquanto estiverem pausadas;
- exclusão de categoria/subcategoria pode remover todos os assets vinculados em uma única ação;
- upload em massa cria um asset individual por arquivo usando o nome do arquivo como título;
- vantagens dos planos FREE, Mensal e Semestral são editáveis pelo Admin;
- landing PRO usa seletor deslizante Semestral/Mensal, começando no Semestral (R$ 9,90/mês equivalente; R$ 59,40 integral por 6 meses);
- CTA principal do plano é `QUERO SER PRO` e leva diretamente ao checkout já com o plano selecionado;
- checkout agora é uma única etapa: novo cliente informa nome, e-mail, confirmação de e-mail, senha e pagamento na mesma tela; a conta só é preparada quando ele clica em pagar;
- correção do cadastro via Supabase Auth REST: a resposta de signup com confirmação de e-mail ativa pode trazer o usuário diretamente, e não apenas em `data.user`;
- se o e-mail já existir e o cliente não estiver logado, o checkout detecta a conta, bloqueia nome/confirmação/senha e permite aplicar a compra à conta existente após confirmação explícita do endereço;
- usuários já logados têm nome/e-mail preenchidos automaticamente e concluem apenas o pagamento;
- após compra: novo usuário confirma o e-mail e segue para login; usuário logado volta à área de membros; conta existente não logada segue para login;
- miniaturas de vídeo/imagem continuam visíveis na biblioteca, e previews/downloads respeitam categorias pausadas.

Para quem já está na V2.2.2, não há migration adicional nesta versão. Consulte `ATUALIZAR-PARA-V2.2.3.md`.

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
- **Checkout `/checkout/` dentro da DeHax** usando o Card Payment Brick oficial do Mercado Pago. O cartão é tokenizado pelo SDK do Mercado Pago; PAN, validade e CVV não são enviados ao backend nem armazenados pela DeHax.
- **Dois planos PRO**: mensal recorrente por R$ 19,90/mês e semestral pré-pago por R$ 59,40 (equivalente a R$ 9,90/mês), sem parcelamento e sem renovação automática.
- **Pix mensal e semestral** via Mercado Pago Orders API, com QR/Copia e Cola exibidos dentro da DeHax; no mensal a renovação é manual e antecipar o pagamento não faz o membro perder dias.
- **Cancelamento mensal** interrompe renovações futuras sem multa e preserva o acesso até o fim do ciclo já pago.
- **Miniaturas visíveis na biblioteca** para assets de vídeo e imagem, tanto em cards quanto na listagem.
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
| Cartão mensal recorrente | Mercado Pago Card Payment Brick + Assinaturas |
| Cartão semestral | Mercado Pago Card Payment Brick + pagamento único em 1x |
| Pix mensal e semestral | Mercado Pago Orders API + QR exibido localmente |
| Backend do site | Netlify Functions |
| VOD Downloader | Serviço Docker separado com FastAPI + yt-dlp + ffmpeg |
| CRM inicial | Supabase + eventos próprios + Meta Pixel opcional |

## Por que o VOD usa um serviço separado

Netlify Functions não são adequadas para downloads/transcodificações longas com `yt-dlp` e `ffmpeg`. Por isso a interface fica dentro da DeHax, mas o processamento roda em um pequeno container persistente. As Netlify Functions fazem a ponte autenticada entre o membro e esse serviço.

A versão web **não recebe nem envia cookies do navegador do usuário**. Recursos que dependem de sessão autenticada do Chrome/Edge continuam sendo responsabilidade do aplicativo desktop; isso evita enviar cookies sensíveis para o servidor.

---

# 1. Testar a V2.2.3 localmente

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

1. Se for uma instalação nova, crie o projeto, abra o **SQL Editor** e execute `supabase/schema.sql` inteiro.
2. Se você já está na V2.2.1 com Supabase funcionando, não repita o schema: execute **somente** `supabase/migration-v2.2.2.sql`. Se veio da V2.2, execute primeiro `migration-v2.2.1.sql` e depois `migration-v2.2.2.sql`.
3. Em Authentication, mantenha login por e-mail/senha configurado.
4. Cadastre sua conta em `/entrar/`.
5. Promova sua conta a admin:

```sql
update public.profiles
set role = 'admin'
where email = 'SEU_EMAIL';
```

6. Copie para o Netlify:

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

# 4. Mercado Pago — V2.2.3

## Antes de testar

No projeto Supabase existente, mantenha a migration V2.2.1 aplicada e execute também `supabase/migration-v2.2.2.sql`. A nova migration cria a sessão temporária de checkout para contas recém-cadastradas e as listas editáveis de vantagens dos planos.

## Variáveis Netlify

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

- `MP_PUBLIC_KEY` é pública e é usada pelo MercadoPago.js no navegador. Use a Public Key da aplicação usada para cartão/assinaturas.
- `MP_SUBSCRIPTIONS_ACCESS_TOKEN` é secreto e é usado pelo backend para assinatura mensal e pagamento único semestral em cartão.
- `MP_ORDERS_ACCESS_TOKEN` é secreto e é usado somente para Orders/Pix.
- `MP_PLAN_ID` é o ID do plano mensal recorrente de R$ 19,90 já criado no Mercado Pago.
- `MP_ACCESS_TOKEN` continua aceito como fallback legado, mas as variáveis separadas acima têm prioridade.
- Em `MP_TEST_MODE=true`, use `MP_TEST_SUBSCRIPTION_PAYER_EMAIL` com o e-mail da conta de teste compradora do Mercado Pago e deixe `MP_TEST_PIX_PAYER_EMAIL=test_user_br@testuser.com`. Em produção, use `MP_TEST_MODE=false`.

## Mensal — R$ 19,90/mês

O checkout permanece visualmente dentro da DeHax. O **Card Payment Brick** coleta e tokeniza o cartão. A DeHax recebe apenas um `card_token_id` temporário e dados técnicos do meio de pagamento; número completo, validade e CVV não são persistidos pela plataforma.

A Function `create-subscription` envia ao `/preapproval`:

- `MP_PLAN_ID`;
- `card_token_id`;
- `external_reference` = ID do usuário Supabase;
- `status=authorized`.

Antes de criar a assinatura, o backend também confere se o preço mensal exibido pela DeHax é igual ao valor real do `MP_PLAN_ID`; se houver divergência, a venda é bloqueada para evitar cobrança diferente da oferta.

A cobrança é recorrente mensal. O botão **Cancelar recorrência** cancela futuras renovações no Mercado Pago e mantém o PRO até o fim do ciclo já pago, usando `next_payment_date` (com fallback defensivo pelo ciclo mensal).

## Mensal por Pix — R$ 19,90 avulso

O mesmo plano mensal pode ser pago por Pix sem recorrência. Por padrão a confirmação concede 30 dias de PRO (`pix_access_days`). O membro pode renovar antes do vencimento: a função de concessão usa a expiração atual como base quando ela ainda está no futuro, portanto os novos dias começam somente depois do período já pago.

## Semestral — R$ 59,40 à vista

O plano semestral equivale a **R$ 9,90/mês** e é uma compra única de seis meses, sem renovação automática. Comparado a seis mensalidades de R$ 19,90 (R$ 119,40), a economia exibida é de R$ 60,00, aproximadamente 50%.

- **Cartão:** Card Payment Brick + `/v1/payments`, com `installments=1`; não há parcelamento.
- **Pix:** Orders API, QR Code e Pix Copia e Cola dentro da DeHax.
- Pagamento aprovado concede 6 meses-calendário de PRO. O código possui proteção de idempotência para não somar outros 6 meses quando o mesmo webhook/status for recebido novamente.

O Pix também fica disponível no mensal como pagamento avulso pelo período configurado (30 dias por padrão). A recorrência automática mensal é exclusiva do cartão. Se o membro renovar o Pix antes do vencimento, o novo período é somado depois da data atual de expiração, sem perda de dias.

## Webhooks

URL:

```text
https://SEU-DOMINIO/.netlify/functions/mp-webhook
```

Se cartão/assinaturas e Orders estiverem em aplicações diferentes, configure a mesma URL nas duas aplicações, usando o segredo correspondente em cada variável:

- aplicação cartão/assinaturas: `subscription_preapproval` e `payment`;
- aplicação Orders/Pix: `order`.

A Function valida `x-signature` quando o respectivo segredo estiver configurado e consulta o objeto novamente na API antes de liberar acesso.

## Teste Pix

O sandbox oficial do Pix/Orders serve para validar a criação da Order com dados de teste. Não trate um QR sandbox como uma cobrança real. Para validar liquidação ponta a ponta em produção, faça posteriormente um Pix real de pequeno valor no ambiente apropriado.

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

MP_PUBLIC_KEY=
MP_SUBSCRIPTIONS_ACCESS_TOKEN=
MP_ORDERS_ACCESS_TOKEN=
MP_PLAN_ID=
MP_TEST_MODE=true
MP_TEST_SUBSCRIPTION_PAYER_EMAIL=
MP_TEST_PIX_PAYER_EMAIL=test_user_br@testuser.com
MP_SUBSCRIPTIONS_WEBHOOK_SECRET=
MP_ORDERS_WEBHOOK_SECRET=

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
4. **Mercado Pago** — Brick de cartão, assinatura mensal, semestral à vista, Orders/Pix, webhooks e testes.
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


### Renovação Pix mensal

- Pix mensal: pagamento avulso, padrão 30 dias (`pix_access_days`).
- Pix semestral: pagamento avulso, 6 meses.
- Renovação antecipada soma o novo período ao final do acesso vigente; não perde dias.
- Aviso de renovação dentro da área de membros com antecedência configurável (`renewal_notice_days`, padrão 7).
- A renovação automática via Pix não está habilitada neste checkout customizado; o cartão mensal continua recorrente automaticamente.

## V2.2.5 — correção de homologação do checkout

A V2.2.5 serializa a montagem do Card Payment Brick, evita restauração de tentativas temporárias incompletas ao abrir novamente o checkout e exibe detalhes úteis de erros do Mercado Pago durante a homologação. Não requer migration nem novas variáveis de ambiente.
