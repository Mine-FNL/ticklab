/**
 * Saved Strategies Module
 *
 * Persists strategy configurations to localStorage so users can save,
 * load, rename, and delete strategies across sessions.
 */

import type { Strategy } from '@/types/strategy'

// Renamed from `univ3_saved_strategies` as part of the ticklab rebrand.
// Old-key data is still readable so users with existing browser-stored
// strategies don't lose them on upgrade.
const STORAGE_KEY = 'ticklab_saved_strategies'
/** @deprecated — kept for one release for backwards-compatible reads. */
const LEGACY_STORAGE_KEY = 'univ3_saved_strategies'

export interface SavedStrategy {
  id: string
  name: string
  strategy: Strategy
  createdAt: Date
  updatedAt: Date
}

/**
 * Save a strategy to localStorage.
 * Auto-generates a name if none provided.
 */
export function saveStrategy(strategy: Strategy, name?: string): SavedStrategy {
  const saved: SavedStrategy = {
    id: crypto.randomUUID(),
    name: name || `Strategy ${new Date().toLocaleDateString()}`,
    strategy,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const existing = getSavedStrategies()
  existing.push(saved)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))

  return saved
}

/**
 * Retrieve all saved strategies from localStorage.
 * Safe to call on the server (returns empty array).
 */
export function getSavedStrategies(): SavedStrategy[] {
  if (typeof window === 'undefined') return []

  // Read the new key first; fall back to the legacy key for users who
  // had browser-stored strategies under the pre-rebrand name.
  let stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) stored = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!stored) return []

  try {
    const parsed = JSON.parse(stored)
    return parsed.map((s: any) => ({
      ...s,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
    }))
  } catch {
    return []
  }
}

/**
 * Delete a saved strategy by ID.
 */
export function deleteStrategy(id: string): void {
  const existing = getSavedStrategies()
  const filtered = existing.filter(s => s.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
}

/**
 * Rename a saved strategy.
 */
export function updateStrategyName(id: string, name: string): void {
  const existing = getSavedStrategies()
  const idx = existing.findIndex(s => s.id === id)
  if (idx !== -1) {
    existing[idx].name = name
    existing[idx].updatedAt = new Date()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
  }
}
