/* ============================================================
   PROJECT ON SPOT — application logic
   Plain JS · no build step · Markdown entries in ./entries
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Safe browser storage (localStorage with in-memory fallback) ---------- */
  var memory = {};
  var safeStore = {
    get: function (key) {
      try {
        var v = window.localStorage.getItem(key);
        return v === null ? memory[key] ?? null : v;
      } catch (e) {
        return memory[key] ?? null;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {
        memory[key] = value;
      }
    }
  };

  /* ---------- i18n ---------- */
  var I18N = {
    en: {
      skipToIndex: 'Skip to the index',
      navIndex: 'Index',
      navAbout: 'Manifesto',
      issueLine: 'Spot Nº 01 — November 2026',
      mastheadA: 'Exceptional,',
      mastheadB: 'open source.',
      mastheadSub:
        'The curated index of projects.',
      sections: 'Sections',
      allProjects: 'All projects',
      sortLabel: 'Sort',
      sortNewest: 'Newest',
      sortOldest: 'Oldest',
      sortAZ: 'A–Z',
      sortZA: 'Z–A',
      resultCount: function (n) {
        return n === 1 ? '1 project' : n + ' projects';
      },
      viewIcons: 'Icon list view',
      viewList: 'List with thumbnails',
      viewFeature: 'Feature view',
      viewCards: 'Card view',
      visitProject: 'Visit project',
      readEntry: 'Read the entry',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      closePanel: 'Close panel',
      switchTheme: 'Switch theme',
      toDark: 'Switch to dark mode',
      toLight: 'Switch to light mode',
      stars: 'Stars',
      forks: 'Forks',
      license: 'License',
      language: 'Language',
      published: 'Published',
      entry: 'Entry',
      gist: 'View metadata gist',
      emptyTitle: 'Nothing in this section — yet.',
      emptyNote: 'Choose another category from the sidebar.',
      sidebarNote:
        'If you find that your project is in the wrong section or is labeled with incorrect tags, just drop an issue in this repository.'
    },
    hr: {
      skipToIndex: 'Preskoči na indeks',
      navIndex: 'Indeks',
      navAbout: 'Manifest',
      issueLine: 'Spot Nº 01 — studeni 2026.',
      mastheadA: '',
      mastheadB: '',
      mastheadSub:
        'Pažljivo odabrani indeks izuzetnog otvorenog koda. Dvanaest projekata, šest domena — ručno odabrani, precizno prezentirani.',
      sections: 'Sekcije',
      allProjects: 'Svi projekti',
      sortLabel: 'Sortiraj',
      sortNewest: 'Najnovije',
      sortOldest: 'Najstarije',
      sortAZ: 'A–Ž',
      sortZA: 'Ž–A',
      resultCount: function (n) {
        return n === 1 ? '1 projekt' : n + ' projekata';
      },
      viewIcons: 'Pregled ikona',
      viewList: 'Popis sa sličicama',
      viewFeature: 'Naslovni pregled',
      viewCards: 'Pregled kartica',
      visitProject: 'Posjeti projekt',
      readEntry: 'Pročitaj zapis',
      openMenu: 'Otvori izbornik',
      closeMenu: 'Zatvori izbornik',
      closePanel: 'Zatvori panel',
      switchTheme: 'Promijeni temu',
      toDark: 'Prebaci na tamnu temu',
      toLight: 'Prebaci na svijetlu temu',
      stars: 'Zvjezdice',
      forks: 'Forkovi',
      license: 'Licenca',
      language: 'Jezik',
      published: 'Objavljeno',
      entry: 'Zapis',
      gist: 'Pogledaj gist metapodataka',
      emptyTitle: 'U ovoj sekciji još nema ničega.',
      emptyNote: 'Odaberite drugu kategoriju iz bočne trake.',
      sidebarNote:
        'Unosi su Markdown datoteke u entries/. Dodajte jednu, obnovite manifest i pojavit će se ovdje.'
    }
  };
  var t = function (key) {
    return I18N[lang][key];
  };

  /* ---------- State ---------- */
  var STORE_KEY = 'pos-prefs';
  var defaults = {
    view: 'feature',
    sort: 'newest',
    theme: null,
    lang: 'en',
    sidebarOpen: null,
    expandedCats: {}
  };
  var prefs = Object.assign({}, defaults);
  try {
    var saved = JSON.parse(safeStore.get(STORE_KEY) || '{}');
    Object.keys(saved).forEach(function (k) {
      prefs[k] = saved[k];
    });
  } catch (e) {
    /* corrupted store — fall back to defaults */
  }
  function persist() {
    safeStore.set(STORE_KEY, JSON.stringify(prefs));
  }

  var lang = ['en', 'hr'].indexOf(prefs.lang) >= 0 ? prefs.lang : 'en';
  var currentCat = 'all';
  var currentTag = null;
  var projects = [];

  /* ---------- DOM ---------- */
  var $ = function (sel) {
    return document.querySelector(sel);
  };
  var grid = $('#grid');
  var sidebarNav = $('#sidebar-nav');
  var drawer = $('#drawer');
  var drawerScrim = $('#drawer-scrim');
  var sidebarScrim = $('#sidebar-scrim');
  var hamburger = $('#hamburger');

  /* ---------- Helpers ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) {
    return Number(n).toLocaleString('en-US');
  }
  function fmtDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    var months = {
      en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      hr: ['sij', 'velj', 'ožu', 'tra', 'svi', 'lip', 'srp', 'kol', 'ruj', 'lis', 'stu', 'pro']
    };
    return months[lang][d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  /* ---------- Frontmatter parser ---------- */
  function parseFrontmatter(text) {
    var fm = { body: '' };
    var m = /^---\s*\n([\s\S]*?)\n?---\s*\n?([\s\S]*)$/.exec(text);
    if (!m) {
      fm.body = text;
      return fm;
    }
    m[1].split('\n').forEach(function (line) {
      var kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
      if (!kv) return;
      var key = kv[1].toLowerCase();
      var raw = kv[2].trim();
      var val = raw;
      if (/^".*"$/.test(raw) || /^'.*'$/.test(raw)) {
        val = raw.slice(1, -1);
      } else if (/^\[.*\]$/.test(raw)) {
        val = raw
          .slice(1, -1)
          .split(',')
          .map(function (s) {
            return s.trim().replace(/^["']|["']$/g, '');
          })
          .filter(Boolean);
      } else if (/^-?\d+$/.test(raw) && key !== 'pid') {
        val = parseInt(raw, 10);
      } else if (raw === 'true' || raw === 'false') {
        val = raw === 'true';
      } else if (raw === 'null' || raw === '') {
        val = '';
      }
      fm[key] = val;
    });
    fm.body = m[2];
    return fm;
  }

  /* ---------- Procedural cover art (editorial plates) ---------- */
  function coverSVG(p) {
    var seed = parseInt(String(p.pid).replace(/\D/g, '').slice(-3), 10) || 7;
    var initials = escapeHtml((p.title || '?').trim().slice(0, 1));
    var domain = escapeHtml(p.category || '');
    var pattern = seed % 3;
    var defs = '';
    var art = '';

    if (pattern === 0) {
      defs =
        '<pattern id="dots-' + seed + '" width="22" height="22" patternUnits="userSpaceOnUse">' +
        '<circle cx="4" cy="4" r="1.6" fill="var(--gold)" opacity="0.5"/></pattern>';
      art =
        '<rect width="800" height="600" fill="url(#dots-' + seed + ')" opacity="0.55"/>' +
        '<path d="M0 470 L800 380" stroke="var(--ink)" stroke-width="2" fill="none"/>';
    } else if (pattern === 1) {
      defs =
        '<pattern id="grid-' + seed + '" width="56" height="56" patternUnits="userSpaceOnUse">' +
        '<path d="M56 0 H0 V56" fill="none" stroke="var(--gold)" stroke-width="1" opacity="0.45"/></pattern>';
      art =
        '<rect width="800" height="600" fill="url(#grid-' + seed + ')"/>' +
        '<circle cx="640" cy="150" r="110" fill="none" stroke="var(--ink)" stroke-width="2"/>' +
        '<circle cx="640" cy="150" r="70" fill="none" stroke="var(--gold)" stroke-width="1.5"/>';
    } else {
      defs =
        '<pattern id="lines-' + seed + '" width="14" height="14" patternUnits="userSpaceOnUse">' +
        '<path d="M0 14 L14 0" stroke="var(--gold)" stroke-width="1" opacity="0.4"/></pattern>';
      art =
        '<rect width="800" height="600" fill="url(#lines-' + seed + ')"/>' +
        '<rect x="60" y="380" width="220" height="160" fill="none" stroke="var(--ink)" stroke-width="2"/>';
    }

    return (
      '<svg class="cover-art" viewBox="0 0 800 600" role="img" aria-label="Cover plate for ' + escapeHtml(p.title) + '">' +
      '<defs>' + defs + '</defs>' +
      '<rect width="800" height="600" fill="var(--paper)"/>' +
      art +
      '<text x="70" y="300" font-family="Georgia, serif" font-style="italic" font-size="290" fill="var(--ink)" opacity="0.9">' + initials + '</text>' +
      '<text x="70" y="560" font-family="monospace" font-size="17" letter-spacing="4" fill="var(--gold)">' + domain.toUpperCase() + '</text>' +
      '<text x="70" y="588" font-family="monospace" font-size="13" fill="var(--ink)" opacity="0.55">Nº ' + escapeHtml(p.pid) + '</text>' +
      '</svg>'
    );
  }

  function coverWithOverlay(p) {
    var inner = p.image
      ? '<img class="kenburns" src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.title) + '" loading="lazy">'
      : '<div class="kenburns">' + coverSVG(p) + '</div>';
    return (
      '<div class="cover">' + inner +
      '<div class="cover-overlay"><p class="ov-desc">' + escapeHtml(p.description || '') + '</p>' +
      '<span class="ov-open">' + t('readEntry') + ' →</span></div></div>'
    );
  }

  function badgeWall(p) {
    var sep = '<span class="badge-sep" aria-hidden="true"></span>';
    return (
      '<div class="badge-wall" data-testid="badges-' + escapeHtml(p.pid) + '">' +
      '<span class="badge">' + iconStar() + '<b>' + fmt(p.stars || 0) + '</b></span>' +
      '<span class="badge">' + sep + iconFork() + '<b>' + fmt(p.forks || 0) + '</b></span>' +
      (p.license
        ? '<span class="badge">' + sep + iconScale() + escapeHtml(p.license) + '</span>'
        : '') +
      (p.language
        ? '<span class="badge">' + sep + iconCode() + escapeHtml(p.language) + '</span>'
        : '') +
      '</div>'
    );
  }

  function iconStar() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 2.5l2.9 6.3 6.6.7-4.9 4.5 1.4 6.6L12 17l-6 3.6 1.4-6.6L2.5 9.5l6.6-.7z"/></svg>';
  }
  function iconFork() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="6" cy="5" r="2.5"/><circle cx="18" cy="5" r="2.5"/><circle cx="12" cy="19" r="2.5"/><path d="M6 7.5v2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-2M12 12.5v4"/></svg>';
  }
  function iconScale() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3v18M5 7h14M5 7l-2.5 6h5L5 7zm14 0l-2.5 6h5L19 7zM8 21h8"/></svg>';
  }
  function iconCode() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 6l-5 6 5 6M16 6l5 6-5 6M13 4l-2 16"/></svg>';
  }
  function iconArrow() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 12h16M13 5l7 7-7 7"/></svg>';
  }

  /* ---------- View mode icons (matching the brand mark) ---------- */
  var VIEW_ICONS = {
    icons:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 5h4v3H4zM4 10.5h4v3H4zM4 16h4v3H4zM11 6.5h9M11 12h9M11 17.5h9"/></svg>',
    list:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 5h4v3H4zM4 10.5h4v3H4zM4 16h4v3H4zM11 5h9v4h-9zM11 10.5h9v4h-9zM11 16h9v3h-9z"/></svg>',
    feature:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/><path d="M7 7.5h3M7 16.5h3"/></svg>',
    cards:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="4" y="4" width="7.5" height="7.5" rx="1.5"/><rect x="12.5" y="4" width="7.5" height="7.5" rx="1.5"/><rect x="4" y="12.5" width="7.5" height="7.5" rx="1.5"/><rect x="12.5" y="12.5" width="7.5" height="7.5" rx="1.5"/></svg>'
  };

  /* ---------- Sorting ---------- */
  var SORTERS = {
    newest: function (a, b) {
      return b.date < a.date ? -1 : b.date > a.date ? 1 : a.title.localeCompare(b.title);
    },
    oldest: function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : a.title.localeCompare(b.title);
    },
    az: function (a, b) {
      return a.title.localeCompare(b.title);
    },
    za: function (a, b) {
      return b.title.localeCompare(a.title);
    }
  };
  function sorted(list) {
    return list.slice().sort(SORTERS[prefs.sort] || SORTERS.newest);
  }

  function filtered() {
    if (currentCat === 'all') return projects;
    return projects.filter(function (p) {
      if (p.category !== currentCat) return false;
      if (currentTag && (p.tags || []).indexOf(currentTag) === -1) return false;
      return true;
    });
  }

  /* ---------- Rendering: grid ---------- */
  function renderGrid() {
    var list = sorted(filtered());
    var view = prefs.view;
    grid.setAttribute('data-view', view);
    grid.innerHTML = list.map(view === 'icons' ? itemIcons : view === 'list' ? itemList : view === 'feature' ? itemFeature : itemCards).join('');
    $('#result-count').innerHTML =
      '<strong>' + list.length + '</strong> ' + I18N[lang].resultCount(list.length).replace(/^\d+\s*/, '');
    $('#empty-state').hidden = list.length > 0;
    grid.hidden = list.length === 0;
    bindItemEvents();
  }

  function iconImg(p, cls) {
    var src = p.icon || '';
    return (
      '<img class="' + cls + '" src="' + escapeHtml(src) + '" alt="' + escapeHtml(p.title) + ' icon" loading="lazy" ' +
      'onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'' + cls + ' p-mono\'})).textContent=\'' + escapeHtml(p.title).slice(0, 1) + '\'">'
    );
  }

  function itemIcons(p) {
    return (
      '<article class="project-item icons" data-pid="' + escapeHtml(p.pid) + '" tabindex="0" role="button" ' +
      'data-testid="item-' + escapeHtml(p.pid) + '">' +
      iconImg(p, 'p-icon') +
      '<h3 class="p-name">' + escapeHtml(p.title) + '</h3>' +
      '<span class="p-cats">' + escapeHtml(p.category || '') + '</span>' +
      '</article>'
    );
  }

  function itemList(p) {
    return (
      '<article class="project-item list" data-pid="' + escapeHtml(p.pid) + '" tabindex="0" role="button" ' +
      'data-testid="item-' + escapeHtml(p.pid) + '">' +
      iconImg(p, 'p-icon') +
      '<span class="p-thumb">' +
      (p.thumbnail
        ? '<img src="' + escapeHtml(p.thumbnail) + '" alt="" loading="lazy">'
        : coverSVG(p)) +
      '</span>' +
      '<span class="p-body"><h3 class="p-name">' + escapeHtml(p.title) + '</h3>' +
      '<p class="p-desc">' + escapeHtml(p.description || '') + '</p></span>' +
      '<span class="p-arrow">' + iconArrow() + '</span>' +
      '</article>'
    );
  }

  function itemFeature(p) {
    return (
      '<article class="project-item feature" data-pid="' + escapeHtml(p.pid) + '" tabindex="0" role="button" ' +
      'data-testid="item-' + escapeHtml(p.pid) + '">' +
      '<div class="p-head">' + iconImg(p, 'p-icon') +
      '<div><p class="p-kicker">' + escapeHtml(p.category || '') + '</p>' +
      '<h3 class="p-name">' + escapeHtml(p.title) + '</h3></div></div>' +
      coverWithOverlay(p) +
      '<p class="p-desc">' + escapeHtml(p.description || '') + '</p>' +
      badgeWall(p) +
      '</article>'
    );
  }

  function itemCards(p) {
    return (
      '<article class="project-item card" data-pid="' + escapeHtml(p.pid) + '" data-testid="item-' + escapeHtml(p.pid) + '">' +
      '<div class="p-head">' + iconImg(p, 'p-icon') +
      '<h3 class="p-name">' + escapeHtml(p.title) + '</h3></div>' +
      coverWithOverlay(p) +
      '<p class="p-desc">' + escapeHtml(p.description || '') + '</p>' +
      '<a class="p-visit" href="' + escapeHtml(p.repo || '#') + '" target="_blank" rel="noopener noreferrer">' + t('visitProject') + '</a>' +
      badgeWall(p) +
      '</article>'
    );
  }

  function bindItemEvents() {
    grid.querySelectorAll('.project-item').forEach(function (el) {
      var open = function () {
        openDrawer(el.getAttribute('data-pid'));
      };
      el.addEventListener('click', open);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  /* ---------- Rendering: sidebar ---------- */
  function categoryTree() {
    var tree = {};
    projects.forEach(function (p) {
      var cat = p.category || 'Uncategorized';
      tree[cat] = tree[cat] || { count: 0, tags: {} };
      tree[cat].count++;
      (p.tags || []).forEach(function (tag) {
        tree[cat].tags[tag] = (tree[cat].tags[tag] || 0) + 1;
      });
    });
    return tree;
  }

  function renderSidebar() {
    var tree = categoryTree();
    var html =
      '<div class="sidebar-item" data-open="' + (currentCat === 'all') + '">' +
      '<button class="sidebar-link" data-cat="all" data-testid="link-all"' +
      (currentCat === 'all' ? ' aria-current="true"' : '') + '>' +
      '<span>' + t('allProjects') + '</span>' +
      '<span class="count">' + projects.length + '</span></button></div>';

    Object.keys(tree)
      .sort(function (a, b) {
        return a.localeCompare(b);
      })
      .forEach(function (cat) {
        var node = tree[cat];
        var open = !!prefs.expandedCats[cat] || (currentCat === cat && !currentTag);
        var active = currentCat === cat;
        html +=
          '<div class="sidebar-item" data-cat="' + escapeHtml(cat) + '" data-open="' + open + '">' +
          '<button class="sidebar-link" data-cat="' + escapeHtml(cat) + '" aria-expanded="' + open + '" data-testid="link-' + escapeHtml(cat) + '"' +
          (active && !currentTag ? ' aria-current="true"' : '') + '>' +
          '<span>' + escapeHtml(cat) + '</span><span class="chev">' + chevron() + '</span></button>' +
          '<div class="sidebar-submenu">';
        Object.keys(node.tags)
          .sort(function (a, b) {
            return a.localeCompare(b);
          })
          .forEach(function (tag) {
            var tagActive = active && currentTag === tag;
            html +=
              '<button class="sublink" data-cat="' + escapeHtml(cat) + '" data-tag="' + escapeHtml(tag) + '"' +
              (tagActive ? ' aria-current="true"' : '') + ' data-testid="link-' + escapeHtml(cat) + '-' + escapeHtml(tag) + '">' +
              '<span class="dot" aria-hidden="true"></span><span>' + escapeHtml(tag) + '</span>' +
              '<span class="count">' + node.tags[tag] + '</span></button>';
          });
        html += '</div></div>';
      });

    sidebarNav.innerHTML = html;

    sidebarNav.querySelectorAll('.sidebar-link').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cat = btn.getAttribute('data-cat');
        if (cat === 'all') {
          selectCategory('all', null);
        } else {
          var item = btn.closest('.sidebar-item');
          var wasOpen = item.getAttribute('data-open') === 'true';
          prefs.expandedCats[cat] = !wasOpen;
          persist();
          if (wasOpen && currentCat === cat && !currentTag) {
            /* clicking the open category header while viewing it collapses */
          }
          item.setAttribute('data-open', String(!wasOpen));
          btn.setAttribute('aria-expanded', String(!wasOpen));
          selectCategory(cat, null, true);
        }
      });
    });
    sidebarNav.querySelectorAll('.sublink').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectCategory(btn.getAttribute('data-cat'), btn.getAttribute('data-tag'));
      });
    });
  }

  function chevron() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>';
  }

  function selectCategory(cat, tag, keepScroll) {
    currentCat = cat;
    currentTag = tag;
    persist();
    renderSidebar();
    renderGrid();
    if (!keepScroll) {
      document.getElementById('index').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (window.innerWidth < 960) setSidebar(false);
  }

  /* ---------- Drawer ---------- */
  var lastFocus = null;

  function openDrawer(pid) {
    var p = projects.find(function (x) {
      return x.pid === pid;
    });
    if (!p) return;
    lastFocus = document.activeElement;

    var bodyHtml = window.marked
      ? window.marked.parse(p.body || '', { breaks: true })
      : '<p>' + escapeHtml(p.body || '') + '</p>';

    drawer.innerHTML =
      '<div class="drawer-inner">' +
      '<div class="drawer-head">' +
      (p.icon ? '<img class="drawer-icon" src="' + escapeHtml(p.icon) + '" alt="" loading="lazy">' : '') +
      '<div><p class="drawer-kicker">' + escapeHtml(p.category || '') + '</p>' +
      '<h2 class="drawer-title" id="drawer-title">' + escapeHtml(p.title) + '</h2>' +
      '<p class="drawer-meta"><span>' + t('published') + ' ' + fmtDate(p.date) + '</span>' +
      '<span>Nº ' + escapeHtml(p.pid) + '</span></p></div>' +
      '<button class="drawer-close" id="drawer-close" type="button" aria-label="' + t('closePanel') + '" data-testid="button-close-drawer">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button></div>' +
      '<div class="drawer-cover">' + (p.image ? '<img src="' + escapeHtml(p.image) + '" alt="" style="width:100%;aspect-ratio:21/9;object-fit:cover">' : coverSVG(p)) + '</div>' +
      '<div class="drawer-body">' + bodyHtml + '</div>' +
      badgeWall(p) +
      '<div class="drawer-links">' +
      (p.repo ? '<a class="drawer-link" href="' + escapeHtml(p.repo) + '" target="_blank" rel="noopener noreferrer">' + t('visitProject') + ' ↗</a>' : '') +
      (p.metadata ? '<a class="drawer-link ghost" href="' + escapeHtml(p.metadata) + '" target="_blank" rel="noopener noreferrer">' + t('gist') + '</a>' : '') +
      '</div></div>';

    drawer.setAttribute('data-open', 'true');
    drawerScrim.hidden = false;
    document.body.style.overflow = 'hidden';

    $('#drawer-close').addEventListener('click', closeDrawer);
    drawerScrim.addEventListener('click', closeDrawer);
    drawer.querySelector('.drawer-close').focus();
  }

  function closeDrawer() {
    drawer.setAttribute('data-open', 'false');
    drawerScrim.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (drawer.getAttribute('data-open') === 'true') closeDrawer();
      else if (window.innerWidth < 960) setSidebar(false);
    }
  });

  /* ---------- Toolbar ---------- */
  function renderToolbar() {
    var sorter = $('#sorter');
    var options = [
      ['newest', t('sortNewest')],
      ['oldest', t('sortOldest')],
      ['az', t('sortAZ')],
      ['za', t('sortZA')]
    ];
    sorter.innerHTML = options
      .map(function (o) {
        return (
          '<button type="button" data-sort="' + o[0] + '" aria-pressed="' + (prefs.sort === o[0]) + '" data-testid="button-sort-' + o[0] + '">' + o[1] + '</button>'
        );
      })
      .join('');
    sorter.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        prefs.sort = b.getAttribute('data-sort');
        persist();
        renderToolbar();
        renderGrid();
      });
    });

    var views = $('#view-icons');
    views.innerHTML = '';
    ['icons', 'list', 'feature', 'cards'].forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-view-btn', v);
      b.setAttribute('aria-pressed', String(prefs.view === v));
      b.title = t('view' + v.charAt(0).toUpperCase() + v.slice(1));
      b.setAttribute('data-testid', 'button-view-' + v);
      b.innerHTML = VIEW_ICONS[v];
      b.addEventListener('click', function () {
        prefs.view = v;
        persist();
        renderToolbar();
        renderGrid();
      });
      views.appendChild(b);
    });
  }

  /* ---------- Theme ---------- */
  function applyTheme() {
    var theme = prefs.theme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    var btn = $('#theme-toggle');
    btn.setAttribute('aria-label', theme === 'dark' ? t('toLight') : t('toDark'));
  }
  $('#theme-toggle').addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme');
    prefs.theme = current === 'dark' ? 'light' : 'dark';
    persist();
    applyTheme();
  });

  /* ---------- Language ---------- */
  function applyI18n() {
    document.documentElement.setAttribute('lang', lang);
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (typeof I18N[lang][key] === 'string') el.textContent = I18N[lang][key];
    });
    $('#lang-toggle').querySelectorAll('span').forEach(function (s) {
      s.classList.toggle('lang-active', s.getAttribute('data-lang') === lang);
    });
    hamburger.setAttribute('aria-label', t('openMenu'));
    $('#theme-toggle').setAttribute('aria-label', t('switchTheme'));
  }
  $('#lang-toggle').addEventListener('click', function () {
    lang = lang === 'en' ? 'hr' : 'en';
    prefs.lang = lang;
    persist();
    applyI18n();
    renderToolbar();
    renderSidebar();
    renderGrid();
  });

  /* ---------- Sidebar (mobile) ---------- */
  function setSidebar(open) {
    var sidebar = $('#sidebar');
    sidebar.setAttribute('data-open', String(open));
    sidebarScrim.hidden = !open;
    hamburger.setAttribute('aria-expanded', String(open));
    hamburger.setAttribute('aria-label', open ? t('closeMenu') : t('openMenu'));
    if (open) {
      hamburger.querySelector('.hamburger-cross').focus && hamburger.focus();
    }
    document.body.style.overflow = open && window.innerWidth < 960 ? 'hidden' : '';
    if (drawer.getAttribute('data-open') === 'true') document.body.style.overflow = 'hidden';
  }
  hamburger.addEventListener('click', function () {
    setSidebar($('#sidebar').getAttribute('data-open') !== 'true');
  });
  sidebarScrim.addEventListener('click', function () {
    setSidebar(false);
  });

  /* ---------- Boot ---------- */
  function boot(entries) {
    projects = entries;
    document.body.setAttribute('data-ready', 'true');
    applyI18n();
    applyTheme();
    renderSidebar();
    renderToolbar();
    renderGrid();
    if (window.innerWidth < 960 && prefs.sidebarOpen === true) setSidebar(true);
  }

  function fail() {
    document.body.setAttribute('data-ready', 'true');
    grid.hidden = true;
    $('#empty-state').hidden = false;
    $('#empty-state').querySelector('.empty-serif').textContent = 'The index could not be loaded.';
    $('#empty-state').querySelector('.empty-note').textContent =
      'Check that entries/manifest.json is present next to index.html.';
  }

  fetch('./entries/manifest.json')
    .then(function (r) {
      if (!r.ok) throw new Error('manifest');
      return r.json();
    })
    .then(function (m) {
      var files = (m && m.files) || [];
      return Promise.all(
        files.map(function (f) {
          return fetch('./entries/' + f).then(function (r) {
            return r.text();
          });
        })
      );
    })
    .then(function (texts) {
      var entries = texts
        .map(function (text) {
          return parseFrontmatter(text);
        })
        .filter(function (e) {
          return e.pid && e.title;
        })
        .map(function (e) {
          e.tags = Array.isArray(e.tags) ? e.tags : e.tags ? [e.tags] : [];
          return e;
        });
      if (!entries.length) throw new Error('empty');
      boot(entries);
    })
    .catch(fail);
})();
