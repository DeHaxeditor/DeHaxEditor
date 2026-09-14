# Atualizar DeHax V2.2.9 → V2.3.0

Esta versão mantém os pagamentos validados da V2.2.9 e adiciona três blocos: proteção contra recompra de PRO, confirmação de e-mail por código e infraestrutura/interface de IA de áudio.

## 1. Subir os arquivos

Substitua a V2.2.9 pela V2.3.0 na branch `teste` e aguarde o Branch Deploy.

As credenciais Mercado Pago que já funcionam não precisam ser alteradas.

## 2. Executar a migration

No Supabase SQL Editor execute **uma única vez**:

`supabase/migration-v2.3.0.sql`

Ela cria `ai_audio_generations`, as policies e os valores iniciais de configuração da IA.

## 3. Testar a proteção dos planos

- FREE: pode contratar Mensal ou Semestral.
- PRO Mensal: não pode comprar outro Mensal; pode somente fazer upgrade para Semestral.
- Upgrade Mensal → Semestral: a recorrência mensal é cancelada somente depois que o pagamento semestral é aprovado; o período mensal já pago é preservado antes de começar os 6 meses.
- PRO Semestral: nova compra PRO é bloqueada pelo frontend e pelo backend.

Teste pelo menos um bloqueio de recompra em conta PRO antes de produção.

## 4. E-mail profissional / código

A página `/confirmar-email/` já está pronta.

Para ativar em produção, siga `CONFIGURAR-EMAIL-RESEND.md`:

1. configurar Resend + domínio de envio;
2. conectar o SMTP no Supabase;
3. reativar `Confirm email`;
4. aplicar `docs/SUPABASE-CONFIRMACAO-CODIGO.html` em `Confirm signup`.

O fluxo final é: conta criada → recebe código → digita no site → Supabase confirma e cria sessão → `/app/`.

## 5. IA de áudio

A interface aparece em `/app/#audioai` para FREE e PRO.

FREE:
- explora a interface;
- pode ouvir previews de voz quando o provedor estiver conectado;
- ao gerar, é direcionado ao upgrade PRO.

PRO:
- vê saldo e custo antes de gerar;
- pode gerar Narração (texto → voz) e Efeito Sonoro (texto → SFX);
- resultados ficam na biblioteca privada pelo período definido no Admin.

### Para conectar o provedor

Adicione no Netlify, somente quando quiser iniciar testes reais:

`ELEVENLABS_API_KEY=...`

Depois, no Admin → `IA de Áudio`, configure tokens/custos/armazenamento e ative `Ativar geração real`.

A chave é usada somente por Netlify Functions e não é exposta no navegador.

### Limpeza dos arquivos

`cleanup-ai-audio` é uma Scheduled Function diária. Em Branch Deploy ela não roda automaticamente; use `Run now` na tela da Function para testar. Em produção publicada, a execução diária passa a ocorrer automaticamente.

## 6. Upload de áudio

Continua em standby. A V2.3.0 aceita apenas entrada em texto. Nenhum arquivo de áudio do usuário é enviado ao provedor nessa etapa.
