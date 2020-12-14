import { QueryClient } from '../core'
import { dehydrate, hydrate } from '../hydration'

interface LocalStorageCache {
  timestamp: number
  buster: string
  cacheState: any
}

interface Options {
  /** The key to use when storing the cache to localstorage */
  localStorageKey?: string
  /** To avoid localstorage spamming,
   * pass a time in ms to throttle saving the cache to disk */
  throttleTime?: number
  /** The max-allowed age of the cache.
   * If a persisted cache is found that is older than this
   * time, it will be discarded */
  maxAge?: number
  /** A unique string that can be used to forcefully
   * invalidate existing caches if they do not share the same buster string */
  buster?: string
}

interface Storage {
  getItem: (key: string, callback?: Function) => Promise<string>
  setItem: (key: string, value: string, callback?: Function) => Promise<void>
  removeItem: (key: string, callback?: Function) => Promise<void>
}

export function persistWithLocalStorage(
  queryClient: QueryClient,
  {
    localStorageKey = `REACT_QUERY_OFFLINE_CACHE`,
    throttleTime = 1000,
    maxAge = 1000 * 60 * 60 * 24,
    buster = '',
  }: Options = {}
) {
  if (typeof window !== 'undefined') {
    // Subscribe to changes
    const saveCache = throttle(() => {
      const storageCache: LocalStorageCache = {
        buster,
        timestamp: Date.now(),
        cacheState: dehydrate(queryClient),
      }

      localStorage.setItem(localStorageKey, JSON.stringify(storageCache))
    }, throttleTime)

    queryClient.getQueryCache().subscribe(saveCache)

    // Attempt restore
    const cacheStorage = localStorage.getItem(localStorageKey)

    if (!cacheStorage) {
      return
    }

    const cache: LocalStorageCache = JSON.parse(cacheStorage)

    if (cache.timestamp) {
      const expired = Date.now() - cache.timestamp > maxAge
      const busted = cache.buster !== buster
      if (expired || busted) {
        localStorage.removeItem(localStorageKey)
      } else {
        hydrate(queryClient, cache.cacheState)
      }
    } else {
      localStorage.removeItem(localStorageKey)
    }
  }
}

//TODO: documentation
//TODO: create a wrapper component that hides the app until cache rehydrate
//TODO: split cache in multiple keys to mitigate issues with max length on Android
export async function persistWithCustomAsyncStorage(
  queryClient: QueryClient,
  storage: Storage,
  {
    localStorageKey = `REACT_QUERY_OFFLINE_CACHE`,
    throttleTime = 1000,
    maxAge = 1000 * 60 * 60 * 24,
    buster = '',
  }: Options = {}
): Promise<void> {
  if (!storage) {
    return
  }
  // Subscribe to changes
  const saveCache = throttle(() => {
    const storageCache: LocalStorageCache = {
      buster,
      timestamp: Date.now(),
      cacheState: dehydrate(queryClient),
    }

    storage.setItem(localStorageKey, JSON.stringify(storageCache))
  }, throttleTime)

  queryClient.getQueryCache().subscribe(saveCache)

  // Attempt restore
  const cacheStorage = await storage.getItem(localStorageKey)

  if (!cacheStorage) {
    return
  }

  const cache: LocalStorageCache = JSON.parse(cacheStorage)

  if (cache.timestamp) {
    const expired = Date.now() - cache.timestamp > maxAge
    const busted = cache.buster !== buster
    if (expired || busted) {
      storage.removeItem(localStorageKey)
    } else {
      hydrate(queryClient, cache.cacheState)
    }
  } else {
    storage.removeItem(localStorageKey)
  }
}

function throttle(func: (...args: any[]) => any, wait = 100) {
  let timer: number | null = null

  return function (...args: any[]) {
    if (timer === null) {
      timer = setTimeout(() => {
        func(...args)
        timer = null
      }, wait)
    }
  }
}
