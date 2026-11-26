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
    { id: 'teach', base: 'teach', past: 'taught', wrong: ['teached', 'teach'], text: 'Nova ___ me.', grade: 2 },
    { id: 't-walk', grade: 1, skill: 'tense', who: 1, text: 'Yesterday Hale ___ to the park.', opts: ['walked', 'walks', 'will walk'], why: ['', 'Yesterday is over.', 'Will is for later.'], tip: 'Yesterday tells us it already happened.' }
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
  grammar: [
    { id: 'she', who: 1, grade: 1, skill: 'pronoun', text: 'Hale has a hat. ___ hat is red.', opts: ['Her', 'Him', 'They'], why: ['', 'Hale is a girl.', 'Hale is one person.'], tip: 'Use her for a girl.' },
    { id: 'under', who: 0, grade: 1, skill: 'prep', text: 'The bat hides ___ the bed.', ask: 'Which word fits?', opts: ['under', 'at', 'is'], why: ['', 'No.', 'No.'] },
    { id: 'neg', who: 4, grade: 2, skill: 'neg', text: 'Nova does ___ like loud noise.', opts: ['not', 'is', 'are'], why: ['', 'No.', 'No.'] }
  ],
  feel: [
    { id: 'lost', who: 1, grade: 1, skill: 'emotion', text: 'Hale lost her toy.', ask: 'How might Hale feel?', opts: ['sad', 'happy', 'sleepy'], why: ['', 'Losing a toy is not happy.', 'Nothing said sleepy.'] },
    { id: 'crayon', who: 0, grade: 1, skill: 'size', text: 'A crayon broke.', ask: 'Big problem or small problem?', opts: ['small problem', 'big problem', 'medium problem'], why: ['', 'A crayon is small.', 'It can be fixed fast.'], show: ['small problem', 'medium problem', 'big problem'] },
    { id: 'proud', who: 3, grade: 2, skill: 'emotion', text: 'Wren finished a hard puzzle.', ask: 'How might Wren feel?', opts: ['proud', 'lonely', 'jealous'], why: ['', 'No.', 'No.'] }
  ],
  wh: [
    { id: 'who', who: 0, grade: 1, skill: 'who', text: 'Baron digs a hole. Hale watches.', ask: 'Who digs?', opts: ['Baron', 'Hale', 'Jon'], why: ['', 'Hale watches.', 'Jon is not there.'] },
    { id: 'where', who: 2, grade: 1, skill: 'where', text: 'Jon swims in the sea.', ask: 'Where does Jon swim?', opts: ['in the sea', 'in the bed', 'on the moon'], why: ['', 'No.', 'No.'] }
  ],
  seq: [
    { id: 'first', who: 4, grade: 1, skill: 'first', text: 'First Nova puts on a helmet. Then she walks. Last she waves.', ask: 'What happens first?', opts: ['Nova puts on a helmet.', 'Nova waves.', 'Nova walks.'], why: ['', 'Waving is last.', 'Walking is next.'] },
    { id: 'wash', who: 1, grade: 1, skill: 'steps', text: 'Wash your hands. Wet them, then soap.', ask: 'What comes after soap?', opts: ['Rub and rinse.', 'Dry first.', 'Leave.'], why: ['', 'No.', 'No.'] }
  ],
  vocab: [
    { id: 'group', who: 3, grade: 1, skill: 'category', text: 'cat, dog, fish', ask: 'What is the group?', opts: ['animals', 'foods', 'tools'], why: ['', 'No.', 'No.'] },
    { id: 'opp', who: 0, grade: 1, skill: 'opposite', text: 'The opposite of hot is...', ask: 'Which word?', opts: ['cold', 'warm', 'hat'], why: ['', 'No.', 'No.'] },
    { id: 'bat', who: 5, grade: 2, skill: 'multi', text: 'A bat flies. A bat hits a ball.', ask: 'Which is true?', opts: ['Bat has two meanings.', 'Bat has one meaning.', 'Bat is a shoe.'], why: ['', 'No.', 'No.'] }
  ],
  mathWords: [
    { id: 'bats', grade: 1, op: '+', text: '{a} bats fly into the pit. Then {b} more bats fly in.', ask: 'How many bats are there now?' },
    { id: 'gems', grade: 1, op: '+', min: 2, text: '{a} gems are in one chest. {b} gems are in another.', ask: 'How many gems are there?' },
    { id: 'coins', grade: 1, op: '-', text: 'Nim has {a} coins. He spends {b} coins.', ask: 'How many coins are left?' }
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
const SUBJ = ['verb', 'plural', 'grammar', 'talk', 'feel', 'read', 'wh', 'seq', 'vocab', 'math'];
const onlySubj = k => Object.fromEntries(SUBJ.map(x => [x, x === k]));
function atChest(subj, seed = 3) {
  const s = D.newState(seed); D.startDig(s, 0); run(s, 3); D._teleport(s, 3, 10, 3);
  if (subj) D.learnSet(s, { subj: onlySubj(subj) });
  D._lockKind('learn'); D._setTile(s, 4, 10, 3, T.CHEST); D.steer(s, 'e'); run(s, 2); D._lockKind(null);
  return s;
}
const answer = L => L.q.opts.indexOf(L.q.answer);
const wrong = L => L.q.opts.findIndex(o => o !== L.q.answer);

test('a new game has learning chests on, first grade, every subject', () => {
  const s = D.newState(1);
  assert.equal(s.learn.grade, 1);
  assert.ok(s.learn.mix > 0);
  assert.deepEqual(Object.keys(s.learn.subj).sort(), [...SUBJ].sort());
  assert.deepEqual([...D.LEARN_SUBJ], SUBJ);
  assert.ok(Object.values(s.learn.subj).every(Boolean));
  assert.deepEqual(JSON.parse(JSON.stringify(s.learn.focus)), { verb: true, talk: true, read: true });
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

const nums = id => id.match(/\d+/g).map(Number);
test('every math question is well formed: the answer among three different options, within the grade', () => {
  const kinds = {};
  for (const g of [1, 2]) {
    const s = D.newState(11); D.learnSet(s, { grade: g });
    for (let n = 0; n < 600; n++) {
      const q = D._learnPick(s, 'math', []), f = q.id.slice(5);
      kinds[q.skill + g] = (kinds[q.skill + g] || 0) + 1;
      assert.match(q.id, /^math:/); assert.ok(D._mathFits(f, g), q.id);
      assert.equal(String(D._mathEval(f)), q.answer);
      assert.equal(q.opts.length, 3, q.id); assert.equal(new Set(q.opts).size, 3, q.id); assert.ok(q.opts.includes(q.answer), q.id);
      assert.ok(q.text && q.tip, q.id);
      if (q.skill === 'math') { q.opts.forEach(o => assert.ok(+o >= 0)); assert.ok(Math.max(...nums(f), +q.answer) <= (g === 1 ? 20 : 100), q.id); }
      else if (q.skill === 'time') {
        assert.match(f, /^k:\d+:\d\d$/); assert.deepEqual([...q.clock], nums(f));
        q.opts.forEach(o => { assert.match(o, /^(1[0-2]|[1-9]):[0-5]\d$/); if (g === 1) assert.match(o, /:(00|30)$/, q.id); });
        assert.ok(q.clock[1] % 5 === 0); if (g === 1) assert.ok([0, 30].includes(q.clock[1]));
      } else if (q.skill === 'place') {
        q.opts.forEach(o => assert.ok(+o >= 0 && +o <= (g === 1 ? 99 : 999), q.id));
        if (f[0] === 'c') {
          assert.deepEqual([...q.opts].sort(), nums(f).map(String).sort()); assert.equal(+q.answer, Math.max(...nums(f)));
          assert.equal(new Set(nums(f)).size, 3);
          if (g === 1) nums(f).forEach(x => assert.ok(x >= 10 && x <= 99)); 
        } else if (f[0] === 'h') assert.equal(g, 2);
      } else {
        assert.equal(q.skill, 'story'); assert.ok(q.ask && !/[{}]/.test(q.text), q.id);
        const [a, b] = nums(f.split(':')[2]);
        if (f.startsWith('w:gems:')) assert.ok(a >= 2 && b >= 2, f); assert.ok(a >= 0 && b >= 0 && +q.answer >= 0);
        assert.ok(Math.max(a, b, +q.answer) <= (g === 1 ? 20 : 100));
      }
    }
  }
  assert.ok(kinds.math1 > 200 && kinds.math1 < 400, 'about half arithmetic: ' + kinds.math1);
  for (const k of ['place', 'time', 'story']) for (const g of [1, 2]) assert.ok(kinds[k + g] > 30, k + g);
  assert.ok(kinds.place2 > 0);
});

test('place value and compare questions: tips and numbers', () => {
  const s = D.newState(2);
  let q = D._mathQ(s, 't:4,7');
  assert.equal(q.answer, '47'); assert.equal(q.text, '4 tens and 7 ones = ?'); assert.equal(q.tip, '4 tens is 40. 40 and 7 more is 47.');
  q = D._mathQ(s, 'h:3,4,7'); assert.equal(q.answer, '347'); assert.match(q.text, /3 hundreds/);
  q = D._mathQ(s, 'c:47,74,44'); assert.equal(q.answer, '74'); assert.deepEqual([...q.opts].sort(), ['44', '47', '74']); assert.match(q.tip, /tens first/);
  q = D._mathQ(s, 'k:3:30'); assert.equal(q.answer, '3:30'); assert.deepEqual([...q.clock], [3, 30]); assert.match(q.tip, /half past/);
  q = D._mathQ(s, 'k:3:00'); assert.equal(q.answer, '3:00');
  q = D._mathQ(s, 'w:bats:4,3'); assert.equal(q.answer, '7'); assert.equal(q.text, '4 bats fly into the pit. Then 3 more bats fly in.'); assert.equal(q.ask, 'How many bats are there now?');
  q = D._mathQ(s, 'w:coins:9,4'); assert.equal(q.answer, '5');
  assert.equal(D._mathEval('k:3:30'), '3:30');
  assert.ok(!D._mathFits('w:gems:1,4', 1) && D._mathFits('w:gems:2,4', 1), 'min is respected');
  assert.ok(!D._mathFits('w:nope:1,1', 1), 'an unknown template is dropped');
  assert.ok(!D._mathFits('h:3,4,7', 1)); assert.ok(D._mathFits('h:3,4,7', 2));
  assert.ok(!D._mathFits('k:3:15', 1)); assert.ok(D._mathFits('k:3:15', 2));
  const ten = D.newState(3); for (let n = 0; n < 40; n++) { const m = D._mathQ(ten, 'k:3:15'); assert.equal(m.opts.length, 3); assert.ok(m.opts.includes('3:15')); }
});

test('without word problems the story kind is never asked', () => {
  const D0 = load({ verbs: FIX.verbs }), s = D0.newState(1);
  for (let n = 0; n < 300; n++) assert.notEqual(D0._learnPick(s, 'math', []).skill, 'story');
});

test('missed math questions of every kind come back in review and show in the grown-ups list as words', () => {
  const ids = ['7+5', 't:4,7', 'c:47,74,44', 'k:3:30', 'w:bats:4,3', 'w:coins:9,4'];
  ids.forEach(f => {
    const s = D.newState(12); s.learn.items['math:' + f] = { b: 0, r: 0, m: 2 };
    let n = 0; for (let k = 0; k < 100; k++) if (D._learnPick(s, 'math', []).id === 'math:' + f) n++;
    assert.ok(n > 20, f + ' picked ' + n);
    const tr = D.learnTricky(s).find(t => t.id === 'math:' + f);
    assert.ok(tr && tr.text.length > 3 && !/undefined|NaN|\{/.test(tr.text), f + ': ' + (tr && tr.text));
  });
  const s = D.newState(12); s.learn.items['math:h:3,4,7'] = { b: 0, r: 0, m: 2 };
  for (let k = 0; k < 100; k++) assert.notEqual(D._learnPick(s, 'math', []).id, 'math:h:3,4,7', 'a hundreds item is not asked in first grade');
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
  const s = D.newState(3); D.learnSet(s, { subj: onlySubj('math') });
  for (let n = 0; n < 20; n++) assert.equal(D._learnSubject(s), 'math');
  D.learnSet(s, { subj: { math: false } });
  assert.equal(D._learnSubject(s), null);
});

for (const subj of ['grammar', 'feel', 'wh', 'seq', 'vocab']) {
  test('a ' + subj + ' chest opens, shows its words, tells why after a miss and solves', () => {
    const s = atChest(subj), L = s.run.lock;
    assert.equal(L.kind, 'learn'); assert.equal(L.subj, subj); assert.equal(L.rounds, D.LEARN_ROUNDS[subj]);
    const item = FIX[subj].find(r => subj + ':' + r.id === L.q.id);
    assert.ok(item && item.grade === 1);
    assert.equal(L.q.answer, item.opts[0]); assert.equal(L.q.opts.length, 3); assert.equal(L.q.text, item.text);
    assert.equal(L.q.ask, item.ask || ''); assert.equal(L.q.tip, item.tip || ''); assert.equal(L.q.skill, item.skill);
    const bad = wrong(L); D.lockTap(s, bad);
    assert.equal(L.q.why[bad], item.why[item.opts.indexOf(L.q.opts[bad])]);
    run(s, 2);
    for (let k = 0; k < L.rounds; k++) D.lockTap(s, answer(s.run.lock));
    assert.equal(s.run.lock, null);
    const st = D.learnStats(s); assert.equal(st[subj].r + st[subj].m, L.rounds); assert.equal(st[subj].m, 1);
    assert.ok(D.learnTricky(s).some(t => t.subj === subj && t.text));
  });
}

test('a grammar blank shows the right word in the grown-ups list', () => {
  const s = D.newState(1); s.learn.items['grammar:she'] = { b: 0, r: 0, m: 1 };
  assert.equal(D.learnTricky(s)[0].text, 'Hale has a hat. Her hat is red.');
});

test('focus subjects are asked more often; verb, talk and read (the IEP goals) by default; a grown-up can change it', () => {
  const s = D.newState(31), tally = () => { const c = {}; for (let n = 0; n < 4000; n++) { const k = D._learnSubject(s); c[k] = (c[k] || 0) + 1; s.learn.last = k; } return c; };
  let c = tally();
  assert.ok(D.LEARN_FOCUS > 1);
  assert.ok(c.verb > c.plural * 1.8 && c.talk > c.feel * 1.8 && c.read > c.wh * 1.8, JSON.stringify(c));
  D.learnSet(s, { focus: { verb: false, talk: false, read: false, feel: true } });
  assert.deepEqual(JSON.parse(JSON.stringify(s.learn.focus)), { verb: false, talk: false, read: false, feel: true });
  c = tally(); assert.ok(c.feel > c.verb * 1.8, JSON.stringify(c));
  D.learnSet(s, { focus: { bogus: true } }); assert.equal('bogus' in s.learn.focus, false);
  const t = D.deserialize(D.serialize(s)); assert.deepEqual(JSON.parse(JSON.stringify(t.learn.focus)), { verb: false, talk: false, read: false, feel: true });
});

test('an old save with five subjects gets the new ones on, keeps what was off, and the default focus', () => {
  const o = JSON.parse(D.serialize(D.newState(4)));
  o.learn.subj = { verb: true, plural: false, talk: true, read: true, math: false }; delete o.learn.focus;
  const u = D.deserialize(JSON.stringify(o));
  assert.equal(u.learn.subj.plural, false); assert.equal(u.learn.subj.math, false);
  ['grammar', 'feel', 'wh', 'seq', 'vocab'].forEach(k => assert.equal(u.learn.subj[k], true, k));
  assert.deepEqual(JSON.parse(JSON.stringify(u.learn.focus)), { verb: true, talk: true, read: true });
  o.learn.focus = { read: true, bogus: true, verb: 'x' }; const w = D.deserialize(JSON.stringify(o));
  assert.deepEqual(JSON.parse(JSON.stringify(w.learn.focus)), { read: true, verb: true });
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
  for (const g of [1, 2]) for (const subj of SUBJ) {
    const s = R.newState(g); R.learnSet(s, { grade: g });
    for (let n = 0; n < 60; n++) {
      const q = R._learnPick(s, subj, []);
      if (!q) { assert.ok(!L[{ verb: 'verbs', plural: 'plurals' }[subj] || subj], 'a subject with words deals questions: ' + subj); break; }
      assert.ok(q.text && q.opts.length >= 3 && q.opts.includes(q.answer), subj + ' ' + (q && q.id));
      assert.equal(new Set(q.opts).size, q.opts.length, q.id);
      if (subj === 'grammar') assert.ok(q.text.includes('___'), q.id);
    }
  }
  // every list that is present is checked generically; lists not written yet are skipped
  const FRIENDS = 6;
  const vids = L.verbs.map(v => v.id); assert.equal(new Set(vids).size, vids.length, 'unique verb ids');
  for (const subj of ['talk', 'read', 'grammar', 'feel', 'wh', 'seq', 'vocab', 'tense']) {
    const list = subj === 'tense' ? L.verbs.filter(v => v.opts) : L[subj]; if (!list || (subj === 'tense' && !list.length)) continue;
    assert.ok(Array.isArray(list) && list.length > 0, subj);
    const ids = new Set();
    list.forEach(it => {
      const w = subj + ':' + it.id;
      assert.ok(it.id && !ids.has(it.id), 'unique id ' + w); ids.add(it.id);
      assert.ok(it.grade === 1 || it.grade === 2, 'grade ' + w);
      assert.ok(it.text && typeof it.text === 'string', 'text ' + w);
      assert.ok(subj === 'grammar' || subj === 'tense' || it.ask, 'ask ' + w);
      assert.ok(Array.isArray(it.opts) && it.opts.length === 3 && new Set(it.opts).size === 3 && it.opts.every(o => typeof o === 'string' && o), 'three different opts ' + w);
      if (it.why) { assert.equal(it.why.length, 3, 'why ' + w); assert.equal(it.why[0], '', 'why[0] ' + w); }
      if (it.show) assert.deepEqual([...it.show].sort(), [...it.opts].sort(), 'show ' + w);
      assert.ok(it.who == null || (Number.isInteger(it.who) && it.who >= -1 && it.who < FRIENDS), 'who ' + w);
      assert.ok(L.skillNames[it.skill], 'named skill ' + it.skill + ' in ' + w);
      if (subj === 'grammar' || subj === 'tense') assert.equal(it.text.split('___').length, 2, 'one blank ' + w);
    });
  }
  (L.mathWords || []).forEach(m => {
    assert.ok(m.id && (m.grade === 1 || m.grade === 2) && (m.op === '+' || m.op === '-') && m.ask, 'math word ' + m.id);
    assert.ok(m.text.includes('{a}') && m.text.includes('{b}'), 'braces ' + m.id);
    assert.ok(m.min == null || m.min >= 1, 'min ' + m.id);
  });
  assert.ok(L.stories.length >= 8);
});

test('an item with a show order keeps its answers in that order, with the why lines following them', () => {
  for (let seed = 1; seed < 12; seed++) {
    const s = D.newState(seed); D.learnSet(s, { grade: 1 });
    const q = D._learnPick(s, 'feel', ['feel:lost']);
    assert.equal(q.id, 'feel:crayon');
    assert.deepEqual([...q.opts], ['small problem', 'medium problem', 'big problem']);
    assert.equal(q.answer, 'small problem');
    assert.equal(q.why[1], 'It can be fixed fast.'); assert.equal(q.why[2], 'A crayon is small.');
  }
});

test('a verb item with its own choices is asked as a tense question, with its skill, why and tip', () => {
  const s = D.newState(4); D.learnSet(s, { grade: 1 });
  const used = ['verb:go', 'verb:dig', 'verb:see', 'verb:find'];
  const q = D._learnPick(s, 'verb', used);
  assert.equal(q.id, 'verb:t-walk');
  assert.equal(q.skill, 'tense'); assert.equal(q.answer, 'walked');
  assert.deepEqual([...q.opts].sort(), ['walked', 'walks', 'will walk']);
  assert.equal(q.why[q.opts.indexOf('will walk')], 'Will is for later.');
  assert.equal(q.tip, 'Yesterday tells us it already happened.');
  s.learn.items['verb:t-walk'] = { b: 0, r: 0, m: 1 };
  const t = D.learnTricky(s).find(x => x.id === 'verb:t-walk');
  assert.equal(t.text, 'Yesterday Hale walked to the park.');
});
