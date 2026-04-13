(function() {
  var DB_NAME = 'speakize-archive';
  var STORE = 'exports';
  var VERSION = 1;

  function openDb() {
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = function() {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var os = db.createObjectStore(STORE, { keyPath: 'id' });
          os.createIndex('lang', 'lang', { unique: false });
        }
      };
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { reject(req.error); };
    });
  }

  function tx(mode) {
    return openDb().then(function(db) {
      return db.transaction(STORE, mode).objectStore(STORE);
    });
  }

  function save(opts) {
    var record = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      deckName: opts.deckName || 'Untitled',
      lang: opts.lang || '',
      thumbnailUrl: opts.thumbnailUrl || null,
      createdAt: new Date().toISOString(),
      size: opts.blob ? opts.blob.size : 0,
      blob: opts.blob,
    };
    return tx('readwrite').then(function(store) {
      return new Promise(function(resolve, reject) {
        var req = store.add(record);
        req.onsuccess = function() { resolve(record.id); };
        req.onerror = function() { reject(req.error); };
      });
    }).then(function(id) {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(function() {});
      }
      return id;
    });
  }

  function list() {
    return tx('readonly').then(function(store) {
      return new Promise(function(resolve, reject) {
        var req = store.getAll();
        req.onsuccess = function() {
          var rows = (req.result || []).map(function(r) {
            return {
              id: r.id,
              deckName: r.deckName,
              lang: r.lang,
              thumbnailUrl: r.thumbnailUrl,
              createdAt: r.createdAt,
              size: r.size,
            };
          });
          rows.sort(function(a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
          resolve(rows);
        };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  function getBlob(id) {
    return tx('readonly').then(function(store) {
      return new Promise(function(resolve, reject) {
        var req = store.get(id);
        req.onsuccess = function() { resolve(req.result ? req.result.blob : null); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  function remove(id) {
    return tx('readwrite').then(function(store) {
      return new Promise(function(resolve, reject) {
        var req = store.delete(id);
        req.onsuccess = function() { resolve(); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  window.SpeakizeLocalExports = {
    save: save,
    list: list,
    getBlob: getBlob,
    delete: remove,
  };
})();
