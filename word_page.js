(function() {
  var S = window.Speakize;
  var LEGEND_HTML = "\n<div class=\"mb-3 text-center\">\n  <small class=\"text-muted\">\n    <span style=\"color:#fd7e14;\">&#9632;</span> Target word (due for review) &nbsp;\n    <span style=\"color:#a71d5d;\">&#9632;</span> Not in target range &nbsp;\n    &#9632; Known word\n  </small>\n</div>";
  var LANG_NAMES = {zh: 'Chinese', es: 'Spanish'};

  function renderExamples(lang, examples, pages, knownSet) {
    if (!examples || examples.length === 0) {
      return '<p class="text-muted">No example sentences available.</p>';
    }
    var html = '';
    for (var i = 0; i < examples.length; i++) {
      var ex = examples[i];
      var img = ex.image_url ? '<img src="' + S.esc(ex.image_url) +
                '" class="img-fluid rounded-start mb-2" alt="">' : '';
      var trans = ex.translation ? '<p><em>' + S.esc(ex.translation) + '</em></p>' : '';
      var exText = (ex.segmented && ex.segmented.length) ? ex.segmented.join(lang === 'zh' ? '' : ' ') : '';
      var audio = ex.audio_url ? '<audio controls src="' + S.esc(ex.audio_url) + '"></audio>'
                  : (exText ? S.ttsBtnHtml(exText, lang) : '');
      var tokens = S.renderTokens(lang, ex.segmented || [], pages, knownSet);
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
      container.innerHTML = '<div class="alert alert-warning m-4">Word "' + S.esc(word) +
        '" is not in the top ' + Object.keys(data.pages).length + ' ' +
        (LANG_NAMES[lang] || lang) + ' words.</div>';
      return;
    }
    var knownSet = new Set(data.known || []);
    var langName = LANG_NAMES[lang] || lang;
    var defn = page.definition ? S.esc(page.definition) : '<em>not available</em>';
    var audioUrl = S.wordAudioUrl(lang, word);

    var zhInfo = '';
    if (lang === 'zh') {
      zhInfo = 'Written frequency rank: <b>#' + page.written_rank + '</b><br>' +
               'Hanzi radicals: <b>' + S.esc(page.radicals || '') + '</b><br>' +
               'As components: <b>' + S.esc(page.containing || '') + '</b><br>' +
               'Pinyin: <b>' + S.esc(page.pinyin || '') + '</b><br>' +
               'Hanzi written frequency rank: <b>' + S.esc(page.hanzi_ranks || '') + '</b><br>';
    }

    var examplesHtml = renderExamples(lang, page.examples, data.pages, knownSet);
    var numEx = (page.examples || []).length;

    container.innerHTML =
      '<div class="card m-3 text-center shadow">' +
        '<div class="card-header">' +
          '<a href="' + lang + '/index.html">&larr; ' + S.esc(langName) + ' Word List</a>' +
        '</div>' +
        '<div class="card-body">' +
          '<h1 class="display-1">' + S.esc(word) + '</h1><br>' +
          '<audio controls src="' + S.esc(audioUrl) + '"></audio><br><br>' +
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
    S.attachWordModal(S.makeLangLookup(data, lang));
  }

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
        '<div class="alert alert-danger m-4">Failed to load word data: ' + S.esc(err.message) + '</div>';
    });
})();
