import fs from 'node:fs';
const required=[
  'index.html','portfolio/index.html','comunidade/index.html','entrar/index.html','app/index.html','admin/index.html','checkout/index.html','manager/index.html',
  'privacidade/index.html','termos/index.html','cookies/index.html','confirmar-email/index.html','assets/brand/dehax-logo.png',
  'assets/js/dehax-api.js','assets/js/member.js','assets/js/admin.js','assets/js/ui.js','assets/js/tracking.js','assets/js/site-settings.js','assets/js/manager-download.js',
  'netlify/functions/asset-access.mjs','netlify/functions/admin-upload-url.mjs','netlify/functions/create-subscription.mjs','netlify/functions/subscription-retention.mjs','netlify/functions/refund-request.mjs','netlify/functions/manage-retention-discounts.mjs',
  'netlify/functions/create-card-payment.mjs','netlify/functions/create-pix.mjs','netlify/functions/payment-status.mjs','netlify/functions/cancel-subscription.mjs','netlify/functions/mp-webhook.mjs','netlify/functions/ai-audio-status.mjs','netlify/functions/ai-audio-generate.mjs','netlify/functions/ai-audio-file.mjs','netlify/functions/cleanup-ai-audio.mjs','netlify/functions/account-overview.mjs','netlify/functions/account-update.mjs',
  'netlify/functions/tutorial-access.mjs','netlify/functions/track-event.mjs','netlify/functions/vod-analyze.mjs',
  'netlify/functions/vod-start.mjs','netlify/functions/vod-status.mjs','services/vod-worker/app.py',
  'services/vod-worker/Dockerfile','services/vod-worker/requirements.txt','supabase/schema.sql','supabase/migration-v3.0.0.sql','sitemap.xml','DEHAX-V3-ESCOPO.md','supabase/migration-v2.2.1.sql','supabase/migration-v2.2.2.sql','supabase/migration-v2.3.0.sql','supabase/migration-v2.3.1.sql','supabase/migration-v2.3.3.sql','netlify/functions/checkout-session.mjs','docs/R2-CORS.json','docs/R2-MEDIA-CORS.json','docs/SUPABASE-CONFIRMACAO-CODIGO.html','docs/SUPABASE-RECUPERACAO-SENHA-CODIGO.html','CONFIGURAR-EMAIL-RESEND.md'
];
let bad=false;
for(const f of required){if(!fs.existsSync(f)){console.error('MISSING',f);bad=true}}
const htmlFiles=['index.html','portfolio/index.html','comunidade/index.html','entrar/index.html','confirmar-email/index.html','app/index.html','admin/index.html','checkout/index.html','manager/index.html','privacidade/index.html','termos/index.html','cookies/index.html'];
for(const f of htmlFiles){
  const s=fs.readFileSync(f,'utf8');
  for(const m of s.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)){
    const local=m[1].slice(1);
    if(!fs.existsSync(local)){console.error('BROKEN REF',f,m[1]);bad=true}
  }
}
const forbidden=[['.env.example','DOWNLOAD_DAILY_LIMIT=500']];
for(const [f,txt] of forbidden){if(fs.existsSync(f)&&fs.readFileSync(f,'utf8').includes(txt)){console.error('STALE VALUE',f,txt);bad=true}}
if(bad)process.exit(1);
console.log('DeHax V3.0.0 checks passed.');
