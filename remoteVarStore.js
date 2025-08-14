import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://ebnqhovfhgfrfxzexdxj.supabase.co",
  process.env.SUPABASE_TOKEN
);

export const remoteJsonStore = {
  folder: "storage",
  fileName: "vars.json",
  _cache: null,
  _cacheTime: 0,
  _cacheTTL: 5000,
  _dirty: false,

  // ---- Serialization / Deserialization ----
  _deepSerialize(obj) {
    if (obj instanceof Map) {
      return { "\u2060": Array.from(obj.entries()).map(([k, v]) => [this._deepSerialize(k), this._deepSerialize(v)]) };
    }
    if (obj instanceof Set) {
      return { "\u2061": Array.from(obj).map(v => this._deepSerialize(v)) };
    }
    if (Array.isArray(obj)) return obj.map(v => this._deepSerialize(v));
    if (obj && typeof obj === "object") {
      const serialized = {};
      for (const [k, v] of Object.entries(obj)) {
        serialized[k] = this._deepSerialize(v);
      }
      return serialized;
    }
    return obj;
  },

  _deepRestore(obj) {
    if (obj && typeof obj === "object") {
      if (obj["\u2060"]) {
        const m = new Map();
        for (const [k, v] of obj["\u2060"]) {
          m.set(this._deepRestore(k), this._deepRestore(v));
        }
        return this._wrapMap(m);
      }
      if (obj["\u2061"]) {
        const s = new Set();
        for (const v of obj["\u2061"]) {
          s.add(this._deepRestore(v));
        }
        return this._wrapSet(s);
      }
      if (Array.isArray(obj)) return obj.map(v => this._deepRestore(v));
      const restored = {};
      for (const [k, v] of Object.entries(obj)) {
        restored[k] = this._deepRestore(v);
      }
      return this._wrapObject(restored);
    }
    return obj;
  },

  // ---- Proxy wrappers (track dirty, don't modify data) ----
  _wrapObject(obj) {
    const self = this;
    return new Proxy(obj, {
      set(target, key, value) {
        target[key] = value; // keep original value
        self._dirty = true;
        return true;
      },
      deleteProperty(target, key) {
        delete target[key];
        self._dirty = true;
        return true;
      }
    });
  },

  _wrapMap(map) {
    const self = this;
    return new Proxy(map, {
  get(target, prop) {
    const value = target[prop];
    if (typeof value === "function") {
      return function (...args) {
        const result = value.apply(target, args); // bind to target
        // mark dirty only for modifying methods
        if (["set", "delete", "clear"].includes(prop)) {
          self._dirty = true;
        }
        return result;
      };
    }
    return value;
  }
});


  },
_wrapSet(set) {
  const self = this;
  return new Proxy(set, {
    get(target, prop) {
      const value = target[prop];

      if (typeof value === "function") {
        // Wrap all functions so 'this' points to the original Set
        return function (...args) {
          const result = value.apply(target, args);

          // Mark dirty only for modifying methods
          if (["add", "delete", "clear"].includes(prop)) {
            self._dirty = true;
          }

          return result;
        };
      }

      return value;
    }
  });
},

  // ---- Load / Save ----
  async load(force = false) {
    if (!force && this._cache && Date.now() - this._cacheTime < this._cacheTTL) return this._cache;

    const { data, error } = await supabase.storage.from(this.folder).download(this.fileName);
    if (error) {
      if (error.statusCode === "404") {
        this._cache = this._wrapObject({});
        return this._cache;
      }
      console.error(`Failed to download ${this.fileName}:`, error);
      throw error;
    }

    const text = await data.text();
    try {
      const parsed = JSON.parse(text);
      this._cache = this._deepRestore(parsed);
    } catch {
      this._cache = this._wrapObject({});
    }

    this._cacheTime = Date.now();
    return this._cache;
  },

  async save() {
    if (!this._cache || !this._dirty) return;
    const json = JSON.stringify(this._deepSerialize(this._cache));
    const { error } = await supabase.storage
      .from(this.folder)
      .upload(this.fileName, new Blob([json]), { upsert: true });
    if (error) console.error(`Failed to upload ${this.fileName}:`, error);
    else {
      this._dirty = false;
      this._cacheTime = Date.now();
    }
  },

  // ---- Convenience methods ----
  async setVar(key, value) {
    if (!this._cache) await this.load();
    this._cache[key] = value;
    this._dirty = true;
    await this.save();
  },

  async deleteVar(key) {
    if (!this._cache) await this.load();
    delete this._cache[key];
    this._dirty = true;
    await this.save();
  },

  async clear() {
    this._cache = this._wrapObject({});
    this._dirty = true;
    await this.save();
  }
};

// ---- Export a ready-to-use live object ----
export let remoteVars = await remoteJsonStore.load();