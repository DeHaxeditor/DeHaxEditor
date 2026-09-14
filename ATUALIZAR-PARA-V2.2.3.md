# Atualização DeHax V2.2.2 → V2.2.3

Esta versão corrige o fluxo de cadastro no checkout e transforma a compra em uma única etapa.

## O que mudou

- novo usuário preenche nome, e-mail, confirmação de e-mail, senha e pagamento na mesma tela;
- não existe mais o botão intermediário “Criar conta e continuar”;
- a conta é preparada quando o cliente clica em pagar/gerar Pix;
- correção do parse da resposta REST do Supabase Auth `/signup` quando a confirmação de e-mail está ativa;
- e-mail já cadastrado é detectado no checkout: nome, confirmação de e-mail e senha ficam bloqueados; o cliente confirma que o endereço é dele e pode pagar sem login;
- usuário logado recebe nome/e-mail automaticamente e preenche somente o pagamento;
- pós-pagamento segue três fluxos: novo usuário confirma o e-mail e vai ao login; usuário logado vai para a área de membros; usuário existente não logado vai ao login;
- Pix de sandbox inclui `payer.first_name = APRO` quando `MP_TEST_MODE=true`.

## Banco de dados

Não há migration nova. Se as migrations V2.2.1 e V2.2.2 já foram executadas, não rode SQL adicional.

## Netlify

Não há variável nova. Mantenha as variáveis Mercado Pago e Supabase já configuradas.

## Supabase Auth

Mantenha **Confirm Email** habilitado. Inclua a URL da branch de teste nos Redirect URLs do Supabase para que o link de confirmação possa retornar para `/entrar/?confirmed=1`.

## Publicação

Substitua os arquivos da V2.2.2 pelos da V2.2.3 na branch `teste`, faça um commit e aguarde o Branch Deploy. Depois teste primeiro cartão mensal, depois cartão semestral, Pix mensal e Pix semestral.
