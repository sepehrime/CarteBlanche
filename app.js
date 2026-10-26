// Carte Blanche: a game-like French flashcard app.
(function () {
  "use strict";

  // ===================== Data and constants =====================
  var ALL = (window.FRENCH_EXPRESSIONS || []).map(function (c, i) {
    return {
      id: i,
      fr: c.fr,
      en: c.en,
      context: c.context,
      difficulty: c.difficulty,
    };
  });
  var LEVELS = { beginner: 1, intermediate: 2, advanced: 3 };
  var STORE_KEY = "french-flashcards-v2";
  var OLD_STORE_KEY = "french-flashcards-v1";
  // Spaced repetition (Leitner boxes): days until a card comes back, by box.
  var INTERVALS = [0, 1, 2, 4, 7, 15, 30];
  var GOALS = [10, 20, 30, 50];
  var BONUS_ROUND = 10;
  var TITLES = [
    ["Touriste", "tourist"],
    ["Flâneur", "stroller"],
    ["Habitué", "regular"],
    ["Bavard", "chatterbox"],
    ["Gourmet", "gourmet"],
    ["Parisien", "Parisian"],
    ["Poète", "poet"],
    ["Philosophe", "philosopher"],
    ["Académicien", "academician"],
    ["Immortel", "immortal"],
  ];
  var STAMPS = [
    { id: "first", name: "Premier pas", desc: "Mark your first card", test: function (s) { return s.answered >= 1; } },
    { id: "goal", name: "Objectif", desc: "Hit your daily goal", test: function (s) { return s.goalEver; } },
    { id: "streak3", name: "Trois jours", desc: "Keep a 3-day streak", test: function (s) { return s.best >= 3; } },
    { id: "streak7", name: "Une semaine", desc: "Keep a 7-day streak", test: function (s) { return s.best >= 7; } },
    { id: "streak30", name: "Un mois", desc: "Keep a 30-day streak", test: function (s) { return s.best >= 30; } },
    { id: "combo10", name: "En feu", desc: "Know 10 cards in a row", test: function (s) { return s.bestCombo >= 10; } },
    { id: "known50", name: "Cinquante", desc: "Know 50 phrases", test: function (s) { return s.known >= 50; } },
    { id: "known250", name: "Deux cent cinquante", desc: "Know 250 phrases", test: function (s) { return s.known >= 250; } },
    { id: "known1000", name: "Mille", desc: "Know every phrase", test: function (s) { return ALL.length > 0 && s.known >= ALL.length; } },
    { id: "topics", name: "Globe-trotteur", desc: "Try cards from 10 topics", test: function (s) { return s.topics >= 10; } },
    { id: "idioms", name: "Idiomatique", desc: "Know 20 idioms", test: function (s) { return s.idioms >= 20; } },
    { id: "owl", name: "Oiseau de nuit", desc: "Study after 10 pm", test: function (s) { return s.live && s.hour >= 22; } },
    { id: "lark", name: "Lève-tôt", desc: "Study before 8 am", test: function (s) { return s.live && s.hour < 8; } },
  ];
  var STAMP_IDS = STAMPS.map(function (s) {
    return s.id;
  });

  // ===================== Dates =====================
  // Local calendar day as a whole number, so "yesterday" is just today() - 1.
  function dayNum(d) {
    d = d || new Date();
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5);
  }
  function today() {
    return dayNum();
  }
  function dayDate(n) {
    var d = new Date(n * 864e5);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  function fmtDay(n, opts) {
    return dayDate(n).toLocaleDateString(undefined, opts);
  }

  // ===================== Saved state =====================
  function readJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  }
  function obj(x) {
    return x && typeof x === "object" && !Array.isArray(x) ? x : {};
  }
  function num(x, fallback) {
    return typeof x === "number" && isFinite(x) ? x : fallback;
  }
  // Use a saved value only if it is one of the allowed choices.
  function pick(value, allowed, fallback) {
    return allowed.indexOf(value) >= 0 ? value : fallback;
  }
  function cleanMarks(marks) {
    var out = {};
    marks = obj(marks);
    Object.keys(marks).forEach(function (fr) {
      if (marks[fr] === "known" || marks[fr] === "learning")
        out[fr] = marks[fr];
    });
    return out;
  }
  function cleanSrs(srs, marks, t) {
    var out = {};
    srs = obj(srs);
    Object.keys(srs).forEach(function (fr) {
      var v = srs[fr];
      if (Array.isArray(v) && typeof v[0] === "number" && typeof v[1] === "number")
        out[fr] = [Math.max(0, Math.min(INTERVALS.length - 1, v[0] | 0)), v[1] | 0];
    });
    // Cards marked in the old version get a review schedule.
    Object.keys(marks).forEach(function (fr) {
      if (!out[fr]) out[fr] = marks[fr] === "known" ? [2, t + 2] : [0, t];
    });
    return out;
  }
  function cleanCounts(days) {
    var out = {};
    days = obj(days);
    Object.keys(days).forEach(function (k) {
      if (/^\d+$/.test(k) && typeof days[k] === "number" && days[k] > 0)
        out[k] = days[k] | 0;
    });
    return out;
  }
  function cleanStamps(stamps) {
    var out = {};
    stamps = obj(stamps);
    Object.keys(stamps).forEach(function (id) {
      if (STAMP_IDS.indexOf(id) >= 0) out[id] = num(stamps[id], today());
    });
    return out;
  }

  var saved = obj(readJSON(STORE_KEY) || readJSON(OLD_STORE_KEY));
  var T0 = today();
  var marks0 = cleanMarks(saved.marks);
  var state = {
    // Saved
    marks: marks0, // fr sentence -> "known" | "learning"
    srs: cleanSrs(saved.srs, marks0, T0), // fr sentence -> [box, due day]
    days: cleanCounts(saved.days), // day -> cards answered
    xp: Math.max(0, num(saved.xp, 0)),
    goal: pick(saved.goal, GOALS, 20),
    streak: Math.max(0, num(saved.streak, 0)),
    best: Math.max(0, num(saved.best, 0)),
    lastGoalDay: num(saved.lastGoalDay, null),
    bestCombo: Math.max(0, num(saved.bestCombo, 0)),
    stamps: cleanStamps(saved.stamps),
    lastVisit: num(saved.lastVisit, null),
    sound: saved.sound !== false,
    mode: pick(saved.mode, ["daily", "explore"], "daily"),
    tab: pick(saved.tab, ["daily", "explore", "carnet"], "daily"),
    difficulty: pick(saved.difficulty, ["all"].concat(Object.keys(LEVELS)), "all"),
    context: typeof saved.context === "string" ? saved.context : "all",
    status: pick(saved.status, ["all", "new", "learning", "known"], "all"),
    direction: pick(saved.direction, ["fr-en", "en-fr"], "fr-en"),
    shuffled: !!saved.shuffled,
    // This visit only
    queue: [], // daily: card ids still to show
    requeued: {},
    roundSize: 0,
    roundDone: 0,
    order: [], // explore: card ids
    index: 0,
    flipped: false,
    combo: 0,
    busy: false,
    sessionXp: 0,
    sessionKnown: 0,
  };
  var SAVED_FIELDS = [
    "marks", "srs", "days", "xp", "goal", "streak", "best", "lastGoalDay",
    "bestCombo", "stamps", "lastVisit", "sound", "mode", "tab", "difficulty",
    "context", "status", "direction", "shuffled",
  ];
  function save() {
    var out = {};
    SAVED_FIELDS.forEach(function (k) {
      out[k] = state[k];
    });
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(out));
    } catch (e) {
      /* storage unavailable: progress lasts for this visit only */
    }
  }

  // ===================== Elements =====================
  var $ = function (id) {
    return document.getElementById(id);
  };
  var el = {
    app: $("app"),
    card: $("card"),
    cardWrap: $("cardWrap"),
    frontFace: $("frontFace"),
    backFace: $("backFace"),
    frontFlip: $("frontFlip"),
    backFlip: $("backFlip"),
    frontMeta: $("frontMeta"),
    frontLang: $("frontLang"),
    frontText: $("frontText"),
    backMeta: $("backMeta"),
    backLang: $("backLang"),
    backText: $("backText"),
    backSub: $("backSub"),
    postage: $("postage"),
    postDate: $("postDate"),
    slam: $("slam"),
    empty: $("empty"),
    done: $("donePanel"),
    doneTitle: $("doneTitle"),
    doneText: $("doneText"),
    controls: $("controls"),
    playScreen: $("playScreen"),
    carnetScreen: $("carnetScreen"),
    difficulty: $("difficultySelect"),
    settings: $("settings"),
    settingsBtn: $("settingsBtn"),
    settingsClose: $("settingsClose"),
    cLevelNum: $("cLevelNum"),
    levelGloss: $("levelGloss"),
    cXpBar: $("cXpBar"),
    statStreak: $("statStreak"),
    statBest: $("statBest"),
    statKnown: $("statKnown"),
    statStudied: $("statStudied"),
    toolbar: $("toolbar"),
    pos: $("pos"),
    bar: $("bar"),
    combo: $("combo"),
    context: $("contextSelect"),
    status: $("statusSelect"),
    shuffle: $("shuffleBtn"),
    prev: $("prevBtn"),
    next: $("nextBtn"),
    streakBox: $("streakBox"),
    streakNum: $("streakNum"),
    streakLabel: $("streakLabel"),
    goalBox: $("goalBox"),
    goalRing: $("goalRing"),
    goalNum: $("goalNum"),
    goalLabel: $("goalLabel"),
    levelBox: $("levelBox"),
    levelNum: $("levelNum"),
    levelTitle: $("levelTitle"),
    xpBar: $("xpBar"),
    xpText: $("xpText"),
    sound: $("soundBtn"),
    heat: $("heat"),
    heatText: $("heatText"),
    pdjFr: $("pdjFr"),
    pdjEn: $("pdjEn"),
    pdjSpeak: $("pdjSpeak"),
    stamps: $("stamps"),
    stampCount: $("stampCount"),
    reset: $("resetBtn"),
    confirm: $("confirmReset"),
    confirmYes: $("confirmYes"),
    confirmNo: $("confirmNo"),
    cel: $("celebrate"),
    celText: $("celText"),
    celStats: $("celStats"),
    celMore: $("celMore"),
    celDone: $("celDone"),
    toasts: $("toasts"),
    sr: $("srStatus"),
    floaters: $("floaters"),
    confetti: $("confetti"),
  };

  // ===================== Helpers =====================
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }
  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }
  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function seeded(seed) {
    // mulberry32: same "random" order all day long
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffleArray(a, rnd) {
    rnd = rnd || Math.random;
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
  function restart(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }
  function statusOf(card) {
    return state.marks[card.fr] || "new";
  }
  function levelOf(xp) {
    var L = 1;
    while (xp >= 50 * (L + 1) * L) L++;
    var from = 50 * L * (L - 1);
    var to = 50 * (L + 1) * L;
    var t = TITLES[Math.min(L, TITLES.length) - 1];
    return { level: L, title: t[0], gloss: t[1], from: from, to: to };
  }
  function liveStreak() {
    var t = today();
    return state.lastGoalDay === t || state.lastGoalDay === t - 1
      ? state.streak
      : 0;
  }
  function doneToday() {
    return state.days[today()] || 0;
  }
  function dueBy(day) {
    var n = 0;
    Object.keys(state.srs).forEach(function (fr) {
      if (state.srs[fr][1] <= day) n++;
    });
    return n;
  }
  function stampColor(topic) {
    var h = 0;
    for (var i = 0; i < topic.length; i++) h = (h * 31 + topic.charCodeAt(i)) | 0;
    return ["blue", "red", "green", "ochre"][Math.abs(h) % 4];
  }

  // ===================== Sound (tiny synth, no files) =====================
  var audio = null;
  function tones(notes, type, vol, step) {
    if (!state.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      var t0 = audio.currentTime;
      notes.forEach(function (f, i) {
        var o = audio.createOscillator();
        var g = audio.createGain();
        var t = t0 + i * step;
        o.type = type;
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + step + 0.18);
        o.connect(g).connect(audio.destination);
        o.start(t);
        o.stop(t + step + 0.2);
      });
    } catch (e) {
      /* no audio */
    }
  }
  var sfx = {
    known: function (combo) {
      var lift = Math.min(combo, 12) * 40;
      tones([660 + lift, 990 + lift], "sine", 0.12, 0.07);
    },
    learning: function () {
      tones([330, 247], "triangle", 0.1, 0.08);
    },
    goal: function () {
      tones([523, 659, 784, 1047, 1319], "triangle", 0.12, 0.09);
    },
    level: function () {
      tones([392, 523, 659, 784, 659, 1047], "square", 0.05, 0.08);
    },
    stamp: function () {
      tones([880, 1175, 1568], "sine", 0.1, 0.06);
    },
  };

  // ===================== Speech =====================
  var canSpeak = "speechSynthesis" in window;
  function speakText(text) {
    if (!canSpeak || !text) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "fr-FR";
      u.rate = 0.9;
      var v = speechSynthesis.getVoices().filter(function (x) {
        return /^fr/i.test(x.lang);
      });
      if (v.length)
        u.voice =
          v.find(function (x) {
            return x.lang === "fr-FR";
          }) || v[0];
      speechSynthesis.speak(u);
    } catch (e) {
      /* speech not available */
    }
  }
  function speak() {
    var c = current();
    if (c) speakText(c.fr);
  }
  function speakBtn() {
    return canSpeak
      ? '<button class="speak" type="button" data-speak title="Hear it in French (S)">▶ Écouter</button>'
      : "";
  }

  // ===================== Decks =====================
  // Topic dropdown for Explore
  var contexts = Array.from(
    new Set(
      ALL.map(function (c) {
        return c.context;
      }),
    ),
  ).sort();
  contexts.forEach(function (c) {
    var o = document.createElement("option");
    o.value = c;
    o.textContent = cap(c);
    el.context.appendChild(o);
  });
  if (state.context !== "all" && contexts.indexOf(state.context) < 0)
    state.context = "all";

  // Today's round: cards due for review mixed with new ones (easier first).
  function buildDaily(size) {
    var t = today();
    var need = size != null ? size : Math.max(state.goal - doneToday(), 0);
    state.requeued = {};
    state.roundDone = 0;
    if (!need) {
      state.queue = [];
      state.roundSize = 0;
      return;
    }
    var srs = state.srs;
    var due = ALL.filter(function (c) {
      return srs[c.fr] && srs[c.fr][1] <= t;
    }).sort(function (a, b) {
      return srs[a.fr][1] - srs[b.fr][1] || srs[a.fr][0] - srs[b.fr][0];
    });
    var fresh = shuffleArray(
      ALL.filter(function (c) {
        return !srs[c.fr];
      }),
      seeded(t),
    ).sort(function (a, b) {
      return (LEVELS[a.difficulty] || 1) - (LEVELS[b.difficulty] || 1);
    });
    // Keep about a third of each round new, so there is always something fresh.
    var newTake = Math.min(
      fresh.length,
      Math.max(need - due.length, Math.round(need * 0.3)),
    );
    var dueTake = Math.min(due.length, need - newTake);
    var d = due.slice(0, dueTake);
    var n = fresh.slice(0, newTake);
    var q = [];
    var i = 0;
    var j = 0;
    while (i < d.length || j < n.length) {
      if (j < n.length && (i >= d.length || (j + 1) / n.length <= (i + 1) / d.length))
        q.push(n[j++].id);
      else q.push(d[i++].id);
    }
    state.queue = q;
    state.roundSize = q.length;
  }

  function filtered() {
    return ALL.filter(function (c) {
      return (
        (state.difficulty === "all" || c.difficulty === state.difficulty) &&
        (state.context === "all" || c.context === state.context) &&
        (state.status === "all" || statusOf(c) === state.status)
      );
    });
  }
  // Rebuild the Explore deck. keepId tries to stay on the same card.
  function buildExplore(keepId) {
    var ids = filtered().map(function (c) {
      return c.id;
    });
    if (state.shuffled) shuffleArray(ids);
    state.order = ids;
    var at = keepId == null ? -1 : ids.indexOf(keepId);
    state.index = at >= 0 ? at : 0;
  }
  function rebuild(keepId) {
    if (state.mode === "daily") buildDaily();
    else buildExplore(keepId);
    state.flipped = false;
    render();
  }

  function current() {
    return state.mode === "daily"
      ? ALL[state.queue[0]]
      : ALL[state.order[state.index]];
  }
  function deckSize() {
    return state.mode === "daily" ? state.queue.length : state.order.length;
  }

  // ===================== Rendering =====================
  function chips(card) {
    var s = statusOf(card);
    var lvl = LEVELS[card.difficulty] || 1;
    var html =
      '<span class="chip"><span class="dots" aria-hidden="true">' +
      "●".repeat(lvl) +
      "○".repeat(3 - lvl) +
      "</span>" +
      esc(cap(card.difficulty)) +
      "</span>";
    if (!state.srs[card.fr]) html += '<span class="chip new">New</span>';
    else if (state.mode === "daily")
      html += '<span class="chip">Review</span>';
    if (s !== "new" && state.mode === "explore")
      html +=
        '<span class="chip status-' + s + '">' +
        (s === "known" ? "Known" : "Learning") +
        "</span>";
    return '<div class="chips">' + html + "</div>";
  }

  function renderHud() {
    var t = today();
    var streak = liveStreak();
    var goalMet = state.lastGoalDay === t;
    el.streakNum.textContent = streak;
    el.streakBox.classList.toggle("lit", streak > 0 && goalMet);
    el.streakBox.classList.toggle("risk", streak > 0 && !goalMet);
    el.streakLabel.textContent =
      streak > 0 && !goalMet
        ? "day streak. Play today, it ends at midnight."
        : "day streak";
    el.streakBox.title =
      streak > 0 && !goalMet
        ? plural(streak, "day") + " streak. Hit today's goal before midnight to keep it."
        : plural(streak, "day") + " streak";

    var done = doneToday();
    el.goalNum.textContent = Math.min(done, state.goal) + "/" + state.goal;
    el.goalLabel.textContent = goalMet ? "cards today. Goal met." : "cards today";
    el.goalBox.title = goalMet ? "Daily goal met" : "Today's goal: " + state.goal + " cards";
    el.goalBox.classList.toggle("met", goalMet);
    var frac = Math.min(done / state.goal, 1);
    el.goalRing.style.strokeDashoffset = String(106.8 * (1 - frac));

    var L = levelOf(state.xp);
    el.levelNum.textContent = L.level;
    el.levelNum.setAttribute("aria-label", "Level " + L.level);
    var pct = ((state.xp - L.from) / (L.to - L.from)) * 100 + "%";
    el.xpBar.style.width = pct;
    $("xpNum").textContent = state.xp.toLocaleString() + " XP";
    el.levelBox.title =
      "Level " + L.level + ", " + L.title + ": " + state.xp.toLocaleString() + " / " + L.to.toLocaleString() + " XP";
    // Carnet level card
    el.cLevelNum.textContent = L.level;
    el.cLevelNum.setAttribute("aria-label", "Level " + L.level);
    el.levelTitle.textContent = L.title;
    el.levelGloss.textContent = "Level " + L.level + ", French for “" + L.gloss + "”";
    el.cXpBar.style.width = pct;
    el.xpText.textContent =
      state.xp.toLocaleString() + " / " + L.to.toLocaleString() + " XP";
  }

  function renderToolbar() {
    document.querySelectorAll("[data-tab]").forEach(function (b) {
      if (b.dataset.tab === state.tab) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    el.playScreen.hidden = state.tab === "carnet";
    el.carnetScreen.hidden = state.tab !== "carnet";
    el.difficulty.value = state.difficulty;
    document.querySelectorAll("[data-direction]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.direction === state.direction));
    });
    document.querySelectorAll("[data-goal]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(+b.dataset.goal === state.goal));
    });
    el.sound.setAttribute("aria-checked", String(state.sound));
    el.toolbar.hidden = state.mode !== "explore";
    el.context.value = state.context;
    el.status.value = state.status;
    el.shuffle.setAttribute("aria-pressed", String(state.shuffled));
    var daily = state.mode === "daily";
    el.prev.hidden = daily;
    el.next.hidden = daily;
    el.controls.classList.toggle("daily", daily);
  }

  function renderCombo() {
    var show = state.combo >= 3;
    el.combo.hidden = !show;
    if (show) {
      el.combo.textContent = "Combo " + state.combo + "  ×" + comboMult();
    }
  }

  function renderDone() {
    var t = today();
    var goalMet = state.lastGoalDay === t;
    var tomorrow = dueBy(t + 1);
    if (goalMet) {
      el.doneTitle.textContent = "À demain !";
      el.doneText.textContent =
        "That's today's postcards. Your streak is " +
        plural(liveStreak(), "day") +
        (tomorrow
          ? ", and " + plural(tomorrow, "card") + " will be back for review tomorrow."
          : ".");
    } else {
      el.doneTitle.textContent = "Tout est fait";
      el.doneText.textContent =
        "There are no cards left to show right now. Reviews come back as they're due.";
    }
  }

  function render() {
    renderHud();
    renderToolbar();
    renderCombo();

    var n = deckSize();
    var daily = state.mode === "daily";
    el.cardWrap.hidden = n === 0;
    el.controls.hidden = n === 0;
    el.cardWrap.dataset.stack = String(Math.min(Math.max(n - 1, 0), 2));
    if (!n) el.combo.hidden = true;
    el.empty.hidden = n !== 0 || daily;
    el.done.hidden = n !== 0 || !daily;
    if (daily) {
      var seen = state.roundDone;
      el.pos.textContent = n
        ? Math.min(seen + 1, state.roundSize) + " / " + state.roundSize
        : "Round complete";
      el.bar.style.width = state.roundSize
        ? (seen / state.roundSize) * 100 + "%"
        : "100%";
    } else {
      el.pos.textContent = n ? state.index + 1 + " / " + n : "0 / 0";
      el.bar.style.width = n ? ((state.index + 1) / n) * 100 + "%" : "0";
    }
    if (!n) {
      if (daily) renderDone();
      return;
    }

    var c = current();
    var frFirst = state.direction === "fr-en";
    // Note focus now: rewriting the card below can drop it.
    var hadFocus = el.card.contains(document.activeElement);
    el.frontMeta.innerHTML = chips(c);
    el.backMeta.innerHTML = chips(c);
    var lvl = LEVELS[c.difficulty] || 1;
    el.postage.dataset.c = stampColor(c.context);
    el.postage.innerHTML =
      '<div class="postage-in"><span class="v">FR</span><span class="t">' +
      esc(cap(c.context)) +
      '</span><span class="d" aria-hidden="true">' +
      "●".repeat(lvl) +
      "</span></div>";
    el.postage.setAttribute("aria-label", "Topic: " + c.context);
    el.postage.setAttribute("role", "img");
    el.postDate.textContent = fmtDay(today(), { day: "numeric", month: "short" });
    el.frontLang.innerHTML = frFirst ? "French " + speakBtn() : "English";
    el.backLang.innerHTML = frFirst ? "English" : "French " + speakBtn();
    el.frontText.textContent = frFirst ? c.fr : c.en;
    el.frontText.className = "text" + (frFirst ? "" : " en");
    el.frontText.lang = frFirst ? "fr" : "en";
    el.backText.textContent = frFirst ? c.en : c.fr;
    el.backText.className = "text" + (frFirst ? " en" : "");
    el.backText.lang = frFirst ? "en" : "fr";
    el.backSub.textContent = frFirst ? c.fr : c.en;
    el.backSub.className = "sub" + (frFirst ? " fr" : "");
    el.backSub.lang = frFirst ? "fr" : "en";
    el.card.classList.toggle("flipped", state.flipped);
    // The face turned away is inert: screen readers skip it and it can't take focus.
    el.frontFace.inert = state.flipped;
    el.backFace.inert = !state.flipped;
    if (hadFocus) (state.flipped ? el.backFlip : el.frontFlip).focus();
  }

  function renderHeat() {
    var t = today();
    var weekday = (dayDate(t).getDay() + 6) % 7; // Monday = 0
    var start = t - weekday - 11 * 7;
    var html = "";
    var active = 0;
    for (var d = start; d < start + 12 * 7; d++) {
      var n = state.days[d] || 0;
      if (n) active++;
      var cls =
        d > t ? "future" : n >= 40 ? "l4" : n >= 20 ? "l3" : n >= 10 ? "l2" : n > 0 ? "l1" : "";
      if (d === t) cls += " today";
      html +=
        '<i class="' + cls + '" title="' +
        esc(fmtDay(d, { weekday: "short", month: "short", day: "numeric" }) + ": " + plural(n, "card")) +
        '"></i>';
    }
    el.heat.innerHTML = html;
    el.heat.setAttribute("role", "img");
    el.heat.setAttribute(
      "aria-label",
      "Practice calendar: you studied on " + plural(active, "day") + " in the last 12 weeks.",
    );
    el.heatText.textContent =
      "Studied on " + plural(active, "day") + ". Best streak: " + plural(state.best, "day") + ".";
  }

  function renderPhraseOfDay() {
    if (!ALL.length) return;
    var c = ALL[(today() * 7919) % ALL.length];
    el.pdjFr.textContent = c.fr;
    el.pdjEn.textContent = c.en;
    el.pdjSpeak.hidden = !canSpeak;
    el.pdjSpeak.onclick = function () {
      speakText(c.fr);
    };
  }

  function renderStamps(freshId) {
    var got = 0;
    el.stamps.innerHTML = STAMPS.map(function (s) {
      var when = state.stamps[s.id];
      if (when != null) got++;
      return (
        '<li class="' + (when == null ? "locked" : "") + (s.id === freshId ? " fresh" : "") + '">' +
        '<span class="n">' + esc(s.name) + "</span>" +
        '<span class="d">' +
        esc(when == null ? s.desc : s.desc + ". Earned " + fmtDay(when, { month: "short", day: "numeric" })) +
        "</span></li>"
      );
    }).join("");
    el.stampCount.textContent = got + " of " + STAMPS.length;
  }

  function renderTiles() {
    var s = stats(false);
    el.statStreak.textContent = liveStreak();
    el.statBest.textContent = state.best;
    el.statKnown.textContent = s.known;
    el.statStudied.textContent = s.answered.toLocaleString();
  }

  function renderCarnet(freshId) {
    renderTiles();
    renderHeat();
    renderPhraseOfDay();
    renderStamps(freshId);
  }

  // ===================== Feedback: toasts, floaters, confetti =====================
  function toast(icon, title, body) {
    var t = document.createElement("div");
    t.className = "toast";
    t.innerHTML =
      '<span class="ic" aria-hidden="true">' + esc(icon) + "</span><div><b>" +
      esc(title) + "</b>" + (body ? "<span>" + esc(body) + "</span>" : "") + "</div>";
    el.toasts.appendChild(t);
    setTimeout(function () {
      t.classList.add("out");
      setTimeout(function () {
        t.remove();
      }, 320);
    }, 4200);
  }

  function floatXp(text, kind, from) {
    if (reduceMotion()) return;
    var r = (from || el.card).getBoundingClientRect();
    var f = document.createElement("span");
    f.className = "floater " + kind;
    f.textContent = text;
    f.style.left = r.left + r.width / 2 + "px";
    f.style.top = r.top - 6 + "px";
    el.floaters.appendChild(f);
    setTimeout(function () {
      f.remove();
    }, 950);
  }

  function confetti(count) {
    if (reduceMotion()) return;
    var cv = el.confetti;
    var ctx = cv.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    var W = (cv.width = innerWidth * dpr);
    var H = (cv.height = innerHeight * dpr);
    var css = getComputedStyle(document.documentElement);
    var colors = ["--stamp-red", "--stamp-blue", "--known", "--gold"].map(function (v) {
      return css.getPropertyValue(v).trim();
    });
    var parts = [];
    for (var i = 0; i < count; i++) {
      parts.push({
        x: W / 2 + (Math.random() - 0.5) * W * 0.3,
        y: H * 0.35,
        vx: (Math.random() - 0.5) * 22 * dpr,
        vy: (-Math.random() * 20 - 6) * dpr,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        w: (6 + Math.random() * 6) * dpr,
        h: (4 + Math.random() * 4) * dpr,
        c: colors[i % colors.length],
      });
    }
    var start = performance.now();
    (function frame(now) {
      ctx.clearRect(0, 0, W, H);
      var alive = false;
      parts.forEach(function (p) {
        p.vy += 0.6 * dpr;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        if (p.y < H + 20) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        ctx.restore();
      });
      if (alive && now - start < 4000) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    })(start);
  }

  // ===================== Stamps (achievements) =====================
  function stats(live) {
    var known = 0;
    var idioms = 0;
    var topics = {};
    ALL.forEach(function (c) {
      if (state.marks[c.fr] === "known") {
        known++;
        if (c.context === "idioms") idioms++;
      }
      if (state.srs[c.fr]) topics[c.context] = 1;
    });
    var answered = 0;
    Object.keys(state.days).forEach(function (k) {
      answered += state.days[k];
    });
    return {
      answered: answered,
      known: known,
      idioms: idioms,
      topics: Object.keys(topics).length,
      best: state.best,
      bestCombo: state.bestCombo,
      goalEver: state.lastGoalDay != null,
      hour: new Date().getHours(),
      live: live,
    };
  }
  function checkStamps(live) {
    var s = stats(live);
    var earned = [];
    STAMPS.forEach(function (st) {
      if (state.stamps[st.id] == null && st.test(s)) {
        state.stamps[st.id] = today();
        earned.push(st);
      }
    });
    if (!earned.length) return;
    save();
    renderStamps(live ? earned[earned.length - 1].id : null);
    if (live) {
      sfx.stamp();
      earned.forEach(function (st) {
        toast("Tampon", "New stamp: " + st.name, st.desc);
      });
    }
  }

  // ===================== Answering a card =====================
  function comboMult() {
    return state.combo >= 10 ? 3 : state.combo >= 5 ? 2 : 1;
  }

  function registerGoal(t) {
    if (state.lastGoalDay === t || (state.days[t] || 0) < state.goal) return false;
    state.streak = state.lastGoalDay === t - 1 ? state.streak + 1 : 1;
    state.best = Math.max(state.best, state.streak);
    state.lastGoalDay = t;
    return true;
  }

  function answer(kind, fromSwipe) {
    var c = current();
    if (!c || state.busy) return;
    var t = today();
    var box = state.srs[c.fr] ? state.srs[c.fr][0] : 0;
    if (kind === "known") {
      box = Math.min(box + 1, INTERVALS.length - 1);
      state.srs[c.fr] = [box, t + INTERVALS[box]];
      state.combo++;
      state.sessionKnown++;
    } else {
      state.srs[c.fr] = [0, t];
      state.combo = 0;
    }
    state.marks[c.fr] = kind;
    state.bestCombo = Math.max(state.bestCombo, state.combo);

    var gain = kind === "known" ? 10 * comboMult() : 3;
    var levelBefore = levelOf(state.xp).level;
    state.xp += gain;
    state.sessionXp += gain;
    state.days[t] = (state.days[t] || 0) + 1;
    var goalHit = registerGoal(t);
    state.lastVisit = t;
    save();

    if (kind === "known") sfx.known(state.combo);
    else sfx.learning();
    var btn = kind === "known" ? $("knowBtn") : $("learnBtn");
    btn.classList.add("press");
    setTimeout(function () {
      btn.classList.remove("press");
    }, 120);
    floatXp("+" + gain + " XP", kind, btn);
    el.sr.textContent =
      (kind === "known" ? "Marked as known" : "Marked as still learning") + ". Plus " + gain + " XP.";

    animateOut(kind, fromSwipe, function () {
      advance(kind, c);
      render();
      renderHeat();
      renderTiles();
      var L = levelOf(state.xp);
      if (L.level > levelBefore) {
        restart(el.levelBox, "bump");
        sfx.level();
        confetti(90);
        toast("Niveau " + L.level, "You're now " + L.title, "That's French for “" + L.gloss + "”.");
      }
      if (state.combo >= 3) restart(el.combo, "pop");
      checkStamps(true);
      if (goalHit) openCelebration();
    });
  }

  function advance(kind, c) {
    state.flipped = false;
    if (state.mode === "daily") {
      state.queue.shift();
      state.roundDone++;
      // A card you're still learning comes back once more, a few cards later.
      if (kind === "learning" && !state.requeued[c.id]) {
        state.requeued[c.id] = true;
        state.queue.splice(Math.min(3, state.queue.length), 0, c.id);
        state.roundSize++;
      }
      return;
    }
    // Explore: if the status filter would now hide this card, drop it from the deck.
    if (state.status !== "all" && state.status !== kind) {
      state.order.splice(state.index, 1);
      if (state.index >= state.order.length) state.index = 0;
    } else {
      go(1, true);
    }
  }

  // Stamp slams onto the card, the card flies off, the next one is dealt.
  function animateOut(kind, fromSwipe, done) {
    if (reduceMotion()) {
      el.slam.className = "slam";
      el.card.style.transform = "";
      el.card.classList.remove("dragging");
      done();
      return;
    }
    state.busy = true;
    el.slam.textContent = kind === "known" ? "Connu" : "Encore";
    if (fromSwipe) {
      // The stamp is already showing from the drag; keep it fully inked.
      el.slam.style.opacity = "0.92";
      el.slam.className = "slam peek " + kind;
    } else {
      el.slam.style.opacity = "";
      el.slam.className = "slam show " + kind;
      restart(el.cardWrap, "shake");
    }
    setTimeout(
      function () {
        el.card.classList.remove("dragging");
        el.card.style.transform = "";
        el.card.classList.add(kind === "known" ? "fly-right" : "fly-left");
        setTimeout(function () {
          el.card.classList.add("swap");
          el.card.classList.remove("fly-right", "fly-left");
          el.slam.className = "slam";
          el.slam.style.opacity = "";
          state.busy = false;
          done();
          void el.card.offsetWidth;
          el.card.classList.remove("swap");
          restart(el.card, "enter");
        }, 260);
      },
      fromSwipe ? 120 : 300,
    );
  }

  function flip() {
    if (!deckSize() || state.busy) return;
    state.flipped = !state.flipped;
    render();
  }
  function go(d, silent) {
    if (state.mode !== "explore") return;
    var n = state.order.length;
    if (!n) return;
    state.index = (state.index + d + n) % n;
    state.flipped = false;
    if (!silent) render();
  }

  // ===================== Celebration =====================
  function openCelebration() {
    sfx.goal();
    confetti(160);
    restart(el.streakBox, "bump");
    var s = liveStreak();
    el.celText.textContent =
      s > 1
        ? "Today's " + state.goal + " postcards are done. That's " + s + " days in a row."
        : "Today's " + state.goal + " postcards are done. Come back tomorrow to start a streak.";
    el.celStats.innerHTML =
      "<div><dt>XP this visit</dt><dd>+" + state.sessionXp + "</dd></div>" +
      "<div><dt>Known</dt><dd>" + state.sessionKnown + "</dd></div>" +
      "<div><dt>Streak</dt><dd>" + s + "</dd></div>";
    el.cel.hidden = false;
    el.app.inert = true;
    el.celMore.focus();
  }
  function closeCelebration(more) {
    el.cel.hidden = true;
    el.app.inert = false;
    if (state.mode === "daily") {
      if (more && !state.queue.length) buildDaily(BONUS_ROUND);
      if (!more) state.queue = [];
    }
    state.flipped = false;
    render();
    var target = more ? el.frontFlip : $("moreBtn");
    if (target && target.offsetParent) target.focus();
  }

  // ===================== Swipe =====================
  var drag = null;
  var suppressClick = false;
  el.card.addEventListener("pointerdown", function (e) {
    if (state.busy || e.button !== 0 || e.target.closest("[data-speak]")) return;
    drag = { x: e.clientX, y: e.clientY, dx: 0, active: false, id: e.pointerId };
  });
  el.card.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x;
    var dy = e.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      drag.active = true;
      try {
        el.card.setPointerCapture(e.pointerId);
      } catch (err) {}
      el.card.classList.add("dragging");
    }
    drag.dx = dx;
    el.card.style.transform = "translateX(" + dx + "px) rotate(" + dx / 18 + "deg)";
    var kind = dx > 0 ? "known" : "learning";
    el.slam.textContent = kind === "known" ? "Connu" : "Encore";
    el.slam.className = "slam peek " + kind;
    el.slam.style.opacity = String(Math.min(Math.abs(dx) / 110, 1) * 0.92);
  });
  function endDrag() {
    if (!drag) return;
    var d = drag;
    drag = null;
    if (!d.active) return;
    suppressClick = true;
    setTimeout(function () {
      suppressClick = false;
    }, 60);
    if (Math.abs(d.dx) > 100) {
      answer(d.dx > 0 ? "known" : "learning", true);
    } else {
      el.card.classList.remove("dragging");
      el.card.style.transform = "";
      el.slam.className = "slam";
      el.slam.style.opacity = "";
    }
  }
  el.card.addEventListener("pointerup", endDrag);
  el.card.addEventListener("pointercancel", endDrag);

  // ===================== Events =====================
  el.card.addEventListener("click", function (e) {
    if (suppressClick) return;
    if (e.target.closest("[data-speak]")) {
      e.stopPropagation();
      speak();
      return;
    }
    flip();
  });
  el.prev.addEventListener("click", function () {
    go(-1);
  });
  el.next.addEventListener("click", function () {
    go(1);
  });
  $("knowBtn").addEventListener("click", function () {
    answer("known");
  });
  $("learnBtn").addEventListener("click", function () {
    answer("learning");
  });

  function setTab(tab) {
    if (state.tab === tab) return;
    state.tab = tab;
    if (tab === "carnet") {
      save();
      renderCarnet();
      renderToolbar();
      window.scrollTo(0, 0);
      return;
    }
    state.mode = tab;
    save();
    rebuild();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("[data-tab]").forEach(function (b) {
    b.addEventListener("click", function () {
      setTab(b.dataset.tab);
    });
  });
  el.difficulty.addEventListener("change", function () {
    state.difficulty = el.difficulty.value;
    save();
    rebuild();
  });

  function openSettings() {
    el.settings.hidden = false;
    el.app.inert = true;
    el.settingsClose.focus();
  }
  function closeSettings() {
    if (el.settings.hidden) return;
    el.settings.hidden = true;
    el.app.inert = false;
    el.confirm.hidden = true;
    el.reset.hidden = false;
    el.settingsBtn.focus();
  }
  el.settingsBtn.addEventListener("click", openSettings);
  el.settingsClose.addEventListener("click", closeSettings);
  el.settings.addEventListener("click", function (e) {
    if (e.target === el.settings) closeSettings();
  });
  document.querySelectorAll("[data-direction]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.direction = b.dataset.direction;
      state.flipped = false;
      save();
      render();
    });
  });
  document.querySelectorAll("[data-goal]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.goal = +b.dataset.goal;
      var hit = registerGoal(today());
      save();
      rebuild();
      if (hit) {
        closeSettings();
        checkStamps(true);
        openCelebration();
      }
    });
  });
  el.context.addEventListener("change", function () {
    state.context = el.context.value;
    save();
    rebuild();
  });
  el.status.addEventListener("change", function () {
    state.status = el.status.value;
    save();
    rebuild();
  });
  el.shuffle.addEventListener("click", function () {
    state.shuffled = !state.shuffled;
    save();
    var c = current();
    rebuild(state.shuffled ? null : c && c.id);
  });
  $("showAll").addEventListener("click", function () {
    state.difficulty = "all";
    state.context = "all";
    state.status = "all";
    save();
    rebuild();
  });
  $("moreBtn").addEventListener("click", function () {
    buildDaily(BONUS_ROUND);
    state.flipped = false;
    render();
    el.frontFlip.focus();
  });
  $("toExploreBtn").addEventListener("click", function () {
    setTab("explore");
  });
  el.sound.addEventListener("click", function () {
    state.sound = !state.sound;
    save();
    renderToolbar();
    if (state.sound) sfx.known(0);
  });
  el.celMore.addEventListener("click", function () {
    closeCelebration(true);
  });
  el.celDone.addEventListener("click", function () {
    closeCelebration(false);
  });

  function closeConfirm() {
    el.confirm.hidden = true;
    el.reset.hidden = false;
    el.reset.focus();
  }
  el.reset.addEventListener("click", function () {
    el.confirm.hidden = false;
    el.reset.hidden = true;
    el.confirmNo.focus();
  });
  el.confirmNo.addEventListener("click", closeConfirm);
  el.confirmYes.addEventListener("click", function () {
    state.marks = {};
    state.srs = {};
    state.days = {};
    state.xp = 0;
    state.streak = 0;
    state.best = 0;
    state.lastGoalDay = null;
    state.bestCombo = 0;
    state.stamps = {};
    state.combo = 0;
    state.sessionXp = 0;
    state.sessionKnown = 0;
    save();
    rebuild();
    renderCarnet();
    closeConfirm();
  });

  document.addEventListener("keydown", function (e) {
    if (!el.cel.hidden) {
      if (e.key === "Escape") closeCelebration(false);
      return;
    }
    if (!el.settings.hidden) {
      if (e.key === "Escape") closeSettings();
      return;
    }
    if (state.tab === "carnet") return;
    var t = e.target.closest ? e.target : null;
    if (t && t.closest("select, input, textarea")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key.toLowerCase();
    // Let Space press a focused button instead of flipping the card.
    if (k === " " && t && t.closest("button")) return;
    if (k === " ") {
      if (!deckSize()) return;
      e.preventDefault();
      flip();
    } else if (k === "arrowright") go(1);
    else if (k === "arrowleft") go(-1);
    else if (k === "k") answer("known");
    else if (k === "l") answer("learning");
    else if (k === "s") speak();
  });

  // ===================== Start =====================
  if (canSpeak) {
    try {
      speechSynthesis.getVoices();
    } catch (e) {}
  }
  var T = today();
  var cameBack = state.lastVisit != null && state.lastVisit < T;
  state.lastVisit = T;
  save();
  if (state.tab !== "carnet") state.tab = state.mode;
  checkStamps(false);
  rebuild();
  renderCarnet();

  if (cameBack) {
    var due = dueBy(T);
    var s = liveStreak();
    var body =
      s > 0 && state.lastGoalDay !== T
        ? "Finish today's " + state.goal + " cards to make it " + plural(s + 1, "day") + " in a row."
        : due
          ? plural(due, "card") + (due === 1 ? " is" : " are") + " ready for review."
          : "New postcards are waiting.";
    setTimeout(function () {
      toast("Salut", "Bon retour !", body);
    }, 500);
  }
})();
