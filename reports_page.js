(function() {
  var S = window.Speakize;
  var LANG_NAMES = {zh: 'Chinese', es: 'Spanish'};

  var LEGEND_HTML = "\n<div class=\"mb-3 text-center\">\n  <small class=\"text-muted\">\n    <span style=\"color:#fd7e14;\">&#9632;</span> Target word (due for review) &nbsp;\n    <span style=\"color:#a71d5d;\">&#9632;</span> Not in target range &nbsp;\n    &#9632; Known word\n  </small>\n</div>";

  function loadReviewCounts(lang) {
    try { return JSON.parse(localStorage.getItem('speakize.wordReviews.' + lang)) || {}; } catch (e) { return {}; }
  }

  function renderTable(lang, data) {
    var pages = data.pages;
    var knownSet = new Set(data.known || []);
    var hasPinyin = (lang === 'zh');
    var reviewCounts = loadReviewCounts(lang);

    // Sort words by rank
    var words = [];
    for (var name in pages) {
      if (!pages.hasOwnProperty(name)) continue;
      words.push({name: name, info: pages[name]});
    }
    words.sort(function(a, b) { return a.info.rank - b.info.rank; });

    // Compute total wpm for coverage
    var totalWpm = 0;
    for (var i = 0; i < words.length; i++) totalWpm += words[i].info.wpm || 0;

    // Build header
    var html = '<h5 class="mb-3">' + S.esc(LANG_NAMES[lang] || lang) +
               ' (' + words.length + ')</h5>' + LEGEND_HTML;
    html += '<table class="table table-striped table-hover" id="reportsTable">';
    html += '<thead><tr><th>Rank</th><th>Coverage%</th><th>Reviews</th><th>Word</th>';
    if (hasPinyin) html += '<th>Pinyin</th>';
    html += '<th>Meaning</th><th>Example</th></tr></thead><tbody>';

    var cumWpm = 0;
    for (var j = 0; j < words.length; j++) {
      var w = words[j];
      var info = w.info;
      cumWpm += info.wpm || 0;
      var pct = totalWpm > 0 ? (cumWpm / totalWpm * 100).toFixed(1) : '0.0';
      var wordHref = 'word.html?lang=' + lang + '&w=' + encodeURIComponent(w.name);

      var rev = reviewCounts[w.name] || 0;
      html += '<tr><td>' + info.rank + '</td><td>' + pct + '%</td>';
      html += '<td>' + rev + '</td>';
      html += '<td><a href="' + wordHref + '">' + S.esc(w.name) + '</a></td>';
      if (hasPinyin) html += '<td>' + S.esc(info.pinyin || '') + '</td>';

      // Truncate definition to first entry
      var def = info.definition || '';
      if (def.length > 60) def = def.substring(0, 57) + '…';
      html += '<td>' + S.esc(def) + '</td>';

      // Example phrase with highlighted tokens
      var exCell = '';
      if (info.examples && info.examples.length) {
        var ex = info.examples[0];
        if (ex.segmented && ex.segmented.length) {
          exCell = S.renderTokens(lang, ex.segmented, pages, knownSet);
          if (ex.translation) {
            exCell += ' <small class="text-muted">— ' + S.esc(ex.translation) + '</small>';
          }
        }
      }
      html += '<td>' + exCell + '</td></tr>';
    }

    html += '</tbody></table>';
    return html;
  }

  // Determine language from selector
  var sel = document.getElementById('wordLookupLang');
  var lang = (sel && sel.value) || localStorage.getItem('study_lang') || 'zh';
  if (lang !== 'zh' && lang !== 'es') lang = 'zh';

  var container = document.getElementById('reportsContainer');
  container.innerHTML = '<p class="text-muted">Loading…</p>';

  function load(lang) {
    container.innerHTML = '<p class="text-muted">Loading…</p>';
    fetch('data/' + lang + '.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        container.innerHTML = renderTable(lang, data);
        S.attachWordModal(S.makeLangLookup(data, lang));
      })
      .catch(function(err) {
        container.innerHTML = '<div class="alert alert-danger">Failed to load data: ' + S.esc(err.message) + '</div>';
      });
  }

  // Listen for language changes
  if (sel) {
    sel.addEventListener('change', function() {
      load(sel.value);
    });
  }

  // Filter
  document.getElementById('reportSearch').addEventListener('input', function() {
    var q = this.value.toLowerCase();
    var rows = document.querySelectorAll('#reportsTable tbody tr');
    for (var i = 0; i < rows.length; i++) {
      var text = rows[i].textContent.toLowerCase();
      rows[i].style.display = text.indexOf(q) >= 0 ? '' : 'none';
    }
  });

  load(lang);
})();
