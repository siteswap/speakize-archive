(function() {
  var BUCKET_URL = "https://storage.googleapis.com/createflashcardapp.appspot.com";
  var VIRTUAL_IDS = {
    all: {label: 'All Flashcards', type: null},
    reading: {label: 'All Reading Flashcards', type: 'READING'},
    listening: {label: 'All Listening Flashcards', type: 'LISTENING'},
    speaking: {label: 'All Speaking Flashcards', type: 'PRODUCTION'}
  };

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function resolveDeck(data, id) {
    if (VIRTUAL_IDS.hasOwnProperty(id)) {
      var v = VIRTUAL_IDS[id];
      var phrases = [];
      for (var i = 0; i < data.decks.length; i++) {
        var d = data.decks[i];
        for (var j = 0; j < d.phrases.length; j++) {
          var p = d.phrases[j];
          if (v.type === null || p.card_type === v.type) phrases.push(p);
        }
      }
      return {name: v.label, phrases: phrases};
    }
    var numId = parseInt(id, 10);
    for (var k = 0; k < data.decks.length; k++) {
      if (data.decks[k].id === numId) return {name: data.decks[k].name, phrases: data.decks[k].phrases};
    }
    return null;
  }

  var container = document.getElementById('studyPageContainer');
  var params = new URLSearchParams(window.location.search);
  var lang = params.get('lang') || 'zh';
  var id = params.get('id') || 'all';

  fetch('data/' + lang + '.json')
    .then(function(r) { return r.json(); })
    .then(function(data) { start(data); })
    .catch(function(err) {
      container.innerHTML = '<div class="alert alert-danger m-4">Failed to load: ' + esc(err.message) + '</div>';
    });

  function start(data) {
    var deck = resolveDeck(data, id);
    if (!deck || !deck.phrases.length) {
      container.innerHTML = '<div class="alert alert-warning m-4">No flashcards in this deck.</div>';
      return;
    }
    var backHref = 'deck.html?lang=' + lang + '&id=' + encodeURIComponent(id);
    container.innerHTML =
      '<br><h3 class="text-center">' + esc(deck.name) + '</h3>' +
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
      document.getElementById('studyText').textContent = p.phrase || '';
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
