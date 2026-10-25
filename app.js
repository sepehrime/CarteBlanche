(function () {
  "use strict";

  var ALL = (window.FRENCH_EXPRESSIONS || []).map(function (c, i) {
    return {
      id: i,
      fr: c.fr,
      en: c.en,
      context: c.context,
      difficulty: c.difficulty,
    };
  });
  var STORE_KEY = "french-flashcards-v1";
  var LEVELS = { beginner: 1, intermediate: 2, advanced: 3 };

  // ---- Saved state (progress + settings), stored in this browser only ----
  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  var saved = load();
  var state = {
    marks: saved.marks || {}, // fr sentence -> "known" | "learning"
    difficulty: saved.difficulty || "all",
    context: saved.context || "all",
    status: saved.status || "all",
    direction: saved.direction || "fr-en",
    shuffled: !!saved.shuffled,
    order: [],
    index: 0,
    flipped: false,
  };
  function save() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          marks: state.marks,
          difficulty: state.difficulty,
          context: state.context,
          status: state.status,
          direction: state.direction,
          shuffled: state.shuffled,
        }),
      );
    } catch (e) {
      /* storage unavailable: progress lasts for this visit only */
    }
  }

  var $ = function (id) {
    return document.getElementById(id);
  };
  var el = {
    card: $("card"),
    cardWrap: $("cardWrap"),
    empty: $("empty"),
    controls: $("controls"),
    frontMeta: $("frontMeta"),
    frontLang: $("frontLang"),
    frontText: $("frontText"),
    backMeta: $("backMeta"),
    backLang: $("backLang"),
    backText: $("backText"),
    backSub: $("backSub"),
    pos: $("pos"),
    bar: $("bar"),
    context: $("contextSelect"),
    status: $("statusSelect"),
    statKnown: $("statKnown"),
    statLearning: $("statLearning"),
    statNew: $("statNew"),
    shuffle: $("shuffleBtn"),
    reset: $("resetBtn"),
    confirm: $("confirmReset"),
    confirmYes: $("confirmYes"),
    confirmNo: $("confirmNo"),
  };

  // ---- Build context dropdown ----
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
    o.textContent = c.charAt(0).toUpperCase() + c.slice(1);
    el.context.appendChild(o);
  });
  if (state.context !== "all" && contexts.indexOf(state.context) < 0)
    state.context = "all";

  function statusOf(card) {
    return state.marks[card.fr] || "new";
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

  function shuffleArray(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  // Rebuild the deck. keepId tries to stay on the same card.
  function rebuild(keepId) {
    var ids = filtered().map(function (c) {
      return c.id;
    });
    if (state.shuffled) shuffleArray(ids);
    state.order = ids;
    var at = keepId == null ? -1 : ids.indexOf(keepId);
    state.index = at >= 0 ? at : 0;
    state.flipped = false;
    render();
  }

  function current() {
    return ALL[state.order[state.index]];
  }

  function chips(card) {
    var s = statusOf(card);
    var lvl = LEVELS[card.difficulty] || 1;
    var html =
      '<span class="chip">' +
      esc(card.context) +
      "</span>" +
      '<span class="chip lvl"><span class="dots" aria-hidden="true">' +
      "●".repeat(lvl) +
      "○".repeat(3 - lvl) +
      "</span>" +
      esc(card.difficulty) +
      "</span>";
    if (s !== "new") {
      html +=
        '<span class="chip status-' +
        s +
        '">' +
        (s === "known" ? "Known" : "Learning") +
        "</span>";
    }
    return '<div class="chips">' + html + "</div>";
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  var canSpeak = "speechSynthesis" in window;
  function speakBtn() {
    return canSpeak
      ? '<button class="speak" type="button" data-speak title="Hear it in French (S)">▶ Écouter</button>'
      : "";
  }

  function render() {
    // Stats over the whole collection
    var known = 0,
      learning = 0;
    ALL.forEach(function (c) {
      var s = statusOf(c);
      if (s === "known") known++;
      else if (s === "learning") learning++;
    });
    el.statKnown.textContent = known;
    el.statLearning.textContent = learning;
    el.statNew.textContent = ALL.length - known - learning;

    // Toolbar state
    document.querySelectorAll("[data-difficulty]").forEach(function (b) {
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.difficulty === state.difficulty),
      );
    });
    document.querySelectorAll("[data-direction]").forEach(function (b) {
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.direction === state.direction),
      );
    });
    el.context.value = state.context;
    el.status.value = state.status;
    el.shuffle.setAttribute("aria-pressed", String(state.shuffled));
    el.shuffle.textContent = state.shuffled ? "⤮ Shuffled" : "⤮ Shuffle";

    var n = state.order.length;
    el.cardWrap.hidden = n === 0;
    el.controls.hidden = n === 0;
    el.empty.hidden = n !== 0;
    el.pos.textContent = n ? state.index + 1 + " / " + n : "0 / 0";
    el.bar.style.width = n ? ((state.index + 1) / n) * 100 + "%" : "0";
    if (!n) return;

    var c = current();
    var frFirst = state.direction === "fr-en";
    el.frontMeta.innerHTML = chips(c);
    el.backMeta.innerHTML = chips(c);
    el.frontLang.innerHTML = frFirst ? "FR " + speakBtn() : "EN";
    el.backLang.innerHTML = frFirst ? "EN" : "FR " + speakBtn();
    el.frontText.textContent = frFirst ? c.fr : c.en;
    el.frontText.className = "text" + (frFirst ? "" : " en");
    el.backText.textContent = frFirst ? c.en : c.fr;
    el.backText.className = "text" + (frFirst ? " en" : "");
    el.backSub.textContent = frFirst ? c.fr : c.en;
    el.backSub.className = "sub" + (frFirst ? " fr" : "");
    el.card.classList.toggle("flipped", state.flipped);
    el.card.setAttribute(
      "aria-label",
      state.flipped
        ? "Answer side. Press to flip back."
        : "Question side. Press to reveal the answer.",
    );
  }

  function flip() {
    if (!state.order.length) return;
    state.flipped = !state.flipped;
    render();
  }
  function go(d) {
    var n = state.order.length;
    if (!n) return;
    state.index = (state.index + d + n) % n;
    state.flipped = false;
    render();
  }
  function mark(kind) {
    var c = current();
    if (!c) return;
    state.marks[c.fr] = kind;
    save();
    // If the status filter would now hide this card, drop it from the deck.
    if (state.status !== "all" && state.status !== kind) {
      state.order.splice(state.index, 1);
      if (state.index >= state.order.length) state.index = 0;
      state.flipped = false;
      render();
    } else {
      go(1);
    }
  }
  function speak() {
    var c = current();
    if (!c || !canSpeak) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(c.fr);
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

  // ---- Events ----
  el.card.addEventListener("click", function (e) {
    if (e.target.closest("[data-speak]")) {
      e.stopPropagation();
      speak();
      return;
    }
    flip();
  });
  el.card.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      flip();
    }
  });
  $("prevBtn").addEventListener("click", function () {
    go(-1);
  });
  $("nextBtn").addEventListener("click", function () {
    go(1);
  });
  $("knowBtn").addEventListener("click", function () {
    mark("known");
  });
  $("learnBtn").addEventListener("click", function () {
    mark("learning");
  });

  document.querySelectorAll("[data-difficulty]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.difficulty = b.dataset.difficulty;
      save();
      rebuild();
    });
  });
  document.querySelectorAll("[data-direction]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.direction = b.dataset.direction;
      state.flipped = false;
      save();
      render();
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
  el.reset.addEventListener("click", function () {
    el.confirm.hidden = false;
    el.reset.hidden = true;
  });
  el.confirmNo.addEventListener("click", function () {
    el.confirm.hidden = true;
    el.reset.hidden = false;
  });
  el.confirmYes.addEventListener("click", function () {
    state.marks = {};
    save();
    el.confirm.hidden = true;
    el.reset.hidden = false;
    rebuild();
  });

  document.addEventListener("keydown", function (e) {
    if (e.target.closest && e.target.closest("select, input, textarea")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (k === " ") {
      e.preventDefault();
      flip();
    } else if (k === "arrowright") go(1);
    else if (k === "arrowleft") go(-1);
    else if (k === "k") mark("known");
    else if (k === "l") mark("learning");
    else if (k === "s") speak();
  });

  if (canSpeak) {
    try {
      speechSynthesis.getVoices();
    } catch (e) {}
  }
  rebuild();
})();
