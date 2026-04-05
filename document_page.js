(function() {
  var params = new URLSearchParams(window.location.search);
  var docId = params.get('id');
  var container = document.getElementById('documentPageContainer');

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, function(c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
    });
  }

  function renderError(msg) {
    container.innerHTML = '<div class="container p-5 text-center"><p class="text-muted">' +
      escapeHtml(msg) + '</p>' +
      '<a href="documents.html" class="btn btn-outline-primary">&larr; All Documents</a></div>';
  }

  function renderDoc(doc, wordData) {
    var html = '<br><h2 class="card-title text-center">' +
      escapeHtml(doc.title) +
      ' <small class="text-muted">(Document)</small></h2>';

    if (doc.youtube) {
      html += '<div class="embed-responsive embed-responsive-16by9" style="max-width: 100%;">' +
        '<iframe class="embed-responsive-item" style="width:100%; aspect-ratio:16/9;" src="' +
        escapeHtml(doc.youtube) + '" title="YouTube video" allowfullscreen></iframe></div><br>';
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
            escapeHtml(p.audio) + '"><i class="bi bi-play-fill"></i></button>'
        : '';
      var tokens = spaceTokens ? p.tokens_html.replace(/<\/a><a /g, '</a> <a ') : p.tokens_html;
      html += '<tr><td>' + firstTd + '</td><td><div>' + tokens + '</div>' +
        '<p><em>' + escapeHtml(p.translation) + '</em></p></td></tr>';
    });

    html += '</tbody></table><br><div class="text-center">' +
      '<a href="documents.html" class="btn btn-outline-primary">&larr; All Documents</a></div><br><br>';

    container.innerHTML = html;
    document.title = doc.title + ' - Speakize Archive';

    // Attach word modal handler
    var wordAudio = new Audio();
    container.addEventListener('click', function(e) {
      var el = e.target.closest('.word');
      if (!el) return;
      e.preventDefault();
      var lang = el.getAttribute('data-lang');
      var name = el.getAttribute('data-name');
      var info = wordData[lang + '|' + name];
      if (!info) return;
      document.getElementById('modalWordTitle').textContent = name;
      document.getElementById('modalDefinition').textContent = info.definition || '—';
      document.getElementById('modalRank').textContent = info.rank ? '#' + info.rank : '—';
      var pinyinEl = document.getElementById('modalPinyin');
      var pinyinRow = document.getElementById('modalPinyinRow');
      if (pinyinRow) {
        if (info.pinyin) {
          pinyinEl.textContent = info.pinyin;
          pinyinRow.style.display = '';
        } else {
          pinyinRow.style.display = 'none';
        }
      }
      var fullLink = document.getElementById('modalFullInfo');
      if (info.inTop) {
        fullLink.href = info.href;
        fullLink.style.display = '';
      } else {
        fullLink.style.display = 'none';
      }
      var modal = new bootstrap.Modal(document.getElementById('wordModal'));
      modal.show();
      if (info.audio) {
        wordAudio.src = info.audio;
        wordAudio.play().catch(function(){});
      }
    });
    var playBtn = document.getElementById('modalPlayBtn');
    if (playBtn) playBtn.addEventListener('click', function() {
      wordAudio.play().catch(function(){});
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
