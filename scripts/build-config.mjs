import fs from 'node:fs';
const cfg = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  siteUrl: process.env.URL || process.env.DEPLOY_PRIME_URL || '',
  checkoutFallbackUrl: process.env.MP_CHECKOUT_FALLBACK_URL || '',
  mpPublicKey: process.env.MP_SUBSCRIPTIONS_PUBLIC_KEY || process.env.MP_PUBLIC_KEY || '',
  mpSubscriptionsPublicKey: process.env.MP_SUBSCRIPTIONS_PUBLIC_KEY || process.env.MP_PUBLIC_KEY || '',
  mpOrdersPublicKey: process.env.MP_ORDERS_PUBLIC_KEY || '',
  mpTestMode: String(process.env.MP_TEST_MODE || '').toLowerCase() === 'true',
  metaPixelId: process.env.META_PIXEL_ID || '',
  demoMode: String(process.env.DEHAX_DEMO_MODE || '').toLowerCase() === 'true'
};
fs.mkdirSync('assets/js', {recursive:true});
fs.writeFileSync('assets/js/runtime-config.js', `window.DEHAX_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`);
console.log('DeHax runtime config generated.');
