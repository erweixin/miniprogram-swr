import type { TPage, TSwr } from './type';

export const swr: TSwr = (page, baseKey) => {
  const test = page.data
  return {
    mutate: (data) => {
      page.setData({
        [data]: {
          data: data,
          error: null,
          isLoading: false,
          isValidating: false,
        }
      })
    }
  }

}