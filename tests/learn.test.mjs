// Tests for the learning chests and stories in js/logic.js: irregular verbs and plurals, talking choices, math facts,
// the spaced review of missed items, the grown-up settings, own stories, and saving them. The lesson words come from
// js/lessons.js in the game; here a small fixture stands in, and one test loads the real file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const FIX = {
  verbs: [
    { id: 'go', base: 'go', past: 'went', wrong: ['goed', 'goes'], text: 'Yesterday Baron ___ home.', grade: 1 },
    { id: 'dig', base: 'dig', past: 'dug', wrong: ['digged', 'dig'], text: 'Nim ___ a hole.', grade: 1 },
    { id: 'see', base: 'see', past: 'saw', wrong: ['seed', 'see'], text: 'I ___ a bat.', grade: 1 },
    { id: 'find', base: 'find', past: 'found', wrong: ['finded', 'find'], text: 'Hale ___ a bone.', grade: 1 },
    { id: 'teach', base: 'teach', past: 'taught', wrong: ['teached', 'teach'], text: 'Nova ___ me.', grade: 2 }
  ],
  plurals: [
    { id: 'tooth', one: 'tooth', many: 'teeth', wrong: ['tooths', 'teeths'], text: 'Sharp ___.', grade: 1 },
    { id: 'foot', one: 'foot', many: 'feet', wrong: ['foots', 'feets'], text: 'Big ___.', grade: 1 },
    { id: 'mouse', one: 'mouse', many: 'mice', wrong: ['mouses', 'mices'], text: 'Two ___.', grade: 1 }
  ],
  talk: [
    { id: 'drawing', who: 1, grade: 1, skill: 'compliment', text: 'Hale shows a drawing.', ask: 'What could Nim say?', opts: ['I like it!', 'Boring.', 'Dig now.'], why: ['', 'Sad.', 'Topic.'] },
    { id: 'hi', who: 0, grade: 1, skill: 'greeting', text: 'Baron says hi.', ask: 'What could Nim say?', opts: ['Hi Baron!', '...', 'Go away.'], why: ['', 'Quiet.', 'Rude.'] },
    { id: 'rain', who: 3, grade: 2, skill: 'idiom', text: 'Raining cats and dogs.', ask: 'What does Wren mean?', opts: ['Lots of rain.', 'Pets fall.', 'Sunny.'], why: ['', 'Not really pets.', 'No.'] }
  ],
  read: [
    { id: 'plates', who: 2, grade: 1, skill: 'predict', text: 'Jon carries plates. He does not see the bucket.', ask: 'What will happen next?', opts: ['Jon trips.', 'Jon flies.', 'It snows.'], why: ['', 'Jon cannot fly.', 'Nothing said snow.'] },
    { id: 'rain', who: 1, grade: 1, skill: 'predict', text: 'Dark clouds. Hale has no coat.', ask: 'What will happen next?', opts: ['Hale gets wet.', 'Hale swims.', 'Hale sleeps.'], why: ['', 'No.', 'No.'] }
  ],
  stories: [{ id: 'lose', who: 0, title: 'When I lose a game', pages: ['Sometimes I lose.', 'That is okay.'] }],
  skillNames: { verb: 'Irregular past tense', plural: 'Irregular plurals', math: 'Math facts', compliment: 'Compliments', greeting: 'Greetings', idiom: 'Idioms' }
};

function load(lessons) {
  const ctx = {};
  vm.createContext(ctx);
  if (lessons) ctx.DTWLessons = lessons;
  vm.runInContext(readFileSync(new URL('../js/logic.js', import.meta.url), 'utf8'), ctx, { filename: 'js/logic.js' });
  return ctx.DTW;
}
const D = load(FIX), T = D.TILE;
const run = (s, secs) => { for (let t = 0; t < secs; t += 0.05) D.step(s, 0.05); };
function atChest(subj, seed = 3) {
  const s = D.newState(seed); D.startDig(s, 0); run(s, 3); D._teleport(s, 3, 10, 3);
  if (subj) D.learnSet(s, { subj: { verb: subj === 'verb', plural: subj === 'plural', talk: subj === 'talk', math: subj === 'math', read: subj === 'read' } });
  D._lockKind('learn'); D._setTile(s, 4, 10, 3, T.CHEST); D.steer(s, 'e'); run(s, 2); D._lockKind(null);
  return s;
}
const answer = L => L.q.opts.indexOf(L.q.answer);
const wrong = L => L.q.opts.findIndex(o => o !== L.q.answer);

test('a new game has learning chests on, first grade, every subject', () => {
  const s = D.newState(1);
  assert.equal(s.learn.grade, 1);
  assert.ok(s.learn.mix > 0);
  assert.deepEqual(Object.keys(s.learn.subj).sort(), ['math', 'plural', 'read', 'talk', 'verb']);
  assert.ok(Object.values(s.learn.subj).every(Boolean));
});

test('a verb chest asks for the past form among the over-regular and base forms, three rounds', () => {
  const s = atChest('verb'), L = s.run.lock;
  assert.equal(L.kind, 'learn'); assert.equal(L.subj, 'verb'); assert.equal(L.rounds, 3);
  const item = FIX.verbs.find(v => 'verb:' + v.id === L.q.id);
  assert.ok(item, 'a first-grade verb from the lessons');
  assert.equal(item.grade, 1);
  assert.equal(L.q.answer, item.past);
  assert.deepEqual([...L.q.opts].sort(), [item.past, ...item.wrong].sort());
  assert.equal(L.q.text, item.text);
  assert.match(L.q.tip, new RegExp(item.base + '.*' + item.past));
});

test('a miss shows the tip, waits, takes the wrong card out, and keeps the same question', () => {
  const s = atChest('verb'), L = s.run.lock, id = L.q.id, bad = wrong(L);
  D.lockTap(s, bad);
  assert.equal(L.q.id, id); assert.equal(L.round, 0); assert.ok(L.hint); assert.ok(L.wait > 0);
  assert.equal(D.lockTap(s, answer(L)), false, 'taps wait out the pause');
  run(s, 2);
  assert.ok(L.out.includes(bad));
  assert.equal(D.lockTap(s, bad), false, 'a card taken out cannot be tapped again');
  D.lockTap(s, answer(L));
  assert.equal(L.round, 1);
  assert.notEqual(L.q.id, id, 'no repeat inside one chest');
});

test('solving every round opens the chest with its contents and a gem', () => {
  const s = atChest('plural'), L = s.run.lock;
  for (let k = 0; k < L.rounds; k++) D.lockTap(s, answer(s.run.lock));
  assert.equal(s.run.lock, null);
  run(s, 3);
  assert.ok(s.run.bag.concat(s.carry, s.run.loot.map(l => l.item)).some(it => it.gem), 'the bonus gem');
});

test('results are counted per subject and talk skill; a miss puts the item back to the start of the review', () => {
  const s = atChest('talk'), L = s.run.lock;
  assert.equal(L.rounds, 2);
  const first = L.q, skill = first.skill;
  assert.ok(first.who >= 0 && first.ask && first.why.length === first.opts.length);
  D.lockTap(s, wrong(L)); run(s, 2); D.lockTap(s, answer(L));
  const second = s.run.lock.q; D.lockTap(s, answer(s.run.lock));
  assert.equal(s.learn.items[first.id].b, 0); assert.equal(s.learn.items[first.id].m, 1);
  assert.equal(s.learn.items[second.id].b, 1); assert.equal(s.learn.items[second.id].r, 1);
  const st = D.learnStats(s);
  assert.ok(st.talk.r + st.talk.m === 2 && st.talk.m === 1);
  assert.ok(st[skill].m >= 1);
  assert.ok(D.learnTricky(s).some(t => t.id === first.id && t.text));
});

test('a what-happens-next chest reads like a talking one: a scene, the question, and why after a miss', () => {
  const s = atChest('read'), L = s.run.lock;
  assert.equal(L.subj, 'read'); assert.equal(L.rounds, 2);
  assert.equal(L.q.ask, 'What will happen next?'); assert.equal(L.q.skill, 'predict');
  const item = FIX.read.find(r => 'read:' + r.id === L.q.id);
  assert.equal(L.q.answer, item.opts[0]);
  const bad = wrong(L); D.lockTap(s, bad);
  assert.equal(L.q.why[bad], item.why[item.opts.indexOf(L.q.opts[bad])]);
  run(s, 2); D.lockTap(s, answer(L)); D.lockTap(s, answer(s.run.lock));
  assert.equal(s.run.lock, null);
  const st = D.learnStats(s); assert.equal(st.read.r + st.read.m, 2); assert.equal(st.predict.m, 1);
});

test('missed items come back more often than ones answered right', () => {
  const s = D.newState(5);
  s.learn.items['verb:go'] = { b: 0, r: 0, m: 3 };
  ['dig', 'see', 'find'].forEach(id => { s.learn.items['verb:' + id] = { b: 4, r: 5, m: 0 }; });
  let go = 0;
  for (let n = 0; n < 200; n++) if (D._learnPick(s, 'verb', []).id === 'verb:go') go++;
  assert.ok(go > 100, 'the missed verb is picked most: ' + go);
});

test('first grade gets first-grade items only; second grade gets both', () => {
  const s = D.newState(7);
  for (let n = 0; n < 100; n++) assert.notEqual(D._learnPick(s, 'verb', []).id, 'verb:teach');
  D.learnSet(s, { grade: 2 });
  let teach = 0; for (let n = 0; n < 100; n++) if (D._learnPick(s, 'verb', []).id === 'verb:teach') teach++;
  assert.ok(teach > 0);
  for (let n = 0; n < 50; n++) assert.notEqual(D._learnPick(D.newState(n), 'talk', []).id, 'talk:rain');
});

test('math facts fit the grade: sums within 20 in first grade, within 100 in second; three different options', () => {
  for (const g of [1, 2]) {
    const s = D.newState(11); D.learnSet(s, { grade: g });
    for (let n = 0; n < 300; n++) {
      const q = D._learnPick(s, 'math', []);
      assert.match(q.id, /^math:/);
      const v = D._mathEval(q.id.slice(5));
      assert.equal(String(v), q.answer);
      assert.equal(new Set(q.opts).size, q.opts.length); assert.ok(q.opts.includes(q.answer));
      q.opts.forEach(o => assert.ok(+o >= 0));
      const nums = q.id.slice(5).match(/\d+/g).map(Number);
      assert.ok(Math.max(...nums, v) <= (g === 1 ? 20 : 100), q.id);
    }
  }
});

test('a missed math fact can come back', () => {
  const s = D.newState(12); s.learn.items['math:7+5'] = { b: 0, r: 0, m: 2 };
  let n = 0; for (let k = 0; k < 100; k++) if (D._learnPick(s, 'math', []).id === 'math:7+5') n++;
  assert.ok(n > 20, 'missed fact picked ' + n);
  assert.equal(D._mathEval('7+?=10'), 3);
  assert.equal(D._mathEval('45-12'), 33);
});

test('chests mix learning and other puzzles by the setting, and none when it is off', () => {
  const count = mix => {
    const s = D.newState(21); D.learnSet(s, { mix }); D.startDig(s, 0); run(s, 3);
    let learn = 0;
    for (let k = 0; k < 40; k++) {
      D._teleport(s, 3, 10, 3); D._setTile(s, 4, 10, 3, T.CHEST); D.steer(s, 'e'); run(s, 2);
      if (s.run.lock.kind === 'learn') learn++;
      D.lockSmash(s); run(s, 0.5);
    }
    return learn;
  };
  assert.equal(count(0), 0);
  const some = count(1), most = count(3);
  assert.ok(some > 3 && some < 25, 'some ' + some);
  assert.ok(most > some, 'most ' + most);
});

test('subjects switched off are never asked; with all off the chests are normal puzzles', () => {
  const s = D.newState(3); D.learnSet(s, { subj: { verb: false, plural: false, talk: false, read: false, math: true } });
  for (let n = 0; n < 20; n++) assert.equal(D._learnSubject(s), 'math');
  D.learnSet(s, { subj: { math: false } });
  assert.equal(D._learnSubject(s), null);
});

test('without lesson words, only math is offered', () => {
  const D0 = load(null), s = D0.newState(1);
  for (let n = 0; n < 20; n++) assert.equal(D0._learnSubject(s), 'math');
});

test('the subject changes from one learning chest to the next', () => {
  const s = D.newState(9); let last = null, same = 0;
  for (let n = 0; n < 40; n++) { const k = D._learnSubject(s); s.learn.last = k; if (k === last) same++; last = k; }
  assert.equal(same, 0);
});

test('learnSet keeps values in range', () => {
  const s = D.newState(1);
  D.learnSet(s, { grade: 9, mix: -4, subj: { verb: 0, bogus: true } });
  assert.ok([1, 2].includes(s.learn.grade)); assert.ok(s.learn.mix >= 0 && s.learn.mix < D.LEARN_MIX.length);
  assert.equal(s.learn.subj.verb, false); assert.equal('bogus' in s.learn.subj, false);
});

test('stories: the built-in ones and a grown-up\'s own, one page per line', () => {
  const s = D.newState(1);
  assert.ok(D.storyList(s).some(t => t.id === 'lose' && t.pages.length === 2));
  const st = D.addStory(s, '  Going to the dentist ', 2, 'I am going to the dentist.\n\n  The dentist counts my teeth.  \nI can hold Jon\'s hand.');
  assert.ok(st && st.own);
  assert.deepEqual([...st.pages], ['I am going to the dentist.', 'The dentist counts my teeth.', 'I can hold Jon\'s hand.']);
  assert.equal(st.title, 'Going to the dentist'); assert.equal(st.who, 2);
  assert.equal(D.addStory(s, 'Empty', 0, '   \n '), null, 'a story needs a page');
  assert.ok(D.storyList(s).some(t => t.id === st.id));
  D.storyRead(s, st.id); assert.equal(s.learn.read[st.id], 1);
  assert.ok(D.removeStory(s, st.id));
  assert.ok(!D.storyList(s).some(t => t.id === st.id));
  assert.equal(D.removeStory(s, 'lose'), false, 'built-in stories stay');
});

test('learning settings, results and own stories survive a save; a v6 save loads with the defaults', () => {
  const s = atChest('verb');
  D.learnSet(s, { grade: 2, mix: 3, subj: { talk: false } });
  D.lockTap(s, answer(s.run.lock));
  D.addStory(s, 'Fire drill', 1, 'The bell is loud.\nI walk outside.');
  const t = D.deserialize(D.serialize(s));
  assert.equal(t.learn.grade, 2); assert.equal(t.learn.mix, 3); assert.equal(t.learn.subj.talk, false);
  assert.deepEqual(JSON.parse(JSON.stringify(t.learn.items)), JSON.parse(JSON.stringify(s.learn.items)));
  assert.equal(t.learn.stories.length, 1); assert.equal(t.learn.stories[0].pages[1], 'I walk outside.');
  const o = JSON.parse(D.serialize(D.newState(4))); o.v = 6; delete o.learn;
  const u = D.deserialize(JSON.stringify(o));
  assert.ok(u); assert.equal(u.learn.grade, 1); assert.ok(u.learn.mix > 0);
  const bad = JSON.parse(D.serialize(D.newState(4))); bad.learn = { grade: 'x', items: 5, stories: [{ title: 3 }, null] };
  const b = D.deserialize(JSON.stringify(bad));
  assert.ok(b); assert.equal(b.learn.grade, 1); assert.equal(Object.keys(b.learn.items).length, 0); assert.equal(b.learn.stories.length, 0);
});

const REAL = new URL('../js/lessons.js', import.meta.url);
test('the real lesson file deals well-formed questions in every subject', { skip: !existsSync(REAL) }, () => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(readFileSync(REAL, 'utf8') + '\n;this.DTWLessons = DTWLessons;', ctx, { filename: 'js/lessons.js' });
  vm.runInContext(readFileSync(new URL('../js/logic.js', import.meta.url), 'utf8'), ctx, { filename: 'js/logic.js' });
  const R = ctx.DTW, L = ctx.DTWLessons;
  for (const g of [1, 2]) for (const subj of ['verb', 'plural', 'talk', 'read', 'math']) {
    const s = R.newState(g); R.learnSet(s, { grade: g });
    for (let n = 0; n < 60; n++) {
      const q = R._learnPick(s, subj, []);
      assert.ok(q && q.text && q.opts.length >= 3 && q.opts.includes(q.answer), subj + ' ' + (q && q.id));
      assert.equal(new Set(q.opts).size, q.opts.length, q.id);
    }
  }
  L.talk.concat(L.read || []).forEach(t => assert.ok(L.skillNames[t.skill], 'named skill ' + t.skill));
  assert.ok(L.stories.length >= 8);
});
