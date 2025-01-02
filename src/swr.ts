import { cacheManager } from './cache-manager';
import type { SwrOptions, TPage } from './type';


const mutateData = async <T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options: Partial<SwrOptions> = {}
) => {
  const {
    retryLimit = 3,
    retryInterval = 1000,
    optimisticData,
    onSuccess,
    onError,
    fireImmediately,
  } = options;

  const state = cacheManager.getState<T>(cacheKey);

  if (optimisticData !== undefined) {
    cacheManager.setState<T>(cacheKey, {
      data: optimisticData,
      isLoading: true
    });
  } else {
    cacheManager.setState<T>(cacheKey, { isLoading: true });
  }

  const attempt = async (retryCount: number): Promise<T> => {
    try {
      const newData = await fetcher();
      onSuccess && onSuccess(newData);
      cacheManager.setState<T>(cacheKey, {
        data: newData,
        error: null,
        isLoading: false,
        retryCount: 0
      });
      return newData;
    } catch (error) {
      if (retryCount < retryLimit) {
        await new Promise(resolve => setTimeout(resolve, retryInterval));
        return attempt(retryCount + 1);
      }
      onError && onError(error);
      cacheManager.setState<T>(cacheKey, {
        error: error as Error,
        isLoading: false,
        retryCount: retryCount
      });
      throw error;
    }
  };

  return attempt(state.retryCount);
};

export const preload = <T>(route: string, baseKey: string, fetcher: () => Promise<T>) => {
  const cacheKey = cacheManager.generateKey(route, baseKey);
  return mutateData<T>(cacheKey, fetcher);
};

export const swr = <T>(page: TPage, baseKey: string, fetcher: () => Promise<T>, options: SwrOptions = {}) => {
  const {
    deps = [],
    ttl = cacheManager['DEFAULT_TTL'],
    retryLimit = 3,
    retryInterval = 1000,
    optimisticData,
    onSuccess,
    onError,
    fireImmediately = true
  } = options;

  const cacheKey = cacheManager.generateKey(page.route, baseKey);

  // 使用防抖来优化高频更新
  const debounce = (fn: Function, delay: number) => {
    let timer: number;
    return (...args: any[]) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const notify = () => new Promise((resolve) => {
    const currentState = cacheManager.getState(cacheKey);
    page.setData({
      [`${baseKey}.data`]: currentState.data,
      [`${baseKey}.isLoading`]: currentState.isLoading,
      [`${baseKey}.error`]: currentState.error,
    }, () => {
      resolve(undefined);
    })
  });

  // 初始化页面数据
  if (!page.data[baseKey]) {
    const state = cacheManager.getState(cacheKey);
    page.setData({
      [baseKey]: {
        data: state.data,
        isLoading: state.isLoading,
        error: state.error,
      },
    });
  }

  const mutate = async (optimisticData?: any) => {
    try {
      await mutateData(cacheKey, fetcher, {
        retryLimit,
        retryInterval,
        optimisticData,
        onSuccess,
        onError
      });
    } finally {
      await notify();
    }
  };

  const batchMutate = async (mutations: Array<{
    key: string;
    fetcher: () => Promise<any>;
    optimisticData?: any;
  }>) => {
    const updates = mutations.map(({ key, fetcher, optimisticData }) => ({
      key: cacheManager.generateKey(page.route, key),
      fetcher,
      optimisticData
    }));

    try {
      await Promise.all(
        updates.map(({ key, fetcher, optimisticData }) =>
          mutateData(key, fetcher, {
            retryLimit,
            retryInterval,
            optimisticData,
            onSuccess,
            onError
          })
        )
      );
    } finally {
      notify();
    }
  };

  const initWatcher = () => {
    if (!page.watchers) {
      page.watchers = {};
    }

    const debouncedMutate = debounce(mutate, 300);

    deps.forEach((dep) => {
      if (!page.watchers[dep]) {
        Object.defineProperty(page.data, dep, {
          configurable: true,
          enumerable: true,
          get() {
            return this[`_${dep}`];
          },
          set(newVal) {
            this[`_${dep}`] = newVal;
            debouncedMutate();
          },
        });
        page.watchers[dep] = true;
      }
    });
  };

  const shouldRevalidate = () => {
    return cacheManager.isExpired(cacheKey, ttl);
  };

  // 处理页面卸载
  const originalOnUnload = page.onUnload;
  page.onUnload = function() {
    cacheManager.clearPageCache(page.route);
    if (originalOnUnload) {
      originalOnUnload.call(page);
    }
  };

  initWatcher();

  if (shouldRevalidate() && fireImmediately) {
    mutate();
  }

  return {
    mutate,
    batchMutate,
    getCurrentState: () => cacheManager.getState(cacheKey),
    revalidate: () => mutate(),
  };
};