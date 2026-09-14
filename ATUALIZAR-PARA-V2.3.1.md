# Atualizar DeHax V2.3.0 → V2.3.1

Esta versão mantém o checkout/pagamentos da V2.2.9/V2.3.0 e concentra os ajustes de IA de áudio e área da conta.

## 1. Supabase
Execute **uma única vez** no SQL Editor:

`supabase/migration-v2.3.1.sql`

A migration adiciona custos separados de narração HQ e Flash e, somente quando os valores ainda estão nos defaults antigos, ajusta a recomendação inicial para:

- 150 tokens PRO / ciclo;
- 55 tokens / 1.000 caracteres para Multilingual v2 e Eleven v3;
- 28 tokens / 1.000 caracteres para Flash/Turbo;
- 1 token / segundo para efeitos sonoros;
- 30 vozes exibidas.

Se você já personalizou algum dos valores antigos, a migration não sobrescreve os campos que identifica como personalizados.

## 2. Netlify
Nenhuma variável nova é necessária. Mantenha `ELEVENLABS_API_KEY` configurada.

Substitua o projeto na branch `teste` pela V2.3.1 e aguarde o Branch Deploy.

## 3. O que testar

1. IA → apenas vozes compatíveis com o tier atual do ElevenLabs aparecem. Vozes com taxa customizada são excluídas para evitar custo imprevisível.
2. Preview → o mesmo botão alterna entre tocar e pausar.
3. SFX → continua gerando normalmente.
4. TTS → custo em tokens muda conforme o modelo (Flash é mais barato que v2/v3).
5. Download MP3 → deve baixar diretamente sem abrir o player em outra aba.
6. Conteúdo PRO numa conta FREE → abre o novo modal de planos com seletor 6 meses/mensal.
7. Rodapé lateral → Configurações + Sair.
8. Configurações → editar nome, trocar senha, assinatura, próxima cobrança/vencimento, tokens/armazenamento e histórico de pagamentos.

## 4. Observação sobre vozes
A V2.3.1 consulta o tier da própria conta ElevenLabs (`/v1/user/subscription`) e cruza com `available_for_tiers`. Também pede à API para não retornar vozes com custom rates. No Free, vozes compartilhadas da Voice Library são removidas porque a ElevenLabs não permite seu uso via API nesse tier.
