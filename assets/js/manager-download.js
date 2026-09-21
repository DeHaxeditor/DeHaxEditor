(() => {
  const FALLBACK = {
    version: '1.1.0',
    sha: '00ff33ed53b84d876b3dd28f3462ec5980fcce7eb8c3394a761fa4a349765cd3',
    size: '≈ 77 MB',
    url: ''
  };
  const cfg = window.DEHAX_CONFIG || {};
  const setText = (selector, value) => document.querySelectorAll(selector).forEach(el => { el.textContent = String(value || ''); });

  function apply(settings) {
    const version = String(settings.manager_version || FALLBACK.version);
    const sha = String(settings.manager_sha256 || FALLBACK.sha);
    const size = String(settings.manager_file_size || FALLBACK.size);
    const url = String(settings.manager_download_url || '').trim();

    setText('[data-manager-version]', version);
    setText('[data-manager-sha]', sha);
    setText('[data-manager-size]', size);
    setText('[data-manager-status]', url ? 'Download disponível · Windows 10/11 · x64' : 'Instalador ainda não publicado. Volte em breve.');

    document.querySelectorAll('[data-manager-download]').forEach(link => {
      if (url) {
        link.href = url;
        link.removeAttribute('aria-disabled');
        link.dataset.ready = '1';
        link.onclick = null;
      } else {
        link.href = '/manager/';
        link.setAttribute('aria-disabled', 'true');
        link.dataset.ready = '0';
        link.onclick = event => {
          if (location.pathname === '/manager/' || location.pathname === '/manager/index.html') event.preventDefault();
        };
      }
    });
  }

  async function load() {
    apply(FALLBACK);
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return;
    try {
      const keys = 'manager_download_url,manager_version,manager_sha256,manager_file_size';
      const url = cfg.supabaseUrl + '/rest/v1/app_settings?key=in.(' + keys + ')&select=key,value';
      const response = await fetch(url, { headers: { apikey: cfg.supabaseAnonKey }, cache: 'no-store' });
      if (!response.ok) return;
      const settings = {};
      for (const row of await response.json()) settings[row.key] = row.value;
      apply({ ...FALLBACK, ...settings });
    } catch {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();
