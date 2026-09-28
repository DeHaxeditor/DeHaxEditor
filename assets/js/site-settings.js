(() => {
  const DEFAULT_LOGO = '/assets/brand/dehax-logo.png?v=20260928';
  let localContent = {};

  function normalizeLogo(value) {
    const src = typeof value === 'string' ? value.trim() : '';
    if (!src) return DEFAULT_LOGO;
    try {
      const url = new URL(src, location.origin + '/');
      if (!['http:', 'https:'].includes(url.protocol)) return DEFAULT_LOGO;
      if (url.origin === location.origin && url.pathname === '/assets/brand/dehax-logo.png') return DEFAULT_LOGO;
      return url.href;
    } catch { return DEFAULT_LOGO; }
  }

  function resolveLogo(settings = {}, content = localContent) {
    const brand = normalizeLogo(settings.brand_logo_url);
    if (brand !== DEFAULT_LOGO) return brand;
    // Older uploads were stored only in the public site's content.
    const publicLogo = settings.public_site_content?.logo;
    return normalizeLogo(publicLogo || content.logo);
  }

  function apply(settings = {}) {
    const colors = {brand_red: '--red', brand_cyan: '--cyan', brand_background: '--bg'};
    for (const [key, property] of Object.entries(colors)) {
      if (settings[key]) document.documentElement.style.setProperty(property, String(settings[key]));
    }
    const logo = resolveLogo(settings);
    document.querySelectorAll('img[data-brand-logo]').forEach(img => {
      img.onerror = () => {
        img.onerror = null;
        img.src = DEFAULT_LOGO;
      };
      img.src = logo;
      img.hidden = false;
    });
    document.querySelectorAll('.brand-fallback').forEach(el => {
      el.hidden = true;
      el.style.display = 'none';
    });
    document.querySelectorAll('link[data-brand-logo]').forEach(icon => { icon.href = logo; });
  }

  async function readSettings() {
    const c = window.DEHAX_CONFIG || {};
    if (!c.supabaseUrl || !c.supabaseAnonKey) return {};
    try {
      const keys = 'brand_red,brand_cyan,brand_background,brand_logo_url,public_site_content';
      const r = await fetch(`${c.supabaseUrl}/rest/v1/app_settings?key=in.(${keys})&select=key,value`, {
        headers: {apikey: c.supabaseAnonKey}, cache: 'no-store'
      });
      if (!r.ok) return {};
      return Object.fromEntries((await r.json()).map(row => [row.key, row.value]));
    } catch { return {}; }
  }

  async function load() {
    apply();
    const [settings, content] = await Promise.all([
      readSettings(),
      fetch('/content/site.json', {cache: 'no-store'}).then(r => r.ok ? r.json() : {}).catch(() => ({}))
    ]);
    localContent = content || {};
    apply(settings);
    return settings;
  }

  window.DehaxBrand = {DEFAULT_LOGO, normalizeLogo, resolveLogo, apply};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, {once: true});
  else load();
})();
