(function() {
  var S = window.Speakize;
  var TRANSLATION_PLACEHOLDER = '(translations not available in archive site)';
  var USER_DOCS_KEY = 'speakize_user_docs';
  var LANG_KEY = 'study_lang';
  var LANG_NAMES = {zh: 'Chinese', es: 'Spanish'};

  var titleEl = document.getElementById('addTextTitle');
  var bodyEl = document.getElementById('addTextBody');
  var statusEl = document.getElementById('addTextStatus');
  var saveBtn = document.getElementById('addTextSaveBtn');
  var form = document.getElementById('addTextForm');
  var heading = document.getElementById('addTextHeading');
  var langNote = document.getElementById('addTextLangNote');
  var navLangSel = document.getElementById('wordLookupLang');

  function currentLang() {
    var l = navLangSel ? navLangSel.value : localStorage.getItem(LANG_KEY);
    return (l === 'es') ? 'es' : 'zh';
  }

  function updateLangNote() {
    var l = currentLang();
    langNote.textContent = 'Current: ' + (LANG_NAMES[l] || l) + '. Change via the navbar selector.';
  }

  // Seed nav select from study_lang (same pattern as documents.html).
  if (navLangSel) {
    var saved = localStorage.getItem(LANG_KEY);
    if (saved === 'zh' || saved === 'es') navLangSel.value = saved;
    navLangSel.addEventListener('change', function() {
      localStorage.setItem(LANG_KEY, navLangSel.value);
      updateLangNote();
    });
  }
  updateLangNote();

  // Edit mode: ?id=u-xxx
  var params = new URLSearchParams(window.location.search);
  var editId = params.get('id');
  var editingDoc = null;
  if (editId && editId.indexOf('u-') === 0) {
    var all;
    try { all = JSON.parse(localStorage.getItem(USER_DOCS_KEY) || '{}'); }
    catch (e) { all = {}; }
    editingDoc = all[editId];
    if (editingDoc) {
      heading.textContent = 'Edit Text';
      titleEl.value = editingDoc.title || '';
      var srcText = editingDoc.source_text;
      if (!srcText && editingDoc.phrases) {
        srcText = editingDoc.phrases.map(function(p) {
          var tmp = document.createElement('div');
          tmp.innerHTML = p.tokens_html || '';
          return tmp.textContent || '';
        }).join('\n');
      }
      bodyEl.value = srcText || '';
      if (navLangSel && (editingDoc.lang === 'zh' || editingDoc.lang === 'es')) {
        navLangSel.value = editingDoc.lang;
        localStorage.setItem(LANG_KEY, editingDoc.lang);
        updateLangNote();
      }
    } else {
      statusEl.textContent = 'Document ' + editId + ' not found — saving will create a new entry.';
      editId = null;
    }
  } else {
    editId = null;
  }

  function segmentPhrase(lang, text) {
    if (lang === 'zh' && typeof Intl !== 'undefined' && Intl.Segmenter) {
      var seg = new Intl.Segmenter('zh', {granularity: 'word'});
      var out = [];
      var iter = seg.segment(text);
      for (var s of iter) {
        if (s.segment.trim()) out.push(s.segment);
      }
      return out;
    }
    return text.match(/[\p{L}\p{M}\p{N}]+|[^\s\p{L}\p{M}\p{N}]/gu) || [];
  }

  function buildDoc(lang, title, rawText, langData) {
    var lines = rawText.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(Boolean);
    var pages = langData.pages || {};
    var modal = langData.modal || {};
    var knownSet = new Set(langData.known || []);
    var phrases = [];
    var wordData = {};
    for (var i = 0; i < lines.length; i++) {
      var segmented = segmentPhrase(lang, lines[i]);
      var tokens_html = S.renderTokens(lang, segmented, pages, knownSet);
      phrases.push({tokens_html: tokens_html, translation: TRANSLATION_PLACEHOLDER, audio: null});
      for (var j = 0; j < segmented.length; j++) {
        var w = segmented[j].toLowerCase();
        var key = lang + '|' + w;
        if (wordData[key]) continue;
        var info = modal[w];
        if (!info) continue;
        wordData[key] = {
          definition: info.definition,
          rank: info.rank,
          pinyin: info.pinyin,
          audio: null,
          href: null,
          inTop: (w in pages)
        };
      }
    }
    return {
      title: title,
      lang: lang,
      youtube: null,
      phrases: phrases,
      wordData: wordData,
      source_text: rawText
    };
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var lang = currentLang();
    var title = titleEl.value.trim();
    var body = bodyEl.value;
    if (!title || !body.trim()) return;
    saveBtn.disabled = true;
    statusEl.textContent = 'Loading ' + lang + ' vocabulary...';
    fetch('data/' + lang + '.json')
      .then(function(r) { return r.json(); })
      .then(function(langData) {
        statusEl.textContent = 'Segmenting and saving...';
        var doc = buildDoc(lang, title, body, langData);
        if (doc.phrases.length === 0) {
          statusEl.textContent = 'No phrases found.';
          saveBtn.disabled = false;
          return;
        }
        var id = editId || ('u-' + Date.now());
        var all;
        try { all = JSON.parse(localStorage.getItem(USER_DOCS_KEY) || '{}'); }
        catch (err) { all = {}; }
        all[id] = doc;
        try {
          localStorage.setItem(USER_DOCS_KEY, JSON.stringify(all));
        } catch (err) {
          statusEl.textContent = 'Failed to save: ' + err;
          saveBtn.disabled = false;
          return;
        }
        window.location.href = 'document.html?id=' + encodeURIComponent(id);
      })
      .catch(function(err) {
        statusEl.textContent = 'Failed to load language data: ' + err;
        saveBtn.disabled = false;
      });
  });
})();
