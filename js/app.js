(() => {
  'use strict';

  const RAW_CONFIG = window.LAPIS_CONFIG || {};
  const CONFIG = {
    ...RAW_CONFIG,
    apiUrl: RAW_CONFIG.API_URL || '',
    baseUrl: RAW_CONFIG.SITE_URL || '',
    sourceUrl: RAW_CONFIG.SOURCE_URL || '',
    bpsUrl: RAW_CONFIG.BPS_URL || '',
    contact: RAW_CONFIG.CONTACT || {},
    analyticsMeasurementId: RAW_CONFIG.ANALYTICS_MEASUREMENT_ID || '',
    pages: RAW_CONFIG.PAGES || {},
    siteName: RAW_CONFIG.SITE_NAME || 'LAPIS',
    shortName: RAW_CONFIG.SHORT_NAME || 'LAPIS'
  };
  const state = {
    data: null,
    page: CONFIG.initialPage || 'home',
    charts: [],
    searchIndex: [],
    theme: null
  };

  const PAGE_NAMES = {
    home: 'Beranda',
    inflasi: 'Inflasi',
    kemiskinan: 'Kemiskinan',
    ketenagakerjaan: 'Ketenagakerjaan',
    ekonomi: 'Pertumbuhan Ekonomi',
    ipm: 'Indeks Pembangunan Manusia',
    kependudukan: 'Kependudukan',
    tentang: 'Tentang LAPIS',
    privasi: 'Kebijakan Privasi',
    ketentuan: 'Ketentuan Penggunaan',
    404: 'Halaman Tidak Ditemukan'
  };

  const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    state.page = getPageFromUrl();
    initTheme();
    initChrome();
    initConsent();
    captureUtm();
    $('#footer-year').textContent = String(new Date().getFullYear());
    loadData();
  }

  function initChrome() {
    $('#theme-button')?.addEventListener('click', toggleTheme);
    $('#menu-button')?.addEventListener('click', toggleMobileMenu);
    $('#search-button')?.addEventListener('click', () => openSearch(''));
    $('#search-close')?.addEventListener('click', closeSearch);
    $('#search-input')?.addEventListener('input', onSearchInput);
    $('#retry-button')?.addEventListener('click', loadData);
    $('#back-to-top')?.addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));
    $('#mobile-cta')?.addEventListener('click', () => {
      if (state.page === 'home') {
        $('#indikator')?.scrollIntoView({behavior:'smooth',block:'start'});
      } else {
        navigate('home', true);
        setTimeout(() => $('#indikator')?.scrollIntoView({behavior:'smooth',block:'start'}), 60);
      }
    });

    window.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('popstate', () => {
      const page = getPageFromUrl();
      renderPage(isKnownPage(page) ? page : '404', false);
    });

    document.addEventListener('click', (event) => {
      const route = event.target.closest('[data-route]');
      if (route) {
        const page = route.dataset.route;
        if (isKnownPage(page) && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button !== 1) {
          event.preventDefault();
          navigate(page, true);
          return;
        }
      }

      const action = event.target.closest('[data-action]');
      if (!action) return;

      const type = action.dataset.action;
      if (type === 'copy-link') copyCurrentLink(action);
      if (type === 'open-search') openSearch(action.dataset.query || '');
      if (type === 'copy-sheet') copySheetCsv(action.dataset.sheet, action);
      if (type === 'download-sheet') downloadSheetCsv(action.dataset.sheet);
    });

    $('#search-dialog')?.addEventListener('close', () => document.body.classList.remove('dialog-open'));
    onScroll();
  }

  function loadData() {
    showLoading();

    const apiUrl = String(CONFIG.apiUrl || '').trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/i.test(apiUrl)) {
      showError('API LAPIS belum dikonfigurasi. Isi API_URL pada js/config.js dengan URL /exec dari Google Apps Script.');
      return;
    }

    const callbackName = `__lapisJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timeoutMs = 20000;
    let settled = false;

    const cleanup = () => {
      try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
      script.remove();
    };

    const fail = (message) => {
      if (settled) return;
      settled = true;
      cleanup();
      showError(message);
    };

    const timer = setTimeout(() => {
      fail('Permintaan data melewati batas waktu. Periksa deployment API Apps Script dan koneksi internet.');
    }, timeoutMs);

    window[callbackName] = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();

      if (!payload || payload.ok === false) {
        showError(payload?.error || 'API LAPIS mengembalikan respons yang tidak valid.');
        return;
      }

      state.data = payload.data || payload;
      buildSearchIndex();
      updateDataStatus();
      renderPage(isKnownPage(state.page) ? state.page : '404', false);
      $('#app-loading').hidden = true;
      $('#app-error').hidden = true;
      $('#app-view').hidden = false;
      announce('Data LAPIS berhasil dimuat.');
    };

    script.onerror = () => {
      clearTimeout(timer);
      fail('API LAPIS tidak dapat dihubungi. Pastikan deployment Apps Script dapat diakses oleh Anyone dan URL /exec sudah benar.');
    };

    const separator = apiUrl.includes('?') ? '&' : '?';
    script.src = `${apiUrl}${separator}api=data&callback=${encodeURIComponent(callbackName)}&_=${Date.now()}`;
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    document.head.appendChild(script);
  }

  function showLoading() {
    $('#app-loading').hidden = false;
    $('#app-error').hidden = true;
    $('#app-view').hidden = true;
    $('#data-status').textContent = 'Menyiapkan data...';
  }

  function showError(message) {
    $('#app-loading').hidden = true;
    $('#app-view').hidden = true;
    $('#app-error').hidden = false;
    $('#error-message').textContent = message;
    $('#data-status').textContent = 'Data tidak tersedia';
    announce('Data LAPIS gagal dimuat.');
  }

  function updateDataStatus() {
    $('#data-status').textContent = 'Data terhubung';
    const iso = state.data?.meta?.lastUpdated;
    $('#last-updated').textContent = 'Pembaruan sumber: ' + (iso ? formatDateTime(iso) : 'tidak tersedia');
  }

  function getPageFromUrl() {
    try {
      return new URL(location.href).searchParams.get('page') || 'home';
    } catch (_) {
      return 'home';
    }
  }

  function getSiteBaseUrl() {
    const configured = String(CONFIG.baseUrl || '').trim();
    if (/^https?:\/\//i.test(configured)) {
      return configured.endsWith('/') ? configured : `${configured}/`;
    }
    // GitHub Project Pages: current index pathname already includes /REPO/.
    const path = location.pathname.endsWith('/')
      ? location.pathname
      : location.pathname.replace(/[^/]*$/, '');
    return `${location.origin}${path}`;
  }

  function isKnownPage(page) {
    return Object.prototype.hasOwnProperty.call(PAGE_NAMES, page);
  }

  function navigate(page, pushState) {
    if (!isKnownPage(page)) page = '404';
    renderPage(page, pushState);
    closeMobileMenu();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function renderPage(page, pushState) {
    destroyCharts();
    state.page = page;

    if (pushState) {
      const base = getSiteBaseUrl();
      const url = `${base}?page=${encodeURIComponent(page)}`;
      history.pushState({page}, '', url);
    }

    updateMeta(page);
    updateNavigation(page);

    const view = $('#app-view');
    if (!view) return;

    const renderers = {
      home: renderHome,
      inflasi: renderInflasi,
      kemiskinan: renderKemiskinan,
      ketenagakerjaan: renderKetenagakerjaan,
      ekonomi: renderEkonomi,
      ipm: renderIpm,
      kependudukan: renderKependudukan,
      tentang: renderTentang,
      privasi: renderPrivasi,
      ketentuan: renderKetentuan,
      404: render404
    };

    view.innerHTML = (renderers[page] || render404)();
    bindPageControls(page);
    requestAnimationFrame(() => initPageCharts(page));
    trackEvent('page_view', {page_title: PAGE_NAMES[page], page_path: `?page=${page}`});
  }

  function updateMeta(page) {
    const meta = CONFIG.pages?.[page] || CONFIG.pages?.['404'] || {};
    const title = meta.title || PAGE_NAMES[page] || 'LAPIS';
    const description = meta.description || '';

    document.title = title;

    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);

    const canonical = $('#canonical-link');
    if (canonical) canonical.href = `${getSiteBaseUrl()}?page=${encodeURIComponent(page)}`;
  }

  function setMeta(attr, key, value) {
    const el = document.querySelector(`meta[${attr}="${key}"]`);
    if (el) el.setAttribute('content', value || '');
  }

  function updateNavigation(page) {
    $$('[data-route]').forEach(el => {
      const active = el.dataset.route === page;
      el.classList.toggle('active', active);
      if (active) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
  }

  function bindPageControls(page) {
    if (page === 'home') {
      $('#hero-search-button')?.addEventListener('click', () => openSearch($('#hero-search-input')?.value || ''));
      $('#hero-search-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') openSearch(e.currentTarget.value);
      });
    }

    if (page === 'ekonomi') {
      $('#distribution-year')?.addEventListener('change', () => {
        destroyChartById('chart-distribusi');
        renderDistributionChart($('#distribution-year').value);
      });
    }

    if (page === 'kependudukan') {
      $('#pyramid-year')?.addEventListener('change', () => {
        destroyChartById('chart-pyramid');
        renderPopulationPyramid($('#pyramid-year').value);
      });
    }
  }

  // ---------- Theme ----------
  function initTheme() {
    const stored = localStorage.getItem('lapis-theme');
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(stored || (systemDark ? 'dark' : 'light'), false);
  }

  function toggleTheme() {
    setTheme(state.theme === 'dark' ? 'light' : 'dark', true);
  }

  function setTheme(theme, rerenderCharts) {
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('lapis-theme', theme);
    $('#theme-color-meta')?.setAttribute('content', theme === 'dark' ? '#08131f' : '#0b3154');

    if (rerenderCharts && state.data) {
      requestAnimationFrame(() => {
        destroyCharts();
        initPageCharts(state.page);
      });
    }
  }

  // ---------- Header / scroll ----------
  function toggleMobileMenu() {
    const menu = $('#mobile-menu');
    const button = $('#menu-button');
    if (!menu || !button) return;
    const opening = menu.hidden;
    menu.hidden = !opening;
    button.setAttribute('aria-expanded', String(opening));
  }

  function closeMobileMenu() {
    const menu = $('#mobile-menu');
    const button = $('#menu-button');
    if (menu) menu.hidden = true;
    if (button) button.setAttribute('aria-expanded', 'false');
  }

  function onScroll() {
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    const ratio = Math.min(1, Math.max(0, window.scrollY / max));
    $('#scroll-progress').style.width = `${ratio * 100}%`;
    $('#back-to-top')?.classList.toggle('visible', window.scrollY > 520);
  }

  // ---------- Data helpers ----------
  function sheet(name) {
    return state.data?.sheets?.[name] || {headers:[],rows:[]};
  }

  function rowObjects(name) {
    const s = sheet(name);
    return s.rows.map(row => {
      const o = {};
      s.headers.forEach((h, i) => o[h] = row[i] ?? null);
      return o;
    });
  }

  function findWideRow(name, labelTest) {
    const s = sheet(name);
    const row = s.rows.find(r => labelTest(String(r[0] ?? '')));
    if (!row) return null;
    const result = {label: row[0], values: {}};
    s.headers.slice(1).forEach((h, i) => result.values[String(h)] = row[i + 1] ?? null);
    return result;
  }

  function wideYears(name) {
    return sheet(name).headers.slice(1).filter(Boolean).map(String);
  }

  function latestWide(name, labelTest) {
    const row = findWideRow(name, labelTest);
    if (!row) return {year:null,value:null,previous:null};
    const years = Object.keys(row.values).filter(y => isFinite(Number(y))).sort((a,b) => Number(a)-Number(b));
    let latest = null;
    let prev = null;
    years.forEach(y => {
      const v = asNumber(row.values[y]);
      if (v !== null) {
        prev = latest;
        latest = {year:y,value:v};
      }
    });
    return {
      year: latest?.year || null,
      value: latest?.value ?? null,
      previous: prev?.value ?? null
    };
  }

  function latestRow(name) {
    const rows = rowObjects(name).filter(r => r.TAHUN !== null && r.TAHUN !== undefined);
    rows.sort((a,b) => Number(a.TAHUN)-Number(b.TAHUN));
    return rows[rows.length - 1] || {};
  }

  function latestInflation(name) {
    const s = sheet(name);
    const years = s.headers.slice(1).filter(h => /^\d{4}$/.test(String(h))).sort((a,b) => Number(a)-Number(b));
    const year = String(years[years.length - 1] || '');
    const col = s.headers.findIndex(h => String(h) === year);
    if (col < 0) return {year:null,month:null,value:null,previous:null};

    let last = null;
    let prev = null;
    s.rows.forEach(row => {
      const v = asNumber(row[col]);
      if (v !== null) {
        prev = last;
        last = {month: row[0], value: v};
      }
    });
    return {year, month:last?.month || null, value:last?.value ?? null, previous:prev?.value ?? null};
  }

  function asNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed === '-' || trimmed === '–') return null;
    const normalized = trimmed
      .replace(/\s/g, '')
      .replace(/\.(?=\d{3}(?:\D|$))/g, '')
      .replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  function numericSeries(name, rowPredicate) {
    const row = findWideRow(name, rowPredicate);
    if (!row) return {labels:[],values:[]};
    const labels = [];
    const values = [];
    Object.entries(row.values).forEach(([year, value]) => {
      if (!/^\d{4}$/.test(year)) return;
      const n = asNumber(value);
      if (n === null) return;
      labels.push(year);
      values.push(n);
    });
    return {labels, values, label:String(row.label)};
  }

  function inflationSeries(name) {
    const s = sheet(name);
    const labels = s.rows.map(r => String(r[0] ?? '')).filter(Boolean);
    const datasets = s.headers.slice(1)
      .filter(h => /^\d{4}$/.test(String(h)))
      .map((year, idx) => ({
        year:String(year),
        values:s.rows.map(r => asNumber(r[idx + 1]))
      }));
    return {labels,datasets};
  }

  function delta(current, previous) {
    if (current === null || previous === null || current === undefined || previous === undefined) return null;
    return current - previous;
  }

  function formatNumber(value, digits = 2) {
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
    return new Intl.NumberFormat('id-ID', {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0
    }).format(Number(value));
  }

  function formatInteger(value) {
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
    return new Intl.NumberFormat('id-ID', {maximumFractionDigits:0}).format(Number(value));
  }

  function formatDateTime(iso) {
    try {
      return new Intl.DateTimeFormat('id-ID', {
        dateStyle:'medium',
        timeStyle:'short',
        timeZone:'Asia/Jakarta'
      }).format(new Date(iso));
    } catch (_) {
      return '—';
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  // ---------- Reusable HTML ----------
  function pageHead(kicker, title, description) {
    return `
      <section class="page-head">
        <div class="container page-head-row">
          <div>
            <span class="eyebrow">${escapeHtml(kicker)}</span>
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(description)}</p>
          </div>
          <div class="page-actions">
            <button class="button secondary" type="button" data-action="copy-link">${icon('link')} Salin tautan</button>
            <button class="button secondary" type="button" onclick="window.print()">${icon('print')} Cetak</button>
          </div>
        </div>
      </section>`;
  }

  function sectionHead(kicker, title, description = '', actions = '') {
    return `
      <div class="section-head">
        <div>
          <span class="eyebrow">${escapeHtml(kicker)}</span>
          <h2>${escapeHtml(title)}</h2>
          ${description ? `<p>${escapeHtml(description)}</p>` : ''}
        </div>
        ${actions ? `<div class="section-actions">${actions}</div>` : ''}
      </div>`;
  }

  function metricCard({label,value,unit='',meta='',route='',digits=2}) {
    const tag = route ? 'a' : 'article';
    const href = route ? ` href="?page=${route}" data-route="${route}"` : '';
    return `
      <${tag} class="metric-card"${href}>
        ${route ? `<span class="metric-arrow">${icon('arrowUpRight')}</span>` : ''}
        <span class="metric-label">${escapeHtml(label)}</span>
        <span class="metric-value">${typeof value === 'string' ? escapeHtml(value) : formatNumber(value,digits)}${unit ? `<span class="metric-unit">${escapeHtml(unit)}</span>` : ''}</span>
        <div class="metric-meta">${escapeHtml(meta)}</div>
      </${tag}>`;
  }

  function chartCard({id,title,subtitle='',sheetName='',wide=false,tall=false,table=true,extraHead=''}) {
    const s = sheetName ? sheet(sheetName) : null;
    return `
      <article class="chart-card ${wide ? 'wide' : ''} ${tall ? 'tall' : ''}">
        <div class="chart-card-head">
          <div>
            <h3>${escapeHtml(title)}</h3>
            ${subtitle ? `<p class="chart-subtitle">${escapeHtml(subtitle)}</p>` : ''}
          </div>
          <div class="chart-tools">
            ${extraHead}
            ${sheetName ? `<button class="tool-button" type="button" data-action="copy-sheet" data-sheet="${sheetName}">Salin data</button>` : ''}
            ${sheetName ? `<button class="tool-button" type="button" data-action="download-sheet" data-sheet="${sheetName}">CSV</button>` : ''}
          </div>
        </div>
        <div class="chart-wrap"><canvas id="${id}" role="img" aria-label="${escapeHtml(title)}"></canvas></div>
        <div class="data-note">
          <span>Sumber: BPS Kota Pontianak</span>
          <a href="${escapeHtml(CONFIG.bpsUrl || '#')}" target="_blank" rel="noopener">Lihat sumber resmi</a>
        </div>
        ${table && s ? tableDetails(sheetName) : ''}
      </article>`;
  }

  function tableDetails(sheetName) {
    const s = sheet(sheetName);
    if (!s.headers.length) return '';
    const header = s.headers.map(h => `<th scope="col">${escapeHtml(h)}</th>`).join('');
    const body = s.rows.map(row => `<tr>${s.headers.map((_,i) => `<td>${formatCell(row[i])}</td>`).join('')}</tr>`).join('');
    return `
      <details class="table-details">
        <summary>Lihat tabel data</summary>
        <div class="table-shell">
          <table>
            <thead><tr>${header}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </details>`;
  }

  function formatCell(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number') return escapeHtml(formatNumber(value, 4));
    return escapeHtml(value);
  }

  function sourceFootnote() {
    const updated = state.data?.meta?.lastUpdated ? formatDateTime(state.data.meta.lastUpdated) : '—';
    return `
      <section class="section">
        <div class="container">
          <div class="content-card">
            <strong>Catatan penggunaan data</strong>
            <p>Angka pada LAPIS ditampilkan dari basis data yang dikelola BPS Kota Pontianak. Untuk definisi indikator, metodologi, status angka, dan rujukan resmi, silakan gunakan publikasi atau tabel statistik BPS. Pembaruan sumber terdeteksi pada <strong>${escapeHtml(updated)}</strong>.</p>
          </div>
        </div>
      </section>`;
  }

  function icon(name) {
    const paths = {
      arrowUpRight:'<path d="M7 17 17 7M8 7h9v9"/>',
      link:'<path d="M10 13a5 5 0 0 0 7.54.54l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15"/><path d="M14 11a5 5 0 0 0-7.54-.54l-2 2a5 5 0 0 0 7.07 7.07l1.15-1.15"/>',
      print:'<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',
      search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      map:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>',
      mail:'<path d="M4 5h16v14H4z"/><path d="m4 7 8 6 8-6"/>',
      phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  // ---------- Page: Home ----------
  function renderHome() {
    const population = latestRow('KEPENDUDUKAN');
    const poverty = latestRow('KEMISKINAN');
    const inflation = latestInflation('INFLASI_YTY');
    const growth = latestWide('PERTUMBUHAN_EKONOMI', label => /Produk Domestik Regional Bruto/i.test(label));
    const ipm = latestWide('IPM', label => /Indeks Pembangunan Manusia/i.test(label));
    const tpt = latestWide('ANGKATAN_KERJA', label => label === 'Tingkat Pengangguran Terbuka');

    const indicators = rowObjects('LIST_INDIKATOR');

    return `
      <div class="page">
        <section class="hero">
          <div class="container hero-inner">
            <div class="hero-grid">
              <div>
                <span class="eyebrow">BPS Kota Pontianak • Data Strategis</span>
                <h1>Angka penting Kota Pontianak, tanpa harus tersesat di banyak tabel.</h1>
                <p>LAPIS menyatukan indikator sosial dan ekonomi utama dalam satu portal yang ringkas untuk pemerintah, akademisi, peneliti, dan pengguna data.</p>
                <div class="hero-actions">
                  <a class="button primary" href="#indikator">Jelajahi indikator</a>
                  <button class="button secondary" type="button" data-action="open-search">${icon('search')} Cari data</button>
                </div>
              </div>
              <aside class="hero-panel" aria-label="Pencarian indikator">
                <strong>Butuh angka tertentu?</strong>
                <p>Cari indikator seperti inflasi, PDRB, TPT, kemiskinan, IPM, atau jumlah penduduk.</p>
                <div class="hero-search">
                  <input id="hero-search-input" type="search" placeholder="Cari indikator..." aria-label="Cari indikator LAPIS">
                  <button class="button primary small" type="button" id="hero-search-button">Cari</button>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="container">
            ${sectionHead('Snapshot terbaru','Enam angka untuk membaca kondisi kota','Nilai terbaru yang tersedia pada masing-masing seri data. Tahun/periode dapat berbeda antarindikator.')}
            <div class="metric-grid">
              ${metricCard({label:'Jumlah Penduduk',value:asNumber(population.JUMLAH_PENDUDUK),unit:'jiwa',meta:`${formatYear(population.TAHUN)}`,route:'kependudukan',digits:0})}
              ${metricCard({label:'Inflasi y-on-y',value:inflation.value,unit:'%',meta:`${inflation.month || '—'} ${inflation.year || ''}`,route:'inflasi'})}
              ${metricCard({label:'Penduduk Miskin (P0)',value:asNumber(poverty.P0),unit:'%',meta:`${formatYear(poverty.TAHUN)}`,route:'kemiskinan'})}
              ${metricCard({label:'Pertumbuhan Ekonomi',value:growth.value,unit:'%',meta:`${growth.year || '—'}`,route:'ekonomi'})}
              ${metricCard({label:'IPM',value:ipm.value,meta:`${ipm.year || '—'}`,route:'ipm'})}
              ${metricCard({label:'TPT',value:tpt.value,unit:'%',meta:`${tpt.year || '—'}`,route:'ketenagakerjaan'})}
            </div>
          </div>
        </section>

        <section class="section" id="indikator">
          <div class="container">
            ${sectionHead('Katalog indikator','Pilih topik yang ingin dibaca','Setiap halaman menyajikan angka utama, tren, tabel sumber, dan opsi salin/unduh data.')}
            <div class="catalog-grid">
              ${catalogCard('01','Inflasi','MTM, y-on-y, dan tahun kalender.','inflasi')}
              ${catalogCard('02','Kemiskinan','P0, P1, P2, penduduk miskin, dan garis kemiskinan.','kemiskinan')}
              ${catalogCard('03','Ketenagakerjaan','TPAK, TPT, angkatan kerja, dan bukan angkatan kerja.','ketenagakerjaan')}
              ${catalogCard('04','Pertumbuhan Ekonomi','Pertumbuhan, PDRB ADHB/ADHK, dan struktur ekonomi.','ekonomi')}
              ${catalogCard('05','IPM','IPM dan komponen pembentuk pembangunan manusia.','ipm')}
              ${catalogCard('06','Kependudukan','Penduduk, kepadatan, rasio, dan piramida umur.','kependudukan')}
              ${catalogCard('07','Produksi','Indikator produksi akan tampil setelah seri datanya tersedia.',null,true)}
              ${catalogCard('08','Tentang Data','Sumber, cara penggunaan, privasi, dan kontak layanan.','tentang')}
            </div>
          </div>
        </section>

        <section class="section">
          <div class="container">
            ${sectionHead('Tren cepat','Lihat arah pergerakan','Tiga grafik ringkas untuk memberi konteks sebelum masuk ke halaman indikator.')}
            <div class="chart-grid">
              ${chartCard({id:'chart-home-inflasi',title:'Inflasi y-on-y',subtitle:'Persen per bulan',sheetName:'INFLASI_YTY'})}
              ${chartCard({id:'chart-home-growth',title:'Pertumbuhan ekonomi',subtitle:'Persen per tahun',sheetName:'PERTUMBUHAN_EKONOMI'})}
              ${chartCard({id:'chart-home-ipm',title:'Indeks Pembangunan Manusia',subtitle:'Nilai IPM',sheetName:'IPM',wide:true})}
            </div>
          </div>
        </section>

        ${indicators.length ? `
        <section class="section">
          <div class="container">
            <div class="content-card">
              <span class="eyebrow">Cakupan LAPIS</span>
              <h2>Indikator disusun untuk kebutuhan baca cepat dan analisis awal.</h2>
              <p>Daftar indikator di bawah mengikuti master indikator pada spreadsheet sumber.</p>
              <div class="table-shell">
                <table>
                  <thead><tr><th>Bidang</th><th>Indikator</th></tr></thead>
                  <tbody>${indicators.map(r => `<tr><td>${escapeHtml(r.Bidang)}</td><td style="text-align:left;white-space:normal">${escapeHtml(r.Indikator)}</td></tr>`).join('')}</tbody>
                </table>
              </div>
            </div>
          </div>
        </section>` : ''}
      </div>`;
  }

  function catalogCard(index,title,description,route,disabled=false) {
    const tag = route ? 'a' : 'div';
    const attrs = route ? `href="?page=${route}" data-route="${route}"` : '';
    return `
      <${tag} class="catalog-card ${disabled ? 'disabled' : ''}" ${attrs}>
        <span class="catalog-index">${index}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
        <span class="catalog-link">${route ? 'Buka indikator →' : 'Data belum tersedia'}</span>
      </${tag}>`;
  }

  // ---------- Page: Inflasi ----------
  function renderInflasi() {
    const mtm = latestInflation('INFLASI_MTM');
    const yoy = latestInflation('INFLASI_YTY');
    const ytd = latestInflation('INFLASI_YTD');

    return `
      <div class="page">
        ${pageHead('Harga Konsumen','Inflasi Kota Pontianak','Perkembangan inflasi bulanan, tahunan (year-on-year), dan tahun kalender secara berdampingan.')}
        <section class="section">
          <div class="container">
            ${sectionHead('Periode terbaru','Tiga cara membaca inflasi','Nilai terbaru mengikuti bulan terakhir yang tersedia pada setiap seri.')}
            <div class="metric-grid">
              ${metricCard({label:'Inflasi month-to-month',value:mtm.value,unit:'%',meta:`${mtm.month || '—'} ${mtm.year || ''}`})}
              ${metricCard({label:'Inflasi year-on-year',value:yoy.value,unit:'%',meta:`${yoy.month || '—'} ${yoy.year || ''}`})}
              ${metricCard({label:'Inflasi tahun kalender',value:ytd.value,unit:'%',meta:`${ytd.month || '—'} ${ytd.year || ''}`})}
            </div>
          </div>
        </section>
        <section class="section">
          <div class="container">
            ${sectionHead('Tren bulanan','Bandingkan pola antar-tahun','Setiap garis mewakili tahun yang tersedia pada spreadsheet sumber.')}
            <div class="chart-grid">
              ${chartCard({id:'chart-inflasi-mtm',title:'Inflasi month-to-month',subtitle:'Perubahan terhadap bulan sebelumnya (%)',sheetName:'INFLASI_MTM'})}
              ${chartCard({id:'chart-inflasi-yoy',title:'Inflasi year-on-year',subtitle:'Perubahan terhadap bulan yang sama tahun sebelumnya (%)',sheetName:'INFLASI_YTY'})}
              ${chartCard({id:'chart-inflasi-ytd',title:'Inflasi tahun kalender',subtitle:'Perubahan sejak Desember tahun sebelumnya (%)',sheetName:'INFLASI_YTD',wide:true})}
            </div>
          </div>
        </section>
        ${sourceFootnote()}
      </div>`;
  }

  // ---------- Page: Kemiskinan ----------
  function renderKemiskinan() {
    const latest = latestRow('KEMISKINAN');
    return `
      <div class="page">
        ${pageHead('Sosial','Kemiskinan Kota Pontianak','Pantau jumlah penduduk miskin, P0, P1, P2, dan perkembangan garis kemiskinan.')}
        <section class="section">
          <div class="container">
            ${sectionHead('Kondisi terbaru',`Kemiskinan ${formatYear(latest.TAHUN)}`,'Ringkasan indikator kemiskinan pada tahun terbaru yang tersedia.')}
            <div class="metric-grid">
              ${metricCard({label:'Penduduk miskin',value:asNumber(latest['JUMLAH_PENDUDUK_MISKIN (RIBU)']),unit:'ribu orang',meta:`${formatYear(latest.TAHUN)}`})}
              ${metricCard({label:'Persentase penduduk miskin (P0)',value:asNumber(latest.P0),unit:'%',meta:`${formatYear(latest.TAHUN)}`})}
              ${metricCard({label:'Garis kemiskinan',value:asNumber(latest.GARIS_KEMISKINAN),unit:'Rp/kapita/bulan',meta:`${formatYear(latest.TAHUN)}`,digits:0})}
              ${metricCard({label:'Indeks kedalaman (P1)',value:asNumber(latest.P1),meta:`${formatYear(latest.TAHUN)}`})}
              ${metricCard({label:'Indeks keparahan (P2)',value:asNumber(latest.P2),meta:`${formatYear(latest.TAHUN)}`})}
            </div>
          </div>
        </section>
        <section class="section">
          <div class="container">
            ${sectionHead('Tren','Perubahan kemiskinan dari waktu ke waktu','Pisahkan ukuran prevalensi, kedalaman/keparahan, dan garis kemiskinan agar skalanya tetap mudah dibaca.')}
            <div class="chart-grid">
              ${chartCard({id:'chart-poverty-p0',title:'Penduduk miskin dan P0',subtitle:'Ribu orang dan persen',sheetName:'KEMISKINAN'})}
              ${chartCard({id:'chart-poverty-p1p2',title:'Kedalaman dan keparahan kemiskinan',subtitle:'P1 dan P2',sheetName:'KEMISKINAN'})}
              ${chartCard({id:'chart-poverty-line',title:'Garis kemiskinan',subtitle:'Rupiah per kapita per bulan',sheetName:'KEMISKINAN',wide:true})}
            </div>
          </div>
        </section>
        ${sourceFootnote()}
      </div>`;
  }

  // ---------- Page: Ketenagakerjaan ----------
  function renderKetenagakerjaan() {
    const tpt = latestWide('ANGKATAN_KERJA', label => label === 'Tingkat Pengangguran Terbuka');
    const tpak = latestWide('ANGKATAN_KERJA', label => label === 'Tingkat Partisipasi Angkatan Kerja');
    const ak = latestWide('ANGKATAN_KERJA', label => label === 'Angkatan Kerja');

    return `
      <div class="page">
        ${pageHead('Pasar Kerja','Ketenagakerjaan Kota Pontianak','Ringkasan TPT, TPAK, dan jumlah angkatan kerja serta perbandingan menurut jenis kelamin.')}
        <section class="section">
          <div class="container">
            ${sectionHead('Kondisi terbaru',`Pasar kerja ${tpt.year || '—'}`,'Indikator utama ketenagakerjaan dari tahun terbaru yang tersedia.')}
            <div class="metric-grid">
              ${metricCard({label:'Tingkat Pengangguran Terbuka',value:tpt.value,unit:'%',meta:`${tpt.year || '—'}`})}
              ${metricCard({label:'Tingkat Partisipasi Angkatan Kerja',value:tpak.value,unit:'%',meta:`${tpak.year || '—'}`})}
              ${metricCard({label:'Angkatan Kerja',value:ak.value,unit:'orang',meta:`${ak.year || '—'}`,digits:0})}
            </div>
          </div>
        </section>
        <section class="section">
          <div class="container">
            ${sectionHead('Tren & komposisi','Baca level total dan kesenjangan gender','Gunakan grafik tren untuk arah waktu dan grafik perbandingan untuk melihat kondisi laki-laki/perempuan.')}
            <div class="chart-grid">
              ${chartCard({id:'chart-labor-rate',title:'TPT dan TPAK total',subtitle:'Persen',sheetName:'ANGKATAN_KERJA'})}
              ${chartCard({id:'chart-labor-gender',title:'TPAK dan TPT menurut jenis kelamin',subtitle:`Tahun ${tpt.year || 'terbaru'} (%)`,sheetName:'ANGKATAN_KERJA'})}
              ${chartCard({id:'chart-labor-count',title:'Angkatan kerja dan bukan angkatan kerja',subtitle:'Orang',sheetName:'ANGKATAN_KERJA',wide:true})}
            </div>
          </div>
        </section>
        ${sourceFootnote()}
      </div>`;
  }

  // ---------- Page: Ekonomi ----------
  function renderEkonomi() {
    const growth = latestWide('PERTUMBUHAN_EKONOMI', label => /Produk Domestik Regional Bruto/i.test(label));
    const adhb = latestWide('PDRB_ADHB', label => /Produk Domestik Regional Bruto ADHB/i.test(label));
    const adhk = latestWide('PDRB_ADHK', label => /Produk Domestik Regional Bruto ADHK/i.test(label));
    const years = wideYears('DISTRIBUSI_PDRB');
    const latestYear = years[years.length - 1] || '';

    const yearControl = `<label class="control">Tahun
      <select id="distribution-year" aria-label="Pilih tahun distribusi PDRB">
        ${years.map(y => `<option value="${escapeHtml(y)}" ${y === latestYear ? 'selected' : ''}>${escapeHtml(y)}</option>`).join('')}
      </select>
    </label>`;

    return `
      <div class="page">
        ${pageHead('Ekonomi','Pertumbuhan Ekonomi Kota Pontianak','Lihat laju pertumbuhan, besaran PDRB atas dasar harga berlaku/konstan, serta struktur ekonomi menurut lapangan usaha.')}
        <section class="section">
          <div class="container">
            ${sectionHead('Kondisi terbaru',`Ekonomi ${growth.year || '—'}`,'Tiga indikator ringkas untuk membaca ukuran dan pertumbuhan ekonomi.')}
            <div class="metric-grid">
              ${metricCard({label:'Pertumbuhan ekonomi',value:growth.value,unit:'%',meta:`${growth.year || '—'}`})}
              ${metricCard({label:'PDRB ADHB',value:adhb.value,unit:'',meta:`${adhb.year || '—'} • satuan mengikuti sumber`,digits:2})}
              ${metricCard({label:'PDRB ADHK',value:adhk.value,unit:'',meta:`${adhk.year || '—'} • satuan mengikuti sumber`,digits:2})}
            </div>
          </div>
        </section>
        <section class="section">
          <div class="container">
            ${sectionHead('Tren & struktur','Dari pertumbuhan ke komposisi sektor','PDRB total memberi ukuran ekonomi, sementara distribusi menunjukkan lapangan usaha yang paling dominan.')}
            <div class="chart-grid">
              ${chartCard({id:'chart-growth',title:'Pertumbuhan ekonomi',subtitle:'Persen per tahun',sheetName:'PERTUMBUHAN_EKONOMI'})}
              ${chartCard({id:'chart-pdrb',title:'PDRB ADHB dan ADHK',subtitle:'Nilai total PDRB',sheetName:'PDRB_ADHB'})}
              ${chartCard({id:'chart-distribusi',title:'Struktur ekonomi menurut lapangan usaha',subtitle:'Distribusi PDRB (%)',sheetName:'DISTRIBUSI_PDRB',wide:true,tall:true,extraHead:yearControl})}
            </div>
          </div>
        </section>
        ${sourceFootnote()}
      </div>`;
  }

  // ---------- Page: IPM ----------
  function renderIpm() {
    const ipm = latestWide('IPM', label => /Indeks Pembangunan Manusia/i.test(label));
    const ahh = latestWide('IPM', label => /Angka Harapan Hidup/i.test(label));
    const hls = latestWide('IPM', label => /^Harapan Lama Sekolah/i.test(label));
    const rls = latestWide('IPM', label => /Rata-rata Lama Sekolah/i.test(label));
    const exp = latestWide('IPM', label => /Pengeluaran Per Kapita/i.test(label));

    return `
      <div class="page">
        ${pageHead('Pembangunan Manusia','Indeks Pembangunan Manusia Kota Pontianak','IPM dan komponen pembentuknya: umur panjang dan sehat, pengetahuan, serta standar hidup layak.')}
        <section class="section">
          <div class="container">
            ${sectionHead('Kondisi terbaru',`IPM ${ipm.year || '—'}`,'Nilai terbaru masing-masing komponen dapat memiliki satuan yang berbeda.')}
            <div class="metric-grid">
              ${metricCard({label:'Indeks Pembangunan Manusia',value:ipm.value,meta:`${ipm.year || '—'}`})}
              ${metricCard({label:'Angka Harapan Hidup',value:ahh.value,unit:'tahun',meta:`${ahh.year || '—'}`})}
              ${metricCard({label:'Harapan Lama Sekolah',value:hls.value,unit:'tahun',meta:`${hls.year || '—'}`})}
              ${metricCard({label:'Rata-rata Lama Sekolah',value:rls.value,unit:'tahun',meta:`${rls.year || '—'}`})}
              ${metricCard({label:'Pengeluaran per Kapita',value:exp.value,unit:'ribu rupiah',meta:`${exp.year || '—'}`,digits:0})}
            </div>
          </div>
        </section>
        <section class="section">
          <div class="container">
            ${sectionHead('Tren','Perkembangan pembangunan manusia','Grafik IPM ditampilkan terpisah dari komponen agar perubahan tahunannya mudah dibaca.')}
            <div class="chart-grid">
              ${chartCard({id:'chart-ipm',title:'Indeks Pembangunan Manusia',subtitle:'Nilai IPM',sheetName:'IPM'})}
              ${chartCard({id:'chart-ipm-education',title:'Dimensi pendidikan',subtitle:'Harapan Lama Sekolah dan Rata-rata Lama Sekolah (tahun)',sheetName:'IPM'})}
              ${chartCard({id:'chart-ipm-ahh',title:'Angka Harapan Hidup',subtitle:'Tahun',sheetName:'IPM',wide:true})}
            </div>
          </div>
        </section>
        ${sourceFootnote()}
      </div>`;
  }

  // ---------- Page: Kependudukan ----------
  function renderKependudukan() {
    const latest = latestRow('KEPENDUDUKAN');
    const years = getPyramidYears();
    const latestPyramidYear = years[years.length - 1] || '';

    const yearControl = `<label class="control">Tahun
      <select id="pyramid-year" aria-label="Pilih tahun piramida penduduk">
        ${years.map(y => `<option value="${escapeHtml(y)}" ${y === latestPyramidYear ? 'selected' : ''}>${escapeHtml(y)}</option>`).join('')}
      </select>
    </label>`;

    return `
      <div class="page">
        ${pageHead('Demografi','Kependudukan Kota Pontianak','Jumlah penduduk, pertumbuhan, kepadatan, rasio jenis kelamin, dependency ratio, gini ratio, dan struktur umur.')}
        <section class="section">
          <div class="container">
            ${sectionHead('Kondisi terbaru',`Demografi ${formatYear(latest.TAHUN)}`,'Ringkasan indikator kependudukan pada tahun terbaru yang tersedia.')}
            <div class="metric-grid">
              ${metricCard({label:'Jumlah Penduduk',value:asNumber(latest.JUMLAH_PENDUDUK),unit:'jiwa',meta:`${formatYear(latest.TAHUN)}`,digits:0})}
              ${metricCard({label:'Laju Pertumbuhan Penduduk',value:asNumber(latest.LAJU_PERTUMBUHAN_PENDUDUK),unit:'%',meta:`${formatYear(latest.TAHUN)}`})}
              ${metricCard({label:'Kepadatan Penduduk',value:asNumber(latest.KEPADATAN_PENDUDUK),unit:'jiwa/km²',meta:`${formatYear(latest.TAHUN)}`,digits:0})}
              ${metricCard({label:'Rasio Jenis Kelamin',value:asNumber(latest.RASIO_JENIS_KELAMIN),meta:`${formatYear(latest.TAHUN)}`})}
              ${metricCard({label:'Dependency Ratio',value:asNumber(latest.DEPENDENCY_RATIO),meta:`${formatYear(latest.TAHUN)}`})}
              ${metricCard({label:'Gini Ratio',value:asNumber(latest.GINI_RATIO),meta:`${formatYear(latest.TAHUN)}`,digits:3})}
            </div>
          </div>
        </section>
        <section class="section">
          <div class="container">
            ${sectionHead('Tren & struktur','Dinamika jumlah dan komposisi umur','Piramida penduduk dapat diganti tahunnya menggunakan pemilih di kanan kartu.')}
            <div class="chart-grid">
              ${chartCard({id:'chart-population',title:'Jumlah penduduk',subtitle:'Jiwa',sheetName:'KEPENDUDUKAN'})}
              ${chartCard({id:'chart-demography',title:'Pertumbuhan dan dependency ratio',subtitle:'Persen / rasio',sheetName:'KEPENDUDUKAN'})}
              ${chartCard({id:'chart-pyramid',title:'Piramida penduduk',subtitle:'Penduduk menurut kelompok umur dan jenis kelamin',sheetName:'PIRAMIDA_PENDUDUK',wide:true,tall:true,extraHead:yearControl})}
            </div>
          </div>
        </section>
        ${sourceFootnote()}
      </div>`;
  }

  function getPyramidYears() {
    const headers = sheet('PIRAMIDA_PENDUDUK').headers;
    const years = new Set();
    headers.slice(1).forEach(h => {
      const m = String(h).match(/^(\d{4})_[LPT]$/);
      if (m) years.add(m[1]);
    });
    return Array.from(years).sort();
  }

  // ---------- Informational pages ----------
  function renderTentang() {
    return `
      <div class="page">
        ${pageHead('Tentang','LAPIS dibuat untuk memperpendek jarak antara angka dan pemahaman.','Portal ini menyajikan indikator strategis Kota Pontianak dalam format yang lebih cepat dibaca tanpa menggantikan publikasi resmi BPS.')}
        <section class="section">
          <div class="container content-grid">
            <article class="content-card">
              <span class="eyebrow">Cara menggunakan</span>
              <h2>Mulai dari angka ringkas, lalu buka tren dan tabel.</h2>
              <p>LAPIS dirancang untuk dua kebutuhan sekaligus: membaca situasi secara cepat dan mengambil data dasar untuk analisis awal. Setiap halaman indikator menyediakan kartu ringkasan, visual tren, tabel sumber, tombol salin data, dan unduh CSV.</p>
              <p>Apabila sebuah angka akan digunakan dalam laporan resmi, penelitian, atau dokumen kebijakan, cocokkan kembali definisi, satuan, status data, dan metadata pada kanal resmi BPS.</p>
            </article>
            <aside class="content-card">
              <span class="eyebrow">Kontak resmi</span>
              <h2>BPS Kota Pontianak</h2>
              <div class="contact-list">
                <div class="contact-row">${icon('map')}<span>${escapeHtml(CONFIG.contact?.address || '')}</span></div>
                <div class="contact-row">${icon('phone')}<a href="tel:+625618189880">${escapeHtml(CONFIG.contact?.phone || '')}</a></div>
                <div class="contact-row">${icon('mail')}<a href="mailto:${escapeHtml(CONFIG.contact?.email || '')}">${escapeHtml(CONFIG.contact?.email || '')}</a></div>
              </div>
            </aside>
          </div>
        </section>

        <section class="section">
          <div class="container">
            ${sectionHead('FAQ','Pertanyaan yang sering muncul','')}
            <div class="faq-list">
              ${faq('Apakah angka di LAPIS merupakan angka resmi BPS?','LAPIS menampilkan data yang ditarik dari basis data yang dikelola BPS Kota Pontianak. Untuk penggunaan formal, tetap rujuk publikasi/tabel statistik resmi dan metadata indikator terkait.')}
              ${faq('Seberapa sering LAPIS diperbarui?','Portal membaca spreadsheet sumber dan menggunakan cache singkat untuk menjaga performa. Tanggal pembaruan sumber ditampilkan di bagian atas halaman.')}
              ${faq('Apakah data dapat diunduh?','Ya. Setiap kartu grafik menyediakan tombol CSV dan salin data untuk memudahkan analisis lebih lanjut.')}
              ${faq('Mengapa tahun terbaru berbeda antarindikator?','Frekuensi dan jadwal rilis statistik berbeda-beda. LAPIS menampilkan periode terbaru yang tersedia untuk masing-masing seri.')}
              ${faq('Saya menemukan angka yang perlu dikonfirmasi. Ke mana harus menghubungi?','Gunakan kontak BPS Kota Pontianak yang tersedia pada halaman ini atau tombol kontak mengambang di sisi kanan.')}
            </div>
          </div>
        </section>
      </div>`;
  }

  function faq(q,a) {
    return `<details class="faq"><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`;
  }

  function renderPrivasi() {
    return `
      <div class="page">
        ${pageHead('Legal','Kebijakan Privasi','Penjelasan ringkas mengenai data pengguna, penyimpanan lokal, dan analitik pada LAPIS.')}
        <section class="section">
          <div class="container">
            <article class="content-card">
              <h2>Data yang diproses</h2>
              <p>LAPIS tidak meminta pengguna membuat akun dan tidak menyediakan formulir yang meminta data pribadi. Portal dapat menyimpan preferensi tema, persetujuan analitik, serta parameter kampanye (UTM) di penyimpanan lokal browser.</p>
              <h2>Analitik</h2>
              <p>Jika administrator memasang Google Analytics, analitik hanya dimuat setelah pengguna memilih “Izinkan analitik” pada banner privasi. Pilihan tersebut dapat diubah dengan menghapus penyimpanan situs pada browser.</p>
              <h2>Tautan eksternal</h2>
              <p>LAPIS dapat menautkan pengguna ke website resmi BPS Kota Pontianak atau layanan eksternal lainnya. Kebijakan privasi layanan tersebut berlaku setelah pengguna meninggalkan LAPIS.</p>
              <h2>Kontak</h2>
              <p>Pertanyaan mengenai portal dapat disampaikan ke <a href="mailto:${escapeHtml(CONFIG.contact?.email || '')}">${escapeHtml(CONFIG.contact?.email || '')}</a>.</p>
            </article>
          </div>
        </section>
      </div>`;
  }

  function renderKetentuan() {
    return `
      <div class="page">
        ${pageHead('Legal','Ketentuan Penggunaan','Prinsip penggunaan data dan informasi yang ditampilkan melalui LAPIS.')}
        <section class="section">
          <div class="container">
            <article class="content-card">
              <h2>Tujuan portal</h2>
              <p>LAPIS merupakan sarana bantu diseminasi dan eksplorasi indikator strategis Kota Pontianak. Portal tidak dimaksudkan menggantikan publikasi resmi, metadata statistik, atau layanan konsultasi BPS.</p>
              <h2>Penggunaan data</h2>
              <p>Pengguna dipersilakan memanfaatkan angka untuk analisis, pembelajaran, perencanaan, dan penelitian dengan tetap mencantumkan sumber data yang sesuai. Sebelum penggunaan formal, periksa kembali definisi, satuan, cakupan, periode, serta status angka pada produk resmi BPS.</p>
              <h2>Ketersediaan</h2>
              <p>Struktur dan isi portal dapat diperbarui mengikuti ketersediaan data. Gangguan sementara dapat terjadi karena pemeliharaan sistem, kuota layanan, atau perubahan pada sumber data.</p>
              <h2>Kontak</h2>
              <p>Untuk klarifikasi statistik, hubungi BPS Kota Pontianak melalui kanal kontak resmi pada halaman Tentang.</p>
            </article>
          </div>
        </section>
      </div>`;
  }

  function render404() {
    return `
      <div class="page not-found">
        <div class="container not-found-box">
          <span class="not-found-code">404 • LAPIS</span>
          <h1>Halaman ini rupanya mengambil jalan yang terlalu jauh.</h1>
          <p>Tautan yang Anda buka tidak tersedia. Kembali ke beranda atau gunakan pencarian untuk menemukan indikator yang dibutuhkan.</p>
          <div class="button-row" style="margin-top:26px">
            <a class="button primary" href="?page=home" data-route="home">Kembali ke beranda</a>
            <button class="button secondary" type="button" data-action="open-search">${icon('search')} Cari indikator</button>
          </div>
        </div>
      </div>`;
  }

  // ---------- Charts ----------
  function initPageCharts(page) {
    if (!state.data || typeof Chart === 'undefined') return;
    Chart.defaults.font.family = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    Chart.defaults.animation.duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450;

    const map = {
      home: () => { renderInflationChart('chart-home-inflasi','INFLASI_YTY'); renderGrowthChart('chart-home-growth'); renderIpmTrend('chart-home-ipm'); },
      inflasi: () => { renderInflationChart('chart-inflasi-mtm','INFLASI_MTM'); renderInflationChart('chart-inflasi-yoy','INFLASI_YTY'); renderInflationChart('chart-inflasi-ytd','INFLASI_YTD'); },
      kemiskinan: () => { renderPovertyP0(); renderPovertyP1P2(); renderPovertyLine(); },
      ketenagakerjaan: () => { renderLaborRates(); renderLaborGender(); renderLaborCount(); },
      ekonomi: () => { renderGrowthChart('chart-growth'); renderPdrbChart(); renderDistributionChart($('#distribution-year')?.value || wideYears('DISTRIBUSI_PDRB').slice(-1)[0]); },
      ipm: () => { renderIpmTrend('chart-ipm'); renderIpmEducation(); renderIpmAhh(); },
      kependudukan: () => { renderPopulationTrend(); renderDemographyTrend(); renderPopulationPyramid($('#pyramid-year')?.value || getPyramidYears().slice(-1)[0]); }
    };

    map[page]?.();
  }

  function chartPalette() {
    const dark = state.theme === 'dark';
    return {
      blue: dark ? '#38bdf8' : '#0284c7',
      navy: dark ? '#93c5fd' : '#0b3154',
      orange: dark ? '#fbbf24' : '#f59e0b',
      green: dark ? '#34d399' : '#059669',
      red: dark ? '#f87171' : '#dc2626',
      purple: dark ? '#c4b5fd' : '#7c3aed',
      gray: dark ? '#94a3b8' : '#64748b',
      grid: dark ? 'rgba(148,163,184,.15)' : 'rgba(100,116,139,.14)',
      text: dark ? '#dce8f2' : '#425b72'
    };
  }

  function baseOptions({percent=false,indexAxis='x'} = {}) {
    const p = chartPalette();
    return {
      responsive:true,
      maintainAspectRatio:false,
      indexAxis,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{position:'bottom',labels:{color:p.text,usePointStyle:true,boxWidth:8,padding:16}},
        tooltip:{
          backgroundColor: state.theme === 'dark' ? '#07111b' : '#10243a',
          titleColor:'#fff',bodyColor:'#fff',padding:11,cornerRadius:9,
          callbacks: percent ? {label:ctx => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y ?? ctx.parsed.x)}%`} : {}
        }
      },
      scales:{
        x:{grid:{display:false,color:p.grid},ticks:{color:p.text}},
        y:{grid:{color:p.grid},ticks:{color:p.text}}
      }
    };
  }

  function createChart(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    const chart = new Chart(canvas, config);
    state.charts.push({id,chart});
    return chart;
  }

  function destroyCharts() {
    state.charts.forEach(item => {
      try { item.chart.destroy(); } catch (_) {}
    });
    state.charts = [];
  }

  function destroyChartById(id) {
    const idx = state.charts.findIndex(item => item.id === id);
    if (idx >= 0) {
      try { state.charts[idx].chart.destroy(); } catch (_) {}
      state.charts.splice(idx,1);
    }
  }

  function renderInflationChart(id, sheetName) {
    const p = chartPalette();
    const series = inflationSeries(sheetName);
    const colors = [p.gray,p.blue,p.orange,p.green,p.purple];
    const datasets = series.datasets.map((d,i) => ({
      label:d.year,
      data:d.values,
      borderColor:colors[i % colors.length],
      backgroundColor:colors[i % colors.length],
      tension:.28,
      spanGaps:true,
      pointRadius:2.4,
      pointHoverRadius:5,
      borderWidth:2
    }));

    createChart(id, {
      type:'line',
      data:{labels:series.labels,datasets},
      options:baseOptions({percent:true})
    });
  }

  function renderGrowthChart(id) {
    const p = chartPalette();
    const s = numericSeries('PERTUMBUHAN_EKONOMI', label => /Produk Domestik Regional Bruto/i.test(label));
    createChart(id,{
      type:'line',
      data:{labels:s.labels,datasets:[{label:'Pertumbuhan ekonomi',data:s.values,borderColor:p.orange,backgroundColor:p.orange,tension:.25,pointRadius:3,borderWidth:2.5}]},
      options:baseOptions({percent:true})
    });
  }

  function renderIpmTrend(id) {
    const p = chartPalette();
    const s = numericSeries('IPM', label => /Indeks Pembangunan Manusia/i.test(label));
    createChart(id,{
      type:'line',
      data:{labels:s.labels,datasets:[{label:'IPM',data:s.values,borderColor:p.blue,backgroundColor:p.blue,tension:.25,pointRadius:3,borderWidth:2.5}]},
      options:baseOptions()
    });
  }

  function renderPovertyP0() {
    const p = chartPalette();
    const rows = rowObjects('KEMISKINAN');
    createChart('chart-poverty-p0',{
      type:'line',
      data:{
        labels:rows.map(r => formatYear(r.TAHUN)),
        datasets:[
          {label:'P0 (%)',data:rows.map(r => asNumber(r.P0)),borderColor:p.orange,backgroundColor:p.orange,yAxisID:'y',tension:.25,borderWidth:2.5},
          {label:'Penduduk miskin (ribu)',data:rows.map(r => asNumber(r['JUMLAH_PENDUDUK_MISKIN (RIBU)'])),borderColor:p.blue,backgroundColor:p.blue,yAxisID:'y1',tension:.25,borderWidth:2.5}
        ]
      },
      options:{
        ...baseOptions(),
        scales:{
          x:{grid:{display:false},ticks:{color:p.text}},
          y:{position:'left',grid:{color:p.grid},ticks:{color:p.text,callback:v=>`${formatNumber(v)}%`}},
          y1:{position:'right',grid:{drawOnChartArea:false},ticks:{color:p.text}}
        }
      }
    });
  }

  function renderPovertyP1P2() {
    const p = chartPalette();
    const rows = rowObjects('KEMISKINAN');
    createChart('chart-poverty-p1p2',{
      type:'line',
      data:{
        labels:rows.map(r => formatYear(r.TAHUN)),
        datasets:[
          {label:'P1',data:rows.map(r => asNumber(r.P1)),borderColor:p.navy,backgroundColor:p.navy,tension:.25,borderWidth:2.3},
          {label:'P2',data:rows.map(r => asNumber(r.P2)),borderColor:p.red,backgroundColor:p.red,tension:.25,borderWidth:2.3}
        ]
      },
      options:baseOptions()
    });
  }

  function renderPovertyLine() {
    const p = chartPalette();
    const rows = rowObjects('KEMISKINAN');
    createChart('chart-poverty-line',{
      type:'bar',
      data:{labels:rows.map(r => formatYear(r.TAHUN)),datasets:[{label:'Garis kemiskinan',data:rows.map(r => asNumber(r.GARIS_KEMISKINAN)),backgroundColor:p.navy,borderRadius:6}]},
      options:{
        ...baseOptions(),
        plugins:{
          ...baseOptions().plugins,
          tooltip:{...baseOptions().plugins.tooltip,callbacks:{label:ctx=>`Rp ${formatInteger(ctx.parsed.y)}`}}
        },
        scales:{
          x:{grid:{display:false},ticks:{color:p.text}},
          y:{grid:{color:p.grid},ticks:{color:p.text,callback:v=>`Rp ${formatInteger(v)}`}}
        }
      }
    });
  }

  function renderLaborRates() {
    const p = chartPalette();
    const tpt = numericSeries('ANGKATAN_KERJA', label => label === 'Tingkat Pengangguran Terbuka');
    const tpak = numericSeries('ANGKATAN_KERJA', label => label === 'Tingkat Partisipasi Angkatan Kerja');
    createChart('chart-labor-rate',{
      type:'line',
      data:{labels:tpt.labels,datasets:[
        {label:'TPT',data:tpt.values,borderColor:p.orange,backgroundColor:p.orange,tension:.25,borderWidth:2.4},
        {label:'TPAK',data:tpak.values,borderColor:p.blue,backgroundColor:p.blue,tension:.25,borderWidth:2.4}
      ]},
      options:baseOptions({percent:true})
    });
  }

  function renderLaborGender() {
    const p = chartPalette();
    const years = wideYears('ANGKATAN_KERJA');
    const year = years[years.length - 1];
    const rows = sheet('ANGKATAN_KERJA').rows;
    const col = sheet('ANGKATAN_KERJA').headers.indexOf(year);
    const val = label => {
      const row = rows.find(r => String(r[0]) === label);
      return row ? asNumber(row[col]) : null;
    };
    createChart('chart-labor-gender',{
      type:'bar',
      data:{
        labels:['Laki-laki','Perempuan'],
        datasets:[
          {label:'TPAK',data:[val('Tingkat Partisipasi Angkatan Kerja Laki-laki'),val('Tingkat Partisipasi Angkatan Kerja Perempuan')],backgroundColor:p.blue,borderRadius:6},
          {label:'TPT',data:[val('Tingkat Pengangguran Terbuka Laki-laki'),val('Tingkat Pengangguran Terbuka Perempuan')],backgroundColor:p.orange,borderRadius:6}
        ]
      },
      options:baseOptions({percent:true})
    });
  }

  function renderLaborCount() {
    const p = chartPalette();
    const ak = numericSeries('ANGKATAN_KERJA', label => label === 'Angkatan Kerja');
    const bak = numericSeries('ANGKATAN_KERJA', label => label === 'Bukan Angkatan Kerja');
    createChart('chart-labor-count',{
      type:'line',
      data:{labels:ak.labels,datasets:[
        {label:'Angkatan Kerja',data:ak.values,borderColor:p.green,backgroundColor:p.green,tension:.25,borderWidth:2.4},
        {label:'Bukan Angkatan Kerja',data:bak.values,borderColor:p.gray,backgroundColor:p.gray,tension:.25,borderWidth:2.4}
      ]},
      options:{
        ...baseOptions(),
        scales:{
          x:{grid:{display:false},ticks:{color:p.text}},
          y:{grid:{color:p.grid},ticks:{color:p.text,callback:v=>formatInteger(v)}}
        }
      }
    });
  }

  function renderPdrbChart() {
    const p = chartPalette();
    const adhb = numericSeries('PDRB_ADHB', label => /Produk Domestik Regional Bruto ADHB/i.test(label));
    const adhk = numericSeries('PDRB_ADHK', label => /Produk Domestik Regional Bruto ADHK/i.test(label));
    createChart('chart-pdrb',{
      type:'line',
      data:{labels:adhb.labels,datasets:[
        {label:'PDRB ADHB',data:adhb.values,borderColor:p.blue,backgroundColor:p.blue,tension:.25,borderWidth:2.4},
        {label:'PDRB ADHK',data:adhk.values,borderColor:p.green,backgroundColor:p.green,tension:.25,borderWidth:2.4}
      ]},
      options:baseOptions()
    });
  }

  function renderDistributionChart(year) {
    if (!year) return;
    const p = chartPalette();
    const s = sheet('DISTRIBUSI_PDRB');
    const col = s.headers.findIndex(h => String(h) === String(year));
    const rows = s.rows
      .filter(r => !/Produk Domestik Regional Bruto$/i.test(String(r[0] || '')))
      .map(r => ({label:cleanSectorLabel(r[0]),value:asNumber(r[col])}))
      .filter(x => x.value !== null)
      .sort((a,b) => b.value-a.value);

    createChart('chart-distribusi',{
      type:'bar',
      data:{
        labels:rows.map(x => x.label),
        datasets:[{label:`Distribusi ${year}`,data:rows.map(x=>x.value),backgroundColor:p.navy,borderRadius:5}]
      },
      options:{
        ...baseOptions({indexAxis:'y'}),
        indexAxis:'y',
        plugins:{
          ...baseOptions().plugins,
          tooltip:{...baseOptions().plugins.tooltip,callbacks:{label:ctx=>`${formatNumber(ctx.parsed.x)}%`}}
        },
        scales:{
          x:{grid:{color:p.grid},ticks:{color:p.text,callback:v=>`${formatNumber(v)}%`}},
          y:{grid:{display:false},ticks:{color:p.text,autoSkip:false,font:{size:10}}}
        }
      }
    });
  }

  function cleanSectorLabel(value) {
    return String(value || '').replace(/^[A-U](?:,S,T,U)?\s+/,'').replace(/^R,S,T,U\s+/,'');
  }

  function renderIpmEducation() {
    const p = chartPalette();
    const hls = numericSeries('IPM', label => /^Harapan Lama Sekolah/i.test(label));
    const rls = numericSeries('IPM', label => /Rata-rata Lama Sekolah/i.test(label));
    createChart('chart-ipm-education',{
      type:'line',
      data:{labels:hls.labels,datasets:[
        {label:'Harapan Lama Sekolah',data:hls.values,borderColor:p.blue,backgroundColor:p.blue,tension:.25,borderWidth:2.4},
        {label:'Rata-rata Lama Sekolah',data:rls.values,borderColor:p.orange,backgroundColor:p.orange,tension:.25,borderWidth:2.4}
      ]},
      options:baseOptions()
    });
  }

  function renderIpmAhh() {
    const p = chartPalette();
    const ahh = numericSeries('IPM', label => /Angka Harapan Hidup/i.test(label));
    createChart('chart-ipm-ahh',{
      type:'bar',
      data:{labels:ahh.labels,datasets:[{label:'Angka Harapan Hidup',data:ahh.values,backgroundColor:p.green,borderRadius:6}]},
      options:baseOptions()
    });
  }

  function renderPopulationTrend() {
    const p = chartPalette();
    const rows = rowObjects('KEPENDUDUKAN');
    createChart('chart-population',{
      type:'line',
      data:{labels:rows.map(r=>formatYear(r.TAHUN)),datasets:[{label:'Jumlah Penduduk',data:rows.map(r=>asNumber(r.JUMLAH_PENDUDUK)),borderColor:p.blue,backgroundColor:p.blue,tension:.25,borderWidth:2.5}]},
      options:{
        ...baseOptions(),
        scales:{
          x:{grid:{display:false},ticks:{color:p.text}},
          y:{grid:{color:p.grid},ticks:{color:p.text,callback:v=>formatInteger(v)}}
        }
      }
    });
  }

  function renderDemographyTrend() {
    const p = chartPalette();
    const rows = rowObjects('KEPENDUDUKAN');
    createChart('chart-demography',{
      type:'line',
      data:{labels:rows.map(r=>formatYear(r.TAHUN)),datasets:[
        {label:'Laju pertumbuhan penduduk',data:rows.map(r=>asNumber(r.LAJU_PERTUMBUHAN_PENDUDUK)),borderColor:p.orange,backgroundColor:p.orange,yAxisID:'y',tension:.25,borderWidth:2.4},
        {label:'Dependency ratio',data:rows.map(r=>asNumber(r.DEPENDENCY_RATIO)),borderColor:p.green,backgroundColor:p.green,yAxisID:'y1',tension:.25,borderWidth:2.4}
      ]},
      options:{
        ...baseOptions(),
        scales:{
          x:{grid:{display:false},ticks:{color:p.text}},
          y:{position:'left',grid:{color:p.grid},ticks:{color:p.text,callback:v=>`${formatNumber(v)}%`}},
          y1:{position:'right',grid:{drawOnChartArea:false},ticks:{color:p.text}}
        }
      }
    });
  }

  function renderPopulationPyramid(year) {
    if (!year) return;
    const p = chartPalette();
    const s = sheet('PIRAMIDA_PENDUDUK');
    const lCol = s.headers.indexOf(`${year}_L`);
    const pCol = s.headers.indexOf(`${year}_P`);
    const rows = s.rows.filter(r => String(r[0] || '').toUpperCase() !== 'JUMLAH');
    const labels = rows.map(r => String(r[0] ?? ''));
    const male = rows.map(r => {
      const n = asNumber(r[lCol]);
      return n === null ? null : -Math.abs(n);
    });
    const female = rows.map(r => {
      const n = asNumber(r[pCol]);
      return n === null ? null : Math.abs(n);
    });

    createChart('chart-pyramid',{
      type:'bar',
      data:{labels,datasets:[
        {label:'Laki-laki',data:male,backgroundColor:p.blue,borderRadius:4},
        {label:'Perempuan',data:female,backgroundColor:p.orange,borderRadius:4}
      ]},
      options:{
        ...baseOptions({indexAxis:'y'}),
        indexAxis:'y',
        interaction:{mode:'index',intersect:false},
        plugins:{
          legend:{position:'bottom',labels:{color:p.text,usePointStyle:true,boxWidth:8,padding:16}},
          tooltip:{
            backgroundColor: state.theme === 'dark' ? '#07111b' : '#10243a',
            titleColor:'#fff',bodyColor:'#fff',padding:11,cornerRadius:9,
            callbacks:{label:ctx=>`${ctx.dataset.label}: ${formatNumber(Math.abs(ctx.parsed.x),3)}`}
          }
        },
        scales:{
          x:{
            stacked:true,grid:{color:p.grid},
            ticks:{color:p.text,callback:v=>formatNumber(Math.abs(v),3)}
          },
          y:{stacked:true,grid:{display:false},ticks:{color:p.text}}
        }
      }
    });
  }

  function formatYear(value) {
    const n = asNumber(value);
    return n === null ? String(value ?? '—') : String(Math.round(n));
  }

  // ---------- Search ----------
  function buildSearchIndex() {
    const base = [
      ['home','Beranda','Ringkasan indikator strategis Kota Pontianak'],
      ['inflasi','Inflasi','MTM, month-to-month, year-on-year, y-on-y, YTD, harga konsumen'],
      ['kemiskinan','Kemiskinan','Penduduk miskin, P0, P1, P2, garis kemiskinan'],
      ['ketenagakerjaan','Ketenagakerjaan','TPT, TPAK, angkatan kerja, pengangguran'],
      ['ekonomi','Pertumbuhan Ekonomi','PDRB, ADHB, ADHK, distribusi PDRB, lapangan usaha'],
      ['ipm','Indeks Pembangunan Manusia','IPM, AHH, HLS, RLS, pengeluaran per kapita'],
      ['kependudukan','Kependudukan','Jumlah penduduk, pertumbuhan, kepadatan, gini, dependency ratio, piramida penduduk'],
      ['tentang','Tentang LAPIS','Sumber data, bantuan, kontak BPS Kota Pontianak']
    ].map(([page,title,keywords]) => ({page,title,keywords,detail:keywords}));

    const extra = [];
    Object.entries(state.data?.sheets || {}).forEach(([sheetName,s]) => {
      s.rows.slice(0,80).forEach(row => {
        const label = String(row[0] ?? '').trim();
        if (label && label.length > 2) {
          const page = pageForSheet(sheetName);
          if (page) extra.push({page,title:label,keywords:`${label} ${sheetName}`,detail:`${PAGE_NAMES[page]} • ${sheetName}`});
        }
      });
    });

    const seen = new Set();
    state.searchIndex = [...base,...extra].filter(item => {
      const key = `${item.page}|${item.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function pageForSheet(name) {
    if (/INFLASI/.test(name)) return 'inflasi';
    if (name === 'KEMISKINAN') return 'kemiskinan';
    if (name === 'ANGKATAN_KERJA') return 'ketenagakerjaan';
    if (/PDRB|PERTUMBUHAN_EKONOMI/.test(name)) return 'ekonomi';
    if (name === 'IPM') return 'ipm';
    if (/PENDUDUK|KEPENDUDUKAN/.test(name)) return 'kependudukan';
    return null;
  }

  function openSearch(query='') {
    const dialog = $('#search-dialog');
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('dialog-open');
    const input = $('#search-input');
    input.value = query || '';
    renderSearchResults(query || '');
    setTimeout(() => input.focus(), 30);
  }

  function closeSearch() {
    const dialog = $('#search-dialog');
    if (dialog?.open) dialog.close();
  }

  function onSearchInput(event) {
    renderSearchResults(event.currentTarget.value);
  }

  function renderSearchResults(query) {
    const q = String(query || '').trim().toLowerCase();
    const hint = $('#search-hint');
    const results = $('#search-results');
    if (!results || !hint) return;

    hint.classList.remove('error');
    if (q.length < 2) {
      hint.textContent = 'Ketik minimal 2 karakter untuk mencari halaman dan indikator.';
      results.innerHTML = '';
      return;
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    const matches = state.searchIndex
      .map(item => {
        const hay = `${item.title} ${item.keywords} ${item.detail}`.toLowerCase();
        const score = tokens.reduce((acc,t) => acc + (hay.includes(t) ? 1 : 0),0);
        return {...item,score};
      })
      .filter(x => x.score === tokens.length)
      .sort((a,b) => b.score-a.score || a.title.localeCompare(b.title,'id'))
      .slice(0,14);

    if (!matches.length) {
      hint.textContent = `Tidak ditemukan hasil untuk “${query}”. Coba kata yang lebih umum.`;
      hint.classList.add('error');
      results.innerHTML = `<div class="search-empty">Belum ada indikator yang cocok.</div>`;
      return;
    }

    hint.textContent = `${matches.length} hasil ditemukan.`;
    results.innerHTML = matches.map(item => `
      <a class="search-result" href="?page=${item.page}" data-route="${item.page}" onclick="document.getElementById('search-dialog').close()">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.detail || PAGE_NAMES[item.page])}</span>
      </a>`).join('');
  }

  // ---------- CSV / copy ----------
  function sheetToCsv(sheetName) {
    const s = sheet(sheetName);
    const rows = [s.headers,...s.rows];
    return rows.map(row => row.map(csvEscape).join(';')).join('\n');
  }

  function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const text = String(value).replace(/"/g,'""');
    return /[;"\n\r]/.test(text) ? `"${text}"` : text;
  }

  async function copySheetCsv(sheetName, button) {
    try {
      await navigator.clipboard.writeText(sheetToCsv(sheetName));
      flashButton(button,'Tersalin');
      announce(`Data ${sheetName} disalin.`);
      trackEvent('copy_data',{sheet:sheetName});
    } catch (_) {
      flashButton(button,'Gagal');
      announce(`Data ${sheetName} gagal disalin.`);
    }
  }

  function downloadSheetCsv(sheetName) {
    const csv = '\uFEFF' + sheetToCsv(sheetName);
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LAPIS_${sheetName}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url),300);
    trackEvent('download_csv',{sheet:sheetName});
  }

  async function copyCurrentLink(button) {
    try {
      await navigator.clipboard.writeText(location.href);
      flashButton(button,'Tautan tersalin');
      announce('Tautan halaman disalin.');
      trackEvent('share',{method:'copy_link',content_type:'page',item_id:state.page});
    } catch (_) {
      flashButton(button,'Gagal menyalin');
    }
  }

  function flashButton(button,text) {
    if (!button) return;
    const original = button.innerHTML;
    button.textContent = text;
    setTimeout(() => button.innerHTML = original,1300);
  }

  // ---------- Consent / analytics / UTM ----------
  function initConsent() {
    const stored = localStorage.getItem('lapis-analytics-consent');
    if (!stored) {
      setTimeout(() => { $('#cookie-banner').hidden = false; }, 500);
    } else if (stored === 'granted') {
      enableAnalytics();
    }

    $('#cookie-accept')?.addEventListener('click', () => {
      localStorage.setItem('lapis-analytics-consent','granted');
      $('#cookie-banner').hidden = true;
      enableAnalytics();
    });

    $('#cookie-reject')?.addEventListener('click', () => {
      localStorage.setItem('lapis-analytics-consent','denied');
      $('#cookie-banner').hidden = true;
    });
  }

  function enableAnalytics() {
    const id = String(CONFIG.analyticsMeasurementId || '').trim();
    if (!id || window.__lapisAnalyticsLoaded) return;
    window.__lapisAnalyticsLoaded = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', id, {
      anonymize_ip:true,
      page_title:document.title,
      page_location:location.href,
      ...getStoredUtm()
    });
  }

  function trackEvent(name, params={}) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, {...params,...getStoredUtm()});
  }

  function captureUtm() {
    try {
      const url = new URL(location.href);
      const keys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'];
      const payload = {};
      keys.forEach(k => {
        const v = url.searchParams.get(k);
        if (v) payload[k] = v.slice(0,200);
      });
      if (Object.keys(payload).length) {
        sessionStorage.setItem('lapis-utm',JSON.stringify(payload));
      }
    } catch (_) {}
  }

  function getStoredUtm() {
    try { return JSON.parse(sessionStorage.getItem('lapis-utm') || '{}'); }
    catch (_) { return {}; }
  }

  // ---------- Small helpers ----------
  function announce(text) {
    const live = $('#live-region');
    if (!live) return;
    live.textContent = '';
    setTimeout(() => live.textContent = text, 30);
  }
})();
