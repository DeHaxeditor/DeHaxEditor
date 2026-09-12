# DeHax Editor — Plataforma de Membros V2

Esta versão transforma o site estático em um ecossistema com landing page, login, biblioteca de assets, tutoriais, FREE/PRO, painel administrativo, downloads privados e integração preparada para assinatura recorrente.

## O que foi adicionado

- `/comunidade/` — landing page para tráfego de Meta Ads, com hero em vídeo, animações, seções de scroll, planos, comunidade e CTA.
- `/entrar/` — login e cadastro.
- `/app/` — área de membros: dashboard, biblioteca pesquisável, filtros, previews, downloads, tutoriais, favoritos, comunidade e conta.
- `/admin/` — DeHax Control Center: assets, uploads, pausa de downloads, tutoriais, usuários, suspensão de contas, FREE/PRO manual, histórico de downloads e configurações.
- `/cms/` — o painel Decap CMS antigo foi preservado para o portfólio público.
- Logo DeHax aplicada ao ecossistema e ao site principal.
- `/privacidade/` e `/termos/` — páginas-base para a operação. Revise juridicamente antes do lançamento comercial.
- Meta Pixel opcional, com consentimento antes do carregamento.

## Arquitetura

- Site / frontend: HTML, CSS e JavaScript, hospedado no Netlify.
- Autenticação e banco: Supabase.
- Assets privados: Cloudflare R2.
- Tutoriais: YouTube não listado. O ID do vídeo fica em tabela privada e só é entregue após validação do plano.
- Pagamentos: Mercado Pago Assinaturas.
- Backend: Netlify Functions.

### Segurança dos assets

Os caminhos privados do R2 ficam em `asset_files`, tabela que usuários comuns não conseguem consultar. O clique em download chama uma Netlify Function, que valida:

1. sessão;
2. conta não suspensa;
3. asset publicado;
4. FREE/PRO;
5. download individual e global habilitados;
6. limite de segurança das últimas 24 horas.

Só depois é criado um link assinado do R2 válido por 120 segundos. O download continua acontecendo pelo navegador, sem abrir Drive ou página externa de armazenamento.

## 1. Configurar o Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**.
3. Execute o arquivo `supabase/schema.sql` inteiro.
4. Em Authentication, configure e-mail/senha conforme sua preferência. Se confirmação por e-mail estiver ligada, o usuário terá de confirmar antes do primeiro login.
5. Cadastre sua própria conta pela tela `/entrar/`.
6. No SQL Editor, transforme sua conta em administrador:

```sql
update public.profiles
set role = 'admin'
where email = 'SEU_EMAIL';
```

7. No painel do Supabase, copie:
   - Project URL → `SUPABASE_URL`
   - anon public key → `SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

**Nunca coloque a service_role key em código frontend.** Ela só vai nas variáveis de ambiente do Netlify.

## 2. Configurar Cloudflare R2

1. Crie um bucket privado, por exemplo `dehax-assets`.
2. Crie credenciais de API S3 com leitura e escrita nesse bucket.
3. Anote:
   - Account ID
   - Access Key ID
   - Secret Access Key
   - Nome do bucket
4. Configure o CORS do bucket usando `docs/R2-CORS.json` e troque as origens pelos seus domínios reais.

As variáveis serão:

```text
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=dehax-assets
```

## 3. Configurar Mercado Pago

1. Crie uma aplicação no Mercado Pago Developers.
2. Crie um **plano de assinatura recorrente** (mensal, no valor que você decidir).
3. Copie o Access Token de produção e o ID do plano.
4. Configure no Netlify:

```text
MP_ACCESS_TOKEN=APP_USR-...
MP_PLAN_ID=...
```

5. Configure uma notificação Webhook do tipo de assinaturas apontando para:

```text
https://SEU-DOMINIO/.netlify/functions/mp-webhook
```

O backend consulta a assinatura diretamente na API do Mercado Pago antes de atualizar o usuário. Quando o status fica `authorized`, o perfil vira PRO. Em pausa ou cancelamento, volta ao FREE.

## 4. Variáveis de ambiente do Netlify

Use `.env.example` como checklist. As principais são:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=dehax-assets
DOWNLOAD_HASH_SALT=uma-string-longa-e-aleatoria
DOWNLOAD_DAILY_LIMIT=500

MP_ACCESS_TOKEN=
MP_PLAN_ID=

META_PIXEL_ID=
```

`DOWNLOAD_DAILY_LIMIT` é apenas o fallback. Depois você pode alterar o limite pelo próprio painel Admin em **Configurações → Downloads**. A versão entregue começa em **500 downloads por 24h**, propositalmente alta para não atrapalhar uso legítimo.

## 5. Deploy

O `netlify.toml` já está preparado.

Ao publicar o repositório no Netlify:

- Build command: `npm run build`
- Publish directory: `.`
- Functions directory: `netlify/functions`

O build apenas gera `assets/js/runtime-config.js` com as chaves públicas. Não existem dependências NPM externas nesta versão.

## 6. Primeiro uso do Admin

Entre em:

```text
https://SEU-DOMINIO/admin/
```

### Assets

Você pode:

- criar e editar;
- definir FREE ou PRO;
- publicar, deixar em rascunho ou pausar;
- enviar arquivo principal para R2;
- enviar preview separado;
- pausar somente o download;
- pausar somente o preview;
- colocar como destaque;
- remover o asset e seus arquivos do R2.

Para capas, a versão atual aceita URL pública. Isso evita gerar um link assinado para cada thumbnail da biblioteca.

### Tutoriais

Cole um link do YouTube não listado ou o ID do vídeo. O painel extrai o ID e salva em `tutorial_sources`, que é privado para membros comuns.

Observação: YouTube não listado não é DRM. Um membro autorizado pode tecnicamente descobrir/compartilhar o link do vídeo. Esta escolha reduz custo, mas não oferece a proteção de uma plataforma de vídeo privada.

### Usuários

Você pode:

- ver FREE/PRO e status da assinatura;
- conceder/remover PRO manualmente;
- suspender ou reativar uma conta.

### Downloads

O painel registra os downloads autorizados e uma hash curta do IP para ajudar a identificar comportamento automatizado, sem gravar o IP bruto no registro padrão.

### Configurações

Você pode mudar:

- vídeo inicial da landing page;
- preço mostrado na página;
- links de Discord e WhatsApp;
- limite de downloads/24h;
- pausa global de downloads;
- mensagem de manutenção.

## 7. Landing page / Meta Ads

Use como destino do anúncio:

```text
https://SEU-DOMINIO/comunidade/
```

A página preserva parâmetros UTM e `fbclid` nos links para cadastro.

Se `META_PIXEL_ID` estiver configurado, a página apresenta uma escolha de privacidade. O pixel só é carregado após o visitante aceitar métricas.

O vídeo de abertura é configurado no Admin em **Configurações → Landing page** usando um vídeo não listado do YouTube.

## 8. Testar localmente

Sem Supabase configurado, o modo de demonstração só fica disponível em localhost.

Na pasta do projeto:

```bash
python -m http.server 8080
```

Abra:

```text
http://localhost:8080/entrar/
```

A tela exibirá botões de demonstração FREE, PRO e ADMIN. Os uploads/downloads reais não funcionam em demo; eles dependem de Supabase + R2 + Netlify Functions.

## 9. Direitos dos arquivos

Antes de colocar músicas, memes, trechos de filmes/séries ou outros arquivos de terceiros em uma biblioteca distribuída aos membros, confirme que você possui direito/licença para redistribuí-los. Assinatura paga e acesso fechado não substituem autorização de uso/distribuição.

## Estrutura principal

```text
/
├── index.html                 portfólio público
├── comunidade/               landing de aquisição
├── entrar/                   autenticação
├── app/                      área de membros
├── admin/                    DeHax Control Center
├── cms/                      painel antigo do portfólio
├── privacidade/
├── termos/
├── assets/
│   ├── brand/dehax-logo.png
│   ├── css/
│   └── js/
├── netlify/functions/        backend seguro
├── supabase/schema.sql       banco + RLS
├── docs/R2-CORS.json
├── .env.example
└── netlify.toml
```
