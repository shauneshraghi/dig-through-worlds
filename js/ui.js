// Dig Through Worlds: game state, saving, HUD, surface menus, input and the main loop.
// Uses DTW (logic), DTWRender and DTWAudio. Exposes window.__game for tests and dev work.
(function () {
  'use strict';
  var D = DTW, R = DTWRender, A = DTWAudio, T = D.TILE;
  var SAVE_KEY = 'dig-through-worlds-v1';
  var params = new URLSearchParams(location.search);
  var DEV = params.get('dev') === '1';

  // ---------- state & saving ----------
  function load() {
    try { var raw = params.get('fresh') === '1' ? null : localStorage.getItem(SAVE_KEY); if (raw) { var s = D.deserialize(raw); if (s) return s; } } catch (e) {}
    return D.newState(+(params.get('seed')) || (Date.now() % 1e9));
  }
  var S = load();
  if (DEV) { S.coins = Math.max(S.coins, 1e9); S.unlocked = [true, true, true, true, true]; }
  if (params.has('world')) { var pw = +params.get('world'); if (S.unlocked[pw]) S.world = pw; }
  var NOSAVE = DEV || params.get('fresh') === '1';
  function save() { if (NOSAVE) return; try { localStorage.setItem(SAVE_KEY, D.serialize(S)); } catch (e) {} }
  setInterval(save, 5000);
  window.addEventListener('pagehide', save);

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  // the control buttons' icons: one drawn set (24-unit strokes in the text colour), so they look the same on every
  // device instead of each system's emoji
  var ICONS = {
    up: '<path d="M12 20V7M6 12l6-6 6 6M5 3h14"/>',
    pick: '<path d="M4.5 20.5L14 11"/><path d="M7.5 4.5Q19.5 4.5 19.5 16.5"/>',
    bot: '<rect x="5" y="8.5" width="14" height="11" rx="3"/><path d="M12 8.5V5"/><circle cx="12" cy="4" r="1.3" fill="currentColor"/><circle cx="9.3" cy="13.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="14.7" cy="13.5" r="1.4" fill="currentColor" stroke="none"/><path d="M3 12.5v3M21 12.5v3"/>',
    hand: '<path d="M8.5 12.5V5.8a1.6 1.6 0 0 1 3.2 0V11M11.7 10.5V4.6a1.6 1.6 0 0 1 3.2 0v6.2M14.9 10.8V6.6a1.6 1.6 0 0 1 3.2 0v7.2c0 4-2.6 7.2-6.3 7.2-2.6 0-4.3-1.3-5.6-3.4l-2.2-3.7a1.6 1.6 0 0 1 2.6-1.8l1.9 2.2"/>',
    bag: '<path d="M5.5 9h13l-1.2 11H6.7z"/><path d="M9 9V7.5a3 3 0 0 1 6 0V9"/>',
    menu: '<path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h15"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    next: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4.5 4v4.5H9"/>',
    erase: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>'
  };
  function icon(n) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>'; }
  function fmtRate(n) { return n > 0 && n < 10 ? n.toFixed(1) : fmt(n); }
  function fmt(n) {
    n = Math.floor(n);
    if (n < 1000) return '' + n;
    var u = ['K', 'M', 'B', 'T'], i = -1;
    while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return (n < 10 ? n.toFixed(1) : Math.floor(n)) + u[i];
  }
  // a browser that cannot start audio must not stop the touch handler that called this
  function audio() { try { A.init(function () { return { world: S.world, mode: S.mode, depth: S.run ? S.run.y : 0, phase: D.dayPhase(S).phase, wx: D.weather(S).kind }; }); } catch (e) {} }
  function setMute(m) { A.setMute(m); lastPanelKey = ''; }

  // ---------- UI: toasts, HUD, surface panel ----------
  function toast(html, ms) {
    var el = document.createElement('div'); el.className = 'toast'; el.innerHTML = html;
    $('toast').appendChild(el); setTimeout(function () { el.remove(); }, ms || 2000);
    while ($('toast').children.length > 1) $('toast').firstChild.remove();
  }
  // a short bump on a HUD chip, in place of a text pop-up
  function pulse(id) { var el = $(id); if (!el) return; el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
  // a short float at the miner (pit) in place of a toast
  function minerFloat(text, color) { var r = S.run; if (S.mode === 'dig' && r) R.floatText(r.x, r.y - 0.2, r.z, text, color); }
  var station = null, lastPanelKey = '';
  var STATION_TITLE = { shop: '🛒 Shop', helpers: '👷 Helpers', museum: '🏛️ Museum', worlds: '🗺️ Worlds', menu: '☰ Menu' };
  var STATION_TAB = { shop: 'up', helpers: 'he', museum: 'mu', worlds: 'wo', dig: '', menu: 'me' };
  // the ☰ button opens the menu anywhere on the plaza; from it any station's panel can be opened
  var menuOpen = false, menuPick = null;
  var WIDE = window.matchMedia('(min-aspect-ratio: 1/1) and (min-width: 700px)');
  // the materials row: a chip per material (a dot in its colour and the count), dimmed at zero. Laptops show it
  // in the HUD row, portrait phones as a small second row; a wide HUD too narrow for it (a phone on its side
  // with a panel open) drops it rather than overflow. matsKey keeps the fit check to when something changed.
  var matsKey = '';
  function updateMats() {
    var box = $('hMats'), hud = $('hud');
    if (!box.firstChild) D.MATS.forEach(function (m) {
      var c = document.createElement('span'); c.className = 'chip mat'; c.title = m.name;
      c.innerHTML = '<i class="dot" style="background:' + m.color + '"></i><span></span>'; box.appendChild(c);
    });
    var key = S.mats.join() + ':' + S.mode + ':' + $('app').className + ':' + innerWidth + 'x' + innerHeight + ':' + ($('hInc').textContent + $('hCoins').textContent + $('hDepth').textContent).length;
    if (key === matsKey) return; matsKey = key;
    D.MATS.forEach(function (m, t) { var c = box.children[t]; c.lastChild.textContent = fmt(S.mats[t]); c.classList.toggle('zero', !S.mats[t]); });
    hud.classList.remove('tight');
    if (WIDE.matches && hud.scrollWidth > hud.clientWidth + 1) hud.classList.add('tight');
  }
  function updateHud() {
    $('hCoins').textContent = '🪙 ' + fmt(S.coins);
    var r = S.run, depth = S.mode === 'dig' && r ? r.y : S.mode === 'surface' ? 0 : Math.max(0, Math.round(R.dispY));
    $('hDepth').textContent = '⛏ ' + depth + ' / ' + D.DEPTH + ' m';
    var n = r && S.mode !== 'surface' ? r.bag.length : 0, cap = D.bagCap(S);
    var hb = $('hBag'), over = n > cap, bf = Math.min(1, n / Math.max(1, cap));
    hb.lastChild.textContent = (over ? '🎒 Heavy! ' : '🎒 ') + n + '/' + cap; hb.classList.toggle('heavy', over);
    hb.firstChild.style.width = (bf * 100) + '%'; hb.firstChild.style.background = over ? '#e5483a' : bf > 0.7 ? '#ff9f1c' : '#3fbf63';
    var pile = Math.floor(S.pile || 0);
    $('hInc').textContent = '🏛 +' + fmtRate(D.museumIncome(S)) + '/s' + (pile > 0 ? ' · 🪙 ' + fmt(pile) + ' waiting' : '');
    var o2 = $('o2'), isO = D.WORLDS[S.world].rule === 'oxygen' && S.mode === 'dig';
    o2.style.display = isO ? 'block' : 'none';
    if (isO) { var f = r.oxygen / D.O2_MAX; o2.firstChild.style.width = (f * 100) + '%'; o2.firstChild.style.background = f < 0.25 ? '#ff6b6b' : ''; }
    var surf = S.mode === 'surface';
    $('controls').style.visibility = (S.mode === 'dig' || surf) && !splash ? 'visible' : 'hidden';
    $('bAuto').style.display = surf ? 'none' : '';
    $('bFast').style.display = S.mode === 'dig' && !S.run.lock ? '' : 'none';
    // a full bag lights up the Home button so the way back to the surface is easy to spot
    var full = S.mode === 'dig' && n >= cap;
    var bh = $('bHome'), label = surf ? 'dig' : full ? 'full' : 'home';
    if (bh.dataset.k !== label) {
      bh.dataset.k = label;
      bh.innerHTML = surf ? icon('pick') + '<span>Dig!</span>' : full ? icon('bag') + '<span>Full! Home</span>' : icon('up') + '<span>Home</span>';
      if (full) bark(-1, 'full');
      bh.classList.toggle('dig', surf); bh.classList.toggle('primary', surf); bh.classList.toggle('full', full); bh.classList.toggle('gold', full); bh.classList.toggle('glass', !surf && !full);
    }
    // on the plaza a station's menu opens while the miner stands on its pad, or from the ☰ button
    if (!surf || splash) { menuOpen = false; menuPick = null; }
    var plaza = surf && !splash;
    $('bMenu').style.display = $('hInc').style.display = plaza ? '' : 'none';
    $('hDepth').style.display = hb.style.display = surf ? 'none' : '';
    $('bClose').style.display = menuOpen ? '' : 'none';
    var ck = menuPick ? 'back' : 'close', bc = $('bClose');
    if (bc.dataset.k !== ck) { bc.dataset.k = ck; bc.innerHTML = menuPick ? icon('back') + '<span>Menu</span>' : icon('close'); bc.classList.toggle('iconly', !menuPick); bc.setAttribute('aria-label', menuPick ? 'Back to the menu' : 'Close'); }
    var st = surf && !splash ? (menuOpen ? menuPick || 'menu' : D.hubStation(S)) : null;
    if (st !== station) { station = st; lastPanelKey = ''; confirmKind = null; }
    var showPanel = !!station;
    $('surface').classList.toggle('show', showPanel);
    $('bMenu').classList.toggle('on', menuOpen);
    var wide = WIDE.matches;
    $('app').classList.toggle('panel', wide && showPanel);
    R.setView({ right: wide && showPanel ? $('surface').offsetWidth : 0, sheet: !wide, open: showPanel });
    updateMats();
  }
  var UPIC = { drill: '⛏', speed: '⚡', bag: '🎒', magnet: '🧲', diggers: '👷', staff: '🧑‍🏫', crewDrill: '⛏', crewSpeed: '⚡', splash: '🔨', twin: '⛏' };
  var SPECIAL = ['splash', 'twin']; // one-time stretch tools, set apart at the foot of the upgrades
  function specialShown(k) { return !!D.UPGRADES[k] && (!D.upgradeAvailable || D.upgradeAvailable(S, k) || (S.upgrades[k] | 0) > 0); }
  var PICK_NAMES = ['Wooden', 'Stone', 'Iron', 'Golden', 'Crystal'];
  function panelKey() {
    var afford = Object.keys(D.UPGRADES).map(function (k) { return (D.canAfford(S, D.upgradeCost(S, k)) ? 1 : 0) + (D.upgradeAvailable ? (D.upgradeAvailable(S, k) ? 'a' : 'h') : ''); }).concat(Object.keys(D.WORKERS).map(function (k) { return D.canAfford(S, D.hireCost(S, k)) ? 1 : 0; }))
      .concat(Object.keys(D.CREW_UPGRADES).map(function (k) { return D.canAfford(S, D.upgradeCost(S, k)) ? 1 : 0; })).join('');
    return [station, S.world, afford, station === 'shop' ? S.coins + ':' + S.mats.join() + ':' + S.matBought.join() + ':' + xferN : S.mats.join(), station === 'museum' ? D.museumIncome(S).toFixed(1) : '', JSON.stringify(S.upgrades), JSON.stringify(S.workers), S.unlocked.join(), S.relics.join(), S.golden ? 'g' + D.WORLDS.map(function (w, wi) { return [0, 1, 2].map(function (c) { return D.goldFound(S, wi, c); }).join(''); }).join() : '',
      S.museum.map(function (m) { return m.pieces.join(); }).join('|'), D.topLayer(D.site(S, S.world)), confirmKind,
      station === 'helpers' ? D.dayNum(S) + ':' + S.friends.map(function (f) { return [Math.floor(f.xp), f.talk, f.gift, f.told].join(','); }).join('|') : '', S.voice !== false].join(';');
  }
  // a price as chips: coins, then each material needed with a dot in its colour; a chip is dimmed when the player is short of it
  function dot(t) { return '<i class="dot" style="background:' + D.MATS[t].color + '"></i>'; }
  function priceHtml(c) {
    if (!isFinite(c.coins)) return '';
    var h = [];
    if (c.coins > 0) h.push('<span class="chip' + (S.coins < c.coins ? ' lack' : '') + '">🪙 ' + fmt(c.coins) + '</span>');
    c.mats.forEach(function (n, t) { if (n > 0) h.push('<span class="chip' + (S.mats[t] < n ? ' lack' : '') + '" title="' + D.MATS[t].name + '">' + dot(t) + fmt(n) + '</span>'); });
    return '<div class="price">' + h.join('') + '</div>';
  }
  // the shop's stash and exchange: sell any material for coins, or buy one you are short of (it costs more, and more with each unit bought)
  function exchangeRows(body) {
    var h = document.createElement('div'); h.className = 'xhead';
    h.innerHTML = '<b>Your materials</b>';
    var tg = document.createElement('button'); tg.className = 'btn small glass'; tg.setAttribute('aria-label', 'Trade ' + (xferN === 1 ? 10 : 1) + ' at a time'); tg.textContent = '× ' + xferN; tg.onclick = function () { xferN = xferN === 1 ? 10 : 1; lastPanelKey = ''; };
    h.appendChild(tg); body.appendChild(h);
    var note = document.createElement('p'); note.className = 'small'; note.textContent = 'Buying costs more than selling, and more with each one you buy. Dig what you need where it is common!'; body.appendChild(note);
    D.MATS.forEach(function (m, t) {
      var d = document.createElement('div'); d.className = 'row xrow';
      d.innerHTML = '<div class="xdot" style="background:' + m.color + '"></div><div class="txt"><b>' + m.name + ' <span class="have">' + fmt(S.mats[t]) + '</span></b></div>';
      var sell = document.createElement('button'); sell.className = 'btn xbtn sell blue'; sell.innerHTML = '<span>Sell</span><small>+🪙 ' + fmt(D.MAT_PRICE[t] * xferN) + '</small>'; sell.disabled = S.mats[t] < xferN;
      sell.onclick = function () { if (!D.sellMat(S, t, xferN)) A.sfx('no'); else save(); };
      var cost = D.matBuyPrice(S, t, xferN);
      var buy = document.createElement('button'); buy.className = 'btn xbtn buy go'; buy.innerHTML = '<span>Buy</span><small>−🪙 ' + fmt(cost) + '</small>'; buy.disabled = S.coins < cost;
      buy.onclick = function () { if (!D.buyMat(S, t, xferN)) A.sfx('no'); else save(); };
      d.appendChild(sell); d.appendChild(buy); body.appendChild(d);
    });
  }
  var xferN = 1; // how many units one tap on the exchange buys or sells
  // a reset waits for the player to type yes; while that box is open the panel is not redrawn, so typing is not lost
  var confirmKind = null;
  function renderPanel() {
    if (!station) return;
    if (confirmKind && lastPanelKey) return;
    var k = panelKey(); if (k === lastPanelKey) return; lastPanelKey = k;
    var wd = D.WORLDS[S.world], g = D.site(S, S.world), top = D.topLayer(g), tab = STATION_TAB[station], dig = station === 'dig';
    $('sTitle').textContent = dig ? wd.name + (S.relics[S.world] ? ' ✓' : '') : STATION_TITLE[station];
    $('sRule').textContent = dig ? wd.ruleText + (top > 1 ? ' Your dig goes on at ' + top + ' m.' : '') : '';
    $('sRule').style.display = dig ? '' : 'none';
    var body = $('tabBody'); body.innerHTML = ''; body.style.display = dig ? 'none' : '';
    function row(ic, title, sub, btnText, enabled, onClick, cost) {
      var d = document.createElement('div'); d.className = 'row';
      var i = document.createElement('div'); i.className = 'ic'; i.style.cssText = 'font-size:42px;display:flex;align-items:center;justify-content:center;background:#1a1430;border-radius:10px';
      i.textContent = ic;
      var t = document.createElement('div'); t.className = 'txt'; t.innerHTML = '<b>' + title + '</b><small>' + sub + '</small>' + (cost ? priceHtml(cost) : '');
      d.appendChild(i); d.appendChild(t);
      if (btnText) { var b = document.createElement('button'); b.className = 'btn go'; b.textContent = btnText; b.disabled = !enabled; b.onclick = onClick; d.appendChild(b); }
      body.appendChild(d);
    }
    if (tab === 'up') {
      Object.keys(D.UPGRADES).forEach(function (key) {
        if (SPECIAL.indexOf(key) >= 0) return;
        var u = D.UPGRADES[key], c = D.upgradeCost(S, key), lv = S.upgrades[key];
        var sub = key === 'drill' ? u.text + ' · ' + PICK_NAMES[R.pickTier(lv)] + ' pickaxe' : u.text;
        row(UPIC[key], u.name + ' <span class="small">Lv ' + lv + '</span>', sub, isFinite(c.coins) ? 'Buy' : 'MAX', D.canAfford(S, c),
          function () { if (D.buyUpgrade(S, key)) save(); else A.sfx('no'); }, c);
      });
      var spec = SPECIAL.filter(specialShown);
      if (spec.length) {
        var sh = document.createElement('div'); sh.className = 'xhead special'; sh.innerHTML = '<b>★ Special tools</b>'; body.appendChild(sh);
        spec.forEach(function (key) {
          var u = D.UPGRADES[key], owned = (S.upgrades[key] | 0) >= 1, c = D.upgradeCost(S, key), n = body.children.length;
          row(UPIC[key], u.name, u.text, owned ? 'Owned' : 'Buy', !owned && D.canAfford(S, c),
            function () { if (D.buyUpgrade(S, key)) save(); else A.sfx('no'); }, owned ? null : c);
          var d = body.children[n]; d.classList.add('special'); if (owned) d.classList.add('owned');
        });
      }
      exchangeRows(body);
    } else if (tab === 'he') {
      friendCards(body);
      Object.keys(D.WORKERS).forEach(function (key) {
        if (key === 'diggers') return; // the friends above
        var u = D.WORKERS[key], c = D.hireCost(S, key), n = S.workers[key], dig = key === 'diggers', cap = dig ? D.maxDiggers(S) : u.max;
        var sub = dig ? u.text + ' · up to ' + cap + ' now' + (cap < u.max ? ', one more each new world' : '') : u.text;
        var btn = isFinite(c.coins) ? 'Hire' : dig && n < u.max ? '🔒 New world' : 'MAX';
        row(UPIC[key], u.name + ' <span class="small">× ' + n + (dig ? ' / ' + cap : '') + '</span>', sub, btn, D.canAfford(S, c),
          function () { if (D.hire(S, key)) save(); else A.sfx('no'); }, c);
      });
      if (S.workers.diggers > 0) Object.keys(D.CREW_UPGRADES).forEach(function (key) { // the helpers' own pick and pace
        var u = D.CREW_UPGRADES[key], c = D.upgradeCost(S, key), lv = S.upgrades[key] | 0;
        row(UPIC[key], u.name + ' <span class="small">Lv ' + lv + '</span>', u.text, isFinite(c.coins) ? 'Buy' : 'MAX', D.canAfford(S, c),
          function () { if (D.buyUpgrade(S, key)) save(); else A.sfx('no'); }, c);
      });
      var p = document.createElement('p'); p.className = 'small'; p.textContent = 'Helpers work only while the game is open.'; body.appendChild(p);
    } else if (tab === 'mu') {
      var inc = document.createElement('p'); inc.innerHTML = 'Visitors pay <b style="color:var(--gold)">🪙 ' + fmtRate(D.museumIncome(S)) + ' / second</b>. Their coins pile up by the front door: walk in to collect them. Finish a skeleton to draw a crowd!'; inc.style.margin = '0 0 8px'; body.appendChild(inc);
      D.WINGS.forEach(function (wg) { // one block per wing of the museum, listing the skeletons on show there
        var d = document.createElement('div'), got = 0, tot = 0;
        wg.ks.forEach(function (k) { got += D.piecesFound(S, Math.floor(k / 3), k % 3); tot += D.PIECES; });
        d.className = 'wing' + (wg.ks.length && wg.ks.every(function (k) { return !S.unlocked[Math.floor(k / 3)]; }) ? ' locked' : '');
        d.innerHTML = '<b style="font-size:1.15em">' + wg.icon + ' ' + wg.name + '</b> <span class="small">' + (wg.ks.length ? got + ' / ' + tot + ' bones' : S.relics.filter(Boolean).length + ' / ' + D.WORLDS.length + ' relics') + '</span>';
        if (!wg.ks.length) {
          D.WORLDS.forEach(function (w, wi) {
            var rd = document.createElement('div'); rd.className = 'small'; rd.style.marginTop = '4px';
            rd.textContent = S.relics[wi] ? '✨ ' + w.relic.name : '🔒 Relic from ' + (S.unlocked[wi] ? w.name : 'world ' + (wi + 1));
            d.appendChild(rd);
          });
        }
        wg.ks.forEach(function (k) {
          var wi = Math.floor(k / 3), ci = k % 3, cr = D.WORLDS[wi].creatures[ci];
          var have = D.piecesFound(S, wi, ci), done = D.exhibitDone(S, wi, ci), cd = document.createElement('div');
          cd.style.cssText = 'margin-top:8px';
          cd.innerHTML = '<div style="font-size:1.05em"><b>' + (S.unlocked[wi] ? cr.name : '??? (' + D.WORLDS[wi].name + ' dig)') + '</b> <span class="small">' + have + ' / ' + D.PIECES + '</span>' + (S.golden && S.unlocked[wi] ? ' <span class="small" style="color:var(--gold)">✨ gold ' + D.goldFound(S, wi, ci) + ' / ' + D.PIECES + '</span>' : '') +
            (done ? ' <span style="color:var(--good)">✓ complete! +🪙 ' + fmtRate(cr.income) + '/s</span>' : '') + '</div>';
          var ps = document.createElement('div'); ps.className = 'pieces';
          cr.parts.forEach(function (fn, pi) {
            var c = S.museum[wi].pieces[ci * D.PIECES + pi], sp = document.createElement('span'); sp.className = 'piece' + (c ? ' have' : '');
            sp.textContent = c ? '🦴 ' + fn : '? ' + (S.unlocked[wi] ? '' : '???'); ps.appendChild(sp);
          });
          cd.appendChild(ps); d.appendChild(cd);
        });
        body.appendChild(d);
      });
    } else if (tab === 'wo') {
      D.WORLDS.forEach(function (w, wi) {
        var d = document.createElement('div'); d.className = 'world' + (wi === S.world ? ' cur' : '') + (S.unlocked[wi] ? '' : ' locked');
        d.style.background = 'linear-gradient(90deg,' + w.pal.dirt[0] + '55,#2a2145)';
        d.innerHTML = '<div class="sw" style="background:linear-gradient(' + w.pal.sky[0] + ',' + w.pal.sky[1] + ' 50%,' + w.pal.top + ' 50%,' + w.pal.dirt[0] + ')"></div><div class="txt"><b>' +
          (wi + 1) + '. ' + (S.unlocked[wi] ? w.name : '???') + (S.golden ? ' <span style="color:var(--gold)">✨ golden</span>' : '') + '</b><small>' +
          (S.unlocked[wi] ? (S.relics[wi] ? '✓ Relic found: ' + w.relic.name : 'Find the ' + w.relic.name + ' at ' + D.DEPTH + ' m') : 'Bring home the relic from world ' + wi + ' to unlock') + '</small></div>';
        if (S.unlocked[wi]) d.onclick = function () { S.world = wi; save(); };
        body.appendChild(d);
      });
      if (S.relics.every(Boolean) && !S.golden) {
        var gb = document.createElement('button'); gb.className = 'btn gold'; gb.style.cssText = 'margin-top:8px;width:100%';
        gb.textContent = '🌟 Dig again for golden bones'; gb.onclick = goGolden; body.appendChild(gb);
      }
      restartRows();
    } else if (tab === 'me') {
      // each station is one big row to tap, with a chevron; sound is a switch
      ['shop', 'helpers', 'museum', 'worlds'].forEach(function (key) {
        var t = STATION_TITLE[key].split(' '), b = document.createElement('button');
        b.className = 'row nav'; b.innerHTML = '<span class="ic">' + t[0] + '</span><span class="txt"><b>' + t.slice(1).join(' ') + '</b></span>' + icon('next');
        b.onclick = function () { menuPick = key; }; body.appendChild(b);
      });
      var on = !A.isMuted(), sw = document.createElement('button');
      sw.className = 'row nav'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', on);
      sw.innerHTML = '<span class="ic">' + (on ? '🔊' : '🔇') + '</span><span class="txt"><b>Sound</b><small>' + (on ? 'On' : 'Off') + '</small></span><span class="switch' + (on ? ' on' : '') + '"><i></i></span>';
      sw.onclick = function () { audio(); setMute(!A.isMuted()); }; body.appendChild(sw);
      var von = S.voice !== false, vs = document.createElement('button');
      vs.className = 'row nav'; vs.setAttribute('role', 'switch'); vs.setAttribute('aria-checked', von);
      vs.innerHTML = '<span class="ic">🗣️</span><span class="txt"><b>Read aloud</b><small>' + (von ? 'Friends talk out loud' : 'Off') + '</small></span><span class="switch' + (von ? ' on' : '') + '"><i></i></span>';
      vs.onclick = function () { audio(); S.voice = S.voice === false; if (S.voice === false) hush(); else speak(0, 'Hi! I will read for you.'); save(); lastPanelKey = ''; }; body.appendChild(vs);
      restartRows();
    }
    function restartRows() {
      var bar = document.createElement('div'); bar.className = 'resets';
      [['site', 'restart', 'Restart world'], ['wipe', 'erase', 'Start over']].forEach(function (o) {
        var b = document.createElement('button'); b.className = 'btn small ghost' + (o[0] === 'wipe' ? ' warn' : '') + (confirmKind === o[0] ? ' on' : ''); b.innerHTML = icon(o[1]) + '<span>' + o[2] + '</span>';
        b.onclick = function () { confirmKind = confirmKind === o[0] ? null : o[0]; lastPanelKey = ''; };
        bar.appendChild(b);
      });
      body.appendChild(bar);
      if (!confirmKind) return;
      var box = document.createElement('div'); box.className = 'confirm';
      var p = document.createElement('p');
      p.textContent = confirmKind === 'site' ? 'This fills in the ' + wd.name + ' pit and starts it again from the top. Type yes to restart it.'
        : 'This erases ALL progress: coins, museum, worlds. Type yes to start over.';
      var inp = document.createElement('input'); inp.type = 'text'; inp.placeholder = 'type yes'; inp.autocomplete = 'off'; inp.autocapitalize = 'off'; inp.spellcheck = false;
      var go = document.createElement('button'); go.className = 'btn small danger'; go.textContent = confirmKind === 'site' ? 'Restart world' : 'Erase everything'; go.disabled = true;
      var no = document.createElement('button'); no.className = 'btn small glass'; no.textContent = 'Cancel';
      function typedYes() { return inp.value.trim().toLowerCase() === 'yes'; }
      inp.oninput = function () { go.disabled = !typedYes(); };
      inp.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter' && typedYes()) go.onclick(); else if (e.key === 'Escape') no.onclick(); };
      no.onclick = function () { confirmKind = null; lastPanelKey = ''; };
      go.onclick = function () {
        if (!typedYes()) return;
        var kind = confirmKind; confirmKind = null; lastPanelKey = '';
        if (kind === 'site') { D.resetSite(S, S.world); save(); toast('New dig site ready!', 1600); return; }
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
        S = D.newState(Date.now() % 1e9); NOSAVE = false; setAutoBtn(); toast('Fresh start!', 1600);
      };
      box.appendChild(p); box.appendChild(inp);
      var btns = document.createElement('div'); btns.className = 'resets'; btns.appendChild(no); btns.appendChild(go); box.appendChild(btns);
      body.appendChild(box);
    }
  }
  function toggleMenu() { audio(); if (S.mode !== 'surface' || splash) return; menuOpen = !menuOpen; menuPick = null; }
  $('bMenu').onclick = toggleMenu;
  $('bClose').onclick = function () { if (menuPick) menuPick = null; else menuOpen = false; };

  // ---------- events from logic ----------
  function drain() {
    var ev = S.events; S.events = [];
    var P = D.WORLDS[S.world].pal, lastBreak = null;
    ev.forEach(function (e) {
      var r = S.run;
      if (e.type === 'break') {
        var col = e.tile === T.GOO ? '#5dff7a' : e.tile === T.STONE ? P.stone : P.dirt[R.layerOf(e.y)];
        R.spawnBreak(e.x, e.y, e.z, col, 8); A.sfx('brk'); R.shake(0.08); lastBreak = e;
        if (e.tile === T.CHEST) R.spawnFind(e.x, e.y, e.z, { kind: 'treasure', world: S.world, value: 0 }, '', { chest: true, ghost: true }); // the chest hops open; its find lies on the floor
      } else if (e.type === 'collect') {
        var it = e.item;
        // the find appears in the pit where its block was; moon loot that bounced into the miner just sparkles there
        var lbl = e.name + (it.n > 1 ? ' ×' + it.n : '') + ((it.kind === 'ore' && D.WORLDS[it.world].ores[it.idx].mat == null) || it.kind === 'treasure' ? ' +' + fmt(D.itemValue(it)) : ''), pick = !lastBreak || (D.WORLDS[S.world].rule === 'lowgrav' && it.kind !== 'relic');
        if (e.at) R.spawnFind(e.at.x - 0.5, e.at.y - 0.4, e.at.z - 0.5, it, lbl, { from: true, carried: !!it.carried }); // flies from where it lay to the miner
        else if (pick) R.spawnFind(r ? r.x : 3, r ? r.y : 0, r ? r.z : 3, it, lbl, { pickup: true });
        else R.spawnFind(lastBreak.x, lastBreak.y, lastBreak.z, it, lbl, { chest: lastBreak.tile === T.CHEST, carried: !!it.carried });
        lastBreak = null;
        A.sfx(it.kind === 'fossil' ? 'fossil' : it.kind === 'treasure' ? 'coin' : 'ding');
        if (it.kind === 'fossil' && Math.random() < 0.6) bark(-1, 'fossil');
      } else if (e.type === 'lock') { A.sfx('ding'); lockKey = ''; }
      else if (e.type === 'pin') { if (!(S.run && S.run.lock && S.run.lock.kind === 'simon')) A.sfx('click'); }
      else if (e.type === 'match') A.sfx('coin');
      else if (e.type === 'miss') A.sfx('no');
      else if (e.type === 'unlocked') { lockWon(); A.sfx('unlock'); }
      else if (e.type === 'smashed') { R.shake(0.25); A.sfx('brk'); R.coinBurst(); }
      else if (e.type === 'quizVisitor') A.sfx('doorbell');
      else if (e.type === 'guest') guestArrived(e);
      else if (e.type === 'guestGift') guestGift(e);
      else if (e.type === 'trapWarn') { A.sfx('alert'); R.shake(0.15); }
      else if (e.type === 'dodged') { A.sfx('dodge'); minerFloat('💨', '#dff6ff'); }
      else if (e.type === 'roomChest') {
        var rcx = e.i % D.N, rcz = Math.floor(e.i / D.N) % D.N, rcy = Math.floor(e.i / (D.N * D.N));
        if (R.roomChest) R.roomChest(rcx, rcy, rcz);
        A.sfx('treasure'); R.coinBurst();
      }
      else if (e.type === 'golden') { A.sfx('treasure'); lastPanelKey = ''; }
      else if (e.type === 'trap' && e.helper) { A.sfx('trap'); R.shake(0.15); if (e.friend >= 0) bark(e.friend, 'trap', true); }
      else if (e.type === 'friendUp') friendUp(e);
      else if (e.type === 'arrive') { if (Math.random() < 0.35) bark(-1, 'hello'); }
      else if (e.type === 'trap') { A.sfx('trap'); R.shake(0.4); }
      else if (e.type === 'bubble') { A.sfx('bubble'); R.floatText(e.x + 0.5, e.y, e.z + 0.5, 'O₂ full!', '#bff7ff'); R.spawnBreak(e.x, e.y, e.z, '#bff7ff', 10); }
      else if (e.type === 'relic') { A.sfx('relic'); toast('✨ <b>' + D.WORLDS[e.world].relic.name + '</b> found!', 2400); R.shake(0.5); }
      else if (e.type === 'ascend') { A.sfx('up'); if (e.reason === 'oxygen') { minerFloat('🫧', '#bff7ff'); R.spawnBreak(r.x, r.y, r.z, '#bff7ff', 12); } }
      else if (e.type === 'descend') A.sfx('down');
      else if (e.type === 'party') { bark(-1, 'party', true); A.sfx('party'); R.shake(0.3); minerFloat('🎉', '#ffe9a8'); }
      else if (e.type === 'partyClear') R.shake(0.2);
      else if (e.type === 'bigBone') { // dust and cracks on the cells still in the ground, and a dull knock
        A.sfx('crack'); var gg = D.site(S, S.world), NN = D.N;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var nx = e.x + d[0], nz = e.z + d[1];
          if (nx >= 0 && nx < NN && nz >= 0 && nz < NN && gg.t[D.idx(nx, e.y, nz)] === T.FOSSIL) { R.spawnBreak(nx, e.y, nz, '#e8dcc0', 5); R.floatText(nx + 0.5, e.y, nz + 0.5, '✦', '#fff3c4'); }
        });
      }
      else if (e.type === 'boneFull') { A.sfx('no'); pulse('hBag'); if (lastBreak) R.floatText(lastBreak.x + 0.5, lastBreak.y, lastBreak.z + 0.5, '🦴✋', '#ffe9a8'); else minerFloat('🦴✋', '#ffe9a8'); }
      else if (e.type === 'delivered') { A.sfx('fossil'); lastPanelKey = ''; R.celebrate(e.world, e.creature); save(); }
      else if (e.type === 'buy' || e.type === 'hire') { A.sfx('buy'); R.coinBurst(); if (e.friend >= 0) setTimeout(function () { talkOpen(e.friend, [STORY.friends[e.friend].meet], 'New friend!'); }, 400); }
      else if (e.type === 'sell' || e.type === 'exchange') A.sfx('coin');
      else if (e.type === 'museumCash') museumCash(e.coins);
      else if (e.type === 'banked') {
        var msg = [];
        if (e.coins > 0) { R.coinBurst(); pulse('hCoins'); }
        var got = e.mats.map(function (n, t) { return n > 0 ? '<span class="chip">' + dot(t) + '+' + fmt(n) + ' ' + D.MATS[t].name + '</span>' : ''; }).join('');
        if (got) pulse('hMats');
        
        if (e.coins > 0 || got) A.sfx('coin');
        if (e.relic !== null) {
          var nx = e.relic + 1;
          if (nx >= 5) startEnding();
          setTimeout(function () { A.sfx('relic'); if (nx < 5) toast('🌍 <b>' + D.WORLDS[nx].name + '</b> unlocked! Visit the 🗺️ Worlds signpost.', 3200); }, 600);
        }
        lastPanelKey = ''; save();
      }
    });
  }

  // ---------- plaza life: guests and storms ----------
  var GUEST_EMOJI = { fox: '🦊', hedgehog: '🦔', frog: '🐸', crab: '🦀', turtle: '🐢', monkey: '🐒', parrot: '🦜', moonbot: '🤖', glorpling: '👾', saucer: '🛸', traveller: '🧳', star: '⭐', pot: '🌈' };
  var GUEST_CALL = { fox: 'callcute', hedgehog: 'callcute', frog: 'callblorp', crab: 'callboop', turtle: 'callcute', monkey: 'callbird', parrot: 'callbird', moonbot: 'callboop', glorpling: 'callblorp', saucer: 'callboop', traveller: 'callcute', star: 'callbird', pot: 'callcute' };
  function guestArrived(e) {
    A.sfx('guest');
    if (S.mode !== 'surface') toast((GUEST_EMOJI[e.kind] || '🎁') + ' A visitor is waiting up top!', 2600); // the event fires once per guest
  }
  function guestGift(e) {
    A.sfx('gift'); setTimeout(function () { A.sfx(GUEST_CALL[e.kind] || 'callcute'); }, 350);
    var parts = [];
    if (e.coins > 0) parts.push('+' + fmt(e.coins) + ' 🪙');
    (e.mats || []).forEach(function (n, t) { if (n > 0) parts.push('+' + fmt(n) + ' ' + D.MATS[t].name); });
    R.floatText(e.x, -0.6, e.z, (GUEST_EMOJI[e.kind] || '🎁') + ' ' + (parts.join(' ') || '🎁'), '#ffe9a8');
    if (e.coins > 0) R.coinBurst();
    pulse('hCoins'); lastPanelKey = '';
  }
  // storms: a flash and, a moment later, thunder every 8 to 20 s while sky shows (the plaza, or the top pit layers)
  var stormT = 10;
  function stormTick(dt) {
    var sky = S.mode === 'surface' || (S.mode === 'dig' && S.run && S.run.y <= 3);
    if (!sky || D.weather(S).kind !== 'storm') { stormT = Math.max(stormT, 4); return; }
    stormT -= dt;
    if (stormT > 0) return;
    stormT = 8 + Math.random() * 12;
    if (R.flash) R.flash();
    setTimeout(function () { A.sfx('thunder'); }, 300 + Math.random() * 700);
  }

  // ---------- the museum quiz ----------
  // A visitor with a ? waits by a finished skeleton (S.quiz). Standing at that plinth opens the question (S.quiz.open);
  // walking away closes the panel but keeps the question. Pictures for 'shape' and 'piece' questions are drawn from the
  // same exhibit art as the plinths.
  var quizEl = $('quiz'), quizObj = null, quizBusy = false, quizHide = 0;
  function quizPic(q, o) {
    var c = document.createElement('canvas'), sp = DTWSprites;
    if (q.kind === 'shape') {
      c.width = 50 * 3; c.height = 30 * 3; var cx = c.getContext('2d'); cx.imageSmoothingEnabled = false;
      sp.exhibit(cx, o, [1, 1, 1, 1, 1], true, c.width / 2, c.height - 2, 3);
    } else {
      var pc = sp.pieceCanvas(q.k, o % D.PIECES), sc = Math.max(1, Math.min(Math.floor(150 / pc.width), Math.floor(84 / pc.height)));
      c.width = pc.width * sc; c.height = pc.height * sc; var c2 = c.getContext('2d'); c2.imageSmoothingEnabled = false; c2.drawImage(pc, 0, 0, c.width, c.height);
    }
    return c;
  }
  function quizOpen(q) {
    quizObj = q; quizBusy = false; clearTimeout(quizHide);
    $('quizQ').textContent = q.text; $('quizMsg').textContent = ''; $('quizMsg').className = '';
    var box = $('quizOpts'); box.innerHTML = ''; box.className = q.kind === 'fact' ? 'words' : 'pics';
    q.opts.forEach(function (o, i) {
      var b = document.createElement('button'); b.dataset.i = i; b.setAttribute('aria-label', q.kind === 'fact' ? o : 'Answer ' + (i + 1));
      if (q.kind === 'fact') b.textContent = o; else b.appendChild(quizPic(q, o));
      box.appendChild(b);
    });
    quizEl.classList.add('show');
  }
  function quizClose() { quizEl.classList.remove('show'); quizObj = null; quizBusy = false; }
  $('quizOpts').addEventListener('pointerdown', function (e) {
    var b = e.target.closest('button'); if (!b || quizBusy || !S.quiz || !S.quiz.open) return;
    audio(); e.preventDefault();
    var q = S.quiz, i = +b.dataset.i, r = D.quizAnswer(S, i); if (!r) return;
    quizBusy = true;
    var bs = $('quizOpts').children; for (var j = 0; j < bs.length; j++) bs[j].disabled = true;
    bs[q.ans].classList.add('right'); if (!r.right) b.classList.add('wrong');
    var m = $('quizMsg'); m.textContent = (r.right ? '🎉 +' : '🪙 +') + fmt(r.coins) + (r.right ? ' coins!' : ' coins'); m.className = 'pop';
    A.sfx(r.right ? 'quizyes' : 'quizno'); pulse('hCoins'); lastPanelKey = '';
    if (r.right) { R.coinBurst(); if (R.quizCheer) R.quizCheer(); }
    quizHide = setTimeout(quizClose, r.right ? 1200 : 2000); save();
  });
  function renderQuiz() {
    var q = S.mode === 'surface' && S.quiz;
    if (quizBusy) { if (S.mode !== 'surface') quizClose(); return; }
    if (q && q.open) {
      var near = D.hubNearExhibit(S);
      if (!near || near.creature < 0 || near.world * D.CREATURES + near.creature !== q.k) { q.open = false; quizClose(); return; } // walked away: keep the question
      if (quizObj !== q) quizOpen(q);
    } else if (quizObj) quizClose();
  }

  // ---------- friends: the helpers' cards at the hut, the talk box, read-aloud and what they say on a dig ----------
  var STORY = DTWStory, talkEl = $('talk'), talkPages = [], talkK = 0, chatN = 0, lastBark = -1e9, hutHello = -1e9;
  function hearts(k) { var n = D.friendLevel(S, k), h = ''; for (var i = 1; i < D.HEARTS.length; i++) h += i <= n ? '♥' : '♡'; return h; }
  // a friend's picture: their helper sprite, standing, three times as big
  function portrait(k, size) {
    var pose = DTWSprites.walkPose(0, 0); pose.lean = 0; pose.air = 0; pose.blink = false;
    var spr = DTWSprites.helper(k, { back: false, carry: false, tier: 0, pose: pose, lampOn: false, surface: true, t: 0 });
    var c = document.createElement('canvas'), sc = size || 2; c.width = 40 * sc; c.height = 46 * sc; c.className = 'fpic';
    var x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(spr.cv, spr.fx - 20, spr.fy - 43, 40, 46, 0, 0, c.width, c.height);
    return c;
  }
  function friendCards(body) {
    var n = S.workers.diggers, cap = D.maxDiggers(S);
    var h = document.createElement('div'); h.className = 'xhead'; h.innerHTML = '<b>Your digging friends</b> <span class="small">' + n + ' / ' + D.FRIENDS.length + '</span>'; body.appendChild(h);
    D.FRIENDS.forEach(function (f, k) {
      if (k > n) return; // only the next friend to meet is shown
      var st = STORY.friends[k], d = document.createElement('div'); d.className = 'row friend' + (k < n ? '' : ' new');
      var pic = document.createElement('div'); pic.className = 'ic'; pic.appendChild(portrait(k, 2)); d.appendChild(pic);
      var txt = document.createElement('div'); txt.className = 'txt';
      if (k < n) {
        var lv = D.friendLevel(S, k), on = lv >= D.PERK_LEVEL, here = f.world <= S.world;
        txt.innerHTML = '<b>' + st.name + ' <span class="hearts">' + hearts(k) + '</span></b><small>' + STORY.HEART_NAMES[lv] + ' · ' + st.who + '</small>' +
          '<small class="perk' + (on ? ' on' : '') + '">' + (on ? '✓ ' : '🔒 ♥♥ ') + '<b>' + st.perk + ':</b> ' + st.perkText + '</small>' +
          (here ? '' : '<small>Digs in ' + D.WORLDS[f.world].name + ' and later</small>');
        d.appendChild(txt);
        var bs = document.createElement('div'); bs.className = 'fbtns';
        var tb = document.createElement('button'); tb.className = 'btn blue small'; tb.innerHTML = '💬 <span>Talk</span>';
        tb.onclick = function () { audio(); talkTo(k); };
        var c = D.giftCost(S, k), ready = D.giftReady(S, k), gb = document.createElement('button'); gb.className = 'btn gold small';
        gb.innerHTML = '🎁 <span>' + (ready ? 'Gift' : 'Tomorrow') + '</span>'; gb.disabled = !ready || !D.canAfford(S, c);
        gb.onclick = function () { audio(); if (D.gift(S, k)) { A.sfx('gift'); talkOpen(k, [st.gift], '🎁 +♥'); save(); } else A.sfx('no'); };
        bs.appendChild(tb); bs.appendChild(gb); d.appendChild(bs);
        if (ready) { var pr = document.createElement('div'); pr.className = 'fgift'; pr.innerHTML = '<small>Gift:</small>' + priceHtml(c); txt.appendChild(pr); }
      } else if (k < cap) {
        txt.innerHTML = '<b>' + st.name + '</b><small>' + st.who + '. ' + st.about + '</small>' + priceHtml(D.hireCost(S, 'diggers'));
        d.appendChild(txt);
        var hb = document.createElement('button'); hb.className = 'btn go'; hb.textContent = 'Ask to join'; hb.disabled = !D.canAfford(S, D.hireCost(S, 'diggers'));
        hb.onclick = function () { audio(); if (D.hire(S, 'diggers')) save(); else A.sfx('no'); };
        d.appendChild(hb);
      } else {
        d.classList.add('locked');
        txt.innerHTML = f.needs != null
          ? '<b>' + st.name + '</b><small>' + STORY.friends[f.needs].name + "'s little sister wants to dig too! Be good friends with " + STORY.friends[f.needs].name + ' (♥♥) first.</small>'
          : '<b>???</b><small>A new friend waits in ' + (S.unlocked[f.world] ? D.WORLDS[f.world].name : 'the next world') + '.</small>';
        d.appendChild(txt);
      }
      body.appendChild(d);
    });
  }
  function talkTo(k) {
    var r = D.talk(S, k); if (!r) return;
    var st = STORY.friends[k], pages = [], title = r.xp ? '+♥' : '';
    if (r.beat) { pages.push(st.story[r.beat - 1]); title = '📖 Story ' + r.beat + ' of ' + st.story.length; }
    else pages.push(st.chat[(r.day + k + chatN++) % st.chat.length]);
    talkOpen(k, pages, title); save();
  }
  function talkOpen(k, pages, tag) {
    talkK = k; talkPages = pages.slice();
    var pic = $('talkPic'); pic.innerHTML = ''; pic.appendChild(portrait(k, 3));
    $('talkName').innerHTML = STORY.friends[k].name + ' <span class="hearts">' + hearts(k) + '</span>' + (tag ? ' <span class="tag">' + tag + '</span>' : '');
    talkEl.classList.add('show'); talkShow();
  }
  function talkShow() {
    var line = talkPages[0]; if (line == null) { talkClose(); return; }
    $('talkText').textContent = line; $('talkNext').textContent = talkPages.length > 1 ? 'Next ▸' : 'OK';
    speak(talkK, line);
  }
  function talkClose() { talkEl.classList.remove('show'); talkPages = []; hush(); lastPanelKey = ''; }
  $('talkNext').onclick = function () { audio(); talkPages.shift(); talkShow(); };
  $('talkAgain').onclick = function () { audio(); speak(talkK, $('talkText').textContent, true); };
  // read-aloud: each friend has a voice (pitch and speed) from story.js; nothing is read while the sound is off
  var synth = window.speechSynthesis || null, enVoice = null;
  function pickVoice() {
    try { var vs = synth.getVoices(); enVoice = vs.filter(function (v) { return /^en[-_]/i.test(v.lang); }).sort(function (a, b) { return (b.localService ? 1 : 0) - (a.localService ? 1 : 0); })[0] || null; } catch (e) {}
  }
  if (synth) { pickVoice(); try { synth.addEventListener('voiceschanged', pickVoice); } catch (e) {} }
  function speak(k, text, force) {
    if (!synth || (!force && (S.voice === false || A.isMuted()))) return;
    try {
      var u = new SpeechSynthesisUtterance(text.replace(/[^\w\s.,!?'’-]/g, ' ')), v = (STORY.friends[k] || STORY.friends[0]).voice;
      u.pitch = v.pitch; u.rate = v.rate * 0.95; u.lang = 'en-US'; if (enVoice) u.voice = enVoice;
      synth.cancel(); synth.speak(u);
    } catch (e) {}
  }
  function hush() { try { if (synth) synth.cancel(); } catch (e) {} }
  // a friend on screen says something now and then: k, or -1 for any helper on screen; urgent lines skip the wait
  var BARK_GAP = 14;
  function bark(k, kind, urgent) {
    var now = performance.now() / 1000;
    if (!urgent && now - lastBark < BARK_GAP) return;
    var who = [];
    for (var i = 0; i < S.workers.diggers; i++) if ((k < 0 || i === k) && R.helperShown(i)) who.push(i);
    if (!who.length) return;
    var f = who[Math.floor(Math.random() * who.length)], ls = STORY.friends[f].lines[kind]; if (!ls) return;
    var line = ls[Math.floor(Math.random() * ls.length)];
    lastBark = now; R.say(f, line); if (!talkEl.classList.contains('show')) speak(f, line);
  }
  function friendUp(e) {
    var st = STORY.friends[e.friend];
    A.sfx('ding');
    toast('💛 <b>' + st.name + '</b> is now your ' + STORY.HEART_NAMES[e.level] + '! ' + hearts(e.friend) + (e.perk ? '<br>✨ ' + st.perk + ' unlocked!' : '') + '<br><small>Talk at the Helpers hut for a story.</small>', 3600);
    bark(e.friend, 'up', true); lastPanelKey = '';
  }
  function hutTick() { // walking up to the hut, a friend says hello
    if (S.mode !== 'surface' || D.hubStation(S) !== 'helpers' || !S.workers.diggers) return;
    var now = performance.now() / 1000; if (now - hutHello < 40) return;
    hutHello = now; bark(-1, 'hello', true);
  }

  // ---------- the ending and the golden replay ----------
  var endingTimer = 0, endingEl = $('ending');
  function startEnding() {
    if (R.finale) R.finale();
    A.sfx('finale');
    clearTimeout(endingTimer);
    endingTimer = setTimeout(function () { endingTimer = 0; if (S.relics.every(Boolean) && !S.golden) endingEl.classList.add('show'); }, 7000);
  }
  function goGolden() {
    if (!D.digAgain(S)) return;
    endingEl.classList.remove('show'); menuOpen = false; menuPick = null; lastPanelKey = '';
    save(); A.sfx('treasure');
    toast('🌟 Fresh ground, golden bones!', 2400);
  }
  $('endGold').onclick = function () { audio(); goGolden(); };
  $('endLater').onclick = function () { endingEl.classList.remove('show'); };

  // ---------- the chest puzzle ----------
  // Shown while the logic holds a puzzle open (run.lock). Pins: one column per pin, the key's tooth over the pin to tap.
  // Pairs: a grid of face-down cards. Simon: four gems that light up in turn, then wait for the player.
  var lockKey = '', simonStep = -1, padFlash = { k: -1, t: 0 };
  var PAIR_ICONS = ['💎', '🦴', '🪙', '⭐', '🍄', '🐚', '🌙', '👾'], PAD_ICONS = ['❤️', '💙', '💚', '💛'];
  var LOCK_TEXT = {
    pins: ['🔒 A locked chest!'],
    pairs: ['🃏 A memory chest!', 'Flip two cards at a time and find every matching pair.'],
    simon: ['🎵 A singing chest!', 'Watch the gems light up…', 'Your turn: tap the gems in the same order.'],
    slide: ['🧩 A puzzle chest!', 'Tap a tile next to the gap to slide it. Put the numbers in order, 1 first.'],
    pipes: ['🚰 A plumbing chest!', 'Tap a pipe to turn it. Make the water run from the left to the right!', 'Tap a pipe to turn it. Make the water reach every green outlet!'],
    odd: ['🔎 An odd-one-out chest!', 'Find the one that is different.'],
    ice: ['🧊 An ice chest!', 'Tap an arrow next to the ice block. It slides until it hits a rock or the edge. Get it into the hole!'],
    path: ['💎 A gem-trail chest!', 'Tap the gems in order, 1, 2, 3…', 'Remember the numbers! Look…', 'The numbers are hidden. Tap the gems in order!']
  };
  var SLIDE_ICONS = ['🍎', '🍊', '🍋', '🍐', '🍇', '🍓', '🍒', '🥝', '🍑', '🍍', '🥥', '🍉', '🥕', '🌽', '🍄'];
  // one pipe tile as inline SVG: an arm from the middle to each open side; wet pipes are blue
  function pipeSvg(L, k, wet) {
    var tl = L.tiles[k], sd = D.pipeSides(tl.t, tl.r), ends = [[20, 0], [40, 20], [20, 40], [0, 20]], body = '', water = '';
    for (var d = 0; d < 4; d++) if (sd[d]) {
      body += '<line x1="20" y1="20" x2="' + ends[d][0] + '" y2="' + ends[d][1] + '" stroke="#9a92b8" stroke-width="11" stroke-linecap="butt"/>';
      if (wet) water += '<line class="water" x1="20" y1="20" x2="' + ends[d][0] + '" y2="' + ends[d][1] + '" stroke="#46c2ff" stroke-width="6"/>';
    }
    var s = '<svg viewBox="0 0 40 40" aria-hidden="true">' + body + '<circle cx="20" cy="20" r="7.5" fill="#9a92b8"/>';
    if (wet) s += water + '<circle cx="20" cy="20" r="4" fill="#46c2ff"/>';
    if (k === L.inlet * L.n) s += '<rect x="0" y="14" width="8" height="12" rx="3" fill="#46c2ff"/>';
    if (k % L.n === L.n - 1 && L.outlets.indexOf(Math.floor(k / L.n)) >= 0) s += '<circle cx="35" cy="20" r="5" fill="#4fd36b" stroke="#fff" stroke-width="1.5"/>';
    return s + '</svg>';
  }
  var lastL = null, prevTiles = null, prevUp = [], prevDone = []; // prevDone: matched cards already shown, which stay still
  // the solved chest's frame lingers a moment: it pops and glows, and the ice block drops into its hole
  function lockWon() {
    var el = $('lock'); if (!el.classList.contains('show')) return;
    var g = el.cloneNode(true); g.removeAttribute('id'); g.className = 'lockwon show'; g.style.animation = '';
    var ids = g.querySelectorAll('[id]'); for (var q = 0; q < ids.length; q++) ids[q].removeAttribute('id');
    var ib = g.querySelector('.iceblk'), L = lastL;
    if (ib && L && L.kind === 'ice') {
      var n = L.n, at = ib.dataset.at | 0, cells = Math.abs(Math.floor(at / n) - Math.floor(L.goal / n)) + Math.abs(at % n - L.goal % n);
      ib.style.transitionDuration = cells * 80 + 'ms, ' + cells * 80 + 'ms, 220ms, 220ms'; ib.style.transitionDelay = '0s, 0s, ' + cells * 80 + 'ms, ' + cells * 80 + 'ms';
      ib.style.left = (L.goal % n) * 100 / n + '%'; ib.style.top = Math.floor(L.goal / n) * 100 / n + '%';
      var ar = g.querySelector('.iceArrows'); if (ar) ar.innerHTML = '';
      setTimeout(function () { ib.classList.add('in'); }, 20);
    }
    var bn = document.createElement('div'); bn.className = 'winbanner'; bn.textContent = '🎉 Open!'; g.appendChild(bn);
    $('stage').appendChild(g); setTimeout(function () { g.remove(); }, 1100);
  }
  function renderLock() {
    var L = S.mode === 'dig' && S.run && S.run.lock, el = $('lock');
    el.classList.toggle('show', !!L);
    if (L && lastL !== L) { var pw = D.WORLDS[S.world].pal.dirt; el.style.setProperty('--wood', pw[1]); el.style.setProperty('--wood2', pw[2]); prevTiles = null; prevUp = []; prevDone = []; }
    if (L) lastL = L;
    if (!L) { lockKey = ''; simonStep = -1; if (smashT) smashStop(); return; }
    var kind = L.kind || 'pins', T0 = LOCK_TEXT[kind], html = '', key, hint;
    if (kind === 'slide') {
      key = 'sl|' + L.i + '|' + L.tiles.join();
      if (key === lockKey) return;
      hint = T0[1];
      html = '<div class="slide s' + L.n + '">';
      L.tiles.forEach(function (v, j) {
        html += v ? '<button class="tile" data-k="' + j + '"><b>' + SLIDE_ICONS[v - 1] + '</b><small>' + v + '</small></button>' : '<div class="gap"></div>';
      });
      html += '</div>';
    } else if (kind === 'pipes') {
      var wet = D.pipeWet(L);
      key = 'pi|' + L.i + '|' + L.tiles.map(function (x) { return x.r; }).join('') + '|' + wet.join();
      if (key === lockKey) return;
      hint = L.outlets.length > 1 ? T0[2] : T0[1];
      html = '<div class="pipes" style="grid-template-columns:repeat(' + L.n + ',minmax(0,1fr))">';
      L.tiles.forEach(function (_, j) { html += '<button class="pipe' + (wet.indexOf(j) >= 0 ? ' wet' : '') + '" data-k="' + j + '" aria-label="Pipe ' + (j + 1) + '">' + pipeSvg(L, j, wet.indexOf(j) >= 0) + '</button>'; });
      html += '</div>';
    } else if (kind === 'ice') {
      // the board is drawn once per chest; after that only the block moves, so its slide animates
      var blk = $('iceBlock'), at0 = L.at, n0 = L.n, IDX = [0, 1, 0, -1], IDZ = [-1, 0, 1, 0], ICH = ['⬆', '➡', '⬇', '⬅'];
      var pos = function () { return 'left:' + (at0 % n0) * 100 / n0 + '%;top:' + Math.floor(at0 / n0) * 100 / n0 + '%;width:' + 100 / n0 + '%;height:' + 100 / n0 + '%'; };
      // the four push arrows sit in the cells beside the block, only where a push would move it
      var arrows = function (delay) {
        var a = '';
        if (at0 !== L.goal) for (var d = 0; d < 4; d++) {
          var r = Math.floor(at0 / n0) + IDZ[d], c = at0 % n0 + IDX[d];
          if (r < 0 || r >= n0 || c < 0 || c >= n0 || D.iceSlide(L, at0, d) === at0) continue;
          a += '<button data-k="' + d + '" aria-label="Push ' + ['up', 'right', 'down', 'left'][d] + '" style="left:' + c * 100 / n0 + '%;top:' + r * 100 / n0 + '%;width:' + 100 / n0 + '%;height:' + 100 / n0 + '%;--dl:' + delay + 's"><span>' + ICH[d] + '</span></button>';
        }
        return a;
      };
      key = 'ic|' + L.i;
      if (key === lockKey && blk) {
        var op = blk.dataset.at | 0;
        if (op !== at0) { // glide cell to cell, about 80 ms a cell; the arrows reappear when it stops
          var cells = Math.abs(Math.floor(op / n0) - Math.floor(at0 / n0)) + Math.abs(op % n0 - at0 % n0), ms = Math.max(1, cells) * 80;
          blk.style.transitionDuration = ms + 'ms'; blk.style.cssText += ';' + pos(); blk.dataset.at = at0;
          $('iceArrows').innerHTML = arrows(ms / 1000);
        }
        return;
      }
      hint = T0[1];
      html = '<div class="ice" style="grid-template-columns:repeat(' + n0 + ',1fr)">';
      L.rocks.forEach(function (r, j) { html += '<div class="ic' + (r ? ' rock' : '') + (j === L.goal ? ' hole' : '') + '">' + (r ? '🪨' : '') + '</div>'; });
      html += '<div id="iceBlock" class="iceblk" data-at="' + at0 + '" style="' + pos() + '">🧊</div><div id="iceArrows" class="iceArrows">' + arrows(0.1) + '</div></div>' +
        '<button class="iceagain" data-k="4" aria-label="Start again">↺ Start again</button>';
    } else if (kind === 'odd') {
      key = 'od|' + L.i + '|' + L.round + '|' + L.cards.join('') + '|' + L.bad;
      if (key === lockKey) return;
      hint = T0[1];
      var cols = L.cards.length <= 4 ? 2 : L.cards.length <= 9 ? 3 : 4;
      html = '<div class="odd" style="max-width:' + cols * 80 + 'px;grid-template-columns:repeat(' + cols + ',minmax(0,1fr))">';
      L.cards.forEach(function (c, j) { html += '<button class="oc' + (j === L.bad ? ' bad' : '') + '" data-k="' + j + '">' + c + '</button>'; });
      html += '</div><div class="dots">' + Array.apply(null, Array(L.rounds)).map(function (_, j) { return '<i' + (j < L.round ? ' class="on"' : '') + '></i>'; }).join('') + '</div>';
    } else if (kind === 'path') {
      var seen = !L.hide || L.show > 0;
      key = 'pa|' + L.i + '|' + L.next + '|' + seen;
      if (key === lockKey) return;
      hint = !L.hide ? T0[1] : seen ? T0[2] : T0[3];
      html = '<div class="gems" style="max-width:' + L.g * 80 + 'px;grid-template-columns:repeat(' + L.g + ',minmax(0,1fr))">';
      L.cells.forEach(function (c, j) {
        html += c ? '<button class="gem' + (c < L.next ? ' got' : '') + '" data-k="' + j + '"' + (L.hide && L.show > 0 ? ' disabled' : '') + '>' + (seen || c < L.next ? '<b>' + c + '</b>' : '💎') + '</button>' : '<div class="gap"></div>';
      });
      html += '</div>';
    } else if (kind === 'simon') {
      var total = D.SIMON_LEAD + L.seq.length * D.SIMON_STEP, el2 = total - L.show - D.SIMON_LEAD, n = Math.floor(el2 / D.SIMON_STEP);
      var lit = L.show > 0 && el2 >= 0 && n < L.seq.length && el2 - n * D.SIMON_STEP < D.SIMON_STEP * 0.7 ? L.seq[n] : -1;
      if (lit >= 0 && n !== simonStep) { simonStep = n; A.sfx('pad' + lit); } // each gem sings as it lights
      if (el2 < 0 || L.show === 0) simonStep = -1;
      var flash = padFlash.k >= 0 && performance.now() - padFlash.t < 250 ? padFlash.k : -1;
      key = 's|' + L.i + '|' + lit + '|' + n + '|' + L.pos + '|' + (L.show > 0) + '|' + flash;
      if (key === lockKey) return;
      hint = L.show > 0 ? T0[1] : T0[2];
      html = '<div class="simon">';
      for (var p = 0; p < D.SIMON_PADS; p++) html += '<button class="pad p' + p + (p === lit || p === flash ? ' lit' : '') + '" data-k="' + p + '"' + (L.show > 0 ? ' disabled' : '') + '>' + PAD_ICONS[p] + '</button>';
      html += '</div><div class="dots">' + L.seq.map(function (_, j) { return '<i' + (j < L.pos ? ' class="on"' : '') + '></i>'; }).join('') + '</div>';
    } else if (kind === 'pairs') {
      key = 'p|' + L.i + '|' + L.up.join() + '|' + L.done.join() + '|' + (L.wait > 0);
      if (key === lockKey) return;
      hint = T0[1];
      html = '<div class="pairs">';
      L.cards.forEach(function (c, j) {
        var up = L.done[j] || L.up.indexOf(j) >= 0;
        html += '<button class="card' + (up ? ' up' : '') + (up && prevUp.indexOf(j) < 0 ? ' flip' : '') + (L.done[j] ? ' done' + (prevDone[j] ? '' : ' matched') : '') + (L.wait > 0 && L.up.indexOf(j) >= 0 ? ' miss' : '') + '" data-k="' + j + '">' + (up ? PAIR_ICONS[c] : '') + '</button>';
      });
      html += '</div>'; prevDone = L.done.slice(); prevUp = L.cards.map(function (_, j) { return L.done[j] || L.up.indexOf(j) >= 0 ? j : -1; });
    } else {
      key = 'k|' + L.i + '|' + L.pins.join() + '|' + L.key.join();
      if (key === lockKey) return;
      hint = L.links.indexOf(2) >= 0 ? 'Match the golden key. ➜ pushes the next pin too, ⇄ pushes both ways.' : L.links.indexOf(1) >= 0 ? 'Match the golden key. A ➜ means that pin pushes the next one too.' : 'Match the golden key.';
      var h = function (v) { return Math.round((v + 1) / D.LOCK_LEVELS * 100) + '%'; };
      html = '<div class="pinrow">';
      for (var k = 0; k < L.pins.length; k++) {
        if (k) html += '<span class="link">' + ['', '➜', '⇄'][L.links[k - 1]] + '</span>';
        html += '<div class="col"><div class="tooth"><i style="height:' + h(L.key[k]) + '"></i></div>' +
          '<button class="pin' + (L.pins[k] === L.key[k] ? ' ok' : '') + '" data-k="' + k + '" aria-label="Pin ' + (k + 1) + '"><i style="height:' + h(L.pins[k]) + '"></i></button></div>';
      }
      html += '</div>';
    }
    lockKey = key;
    $('lockTitle').textContent = T0[0]; $('lockHint').textContent = hint;
    $('lockBoard').innerHTML = html;
    if (kind === 'slide') { // tiles glide from their old cell to the new one
      var tl = $('lockBoard').querySelectorAll('.tile'), old = prevTiles;
      if (old) for (var q = 0; q < tl.length; q++) {
        var v = L.tiles[+tl[q].dataset.k], was = old.indexOf(v), now = +tl[q].dataset.k;
        if (was >= 0 && was !== now) {
          var sz = tl[q].offsetWidth + 6, dx = ((was % L.n) - (now % L.n)) * sz, dy = (Math.floor(was / L.n) - Math.floor(now / L.n)) * sz;
          tl[q].style.transition = 'none'; tl[q].style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; tl[q].style.zIndex = 2;
          void tl[q].offsetWidth; tl[q].style.transition = 'transform .15s ease-out'; tl[q].style.transform = '';
        }
      }
      prevTiles = L.tiles.slice();
    }
  }
  $('lockBoard').addEventListener('pointerdown', function (e) {
    var b = e.target.closest('[data-k]'); if (!b || b.disabled) return;
    audio(); var L = S.run && S.run.lock, k = +b.dataset.k;
    if (L && L.kind === 'simon') { padFlash = { k: k, t: performance.now() }; A.sfx('pad' + k); }
    D.lockTap(S, k); e.preventDefault();
  });
  // Smashing needs a held press (SMASH_HOLD s) so a stray tap on the puzzle never breaks the chest open.
  var SMASH_HOLD = 1.0, smashT = null;
  function smashStop() { if (smashT) { clearTimeout(smashT); smashT = null; } $('bSmash').classList.remove('holding'); }
  $('bSmash').addEventListener('pointerdown', function (e) {
    audio(); smashStop(); e.preventDefault();
    $('bSmash').classList.add('holding');
    smashT = setTimeout(function () { smashT = null; $('bSmash').classList.remove('holding'); D.lockSmash(S); }, SMASH_HOLD * 1000);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { $('bSmash').addEventListener(ev, smashStop); });
  $('bSmash').addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---------- input ----------
  // Museum takings: walking in collects the heap with a toast; while the miner stays inside, each new coin
  // is collected quietly and summed into one small float every CASH_FLOAT seconds, with the toast held back
  // for CASH_QUIET seconds so it never covers the screen.
  var CASH_QUIET = 20, CASH_FLOAT = 5, cashToastT = -1e9, cashFloatT = -1e9, cashPend = 0;
  function museumCash(n) {
    var now = performance.now() / 1000;
    cashPend += n;
    if (now - cashToastT > CASH_QUIET) {
      cashToastT = cashFloatT = now; A.sfx('coin'); R.coinBurst();
      R.floatText(S.hub.x, -0.6, S.hub.z, '+🪙 ' + fmt(cashPend), '#ffd23f');
      pulse('hCoins'); cashPend = 0; save();
    } else if (now - cashFloatT > CASH_FLOAT) {
      cashFloatT = now; cashToastT = now; R.floatText(S.hub.x, -0.6, S.hub.z, '+🪙 ' + fmt(cashPend), '#ffd23f'); cashPend = 0; save();
    } else cashToastT = now; // still inside: keep the toast quiet
  }
  // A fresh press while a cracked trap warns (run.dodge) dodges it and does nothing else. Auto-repeat never dodges.
  function tryDodge(e) {
    if (splash || S.mode !== 'dig' || !(S.run.dodge > 0)) return false;
    audio(); D.dodge(S);
    if (e) { e.preventDefault(); e.stopPropagation(); }
    return true;
  }
  document.addEventListener('pointerdown', tryDodge, true); // the scene and the Faster button alike
  var lastTap = 0;
  function doTap() {
    var now = performance.now(); if (now - lastTap < 70) return; lastTap = now;
    if (S.mode === 'dig' && S.run.stun <= 0) {
      D.tap(S); A.sfx('tap'); R.swingKick();
      var t = S.run.target, N = D.N;
      if (t >= 0) R.spawnBreak(t % N, Math.floor(t / (N * N)), Math.floor(t / N) % N, '#ffffffaa', 2);
    }
  }
  function steer(dir) { audio(); if (S.mode === 'dig') { D.steer(S, dir); A.sfx('step'); } }
  var cv = $('cv'), down = null;
  // Directions held down (keys and the joystick) walk the miner about the plaza and keep steering in the pit.
  // Keys are stored as screen directions ('up', 'right', ...); the joystick stores a compass one for the pit
  // and, in `dirs`, the compass pair for its eight-way screen direction on the plaza.
  // On the plaza a key walks that way on screen; in the pit a key steers along the grid diagonal shown
  // on the joystick (Up ↗ north, Right ↘ east, Down ↙ south, Left ↖ west), the only moves a pit cell has.
  // A press steers once; only a press held longer than REPEAT keeps stepping, so a tap moves one cell.
  var REPEAT = 0.35;
  var held = {}, SCREEN = { up: ['n', 'w'], right: ['n', 'e'], down: ['s', 'e'], left: ['s', 'w'] }, GRID = { up: 'n', right: 'e', down: 's', left: 'w' };
  function press(key, dir, dirs) { held[key] = { dir: dir, dirs: dirs, t: performance.now() }; }
  function heldDirs() { var out = []; Object.keys(held).forEach(function (k) { var h = held[k], d = h.dir; out = out.concat(h.dirs || SCREEN[d] || d); }); return out; }
  function heldGrid() {
    var k = Object.keys(held), h = k.length ? held[k[k.length - 1]] : null;
    return h && performance.now() - h.t > REPEAT * 1000 ? GRID[h.dir] || h.dir : null;
  }
  // A tap on the pit: on a block of the layer being cleared it walks there and digs it, on an open cell it
  // walks there; on the ladder wall it climbs home; elsewhere it digs faster (as does the Faster button).
  // On the plaza a tap on the pit next to the ladder walks to the pad and climbs down; elsewhere it walks to the edge.
  // A tap on the plaza walks to that spot. Holding (or dragging) anywhere on the screen brings up a joystick
  // rooted where the finger went down; it is hidden again when the finger lifts. Outside a small dead zone
  // the pit takes the screen quadrant of the drag, which is one of the four ways the grid runs on screen
  // (↗ north, ↘ east, ↙ south, ↖ west); the plaza takes the nearest of eight screen directions.
  var HOLD = 0.18, DRAG = 12; // seconds held, or pixels dragged, before the joystick shows
  var stick = $('stick'), knob = $('knob'), stickId = null, stickO = null;
  var EIGHT = [['n', 'e'], ['e'], ['s', 'e'], ['s'], ['s', 'w'], ['w'], ['n', 'w'], ['n']]; // right, down-right, down, ... (screen y down)
  function stickShow(x, y) {
    var rc = $('stage').getBoundingClientRect();
    stickO = { x: x, y: y }; stick.style.left = (x - rc.left) + 'px'; stick.style.top = (y - rc.top) + 'px';
    stick.classList.add('show'); knob.style.transform = '';
    if (S.mode === 'surface') S.hub.path = null; // the joystick takes over from a tap's walk
  }
  function stickMove(e) {
    var r = stick.offsetWidth / 2, dx = e.clientX - stickO.x, dy = e.clientY - stickO.y;
    var len = Math.sqrt(dx * dx + dy * dy), lim = r * 0.62, k = len > lim ? lim / len : 1;
    knob.style.transform = 'translate(' + (dx * k) + 'px,' + (dy * k) + 'px)';
    if (len < r * 0.22) { delete held.pad; return; }
    var quad = dy < 0 ? (dx < 0 ? 'w' : 'n') : (dx < 0 ? 's' : 'e');
    var dirs = EIGHT[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
    if (held.pad && held.pad.dir === quad) { held.pad.dirs = dirs; return; }
    press('pad', quad, dirs); steer(quad);
  }
  function stickRelease() { stickId = null; stickO = null; down = null; delete held.pad; knob.style.transform = ''; stick.classList.remove('show'); }
  function stickStart(e) { stickId = e.pointerId; stickShow(down.x, down.y); stickMove(e); }
  cv.addEventListener('pointerdown', function (e) {
    audio();
    if (S.mode === 'surface' && !splash) { var gp = R.groundAt(e.clientX, e.clientY); if (gp) D.hubWalkTo(S, gp[0], gp[1]); }
    else if (S.mode === 'dig') {
      var c = R.cellAt(e.clientX, e.clientY, S.run.y);
      // the x = 0 wall projects onto floor cells with x < 0; up the wall z - x stays the same, so the ladder
      // (and LADDER_REACH cells either side of it) is where z - x is near LADDER_Z
      if (c[0] < 0 && Math.abs(c[1] - c[0] - D.LADDER_Z - 0.5) <= D.LADDER_REACH + 0.5 && !S.run.lock) D.goHome(S, 'ladder');
      else if (D.digAt(S, c[0], c[1])) A.sfx('step'); else doTap();
    }
    else doTap();
    if (stickId !== null || splash) return; // a second finger only taps
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, mouse: e.pointerType === 'mouse', cell: null };
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    if (down.mouse) { down.cell = mouseCell(e); return; } // a mouse drags the miner along instead of a joystick
    var d0 = down;
    setTimeout(function () { if (down === d0 && stickId === null) stickStart({ pointerId: d0.id, clientX: d0.x, clientY: d0.y }); }, HOLD * 1000);
  });
  // A mouse held down and dragged walks the miner to the cell under the pointer (in the pit, digs the block
  // there), retargeting each time the pointer crosses into another cell. Touch keeps the joystick, since a
  // finger would hide the miner. A drag never climbs the ladder; only a click does.
  function mouseCell(e) {
    var c = S.mode === 'surface' ? R.groundAt(e.clientX, e.clientY) : S.mode === 'dig' ? R.cellAt(e.clientX, e.clientY, S.run.y) : null;
    return c ? Math.floor(c[0]) + ',' + Math.floor(c[1]) : null;
  }
  function mouseDrag(e) {
    var key = mouseCell(e);
    if (!key || key === down.cell) return;
    down.cell = key;
    if (S.mode === 'surface') {
      var gp = R.groundAt(e.clientX, e.clientY);
      if (D.hubWalkTo(S, gp[0], gp[1])) S.hub.dig = false;
    } else if (S.mode === 'dig' && !S.run.lock) {
      var c = R.cellAt(e.clientX, e.clientY, S.run.y);
      D.digAt(S, c[0], c[1]);
    }
  }
  cv.addEventListener('pointermove', function (e) {
    if (!down || down.id !== e.pointerId) return;
    if (down.mouse) { mouseDrag(e); return; }
    if (stickId === null) { var dx = e.clientX - down.x, dy = e.clientY - down.y; if (dx * dx + dy * dy > DRAG * DRAG) stickStart(e); }
    else stickMove(e);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) {
    cv.addEventListener(ev, function (e) { if (down && down.id === e.pointerId) stickRelease(); });
  });
  // iOS Safari: a long press would start a text selection or the callout menu and cancel the pointer,
  // so the joystick never got its hold. Pointer events still fire with the touch defaults blocked.
  ['touchstart', 'touchmove'].forEach(function (ev) { cv.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('selectstart', function (e) { if (e.target.tagName !== 'INPUT') e.preventDefault(); });
  // the Faster button: a press is one extra swing, and holding it keeps swinging at FAST_TPS swings a second.
  // The held swings are counted on the game clock in advance(), so slow frames do not lose any.
  var FAST_TPS = 7, fastHeld = false, fastAcc = 0, bFast = $('bFast');
  bFast.innerHTML = icon('pick') + '<small>Faster</small>'; $('bMenu').innerHTML = icon('menu');
  function fastStop() { fastHeld = false; bFast.classList.remove('held'); }
  bFast.addEventListener('pointerdown', function (e) {
    e.preventDefault(); audio(); doTap();
    try { bFast.setPointerCapture(e.pointerId); } catch (er) {}
    fastHeld = true; fastAcc = 0; bFast.classList.add('held');
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { bFast.addEventListener(ev, fastStop); });
  bFast.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  // auto-mining on or off
  function setAutoBtn() { var b = $('bAuto'), on = S.auto !== false; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.innerHTML = icon(on ? 'bot' : 'hand') + '<span>' + (on ? 'Auto' : 'Me') + '</span><i class="led"></i>'; }
  $('bAuto').onclick = function () { audio(); D.setAuto(S, S.auto === false); setAutoBtn(); save(); };
  $('bHome').onclick = function () { audio(); if (S.mode === 'surface') D.startDig(S, S.world); else D.goHome(S); };
  var KEYS = { arrowup: 'up', w: 'up', arrowright: 'right', d: 'right', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left' };
  window.addEventListener('keydown', function (e) {
    if (splash) { startGame(); return; }
    if (e.target.tagName === 'INPUT') return; // typing in the reset box
    var k = e.key.toLowerCase();
    if (k === ' ' && S.mode === 'dig' && S.run.dodge > 0) { if (!e.repeat) tryDodge(); e.preventDefault(); return; }
    var ICE_KEY = { arrowup: 0, w: 0, arrowright: 1, d: 1, arrowdown: 2, s: 2, arrowleft: 3, a: 3, r: 4 };
    if (S.mode === 'dig' && S.run.lock && S.run.lock.kind === 'ice' && k in ICE_KEY) { if (!e.repeat) D.lockTap(S, ICE_KEY[k]); e.preventDefault(); return; }
    if (S.mode === 'dig' && S.run.lock && k >= '1' && k <= '9') { D.lockTap(S, +k - 1); e.preventDefault(); return; } // number keys tap pins
    if (KEYS[k]) { if (!e.repeat) { delete held[k]; press(k, KEYS[k]); steer(GRID[KEYS[k]]); } e.preventDefault(); }
    else if (k === 'q' || k === 'tab') { $('bAuto').onclick(); e.preventDefault(); }
    else if (k === ' ') { if (!e.repeat) doTap(); e.preventDefault(); }
    else if (k === 'h') D.goHome(S);
    else if (k === 'enter' && S.mode === 'surface') { audio(); D.startDig(S, S.world); }
    else if (k === 'm') setMute(!A.isMuted());
    else if (k === 'escape') { if (talkEl.classList.contains('show')) talkClose(); else toggleMenu(); }
  });

  window.addEventListener('keyup', function (e) { delete held[e.key.toLowerCase()]; });
  window.addEventListener('blur', function () { held = {}; stickRelease(); });
  var splash = true;
  function startGame(gesture) { if (!splash) return; splash = false; $('splash').style.display = 'none'; if (gesture !== false) audio(); keepSave(); }
  // Ask the browser to keep the save permanently, so it is not cleared to free space (Chrome grants it quietly to a
  // site in use, Firefox may ask once). Asked on the first tap, since some browsers only grant it after a gesture.
  var keepAsked = false;
  function keepSave() {
    if (keepAsked || DEV) return; keepAsked = true;
    try {
      var st = navigator.storage;
      if (!st || !st.persist) return;
      st.persisted().then(function (on) { return on || st.persist(); })
        .then(function (on) { console.log('Dig Through Worlds save storage: ' + (on ? 'persistent' : 'best effort')); })
        .catch(function () {});
    } catch (e) {}
  }
  $('splash').addEventListener('pointerdown', startGame);
  if (params.get('nosplash') === '1') startGame(false); // no user gesture yet, so no audio until the first tap

  // ---------- main loop ----------
  function advance(dt, noDraw) {
    if (S.mode === 'surface') D.hubInput(S, heldDirs());
    else if (S.mode === 'dig' && S.run.steer === 0) { var hd = heldGrid(); if (hd) D.steer(S, hd); } // held: keep stepping
    if (fastHeld && (S.mode !== 'dig' || S.run.lock)) fastStop();
    var left = dt, swung = 0;
    while (left > 0) {
      var h = Math.min(0.05, left);
      if (fastHeld) { fastAcc += h * FAST_TPS; while (fastAcc >= 1) { fastAcc--; if (S.run.stun <= 0) { D.tap(S); swung++; } } }
      D.step(S, h); left -= h;
    }
    if (swung) { A.sfx('tap'); R.swingKick(); }
    drain(); stormTick(dt); hutTick(); R.update(dt, S);
    if (!noDraw) { R.draw(S); updateHud(); renderPanel(); renderLock(); renderQuiz(); }
  }
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.25, (now - last) / 1000); last = now;
    if (!splash || S.mode !== 'surface') advance(dt); else { R.update(dt, S); R.draw(S); updateHud(); }
    requestAnimationFrame(frame);
  }
  R.init(cv, $('ov'));
  window.addEventListener('resize', function () { R.resize(); });
  setMute(A.isMuted()); setAutoBtn(); advance(0); requestAnimationFrame(frame);

  window.__game = {
    D: D, get s() { return S; },
    // advance the game frame by frame (works while the tab is throttled), drawing once at the end
    step: function (secs) { var n = Math.ceil(secs / 0.05); for (var i = 0; i < n; i++) advance(0.05, i < n - 1); return S.mode; },
    save: save, tap: doTap, start: startGame
  };
})();
