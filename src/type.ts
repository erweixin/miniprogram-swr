import'wechat-miniprogram';
/**
 * wechat mini program Page instance
 */
export type TPage = WechatMiniprogram.Page.Instance<WechatMiniprogram.Page.DataOption, WechatMiniprogram.Page.CustomOption>;

export type SwrOptions = {
  onSuccess?: (data: any) => void,
  onError?: (error: any) => void,
  deps?: any[],
  errorRetryTimes?: number,
  refreshOnShow?: boolean,
  refreshInterval?: number,
  keepPreviousData?: boolean,
  ttl?: number;
  retryLimit?: number;
  retryInterval?: number;
  optimisticData?: any;
  fireImmediately?: boolean;
}
/**
 * key: keyof TPage.data, fetcher 获取到的值会直接 setData 到 this.data[key] 上, 无需手动 setData
 * 而且 this.data[key] 的格式会是： {
 *   data: any,
 *   error: any,
 *   isLoading: boolean,
 *   isValidating: boolean,
 * }
 * 
 * options: {
 *  onSuccess: 数据获取成功的回调
 *  onError: 数据获取失败的回调
 *  deps: 依赖的变量, 依赖的变量变化时, 需要时 this.data 里声明的值，自动 observe, 当变化时会重新获取数据
 *  retryTimes: 重试次数 默认 3
 *  refreshOnShow: 是否在页面显示时自动刷新
 *  refreshInterval: 刷新间隔 默认 0
 *  keepPreviousData: 是否保留之前的数据 默认 false
 * }
 */