import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { swr, preload } from '../swr';
import { cacheManager } from '../cache-manager';
import { set } from 'lodash-es';

// Mock WX Page implementation
class MockPage {
  route: string;
  data: Record<string, any>;
  watchers: Record<string, boolean>;
  onUnload: () => void;

  constructor(route: string) {
    this.route = route;
    this.data = {};
    this.watchers = {};
    this.onUnload = () => {};
  }

  setData(data: Record<string, any>, callback?: () => void) {
    for (const path in data) {
      set(this.data, path, data[path]);
    }
    callback?.();
  }
}

describe('SWR and Preload', () => {
  let mockPage: MockPage;
  const mockFetcher = vi.fn();
  const baseKey = 'testData';

  beforeEach(() => {
    mockPage = new MockPage('test-page');
    cacheManager['cache'].clear();
    if (cacheManager['cleanupInterval']) {
      clearInterval(cacheManager['cleanupInterval']);
      cacheManager['cleanupInterval'] = null;
    }
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('preload', () => {
    test('should preload data into cache', async () => {
      const expectedData = { value: 'test' };
      mockFetcher.mockResolvedValueOnce(expectedData);

      await preload('test-page', baseKey, mockFetcher);

      const cacheKey = cacheManager.generateKey('test-page', baseKey);
      const cachedState = cacheManager.getState(cacheKey);
      
      expect(cachedState.data).toEqual(expectedData);
      expect(cachedState.isLoading).toBe(false);
      expect(cachedState.error).toBeNull();
    });
  });

  describe('swr', () => {
    test('should initialize page data', () => {
      swr(mockPage as any, baseKey, mockFetcher);
      
      expect(mockPage.data[baseKey]).toEqual({
        data: undefined,
        isLoading: false,
        error: null,
      });
    });

    test('should handle successful data fetching', async () => {
      vi.useFakeTimers()
      const expectedData = { value: 'test' };
      mockFetcher.mockResolvedValueOnce(expectedData);
      const { mutate } = swr(mockPage as any, baseKey, mockFetcher, {
        onSuccess: (data) => {
          console.log('onSuccess',data)
        },
        ttl: 0,
        fireImmediately: false
      });
      
      await mutate();
      expect(mockPage.data[baseKey].data).toEqual(expectedData);
      expect(mockPage.data[baseKey].isLoading).toBe(false);
      expect(mockPage.data[baseKey].error).toBeNull();
    });

    test('should handle optimistic updates', async () => {
      const optimisticData = { value: 'optimistic' };
      const finalData = { value: 'final' };
      mockFetcher.mockResolvedValueOnce(finalData);

      const { mutate } = swr(mockPage  as any, baseKey, mockFetcher, {
        fireImmediately: false
      });
      const mutatePromise = mutate(optimisticData);

      await mutatePromise;

      // Check final update
      expect(mockPage.data[baseKey].data).toEqual(finalData);
      expect(mockPage.data[baseKey].isLoading).toBe(false);
    });

    test('should retry on failure', async () => {
      vi.useFakeTimers();
      mockFetcher
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce({ value: 'success' });

      const { mutate } = swr(mockPage as any, baseKey, mockFetcher, {
        retryInterval: 1000,
        retryLimit: 3,
        fireImmediately: false
      });

      const mutatePromise = mutate();
      
      // First attempt fails
      expect(mockFetcher).toHaveBeenCalledTimes(1);
      
      // Advance time for second attempt
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockFetcher).toHaveBeenCalledTimes(2);
      
      // Advance time for third attempt
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockFetcher).toHaveBeenCalledTimes(3);
      
      await mutatePromise;
      
      expect(mockPage.data[baseKey].data).toEqual({ value: 'success' });
      expect(mockPage.data[baseKey].isLoading).toBe(false);
    });

    test('should handle batch mutations', async () => {
      const mutations = [
        {
          key: 'data1',
          fetcher: vi.fn().mockResolvedValue({ value: 1 }),
          optimisticData: { value: 'opt1' }
        },
        {
          key: 'data2',
          fetcher: vi.fn().mockResolvedValue({ value: 2 }),
          optimisticData: { value: 'opt2' }
        }
      ];

      const { batchMutate } = swr(mockPage as any, baseKey, mockFetcher);
      await batchMutate(mutations);

      const state1 = cacheManager.getState(cacheManager.generateKey(mockPage.route, 'data1'));
      const state2 = cacheManager.getState(cacheManager.generateKey(mockPage.route, 'data2'));

      expect(state1.data).toEqual({ value: 1 });
      expect(state2.data).toEqual({ value: 2 });
    });

    test('should handle dependency changes with debounce', async () => {
      vi.useFakeTimers();
      const deps = ['dep1'];
      swr(mockPage as any, baseKey, mockFetcher, { deps, fireImmediately: false });

      // Trigger multiple rapid updates
      mockPage.data.dep1 = 'value1';
      mockPage.data.dep1 = 'value2';
      mockPage.data.dep1 = 'value3';

      expect(mockFetcher).not.toHaveBeenCalled();

      // Advance time past debounce delay
      await vi.advanceTimersByTimeAsync(300);
      
      expect(mockFetcher).toHaveBeenCalledTimes(1);
    });

    test('should clear cache on page unload', () => {
      swr(mockPage as any, baseKey, mockFetcher);
      
      const cacheKey = cacheManager.generateKey(mockPage.route, baseKey);
      cacheManager.setState(cacheKey, { data: 'test' });

      mockPage.onUnload();

      expect(cacheManager['cache'].has(cacheKey)).toBe(false);
    });

    test('should revalidate when cache is expired', () => {
      vi.useFakeTimers();
      const ttl = 5 * 60 * 1000; // 5 minutes

      swr(mockPage as any, baseKey, mockFetcher, { ttl, fireImmediately: false });
      expect(mockFetcher).not.toHaveBeenCalled();

      vi.advanceTimersByTime(ttl + 1000);

      swr(mockPage as any, baseKey, mockFetcher, { ttl });
      expect(mockFetcher).toHaveBeenCalled();
    });
  });
});