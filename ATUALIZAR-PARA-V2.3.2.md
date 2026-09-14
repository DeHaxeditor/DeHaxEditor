# Atualizar DeHax V2.3.1 → V2.3.2

Esta versão adiciona recuperação de senha por código e corrige três regras de interface/conta.

## 1. Recuperação de senha no login

A tela `/entrar/` agora possui **ESQUECI MINHA SENHA**. O fluxo é:

`informa e-mail -> recebe código -> valida código -> libera nova senha -> salva -> volta ao login`

A nova senha exige no mínimo 8 caracteres. Depois da alteração, a sessão de recuperação é encerrada e o usuário volta ao formulário de login.

## 2. Template de e-mail de recuperação no Supabase

No Supabase, abra `Authentication > Email Templates > Reset password` (ou `Recovery`, conforme o rótulo do painel).

Assunto recomendado:

`Código para redefinir sua senha — DeHax Editor`

Substitua o conteúdo pelo arquivo:

`docs/SUPABASE-RECUPERACAO-SENHA-CODIGO.html`

O template usa `{{ .Token }}`. Não use `{{ .ConfirmationURL }}` neste fluxo, porque a DeHax valida o código manualmente com OTP do tipo `recovery`.

## 3. Correções incluídas

- Conta FREE agora recebe **0 tokens**. A franquia configurada (ex.: 150) pertence somente ao PRO.
- O botão **CANCELAR RECORRÊNCIA** só aparece para PRO Mensal recorrente ativo. FREE não vê mais essa opção.
- Na confirmação de e-mail, **REENVIAR CÓDIGO** começa bloqueado e mostra uma contagem regressiva de 60 segundos. Após cada reenvio, a contagem reinicia.
- A recuperação de senha também usa contagem de 60 segundos antes de permitir novo código.

## 4. Banco / Netlify

Não existe migration nova nesta versão e nenhuma variável de ambiente nova é necessária.

Substitua os arquivos da V2.3.1 pela V2.3.2 e publique normalmente.

## 5. Teste recomendado

1. Conta FREE: abrir IA e Configurações; confirmar `0 / 0` tokens e ausência de cancelamento.
2. Criar conta nova: confirmar que o botão de reenvio conta de 60 até 0.
3. Login: clicar em **ESQUECI MINHA SENHA**, solicitar código e conferir o e-mail personalizado.
4. Digitar código inválido e confirmar que a senha continua bloqueada.
5. Digitar código válido, definir nova senha e confirmar retorno ao login.
6. Entrar com a nova senha.
7. PRO Mensal recorrente: confirmar que o cancelamento continua aparecendo apenas nesse caso.
