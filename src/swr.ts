import type { TPage, TSwr } from './type';
const cache = new Map<string, any>();

export const swr: TSwr = (page, baseKey, fetcher, options) => {
  const { deps = [] } = options;
  const cacheKey = `${page.route}_${baseKey}`;
  if (!cache.has(cacheKey)) {
    cache.set(cacheKey, { data: undefined, isLoading: false, error: null });
  }
  // 初始化页面数据
  if (!page.data[baseKey]) {
    page.setData({
      [baseKey]: {
        data: cache.get(cacheKey).data,
        isLoading: cache.get(cacheKey).isLoading,
        error: cache.get(cacheKey).error,
      },
    });
  }

  // 订阅方法：页面数据同步
  const notify = () => {
    const state = cache.get(cacheKey);
    page.setData({
      [`${baseKey}.data`]: state.data,
      [`${baseKey}.isLoading`]: state.isLoading,
      [`${baseKey}.error`]: state.error,
    });
  };

  // 数据请求及更新
  const mutate = async () => {
    const state = cache.get(cacheKey);
    state.isLoading = true;
    notify();

    try {
      const newData = await fetcher();
      state.data = newData;
      state.error = null;
    } catch (err) {
      state.error = err;
    } finally {
      state.isLoading = false;
      notify();
    }
  };

  // 自动重新验证
  mutate();

  // 监听依赖变化
  const initWatcher = () => {
    deps.forEach((dep) => {
      const depKey = dep // 防止 key 冲突
      if (!page.watchers) page.watchers = {};
      if (!page.watchers[depKey]) {
        // 监听器未初始化
        Object.defineProperty(page.data, dep, {
          configurable: true,
          enumerable: true,
          get() {
            return this[`_${depKey}`];
          },
          set(newVal) {
            console.log(newVal)
            mutate()
            this[`_${depKey}`] = newVal;
            // const updatedDeps = deps.map((d) => page.data[d]);
            // observeDeps(updatedDeps); // 检测变化并重新绑定
          },
        });
      }
    });
  };
  
  initWatcher(); 
  return { mutate };
}