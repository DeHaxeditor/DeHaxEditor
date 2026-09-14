# DeHax V2.3.0 — e-mail profissional + confirmação por código

A V2.3.0 já contém a página `/confirmar-email/` e a validação do código OTP do Supabase. Para produção, falta somente conectar um SMTP profissional e trocar o template de confirmação.

## Recomendação: Resend + Supabase Auth

O Resend funciona como SMTP do Supabase. A DeHax não precisa guardar a chave do Resend no frontend nem criar um sistema paralelo de autenticação.

### 1. No Resend

1. Crie a conta em Resend.
2. Adicione e valide um domínio/subdomínio de envio, por exemplo `auth.seudominio.com`.
3. Cadastre no DNS exatamente os registros SPF/DKIM indicados pelo Resend.
4. Crie uma API Key apenas para envio.

### 2. No Supabase

Abra `Authentication > Email > SMTP Settings` e ative Custom SMTP.

Use:

- Sender name: `DeHax Editor`
- Sender email: `conta@auth.seudominio.com` (ou outro endereço do domínio verificado)
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: a API Key criada no Resend

Não coloque a API Key do Resend no JavaScript do site nem no `runtime-config.js`.

### 3. Reativar confirmação de e-mail

Em `Authentication > Providers > Email`, ative novamente `Confirm email` antes de produção.

### 4. Trocar o template por código

Em `Authentication > Email Templates > Confirm signup`, use o arquivo:

`docs/SUPABASE-CONFIRMACAO-CODIGO.html`

O template usa `{{ .Token }}`. O usuário recebe um código numérico e o digita em `/confirmar-email/`.

### 5. Fluxo já programado na DeHax

Novo usuário:

`checkout -> pagamento -> confirmar-email -> digita código -> sessão confirmada -> /app/`

Cadastro gratuito:

`cadastro -> confirmar-email -> digita código -> sessão confirmada -> /app/`

A tela também possui `REENVIAR CÓDIGO` com um cooldown no navegador.

### 6. URLs

Confirme no Supabase que o Site URL é o domínio principal da DeHax e que os domínios usados em teste/produção estão na allow list de Redirect URLs.

Durante staging, inclua também a URL da branch `teste` se ainda for usar confirmação de e-mail nela.

### 7. Antes do lançamento

Faça um teste com um endereço real externo ao time do Supabase:

1. criar conta;
2. receber o código;
3. confirmar em `/confirmar-email/`;
4. entrar em `/app/`;
5. testar `REENVIAR CÓDIGO`.

