(function() {
  var S = window.Speakize;
  var LEGEND_HTML = "\n<div class=\"mb-3 text-center\">\n  <small class=\"text-muted\">\n    <span style=\"color:#fd7e14;\">&#9632;</span> Target word (due for review) &nbsp;\n    <span style=\"color:#a71d5d;\">&#9632;</span> Not in target range &nbsp;\n    &#9632; Known word\n  </small>\n</div>";

  var params = new URLSearchParams(window.location.search);
  var docId = params.get('id');
  var container = document.getElementById('reportsContainer');

  function renderError(msg) {
    container.innerHTML = '<div class="alert alert-warning">' + S.esc(msg) +
      '</div><a href="documents.html" class="btn btn-outline-primary">&larr; All Documents</a>';
  }

  function extractWords(phrases) {
    var counts = {};
    var firstPhrase = {};
    var total = 0;
    var tmp = document.createElement('div');
    (phrases || []).forEach(function(p, idx) {
      tmp.innerHTML = p.tokens_html || '';
      var anchors = tmp.querySelectorAll('.word');
      var seenInPhrase = {};
      for (var i = 0; i < anchors.length; i++) {
        var name = (anchors[i].getAttribute('data-name') || '').toLowerCase();
        if (!name) continue;
        counts[name] = (counts[name] || 0) + 1;
        total++;
        if (!(name in firstPhrase) && !seenInPhrase[name]) {
          firstPhrase[name] = idx;
          seenInPhrase[name] = true;
        }
      }
    });
    return {counts: counts, total: total, firstPhrase: firstPhrase};
  }

  function renderTable(doc, langData) {
    var lang = doc.lang;
    var pages = langData.pages || {};
    var knownSet = new Set(langData.known || []);
    var modal = langData.modal || {};
    var wordData = doc.wordData || {};
    var hasPinyin = (lang === 'zh');

    var extracted = extractWords(doc.phrases);
    var counts = extracted.counts;
    var total = extracted.total;
    var firstPhrase = extracted.firstPhrase;
    var phrases = doc.phrases || [];

    var words = [];
    for (var name in counts) {
      if (!counts.hasOwnProperty(name)) continue;
      var info = modal[name] || wordData[lang + '|' + name] || {};
      words.push({
        name: name,
        count: counts[name],
        definition: info.definition || '',
        pinyin: info.pinyin || '',
        rank: (pages[name] && pages[name].rank) || info.rank || null,
        inTop: name in pages
      });
    }
    words.sort(function(a, b) { return b.count - a.count || (a.rank || 1e9) - (b.rank || 1e9); });

    document.getElementById('reportTitle').textContent = doc.title;
    document.getElementById('reportSubtitle').textContent =
      'Words ranked by frequency in this document (' + total + ' word tokens, ' +
      words.length + ' unique).';

    var html = '<h5 class="mb-3">' + S.esc(doc.title) + ' (' + words.length + ' unique words)</h5>' + LEGEND_HTML;
    html += '<table class="table table-striped table-hover" id="reportsTable">';
    html += '<thead><tr><th>#</th><th>Count</th><th>Coverage%</th><th>Global Rank</th><th>Word</th>';
    if (hasPinyin) html += '<th>Pinyin</th>';
    html += '<th>Meaning</th><th>Example</th></tr></thead><tbody>';

    var cum = 0;
    for (var j = 0; j < words.length; j++) {
      var w = words[j];
      cum += w.count;
      var pct = total > 0 ? (cum / total * 100).toFixed(1) : '0.0';
      var color = w.inTop
        ? (knownSet.has(w.name) ? '' : 'color:#fd7e14;')
        : 'color:#a71d5d;';
      var wordCell = '<a href="#" class="word" style="' + color + 'text-decoration:none" ' +
                     'data-name="' + S.esc(w.name) + '" data-lang="' + lang + '">' + S.esc(w.name) + '</a>';
      var def = w.definition || '';
      if (def.length > 60) def = def.substring(0, 57) + '…';
      html += '<tr><td>' + (j + 1) + '</td><td>' + w.count + '</td><td>' + pct + '%</td>';
      html += '<td>' + (w.rank || '—') + '</td>';
      html += '<td>' + wordCell + '</td>';
      if (hasPinyin) html += '<td>' + S.esc(w.pinyin) + '</td>';
      html += '<td>' + S.esc(def) + '</td>';
      var exCell = '';
      var fpIdx = firstPhrase[w.name];
      if (fpIdx != null && phrases[fpIdx]) {
        var ex = phrases[fpIdx];
        exCell = ex.tokens_html || '';
        if (ex.translation) {
          exCell += ' <small class="text-muted">— ' + S.esc(ex.translation) + '</small>';
        }
      }
      html += '<td>' + exCell + '</td></tr>';
    }
    html += '</tbody></table>';
    html += '<div class="text-center my-4">' +
      '<a href="document.html?id=' + encodeURIComponent(docId) + '" class="btn btn-outline-primary">&larr; Back to Document</a></div>';
    container.innerHTML = html;

    S.attachWordModal(function(_lang, name) {
      var info = wordData[lang + '|' + name] || modal[name];
      if (!info) return null;
      return {
        definition: info.definition,
        rank: info.rank,
        pinyin: info.pinyin,
        audioUrl: info.audio || S.wordAudioUrl(lang, name),
        fullHref: (name in pages) ? S.wordHref(lang, name) : null
      };
    });

    document.title = doc.title + ' - Word Frequency';
  }

  function loadDoc(cb) {
    if (!docId) return renderError('No document id specified.');
    if (docId.indexOf('u-') === 0) {
      var userDocs;
      try { userDocs = JSON.parse(localStorage.getItem('speakize_user_docs') || '{}'); }
      catch (e) { userDocs = {}; }
      var udoc = userDocs[docId];
      if (!udoc) return renderError('User document ' + docId + ' not found.');
      return cb(udoc);
    }
    fetch('data/documents/' + encodeURIComponent(docId) + '.json')
      .then(function(r) { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then(cb)
      .catch(function() { renderError('Document ' + docId + ' not found.'); });
  }

  loadDoc(function(doc) {
    fetch('data/' + doc.lang + '.json')
      .then(function(r) { return r.json(); })
      .then(function(langData) { renderTable(doc, langData); })
      .catch(function(err) {
        container.innerHTML = '<div class="alert alert-danger">Failed to load language data: ' + S.esc(err.message) + '</div>';
      });
  });

  document.getElementById('reportSearch').addEventListener('input', function() {
    var q = this.value.toLowerCase();
    var rows = document.querySelectorAll('#reportsTable tbody tr');
    for (var i = 0; i < rows.length; i++) {
      rows[i].style.display = rows[i].textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
    }
  });
})();
