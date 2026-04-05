(function() {
  var S = window.Speakize;
  var params = new URLSearchParams(window.location.search);
  var docId = params.get('id');
  var container = document.getElementById('documentPageContainer');

  function renderError(msg) {
    container.innerHTML = '<div class="container p-5 text-center"><p class="text-muted">' +
      S.esc(msg) + '</p>' +
      '<a href="documents.html" class="btn btn-outline-primary">&larr; All Documents</a></div>';
  }

  function renderDoc(doc, wordData) {
    var html = '<br><h2 class="card-title text-center">' +
      S.esc(doc.title) +
      ' <small class="text-muted">(Document)</small></h2>';

    if (doc.youtube) {
      html += '<div class="embed-responsive embed-responsive-16by9" style="max-width: 100%;">' +
        '<iframe class="embed-responsive-item" style="width:100%; aspect-ratio:16/9;" src="' +
        S.esc(doc.youtube) + '" title="YouTube video" allowfullscreen></iframe></div><br>';
    }

    html += '<div class="mb-3 text-center"><small class="text-muted">' +
      '<span style="color:#fd7e14;">&#9632;</span> Target word (due for review) &nbsp;' +
      '<span style="color:#a71d5d;">&#9632;</span> Not in target range &nbsp;' +
      '&#9632; Known word</small></div>' +
      '<table class="table table-borderless"><tbody>';

    var spaceTokens = doc.lang !== 'zh';
    (doc.phrases || []).forEach(function(p) {
      var firstTd = p.audio
        ? '<button type="button" class="btn btn-secondary btn-sm phrase-play" data-src="' +
            S.esc(p.audio) + '"><i class="bi bi-play-fill"></i></button>'
        : '';
      var tokens = spaceTokens ? p.tokens_html.replace(/<\/a><a /g, '</a> <a ') : p.tokens_html;
      html += '<tr><td>' + firstTd + '</td><td><div>' + tokens + '</div>' +
        '<p><em>' + S.esc(p.translation) + '</em></p></td></tr>';
    });

    html += '</tbody></table><br><div class="text-center">' +
      '<a href="documents.html" class="btn btn-outline-primary">&larr; All Documents</a></div><br><br>';

    container.innerHTML = html;
    document.title = doc.title + ' - Speakize Archive';

    S.attachWordModal(function(lang, name) {
      var info = wordData[lang + '|' + name];
      if (!info) return null;
      return {
        definition: info.definition,
        rank: info.rank,
        pinyin: info.pinyin,
        audioUrl: info.audio || S.wordAudioUrl(lang, name),
        fullHref: info.inTop ? (info.href || S.wordHref(lang, name)) : null
      };
    });

    container.querySelectorAll('.phrase-play').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var audio = document.getElementById('phraseAudio');
        audio.src = this.getAttribute('data-src');
        audio.play().catch(function(){});
      });
    });
  }

  if (!docId) {
    renderError('No document id specified.');
    return;
  }

  fetch('data/documents.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var doc = data.documents[docId];
      if (!doc) {
        renderError('Document ' + docId + ' not found.');
        return;
      }
      renderDoc(doc, doc.wordData || {});
    })
    .catch(function(err) {
      renderError('Failed to load document data: ' + err);
    });
})();
