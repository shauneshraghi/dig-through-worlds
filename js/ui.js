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
  function fmtRate(n) { return n > 0 && n < 10 ? n.toFixed(1) : fmt(n); }
  function fmt(n) {
    n = Math.floor(n);
    if (n < 1000) return '' + n;
    var u = ['K', 'M', 'B', 'T'], i = -1;
    while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return (n < 10 ? n.toFixed(1) : Math.floor(n)) + u[i];
  }
  // a browser that cannot start audio must not stop the touch handler that called this
  function audio() { try { A.init(function () { return { world: S.world, mode: S.mode, depth: S.run ? S.run.y : 0 }; }); } catch (e) {} }
  function setMute(m) { A.setMute(m); lastPanelKey = ''; }

  // ---------- UI: toasts, HUD, surface panel ----------
  function toast(html, ms) {
    var el = document.createElement('div'); el.className = 'toast'; el.innerHTML = html;
    $('toast').appendChild(el); setTimeout(function () { el.remove(); }, ms || 2600);
    while ($('toast').children.length > 3) $('toast').firstChild.remove();
  }
  var station = null, lastPanelKey = '';
  var STATION_TITLE = { shop: '🛒 Shop', helpers: '👷 Helpers', museum: '🏛️ Museum', worlds: '🗺️ Worlds', menu: '☰ Menu' };
  var STATION_TAB = { shop: 'up', helpers: 'he', museum: 'mu', worlds: 'wo', dig: '', menu: 'me' };
  // the ☰ button opens the menu anywhere on the plaza; from it any station's panel can be opened
  var menuOpen = false, menuPick = null;
  var WIDE = window.matchMedia('(min-aspect-ratio: 1/1) and (min-width: 700px)');
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
    var bh = $('bHome'), label = surf ? '⛏ Dig!' : '⬆ Home';
    if (bh.textContent !== label) { bh.textContent = label; bh.classList.toggle('dig', surf); }
    // on the plaza a station's menu opens while the miner stands on its pad, or from the ☰ button
    if (!surf || splash) { menuOpen = false; menuPick = null; }
    var plaza = surf && !splash;
    $('bMenu').style.display = $('hInc').style.display = plaza ? '' : 'none';
    $('hDepth').style.display = hb.style.display = surf ? 'none' : '';
    $('bClose').style.display = menuOpen ? '' : 'none';
    $('bClose').textContent = menuPick ? '‹ Menu' : '✕';
    var st = surf && !splash ? (menuOpen ? menuPick || 'menu' : D.hubStation(S)) : null;
    if (st !== station) { station = st; lastPanelKey = ''; confirmKind = null; }
    var showPanel = !!station;
    $('surface').classList.toggle('show', showPanel);
    $('bMenu').classList.toggle('on', menuOpen);
    var wide = WIDE.matches;
    $('app').classList.toggle('panel', wide && showPanel);
    R.setView({ right: wide && showPanel ? $('surface').offsetWidth : 0, sheet: !wide, open: showPanel });
  }
  var UPIC = { drill: '⛏', speed: '⚡', bag: '🎒', magnet: '🧲', diggers: '👷', staff: '🧑‍🏫', crewDrill: '⛏', crewSpeed: '⚡' };
  var PICK_NAMES = ['Wooden', 'Stone', 'Iron', 'Golden', 'Crystal'];
  function panelKey() {
    var afford = Object.keys(D.UPGRADES).map(function (k) { return D.canAfford(S, D.upgradeCost(S, k)) ? 1 : 0; }).concat(Object.keys(D.WORKERS).map(function (k) { return D.canAfford(S, D.hireCost(S, k)) ? 1 : 0; }))
      .concat(Object.keys(D.CREW_UPGRADES).map(function (k) { return D.canAfford(S, D.upgradeCost(S, k)) ? 1 : 0; })).join('');
    return [station, S.world, afford, station === 'shop' ? S.coins + ':' + S.mats.join() + ':' + S.matBought.join() + ':' + xferN : S.mats.join(), station === 'museum' ? D.museumIncome(S).toFixed(1) : '', JSON.stringify(S.upgrades), JSON.stringify(S.workers), S.unlocked.join(), S.relics.join(),
      S.museum.map(function (m) { return m.pieces.join(); }).join('|'), D.topLayer(D.site(S, S.world)), confirmKind].join(';');
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
    var tg = document.createElement('button'); tg.className = 'btn small'; tg.textContent = '× ' + xferN; tg.onclick = function () { xferN = xferN === 1 ? 10 : 1; lastPanelKey = ''; };
    h.appendChild(tg); body.appendChild(h);
    var note = document.createElement('p'); note.className = 'small'; note.textContent = 'Buying costs more than selling, and more with each one you buy. Dig what you need where it is common!'; body.appendChild(note);
    D.MATS.forEach(function (m, t) {
      var d = document.createElement('div'); d.className = 'row xrow';
      d.innerHTML = '<div class="xdot" style="background:' + m.color + '"></div><div class="txt"><b>' + m.name + ' <span class="have">' + fmt(S.mats[t]) + '</span></b></div>';
      var sell = document.createElement('button'); sell.className = 'btn xbtn sell'; sell.innerHTML = 'Sell<br><small>+🪙 ' + fmt(D.MAT_PRICE[t] * xferN) + '</small>'; sell.disabled = S.mats[t] < xferN;
      sell.onclick = function () { if (!D.sellMat(S, t, xferN)) A.sfx('no'); else save(); };
      var cost = D.matBuyPrice(S, t, xferN);
      var buy = document.createElement('button'); buy.className = 'btn xbtn buy'; buy.innerHTML = 'Buy<br><small>−🪙 ' + fmt(cost) + '</small>'; buy.disabled = S.coins < cost;
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
    var wd = D.WORLDS[S.world], g = D.site(S, S.world), tab = STATION_TAB[station], dig = station === 'dig';
    $('sTitle').textContent = dig ? wd.name + (S.relics[S.world] ? ' ✓' : '') : STATION_TITLE[station];
    $('sRule').textContent = dig ? wd.ruleText : '';
    $('sRule').style.display = dig ? '' : 'none';
    var top = D.topLayer(g);
    $('bDig').textContent = top > 1 ? '⛏ Dig! (back to ' + top + ' m)' : '⛏ Dig!';
    $('bDig').style.display = dig ? '' : 'none';
    var body = $('tabBody'); body.innerHTML = ''; body.style.display = dig ? 'none' : '';
    function row(ic, title, sub, btnText, enabled, onClick, cost) {
      var d = document.createElement('div'); d.className = 'row';
      var i = document.createElement('div'); i.className = 'ic'; i.style.cssText = 'font-size:42px;display:flex;align-items:center;justify-content:center;background:#1a1430;border-radius:10px';
      i.textContent = ic;
      var t = document.createElement('div'); t.className = 'txt'; t.innerHTML = '<b>' + title + '</b><small>' + sub + '</small>' + (cost ? priceHtml(cost) : '');
      d.appendChild(i); d.appendChild(t);
      if (btnText) { var b = document.createElement('button'); b.className = 'btn'; b.textContent = btnText; b.disabled = !enabled; b.onclick = onClick; d.appendChild(b); }
      body.appendChild(d);
    }
    if (tab === 'up') {
      Object.keys(D.UPGRADES).forEach(function (key) {
        var u = D.UPGRADES[key], c = D.upgradeCost(S, key), lv = S.upgrades[key];
        var sub = key === 'drill' ? u.text + ' · ' + PICK_NAMES[R.pickTier(lv)] + ' pickaxe' : u.text;
        row(UPIC[key], u.name + ' <span class="small">Lv ' + lv + '</span>', sub, isFinite(c.coins) ? 'Buy' : 'MAX', D.canAfford(S, c),
          function () { if (D.buyUpgrade(S, key)) save(); else A.sfx('no'); }, c);
      });
      exchangeRows(body);
    } else if (tab === 'he') {
      Object.keys(D.WORKERS).forEach(function (key) {
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
          cd.innerHTML = '<div style="font-size:1.05em"><b>' + (S.unlocked[wi] ? cr.name : '??? (' + D.WORLDS[wi].name + ' dig)') + '</b> <span class="small">' + have + ' / ' + D.PIECES + '</span>' +
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
          (wi + 1) + '. ' + (S.unlocked[wi] ? w.name : '???') + '</b><small>' +
          (S.unlocked[wi] ? (S.relics[wi] ? '✓ Relic found: ' + w.relic.name : 'Find the ' + w.relic.name + ' at ' + D.DEPTH + ' m') : 'Bring home the relic from world ' + wi + ' to unlock') + '</small></div>';
        if (S.unlocked[wi]) d.onclick = function () { S.world = wi; save(); };
        body.appendChild(d);
      });
      restartRows();
    } else if (tab === 'me') {
      ['shop', 'helpers', 'museum', 'worlds'].forEach(function (key) {
        var t = STATION_TITLE[key].split(' ');
        row(t[0], t.slice(1).join(' '), '', 'Open', true, function () { menuPick = key; });
      });
      var muted = A.isMuted();
      row(muted ? '🔇' : '🔊', 'Sound', muted ? 'Off' : 'On', muted ? 'Turn on' : 'Turn off', true, function () { audio(); setMute(!A.isMuted()); });
      restartRows();
    }
    function restartRows() {
      var bar = document.createElement('div'); bar.className = 'resets';
      [['site', '🔄 Restart world'], ['wipe', '🧹 Start over']].forEach(function (o) {
        var b = document.createElement('button'); b.className = 'btn small' + (confirmKind === o[0] ? ' on' : ''); b.textContent = o[1];
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
      var no = document.createElement('button'); no.className = 'btn small'; no.textContent = 'Cancel';
      function typedYes() { return inp.value.trim().toLowerCase() === 'yes'; }
      inp.oninput = function () { go.disabled = !typedYes(); };
      inp.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter' && typedYes()) go.onclick(); else if (e.key === 'Escape') no.onclick(); };
      no.onclick = function () { confirmKind = null; lastPanelKey = ''; };
      go.onclick = function () {
        if (!typedYes()) return;
        var kind = confirmKind; confirmKind = null; lastPanelKey = '';
        if (kind === 'site') { D.resetSite(S, S.world); save(); toast('New dig site ready!'); return; }
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
        S = D.newState(Date.now() % 1e9); NOSAVE = false; setAutoBtn(); toast('Fresh start!');
      };
      box.appendChild(p); box.appendChild(inp);
      var btns = document.createElement('div'); btns.className = 'resets'; btns.appendChild(no); btns.appendChild(go); box.appendChild(btns);
      body.appendChild(box);
    }
  }
  function toggleMenu() { audio(); if (S.mode !== 'surface' || splash) return; menuOpen = !menuOpen; menuPick = null; }
  $('bMenu').onclick = toggleMenu;
  $('bClose').onclick = function () { if (menuPick) menuPick = null; else menuOpen = false; };
  $('bDig').onclick = function () { audio(); D.startDig(S, S.world); };

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
        var lbl = e.name + ((it.kind === 'ore' && D.WORLDS[it.world].ores[it.idx].mat == null) || it.kind === 'treasure' ? ' +' + fmt(D.itemValue(it)) : ''), pick = !lastBreak || (D.WORLDS[S.world].rule === 'lowgrav' && it.kind !== 'relic');
        if (e.at) R.spawnFind(e.at.x - 0.5, e.at.y - 0.4, e.at.z - 0.5, it, lbl, { from: true, carried: !!it.carried }); // flies from where it lay to the miner
        else if (pick) R.spawnFind(r ? r.x : 3, r ? r.y : 0, r ? r.z : 3, it, lbl, { pickup: true });
        else R.spawnFind(lastBreak.x, lastBreak.y, lastBreak.z, it, lbl, { chest: lastBreak.tile === T.CHEST, carried: !!it.carried });
        lastBreak = null;
        A.sfx(it.kind === 'fossil' ? 'fossil' : it.kind === 'treasure' ? 'coin' : 'ding');
        if (it.kind === 'fossil') toast(it.chest ? '💰 Chest! A fossil bone inside!' : '🦴 You found a fossil!');
        if (it.kind === 'treasure') toast(it.gem ? '💎 A bonus gem!' : '💰 Treasure!');
      } else if (e.type === 'lock') { A.sfx('ding'); lockKey = ''; }
      else if (e.type === 'pin') { if (!(S.run && S.run.lock && S.run.lock.kind === 'simon')) A.sfx('click'); }
      else if (e.type === 'match') A.sfx('coin');
      else if (e.type === 'miss') A.sfx('no');
      else if (e.type === 'unlocked') { A.sfx('unlock'); toast('🔓 You picked the lock!', 2200); }
      else if (e.type === 'smashed') { R.shake(0.25); toast('🔨 Smash! Only a few coins fell out.', 2200); }
      else if (e.type === 'trap' && e.helper) { A.sfx('trap'); toast('😵 A helper sprang a trap!', 1600); }
      else if (e.type === 'trap') { A.sfx('trap'); toast('😵 A trap! Dizzy for a moment…', 1800); R.shake(0.4); }
      else if (e.type === 'bubble') { A.sfx('bubble'); R.floatText(e.x + 0.5, e.y, e.z + 0.5, 'O₂ full!', '#bff7ff'); R.spawnBreak(e.x, e.y, e.z, '#bff7ff', 10); }
      else if (e.type === 'relic') { A.sfx('relic'); toast('✨ You found the <b>' + D.WORLDS[e.world].relic.name + '</b>! Heading home…', 3500); R.shake(0.5); }
      else if (e.type === 'ascend') { A.sfx('up'); if (e.reason === 'oxygen') toast('🫧 Out of air! Bubbles float you home — your bag is safe.', 3200); }
      else if (e.type === 'descend') A.sfx('down');
      else if (e.type === 'bigBone') toast('🦴 A big bone! Dig out ' + (e.left > 1 ? 'the other ' + e.left + ' blocks' : 'the last block') + ' to free it.', 2200);
      else if (e.type === 'boneFull') toast('🦴 Your hands are full! Take your bone home to the 🏛 museum first.', 3000);
      else if (e.type === 'delivered') { A.sfx('fossil'); toast('🏛 On show: <b>' + e.names.join(', ') + '</b>!', 3200); lastPanelKey = ''; R.celebrate(e.world, e.creature); save(); }
      else if (e.type === 'buy' || e.type === 'hire') A.sfx('buy');
      else if (e.type === 'sell' || e.type === 'exchange') A.sfx('coin');
      else if (e.type === 'museumCash') { A.sfx('coin'); R.floatText(S.hub.x, -0.6, S.hub.z, '+🪙 ' + fmt(e.coins), '#ffd23f'); R.coinBurst(); toast('🏛 Your visitors paid <b style="color:var(--gold)">🪙 ' + fmt(e.coins) + '</b>!', 2600); save(); }
      else if (e.type === 'banked') {
        var msg = [];
        if (e.coins > 0) msg.push('Sold your finds for <b style="color:var(--gold)">🪙 ' + fmt(e.coins) + '</b>');
        var got = e.mats.map(function (n, t) { return n > 0 ? '<span class="chip">' + dot(t) + '+' + fmt(n) + ' ' + D.MATS[t].name + '</span>' : ''; }).join('');
        if (got) msg.push('Mined ' + got);
        if (e.pieces.length) msg.push('🦴 Carry your new bone' + (e.pieces.length > 1 ? 's' : '') + ' to the 🏛 museum!');
        if (msg.length) { toast(msg.join('<br>'), 3500); A.sfx('coin'); }
        if (e.relic !== null) {
          var nx = e.relic + 1;
          setTimeout(function () { A.sfx('relic'); toast(nx < 5 ? '🌍 <b>' + D.WORLDS[nx].name + '</b> unlocked! Walk to the 🗺️ Worlds signpost to travel.' : '🏆 You found all five relics! You are a Master Digger!', 5000); }, 600);
        }
        lastPanelKey = ''; save();
      }
    });
  }

  // ---------- the chest puzzle ----------
  // Shown while the logic holds a puzzle open (run.lock). Pins: one column per pin, the key's tooth over the pin to tap.
  // Pairs: a grid of face-down cards. Simon: four gems that light up in turn, then wait for the player.
  var lockKey = '', simonStep = -1, padFlash = { k: -1, t: 0 };
  var PAIR_ICONS = ['💎', '🦴', '🪙', '⭐', '🍄', '🐚', '🌙', '👾'], PAD_ICONS = ['❤️', '💙', '💚', '💛'];
  var LOCK_TEXT = {
    pins: ['🔒 A locked chest!'],
    pairs: ['🃏 A memory chest!', 'Flip two cards at a time and find every matching pair.'],
    simon: ['🎵 A singing chest!', 'Watch the gems light up…', 'Your turn: tap the gems in the same order.']
  };
  function renderLock() {
    var L = S.mode === 'dig' && S.run && S.run.lock, el = $('lock');
    el.classList.toggle('show', !!L);
    if (!L) { lockKey = ''; simonStep = -1; if (smashT) smashStop(); return; }
    var kind = L.kind || 'pins', T0 = LOCK_TEXT[kind], html = '', key, hint;
    if (kind === 'simon') {
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
        html += '<button class="card' + (up ? ' up' : '') + (L.done[j] ? ' done' : '') + (L.wait > 0 && L.up.indexOf(j) >= 0 ? ' miss' : '') + '" data-k="' + j + '">' + (up ? PAIR_ICONS[c] : '') + '</button>';
      });
      html += '</div>';
    } else {
      key = 'k|' + L.i + '|' + L.pins.join() + '|' + L.key.join();
      if (key === lockKey) return;
      hint = L.link === 2 ? 'Match the golden key. Tricky: each pin moves its neighbours on both sides too!' : 'Match the golden key. Careful: each pin pushes the one to its right!';
      var h = function (v) { return Math.round((v + 1) / D.LOCK_LEVELS * 100) + '%'; };
      html = '<div class="pinrow">';
      for (var k = 0; k < L.pins.length; k++) {
        if (k && L.link) html += '<span class="link">' + (L.link === 2 ? '⇄' : '➜') + '</span>';
        html += '<div class="col"><div class="tooth"><i style="height:' + h(L.key[k]) + '"></i></div>' +
          '<button class="pin' + (L.pins[k] === L.key[k] ? ' ok' : '') + '" data-k="' + k + '" aria-label="Pin ' + (k + 1) + '"><i style="height:' + h(L.pins[k]) + '"></i></button></div>';
      }
      html += '</div>';
    }
    lockKey = key;
    $('lockTitle').textContent = T0[0]; $('lockHint').textContent = hint;
    $('lockBoard').innerHTML = html;
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
  // A tap on the pit: on a block of the layer being cleared it walks there and digs it; elsewhere it digs faster.
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
      if (D.digAt(S, c[0], c[1])) A.sfx('step'); else doTap();
    }
    else doTap();
    if (stickId !== null || splash) return; // a second finger only taps
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    var d0 = down;
    setTimeout(function () { if (down === d0 && stickId === null) stickStart({ pointerId: d0.id, clientX: d0.x, clientY: d0.y }); }, HOLD * 1000);
  });
  cv.addEventListener('pointermove', function (e) {
    if (!down || down.id !== e.pointerId) return;
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
  // auto-mining on or off
  function setAutoBtn() { var b = $('bAuto'), on = S.auto !== false; b.classList.toggle('on', on); b.textContent = on ? '🤖 Auto' : '✋ Me'; }
  $('bAuto').onclick = function () { audio(); D.setAuto(S, S.auto === false); setAutoBtn(); save(); };
  $('bHome').onclick = function () { audio(); if (S.mode === 'surface') D.startDig(S, S.world); else D.goHome(S); };
  var KEYS = { arrowup: 'up', w: 'up', arrowright: 'right', d: 'right', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left' };
  window.addEventListener('keydown', function (e) {
    if (splash) { startGame(); return; }
    if (e.target.tagName === 'INPUT') return; // typing in the reset box
    var k = e.key.toLowerCase();
    if (S.mode === 'dig' && S.run.lock && k >= '1' && k <= '9') { D.lockTap(S, +k - 1); e.preventDefault(); return; } // number keys tap pins
    if (KEYS[k]) { if (!e.repeat) { delete held[k]; press(k, KEYS[k]); steer(GRID[KEYS[k]]); } e.preventDefault(); }
    else if (k === 'q' || k === 'tab') { $('bAuto').onclick(); e.preventDefault(); }
    else if (k === ' ') { if (!e.repeat) doTap(); e.preventDefault(); }
    else if (k === 'h') D.goHome(S);
    else if (k === 'enter' && S.mode === 'surface') { audio(); D.startDig(S, S.world); }
    else if (k === 'm') setMute(!A.isMuted());
    else if (k === 'escape') toggleMenu();
  });

  window.addEventListener('keyup', function (e) { delete held[e.key.toLowerCase()]; });
  window.addEventListener('blur', function () { held = {}; stickRelease(); });
  var splash = true;
  function startGame(gesture) { if (!splash) return; splash = false; $('splash').style.display = 'none'; if (gesture !== false) audio(); }
  $('splash').addEventListener('pointerdown', startGame);
  if (params.get('nosplash') === '1') startGame(false); // no user gesture yet, so no audio until the first tap

  // ---------- main loop ----------
  function advance(dt, noDraw) {
    if (S.mode === 'surface') D.hubInput(S, heldDirs());
    else if (S.mode === 'dig' && S.run.steer === 0) { var hd = heldGrid(); if (hd) D.steer(S, hd); } // held: keep stepping
    var left = dt; while (left > 0) { var h = Math.min(0.05, left); D.step(S, h); left -= h; }
    drain(); R.update(dt, S);
    if (!noDraw) { R.draw(S); updateHud(); renderPanel(); renderLock(); }
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
