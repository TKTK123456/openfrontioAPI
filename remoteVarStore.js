import { createClient } from '@supabase/supabase-js'
const supabase = createClient("https://ebnqhovfhgfrfxzexdxj.supabase.co", process.env.SUPABASE_TOKEN)
export const remoteJsonStore = {
  folder: "storage",
  fileName: "vars.json",
  _cache: null,
  _cacheTime: 0,
  _cacheTTL: 5000,
  _dirty: false,

  _deepRestore(obj) {
    if (obj && typeof obj === "object") {
      if (obj["\u2060"]) { // Map marker
        return this._wrapMap(new Map(obj["\u2060"].map(([k, v]) => [this._deepRestore(k), this._deepRestore(v)])));
      }
      if (obj["\u2061"]) { // Set marker
        return this._wrapSet(new Set(obj["\u2061"].map(v => this._deepRestore(v))));
      }
      if (Array.isArray(obj)) {
        return obj.map(v => this._deepRestore(v));
      }
      const restored = {};
      for (const [k, v] of Object.entries(obj)) {
        restored[k] = this._deepRestore(v);
      }
      return this._wrapObject(restored);
    }
    return obj;
  },

  _deepSerialize(obj) {
    if (obj instanceof Map) {
      return { "\u2060": Array.from(obj.entries()).map(([k, v]) => [this._deepSerialize(k), this._deepSerialize(v)]) };
    }
    if (obj instanceof Set) {
      return { "\u2061": Array.from(obj).map(v => this._deepSerialize(v)) };
    }
    if (Array.isArray(obj)) {
      return obj.map(v => this._deepSerialize(v));
    }
    if (obj && typeof obj === "object") {
      const serialized = {};
      for (const [k, v] of Object.entries(obj)) {
        serialized[k] = this._deepSerialize(v);
      }
      return serialized;
    }
    return obj;
  },

  _wrapObject(obj) {
    return new Proxy(obj, {
      set: (target, key, value) => {
        target[key] = this._deepRestore(value);
        this._dirty = true;
        return true;
      },
      deleteProperty: (target, key) => {
        delete target[key];
        this._dirty = true;
        return true;
      }
    });
  },

  _wrapMap(map) {
    const self = this;
    return new Proxy(map, {
      get(target, prop) {
        if (prop === "set") {
          return (key, value) => {
            self._dirty = true;
            return target.set(self._deepRestore(key), self._deepRestore(value));
          };
        }
        if (prop === "delete" || prop === "clear") {
          return (...args) => {
            self._dirty = true;
            return target[prop](...args);
          };
        }
        return target[prop];
      }
    });
  },

  _wrapSet(set) {
    const self = this;
    return new Proxy(set, {
      get(target, prop) {
        if (prop === "add" || prop === "delete" || prop === "clear") {
          return (...args) => {
            self._dirty = true;
            return target[prop](...args.map(v => self._deepRestore(v)));
          };
        }
        return target[prop];
      }
    });
  },

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
    const json = JSON.stringify(this._deepSerialize(this._cache)); // compact
    const { error } = await supabase.storage.from(this.folder).upload(this.fileName, new Blob([json]), { upsert: true });
    if (error) console.error(`Failed to upload ${this.fileName}:`, error);
    else {
      this._dirty = false;
      this._cacheTime = Date.now();
    }
  },

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
export const remoteVars = await remoteJsonStore.load()