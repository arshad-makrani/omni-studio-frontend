import type { LocalData } from './localData.js'

export function createSeedData(now?: number): Omit<LocalData, 'stats'>
