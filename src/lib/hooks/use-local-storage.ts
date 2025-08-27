"use client"

import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';

// A robust, client-side only version of the use-local-storage-state hook
// Handles server-side rendering gracefully and synchronizes with local storage.
export function useLocalStorage<T>(
  key: string,
  defaultValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    // This part runs only once on initialization, on the server or client.
    if (typeof window === 'undefined') {
      // On the server, always return the default value.
      return defaultValue instanceof Function ? defaultValue() : defaultValue;
    }
    try {
      // On the client, try to read from localStorage.
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : (defaultValue instanceof Function ? defaultValue() : defaultValue);
    } catch (error) {
      // If reading fails, return the default value.
      console.warn(`Error reading localStorage key “${key}”:`, error);
      return defaultValue instanceof Function ? defaultValue() : defaultValue;
    }
  });

  // This effect synchronizes the state to localStorage whenever it changes.
  // It only runs on the client.
  useEffect(() => {
    // Do not run on the server
    if (typeof window === 'undefined') {
        return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, value]);
  
  // This effect listens for changes in other tabs.
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
        if (e.key === key && e.newValue !== null) {
            try {
                setValue(JSON.parse(e.newValue));
            } catch(error) {
                console.warn(`Error parsing storage event value for key “${key}”:`, error);
            }
        }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
}, [key]);


  return [value, setValue];
}
