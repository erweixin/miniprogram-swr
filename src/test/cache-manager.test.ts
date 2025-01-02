import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { cacheManager } from '../cache-manager';

describe('CacheManager', () => {
  beforeEach(() => {
    // Clear cache before each test
    cacheManager['cache'].clear();
    if (cacheManager['cleanupInterval']) {
      clearInterval(cacheManager['cleanupInterval']);
      cacheManager['cleanupInterval'] = null;
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateKey', () => {
    test('should generate correct key format', () => {
      const key = cacheManager.generateKey('home', 'userData');
      expect(key).toBe('home_userData');
    });
  });

  describe('getState', () => {
    test('should create new state if key does not exist', () => {
      const state = cacheManager.getState('newKey');
      expect(state).toEqual({
        data: undefined,
        isValidating: false,
        error: null,
        timestamp: expect.any(Number),
        retryCount: 0,
        byInit: true
      });
    });

    test('should return existing state if key exists', () => {
      const initialState = {
        data: 'testData',
        isValidating: false,
        error: null,
        timestamp: Date.now(),
        retryCount: 0,
        byInit: true
      };
      cacheManager['cache'].set('existingKey', initialState);
      const state = cacheManager.getState('existingKey');
      expect(state).toEqual(initialState);
    });
  });

  describe('setState', () => {
    test('should update existing state partially', () => {
      const key = 'updateKey';
      cacheManager.getState(key);
      const updatedState = cacheManager.setState(key, {
        data: 'newData',
        isValidating: true
      });

      expect(updatedState).toMatchObject({
        data: 'newData',
        isValidating: true,
        error: null,
        retryCount: 0
      });
      expect(updatedState.timestamp).toBeGreaterThan(0);
    });

    test('should start cleanup interval when adding first item', () => {
      const spy = vi.spyOn(cacheManager as any, 'startCleanupInterval');
      cacheManager.setState('key', { data: 'test' });
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('deleteState', () => {
    test('should remove state from cache', () => {
      const key = 'deleteKey';
      cacheManager.getState(key);
      expect(cacheManager['cache'].has(key)).toBe(true);
      
      cacheManager.deleteState(key);
      expect(cacheManager['cache'].has(key)).toBe(false);
    });

    test('should stop cleanup interval when cache becomes empty', () => {
      const key = 'deleteKey';
      cacheManager.setState(key, { data: 'test' });
      expect(cacheManager['cleanupInterval']).not.toBeNull();

      cacheManager.deleteState(key);
      expect(cacheManager['cleanupInterval']).toBeNull();
    });
  });

  describe('clearPageCache', () => {
    test('should clear all cache entries for specific page', () => {
      const page = 'home';
      cacheManager.setState(cacheManager.generateKey(page, 'data1'), { data: 'test1' });
      cacheManager.setState(cacheManager.generateKey(page, 'data2'), { data: 'test2' });
      cacheManager.setState(cacheManager.generateKey('other', 'data3'), { data: 'test3' });

      cacheManager.clearPageCache(page);

      expect(cacheManager['cache'].has('home_data1')).toBe(false);
      expect(cacheManager['cache'].has('home_data2')).toBe(false);
      expect(cacheManager['cache'].has('other_data3')).toBe(true);
    });
  });

  describe('cleanup', () => {
    test('should remove expired items', () => {
      vi.useFakeTimers();
      const key = 'expiredKey';
      cacheManager.setState(key, { data: 'test' });
      
      // Move forward in time past TTL
      vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes
      
      cacheManager['cleanup']();
      expect(cacheManager['cache'].has(key)).toBe(false);
    });

    test('should keep non-expired items', () => {
      vi.useFakeTimers();
      const key = 'nonExpiredKey';
      cacheManager.setState(key, { data: 'test' });
      
      // Move forward but not past TTL
      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
      
      cacheManager['cleanup']();
      expect(cacheManager['cache'].has(key)).toBe(true);
    });
  });

  describe('isExpired', () => {
    test('should return true for expired items', () => {
      vi.useFakeTimers();
      const key = 'expiredKey';
      cacheManager.setState(key, { data: 'test' });
      
      vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes
      
      expect(cacheManager.isExpired(key)).toBe(true);
    });

    test('should return false for non-expired items', () => {
      vi.useFakeTimers();
      const key = 'nonExpiredKey';
      cacheManager.setState(key, { data: 'test' });
      
      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
      
      expect(cacheManager.isExpired(key)).toBe(false);
    });

    test('should respect custom TTL', () => {
      vi.useFakeTimers();
      const key = 'customTTL';
      const customTTL = 2 * 60 * 1000; // 2 minutes
      cacheManager.setState(key, { data: 'test' });
      
      vi.advanceTimersByTime(3 * 60 * 1000); // 3 minutes
      
      expect(cacheManager.isExpired(key, customTTL)).toBe(true);
    });
  });
});