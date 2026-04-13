(function() {
  var MODEL_ID = 1607392319;
  var DECK_ID_BASE = 2059400110;

  var FRONT_TMPL = '<center><font size="+4">{{plaintext_phrase}}</font><br>{{image_url}}<br>{{front_audio}}</center>';
  var BACK_TMPL = '<center>{{FrontSide}}<hr id="answer"><br><br>{{back_audio}}<br><font size="+4">{{annotated_phrase}}</font><br><br><font size="+2"><em>{{translation}}</em></font><br><br><font size="+2">{{link}}</font></center>';

  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\r?\n/g, ' ');
  }
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function annotateSentence(lang, segmented, pages) {
    if (!segmented || !segmented.length) return '';
    var out = [];
    for (var i = 0; i < segmented.length; i++) {
      var tok = segmented[i];
      var entry = pages && pages[tok];
      if (!entry) { out.push(escHtml(tok)); continue; }
      var lines = [];
      if (lang === 'zh' && entry.pinyin) lines.push('Pinyin: ' + entry.pinyin);
      if (entry.definition) lines.push('Meaning: ' + String(entry.definition).trim());
      if (entry.rank != null) lines.push('Spoken frequency rank: #' + entry.rank);
      var title = escAttr(lines.join('\n'));
      out.push('<abbr title="' + title + '" style="text-decoration:none">' + escHtml(tok) + '</abbr>');
    }
    return out.join(lang === 'zh' ? '' : ' ');
  }

  function sanitizeFilename(url) {
    try {
      var u = new URL(url);
      var base = u.pathname.split('/').pop() || ('media_' + Math.random().toString(36).slice(2));
      return decodeURIComponent(base).replace(/[^A-Za-z0-9._-]/g, '_');
    } catch (e) {
      return 'media_' + Math.random().toString(36).slice(2) + '.mp3';
    }
  }

  function fetchAsUint8(url) {
    return fetch(url, { mode: 'cors' })
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer();
      })
      .then(function(buf) { return new Uint8Array(buf); });
  }

  function deckIdFrom(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
    return DECK_ID_BASE + Math.abs(h);
  }

  function sixDigitSuffix() {
    return String(Date.now()).slice(-6);
  }

  function buildModel() {
    return new Model({
      id: MODEL_ID,
      name: 'Speakize phrase',
      flds: [
        { name: 'plaintext_phrase' },
        { name: 'annotated_phrase' },
        { name: 'translation' },
        { name: 'link' },
        { name: 'front_audio' },
        { name: 'back_audio' },
        { name: 'image_url' }
      ],
      tmpls: [{ name: 'Card 1', qfmt: FRONT_TMPL, afmt: BACK_TMPL }],
      req: [[0, 'any', [0, 4]]],
      css: '.card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; } abbr { cursor: help; border-bottom: 1px dotted #888; }'
    });
  }

  function progress(el, msg) { if (el) el.textContent = msg; }

  function exportDeck(deck, lang, pageData, uiOpts) {
    uiOpts = uiOpts || {};
    var progressEl = uiOpts.progressEl;
    var btns = uiOpts.buttons || [];
    btns.forEach(function(b) { b.disabled = true; });

    var pages = pageData && pageData.pages ? pageData.pages : {};
    var phrases = deck.phrases || [];
    var model = buildModel();
    var ankiDeck = new Deck(deckIdFrom(deck.name || 'Speakize'), (deck.name || 'Speakize'));
    var pkg = new Package();
    pkg.addDeck(ankiDeck);

    var urls = {};
    for (var i = 0; i < phrases.length; i++) {
      if (phrases[i].audio_url) urls[phrases[i].audio_url] = 'audio';
      if (phrases[i].image_url) urls[phrases[i].image_url] = 'image';
    }
    var urlList = Object.keys(urls);
    var total = urlList.length;
    var done = 0, failures = 0;
    var results = {};
    var usedNames = {};

    progress(progressEl, 'Fetching media 0/' + total + '…');
    var tracked = urlList.map(function(url) {
      return fetchAsUint8(url).then(
        function(data) {
          var name = sanitizeFilename(url);
          if (usedNames[name]) name = Date.now().toString(36) + '_' + name;
          usedNames[name] = true;
          pkg.addMedia(data, name);
          results[url] = { ok: true, name: name };
        },
        function() { results[url] = { ok: false }; failures++; }
      ).then(function() {
        done++;
        progress(progressEl, 'Fetching media ' + done + '/' + total + (failures ? ' (' + failures + ' failed)' : '') + '…');
      });
    });

    return Promise.all(tracked).then(function() {
      for (var j = 0; j < phrases.length; j++) {
        var p = phrases[j];
        var segmented = p.segmented && p.segmented.length ? p.segmented : [p.phrase || ''];
        var annotated = annotateSentence(lang, segmented, pages);
        var translation = p.translation || '';
        var cardType = p.card_type || 'READING';

        var audioRes = p.audio_url ? results[p.audio_url] : null;
        var soundTag = '';
        if (audioRes && audioRes.ok) soundTag = '[sound:' + audioRes.name + ']';
        else if (p.audio_url) soundTag = '<audio controls src="' + escAttr(p.audio_url) + '"></audio>';

        var imgRes = p.image_url ? results[p.image_url] : null;
        var imgSrc = imgRes && imgRes.ok ? imgRes.name : (p.image_url || '');
        var imgTag = imgSrc ? '<img src="' + escAttr(imgSrc) + '" style="max-height:220px;">' : '';

        var plaintext = '';
        if (cardType === 'READING') plaintext = p.phrase || '';
        else if (cardType === 'PRODUCTION') plaintext = translation;

        var frontAudio = cardType === 'LISTENING' ? soundTag : '';
        var backAudio = cardType === 'LISTENING' ? '' : soundTag;
        var link = '<a href="word.html?lang=' + escAttr(lang) + '&w=' + encodeURIComponent(p.phrase || '') + '">speakize</a>';

        ankiDeck.addNote(model.note([
          plaintext, annotated, escHtml(translation), link, frontAudio, backAudio, imgTag
        ]));
      }

      progress(progressEl, 'Building .apkg…');
      var filename = 'speakize_' + (deck.name || 'deck').replace(/[^\w\- ]+/g, '_') + '_' + sixDigitSuffix() + '.apkg';
      pkg.writeToFile(filename);
      progress(progressEl, failures
        ? 'Downloaded ' + filename + ' (' + failures + '/' + total + ' media files failed — check CORS on bucket).'
        : 'Downloaded ' + filename + '.');
    }).catch(function(err) {
      progress(progressEl, 'Export failed: ' + (err && err.message ? err.message : err));
      throw err;
    }).finally(function() {
      btns.forEach(function(b) { b.disabled = false; });
    });
  }

  window.SpeakizeAnki = { exportDeck: exportDeck };
})();
