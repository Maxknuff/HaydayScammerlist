/**
 * Hay Day Scammer List Viewer
 * Lädt die Scammer-Liste automatisch von GitHub und zeigt sie an.
 *
 * KONFIGURATION:
 *   Passe die Variablen in CONFIG an, wenn du die Datei umbenennt oder
 *   das Repo in eine andere Organisation verschoben hast.
 */

const CONFIG = {
  // GitHub Raw URL zur Scammer-Liste
  // Unterstützte Formate: .txt (eine Zeile pro Scammer), .json (Array oder Objekt)
  GITHUB_USER: 'Maxknuff',
  GITHUB_REPO: 'HaydayScammerlist',
  GITHUB_BRANCH: 'main',
  GITHUB_FILE: 'scammerlist.txt',   // ← Dateiname deiner Liste

  ITEMS_PER_PAGE: 24,
  CACHE_MINUTES: 10,   // Wie lange die Liste lokal gecacht wird
};

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  all: [],          // Alle Scammer (original)
  filtered: [],     // Nach Suche/Filter gefiltert
  page: 1,
  filter: 'all',
  query: '',
};

// ─── DOM References ───────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const els = {
  grid:          $('scammerGrid'),
  pagination:    $('pagination'),
  loading:       $('loadingState'),
  error:         $('errorState'),
  empty:         $('emptyState'),
  errorMsg:      $('errorMsg'),
  emptyQuery:    $('emptyQuery'),
  totalCount:    $('totalCount'),
  lastUpdated:   $('lastUpdated'),
  filteredCount: $('filteredCount'),
  searchInput:   $('searchInput'),
  clearBtn:      $('clearBtn'),
  refreshBtn:    $('refreshBtn'),
  statusText:    $('statusText'),
  badgeDot:      document.querySelector('.badge-dot'),
};

// ─── GitHub Fetch ─────────────────────────────────────────────────────────────

function getRawUrl(filename) {
  const { GITHUB_USER, GITHUB_REPO, GITHUB_BRANCH } = CONFIG;
  return `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filename}`;
}

function getCacheKey() {
  return `hayday_scammerlist_${CONFIG.GITHUB_FILE}`;
}

async function fetchScammerList(forceRefresh = false) {
  const cacheKey  = getCacheKey();
  const cacheTime = localStorage.getItem(cacheKey + '_time');
  const cacheData = localStorage.getItem(cacheKey);

  // Aus Cache laden wenn noch gültig
  if (!forceRefresh && cacheData && cacheTime) {
    const age = (Date.now() - parseInt(cacheTime)) / 1000 / 60;
    if (age < CONFIG.CACHE_MINUTES) {
      console.log(`[Cache] Lade aus Cache (${Math.round(age)}min alt)`);
      return JSON.parse(cacheData);
    }
  }

  const url = getRawUrl(CONFIG.GITHUB_FILE);
  console.log('[Fetch] Lade von:', url);

  const res = await fetch(url + '?t=' + Date.now(), {
    cache: 'no-store',
    headers: { 'Accept': 'text/plain, application/json' },
  });

  if (!res.ok) {
    // Fallback: versuche andere Dateiformate
    if (CONFIG.GITHUB_FILE.endsWith('.txt')) {
      const fallbackUrl = getRawUrl('scammerlist.json');
      const fallback = await fetch(fallbackUrl + '?t=' + Date.now(), { cache: 'no-store' });
      if (fallback.ok) {
        const data = await fallback.json();
        const parsed = parseData(data, 'json');
        saveCache(parsed);
        return parsed;
      }
    }
    throw new Error(`HTTP ${res.status} – Datei nicht gefunden.\nErwartet: ${url}`);
  }

  const text = await res.text();
  const ext = CONFIG.GITHUB_FILE.split('.').pop().toLowerCase();
  let parsed;

  try {
    if (ext === 'json') {
      parsed = parseData(JSON.parse(text), 'json');
    } else {
      parsed = parseData(text, 'txt');
    }
  } catch (e) {
    // Manchmal ist eine .txt-Datei eigentlich JSON
    try {
      parsed = parseData(JSON.parse(text), 'json');
    } catch {
      parsed = parseData(text, 'txt');
    }
  }

  saveCache(parsed);
  return parsed;
}

function saveCache(data) {
  const cacheKey = getCacheKey();
  localStorage.setItem(cacheKey, JSON.stringify(data));
  localStorage.setItem(cacheKey + '_time', Date.now().toString());
}

// ─── Data Parser ──────────────────────────────────────────────────────────────

/**
 * Konvertiert verschiedene Datenformate in ein einheitliches Schema:
 * { name, tag, reason, status }
 *
 * Unterstützte TXT-Formate:
 *   PlayerName#1234
 *   PlayerName#1234 | Grund des Bans
 *   PlayerName#1234 | Grund | confirmed/suspected
 *   PlayerName (ohne Tag)
 *
 * Unterstützte JSON-Formate:
 *   ["Name1", "Name2"]
 *   [{ "name": "...", "tag": "...", "reason": "...", "status": "..." }]
 *   { "scammers": [...] }
 */
function parseData(raw, format) {
  if (format === 'json') {
    // Objekt mit .scammers Array
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const arr = raw.scammers || raw.list || raw.players || raw.data || Object.values(raw);
      return Array.isArray(arr) ? arr.map(normalizeEntry) : [];
    }
    if (Array.isArray(raw)) {
      return raw.map(normalizeEntry);
    }
    return [];
  }

  // TXT-Format: pro Zeile ein Eintrag
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !l.startsWith('//') && !l.startsWith('--'))
    .map(line => {
      const parts = line.split('|').map(p => p.trim());
      const nameRaw = parts[0] || '';
      const reason  = parts[1] || '';
      const status  = parseStatus(parts[2] || '');

      // Name + optionaler Discord-Tag (#XXXX)
      const hashIdx = nameRaw.lastIndexOf('#');
      let name, tag;
      if (hashIdx > 0 && nameRaw.length - hashIdx <= 5) {
        name = nameRaw.substring(0, hashIdx).trim();
        tag  = nameRaw.substring(hashIdx);
      } else {
        name = nameRaw;
        tag  = '';
      }

      return { name, tag, reason, status };
    })
    .filter(e => e.name);
}

function normalizeEntry(e) {
  if (typeof e === 'string') {
    return parseData(e, 'txt')[0] || { name: e, tag: '', reason: '', status: 'confirmed' };
  }
  return {
    name:   e.name   || e.player || e.username || e.ign || String(e),
    tag:    e.tag    || e.discriminator || '',
    reason: e.reason || e.note || e.description || '',
    status: parseStatus(e.status || e.type || 'confirmed'),
  };
}

function parseStatus(s) {
  const lower = (s || '').toLowerCase();
  if (lower.includes('suspect') || lower.includes('verdächtig') || lower.includes('warn')) return 'suspected';
  if (lower.includes('confirm') || lower.includes('bestätigt') || lower.includes('ban')) return 'confirmed';
  return 'confirmed'; // Default
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderCards(items) {
  if (!items.length) return;

  const { page } = state;
  const perPage  = CONFIG.ITEMS_PER_PAGE;
  const start    = (page - 1) * perPage;
  const slice    = items.slice(start, start + perPage);

  els.grid.innerHTML = slice.map((s, i) => createCard(s, i)).join('');
}

function createCard(scammer, idx) {
  const { name, tag, reason, status } = scammer;
  const isConfirmed = status === 'confirmed';
  const badgeClass  = isConfirmed ? 'confirmed' : 'suspected';
  const badgeLabel  = isConfirmed ? '✅ Bestätigt' : '⚠️ Verdächtig';
  const emoji       = isConfirmed ? '💀' : '⚠️';
  const accentStyle = isConfirmed ? '' : 'style="--card-accent: var(--clr-yellow)"';
  const avatarStyle = isConfirmed
    ? 'background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.3)'
    : 'background:rgba(234,179,8,0.15);border-color:rgba(234,179,8,0.3)';
  const delay = Math.min(idx * 30, 300);

  const displayTag  = tag ? `<div class="card-tag">${escHtml(tag)}</div>` : '';
  const displayReason = reason
    ? `<div class="card-reason">🚫 ${escHtml(reason)}</div>`
    : '';

  return `
    <div class="scammer-card" ${accentStyle} style="animation-delay:${delay}ms" role="listitem" aria-label="${escHtml(name)} – ${badgeLabel}">
      <div class="card-avatar" style="${avatarStyle}">${emoji}</div>
      <div class="card-body">
        <div class="card-name">${highlight(escHtml(name), state.query)}</div>
        ${displayTag}
        ${displayReason}
      </div>
      <span class="card-badge ${badgeClass}">${badgeLabel}</span>
    </div>
  `.trim();
}

function highlight(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'),
    '<mark style="background:rgba(245,158,11,0.35);color:#fde68a;border-radius:2px">$1</mark>');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function renderPagination(total) {
  const pages = Math.ceil(total / CONFIG.ITEMS_PER_PAGE);
  if (pages <= 1) { els.pagination.innerHTML = ''; return; }

  const { page } = state;
  let html = '';

  html += `<button class="page-btn" id="prevPage" ${page === 1 ? 'disabled' : ''}>‹ Zurück</button>`;

  const showRange = (from, to) => {
    for (let i = from; i <= to; i++) {
      html += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
  };

  if (pages <= 7) {
    showRange(1, pages);
  } else {
    showRange(1, Math.min(2, pages));
    if (page > 4) html += `<span style="color:var(--clr-muted);padding:0 0.3rem">…</span>`;
    const mid = Math.max(3, Math.min(page, pages - 2));
    showRange(Math.max(3, mid - 1), Math.min(pages - 2, mid + 1));
    if (page < pages - 3) html += `<span style="color:var(--clr-muted);padding:0 0.3rem">…</span>`;
    showRange(Math.max(pages - 1, 3), pages);
  }

  html += `<button class="page-btn" id="nextPage" ${page === pages ? 'disabled' : ''}>Weiter ›</button>`;
  els.pagination.innerHTML = html;

  els.pagination.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => goToPage(parseInt(btn.dataset.page)));
  });
  const prev = $('prevPage'), next = $('nextPage');
  if (prev) prev.addEventListener('click', () => goToPage(page - 1));
  if (next) next.addEventListener('click', () => goToPage(page + 1));
}

function goToPage(p) {
  state.page = p;
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Filter & Search ──────────────────────────────────────────────────────────

function applyFilters() {
  const q      = state.query.toLowerCase().trim();
  const filter = state.filter;

  state.filtered = state.all.filter(s => {
    const matchFilter =
      filter === 'all' ||
      (filter === 'confirmed' && s.status === 'confirmed') ||
      (filter === 'suspected' && s.status === 'suspected');

    if (!matchFilter) return false;
    if (!q) return true;

    return (
      s.name.toLowerCase().includes(q) ||
      s.tag.toLowerCase().includes(q) ||
      s.reason.toLowerCase().includes(q)
    );
  });
}

// ─── UI State Helpers ─────────────────────────────────────────────────────────

function showState(which) {
  els.loading.classList.add('hidden');
  els.error.classList.add('hidden');
  els.empty.classList.add('hidden');
  els.grid.innerHTML = '';
  els.pagination.innerHTML = '';
  if (which) document.getElementById(which + 'State').classList.remove('hidden');
}

function setStatus(type, text) {
  const dot = els.badgeDot;
  dot.className = 'badge-dot' + (type !== 'ok' ? ' ' + type : '');
  els.statusText.textContent = text;
}

function updateStats(total, filtered) {
  els.totalCount.textContent    = total.toLocaleString('de-DE');
  els.filteredCount.textContent = filtered.toLocaleString('de-DE');
  const cached = localStorage.getItem(getCacheKey() + '_time');
  if (cached) {
    const d = new Date(parseInt(cached));
    els.lastUpdated.textContent = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
}

function renderAll() {
  applyFilters();
  const { filtered } = state;
  updateStats(state.all.length, filtered.length);

  if (filtered.length === 0 && state.query) {
    showState('empty');
    els.emptyQuery.textContent = state.query;
    return;
  }

  showState(null);
  renderCards(filtered);
  renderPagination(filtered.length);
}

// ─── Load Flow ────────────────────────────────────────────────────────────────

async function loadList(forceRefresh = false) {
  showState('loading');
  setStatus('loading', 'Lädt...');

  try {
    const data = await fetchScammerList(forceRefresh);
    state.all    = data;
    state.page   = 1;
    state.filter = 'all';
    state.query  = '';
    els.searchInput.value = '';
    els.clearBtn.classList.remove('visible');
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    $('filterAll').classList.add('active');

    renderAll();
    setStatus('ok', `${data.length} Scammer geladen`);
    console.log(`[OK] ${data.length} Einträge geladen`);
  } catch (err) {
    console.error('[Error]', err);
    showState('error');
    els.errorMsg.textContent = err.message || 'Unbekannter Fehler';
    setStatus('error', 'Fehler beim Laden');
  } finally {
    els.refreshBtn.classList.remove('spinning');
  }
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

els.searchInput.addEventListener('input', () => {
  state.query = els.searchInput.value;
  state.page  = 1;
  els.clearBtn.classList.toggle('visible', state.query.length > 0);
  renderAll();
});

els.clearBtn.addEventListener('click', () => {
  els.searchInput.value = '';
  state.query = '';
  state.page  = 1;
  els.clearBtn.classList.remove('visible');
  renderAll();
  els.searchInput.focus();
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.filter = btn.dataset.filter;
    state.page   = 1;
    renderAll();
  });
});

els.refreshBtn.addEventListener('click', () => {
  els.refreshBtn.classList.add('spinning');
  loadList(true);
});

$('retryBtn').addEventListener('click', () => loadList(false));

// ─── Background Particles ─────────────────────────────────────────────────────

function initParticles() {
  const container = $('bgParticles');
  const colors = ['#f59e0b', '#ef4444', '#f97316', '#fbbf24', '#fb923c'];
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 2;
    Object.assign(p.style, {
      width:  size + 'px',
      height: size + 'px',
      left:   Math.random() * 100 + '%',
      background: colors[Math.floor(Math.random() * colors.length)],
      '--dur':   (12 + Math.random() * 18) + 's',
      '--delay': (Math.random() * 15) + 's',
      '--op':    (Math.random() * 0.15 + 0.05),
    });
    container.appendChild(p);
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

initParticles();
loadList();
