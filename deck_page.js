(function() {
  var BUCKET_URL = "https://storage.googleapis.com/createflashcardapp.appspot.com";
  var LEGEND_HTML = "\n<div class=\"mb-3 text-center\">\n  <small class=\"text-muted\">\n    <span style=\"color:#fd7e14;\">&#9632;</span> Target word (due for review) &nbsp;\n    <span style=\"color:#a71d5d;\">&#9632;</span> Not in target range &nbsp;\n    &#9632; Known word\n  </small>\n</div>";
  var VIRTUAL_IDS = {
    all: {label: 'All Flashcards', type: null},
    reading: {label: 'All Reading Flashcards', type: 'READING'},
    listening: {label: 'All Listening Flashcards', type: 'LISTENING'},
    speaking: {label: 'All Speaking Flashcards', type: 'PRODUCTION'}
  };

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
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

  function cardBadge(type) {
    if (type === 'READING') return '<span class="badge bg-danger" title="Read"><i class="bi bi-book"></i></span>';
    if (type === 'LISTENING') return '<span class="badge bg-warning" title="Listen"><i class="bi bi-speaker"></i></span>';
    return '<span class="badge bg-success" title="Speak"><i class="bi bi-mic"></i></span>';
  }

  function renderPhraseCards(lang, deck, pages, knownSet) {
    if (!deck.phrases.length) {
      return '<p class="text-muted text-center">No flashcards in this deck.</p>';
    }
    var html = '<div class="row row-cols-1 row-cols-md-2 g-4">';
    for (var i = 0; i < deck.phrases.length; i++) {
      var p = deck.phrases[i];
      var tokens = (p.segmented && p.segmented.length)
        ? renderTokens(lang, p.segmented, pages, knownSet)
        : esc(p.phrase || '');
      var img = p.image_url ? '<img src="' + esc(p.image_url) +
                '" class="img-fluid rounded mb-2" alt="" style="max-height:120px;">' : '';
      var trans = p.translation ? '<p class="text-muted"><em>' + esc(p.translation) + '</em></p>' : '';
      var audio = p.audio_url ? '<br><audio controls src="' + esc(p.audio_url) +
                  '" style="width:100%; max-width:250px;"></audio>' : '';
      var deckTag = deck.virtual && p.deck_name
        ? '<div><small class="text-muted">from deck: <a href="deck.html?lang=' + lang +
          '&id=' + p.deck_id + '">' + esc(p.deck_name) + '</a></small></div>'
        : '';
      html += '<div class="col"><div class="card shadow"><div class="card-body">' +
              '<h5 class="card-title">' + cardBadge(p.card_type) + '&nbsp;&nbsp;' + tokens + '</h5>' +
              img + trans + audio + deckTag + '</div></div></div>';
    }
    return html + '</div>';
  }

  function renderPage(lang, id, data) {
    var deck = resolveDeck(data, id);
    var container = document.getElementById('deckPageContainer');
    if (!deck) {
      container.innerHTML = '<div class="alert alert-warning m-4">Deck not found.</div>';
      return;
    }
    var knownSet = new Set(data.known || []);
    var studyHref = 'study.html?lang=' + lang + '&id=' + encodeURIComponent(id);
    var header = '<br><h2 class="text-center">' + esc(deck.name) +
      ' <small class="text-muted">(' + deck.phrases.length + ' cards)</small></h2>';
    var buttons =
      '<div class="d-grid gap-2 col-md-6 mx-auto my-3">' +
        '<a href="' + studyHref + '" class="btn btn-primary shadow">Study Now</a>' +
        '<a href="exports.html" class="btn btn-outline-primary shadow">Export as Anki / MP3 / MP4</a>' +
      '</div>';
    var back = '<div class="text-center my-4">' +
      '<a href="flashcards.html" class="btn btn-outline-primary">&larr; All Flashcards</a></div>';
    container.innerHTML = header + buttons + LEGEND_HTML +
      renderPhraseCards(lang, deck, data.pages, knownSet) + back;
    document.title = deck.name + ' - Flashcards';
    window._modalWordData = data.modal;
    window._modalPages = data.pages;
  }

  function onWordClick(e) {
    var el = e.target.closest('.word');
    if (!el) return;
    e.preventDefault();
    var lang = el.getAttribute('data-lang');
    var name = el.getAttribute('data-name');
    var info = (window._modalWordData || {})[name];
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
    var pages = window._modalPages || {};
    if (name in pages) {
      fullLink.href = wordHref(lang, name);
      fullLink.style.display = '';
    } else {
      fullLink.style.display = 'none';
    }
    var modal = new bootstrap.Modal(document.getElementById('wordModal'));
    modal.show();
    var audio = new Audio(wordAudioUrl(lang, name));
    audio.play().catch(function(){});
    window._modalAudio = audio;
  }
  document.addEventListener('click', onWordClick);
  var playBtn = document.getElementById('modalPlayBtn');
  if (playBtn) playBtn.addEventListener('click', function() {
    if (window._modalAudio) window._modalAudio.play().catch(function(){});
  });

  var params = new URLSearchParams(window.location.search);
  var lang = params.get('lang') || 'zh';
  var id = params.get('id') || 'all';
  fetch('data/' + lang + '.json')
    .then(function(r) { return r.json(); })
    .then(function(data) { renderPage(lang, id, data); })
    .catch(function(err) {
      document.getElementById('deckPageContainer').innerHTML =
        '<div class="alert alert-danger m-4">Failed to load deck data: ' + esc(err.message) + '</div>';
    });
})();
