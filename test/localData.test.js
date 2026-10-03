import test from 'node:test'
import assert from 'node:assert/strict'
import { createCase, deriveStats, loadLocalData, persistLocalData, reassignCase, updateAssignment } from '../src/localData.js'
import { createSeedData } from '../src/seedData.js'

function makeData() {
  const agent = { id: 'agent-1', name: 'Taylor Reed', role: 'agent', availabilityStatus: 'available', currentWorkload: 1, maxCapacity: 5, skills: [], channelProficiency: {} }
  const item = { id: 'case-1', title: 'Delayed baggage', description: 'A delayed bag', priority: 'high', caseOrigin: 'phone', caseReason: 'baggage', status: 'assigned', requiredSkills: [], assignedAgentId: agent.id, assignedAgent: { id: agent.id, name: agent.name }, slaExpiration: '2026-12-01T12:00:00.000Z', createdAt: '2026-12-01T10:00:00.000Z' }
  const assignment = { id: 'assignment-1', caseId: item.id, agentId: agent.id, assignedAt: '2026-12-01T10:00:00.000Z', status: 'assigned', routingChannel: 'phone', skillMatchScore: 82, case: item, agent }
  return { cases: [item], agents: [agent], users: [agent], skills: [{ id: 'skill-1', name: 'Baggage Claims', description: '', category: 'Travel', keywords: ['baggage'] }], assignments: [assignment] }
}

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values,
  }
}

test('first load seeds storage with complete data when the key is absent', () => {
  const storage = makeStorage()
  const seed = makeData()
  const data = loadLocalData(storage, seed)
  const expected = { ...seed, stats: deriveStats(seed) }
  assert.deepEqual(data, expected)
  assert.deepEqual(JSON.parse(storage.getItem('northstar.omnichannel.data.v1')), expected)
})

test('reload restores saved data rather than replacing user changes with the seed', () => {
  const changed = makeData()
  changed.cases[0].title = 'Saved title'
  const storage = makeStorage({ 'northstar.omnichannel.data.v1': JSON.stringify(changed) })
  assert.equal(loadLocalData(storage, makeData()).cases[0].title, 'Saved title')
})

test('malformed and incomplete stored values recover to a fresh seed and overwrite storage', () => {
  for (const raw of ['{broken', JSON.stringify({ cases: [] })]) {
    const storage = makeStorage({ 'northstar.omnichannel.data.v1': raw })
    const seed = makeData()
    const expected = { ...seed, stats: deriveStats(seed) }
    assert.deepEqual(loadLocalData(storage, seed), expected)
    assert.deepEqual(JSON.parse(storage.getItem('northstar.omnichannel.data.v1')), expected)
  }
})

test('persistence serializes the complete state and does not mutate its input', () => {
  const storage = makeStorage()
  const data = makeData()
  const before = structuredClone(data)
  persistLocalData(storage, data)
  assert.deepEqual(JSON.parse(storage.getItem('northstar.omnichannel.data.v1')), data)
  assert.deepEqual(data, before)
})

test('dashboard statistics reflect current cases, active assignments, SLA, and workload', () => {
  const data = makeData()
  const stats = deriveStats(data, Date.parse('2026-12-01T11:00:00.000Z'))
  assert.equal(stats.totalCases, 1)
  assert.equal(stats.openCases, 1)
  assert.equal(stats.pendingAssignments, 1)
  assert.equal(stats.avgSkillMatch, 82)
  assert.equal(stats.slaCompliance, 100)
  assert.equal(stats.atRisk, 0)
  assert.deepEqual(stats.casesByChannel, [{ label: 'phone', count: 1 }])
  assert.equal(stats.agentUtilization[0].utilization, 20)
})

test('dashboard SLA compliance counts completed work against its completion deadline', () => {
  const data = makeData()
  data.cases[0].status = 'resolved'
  data.assignments[0].status = 'completed'
  data.assignments[0].completedAt = '2026-12-01T11:30:00.000Z'
  const stats = deriveStats(data, Date.parse('2026-12-01T11:00:00.000Z'))
  assert.equal(stats.slaCompliance, 100)
})

test('storage access failures propagate so the UI can display a useful error', () => {
  const unavailable = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.throws(() => loadLocalData(unavailable, makeData()), /blocked/)
})

test('seed data contains 200 varied cases and populated agent workloads within capacity', () => {
  const data = createSeedData(Date.parse('2026-12-01T12:00:00.000Z'))
  assert.equal(data.cases.length, 200)
  assert.ok(new Set(data.cases.map(item => item.caseOrigin)).size >= 4)
  assert.ok(new Set(data.cases.map(item => item.priority)).size >= 4)
  assert.ok(new Set(data.cases.map(item => item.caseReason)).size >= 5)
  assert.ok(new Set(data.cases.map(item => item.status)).size >= 6)
  assert.ok(data.assignments.length >= 150)
  assert.ok(data.agents.every(agent => agent.currentWorkload > 0 && agent.currentWorkload <= agent.maxCapacity))
  assert.ok(data.assignments.every(item => item.case.id === item.caseId && item.agent.id === item.agentId))
})

test('creating a case persists as a new routed case with a linked assignment', () => {
  const data = createSeedData(Date.parse('2026-12-01T12:00:00.000Z'))
  const next = createCase(data, { title: 'Refund for a duplicate charge', description: 'Please issue a refund for a duplicate charge.', priority: 'high', caseOrigin: 'email' }, Date.parse('2026-12-01T12:00:00.000Z'))
  const created = next.cases[0]
  assert.equal(created.caseReason, 'refund')
  assert.ok(created.assignedAgentId)
  assert.equal(next.assignments[0].caseId, created.id)
  assert.equal(next.assignments[0].agentId, created.assignedAgentId)
  assert.equal(next.stats.totalCases, data.cases.length + 1)
})

test('new assignment skill match reflects the assigned agent proficiency', () => {
  const data = makeData()
  data.agents[0].skills = [{ skillId: 'skill-1', proficiency: 3 }]
  data.skills[0].keywords = ['baggage']
  const next = createCase(data, { title: 'Baggage support', description: 'Help with baggage', priority: 'medium', caseOrigin: 'web' }, Date.parse('2026-12-01T11:00:00.000Z'))
  assert.equal(next.assignments[0].skillMatchScore, 60)
})

test('accepting then starting and resolving an assignment applies the full workflow', () => {
  const data = makeData()
  const accepted = updateAssignment(data, 'assignment-1', 'accept', Date.parse('2026-12-01T11:00:00.000Z'))
  assert.equal(accepted.assignments[0].status, 'accepted')
  const started = updateAssignment(accepted, 'assignment-1', 'start', Date.parse('2026-12-01T11:01:00.000Z'))
  assert.equal(started.cases[0].status, 'inProgress')
  const resolved = updateAssignment(started, 'assignment-1', 'resolve', Date.parse('2026-12-01T11:30:00.000Z'))
  assert.equal(resolved.assignments[0].status, 'completed')
  assert.equal(resolved.cases[0].status, 'resolved')
  assert.equal(resolved.agents[0].currentWorkload, 0)
})

test('declining an assignment reroutes without changing the original records', () => {
  const data = makeData()
  const next = updateAssignment(data, 'assignment-1', 'decline', Date.parse('2026-12-01T11:00:00.000Z'))
  assert.equal(next.assignments[0].status, 'declined')
  assert.equal(next.cases[0].status, 'new')
  assert.equal(next.cases[0].assignedAgentId, null)
  assert.equal(next.agents[0].currentWorkload, 0)
  assert.equal(data.assignments[0].status, 'assigned')
})

test('reassignment retires the prior active assignment and assigns the selected agent', () => {
  const data = createSeedData(Date.parse('2026-12-01T12:00:00.000Z'))
  const item = data.cases.find(record => record.status === 'assigned')
  const currentAssignment = data.assignments.find(record => record.caseId === item.id)
  const targetAgent = data.agents.find(agent => agent.id !== currentAssignment.agentId && agent.currentWorkload < agent.maxCapacity)
  const next = reassignCase(data, item.id, targetAgent.id, Date.parse('2026-12-01T12:00:00.000Z'))
  assert.equal(next.cases.find(record => record.id === item.id).assignedAgentId, targetAgent.id)
  assert.equal(next.assignments.find(record => record.id === currentAssignment.id).status, 'declined')
  assert.equal(next.assignments[0].agentId, targetAgent.id)
})
