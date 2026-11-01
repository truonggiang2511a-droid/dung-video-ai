// Lưu dự án + file video ngay trên máy khách (IndexedDB). Không gửi video lên máy chủ.
const DB = 'dungvideo';
const VER = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', {keyPath: 'id'});
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then((v) => (out = v));
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
const req = (r) => new Promise((res, rej) => {
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});

export const store = {
  async listProjects() {
    const all = await tx('projects', 'readonly', (s) => req(s.getAll()));
    return (all || []).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  },
  async getProject(id) {
    return tx('projects', 'readonly', (s) => req(s.get(id)));
  },
  async saveProject(p) {
    const clean = JSON.parse(JSON.stringify(p, (k, v) => (k.startsWith('_') ? undefined : v)));
    clean.updated = Date.now();
    return tx('projects', 'readwrite', (s) => req(s.put(clean)));
  },
  async deleteProject(p) {
    await tx('projects', 'readwrite', (s) => req(s.delete(p.id)));
    for (const src of Object.values(p.sources || {})) await this.deleteFile(src.fileKey);
  },
  async putFile(key, blob) {
    return tx('files', 'readwrite', (s) => req(s.put(blob, key)));
  },
  async getFile(key) {
    return tx('files', 'readonly', (s) => req(s.get(key)));
  },
  async deleteFile(key) {
    return tx('files', 'readwrite', (s) => req(s.delete(key)));
  },
  async persist() {
    try {
      if (navigator.storage?.persist) await navigator.storage.persist();
    } catch (e) {
      /* không bắt buộc */
    }
  },
};
