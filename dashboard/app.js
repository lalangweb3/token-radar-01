// Token Launch Radar — the dashboard page.
//
// Renders the ranked board (pre-token protocols, by implied value), a
// detail drawer for each protocol with the model's working and its farm
// plan, a filterable table, the live-token comparables that calibrate the
// model, and the model's own page. No network: every figure comes from
// window.RADAR, written by main.ts from the sealed snapshot.
(function () {
  var DATA = window.RADAR;
  if (!DATA) {
    document.getElementById('app').textContent = 'No radar data: data.js did not load.';
    return;
  }

  var state = { q: '', category: 'all', chain: 'all', wl: false, tab: 'board', sort: 'implied', dir: -1, detail: null };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'text') node.textContent = attrs[k];
        else if (k === 'class') node.className = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    if (typeof children === 'string') {
      node.textContent = children;
    } else if (children !== undefined && children !== null) {
      var list = Array.isArray(children) ? children : [children];
      list.forEach(function (c) { if (c !== null && c !== undefined) node.appendChild(c); });
    }
    return node;
  }

  function fmtUsd(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return '—';
    if (days < 365) return days + 'd';
    return (days / 365).toFixed(1) + 'y';
  }
  function fmtMult(n) { return '×' + n.toFixed(2); }
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : '—'; }

  function readHash() {
    var h = window.location.hash.replace(/^#/, '');
    h.split('&').forEach(function (pair) {
      var kv = pair.split('=');
      if (kv.length !== 2) return;
      var k = decodeURIComponent(kv[0]);
      var v = decodeURIComponent(kv[1]);
      if (k === 'tab' && (v === 'board' || v === 'live' || v === 'model')) state.tab = v;
      else if (k === 'q') state.q = v;
      else if (k === 'category') state.category = v;
      else if (k === 'chain') state.chain = v;
      else if (k === 'wl') state.wl = v === '1';
      else if (k === 'sort') state.sort = v;
      else if (k === 'detail') state.detail = v || null;
    });
  }
  function writeHash() {
    var parts = [];
    if (state.tab !== 'board') parts.push('tab=' + state.tab);
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.category !== 'all') parts.push('category=' + encodeURIComponent(state.category));
    if (state.chain !== 'all') parts.push('chain=' + encodeURIComponent(state.chain));
    if (state.wl) parts.push('wl=1');
    if (state.sort !== 'implied') parts.push('sort=' + state.sort);
    if (state.detail) parts.push('detail=' + encodeURIComponent(state.detail));
    var hash = parts.length ? '#' + parts.join('&') : '';
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.wl && DATA.watchlist.indexOf(r.slug) < 0) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    var dir = state.dir;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? -Infinity : a.age_days; bv = b.age_days === null ? -Infinity : b.age_days; }
      else if (key === 'name') { return dir * (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av !== bv) return dir * (av < bv ? -1 : 1);
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }
  function bySlug(slug) {
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) return DATA.rows[i];
    return null;
  }
  function isWatchlist(slug) { return DATA.watchlist.indexOf(slug) >= 0; }

  function header() {
    var top = el('header', { class: 'top' }, [
      el('h1', null, [document.createTextNode('Token Launch Radar'), el('span', { class: 'dot', text: '.' })]),
      el('span', { class: 'tag', text: 'model ' + DATA.model_version }),
      el('span', { class: 'tag', text: 'snapshot ' + DATA.as_of }),
    ]);
    var lede = el('p', { class: 'lede' }, [
      document.createTextNode('Protocols that record no token yet, ranked by what a token would be worth if their record stayed as it is. The value is this board\u2019s own claim, built from the snapshot\u2019s figures — TVL, seven-day growth, and how long each protocol has run with no token. It does not predict whether or when a token launches. '),
      el('b', { text: 'Every row carries a farm plan.' }),
    ]);
    var stats = el('div', { class: 'stats' }, [
      el('div', { class: 'stat' }, [el('div', { class: 'n green', text: String(DATA.board_size) }), el('div', { class: 'l', text: 'ranked protocols' })]),
      el('div', { class: 'stat' }, [el('div', { class: 'n', text: String(DATA.watchlist_size) }), el('div', { class: 'l', text: 'on the watchlist floor' })]),
      el('div', { class: 'stat' }, [el('div', { class: 'n', text: String(DATA.early_size) }), el('div', { class: 'l', text: 'early finds below the floor' })]),
      el('div', { class: 'stat' }, [el('div', { class: 'n', text: fmtUsd(DATA.rows[0].implied_value_usd) }), el('div', { class: 'l', text: 'top implied value' })]),
      el('div', { class: 'stat' }, [el('div', { class: 'n', text: '×' + DATA.global_multiple.toFixed(2) }), el('div', { class: 'l', text: 'global comps multiple' })]),
    ]);
    return [top, lede, stats];
  }

  function tabs() {
    function tab(name, label) {
      return el('button', {
        class: state.tab === name ? 'on' : null,
        text: label,
        onclick: function () { state.tab = name; state.detail = null; writeHash(); render(); },
      });
    }
    return el('div', { class: 'tabs' }, [
      tab('board', 'Pre-token board'),
      tab('live', 'Live tokens · comparables'),
      tab('model', 'How the value is built'),
    ]);
  }

  function sortButton(label, key) {
    var arrow = state.sort === key ? (state.dir === -1 ? ' ↓' : ' ↑') : '';
    return el('button', {
      text: label + arrow,
      onclick: function () {
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = key === 'name' ? 1 : -1; }
        writeHash(); render();
      },
    });
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains); }, []))).sort();
    var search = el('input', { type: 'search', placeholder: 'Search a protocol…', value: state.q });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', null, [el('option', { value: 'all', text: 'All categories' })].concat(
      categories.map(function (c) { return el('option', { value: c, text: c }); }),
    ));
    cat.value = state.category;
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var chn = el('select', null, [el('option', { value: 'all', text: 'All chains' })].concat(
      chains.map(function (c) { return el('option', { value: c, text: c }); }),
    ));
    chn.value = state.chain;
    chn.addEventListener('change', function () { state.chain = chn.value; writeHash(); render(); });
    var wl = el('input', { type: 'checkbox' });
    wl.checked = state.wl;
    wl.addEventListener('change', function () { state.wl = wl.checked; writeHash(); render(); });
    var rows = sortedRows(filteredRows());
    return el('div', { class: 'controls' }, [
      search, cat, chn,
      el('label', null, [wl, document.createTextNode(' Watchlist only')]),
      el('span', { class: 'count', text: rows.length + ' of ' + DATA.rows.length + ' rows' }),
    ]);
  }

  function boardTable(rows) {
    var head = el('thead', null, el('tr', null, [
      el('th', null, sortButton('#', 'implied')),
      el('th', { class: 'name' }, sortButton('Protocol', 'name')),
      el('th', null, 'Category'),
      el('th', null, 'Chain'),
      el('th', null, sortButton('TVL', 'tvl')),
      el('th', null, sortButton('7d', 'growth')),
      el('th', null, sortButton('Age', 'age')),
      el('th', null, 'Multiple'),
      el('th', null, sortButton('Implied value', 'implied')),
    ]));
    var body = el('tbody');
    if (rows.length === 0) {
      body.appendChild(el('tr', null, el('td', { colspan: '9', class: 'empty', text: 'Nothing matches this filter.' })));
    }
    rows.forEach(function (r) {
      var tr = el('tr', {
        class: state.detail === r.slug ? 'sel' : null,
        onclick: function () {
          state.detail = state.detail === r.slug ? null : r.slug;
          writeHash(); render();
          if (state.detail) {
            var d = document.querySelector('.detail');
            if (d) d.scrollIntoView({ block: 'nearest' });
          }
        },
      }, [
        el('td', { class: 'rank', text: String(r.rank) }),
        el('td', { class: 'name' }, [
          document.createTextNode(r.name + ' '),
          isWatchlist(r.slug) ? el('span', { class: 'wl', text: 'WATCHLIST' }) : null,
          el('div', null, el('span', { class: 'pill', text: r.slug })),
        ]),
        el('td', { text: r.category || '—' }),
        el('td', { text: chainOf(r) }),
        el('td', { text: fmtUsd(r.tvl_usd) }),
        el('td', { class: r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { text: fmtAge(r.age_days) }),
        el('td', { text: fmtMult(r.comps_multiple) + (r.comps_n > 0 ? ' (' + r.comps_n + ')' : ' · global') }),
        el('td', { class: 'implied', text: fmtUsd(r.implied_value_usd) }),
      ]);
      body.appendChild(tr);
    });
    return el('table', { class: 'board' }, [head, body]);
  }

  function detailPanel(row) {
    var formula = 'implied = ' + fmtUsd(row.tvl_usd) + ' TVL × ' + fmtMult(row.comps_multiple) +
      ' comps × ' + row.growth_multiplier.toFixed(2) + ' growth × ' + row.maturity_multiplier.toFixed(2) +
      ' maturity = ' + fmtUsd(row.implied_value_usd);
    var cells = [
      ['TVL', fmtUsd(row.tvl_usd)],
      ['7-day growth', fmtPct(row.change_7d)],
      ['Age (listed ' + (row.listed_at || 'unknown') + ')', fmtAge(row.age_days)],
      ['Comps multiple', fmtMult(row.comps_multiple) + (row.comps_n > 0 ? ' · ' + row.comps_n + ' comps' : ' · global median')],
      ['Growth factor', '×' + row.growth_multiplier.toFixed(2)],
      ['Maturity factor', '×' + row.maturity_multiplier.toFixed(2)],
      ['Implied value', fmtUsd(row.implied_value_usd)],
    ];
    return el('section', { class: 'detail' }, [
      el('h2', { text: '#' + row.rank + ' · ' + row.name }),
      el('p', { class: 'sub', text: (row.category || 'Uncategorised') + ' · ' + row.chains.join(', ') + ' · records no token' }),
      el('h3', { text: 'The model\u2019s working' }),
      el('div', { class: 'model-grid' }, cells.map(function (c) {
        return el('div', { class: 'model-cell' }, [
          el('div', { class: 'v' + (c[0] === 'Implied value' ? ' green' : ''), text: c[1] }),
          el('div', { class: 'k', text: c[0] }),
        ]);
      })),
      el('div', { class: 'formula' }, [document.createTextNode(formula)]),
      el('h3', { text: 'Farm plan · six steps' }),
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) { return el('li', { text: s }); })),
    ]);
  }

  function liveTable() {
    var head = el('thead', null, el('tr', null, [
      el('th', { text: 'Protocol' }), el('th', { text: 'Category' }), el('th', { text: 'TVL' }),
      el('th', { text: 'Market cap' }), el('th', { text: 'Mcap / TVL' }), el('th', { text: '7d' }),
    ]));
    var body = el('tbody');
    DATA.live.forEach(function (r) {
      body.appendChild(el('tr', null, [
        el('td', { class: 'name', text: r.name }),
        el('td', { text: r.category || '—' }),
        el('td', { text: fmtUsd(r.tvl_usd) }),
        el('td', { text: fmtUsd(r.mcap_usd) }),
        el('td', { text: r.mcap_tvl === null ? '—' : '×' + r.mcap_tvl.toFixed(2) }),
        el('td', { class: r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
      ]));
    });
    return el('div', { class: 'note' }, [
      el('h2', { text: 'Live tokens · the comparables' }),
      el('p', { text: 'These protocols already trade. Their market-cap-to-TVL ratios are what calibrate the board: each category\u2019s multiple is the median of its own live tokens. They are kept apart from the ranked board, never mixed into it.' }),
      el('table', { class: 'mini' }, [head, body]),
    ]);
  }

  function modelPage() {
    var multRows = DATA.multiples.map(function (m) {
      return el('tr', null, [
        el('td', { text: m.category }),
        el('td', null, el('b', { text: '×' + m.multiple.toFixed(2) })),
        el('td', { text: String(m.comps) }),
      ]);
    });
    return el('div', { class: 'model-note' }, [
      el('h2', { text: 'How the value is built' }),
      el('p', null, [document.createTextNode('One formula scores every protocol. The multiple is not a guess: it is the median market-cap-to-TVL ratio of the live tokens in the same category, computed from this snapshot at run time. Categories with fewer than three live comparables use the global median, ×'), el('b', { text: DATA.global_multiple.toFixed(2) }), document.createTextNode('.')]),
      el('p', null, [el('code', { text: 'implied = tvl_usd × compsMultiple(category) × growthFactor × maturityFactor' })]),
      el('p', { text: 'growthFactor = 1 + clamp(change_7d, −50, +100) / 100 × 0.4 — a week of growth moves the value, it never decides it.' }),
      el('p', { text: 'maturityFactor = 0.7 + min(age_days, 1460) / 1460 × 0.5 — a protocol that has run longer with no token scores higher, up to ×1.2. Age counts from listed_at to the snapshot date; a protocol with no listed date is scored as 365 days old.' }),
      el('p', { text: 'No protocol name is ever special-cased. The same function scores every row, and the board separates the pre-token protocols it ranks from the live tokens that calibrate it.' }),
      el('h2', { text: 'Category multiples' }),
      el('table', { class: 'mini' }, [
        el('thead', null, el('tr', null, [el('th', { text: 'Category' }), el('th', { text: 'Multiple' }), el('th', { text: 'Live comps' })])),
        el('tbody', null, multRows),
      ]),
      el('h2', { text: 'What this board does not do' }),
      el('p', { text: 'It does not predict whether or when a token launches, and it does not say a protocol has no token — only that its DefiLlama record carries none. A farm plan is a starting point, not a promise of a reward.' }),
    ]);
  }

  function render() {
    var app = document.getElementById('app');
    app.textContent = '';
    header().forEach(function (n) { app.appendChild(n); });
    app.appendChild(tabs());
    if (state.tab === 'board') {
      app.appendChild(controls());
      var sel = state.detail ? bySlug(state.detail) : null;
      if (sel) app.appendChild(detailPanel(sel));
      app.appendChild(boardTable(sortedRows(filteredRows())));
    } else if (state.tab === 'live') {
      app.appendChild(liveTable());
    } else {
      app.appendChild(modelPage());
    }
    app.appendChild(el('footer', null, [
      document.createTextNode('Source: DefiLlama protocols, fetched ' + DATA.as_of + '. Implied values are this entry\u2019s own claim, built by model ' + DATA.model_version + '.'),
    ]));
  }

  readHash();
  render();
})();
