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
            '<span class="btn btn-outline-danger disabled"><i class="bi bi-book"></i> Read</span>' +
            '<span class="btn btn-outline-warning disabled"><i class="bi bi-speaker"></i> Listen</span>' +
            '<span class="btn btn-outline-success disabled"><i class="bi bi-mic"></i> Speak</span>' +
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
      if (data.decks[k].id === numId) {
        var d2 = data.decks[k];
        return {id: numId, name: d2.name, phrases: d2.phrases, virtual: false, is_shared: d2.is_shared};
      }
    }
    return null;
  }

  function ensureModal() {
    if (document.getElementById('wordModal')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = MODAL_HTML;
    document.body.appendChild(wrap.firstElementChild);
  }

  var _attached = false;
  function attachWordModal(lookup) {
    ensureModal();
    if (_attached) { attachWordModal._lookup = lookup; return; }
    _attached = true;
    attachWordModal._lookup = lookup;
    var currentAudio = null;
    var currentLang = null;
    var currentWord = null;

    document.addEventListener('click', function(e) {
      var el = e.target.closest('.word');
      if (!el) return;
      e.preventDefault();
      var lang = el.getAttribute('data-lang');
      var name = el.getAttribute('data-name');
      var info = attachWordModal._lookup(lang, name);
      if (!info) return;
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
      currentLang = lang;
      currentWord = name;
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
    recordWordReviews: recordWordReviews
  };
})();
