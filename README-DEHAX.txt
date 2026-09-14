DEHAX EDITOR PLATFORM V2.3.0.

Base: Netlify + Supabase + Cloudflare R2 + YouTube não listado + Mercado Pago.

NOVIDADES V2.3.0
1. PRO Mensal não pode comprar outro mensal; pode apenas fazer upgrade para Semestral.
2. PRO Semestral não pode comprar PRO novamente enquanto o acesso estiver ativo.
3. Confirmação de e-mail por código pronta em /confirmar-email/.
4. Guia de SMTP profissional: CONFIGURAR-EMAIL-RESEND.md.
5. IA de Áudio disponível na interface FREE + PRO: texto → narração e texto → SFX.
6. FREE explora a IA, mas gerar leva ao upgrade. PRO vê saldo/custo em tokens.
7. Admin controla tokens, custos, retenção, GB por usuário e limites de geração.
8. Upload de áudio continua em standby; nenhuma entrada de áudio é aceita nesta etapa.
9. Resultados de IA ficam no R2 privado e expiram de acordo com a retenção configurada.

ATUALIZAÇÃO A PARTIR DA V2.2.9
- Execute supabase/migration-v2.3.0.sql uma única vez.
- Veja ATUALIZAR-PARA-V2.3.0.md.
- Mercado Pago validado na V2.2.9 permanece sem mudanças de credenciais.
- Para geração real de IA, configure ELEVENLABS_API_KEY e depois ative no Admin.
