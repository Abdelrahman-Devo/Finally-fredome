/* FINAL FREEDOM - db.js : تخزين دائم IndexedDB مع نسخة احتياطية في localStorage */
(function (root) {
  'use strict';
  const NAME = 'final_freedom', STORE = 'kv', KEY = 'state', LS = 'ff_state_backup';
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!root.indexedDB) return rej(new Error('no idb'));
      const r = indexedDB.open(NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function load() {
    let v = null;
    try { const db = await open(); v = await new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get(KEY); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); } catch (e) { }
    if (!v) { try { const t = localStorage.getItem(LS); if (t) v = JSON.parse(t); } catch (e) { } }
    return v || null;
  }
  async function save(state) {
    try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) { }
    const db = await open();
    return new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(state, KEY); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }
  async function clear() { try { localStorage.removeItem(LS); } catch (e) { } try { const db = await open(); await new Promise(r => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(KEY); tx.oncomplete = r; }); } catch (e) { } }
  root.DB = { load, save, clear };
})(window);
