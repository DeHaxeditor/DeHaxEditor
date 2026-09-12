import fs from 'node:fs';
const cfg = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  siteUrl: process.env.URL || process.env.DEPLOY_PRIME_URL || '',
  checkoutFallbackUrl: process.env.MP_CHECKOUT_FALLBACK_URL || '',
  metaPixelId: process.env.META_PIXEL_ID || '',
  demoMode: String(process.env.DEHAX_DEMO_MODE || '').toLowerCase() === 'true'
};
fs.mkdirSync('assets/js', {recursive:true});
fs.writeFileSync('assets/js/runtime-config.js', `window.DEHAX_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`);
console.log('DeHax runtime config generated.');
