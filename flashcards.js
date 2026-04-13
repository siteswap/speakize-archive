/* Shared helpers for phrase rendering + word modal.
 *
 * Used by deck_page.js, study_page.js, word_page.js, document_page.js.
 * The `wordModal` HTML is injected at load time, so all pages share one
 * consistent modal. Each page passes a `lookup(lang, name)` function to
 * attachWordModal() returning {definition, rank, pinyin, audioUrl, fullHref}
 * or null to suppress the modal for unknown words.
 */
window.Speakize = (function() {
  var BUCKET_URL = "https://storage.googleapis.com/createflashcardapp.appspot.com";

  var PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160">' +
      '<rect width="240" height="160" fill="#e9ecef"/>' +
      '<rect x="1" y="1" width="238" height="158" fill="none" stroke="#adb5bd" stroke-dasharray="6,4"/>' +
      '<text x="120" y="88" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#6c757d">No image</text>' +
    '</svg>'
  );

  var VIRTUAL_IDS = {
    all: {label: 'All Flashcards', type: null},
    reading: {label: 'All Reading Flashcards', type: 'READING'},
    listening: {label: 'All Listening Flashcards', type: 'LISTENING'},
    speaking: {label: 'All Speaking Flashcards', type: 'PRODUCTION'}
  };

  var MODAL_HTML = '' +
    '<div class="modal fade" id="wordModal" tabindex="-1" aria-hidden="true">' +
      '<div class="modal-dialog">' +
        '<div class="modal-content">' +
          '<div class="modal-header">' +
            '<h1 class="modal-title fs-3" id="modalWordTitle"></h1>' +
            '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
          '</div>' +
          '<div class="modal-body">' +
            'Meaning: <b id="modalDefinition"></b><br>' +
            'Spoken frequency rank: <b id="modalRank"></b><br>' +
            '<span id="modalPinyinRow">Pinyin: <b id="modalPinyin"></b><br></span>' +
            '<br>' +
            '<a href="#" id="modalFullInfo" class="btn btn-sm btn-outline-primary">Full info &rarr;</a>' +
          '</div>' +
          '<div class="modal-footer">' +
            '<button type="button" class="btn btn-secondary" id="modalPlayBtn">' +
              '<i class="bi bi-play-fill"></i> Play Audio' +
            '</button>' +
            '<button type="button" class="btn btn-outline-danger" id="modalReadBtn" style="display:none"><i class="bi bi-book"></i> Read</button>' +
            '<button type="button" class="btn btn-outline-warning" id="modalListenBtn" style="display:none"><i class="bi bi-speaker"></i> Listen</button>' +
            '<button type="button" class="btn btn-outline-success" id="modalSpeakBtn" style="display:none"><i class="bi bi-mic"></i> Speak</button>' +
            '<button type="button" class="btn btn-primary" data-bs-dismiss="modal">Close</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  var TTS_LANGS = {zh: 'zh-CN', es: 'es-ES'};

  function ttsSpeak(text, lang) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = TTS_LANGS[lang] || lang;
    window.speechSynthesis.speak(u);
  }

  function ttsBtnHtml(text, lang, cls) {
    return '<button type="button" class="btn btn-outline-secondary btn-sm ' + (cls || '') +
      '" onclick="Speakize.ttsSpeak(' + esc(JSON.stringify(text)) + ',' +
      esc(JSON.stringify(lang)) + ')"><i class="bi bi-volume-up"></i></button>';
  }

  function wordAudioUrl(lang, w) {
    return BUCKET_URL + '/common/audio/' + lang + '/word_' + encodeURIComponent(w.toLowerCase()) + '.mp3';
  }

  function wordHref(lang, w) {
    return 'word.html?lang=' + lang + '&w=' + encodeURIComponent(w);
  }

  function renderTokens(lang, segmented, pages, knownSet) {
    var parts = [];
    for (var i = 0; i < segmented.length; i++) {
      var tok = segmented[i];
      var lower = tok.toLowerCase();
      var style, isInTop = lower in pages;
      if (isInTop) {
        style = knownSet.has(lower) ? 'text-decoration:none' : 'color:#fd7e14;text-decoration:none';
      } else {
        style = 'color:#a71d5d;text-decoration:none';
      }
      parts.push('<a style="' + style + '" href="#" class="word" data-name="' +
                 esc(lower) + '" data-lang="' + lang + '">' + esc(tok) + '</a>');
    }
    return parts.join(lang === 'zh' ? '' : ' ');
  }

  function resolveDeck(data, id) {
    if (VIRTUAL_IDS.hasOwnProperty(id)) {
      var v = VIRTUAL_IDS[id];
      var phrases = [];
      for (var i = 0; i < data.decks.length; i++) {
        var d = data.decks[i];
        for (var j = 0; j < d.phrases.length; j++) {
          var p = d.phrases[j];
          if (v.type === null || p.card_type === v.type) {
            var tagged = Object.assign({}, p, {deck_name: d.name, deck_id: d.id});
            phrases.push(tagged);
          }
        }
      }
      return {id: id, name: v.label, phrases: phrases, virtual: true};
    }
    var numId = parseInt(id, 10);
    for (var k = 0; k < data.decks.length; k++) {
      var deckK = data.decks[k];
      if (deckK.id === numId || deckK.id === id) {
        return {id: deckK.id, name: deckK.name, phrases: deckK.phrases, virtual: false, is_shared: deckK.is_shared};
      }
    }
    return null;
  }

  function loadUserFlashcards(lang) {
    try {
      var raw = localStorage.getItem('speakize.flashcards.' + lang);
      var obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
    } catch (e) { return {}; }
  }

  function saveUserFlashcards(lang, map) {
    try { localStorage.setItem('speakize.flashcards.' + lang, JSON.stringify(map)); } catch (e) {}
  }

  function mergeUserDecks(data, lang) {
    var userDecks = loadUserFlashcards(lang);
    data.decks = data.decks || [];
    Object.keys(userDecks).forEach(function(deckId) {
      var ud = userDecks[deckId];
      data.decks.push({
        id: ud.id,
        name: ud.name,
        phrases: ud.phrases || [],
        is_user: true,
        is_shared: false
      });
    });
  }

  function addUserFlashcard(lang, context, word, cardType) {
    var map = loadUserFlashcards(lang);
    var deckId = 'u-doc-' + context.docId;
    var deck = map[deckId];
    if (!deck) {
      deck = map[deckId] = {
        id: deckId,
        name: context.docTitle,
        docId: context.docId,
        is_user: true,
        phrases: []
      };
    } else {
      deck.name = context.docTitle;
    }
    var dup = deck.phrases.some(function(p) {
      return p.phrase === context.phrase && p.card_type === cardType && p.word === word;
    });
    if (!dup) {
      deck.phrases.push({
        phrase: context.phrase,
        segmented: context.segmented || [],
        card_type: cardType,
        translation: context.translation || '',
        audio_url: '',
        image_url: '',
        word: word,
        created_at: Date.now()
      });
      saveUserFlashcards(lang, map);
    }
    return {added: !dup, deck: deck};
  }

  function showToast(msg, kind) {
    var el = document.createElement('div');
    el.className = 'alert alert-' + (kind || 'success') + ' shadow';
    el.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:2000;min-width:240px;text-align:center';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 1800);
  }

  function ensureModal() {
    if (document.getElementById('wordModal')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = MODAL_HTML;
    document.body.appendChild(wrap.firstElementChild);
  }

  var _attached = false;
  function attachWordModal(lookup, options) {
    ensureModal();
    attachWordModal._lookup = lookup;
    attachWordModal._options = options || {};
    if (_attached) return;
    _attached = true;
    var currentAudio = null;
    var currentCtx = null;
    var currentLang = null;
    var currentWord = null;

    function onAddClick(cardType) {
      return function() {
        if (!currentCtx) return;
        var res = addUserFlashcard(currentLang, currentCtx, currentWord, cardType);
        showToast(res.added
          ? 'Added to "' + res.deck.name + '"'
          : 'Already in "' + res.deck.name + '"',
          res.added ? 'success' : 'warning');
        if (cardType === 'LISTENING' || cardType === 'PRODUCTION') {
          ttsSpeak(currentCtx.phrase, currentLang);
        }
        var modalEl = document.getElementById('wordModal');
        var inst = bootstrap.Modal.getInstance(modalEl);
        if (inst) inst.hide();
      };
    }
    var readBtn = document.getElementById('modalReadBtn');
    var listenBtn = document.getElementById('modalListenBtn');
    var speakBtn = document.getElementById('modalSpeakBtn');
    if (readBtn) readBtn.addEventListener('click', onAddClick('READING'));
    if (listenBtn) listenBtn.addEventListener('click', onAddClick('LISTENING'));
    if (speakBtn) speakBtn.addEventListener('click', onAddClick('PRODUCTION'));

    document.addEventListener('click', function(e) {
      var el = e.target.closest('.word');
      if (!el) return;
      e.preventDefault();
      var lang = el.getAttribute('data-lang');
      var name = el.getAttribute('data-name');
      var info = attachWordModal._lookup(lang, name);
      if (!info) return;

      var opts = attachWordModal._options || {};
      currentCtx = opts.getCardContext ? (opts.getCardContext(el) || null) : null;
      currentLang = lang;
      currentWord = name;
      var show = currentCtx ? '' : 'none';
      if (readBtn) readBtn.style.display = show;
      if (listenBtn) listenBtn.style.display = show;
      if (speakBtn) speakBtn.style.display = show;
      document.getElementById('modalWordTitle').textContent = name;
      document.getElementById('modalDefinition').textContent = info.definition || '—';
      document.getElementById('modalRank').textContent = info.rank ? '#' + info.rank : '—';
      var pinyinRow = document.getElementById('modalPinyinRow');
      if (pinyinRow) {
        if (info.pinyin) {
          document.getElementById('modalPinyin').textContent = info.pinyin;
          pinyinRow.style.display = '';
        } else {
          pinyinRow.style.display = 'none';
        }
      }
      var fullLink = document.getElementById('modalFullInfo');
      if (info.fullHref) {
        fullLink.href = info.fullHref;
        fullLink.style.display = '';
      } else {
        fullLink.style.display = 'none';
      }
      var modal = new bootstrap.Modal(document.getElementById('wordModal'));
      modal.show();
      if (info.audioUrl) {
        currentAudio = new Audio(info.audioUrl);
        currentAudio.play().catch(function(){});
      } else {
        currentAudio = null;
        ttsSpeak(name, lang);
      }
    });
    var playBtn = document.getElementById('modalPlayBtn');
    if (playBtn) playBtn.addEventListener('click', function() {
      if (currentAudio) currentAudio.play().catch(function(){});
      else if (currentWord) ttsSpeak(currentWord, currentLang);
    });
  }

  /* Build a lookup function for pages backed by data/<lang>.json.
   * data.modal: {name -> {definition, rank, pinyin}}
   * data.pages: {name -> ...}  (presence controls "Full info" link visibility)
   */
  function makeLangLookup(data, lang) {
    var modal = data.modal || {};
    var pages = data.pages || {};
    return function(_lang, name) {
      var info = modal[name];
      if (!info) return null;
      var l = _lang || lang;
      return {
        definition: info.definition,
        rank: info.rank,
        pinyin: info.pinyin,
        audioUrl: wordAudioUrl(l, name),
        fullHref: (name in pages) ? wordHref(l, name) : null
      };
    };
  }

  var REVIEW_CAP = 50;
  function recordWordReviews(lang, segmented, pages) {
    if (!segmented || !segmented.length) return;
    var key = 'speakize.wordReviews.' + lang;
    var counts;
    try { counts = JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { counts = {}; }
    var seen = {};
    for (var i = 0; i < segmented.length; i++) {
      var w = segmented[i].toLowerCase();
      if (seen[w] || !(w in pages)) continue;
      seen[w] = true;
      counts[w] = Math.min((counts[w] || 0) + 1, REVIEW_CAP);
    }
    try { localStorage.setItem(key, JSON.stringify(counts)); } catch (e) {}
  }

  return {
    BUCKET_URL: BUCKET_URL,
    VIRTUAL_IDS: VIRTUAL_IDS,
    esc: esc,
    ttsSpeak: ttsSpeak,
    ttsBtnHtml: ttsBtnHtml,
    wordAudioUrl: wordAudioUrl,
    wordHref: wordHref,
    renderTokens: renderTokens,
    resolveDeck: resolveDeck,
    ensureModal: ensureModal,
    attachWordModal: attachWordModal,
    makeLangLookup: makeLangLookup,
    recordWordReviews: recordWordReviews,
    PLACEHOLDER_IMG: PLACEHOLDER_IMG,
    loadUserFlashcards: loadUserFlashcards,
    saveUserFlashcards: saveUserFlashcards,
    mergeUserDecks: mergeUserDecks,
    addUserFlashcard: addUserFlashcard
  };
})();
