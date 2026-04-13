(function() {
  var S = window.Speakize;
  var container = document.getElementById('studyPageContainer');
  var params = new URLSearchParams(window.location.search);
  var lang = params.get('lang') || 'zh';
  var id = params.get('id') || 'all';

  // SM-2 parameters
  var LEARN_STEPS = [1, 10];       // minutes
  var RELEARN_STEPS = [10];        // minutes
  var GRADUATING_INTERVAL = 1;     // days
  var EASY_INTERVAL = 4;           // days
  var DEFAULT_EASE = 2.5;
  var MIN_EASE = 1.3;
  var NEW_CARDS_PER_SESSION = 20;
  var LAPSE_FACTOR = 0.5;
  var MIN_INTERVAL = 1;            // days

  fetch('data/' + lang + '.json')
    .then(function(r) { return r.json(); })
    .then(function(data) { start(data); })
    .catch(function(err) {
      container.innerHTML = '<div class="alert alert-danger m-4">Failed to load: ' + S.esc(err.message) + '</div>';
    });

  function start(data) {
    var deck = S.resolveDeck(data, id);
    if (!deck || !deck.phrases.length) {
      container.innerHTML = '<div class="alert alert-warning m-4">No flashcards in this deck.</div>';
      return;
    }
    var knownSet = new Set(data.known || []);
    var pages = data.pages || {};
    S.attachWordModal(S.makeLangLookup(data, lang));

    var total = deck.phrases.length;
    var storageKey = 'speakize.srs.' + lang + '.' + id;
    var cards = loadCards(storageKey);
    var now = Date.now();

    // Build session queue: learning/relearning (always), due reviews, then new cards
    var queue = [];       // [{idx, sortKey}]
    var newCount = 0;
    for (var i = 0; i < total; i++) {
      var c = cards[i];
      if (!c) {
        // New card — add up to limit
        if (newCount < NEW_CARDS_PER_SESSION) {
          queue.push({ idx: i, sortKey: 3e15 + i }); // new cards last
          newCount++;
        }
      } else if (c.state === 'learning' || c.state === 'relearning') {
        queue.push({ idx: i, sortKey: c.due || 0 });
      } else if (c.state === 'review' && c.due <= now) {
        queue.push({ idx: i, sortKey: c.due });
      }
    }
    queue.sort(function(a, b) { return a.sortKey - b.sortKey; });
    var sessionQueue = queue.map(function(q) { return q.idx; });

    var reviewsDue = queue.filter(function(q) { var c = cards[q.idx]; return c && c.state === 'review'; }).length;
    var learningCount = queue.filter(function(q) { var c = cards[q.idx]; return c && (c.state === 'learning' || c.state === 'relearning'); }).length;

    var backHref = 'deck.html?lang=' + lang + '&id=' + encodeURIComponent(id);
    container.innerHTML =
      '<br><h3 class="text-center">' + S.esc(deck.name) + '</h3>' +
      '<p class="text-center text-muted" id="studyStatus"></p>' +
      '<div class="card m-3 text-center shadow"><div class="card-body">' +
        '<img id="studyImage" class="img-fluid rounded mb-2" style="display:none; max-height:200px;" alt="">' +
        '<br>' +
        '<p class="fs-4" id="studyText"></p>' +
        '<p><em id="studyTrans" style="display:none"></em></p>' +
        '<audio controls id="studyAudio" style="display:none"></audio>' +
        '<button type="button" class="btn btn-outline-secondary btn-sm" id="studyTtsBtn" style="display:none"><i class="bi bi-volume-up"></i></button>' +
        '<p class="text-muted small mt-2" id="studyMeta"></p>' +
        '<br>' +
        '<div id="studyShowBtnWrap"><button class="btn btn-lg btn-secondary" id="btnShow">Show Answer</button></div>' +
        '<div id="studyBtns" style="display:none">' +
          '<button class="btn btn-danger" id="btnAgain"><span class="d-block">Again</span><small id="lblAgain"></small></button> ' +
          '<button class="btn btn-warning" id="btnHard"><span class="d-block">Hard</span><small id="lblHard"></small></button> ' +
          '<button class="btn btn-success" id="btnGood"><span class="d-block">Good</span><small id="lblGood"></small></button> ' +
          '<button class="btn btn-primary" id="btnEasy"><span class="d-block">Easy</span><small id="lblEasy"></small></button>' +
        '</div>' +
      '</div></div>' +
      '<div class="text-center my-3">' +
        '<a class="btn btn-outline-secondary" href="' + backHref + '">&larr; Back to Deck</a> ' +
        '<button class="btn btn-outline-danger btn-sm" id="btnReset">Reset</button>' +
      '</div>';

    function getCard(idx) {
      if (!cards[idx]) {
        cards[idx] = { state: 'new', step: 0, interval: 0, ease: DEFAULT_EASE, due: 0, reps: 0, lapses: 0 };
      }
      return cards[idx];
    }

    function fmtInterval(days) {
      if (days < 1/60/24) return '< 1m';
      if (days < 1/24) return Math.round(days * 24 * 60) + 'm';
      if (days < 1) return Math.round(days * 24) + 'h';
      if (days < 30) return Math.round(days) + 'd';
      if (days < 365) return (days / 30).toFixed(1) + 'mo';
      return (days / 365).toFixed(1) + 'y';
    }

    // Compute what interval each button would produce, for label display
    function getIntervals(idx) {
      var c = getCard(idx);
      var res = {};
      if (c.state === 'new' || c.state === 'learning') {
        var steps = LEARN_STEPS;
        res.again = steps[0] / (24 * 60);          // back to step 0
        res.hard = steps[Math.min(c.step, steps.length - 1)] / (24 * 60); // repeat step
        var nextStep = c.step + 1;
        if (nextStep >= steps.length) {
          res.good = GRADUATING_INTERVAL;           // graduate
        } else {
          res.good = steps[nextStep] / (24 * 60);
        }
        res.easy = EASY_INTERVAL;
      } else if (c.state === 'relearning') {
        var steps = RELEARN_STEPS;
        res.again = steps[0] / (24 * 60);
        res.hard = steps[Math.min(c.step, steps.length - 1)] / (24 * 60);
        var nextStep = c.step + 1;
        if (nextStep >= steps.length) {
          res.good = Math.max(MIN_INTERVAL, c.interval);
        } else {
          res.good = steps[nextStep] / (24 * 60);
        }
        res.easy = Math.max(MIN_INTERVAL, c.interval) * 1.3;
      } else { // review
        var ivl = c.interval || GRADUATING_INTERVAL;
        var ease = c.ease || DEFAULT_EASE;
        res.again = RELEARN_STEPS[0] / (24 * 60);
        res.hard = Math.max(MIN_INTERVAL, ivl * 1.2);
        res.good = Math.max(MIN_INTERVAL, ivl * ease);
        res.easy = Math.max(MIN_INTERVAL, ivl * ease * 1.3);
      }
      return res;
    }

    function answerCard(idx, button) {
      var c = getCard(idx);

      if (c.state === 'new' || c.state === 'learning') {
        handleLearning(c, button, LEARN_STEPS);
      } else if (c.state === 'relearning') {
        handleLearning(c, button, RELEARN_STEPS);
      } else { // review
        handleReview(c, button);
      }

      saveCards(storageKey, cards);
    }

    function handleLearning(c, button, steps) {
      var wasRelearning = (c.state === 'relearning');
      switch (button) {
        case 'again':
          c.step = 0;
          c.state = wasRelearning ? 'relearning' : 'learning';
          c.due = Date.now() + steps[0] * 60000;
          requeueLearning(c);
          break;
        case 'hard':
          // Repeat current step
          c.due = Date.now() + steps[Math.min(c.step, steps.length - 1)] * 60000;
          requeueLearning(c);
          break;
        case 'good':
          c.step++;
          if (c.step >= steps.length) {
            graduate(c, wasRelearning);
          } else {
            c.due = Date.now() + steps[c.step] * 60000;
            requeueLearning(c);
          }
          break;
        case 'easy':
          c.step = steps.length;
          c.interval = wasRelearning ? Math.max(MIN_INTERVAL, c.interval) * 1.3 : EASY_INTERVAL;
          c.ease = Math.max(MIN_EASE, c.ease + 0.15);
          c.state = 'review';
          c.reps++;
          c.due = Date.now() + c.interval * 86400000;
          break;
      }
    }

    function graduate(c, wasRelearning) {
      if (wasRelearning) {
        c.interval = Math.max(MIN_INTERVAL, c.interval);
      } else {
        c.interval = GRADUATING_INTERVAL;
      }
      c.state = 'review';
      c.reps++;
      c.due = Date.now() + c.interval * 86400000;
    }

    function handleReview(c, button) {
      var ivl = c.interval || GRADUATING_INTERVAL;
      var ease = c.ease || DEFAULT_EASE;
      switch (button) {
        case 'again':
          c.lapses++;
          c.ease = Math.max(MIN_EASE, ease - 0.20);
          c.interval = Math.max(MIN_INTERVAL, Math.round(ivl * LAPSE_FACTOR));
          c.state = 'relearning';
          c.step = 0;
          c.due = Date.now() + RELEARN_STEPS[0] * 60000;
          requeueLearning(c);
          return;
        case 'hard':
          c.ease = Math.max(MIN_EASE, ease - 0.15);
          c.interval = Math.max(MIN_INTERVAL, Math.round(ivl * 1.2));
          break;
        case 'good':
          c.interval = Math.max(MIN_INTERVAL, Math.round(ivl * ease));
          break;
        case 'easy':
          c.ease = Math.max(MIN_EASE, ease + 0.15);
          c.interval = Math.max(MIN_INTERVAL, Math.round(ivl * ease * 1.3));
          break;
      }
      c.reps++;
      c.state = 'review';
      c.due = Date.now() + c.interval * 86400000;
    }

    // For learning/relearning cards, track that we need to reinsert in the session
    var reinsertIdx = null;
    function requeueLearning(c) {
      reinsertIdx = c; // signal to the click handler
    }

    function updateStatus() {
      var n = Date.now();
      var newC = 0, learnC = 0, dueC = 0;
      sessionQueue.forEach(function(idx) {
        var c = cards[idx];
        if (!c || c.state === 'new') newC++;
        else if (c.state === 'learning' || c.state === 'relearning') learnC++;
        else if (c.state === 'review') dueC++;
      });
      document.getElementById('studyStatus').innerHTML =
        '<span class="text-primary">' + newC + ' new</span> &middot; ' +
        '<span class="text-warning">' + learnC + ' learning</span> &middot; ' +
        '<span class="text-success">' + dueC + ' review</span>';
    }

    function showCard() {
      document.getElementById('studyShowBtnWrap').style.display = '';
      document.getElementById('studyBtns').style.display = 'none';
      document.getElementById('studyTrans').style.display = 'none';

      if (!sessionQueue.length) {
        document.getElementById('studyText').textContent = 'All done for now!';
        document.getElementById('studyTrans').textContent = '';
        document.getElementById('studyMeta').textContent = '';
        document.getElementById('studyShowBtnWrap').style.display = 'none';
        var aud = document.getElementById('studyAudio');
        aud.removeAttribute('src'); aud.style.display = 'none';
        document.getElementById('studyTtsBtn').style.display = 'none';
        var img = document.getElementById('studyImage');
        img.removeAttribute('src'); img.style.display = 'none';
        updateStatus();
        return;
      }

      var phraseIdx = sessionQueue[0];
      var c = getCard(phraseIdx);
      // If this learning card isn't due yet, skip to next or wait
      if ((c.state === 'learning' || c.state === 'relearning') && c.due > Date.now()) {
        // Find next card that is ready
        var found = false;
        for (var i = 1; i < sessionQueue.length; i++) {
          var ci = cards[sessionQueue[i]];
          if (!ci || ci.state === 'new' || ci.state === 'review' ||
              ((ci.state === 'learning' || ci.state === 'relearning') && ci.due <= Date.now())) {
            // Move this card to front
            var moved = sessionQueue.splice(i, 1)[0];
            sessionQueue.unshift(moved);
            phraseIdx = moved;
            c = getCard(phraseIdx);
            found = true;
            break;
          }
        }
        if (!found) {
          // All remaining are learning cards not yet due; show wait message
          var waitSec = Math.ceil((c.due - Date.now()) / 1000);
          document.getElementById('studyText').textContent = 'Next card in ' + waitSec + 's...';
          document.getElementById('studyTrans').textContent = '';
          document.getElementById('studyMeta').textContent = '';
          document.getElementById('studyShowBtnWrap').style.display = 'none';
          var aud = document.getElementById('studyAudio');
          aud.removeAttribute('src'); aud.style.display = 'none';
          document.getElementById('studyTtsBtn').style.display = 'none';
          var img = document.getElementById('studyImage');
          img.removeAttribute('src'); img.style.display = 'none';
          setTimeout(function() { showCard(); }, Math.min(waitSec * 1000, 5000));
          updateStatus();
          return;
        }
      }

      var p = deck.phrases[phraseIdx];
      var textEl = document.getElementById('studyText');
      if (p.segmented && p.segmented.length) {
        textEl.innerHTML = S.renderTokens(lang, p.segmented, pages, knownSet);
      } else {
        textEl.textContent = p.phrase || '';
      }
      document.getElementById('studyTrans').textContent = p.translation || '';
      // Meta: state + stats
      var meta = '';
      if (c.state === 'review') meta = 'Interval: ' + fmtInterval(c.interval) + ' · Ease: ' + c.ease.toFixed(2);
      else if (c.state === 'learning') meta = 'Learning (step ' + (c.step + 1) + '/' + LEARN_STEPS.length + ')';
      else if (c.state === 'relearning') meta = 'Relearning (step ' + (c.step + 1) + '/' + RELEARN_STEPS.length + ') · Lapses: ' + c.lapses;
      else meta = 'New';
      document.getElementById('studyMeta').textContent = meta;

      var aud = document.getElementById('studyAudio');
      var ttsBtn = document.getElementById('studyTtsBtn');
      var phraseText = (p.segmented && p.segmented.length) ? p.segmented.join(lang === 'zh' ? '' : ' ') : (p.phrase || '');
      if (p.audio_url) {
        aud.src = p.audio_url; aud.style.display = '';
        ttsBtn.style.display = 'none';
      } else {
        aud.removeAttribute('src'); aud.style.display = 'none';
        if (phraseText) {
          ttsBtn.style.display = '';
          ttsBtn.onclick = function() { S.ttsSpeak(phraseText, lang); };
        } else {
          ttsBtn.style.display = 'none';
        }
      }
      var img = document.getElementById('studyImage');
      if (p.image_url) { img.src = p.image_url; img.style.display = ''; }
      else { img.removeAttribute('src'); img.style.display = 'none'; }

      // Update button labels with intervals
      var intervals = getIntervals(phraseIdx);
      document.getElementById('lblAgain').textContent = fmtInterval(intervals.again);
      document.getElementById('lblHard').textContent = fmtInterval(intervals.hard);
      document.getElementById('lblGood').textContent = fmtInterval(intervals.good);
      document.getElementById('lblEasy').textContent = fmtInterval(intervals.easy);

      updateStatus();
    }

    document.getElementById('btnShow').addEventListener('click', function() {
      document.getElementById('studyShowBtnWrap').style.display = 'none';
      document.getElementById('studyBtns').style.display = '';
      document.getElementById('studyTrans').style.display = '';
      var aud = document.getElementById('studyAudio');
      if (aud.src) aud.play().catch(function(){});
      else if (document.getElementById('studyTtsBtn').style.display !== 'none') {
        document.getElementById('studyTtsBtn').click();
      }
    });

    ['again', 'hard', 'good', 'easy'].forEach(function(btn) {
      document.getElementById('btn' + btn.charAt(0).toUpperCase() + btn.slice(1)).addEventListener('click', function() {
        if (!sessionQueue.length) return;
        var phraseIdx = sessionQueue.shift();
        reinsertIdx = null;
        answerCard(phraseIdx, btn);
        if (btn !== 'again') {
          var p = deck.phrases[phraseIdx];
          if (p && p.segmented) S.recordWordReviews(lang, p.segmented, pages);
        }
        // If the card needs to go back in the queue (learning/relearning)
        var c = cards[phraseIdx];
        if (c && (c.state === 'learning' || c.state === 'relearning')) {
          // Insert a few positions back so we don't see it immediately
          var pos = Math.min(sessionQueue.length, Math.max(3, Math.floor(sessionQueue.length * 0.3)));
          sessionQueue.splice(pos, 0, phraseIdx);
        }
        showCard();
      });
    });

    document.getElementById('btnReset').addEventListener('click', function() {
      if (!confirm('Reset all SRS progress for this deck?')) return;
      localStorage.removeItem(storageKey);
      location.reload();
    });

    showCard();
  }

  function loadCards(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function saveCards(key, cards) {
    try { localStorage.setItem(key, JSON.stringify(cards)); } catch (e) {}
  }
})();
