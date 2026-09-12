import fs from 'node:fs';
import path from 'node:path';
const required=['index.html','comunidade/index.html','entrar/index.html','app/index.html','admin/index.html','assets/brand/dehax-logo.png','assets/js/dehax-api.js','assets/js/member.js','assets/js/admin.js','netlify/functions/asset-access.mjs','supabase/schema.sql'];
let bad=false;
for(const f of required){if(!fs.existsSync(f)){console.error('MISSING',f);bad=true}}
const htmlFiles=['index.html','comunidade/index.html','entrar/index.html','app/index.html','admin/index.html'];
for(const f of htmlFiles){const s=fs.readFileSync(f,'utf8');for(const m of s.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)){const local=m[1].slice(1);if(!fs.existsSync(local)){console.error('BROKEN REF',f,m[1]);bad=true}}}
if(bad)process.exit(1);console.log('DeHax checks passed.');
