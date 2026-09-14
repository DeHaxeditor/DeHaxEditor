DEHAX EDITOR PLATFORM V2.2.2.

Base: Netlify + Supabase + Cloudflare R2 + YouTube não listado + Mercado Pago.

ATUALIZAÇÃO IMPORTANTE
1. Em projeto já configurado, execute supabase/migration-v2.2.1.sql no SQL Editor.
2. Configure as novas variáveis Mercado Pago descritas em README-DEHAX-V2.md.
3. Mensal: R$ 19,90/mês recorrente via Card Payment Brick + Assinaturas.
4. Semestral: R$ 59,40 à vista (equiv. R$ 9,90/mês), cartão 1x ou Pix, acesso por 6 meses.
5. Cartão é tokenizado pelo Mercado Pago. A DeHax não armazena PAN, validade ou CVV.
6. Pix usa token separado da Orders API.
7. Webhook suporta assinatura, payment e order, com validação x-signature quando os segredos estão configurados.
8. Miniaturas de vídeos/imagens aparecem na biblioteca.

Veja README-DEHAX-V2.md e CONFIGURAR-AMANHA.md para configuração completa.

PIX MENSAL: disponível como pagamento avulso. Renovação antecipada soma o novo período ao final do acesso atual, sem perda de dias. Aviso de vencimento configurável no Admin.

V2.2.2: depois da migration V2.2.1, execute supabase/migration-v2.2.2.sql.
Veja ATUALIZAR-PARA-V2.2.2.md.
