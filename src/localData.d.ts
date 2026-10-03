export type LocalData = {
  cases: any[]
  agents: any[]
  users: any[]
  skills: any[]
  assignments: any[]
  stats: any
}

export const STORAGE_KEY: string
export function loadLocalData(storage: Storage, seedData: Omit<LocalData, 'stats'>): LocalData
export function persistLocalData(storage: Storage, data: LocalData): void
export function deriveStats(data: Omit<LocalData, 'stats'> | LocalData, now?: number): any
export function createCase(data: LocalData, values: any, now?: number): LocalData
export function editCase(data: LocalData, caseId: string, values: any, now?: number): LocalData
export function updateAssignment(data: LocalData, assignmentId: string, action: string, now?: number): LocalData
export function reassignCase(data: LocalData, caseId: string, agentId: string, now?: number): LocalData
export function saveSkill(data: LocalData, skillId: string | null, values: any, now?: number): LocalData
export function saveUser(data: LocalData, userId: string | null, values: any, now?: number): LocalData
