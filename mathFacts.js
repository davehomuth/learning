/* mathFacts.js — "Back to Basics Math" question generator.
   Pure logic: no DOM, no app globals, no question lists. Every number
   that can reach a child — operand, answer, ten-frame count, or a number
   inside a hint — stays within 0..14. Classic script to match
   learning-core.js; also require()-able for the self-test. */
(function (root) {
  'use strict';

  var MAX = 14;
  var PLUS = '+', MINUS = '\u2212', EQ = '=';   // U+2212 matches the minus used elsewhere in the app

  // ── seeded RNG (mulberry32) so a seed reproduces a session ──
  function makeRng(seed) {
    if (seed === undefined || seed === null || seed === '') return Math.random;
    var s;
    if (typeof seed === 'number') { s = seed >>> 0; }
    else {
      var str = String(seed); s = 0;
      for (var i = 0; i < str.length; i++) s = (Math.imul(s, 31) + str.charCodeAt(i)) >>> 0;
    }
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randInt(rng, min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  function num(v) { return { t: 'num', v: v }; }
  function op(v) { return { t: 'op', v: v }; }
  function blank() { return { t: 'blank' }; }

  // 1 ── doubles: n + n. 6 and 7 are the actual gap, so they come up twice as often.
  var DOUBLES_POOL = [2, 3, 4, 5, 6, 6, 7, 7];
  function genDoubles(rng) {
    var n = pick(rng, DOUBLES_POOL);
    return { section: 'doubles', parts: [num(n), op(PLUS), num(n), op(EQ), blank()], answer: n + n };
  }

  // 2 ── doubles plus one: n + (n+1), either order.
  function genDoublesPlusOne(rng) {
    var n = randInt(rng, 2, 6);
    var flip = rng() < 0.5;
    var a = flip ? n + 1 : n, b = flip ? n : n + 1;
    return {
      section: 'doubles-plus-one',
      parts: [num(a), op(PLUS), num(b), op(EQ), blank()],
      answer: n + n + 1,
      hint: n + ' + ' + n + ' = ' + (n + n) + ', then one more'
    };
  }

  // 3 ── make ten: a + __ = 10. frame tells the UI how many cells to fill.
  function genMakeTen(rng) {
    var a = randInt(rng, 1, 9);
    return {
      section: 'make-ten',
      parts: [num(a), op(PLUS), blank(), op(EQ), num(10)],
      answer: 10 - a,
      frame: a
    };
  }

  // 4 ── missing number: blank lands in the first or second slot, never always the same one.
  function genMissingNumber(rng) {
    if (rng() < 0.5) {
      var sum = randInt(rng, 5, MAX);
      var a = randInt(rng, 1, sum - 1);
      var b = sum - a;
      return rng() < 0.5
        ? { section: 'missing-number', parts: [blank(), op(PLUS), num(b), op(EQ), num(sum)], answer: a }
        : { section: 'missing-number', parts: [num(a), op(PLUS), blank(), op(EQ), num(sum)], answer: b };
    }
    var whole = randInt(rng, 6, MAX);
    var part = randInt(rng, 2, whole - 2);
    var diff = whole - part;
    return rng() < 0.5
      ? { section: 'missing-number', parts: [blank(), op(MINUS), num(part), op(EQ), num(diff)], answer: whole }
      : { section: 'missing-number', parts: [num(whole), op(MINUS), blank(), op(EQ), num(diff)], answer: part };
  }

  // 5 ── fact pair: two linked questions. buildSession keeps them adjacent.
  function genFactPair(rng) {
    var whole = randInt(rng, 6, MAX);
    var p = randInt(rng, 2, whole - 2);
    var rest = whole - p;
    var pairId = 'fp' + whole + '-' + p;
    return [
      { section: 'fact-pair', parts: [num(p), op(PLUS), blank(), op(EQ), num(whole)], answer: rest, pairId: pairId },
      { section: 'fact-pair', parts: [num(whole), op(MINUS), num(p), op(EQ), blank()], answer: rest, pairId: pairId }
    ];
  }

  // 6 ── past ten: questions that cross 10. Hints are derived, never written out.
  function genPastTen(rng) {
    if (rng() < 0.5) {
      var a = randInt(rng, 6, 9);
      var b = randInt(rng, Math.max(1, 11 - a), MAX - a);   // sum lands 11..14
      var gap = 10 - a, rest = b - gap;
      return {
        section: 'past-ten',
        parts: [num(a), op(PLUS), num(b), op(EQ), blank()],
        answer: a + b,
        hint: a + ' + ' + gap + ' = 10, then 10 + ' + rest
      };
    }
    var whole = randInt(rng, 11, MAX);
    var answer = randInt(rng, 2, 9);
    var take = whole - answer;
    var g = whole - 10, r = take - g;
    return {
      section: 'past-ten',
      parts: [num(whole), op(MINUS), num(take), op(EQ), blank()],
      answer: answer,
      hint: whole + ' ' + MINUS + ' ' + g + ' = 10, then 10 ' + MINUS + ' ' + r
    };
  }

  var GENERATORS = {
    'doubles': genDoubles,
    'doubles-plus-one': genDoublesPlusOne,
    'make-ten': genMakeTen,
    'missing-number': genMissingNumber,
    'fact-pair': genFactPair,
    'past-ten': genPastTen
  };

  var SECTIONS = [
    { id: 'doubles',          name: 'Doubles',          icon: '\uD83D\uDC6F' },
    { id: 'doubles-plus-one', name: 'Doubles Plus One', icon: '\u2795' },
    { id: 'make-ten',         name: 'Make Ten',         icon: '\uD83D\uDD1F' },
    { id: 'missing-number',   name: 'Missing Number',   icon: '\u2753' },
    { id: 'fact-pair',        name: 'Fact Pairs',       icon: '\uD83D\uDD17' },
    { id: 'past-ten',         name: 'Past Ten',         icon: '\uD83C\uDF09' },
    { id: 'mix',              name: 'Mixed',            icon: '\uD83C\uDFB2' }
  ];

  // 'mix' leans on the three that matter most.
  var MIX_POOL = [
    'missing-number', 'missing-number', 'missing-number',
    'past-ten', 'past-ten', 'past-ten',
    'doubles', 'doubles', 'doubles',
    'make-ten', 'fact-pair', 'doubles-plus-one'
  ];

  function signature(q) {
    var shape = q.parts.map(function (p) { return p.t === 'blank' ? '_' : p.v; }).join(' ');
    return q.section + '|' + shape + '|' + q.answer;
  }

  // Returns a flat array. A fact-pair may run one past `count` rather than be split.
  function buildSession(opts) {
    opts = opts || {};
    var count = opts.count || 20;
    var section = opts.section || 'mix';
    if (section !== 'mix' && !GENERATORS[section]) throw new Error('mathFacts: unknown section "' + section + '"');
    var rng = makeRng(opts.seed);
    var out = [], seen = {}, guard = 0, budget = count * 40;

    while (out.length < count) {
      guard++;
      var id = section === 'mix' ? pick(rng, MIX_POOL) : section;
      var made = GENERATORS[id](rng);
      var batch = Array.isArray(made) ? made : [made];
      var key = batch.map(signature).join('||');
      // Best effort: doubles has 6 distinct questions and make-ten 9, so past the
      // retry budget we accept a repeat rather than spin.
      if (seen[key] && guard < budget) continue;
      seen[key] = true;
      for (var i = 0; i < batch.length; i++) out.push(batch[i]);
    }
    return out;
  }

  // ── self-test ──
  function checkEquation(q) {
    var p = q.parts;
    if (p.length !== 5) return 'parts length ' + p.length;
    if (p[1].t !== 'op' || p[3].t !== 'op' || p[3].v !== EQ) return 'unexpected shape';
    var v = p.map(function (x) { return x.t === 'blank' ? q.answer : x.v; });
    var left = p[1].v === PLUS ? v[0] + v[2] : v[0] - v[2];
    if (left !== v[4]) return 'equation fails: ' + v[0] + ' ' + p[1].v + ' ' + v[2] + ' != ' + v[4];
    return null;
  }

  function runSelfTest(total) {
    total = total || 20000;
    var ids = SECTIONS.map(function (s) { return s.id; });
    var per = Math.ceil(total / ids.length);
    var checked = 0;

    function bad(q, why) {
      throw new Error('mathFacts self-test failed [' + q.section + '] ' + why + ' :: ' + JSON.stringify(q));
    }

    for (var s = 0; s < ids.length; s++) {
      var session = buildSession({ count: per, section: ids[s] });
      for (var i = 0; i < session.length; i++) {
        var q = session[i], nums = [], blanks = 0;
        for (var j = 0; j < q.parts.length; j++) {
          var p = q.parts[j];
          if (p.t === 'blank') { blanks++; }
          else if (p.t === 'num') { nums.push(p.v); }
        }
        if (blanks !== 1) bad(q, 'expected exactly 1 blank, got ' + blanks);
        nums.push(q.answer);
        if (q.frame !== undefined) nums.push(q.frame);
        if (q.hint) {
          var m = String(q.hint).match(/\d+/g) || [];
          for (var k = 0; k < m.length; k++) nums.push(parseInt(m[k], 10));
        }
        for (var n = 0; n < nums.length; n++) {
          var val = nums[n];
          if (typeof val !== 'number' || !isFinite(val) || Math.floor(val) !== val) bad(q, 'non-integer: ' + val);
          if (val > MAX) bad(q, 'number above ' + MAX + ': ' + val);
          if (val < 0) bad(q, 'number below 0: ' + val);
        }
        var err = checkEquation(q);
        if (err) bad(q, err);
        checked++;
      }
      for (var a = 0; a < session.length; a++) {
        if (!session[a].pairId) continue;
        var mated = (a > 0 && session[a - 1].pairId === session[a].pairId) ||
                    (a + 1 < session.length && session[a + 1].pairId === session[a].pairId);
        if (!mated) bad(session[a], 'fact-pair separated from its partner at index ' + a);
      }
    }

    var s1 = JSON.stringify(buildSession({ count: 50, section: 'mix', seed: 'abc' }));
    var s2 = JSON.stringify(buildSession({ count: 50, section: 'mix', seed: 'abc' }));
    if (s1 !== s2) throw new Error('mathFacts self-test failed: seeded session not reproducible');

    return { ok: true, checked: checked };
  }

  var api = { buildSession: buildSession, runSelfTest: runSelfTest, SECTIONS: SECTIONS, MAX: MAX };
  root.MathFacts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
