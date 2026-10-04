export const STORAGE_KEY = 'northstar.omnichannel.data.v1'

const activeAssignmentStatuses = new Set(['assigned', 'accepted', 'inProgress'])
const terminalCaseStatuses = new Set(['resolved', 'closed'])
const assignmentTransitions = {
  accept: ['assigned', 'accepted'],
  decline: ['assigned', 'declined'],
  start: ['accepted', 'inProgress'],
  resolve: ['inProgress', 'completed']
}
const slaMinutes = {
  low: { web: 240, phone: 60, email: 480, social: 120 },
  medium: { web: 120, phone: 30, email: 240, social: 60 },
  high: { web: 60, phone: 15, email: 120, social: 30 },
  urgent: { web: 30, phone: 5, email: 60, social: 15 }
}

// Mapping from skill IDs to case reasons (inverse of reasonSkill in seedData.js)
const skillToReason = {
  'skill-flight-booking': 'flightChange',
  'skill-baggage': 'baggage',
  'skill-refund': 'refund',
  'skill-assistance': 'specialAssistance'
}

import { matchRequiredSkills } from './utils/skillMatcher.js';

function hasLocalDataShape(value) {
  return value && ['cases', 'agents', 'users', 'skills', 'assignments'].every(key => Array.isArray(value[key]))
}

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}

export function persistLocalData(storage, data) {
  storage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function loadLocalData(storage, seedData) {
  const stored = storage.getItem(STORAGE_KEY)
  if (stored !== null) {
    try {
      const parsed = JSON.parse(stored)
      if (hasLocalDataShape(parsed)) {
        parsed.stats = deriveStats(parsed)
        return parsed
      }
    } catch {
      // Replace malformed browser data with a clean seed below.
    }
  }
  const seeded = copy(seedData)
  seeded.stats = deriveStats(seeded)
  persistLocalData(storage, seeded)
  return seeded
}

export function deriveStats(data, now = Date.now()) {
  const cases = data.cases || []
  const assignments = data.assignments || []
  const agents = data.agents || []
  const countBy = field => Object.entries(cases.reduce((counts, item) => {
    const key = item[field] || 'unknown'
    counts[key] = (counts[key] || 0) + 1
    return counts
  }, {})).map(([label, count]) => ({ label, count }))
  const eligibleCases = cases.filter(item => Number.isFinite(Date.parse(item.slaExpiration)))
  const compliantCases = eligibleCases.filter(item => {
    const deadline = Date.parse(item.slaExpiration)
    if (!terminalCaseStatuses.has(item.status)) return deadline > now
    const latestCompletion = assignments
      .filter(assignment => assignment.caseId === item.id && assignment.status === 'completed')
      .map(assignment => Date.parse(assignment.completedAt))
      .filter(Number.isFinite)
      .reduce((latest, completedAt) => Math.max(latest, completedAt), Number.NEGATIVE_INFINITY)
    return latestCompletion <= deadline
  }).length
  const scoredAssignments = assignments.filter(item => Number.isFinite(Number(item.skillMatchScore)))
  const activeCases = cases.filter(item => !terminalCaseStatuses.has(item.status))

  return {
    totalCases: cases.length,
    openCases: activeCases.length,
    pendingAssignments: assignments.filter(item => item.status === 'assigned').length,
    avgSkillMatch: scoredAssignments.length ? scoredAssignments.reduce((sum, item) => sum + Number(item.skillMatchScore), 0) / scoredAssignments.length : 0,
    slaCompliance: eligibleCases.length ? compliantCases / eligibleCases.length * 100 : null,
    atRisk: activeCases.filter(item => item.slaExpiration && Date.parse(item.slaExpiration) <= now + 15 * 60 * 1000).length,
    casesByChannel: countBy('caseOrigin'),
    casesByReason: countBy('caseReason'),
    agentUtilization: agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      currentWorkload: agent.currentWorkload,
      maxCapacity: agent.maxCapacity,
      utilization: agent.maxCapacity ? agent.currentWorkload / agent.maxCapacity * 100 : 0,
    })),
  }
}

function id(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
}

function updateAgentReferences(data, agent) {
  if (!agent) return
  data.assignments = data.assignments.map(item => item.agentId === agent.id ? { ...item, agent: copy(agent) } : item)
  data.cases = data.cases.map(item => item.assignedAgentId === agent.id ? { ...item, assignedAgent: { id: agent.id, name: agent.name } } : item)
}

function updateCaseReferences(data, item) {
  data.assignments = data.assignments.map(assignment => assignment.caseId === item.id ? { ...assignment, case: copy(item) } : assignment)
}

function getEligibleAgent(data, item, excludedIds = []) {
  const excluded = new Set(excludedIds)
  const requiredSkills = item.requiredSkills || []
  const eligible = data.agents.filter(agent => agent.availabilityStatus === 'available' && agent.currentWorkload < agent.maxCapacity && !excluded.has(agent.id) && requiredSkills.every(skillId => agent.skills.some(skill => skill.skillId === skillId && skill.proficiency > 0)))
  const channelScore = agent => (Number(agent.channelProficiency?.[item.caseOrigin]) || 0) * 20
  const skillScore = agent => requiredSkills.length ? requiredSkills.reduce((sum, skillId) => sum + (Number(agent.skills.find(skill => skill.skillId === skillId)?.proficiency) || 0) * 20, 0) / requiredSkills.length : 0
  const workloadScore = agent => agent.maxCapacity > 0 ? (1 - agent.currentWorkload / agent.maxCapacity) * 100 : 0
  eligible.sort((a, b) => a.currentWorkload - b.currentWorkload || (skillScore(b) * .55 + channelScore(b) * .3 + workloadScore(b) * .15) - (skillScore(a) * .55 + channelScore(a) * .3 + workloadScore(a) * .15))
  return eligible[0] || null
}

function inferCaseReason(description, skills) {
  // Use our enhanced skill matcher to find relevant skills
  const matchedSkills = matchRequiredSkills(description, skills)

  // If we found matching skills, map the first one to a reason
  if (matchedSkills.length > 0) {
    const reason = skillToReason[matchedSkills[0]]
    if (reason) {
      return reason
    }
  }

  // Fallback to general inquiry if no skills match or no reason mapping found
  return 'generalInquiry'
}

function calculateSkillMatch(item, agent) {
  const requiredSkills = item.requiredSkills || []
  if (!requiredSkills.length) return 100
  return requiredSkills.reduce((sum, skillId) => {
    const proficiency = Number(agent.skills.find(skill => skill.skillId === skillId)?.proficiency) || 0
    return sum + Math.min(5, Math.max(0, proficiency))
  }, 0) / requiredSkills.length * 20
}

function createAssignment(item, agent, status = 'assigned', now = new Date().toISOString(), score = calculateSkillMatch(item, agent)) {
  return {
    id: id('assignment'), caseId: item.id, agentId: agent.id, assignedAt: now,
    status, acceptedAt: ['accepted', 'inProgress', 'completed'].includes(status) ? now : null,
    completedAt: status === 'completed' ? now : null, skillMatchScore: score,
    routingChannel: item.caseOrigin, createdAt: now, updatedAt: now,
    case: copy(item), agent: copy(agent),
  }
}

function refreshDerivedData(data, now = Date.now()) {
  data.stats = deriveStats(data, now)
  data.users = data.users.map(user => {
    const agent = data.agents.find(item => item.id === user.id)
    return agent ? copy(agent) : user
  })
  return data
}

export function createCase(data, values, now = Date.now()) {
  const next = copy(data)
  const createdAt = new Date(now).toISOString()
  const requiredSkills = matchRequiredSkills(values.description, next.skills)
  const item = {
    id: id('case'), title: values.title.trim(), description: values.description.trim(), priority: values.priority || 'medium',
    caseOrigin: values.caseOrigin || 'web', caseReason: inferCaseReason(values.description, next.skills),
    status: 'new', requiredSkills, assignedAgentId: null, assignedAgent: null,
    slaExpiration: new Date(now + (slaMinutes[values.priority || 'medium']?.[values.caseOrigin || 'web'] || 60) * 60000).toISOString(),
    createdAt, updatedAt: createdAt,
  }
  const agent = getEligibleAgent(next, item)
  if (agent) {
    item.status = 'assigned'
    item.assignedAgentId = agent.id
    item.assignedAgent = { id: agent.id, name: agent.name }
    agent.currentWorkload += 1
    agent.updatedAt = createdAt
    next.assignments.unshift(createAssignment(item, agent, 'assigned', createdAt))
    updateAgentReferences(next, agent)
  }
  next.cases.unshift(item)
  return refreshDerivedData(next, now)
}

export function editCase(data, caseId, values, now = Date.now()) {
  const next = copy(data)
  const existing = next.cases.find(item => item.id === caseId)
  if (!existing) throw new Error('Case not found')
  const reopening = values.reopen === true
  if (reopening && !terminalCaseStatuses.has(existing.status)) throw new Error('Only resolved or closed cases can be reopened')
  const requiredSkills = matchRequiredSkills(values.description, next.skills)
  const updated = {
    ...existing, title: values.title.trim(), description: values.description.trim(), priority: values.priority,
    caseOrigin: values.caseOrigin, caseReason: inferCaseReason(values.description, next.skills), requiredSkills,
    updatedAt: new Date(now).toISOString(),
  }
  if (values.priority !== existing.priority || values.caseOrigin !== existing.caseOrigin) {
    updated.slaExpiration = new Date(Date.parse(existing.createdAt) + (slaMinutes[values.priority]?.[values.caseOrigin] || 60) * 60000).toISOString()
  }
  if (reopening) {
    const agent = getEligibleAgent(next, updated)
    updated.status = agent ? 'assigned' : 'new'
    updated.assignedAgentId = agent?.id || null
    updated.assignedAgent = agent ? { id: agent.id, name: agent.name } : null
    if (agent) {
      agent.currentWorkload += 1
      agent.updatedAt = updated.updatedAt
      next.assignments.unshift(createAssignment(updated, agent, 'assigned', updated.updatedAt))
      updateAgentReferences(next, agent)
    }
  }
  next.cases = next.cases.map(item => item.id === caseId ? updated : item)
  updateCaseReferences(next, updated)
  return refreshDerivedData(next, now)
}

export function updateAssignment(data, assignmentId, action, now = Date.now()) {
  const transition = assignmentTransitions[action]
  if (!transition) throw new Error('Unknown assignment action')
  const next = copy(data)
  const assignment = next.assignments.find(item => item.id === assignmentId)
  if (!assignment) throw new Error('Assignment not found')
  if (assignment.status !== transition[0]) throw new Error(`Only ${transition[0]} assignments can be ${action}ed`)
  const timestamp = new Date(now).toISOString()
  assignment.status = transition[1]
  assignment.updatedAt = timestamp
  if (action === 'accept') assignment.acceptedAt = timestamp
  if (action === 'resolve') assignment.completedAt = timestamp
  const agent = next.agents.find(item => item.id === assignment.agentId)
  const item = next.cases.find(record => record.id === assignment.caseId)
  if (['decline', 'resolve'].includes(action) && agent) {
    agent.currentWorkload = Math.max(0, agent.currentWorkload - 1)
    agent.updatedAt = timestamp
  }
  if (action === 'decline') {
    const declinedIds = next.assignments.filter(record => record.caseId === item.id && record.status === 'declined').map(record => record.agentId)
    const reroute = getEligibleAgent(next, item, declinedIds)
    if (reroute) {
      reroute.currentWorkload += 1
      reroute.updatedAt = timestamp
      item.status = 'assigned'
      item.assignedAgentId = reroute.id
      item.assignedAgent = { id: reroute.id, name: reroute.name }
      next.assignments.unshift(createAssignment(item, reroute, 'assigned', timestamp))
      updateAgentReferences(next, reroute)
    } else {
      item.status = 'new'
      item.assignedAgentId = null
      item.assignedAgent = null
    }
  } else {
    item.status = action === 'resolve' ? 'resolved' : transition[1]
  }
  item.updatedAt = timestamp
  updateAgentReferences(next, agent)
  updateCaseReferences(next, item)
  return refreshDerivedData(next, now)
}

export function reassignCase(data, caseId, agentId, now = Date.now()) {
  const next = copy(data)
  const item = next.cases.find(record => record.id === caseId)
  const agent = next.agents.find(record => record.id === agentId)
  if (!item || !agent) throw new Error('Case or agent not found')
  if (terminalCaseStatuses.has(item.status)) throw new Error('Resolved cases cannot be reassigned')
  if (agent.availabilityStatus !== 'available' || agent.currentWorkload >= agent.maxCapacity) throw new Error('Selected agent is unavailable or at capacity')
  const timestamp = new Date(now).toISOString()
  for (const previous of next.assignments.filter(record => record.caseId === item.id && activeAssignmentStatuses.has(record.status))) {
    previous.status = 'declined'
    previous.updatedAt = timestamp
    const previousAgent = next.agents.find(record => record.id === previous.agentId)
    if (previousAgent) {
      previousAgent.currentWorkload = Math.max(0, previousAgent.currentWorkload - 1)
      previousAgent.updatedAt = timestamp
      updateAgentReferences(next, previousAgent)
    }
  }
  const reassignedItem = next.cases.find(record => record.id === caseId)
  reassignedItem.assignedAgentId = agent.id
  reassignedItem.assignedAgent = { id: agent.id, name: agent.name }
  reassignedItem.status = 'assigned'
  reassignedItem.updatedAt = timestamp
  agent.currentWorkload += 1
  agent.updatedAt = timestamp
  next.assignments.unshift(createAssignment(reassignedItem, agent, 'assigned', timestamp))
  updateAgentReferences(next, agent)
  updateCaseReferences(next, reassignedItem)
  return refreshDerivedData(next, now)
}

export function saveSkill(data, skillId, values, now = Date.now()) {
  const next = copy(data)
  const skill = { id: skillId || id('skill'), name: values.name.trim(), description: values.description.trim(), category: values.category.trim(), keywords: [...new Set(values.keywords)] }
  if (next.skills.some(item => item.name.toLocaleLowerCase() === skill.name.toLocaleLowerCase() && item.id !== skillId)) throw new Error('A skill with that name already exists')
  if (skillId && !next.skills.some(item => item.id === skillId)) throw new Error('Skill not found')
  if (skillId) next.skills = next.skills.map(item => item.id === skillId ? skill : item)
  else next.skills.push(skill)
  const timestamp = new Date(now).toISOString()
  if (skillId) {
    for (const user of next.users) if (user.skills.some(item => item.skillId === skillId)) user.updatedAt = timestamp
  }
  return refreshDerivedData(next, now)
}

export function saveUser(data, userId, values, now = Date.now()) {
  const next = copy(data)
  const existing = userId ? next.users.find(user => user.id === user.id) : null
  if (userId && !existing) throw new Error('User not found')
  const timestamp = new Date(now).toISOString()
  const skills = values.role === 'agent' ? (values.skills || []).map(item => ({ skillId: item.skillId, proficiency: item.proficiency })) : []
  const user = {
    ...(existing || {}), id: userId || id('user'), name: values.name.trim(), email: values.email.trim().toLocaleLowerCase(),
    role: values.role, availabilityStatus: values.availabilityStatus || 'available',
    currentWorkload: existing?.currentWorkload || 0, maxCapacity: Number(values.maxCapacity || 5),
    channelProficiency: existing?.channelProficiency || { web: 3, phone: 3, email: 3, social: 3 },
    skills, createdAt: existing?.createdAt || timestamp, updatedAt: timestamp,
  }
  if (user.maxCapacity < user.currentWorkload) throw new Error('Maximum capacity cannot be lower than current workload')
  if (user.currentWorkload > 0 && existing && user.role !== existing.role) throw new Error('A user with active assignments cannot change roles')
  if (next.users.some(item => item.email === user.email && user.id !== user.id)) throw new Error('A user with that email already exists')
  next.users = existing ? next.users.map(item => user.id === user.id ? user : user) : [...next.users, user]
  next.agents = next.users.filter(item => item.role === 'agent')
  updateAgentReferences(next, user)
  return refreshDerivedData(next, now)
}