interface CacheItem<T = any> {
  data: T;
  isValidating: boolean;
  error: Error | null;
  timestamp: number;
  retryCount: number;
  byInit: boolean;
}

class CacheManager {
  private cache: Map<string, CacheItem>;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5分钟
  private cleanupInterval: number | null = null;

  constructor() {
    this.cache = new Map();
  }

  private startCleanupInterval() {
    if (this.cleanupInterval === null && this.cache.size > 0) {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    }
  }

  private stopCleanupInterval() {
    if (this.cleanupInterval && this.cache.size === 0) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.DEFAULT_TTL) {
        this.cache.delete(key);
      }
    }
    this.stopCleanupInterval();
  }

  generateKey(page: string, baseKey: string): string {
    return `${page}_${baseKey}`;
  }

  getState<T>(key: string): CacheItem<T> {
    if (!this.cache.has(key)) {
      this.cache.set(key, {
        data: undefined,
        isValidating: false,
        error: null,
        timestamp: Date.now(),
        retryCount: 0,
        byInit: true,
      });
    }
    return this.cache.get(key)!;
  }

  setState<T>(key: string, newState: Partial<CacheItem<T>>) {
    const currentState = this.getState(key);
    this.cache.set(key, {
      ...currentState,
      ...newState,
      timestamp: Date.now(),
      byInit: false,
    });
    this.startCleanupInterval();
    return this.cache.get(key)!;
  }

  deleteState(key: string) {
    this.cache.delete(key);
    this.stopCleanupInterval();
  }

  clearPageCache(pageRoute: string) {
    for (const [key] of this.cache.entries()) {
      if (key.startsWith(pageRoute)) {
        this.cache.delete(key);
      }
    }
    this.stopCleanupInterval();
  }

  isExpired(key: string, ttl: number = this.DEFAULT_TTL): boolean {
    const state = this.cache.get(key);
    if (!state || state.byInit) {
      return true;
    }
    return Date.now() - state.timestamp > ttl;
  }
}

export const cacheManager = new CacheManager();