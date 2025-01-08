# MiniProgram SWR

[![npm](https://img.shields.io/npm/v/miniprogram-swr)](https://www.npmjs.com/package/miniprogram-swr)
[![npm](https://img.shields.io/npm/dm/miniprogram-swr)](https://www.npmjs.com/package/miniprogram-swr)
[![GitHub](https://img.shields.io/github/license/erweixin/miniprogram-swr)](https://img.shields.io/github/license/erweixin/miniprogram-swr)

MiniProgram SWR 是一个用于微信小程序的数据请求和缓存管理工具，提供了简单易用的 API 来处理数据的获取、缓存和重新验证。

## 功能

- **数据缓存**：通过缓存管理器缓存数据，减少不必要的网络请求。
- **自动重试**：在请求失败时自动重试，支持自定义重试次数和间隔。
- **依赖监听**：监听依赖项的变化，自动重新验证数据。
- **乐观更新**：支持乐观更新，在请求完成前更新 UI。
- **批量更新**：支持批量更新多个数据源。
- **防抖处理**：防止高频更新导致的性能问题。

## 安装

```bash
npm install miniprogram-swr
```

## 使用

```javascript
import { swr, preload } from 'miniprogram-swr';

// 在页面的 onLoad 方法中初始化
Page({
  onLoad() {
    const { mutate, batchMutate, getCurrentState, revalidate } = swr(this, 'dataKey', fetcher, {
      deps: ['dep1', 'dep2'],
      ttl: 60000,
      retryLimit: 3,
      retryInterval: 1000,
      optimisticData: { ... },
      onSuccess: (data) => { ... },
      onError: (error) => { ... },
      fireImmediately: true,
    });
  }
});
```
```html
返回结果和状态会自动挂在到 this.data.dataKey 中，可以在 wxml 中直接使用。
<!-- 在 wxml 中使用数据 -->
<view>{{ dataKey.data }}</view>
<view>{{ dataKey.error }}</view>
<view>{{ dataKey.isValidating }}</view>
```

## API
### swr(page, baseKey, fetcher, options)
初始化 SWR 实例。

- page：当前页面实例。
- baseKey：缓存键的基础部分， 返回值和结果会自动挂载至 this.data.baseKey 上。
- fetcher：数据获取函数，返回一个 Promise。
- options：配置选项。
  * deps：依赖项数组，当依赖项变化时重新验证数据，需要是 this.data 中的值。
  * ttl：缓存的有效时间（毫秒）。
  * retryLimit：请求失败时的重试次数。
  * retryInterval：请求失败时的重试间隔（毫秒）。
  * optimisticData：乐观更新的数据。
  * onSuccess：请求成功时的回调函数。
  * onError：请求失败时的回调函数。
  * fireImmediately：是否在初始化时立即请求数据。
- preload(route, baseKey, fetcher) 预加载数据。
  * route：页面路由。
  * baseKey：缓存键的基础部分。
  * fetcher：数据获取函数，返回一个 Promise。