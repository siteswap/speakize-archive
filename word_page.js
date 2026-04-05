(function() {
  var BUCKET_URL = "https://storage.googleapis.com/createflashcardapp.appspot.com";
  var LEGEND_HTML = "\n<div class=\"mb-3 text-center\">\n  <small class=\"text-muted\">\n    <span style=\"color:#fd7e14;\">&#9632;</span> Target word (due for review) &nbsp;\n    <span style=\"color:#a71d5d;\">&#9632;</span> Not in target range &nbsp;\n    &#9632; Known word\n  </small>\n</div>";
  var LANG_NAMES = {zh: 'Chinese', es: 'Spanish'};

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

  function renderExamples(lang, examples, pages, knownSet) {
    if (!examples || examples.length === 0) {
      return '<p class="text-muted">No example sentences available.</p>';
    }
    var html = '';
    for (var i = 0; i < examples.length; i++) {
      var ex = examples[i];
      var img = ex.image_url ? '<img src="' + esc(ex.image_url) +
                '" class="img-fluid rounded-start mb-2" alt="">' : '';
      var trans = ex.translation ? '<p><em>' + esc(ex.translation) + '</em></p>' : '';
      var audio = ex.audio_url ? '<audio controls src="' + esc(ex.audio_url) + '"></audio>' : '';
      var tokens = renderTokens(lang, ex.segmented || [], pages, knownSet);
      html += '<div class="card m-3 text-center shadow"><div class="card-body">' +
              img + '<p class="card-text">' + tokens + '</p>' + trans + audio +
              '</div></div>';
    }
    return html;
  }

  function renderPage(lang, word, data) {
    var wLower = word.toLowerCase();
    var page = data.pages[wLower];
    var container = document.getElementById('wordPageContainer');
    if (!page) {
      container.innerHTML = '<div class="alert alert-warning m-4">Word "' + esc(word) +
        '" is not in the top ' + Object.keys(data.pages).length + ' ' +
        (LANG_NAMES[lang] || lang) + ' words.</div>';
      return;
    }
    var knownSet = new Set(data.known || []);
    var langName = LANG_NAMES[lang] || lang;
    var defn = page.definition ? esc(page.definition) : '<em>not available</em>';
    var audioUrl = wordAudioUrl(lang, word);

    var zhInfo = '';
    if (lang === 'zh') {
      zhInfo = 'Written frequency rank: <b>#' + page.written_rank + '</b><br>' +
               'Hanzi radicals: <b>' + esc(page.radicals || '') + '</b><br>' +
               'As components: <b>' + esc(page.containing || '') + '</b><br>' +
               'Pinyin: <b>' + esc(page.pinyin || '') + '</b><br>' +
               'Hanzi written frequency rank: <b>' + esc(page.hanzi_ranks || '') + '</b><br>';
    }

    var examplesHtml = renderExamples(lang, page.examples, data.pages, knownSet);
    var numEx = (page.examples || []).length;

    container.innerHTML =
      '<div class="card m-3 text-center shadow">' +
        '<div class="card-header">' +
          '<a href="' + lang + '/index.html">&larr; ' + esc(langName) + ' Word List</a>' +
        '</div>' +
        '<div class="card-body">' +
          '<h1 class="display-1">' + esc(word) + '</h1><br>' +
          '<audio controls src="' + esc(audioUrl) + '"></audio><br><br>' +
          '<p class="card-text">' +
            'Meaning: <b>' + defn + '</b><br>' +
            'Spoken frequency rank: <b>#' + page.rank + '</b><br>' +
            'Spoken frequency per million: <b>' + page.wpm.toFixed(1) + '</b><br>' +
            zhInfo +
          '</p>' +
        '</div>' +
      '</div>' +
      '<br>' +
      LEGEND_HTML +
      '<div class="accordion" id="accordionExamples">' +
        '<div class="accordion-item">' +
          '<h2 class="accordion-header">' +
            '<button class="accordion-button" type="button" data-bs-toggle="collapse" ' +
                    'data-bs-target="#collapseOne" aria-expanded="true">' +
              'Examples by relevance (' + numEx + ')' +
            '</button>' +
          '</h2>' +
          '<div id="collapseOne" class="accordion-collapse collapse show">' +
            '<div class="accordion-body">' + examplesHtml + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.title = word + ' - ' + langName;
    window._wordData = data.modal;
    window._wordLang = lang;
    window._wordPages = data.pages;
  }

  function onWordClick(e) {
    var el = e.target.closest('.word');
    if (!el) return;
    e.preventDefault();
    var lang = el.getAttribute('data-lang');
    var name = el.getAttribute('data-name');
    var info = (window._wordData || {})[name];
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
    var pages = window._wordPages || {};
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
  var word = params.get('w') || '';
  if (!word) {
    document.getElementById('wordPageContainer').innerHTML =
      '<div class="alert alert-info m-4">Specify a word: <code>?lang=zh&amp;w=的</code></div>';
    return;
  }
  fetch('data/' + lang + '.json')
    .then(function(r) { return r.json(); })
    .then(function(data) { renderPage(lang, word, data); })
    .catch(function(err) {
      document.getElementById('wordPageContainer').innerHTML =
        '<div class="alert alert-danger m-4">Failed to load word data: ' + esc(err.message) + '</div>';
    });
})();
