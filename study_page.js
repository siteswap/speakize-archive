(function() {
  var S = window.Speakize;
  var container = document.getElementById('studyPageContainer');
  var params = new URLSearchParams(window.location.search);
  var lang = params.get('lang') || 'zh';
  var id = params.get('id') || 'all';

  fetch('data/' + lang + '.json')
    .then(function(r) { return r.json(); })
    .then(function(data) { start(data); })
    .catch(function(err) {
      container.innerHTML = '<div class="alert alert-danger m-4">Failed to load: ' + S.esc(err.message) + '</div>';
    });

  function start(data) {
    var deck = S.resolveDeck(data, id);
    if (!deck || !deck.phrases.length) {
      container.innerHTML = '<div class="alert alert-warning m-4">No flashcards in this deck.</div>';
      return;
    }
    var knownSet = new Set(data.known || []);
    var pages = data.pages || {};
    S.attachWordModal(S.makeLangLookup(data, lang));

    var backHref = 'deck.html?lang=' + lang + '&id=' + encodeURIComponent(id);
    container.innerHTML =
      '<br><h3 class="text-center">' + S.esc(deck.name) + '</h3>' +
      '<p class="text-center text-muted"><span id="studyPos">1</span> / ' + deck.phrases.length + '</p>' +
      '<div class="card m-3 text-center shadow"><div class="card-body">' +
        '<img id="studyImage" class="img-fluid rounded mb-2" style="display:none; max-height:200px;" alt="">' +
        '<br>' +
        '<p class="fs-4" id="studyText"></p>' +
        '<p><em id="studyTrans"></em></p>' +
        '<audio controls id="studyAudio"></audio>' +
        '<br><br>' +
        '<button class="btn btn-primary" id="btnAgain">Again</button> ' +
        '<button class="btn btn-primary" id="btnNext">Next</button>' +
      '</div></div>' +
      '<div class="text-center my-3"><a class="btn btn-outline-secondary" href="' + backHref + '">&larr; Back to Deck</a></div>';

    var idx = 0;
    function show(i) {
      var p = deck.phrases[i];
      var textEl = document.getElementById('studyText');
      if (p.segmented && p.segmented.length) {
        textEl.innerHTML = S.renderTokens(lang, p.segmented, pages, knownSet);
      } else {
        textEl.textContent = p.phrase || '';
      }
      document.getElementById('studyTrans').textContent = p.translation || '';
      document.getElementById('studyPos').textContent = (i + 1);
      var aud = document.getElementById('studyAudio');
      if (p.audio_url) { aud.src = p.audio_url; aud.style.display = ''; aud.play().catch(function(){}); }
      else { aud.removeAttribute('src'); aud.style.display = 'none'; }
      var img = document.getElementById('studyImage');
      if (p.image_url) { img.src = p.image_url; img.style.display = ''; }
      else { img.removeAttribute('src'); img.style.display = 'none'; }
    }
    document.getElementById('btnNext').addEventListener('click', function() {
      idx = (idx + 1) % deck.phrases.length;
      show(idx);
    });
    document.getElementById('btnAgain').addEventListener('click', function() {
      show(idx);
    });
    show(0);
  }
})();
