/* ============================================================
   QuestBox — "Can Your Pup Crack It?" mini puzzle game
   Self-contained module. Mounts into [data-puzzle-mount].
   State object -> render/update functions (React-style flow,
   in vanilla JS to match the existing stack: no new deps).
   ============================================================ */

(function () {
  "use strict";

  var MOUNT_SELECTOR = "[data-puzzle-mount]";
  var GATE_COUNT = 3;
  var DEMO_LEAD_MS = 650;  // pause before the demo starts
  var DEMO_PEEK_MS = 520;  // how long a gate peeks open during the demo
  var DEMO_GAP_MS = 260;   // pause between demo peeks
  var RESET_LEAD_MS = 520; // pause before demo replays after "Play again"
  var CONFETTI_COUNT = 30;
  var CONFETTI_TTL_MS = 3800;

  var REDUCED_MOTION =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var WRONG_LINES = [
    "Woof! Not this gate — follow the scent trail.",
    "Close! The trail leads elsewhere. Check the order.",
    "The scent doesn't lead here. Sniff out another gate!",
  ];

  var ICONS = {
    bone:
      '<svg viewBox="0 0 48 32" fill="none" aria-hidden="true"><g fill="currentColor">' +
      '<circle cx="10" cy="10" r="7"/><circle cx="10" cy="22" r="7"/>' +
      '<circle cx="38" cy="10" r="7"/><circle cx="38" cy="22" r="7"/>' +
      '<rect x="9" y="9" width="30" height="14" rx="7"/></g></svg>',
    paw:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><g fill="currentColor">' +
      '<ellipse cx="12" cy="15.6" rx="5.4" ry="4.4"/><circle cx="5.6" cy="10.2" r="2.1"/>' +
      '<circle cx="9.9" cy="6.9" r="2.2"/><circle cx="14.6" cy="6.9" r="2.2"/>' +
      '<circle cx="18.6" cy="10.2" r="2.1"/></g></svg>',
    hint:
      '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">' +
      '<path d="M1.5 7.5S3.9 3.2 7.5 3.2s6 4.3 6 4.3-2.4 4.3-6 4.3-6-4.3-6-4.3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<circle cx="7.5" cy="7.5" r="2" fill="currentColor"/></svg>',
    replay:
      '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">' +
      '<path d="M12.9 7.5a5.4 5.4 0 1 1-1.6-3.8M13 1.7v2.7h-2.7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  /* ---------------- state ---------------- */

  var state = null;
  var runToken = 0; // invalidates in-flight async sequences on reset
  var timerId = null;
  var wrongLineIndex = 0;

  var el = {}; // cached DOM refs inside the mount

  function createInitialState() {
    return {
      sequence: shuffledGateOrder(), // secret gate order, reshuffled every game
      stepIndex: 0,                  // how many sequence gates are open
      phase: "idle",                 // idle | demo | playing | solved
      moves: 0,
      wrong: 0,
      startedAt: null,
      elapsedMs: 0,
    };
  }

  function shuffledGateOrder() {
    var order = [0, 1, 2];
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    return order;
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function formatTime(ms) {
    var totalSeconds = Math.floor(ms / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return minutes + ":" + String(seconds).padStart(2, "0");
  }

  /* ---------------- render ---------------- */

  function gateHtml(index) {
    return (
      '<button type="button" class="qp-gate" data-qp="gate" data-gate="' + index + '"' +
      ' aria-label="Gate ' + (index + 1) + ' of ' + GATE_COUNT + ', closed">' +
      '<span class="qp-well" aria-hidden="true">' + ICONS.paw + "</span>" +
      '<span class="qp-door" aria-hidden="true">' +
      '<span class="qp-knob"><i></i><i></i></span>' + ICONS.bone +
      "</span></button>"
    );
  }

  function renderGame() {
    el.mount.innerHTML =
      '<div class="qp-cartridge">' +
      '<div class="qp-cartridge-top">' +
      '<span class="qp-cartridge-label">Treat Vault &middot; Level 1</span>' +
      '<span class="qp-cartridge-note">Browser edition</span>' +
      "</div>" +
      '<div class="qp-gates" role="group" aria-label="Puzzle gates">' +
      gateHtml(0) + gateHtml(1) + gateHtml(2) +
      "</div>" +
      '<div class="qp-trail" aria-hidden="true"><span></span>' + ICONS.paw + "<span></span></div>" +
      '<div class="qp-vault" data-qp="vault">' +
      '<div class="qp-vault-cavity">' +
      '<span class="qp-treat" aria-hidden="true">' + ICONS.bone + "</span>" +
      '<span class="qp-confetti" data-qp="confetti" aria-hidden="true"></span>' +
      "</div>" +
      '<div class="qp-vault-door">' +
      '<span class="qp-vault-grip" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span class="qp-vault-text">Hidden compartment</span>' +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="qp-hud">' +
      '<p class="qp-progress">' +
      '<span class="qp-pips" data-qp="pips" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span data-qp="progress">Gate 1 of ' + GATE_COUNT + "</span>" +
      "</p>" +
      '<p class="qp-stats">' +
      '<span class="qp-stat" data-qp="moves">Moves &middot; 0</span>' +
      '<span class="qp-stat" data-qp="timer">0:00</span>' +
      "</p>" +
      "</div>" +
      '<p class="qp-message" data-qp="message" role="status" aria-live="polite">Watch the scent trail&hellip;</p>' +
      '<div class="qp-actions">' +
      '<button type="button" class="button button-secondary button-sm" data-qp="hint">' +
      ICONS.hint + " Watch the trail again</button>" +
      '<button type="button" class="button button-primary button-sm" data-qp="restart" hidden>' +
      ICONS.replay + " Play again</button>" +
      "</div>";

    el.root = el.mount.querySelector(".qp-cartridge");
    el.vault = el.mount.querySelector('[data-qp="vault"]');
    el.gates = Array.prototype.slice.call(el.mount.querySelectorAll('[data-qp="gate"]'));
    el.pips = Array.prototype.slice.call(el.mount.querySelectorAll('[data-qp="pips"] i'));
    el.progress = el.mount.querySelector('[data-qp="progress"]');
    el.moves = el.mount.querySelector('[data-qp="moves"]');
    el.timer = el.mount.querySelector('[data-qp="timer"]');
    el.message = el.mount.querySelector('[data-qp="message"]');
    el.hint = el.mount.querySelector('[data-qp="hint"]');
    el.restart = el.mount.querySelector('[data-qp="restart"]');
    el.confetti = el.mount.querySelector('[data-qp="confetti"]');
  }

  function gateByIndex(index) {
    return el.gates[index];
  }

  /* ---------------- HUD / messages ---------------- */

  function setMessage(text, variant) {
    el.message.textContent = text;
    el.message.className = "qp-message" + (variant ? " is-" + variant : "");
  }

  function updateHud() {
    el.moves.innerHTML = "Moves &middot; " + state.moves;
    el.pips.forEach(function (pip, i) {
      pip.classList.toggle("on", i < state.stepIndex);
    });
    el.progress.textContent =
      state.stepIndex === GATE_COUNT
        ? "All gates open!"
        : "Gate " + (state.stepIndex + 1) + " of " + GATE_COUNT;
  }

  /* ---------------- timer ---------------- */

  function startTimer() {
    stopTimer();
    timerId = setInterval(function () {
      if (!state.startedAt) return;
      state.elapsedMs = Date.now() - state.startedAt;
      el.timer.textContent = formatTime(state.elapsedMs);
    }, 250);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  /* ---------------- demo (scent trail) ---------------- */

  function playDemo() {
    if (!state || state.phase === "demo" || state.phase === "solved") return;
    var run = ++runToken;

    state.phase = "demo";
    el.mount.classList.add("is-demo");
    el.hint.disabled = true;
    setMessage("Watch the scent trail\u2026");

    sleep(DEMO_LEAD_MS)
      .then(function () {
        if (run !== runToken) return;
        return state.sequence.reduce(function (promise, index) {
          return promise.then(function () {
            if (run !== runToken) return;
            var gate = gateByIndex(index);
            gate.classList.add("is-peek");
            return sleep(DEMO_PEEK_MS).then(function () {
              if (run !== runToken) return;
              gate.classList.remove("is-peek");
              return sleep(DEMO_GAP_MS);
            });
          });
        }, Promise.resolve());
      })
      .then(function () {
        if (run !== runToken) return;
        state.phase = "playing";
        el.mount.classList.remove("is-demo");
        el.hint.disabled = false;
        setMessage("Your turn — slide the gates in the same order!");
        if (!state.startedAt) {
          state.startedAt = Date.now();
          startTimer();
        }
      });
  }

  /* ---------------- gameplay ---------------- */

  function onGateClick(gate) {
    if (!state || state.phase !== "playing") return;
    if (gate.classList.contains("is-open")) return;

    var index = Number(gate.dataset.gate);
    state.moves += 1;

    if (index === state.sequence[state.stepIndex]) {
      openGate(gate);
      state.stepIndex += 1;
      if (state.stepIndex === GATE_COUNT) {
        updateHud();
        solve();
        return;
      }
      var remaining = GATE_COUNT - state.stepIndex;
      setMessage(
        "Nice sniff! " + remaining + (remaining === 1 ? " gate" : " gates") + " to go."
      );
    } else {
      state.wrong += 1;
      shakeGate(gate);
      setMessage(WRONG_LINES[wrongLineIndex++ % WRONG_LINES.length], "hint");
    }
    updateHud();
  }

  function openGate(gate) {
    gate.classList.add("is-open");
    gate.setAttribute(
      "aria-label",
      "Gate " + (Number(gate.dataset.gate) + 1) + " of " + GATE_COUNT + ", open"
    );
  }

  function shakeGate(gate) {
    gate.classList.remove("is-wrong");
    void gate.offsetWidth; // restart the shake animation
    gate.classList.add("is-wrong");
    gate.addEventListener(
      "animationend",
      function handler() {
        gate.classList.remove("is-wrong");
        gate.removeEventListener("animationend", handler);
      }
    );
  }

  function solve() {
    state.phase = "solved";
    stopTimer();
    state.elapsedMs = state.startedAt ? Date.now() - state.startedAt : 0;
    el.timer.textContent = formatTime(state.elapsedMs);

    el.hint.disabled = true;
    el.restart.hidden = false;
    setMessage("Puzzle solved! Your pup would love this!", "win");

    var run = runToken;
    setTimeout(function () {
      if (run !== runToken) return;
      el.vault.classList.add("is-open");
      spawnConfetti();
    }, 420);
  }

  function spawnConfetti() {
    if (REDUCED_MOTION) return;
    var colors = ["#f4581c", "#ff6b2c", "#ffb937", "#2c5243", "#fff7e8"];
    var pieces = [];
    for (var i = 0; i < CONFETTI_COUNT; i++) {
      var piece = document.createElement("span");
      var size = 6 + Math.random() * 6;
      piece.style.left = 4 + Math.random() * 90 + "%";
      piece.style.width = size + "px";
      piece.style.height = size * (Math.random() > 0.5 ? 1 : 0.55) + "px";
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = 1.3 + Math.random() * 1.2 + "s";
      piece.style.animationDelay = Math.random() * 0.5 + "s";
      pieces.push(piece);
    }
    el.confetti.innerHTML = "";
    pieces.forEach(function (piece) { el.confetti.appendChild(piece); });

    var run = runToken;
    setTimeout(function () {
      if (run !== runToken) return;
      el.confetti.innerHTML = "";
    }, CONFETTI_TTL_MS);
  }

  /* ---------------- reset ---------------- */

  function resetGame() {
    runToken += 1;
    stopTimer();
    state = createInitialState();
    wrongLineIndex = 0;
    el.mount.classList.remove("is-demo");
    renderGame();

    var run = runToken;
    sleep(RESET_LEAD_MS).then(function () {
      if (run !== runToken) return;
      playDemo();
    });
  }

  /* ---------------- events ---------------- */

  function bindEvents() {
    el.mount.addEventListener("click", function (event) {
      var target = event.target;
      var gate = target.closest ? target.closest('[data-qp="gate"]') : null;
      if (gate) {
        onGateClick(gate);
        return;
      }
      if (target.closest('[data-qp="hint"]')) {
        playDemo();
        return;
      }
      if (target.closest('[data-qp="restart"]')) {
        resetGame();
      }
    });
  }

  /* ---------------- init ---------------- */

  function init() {
    var mount = document.querySelector(MOUNT_SELECTOR);
    if (!mount) return;

    el.mount = mount;
    state = createInitialState();
    renderGame();
    bindEvents();

    // Start the scent-trail demo the first time the board scrolls into view.
    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            playDemo();
          });
        },
        { threshold: 0.35 }
      );
      observer.observe(mount);
      // Fallback for very short viewports where 35% is never reached.
      setTimeout(function () {
        if (state.phase === "idle") {
          observer.disconnect();
          playDemo();
        }
      }, 6000);
    } else {
      setTimeout(playDemo, 800);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
