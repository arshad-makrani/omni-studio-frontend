const channels = ['web', 'phone', 'email', 'social']
const priorities = ['low', 'medium', 'high', 'urgent']
const reasons = ['flightChange', 'baggage', 'refund', 'specialAssistance', 'generalInquiry']
const slaMinutes = {
  low: { web: 240, phone: 60, email: 480, social: 120 },
  medium: { web: 120, phone: 30, email: 240, social: 60 },
  high: { web: 60, phone: 15, email: 120, social: 30 },
  urgent: { web: 30, phone: 5, email: 60, social: 15 },
}

const skills = [
  { id: 'skill-flight-booking', name: 'Flight Booking', description: 'Flight booking, changes, and cancellations', category: 'Travel', keywords: ['flight', 'booking', 'reservation', 'ticket', 'cancel', 'change'] },
  { id: 'skill-baggage', name: 'Baggage Claims', description: 'Lost, delayed, or damaged baggage', category: 'Baggage', keywords: ['baggage', 'luggage', 'lost bag', 'damaged bag', 'delayed bag'] },
  { id: 'skill-refund', name: 'Refund Processing', description: 'Refunds and reimbursements', category: 'Billing', keywords: ['refund', 'reimbursement', 'money back', 'credit', 'charge'] },
  { id: 'skill-assistance', name: 'Special Assistance', description: 'Accessibility and special assistance', category: 'Customer Service', keywords: ['wheelchair', 'medical', 'accessibility', 'special assistance', 'disability'] },
  { id: 'skill-technical', name: 'Technical Support', description: 'Website and account troubleshooting', category: 'Technical', keywords: ['technical', 'website', 'app', 'login', 'password'] },
  { id: 'skill-spanish', name: 'Spanish Language', description: 'Spanish language customer support', category: 'Language', keywords: ['spanish', 'español', 'hablamos'] },
]

const seedUsers = [
  { id: 'agent-jordan', name: 'Jordan Kim', email: 'jordan.kim@example.test', role: 'agent', maxCapacity: 15, skillIds: ['skill-flight-booking', 'skill-baggage', 'skill-spanish'] },
  { id: 'agent-riley', name: 'Riley Morgan', email: 'riley.morgan@example.test', role: 'agent', maxCapacity: 15, skillIds: ['skill-refund', 'skill-assistance', 'skill-flight-booking'] },
  { id: 'agent-casey', name: 'Casey Patel', email: 'casey.patel@example.test', role: 'agent', maxCapacity: 15, skillIds: ['skill-technical', 'skill-spanish', 'skill-baggage'] },
  { id: 'agent-avery', name: 'Avery Chen', email: 'avery.chen@example.test', role: 'agent', maxCapacity: 15, skillIds: ['skill-flight-booking', 'skill-refund', 'skill-technical', 'skill-assistance'] },
  { id: 'user-supervisor', name: 'Morgan Lee', email: 'morgan.lee@example.test', role: 'supervisor', maxCapacity: 20, skillIds: [] },
]

const reasonContent = {
  flightChange: ['A customer needs to change a flight booking after a schedule update.', 'Please help update the ticket reservation for a connecting flight.'],
  baggage: ['The customer is checking on a delayed baggage claim and missing luggage.', 'A damaged bag was reported after arrival and needs follow-up.'],
  refund: ['The customer is requesting a refund and reimbursement for an extra charge.', 'Please review the credit and return the payment to the original method.'],
  specialAssistance: ['A traveler needs wheelchair and accessibility assistance at the airport.', 'Please arrange medical and special assistance for the upcoming trip.'],
  generalInquiry: ['The customer has a question about the travel service and available options.', 'Please provide an update and general information about the booking.'],
}

function caseStatus(index) {
  if (index < 20) return 'new'
  if (index < 40) return 'assigned'
  if (index < 55) return 'accepted'
  if (index < 70) return 'inProgress'
  if (index < 135) return 'resolved'
  return 'closed'
}

function reasonSkill(reason) {
  return {
    flightChange: 'skill-flight-booking',
    baggage: 'skill-baggage',
    refund: 'skill-refund',
    specialAssistance: 'skill-assistance',
    generalInquiry: null,
  }[reason]
}

function buildCases(now) {
  const records = []
  for (let index = 0; index < 200; index += 1) {
    const channel = channels[index % channels.length]
    const priority = priorities[Math.floor(index / 2) % priorities.length]
    const reason = reasons[index % reasons.length]
    const status = caseStatus(index)
    const historical = ['resolved', 'closed'].includes(status)
    const ageMinutes = historical ? 24 * 60 * (1 + index % 10) + (index * 17 % 1440) : index % 360
    const createdAtMs = now - ageMinutes * 60_000
    const createdAt = new Date(createdAtMs).toISOString()
    const itemId = `case-${String(index + 1).padStart(3, '0')}`
    const slaExpiration = new Date(createdAtMs + slaMinutes[priority][channel] * 60_000).toISOString()
    const skillId = reasonSkill(reason)
    records.push({
      id: itemId,
      title: [
        'Flight change request', 'Delayed baggage follow-up', 'Refund status review',
        'Airport assistance request', 'Travel information request', 'Booking correction',
        'Missing luggage claim', 'Duplicate charge review', 'Accessibility support', 'Itinerary question',
      ][index % 10] + ` #${String(index + 1).padStart(3, '0')}`,
      description: reasonContent[reason][index % reasonContent[reason].length],
      priority,
      caseOrigin: channel,
      caseReason: reason,
      status,
      requiredSkills: skillId ? [skillId] : [],
      assignedAgentId: null,
      assignedAgent: null,
      slaExpiration,
      slaBreachRisk: false,
      escalationLevel: 0,
      createdAt,
      updatedAt: createdAt,
    })
  }
  return records
}

export function createSeedData(now = Date.now()) {
  const users = seedUsers.map(user => ({
    ...user,
    availabilityStatus: 'available',
    currentWorkload: 0,
    channelProficiency: { web: 3, phone: 4, email: 4, social: 3 },
    skills: user.skillIds.map((skillId, index) => ({ skillId, proficiency: 3 + index % 3 })),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }))
  const agents = users.filter(user => user.role === 'agent')
  const cases = buildCases(now)
  const assignments = []

  for (let index = 20; index < cases.length; index += 1) {
    const item = cases[index]
    const agent = agents[(index - 20) % agents.length]
    const completed = ['resolved', 'closed'].includes(item.status)
    const assignedAt = item.createdAt
    const completedAt = completed
      ? new Date(Date.parse(item.createdAt) + (Date.parse(item.slaExpiration) - Date.parse(item.createdAt)) * 0.7).toISOString()
      : null
    const assignmentStatus = completed ? 'completed' : item.status
    const assignment = {
      id: `assignment-${String(index - 19).padStart(3, '0')}`,
      caseId: item.id,
      agentId: agent.id,
      assignedAt,
      acceptedAt: ['accepted', 'inProgress', 'completed'].includes(assignmentStatus) ? assignedAt : null,
      completedAt,
      status: assignmentStatus,
      routingChannel: item.caseOrigin,
      skillMatchScore: 64 + (index * 11 % 37),
      createdAt: assignedAt,
      updatedAt: completedAt || assignedAt,
      case: item,
      agent,
    }
    item.assignedAgentId = agent.id
    item.assignedAgent = { id: agent.id, name: agent.name }
    if (!completed) agent.currentWorkload += 1
    assignments.push(assignment)
  }

  return { cases, agents, users, skills, assignments }
}
