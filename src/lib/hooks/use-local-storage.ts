"use client"

import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';

// A modified version of the use-local-storage-state hook that is client-side only
// https://github.com/astoilkov/use-local-storage-state/blob/main/src/useLocalStorage.ts
export function useLocalStorage<T>(
  key: string,
  initialState: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(initialState)

  useEffect(() => {
    // This effect runs only on the client, after hydration.
    try {
      const item = localStorage.getItem(key)
      if (item !== null) {
        setState(JSON.parse(item))
      }
    } catch (error) {
      console.error(error)
    }
  }, [key])

  const setLocalStorageState = useCallback<Dispatch<SetStateAction<T>>>(
    (value) => {
      try {
        const newValue = typeof value === 'function' ? (value as (prevState: T) => T)(state) : value
        localStorage.setItem(key, JSON.stringify(newValue))
        setState(newValue)
      } catch (error) {
        console.error(error)
      }
    },
    [key, state]
  )

  return [state, setLocalStorageState]
}
