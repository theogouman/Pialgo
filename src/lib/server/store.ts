import "server-only";
import { env } from "./env";

/**
 * Petit stockage clé/valeur avec expiration, utilisé pour les codes OTP
 * (compteur de tentatives, anti-renvoi). En production, configure Upstash Redis
 * (ou Vercel KV, mêmes variables) : sans stockage partagé, le compteur de tentatives
 * ne serait pas fiable sur une plateforme serverless.
 */
export interface KVStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** SET uniquement si la clé n'existe pas. Renvoie true si posée. */
  setNX(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  incr(key: string, ttlSeconds: number): Promise<number>;
  del(key: string): Promise<void>;
}

class UpstashStore implements KVStore {
  constructor(private url: string, private token: string) {}

  private async cmd<T>(...args: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    const json = (await res.json()) as { result: T; error?: string };
    if (json.error) throw new Error(json.error);
    return json.result;
  }

  get(key: string) {
    return this.cmd<string | null>("GET", key);
  }
  async set(key: string, value: string, ttl: number) {
    await this.cmd("SET", key, value, "EX", ttl);
  }
  async setNX(key: string, value: string, ttl: number) {
    const r = await this.cmd<string | null>("SET", key, value, "EX", ttl, "NX");
    return r === "OK";
  }
  async incr(key: string, ttl: number) {
    const n = await this.cmd<number>("INCR", key);
    if (n === 1) await this.cmd("EXPIRE", key, ttl);
    return n;
  }
  async del(key: string) {
    await this.cmd("DEL", key);
  }
}

type Entry = { value: string; expires: number };

class MemoryStore implements KVStore {
  private map = new Map<string, Entry>();

  private read(key: string) {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.expires < Date.now()) {
      this.map.delete(key);
      return null;
    }
    return e;
  }
  async get(key: string) {
    return this.read(key)?.value ?? null;
  }
  async set(key: string, value: string, ttl: number) {
    this.map.set(key, { value, expires: Date.now() + ttl * 1000 });
  }
  async setNX(key: string, value: string, ttl: number) {
    if (this.read(key)) return false;
    await this.set(key, value, ttl);
    return true;
  }
  async incr(key: string, ttl: number) {
    const e = this.read(key);
    const n = (e ? Number(e.value) : 0) + 1;
    this.map.set(key, { value: String(n), expires: e?.expires ?? Date.now() + ttl * 1000 });
    return n;
  }
  async del(key: string) {
    this.map.delete(key);
  }
}

const g = globalThis as unknown as { __pialgoStore?: KVStore };

export function store(): KVStore {
  if (g.__pialgoStore) return g.__pialgoStore;
  const url = env("UPSTASH_REDIS_REST_URL") ?? env("KV_REST_API_URL");
  const token = env("UPSTASH_REDIS_REST_TOKEN") ?? env("KV_REST_API_TOKEN");
  if (url && token) {
    g.__pialgoStore = new UpstashStore(url, token);
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[otp] Pas de Redis configuré : compteur d'essais et usage unique limités à chaque instance " +
          "(la vérification du code, elle, fonctionne). Configurez UPSTASH_REDIS_REST_URL/TOKEN.",
      );
    }
    g.__pialgoStore = new MemoryStore();
  }
  return g.__pialgoStore;
}
