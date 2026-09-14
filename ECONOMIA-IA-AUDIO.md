# DeHax V2.3.1 — referência econômica da IA de Áudio

Referência preparada em 14/09/2026 para parametrizar o sistema interno de tokens. Os preços do provedor podem mudar; confira a página oficial da ElevenLabs antes de reajustes comerciais.

## Base recomendada inicial

- 150 tokens DeHax por ciclo de 30 dias para qualquer assinante PRO.
- Narração HQ (Eleven Multilingual v2 / Eleven v3): 55 tokens por 1.000 caracteres, calculados proporcionalmente ao tamanho real do texto e arredondados para cima.
- Narração rápida (Flash/Turbo): 28 tokens por 1.000 caracteres, também proporcional.
- Efeito sonoro: 1 token por segundo.
- Arquivos: 1 GB por usuário e 30 dias de retenção como ponto de partida.

## Por que 150 tokens

A referência pública da ElevenAPI indica aproximadamente US$ 0,10 por 1.000 caracteres para v2/v3, US$ 0,05 por 1.000 para Flash/Turbo e US$ 0,12 por minuto para efeitos sonoros. Usando câmbio em torno de R$ 5,14/US$ no dia desta revisão, o teto teórico de custo de provedor para um usuário que consuma os 150 tokens inteiros em um único tipo de geração fica aproximadamente entre R$ 1,38 e R$ 1,55 por ciclo.

Isso deixa uma margem prudente tanto no mensal de R$ 19,90 quanto no equivalente mensal do semestral de R$ 9,90, sem transformar a IA na principal fonte de custo do plano.

## Exemplos

- 500 caracteres em HQ: 28 tokens.
- 1.000 caracteres em HQ: 55 tokens.
- 2.000 caracteres em HQ: 110 tokens.
- 500 caracteres em Flash: 14 tokens.
- 1.000 caracteres em Flash: 28 tokens.
- 5 segundos de SFX: 5 tokens.
- 30 segundos de SFX: 30 tokens.

## Vozes

A V2.3.1 consulta o tier real da conta ElevenLabs e mostra somente vozes compatíveis com esse tier. Por padrão, vozes com custom rates / multiplicadores são excluídas, porque o multiplicador efetivo pode variar e tornaria o custo interno imprevisível. O Admin pode aumentar a quantidade de vozes exibidas para até 100, mantendo o filtro de custo padrão.

## Escala do provedor

Comece em um plano pago que permita o uso comercial necessário e acompanhe o Analytics da ElevenLabs. Não dimensione apenas pelo número total de assinantes: dimensione pelos usuários que efetivamente consomem IA e pelo consumo médio por ciclo. Quando o uso real se aproximar consistentemente da franquia do provedor, compare o upgrade de plano com PAYG/top-ups.
