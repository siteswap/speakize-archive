(function() {
  var S = window.Speakize;
  var LEGEND_HTML = "\n<div class=\"mb-3 text-center\">\n  <small class=\"text-muted\">\n    <span style=\"color:#fd7e14;\">&#9632;</span> Target word (due for review) &nbsp;\n    <span style=\"color:#a71d5d;\">&#9632;</span> Not in target range &nbsp;\n    &#9632; Known word\n  </small>\n</div>";

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
        ? S.renderTokens(lang, p.segmented, pages, knownSet)
        : S.esc(p.phrase || '');
      var img = p.image_url ? '<img src="' + S.esc(p.image_url) +
                '" class="img-fluid rounded mb-2" alt="" style="max-height:120px;">' : '';
      var trans = p.translation ? '<p class="text-muted"><em>' + S.esc(p.translation) + '</em></p>' : '';
      var audio = p.audio_url ? '<br><audio controls src="' + S.esc(p.audio_url) +
                  '" style="width:100%; max-width:250px;"></audio>' : '';
      var deckTag = deck.virtual && p.deck_name
        ? '<div><small class="text-muted">from deck: <a href="deck.html?lang=' + lang +
          '&id=' + p.deck_id + '">' + S.esc(p.deck_name) + '</a></small></div>'
        : '';
      html += '<div class="col"><div class="card shadow"><div class="card-body">' +
              '<h5 class="card-title">' + cardBadge(p.card_type) + '&nbsp;&nbsp;' + tokens + '</h5>' +
              img + trans + audio + deckTag + '</div></div></div>';
    }
    return html + '</div>';
  }

  function wireExportButtons(deck, lang, data) {
    var ankiBtn = document.getElementById('exportAnkiBtn');
    var mp3Btn = document.getElementById('exportMp3Btn');
    var mp4Btn = document.getElementById('exportMp4Btn');
    var progressEl = document.getElementById('exportProgress');

    ankiBtn.addEventListener('click', function() {
      if (typeof Package === 'undefined' || !window.SQL) {
        progressEl.textContent = 'Anki libraries still loading, try again in a moment.';
        return;
      }
      window.SpeakizeAnki.exportDeck(deck, lang, data, {
        progressEl: progressEl,
        buttons: [ankiBtn]
      });
    });

    fetch('data/known_exports.json')
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(known) {
        if (!known) return;
        var entry = (known[lang] || {})[deck.name];
        if (entry && entry.mp3) { mp3Btn.href = entry.mp3; mp3Btn.classList.remove('d-none'); }
        if (entry && entry.mp4) { mp4Btn.href = entry.mp4; mp4Btn.classList.remove('d-none'); }
      })
      .catch(function() {});
  }

  function renderPage(lang, id, data) {
    var deck = S.resolveDeck(data, id);
    var container = document.getElementById('deckPageContainer');
    if (!deck) {
      container.innerHTML = '<div class="alert alert-warning m-4">Deck not found.</div>';
      return;
    }
    var knownSet = new Set(data.known || []);
    var studyHref = 'study.html?lang=' + lang + '&id=' + encodeURIComponent(id);
    var header = '<br><h2 class="text-center">' + S.esc(deck.name) +
      ' <small class="text-muted">(' + deck.phrases.length + ' cards)</small></h2>';
    var buttons =
      '<div class="d-grid gap-2 col-md-6 mx-auto my-3">' +
        '<a href="' + studyHref + '" class="btn btn-primary shadow">Study Now</a>' +
        '<div class="btn-group shadow" role="group" aria-label="Export">' +
          '<button type="button" id="exportAnkiBtn" class="btn btn-outline-primary">' +
            '<i class="bi bi-download"></i> Anki (.apkg)</button>' +
          '<a id="exportMp3Btn" class="btn btn-outline-primary d-none" download>' +
            '<i class="bi bi-music-note"></i> MP3</a>' +
          '<a id="exportMp4Btn" class="btn btn-outline-primary d-none" download>' +
            '<i class="bi bi-film"></i> MP4</a>' +
        '</div>' +
        '<div id="exportProgress" class="text-muted small text-center"></div>' +
      '</div>';
    var back = '<div class="text-center my-4">' +
      '<a href="flashcards.html" class="btn btn-outline-primary">&larr; All Flashcards</a></div>';
    container.innerHTML = header + buttons + LEGEND_HTML +
      renderPhraseCards(lang, deck, data.pages, knownSet) + back;
    document.title = deck.name + ' - Flashcards';
    S.attachWordModal(S.makeLangLookup(data, lang));
    wireExportButtons(deck, lang, data);
  }

  var params = new URLSearchParams(window.location.search);
  var lang = params.get('lang') || 'zh';
  var id = params.get('id') || 'all';
  fetch('data/' + lang + '.json')
    .then(function(r) { return r.json(); })
    .then(function(data) { renderPage(lang, id, data); })
    .catch(function(err) {
      document.getElementById('deckPageContainer').innerHTML =
        '<div class="alert alert-danger m-4">Failed to load deck data: ' + S.esc(err.message) + '</div>';
    });
})();
