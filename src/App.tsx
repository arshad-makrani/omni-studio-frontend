import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Alert, Avatar, Badge, Button, Card, Checkbox, Col, Empty, Form, Input, InputNumber, Layout, Menu,
  Modal, Progress, Row, Select, Skeleton, Space, Spin, Statistic, Table, Tag,
  Tooltip, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  AppstoreOutlined, ArrowUpOutlined, BellOutlined, BookOutlined, CheckCircleOutlined,
  ClockCircleOutlined, DashboardOutlined, EditOutlined, FileAddOutlined, InboxOutlined,
  MailOutlined, PhoneOutlined, PlusOutlined, ReloadOutlined, SearchOutlined,
  TeamOutlined, ThunderboltOutlined, UserOutlined, WechatOutlined,
} from '@ant-design/icons'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip,
  XAxis, YAxis,
} from 'recharts'
import {
  createCase,
  editCase,
  loadLocalData,
  persistLocalData,
  reassignCase as moveCase,
  saveSkill as persistSkill,
  saveUser as persistUser,
  updateAssignment as transitionAssignment/*,
  copy,
  getEligibleAgent,
  createAssignment,
  updateAgentReferences,
  updateCaseReferences,
  refreshDerivedData*/
} from './localData.js'
import type { LocalData } from './localData.js'
import { createSeedData } from './seedData.js'
import './App.css'
const channelNames: Record<string, string> = { web: 'Web', phone: 'Phone', email: 'Email', social: 'Social' }
const priorityColors: Record<string, string> = { low: 'default', medium: 'blue', high: 'orange', urgent: 'red' }
const statusColors: Record<string, string> = { new: 'default', assigned: 'processing', accepted: 'cyan', inProgress: 'blue', resolved: 'success', closed: 'default' }
const reasonNames: Record<string, string> = { flightChange: 'Flight changes', baggage: 'Baggage', refund: 'Refunds', specialAssistance: 'Special assistance', generalInquiry: 'General inquiry' }

type Agent = { id: string; name: string; email: string; role?: string; availabilityStatus: string; currentWorkload: number; maxCapacity: number; channelProficiency?: Record<string, number>; skills: { skillId: string; proficiency: number }[]; updatedAt?: string }
type Skill = { id: string; name: string; description: string; category: string; keywords: string[] }
type SkillForm = Omit<Skill, 'id'> & { keywordsText: string }
type UserForm = { name: string; email: string; role: string; availabilityStatus: string; maxCapacity: number; skillIds: string[]; skillProficiency: Record<string, number> }
type ServiceCase = { id: string; title: string; description: string; priority: string; caseOrigin: string; caseReason: string; status: string; requiredSkills?: string[]; slaExpiration?: string; createdAt: string; assignedAgentId?: string | null; assignedAgent?: { id: string; name: string } | null }
type CaseEditForm = { title: string; description: string; priority: string; caseOrigin: string; reopen?: boolean }
type Assignment = { id: string; caseId: string; agentId: string; status: string; assignedAt: string; skillMatchScore: number; routingChannel: string; case: ServiceCase; agent: Agent }
type Stats = { totalCases: number; openCases: number; pendingAssignments: number; avgSkillMatch: number; slaCompliance: number | null; atRisk: number; casesByChannel: { label: string; count: number }[]; casesByReason: { label: string; count: number }[]; agentUtilization: { id: string; name: string; currentWorkload: number; maxCapacity: number; utilization: number }[] }
type CaseForm = { title: string; description: string; priority: string; caseOrigin: string }
type Page = 'overview' | 'agent' | 'supervisor' | 'skills' | 'users'

function formatTime(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function compareSlaExpiration(a?: string, b?: string) {
  const timestamp = (value?: string) => {
    const parsed = Date.parse(value || '')
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
  }
  return timestamp(a) - timestamp(b)
}

function getSlaState(expiration?: string, now = Date.now()) {
  if (!expiration) return { label: 'No SLA', color: 'default', deadline: '' }
  const dueAt = new Date(expiration)
  if (Number.isNaN(dueAt.getTime())) return { label: 'No SLA', color: 'default', deadline: '' }
  const remaining = dueAt.getTime() - now
  const minutes = Math.ceil(Math.abs(remaining) / 60000)
  const duration = minutes >= 1440
    ? `${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h`
    : minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
  return {
    label: remaining <= 0 ? `Overdue ${duration}` : `Due in ${duration}`,
    color: remaining <= 0 || remaining <= 15 * 60 * 1000 ? 'red' : remaining <= 60 * 60 * 1000 ? 'orange' : 'green',
    deadline: `Due ${dueAt.toLocaleString()}`,
  }
}

function SlaBadge({ expiration, status, now }: { expiration?: string; status?: string; now: number }) {
  if (status === 'resolved' || status === 'closed') return <Tag color="success">{status === 'closed' ? 'Closed' : 'Resolved'}</Tag>
  const state = getSlaState(expiration, now)
  return <Tooltip title={state.deadline || undefined}><Tag color={state.color}>{state.label}</Tag></Tooltip>
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === 'phone') return <PhoneOutlined />
  if (channel === 'email') return <MailOutlined />
  if (channel === 'social') return <WechatOutlined />
  return <AppstoreOutlined />
}

function App() {
  const [page, setPage] = useState<Page>('overview')
  const [clock, setClock] = useState(() => Date.now())
  const nowDate = new Date(clock)
  const day = nowDate.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()
  const date = nowDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
  const [cases, setCases] = useState<ServiceCase[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [users, setUsers] = useState<Agent[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const dataRef = useRef<LocalData | null>(null)
  const [storageError, setStorageError] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [caseModalOpen, setCaseModalOpen] = useState(false)
  const [caseEditor, setCaseEditor] = useState<ServiceCase | null>(null)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Agent | null>(null)
  const [tablePaginationState, setTablePaginationState] = useState({ current: 1, pageSize: 20 })
  const [savingUser, setSavingUser] = useState(false)
  const [skillModalOpen, setSkillModalOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [savingSkill, setSavingSkill] = useState(false)
  const [reassignCase, setReassignCase] = useState<ServiceCase | null>(null)
  const [caseDetailVisible, setCaseDetailVisible] = useState(false)
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<ServiceCase | null>(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm<CaseForm>()
  const [skillForm] = Form.useForm<SkillForm>()
  const [userForm] = Form.useForm<UserForm>()
  const [caseEditForm] = Form.useForm<CaseEditForm>()

  const applyData = useCallback((data: LocalData, persist = true) => {
    dataRef.current = data
    setCases(data.cases)
    setAgents(data.agents)
    setUsers(data.users)
    setSkills(data.skills)
    setAssignments(data.assignments)
    setStats(data.stats)
    setSelectedAgent(current => current && data.agents.some(agent => agent.id === current) ? current : data.agents[0]?.id)
    if (persist) {
      try {
        persistLocalData(window.localStorage, data)
        setStorageError('')
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Browser storage is unavailable'
        setStorageError(`Changes are in memory only because browser storage could not be saved: ${detail}`)
        message.error('Could not save changes to browser storage')
      }
    }
  }, [])

  const refresh = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    try {
      const data = loadLocalData(window.localStorage, createSeedData())
      applyData(data)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Browser storage is unavailable'
      setStorageError(`Browser storage is unavailable: ${detail}`)
      message.error('Could not load data from browser storage')
    } finally {
      setLoading(false)
    }
  }, [applyData])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    /* eslint-disable react/set-state-in-effect */
    const timer = window.setInterval(() => setClock(Date.now()), 30_000)
    /* eslint-enable react/set-state-in-effect */
    return () => window.clearInterval(timer)
  }, [])

  const currentAgent = agents.find(agent => agent.id === selectedAgent)
  const agentAssignments = assignments.filter(item => item.agentId === selectedAgent && !['completed', 'declined', 'expired'].includes(item.status))
  const filteredCases = useMemo(() => cases.filter(item => {
    const searchableText = [
      item.id || '',
      item.title || '',
      item.description || '',
      item.priority || '',
      item.caseOrigin || '',
      item.caseReason || '',
      item.status || '',
      item.slaExpiration || '',
      item.createdAt || '',
      item.assignedAgentId || '',
      item.assignedAgent?.name || ''
    ].join(' ').toLowerCase();

    return searchableText.includes(search.toLowerCase());
  }), [cases, search])


  const tablePagination = useMemo(() => ({
    hideOnSinglePage: false,
    showSizeChanger: true,
    pageSizeOptions: [20, 50, 100],
    showQuickJumper: false
  }), []);


  const submitCase = async (values: CaseForm) => {
    setSubmitting(true)
    try {
      const current = dataRef.current
      if (!current) throw new Error('App data is not ready')
      const next = createCase(current, values)
      applyData(next)
      setCaseModalOpen(false)
      form.resetFields()
      message.success(next.assignments[0]?.caseId === next.cases[0]?.id ? `Case routed to ${next.assignments[0].agent.name}` : 'Case created and added to the unassigned queue')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not submit case')
    } finally {
      setSubmitting(false)
    }
  }

  const openSkillEditor = (skill?: Skill) => {
    setEditingSkill(skill || null)
    skillForm.setFieldsValue(skill ? { name: skill.name, description: skill.description, category: skill.category, keywordsText: skill.keywords.join(', ') } : { name: '', description: '', category: '', keywordsText: '' })
    setSkillModalOpen(true)
  }

  const saveSkill = async (values: SkillForm) => {
    setSavingSkill(true)
    try {
      const payload = { name: values.name, description: values.description || '', category: values.category, keywords: values.keywordsText.split(/[,\n]/).map(value => value.trim()).filter(Boolean) }
      const current = dataRef.current
      if (!current) throw new Error('App data is not ready')
      applyData(persistSkill(current, editingSkill?.id || null, payload))
      setSkillModalOpen(false)
      skillForm.resetFields()
      message.success(editingSkill ? 'Skill updated' : 'Skill added')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not save skill')
    } finally {
      setSavingSkill(false)
    }
  }

  const openUserEditor = (user?: Agent) => {
    setEditingUser(user || null)
    userForm.setFieldsValue(user ? {
      name: user.name,
      email: user.email,
      role: user.role || 'agent',
      availabilityStatus: user.availabilityStatus,
      maxCapacity: user.maxCapacity,
      skillIds: user.skills.map(item => item.skillId),
      skillProficiency: Object.fromEntries(user.skills.map(item => [item.skillId, item.proficiency])),
    } : { name: '', email: '', role: 'agent', availabilityStatus: 'available', maxCapacity: 5, skillIds: [], skillProficiency: {} })
    setUserModalOpen(true)
  }

  const saveUser = async (values: UserForm) => {
    setSavingUser(true)
    try {
      const skillIds = values.role === 'agent' ? values.skillIds || [] : []
      const skills = skillIds.map(skillId => ({ skillId, proficiency: values.skillProficiency?.[skillId] || 3 }))
      const current = dataRef.current
      if (!current) throw new Error('App data is not ready')
      applyData(persistUser(current, editingUser?.id || null, { ...values, skills }))
      setUserModalOpen(false)
      userForm.resetFields()
      message.success(editingUser ? 'User updated' : 'User added')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not save user')
    } finally {
      setSavingUser(false)
    }
  }

  const openCaseEditor = (item: ServiceCase) => {
    setCaseEditor(item)
    caseEditForm.setFieldsValue({ title: item.title, description: item.description, priority: item.priority, caseOrigin: item.caseOrigin, reopen: false })
  }

  const saveCase = async (values: CaseEditForm) => {
    if (!caseEditor) return
    try {
      const current = dataRef.current
      if (!current) throw new Error('App data is not ready')
      const next = editCase(current, caseEditor.id, values)
      applyData(next)
      setCaseEditor(null)
      const latestCase = next.cases.find(item => item.id === caseEditor.id)
      message.success(values.reopen ? (latestCase?.assignedAgent ? `Case reopened and routed to ${latestCase.assignedAgent.name}` : 'Case reopened in the unassigned queue') : 'Case updated')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not update case')
    }
  }

  const updateAssignment = async (assignment: Assignment, action: string) => {
    try {
      const current = dataRef.current
      if (!current) throw new Error('App data is not ready')
      const next = transitionAssignment(current, assignment.id, action)
      applyData(next)
      if (action === 'decline') {
        const rerouted = next.assignments.find(item => item.caseId === assignment.caseId && item.id !== assignment.id && item.status === 'assigned')
        message.success(rerouted ? `Case rerouted to ${rerouted.agent.name}` : 'No other available agent matches; case returned to the unassigned queue')
      } else {
        message.success(`Work item ${action === 'start' ? 'started' : action === 'resolve' ? 'resolved' : `${action}ed`}`)
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not update work item')
    }
  }

  const reassign = async (values: { agentId: string }) => {
    if (!reassignCase) return
    try {
      const current = dataRef.current
      if (!current) throw new Error('App data is not ready')
      applyData(moveCase(current, reassignCase.id, values.agentId))
      setReassignCase(null)
      message.success('Case reassigned')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not reassign case')
    }
  }

  const reassignUnassignedCases = async () => {
    try {
      const current = dataRef.current
      if (!current) throw new Error('App data is not ready')

      // Get all unassigned cases (status: 'new')
      const unassignedCases = current.cases.filter(item => item.status === 'new');

      if (unassignedCases.length === 0) {
        message.info('No unassigned cases to route');
        return;
      }

      // Work on a copy of the data
      let next = JSON.parse(JSON.stringify(current));

      // Helper function to get eligible agent (copied from localData.js)
      const getEligibleAgent = (data: { agents: Agent[] }, item: ServiceCase, excludedIds: string[] = []) => {
        const excluded = new Set(excludedIds);
        const requiredSkills = item.requiredSkills || [];
        const eligible = data.agents.filter(agent => agent.availabilityStatus === 'available' && agent.currentWorkload < agent.maxCapacity && !excluded.has(agent.id) && requiredSkills.every(skillId => agent.skills.some(skill => skill.skillId === skillId && skill.proficiency > 0)));
        const channelScore = (agent: Agent) => (Number(agent.channelProficiency?.[item.caseOrigin]) || 0) * 20;
        const skillScore = (agent: Agent) => requiredSkills.length ? requiredSkills.reduce((sum, skillId) => sum + (Number(agent.skills.find(skill => skill.skillId === skillId)?.proficiency) || 0) * 20, 0) / requiredSkills.length : 100;
        const workloadScore = (agent: Agent) => agent.maxCapacity > 0 ? (1 - agent.currentWorkload / agent.maxCapacity) * 100 : 0;
        eligible.sort((a, b) => a.currentWorkload - b.currentWorkload || (skillScore(b) * .55 + channelScore(b) * .3 + workloadScore(b) * .15) - (skillScore(a) * .55 + channelScore(a) * .3 + workloadScore(a) * .15));
        return eligible[0] || null;
      };

      // Helper function to create assignment (copied from localData.js)
      const createAssignment = (item: ServiceCase, agent: Agent, status = 'assigned', now = new Date().toISOString(), score = 0) => {
        // Calculate skill match score (copied from localData.js)
        const calculateSkillMatch = (item: ServiceCase, agent: Agent) => {
          const requiredSkills = item.requiredSkills || [];
          if (!requiredSkills.length) return 100;
          return requiredSkills.reduce((sum, skillId) => {
            const proficiency = Number(agent.skills.find(skill => skill.skillId === skillId)?.proficiency) || 0;
            return sum + Math.min(5, Math.max(0, proficiency));
          }, 0) / requiredSkills.length * 20;
        };

        const finalScore = score !== 0 ? score : calculateSkillMatch(item, agent);
        return {
          id: `assignment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          caseId: item.id,
          agentId: agent.id,
          assignedAt: now,
          status,
          acceptedAt: ['accepted', 'inProgress', 'completed'].includes(status) ? now : null,
          completedAt: status === 'completed' ? now : null,
          skillMatchScore: finalScore,
          routingChannel: item.caseOrigin,
          createdAt: now,
          updatedAt: now,
          case: JSON.parse(JSON.stringify(item)),
          agent: JSON.parse(JSON.stringify(agent))
        };
      };

      // Helper function to update agent references (copied from localData.js)
      const updateAgentReferences = (data: { assignments: Assignment[]; cases: ServiceCase[] }, agent: Agent) => {
        if (!agent) return;
        data.assignments = data.assignments.map(item => item.agentId === agent.id ? { ...item, agent: JSON.parse(JSON.stringify(agent)) } : item);
        data.cases = data.cases.map(item => item.assignedAgentId === agent.id ? { ...item, assignedAgent: { id: agent.id, name: agent.name } } : item);
      };

      // Helper function to update case references (copied from localData.js)
      const updateCaseReferences = (data: { assignments: Assignment[] }, item: ServiceCase) => {
        data.assignments = data.assignments.map(assignment => assignment.caseId === item.id ? { ...assignment, case: JSON.parse(JSON.stringify(item)) } : assignment);
      };

      // Helper function to refresh derived data (copied from localData.js)
      const refreshDerivedData = (data: LocalData, now = Date.now()) => {
        const cases = data.cases || [];
        const assignments = data.assignments || [];
        const agents = data.agents || [];
        const countBy = (field: string) => Object.entries(cases.reduce((counts, item) => {
          const key = item[field] || 'unknown';
          counts[key] = (counts[key] || 0) + 1;
          return counts;
        }, {})).map(([label, count]) => ({ label, count }));
        const eligibleCases = cases.filter(item => Number.isFinite(Date.parse(item.slaExpiration)));
        const compliantCases = eligibleCases.filter(item => {
          const deadline = Date.parse(item.slaExpiration);
          if (!new Set(['resolved', 'closed']).has(item.status)) return deadline > now;
          const latestCompletion = assignments
            .filter(assignment => assignment.caseId === item.id && assignment.status === 'completed')
            .map(assignment => Date.parse(assignment.completedAt))
            .filter(Number.isFinite)
            .reduce((latest, completedAt) => Math.max(latest, completedAt), Number.NEGATIVE_INFINITY);
          return latestCompletion <= deadline;
        }).length;
        const scoredAssignments = assignments.filter(item => Number.isFinite(Number(item.skillMatchScore)));
        const activeCases = cases.filter(item => !new Set(['resolved', 'closed']).has(item.status));

        data.stats = {
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
        };
        return data;
      };

      // Process each unassigned case
      let assignedCount = 0;
      for (const caseItem of unassignedCases) {
        // Find the case in our working copy (by id)
        const caseIndex = next.cases.findIndex((c: any) => c.id === caseItem.id);
        if (caseIndex === -1) continue; // should not happen
        const item = next.cases[caseIndex];

        // Try to find an eligible agent for this case
        const agent = getEligibleAgent(next, item);

        if (agent) {
          // Assign the case to the agent
          item.status = 'assigned';
          item.assignedAgentId = agent.id;
          item.assignedAgent = { id: agent.id, name: agent.name };
          item.updatedAt = new Date().toISOString();

          // Update agent workload
          agent.currentWorkload += 1;
          agent.updatedAt = item.updatedAt;

          // Create assignment record
          const assignment = createAssignment(item, agent, 'assigned', item.updatedAt);
          next.assignments.unshift(assignment);

          // Update references
          updateAgentReferences(next, agent);
          updateCaseReferences(next, item);

          assignedCount++;
        }
        // If no agent available, leave case as 'new'
      }

      // Apply the updated data
      applyData(refreshDerivedData(next));

      message.success(`Successfully assigned ${assignedCount} of ${unassignedCases.length} unassigned cases`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not re-trigger assignment rules');
      console.error('Error in reassignUnassignedCases:', error);
    }
  };

  const caseColumns: ColumnsType<ServiceCase> = [
    { title: 'CASE', key: 'title', width: 220, sorter: (a, b) => a.title.localeCompare(b.title), render: (_: unknown, item) => {
        const title = item.title || 'Untitled case';
        const description = item.description || '';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => {
            setSelectedCaseDetail(item);
            setCaseDetailVisible(true);
          }}>
            <InboxOutlined style={{ fontSize: 18, color: '#5366bd' }} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div title={title} style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                {title}
              </div>
              <div title={description} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.875em', color: '#666' }}>
                {description}
              </div>
            </div>
          </div>
        );
      } },
    { title: 'CHANNEL', dataIndex: 'caseOrigin', key: 'channel', sorter: (a, b) => a.caseOrigin.localeCompare(b.caseOrigin), render: (value: string) => <span className="channel-label"><ChannelIcon channel={value} />{channelNames[value] || value}</span> },
    { title: 'PRIORITY', dataIndex: 'priority', key: 'priority', sorter: (a, b) => a.priority.localeCompare(b.priority), render: (value: string) => <Tag color={priorityColors[value]}>{value.toUpperCase()}</Tag> },
    { title: 'STATUS', dataIndex: 'status', key: 'status', sorter: (a, b) => a.status.localeCompare(b.status), render: (value: string) => <Tag color={statusColors[value]}>{value === 'inProgress' ? 'In progress' : value}</Tag> },
    { title: 'SLA', key: 'sla', sorter: (a, b) => compareSlaExpiration(a.slaExpiration, b.slaExpiration), render: (_: unknown, item) => <SlaBadge expiration={item.slaExpiration} status={item.status} now={clock} /> },
    { title: 'ASSIGNED TO', key: 'agent', sorter: (a, b) => (a.assignedAgent?.name || '').localeCompare(b.assignedAgent?.name || ''), render: (_: unknown, item) => item.assignedAgent?.name || <span className="muted">Unassigned</span> },
    { title: 'CREATED', dataIndex: 'createdAt', key: 'createdAt', sorter: (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt), render: (value: string) => formatTime(value) },
    { title: '', key: 'actions', render: (_: unknown, item) => <Space size={4}><Button size="small" type="link" icon={<EditOutlined />} onClick={() => openCaseEditor(item)}>Edit</Button>{!['resolved', 'closed'].includes(item.status) && <Button size="small" type="link" onClick={() => setReassignCase(item)}>Reassign</Button>}</Space> },
  ]

  const skillColumns: ColumnsType<Skill> = [
    { title: 'SKILL', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name), render: (name: string, skill) => <div className="table-case"><strong>{name}</strong><small>{skill.description || 'No description'}</small></div> },
    { title: 'CATEGORY', dataIndex: 'category', key: 'category', sorter: (a, b) => a.category.localeCompare(b.category), render: (value: string) => <Tag color="blue">{value}</Tag> },
    { title: 'KEYWORDS', dataIndex: 'keywords', key: 'keywords', sorter: (a, b) => a.keywords.join(', ').localeCompare(b.keywords.join(', ')), render: (values: string[]) => <Space size={[4, 4]} wrap>{values.map(keyword => <Tag key={keyword}>{keyword}</Tag>)}</Space> },
    { title: '', key: 'edit', render: (_: unknown, skill) => <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openSkillEditor(skill)}>Edit</Button> },
  ]

  const userColumns: ColumnsType<Agent> = [
    { title: 'USER', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name), render: (name: string, user) => <div className="table-case"><strong>{name}</strong><small>{user.email}</small></div> },
    { title: 'ROLE', dataIndex: 'role', key: 'role', sorter: (a, b) => (a.role || '').localeCompare(b.role || ''), render: (value: string) => <Tag color={value === 'supervisor' ? 'purple' : 'blue'}>{value}</Tag> },
    { title: 'STATUS', dataIndex: 'availabilityStatus', key: 'availabilityStatus', sorter: (a, b) => a.availabilityStatus.localeCompare(b.availabilityStatus), render: (value: string) => <Tag color={value === 'available' ? 'green' : 'default'}>{value}</Tag> },
    { title: 'CAPACITY', key: 'capacity', sorter: (a, b) => a.currentWorkload - b.currentWorkload, render: (_: unknown, user) => `${user.currentWorkload} / ${user.maxCapacity}` },
    { title: 'ASSIGNED SKILLS', key: 'skills', render: (_: unknown, user) => <Space size={[4, 4]} wrap>{user.skills.map(item => <Tag key={item.skillId}>{skills.find(skill => skill.id === item.skillId)?.name || 'Unknown skill'} · {item.proficiency}/5</Tag>)}</Space> },
    { title: '', key: 'edit', render: (_: unknown, user) => <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openUserEditor(user)}>Edit</Button> },
  ]

  const assignmentColumns: ColumnsType<Assignment> = [
    { title: 'CASE', key: 'case', width: 300, sorter: (a, b) => (a.case?.title || '').localeCompare(b.case?.title || ''), render: (_: unknown, item) => {
        const title = item.case?.title || 'Untitled case';
        const description = item.case?.description || '';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', cursor: 'pointer' }} onClick={() => {
            setSelectedCaseDetail(item.case);
            setCaseDetailVisible(true);
          }}>
            <div title={title} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', fontWeight: 'bold' }}>
              {title}
            </div>
            <div title={description} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', fontSize: '0.875em', color: '#666' }}>
              {description}
            </div>
          </div>
        );
      } },
    { title: 'CHANNEL', dataIndex: 'routingChannel', key: 'channel', sorter: (a, b) => a.routingChannel.localeCompare(b.routingChannel), render: (value: string) => <span className="channel-label"><ChannelIcon channel={value} />{channelNames[value] || value}</span> },
    { title: 'PRIORITY', key: 'priority', sorter: (a, b) => (a.case?.priority || '').localeCompare(b.case?.priority || ''), render: (_: unknown, item) => <Tag color={priorityColors[item.case?.priority]}>{(item.case?.priority || 'normal').toUpperCase()}</Tag> },
    { title: 'STATUS', dataIndex: 'status', key: 'status', sorter: (a, b) => a.status.localeCompare(b.status), render: (value: string) => <Tag color={statusColors[value]}>{value === 'inProgress' ? 'In progress' : value}</Tag> },
    { title: 'SLA', key: 'sla', sorter: (a, b) => Date.parse(a.case?.slaExpiration || '') - Date.parse(b.case?.slaExpiration || ''), render: (_: unknown, item) => <SlaBadge expiration={item.case?.slaExpiration} status={item.case?.status} now={clock} /> },
    { title: 'MATCH', dataIndex: 'skillMatchScore', key: 'match', sorter: (a, b) => a.skillMatchScore - b.skillMatchScore, render: (value: number) => <span className="match-value">{Math.round(value || 0)}%</span> },
    { title: 'ACTION', key: 'action', render: (_: unknown, item) => {
      if (item.status === 'assigned') return <Space><Button size="small" type="primary" onClick={() => void updateAssignment(item, 'accept')}>Accept</Button><Button size="small" onClick={() => void updateAssignment(item, 'decline')}>Decline</Button></Space>
      if (item.status === 'accepted') return <Button size="small" type="primary" onClick={() => void updateAssignment(item, 'start')}>Start work</Button>
      if (item.status === 'inProgress') return <Button size="small" type="primary" onClick={() => void updateAssignment(item, 'resolve')}>Resolve</Button>
      return <span className="muted">—</span>
    } },
  ]

  return (
    <Layout className="app-shell">
      <Layout.Sider width={236} className="sidebar" breakpoint="lg" collapsedWidth={72}>
        <div className="brand"><span className="brand-mark"><ThunderboltOutlined /></span><span className="brand-copy"><strong>Icelandair</strong><small>SERVICE OPERATIONS</small></span></div>
        <div className="workspace-label">WORKSPACE</div>
        <Menu className="nav-menu" mode="inline" selectedKeys={[page]} onClick={({ key }) => setPage(key as Page)} items={[
          { key: 'overview', icon: <DashboardOutlined />, label: 'Overview' },
          { key: 'agent', icon: <InboxOutlined />, label: 'Agent workspace', extra: <Tooltip title="Pending assignments"><span className="menu-count">{stats?.pendingAssignments || 0}</span></Tooltip> },
          { key: 'supervisor', icon: <TeamOutlined />, label: 'Supervisor' },
          { key: 'skills', icon: <BookOutlined />, label: 'Skills' },
          { key: 'users', icon: <UserOutlined />, label: 'Users' },
        ]} />
        <div className="sidebar-bottom"><div className="live-indicator"><span /> All systems operational</div><div className="profile"><Avatar size={36} style={{ background: '#dce8ff', color: '#305fd0' }}>NT</Avatar><span><strong>Nilesh Tambe</strong><small>Service supervisor</small></span><Button type="text" icon={<AppstoreOutlined />} aria-label="Profile options" /></div></div>
      </Layout.Sider>
      <Layout className="main-layout">
        <Layout.Header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{page === 'overview' ? 'Overview' : page === 'agent' ? 'Agent workspace' : page === 'skills' ? 'Skills' : page === 'users' ? 'Users' : 'Supervisor'}</strong></div>
          <Space size={12}><Button type="text" icon={<ReloadOutlined />} aria-label="Refresh data" onClick={() => void refresh()} /><Badge dot><Button type="text" icon={<BellOutlined />} aria-label="Notifications" /></Badge><Avatar size={34} style={{ background: '#dce8ff', color: '#305fd0' }}>NT</Avatar></Space>
        </Layout.Header>
        <Layout.Content className="page-content">
          {loading && !stats ? <Card className="loading-card"><Skeleton active paragraph={{ rows: 6 }} /></Card> : !stats ? <Empty description={storageError || 'Browser storage could not be reached'}><Button type="primary" onClick={() => void refresh()}>Try again</Button></Empty> : <>
            <div className="page-heading"><div><div className="eyebrow">{day}, {date} <span className="heading-dot" /> OPERATIONS CENTER</div><Typography.Title level={2}>{page === 'overview' ? 'Good Morning, Nilesh' : page === 'agent' ? 'Agent workspace' : page === 'skills' ? 'Skill management' : page === 'users' ? 'User management' : 'Supervisor overview'}</Typography.Title><Typography.Paragraph>{page === 'overview' ? 'Here’s what’s happening across your support channels today.' : page === 'agent' ? 'Your assigned work, prioritized and ready for action.' : page === 'skills' ? 'Manage the skills and keywords used to classify and route support cases.' : page === 'users' ? 'Manage user profiles, roles, availability, capacity, and agent skills.' : 'Monitor queue health, team capacity, and service levels.'}</Typography.Paragraph></div><Space><Button icon={<ReloadOutlined />} onClick={() => void refresh()}>Refresh</Button>{page === 'skills' ? <Button type="primary" icon={<PlusOutlined />} onClick={() => openSkillEditor()}>Add skill</Button> : page === 'users' ? <Button type="primary" icon={<PlusOutlined />} onClick={() => openUserEditor()}>Add user</Button> : <Button type="primary" icon={<PlusOutlined />} onClick={() => setCaseModalOpen(true)}>New case</Button>}</Space></div>

            {stats.atRisk > 0 && <Alert className="risk-alert" type="warning" showIcon message={`${stats.atRisk} ${stats.atRisk === 1 ? 'case is' : 'cases are'} approaching their SLA deadline`} description="Review the at-risk queue and reassign work if needed." action={<Button size="small" onClick={() => setPage('supervisor')}>Review queue</Button>} />}

            {page === 'agent' ? <>
              <Card className="agent-select-card" bordered={false}><Space><Avatar icon={<UserOutlined />} style={{ background: '#eef2ff', color: '#5366bd' }} /><div><Typography.Text type="secondary">Viewing workspace for</Typography.Text><br /><Select aria-label="Choose agent" value={selectedAgent} onChange={setSelectedAgent} options={agents.map(agent => ({ value: agent.id, label: agent.name }))} style={{ minWidth: 220 }} /></div></Space><span className="capacity-chip">{currentAgent ? `${currentAgent.currentWorkload} / ${currentAgent.maxCapacity} active items` : 'No agents available'}</span></Card>
              <Row gutter={[16, 16]} className="stat-row"><Col xs={12} xl={6}><Metric title="Assigned to me" value={agentAssignments.length} suffix="items" icon={<InboxOutlined />} tone="blue" /></Col><Col xs={12} xl={6}><Metric title="Waiting acceptance" value={agentAssignments.filter(item => item.status === 'assigned').length} suffix="items" icon={<ClockCircleOutlined />} tone="amber" /></Col><Col xs={12} xl={6}><Metric title="In progress" value={agentAssignments.filter(item => item.status === 'inProgress').length} suffix="items" icon={<ThunderboltOutlined />} tone="violet" /></Col><Col xs={12} xl={6}><Metric title="My capacity" value={currentAgent?.maxCapacity ? Math.round((currentAgent.currentWorkload / currentAgent.maxCapacity) * 100) : 0} suffix="%" icon={<TeamOutlined />} tone="green" /></Col></Row>
              <Card className="table-card" bordered={false} title={<div className="card-title"><span>My work queue</span><Tag>{agentAssignments.length} ACTIVE</Tag></div>} extra={<Button type="text" icon={<ReloadOutlined />} onClick={() => void refresh(false)}>Refresh</Button>}><Table rowKey="id" columns={assignmentColumns} dataSource={agentAssignments} pagination={agentAssignments.length > 20 ? { ...tablePagination, current: tablePaginationState.current, pageSize: tablePaginationState.pageSize, onShowSizeChange: (current, pageSize) => { setTablePaginationState({ current, pageSize }); }, onChange: (current, pageSize) => { setTablePaginationState({ current, pageSize }); }, style: { marginTop: 16 } } : false} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing in your queue right now" /> }} scroll={{ x: 760 }} className="paginated-table" /></Card>
            </> : page === 'supervisor' ? <>
              <Row gutter={[16, 16]} className="stat-row"><Col xs={12} xl={6}><Metric title="Open cases" value={stats.openCases} suffix="cases" icon={<InboxOutlined />} tone="blue" /></Col><Col xs={12} xl={6}><Metric title="Waiting assignment" value={cases.filter(item => item.status === 'new').length} suffix="cases" icon={<ClockCircleOutlined />} tone="amber" /></Col><Col xs={12} xl={6}><Metric title="SLA compliance" value={stats.slaCompliance === null ? 'N/A' : Math.round(stats.slaCompliance)} suffix={stats.slaCompliance === null ? undefined : '%'} icon={<CheckCircleOutlined />} tone="green" /></Col><Col xs={12} xl={6}><Metric title="Avg. skill match" value={Math.round(stats.avgSkillMatch)} suffix="%" icon={<ThunderboltOutlined />} tone="violet" /></Col></Row>
              <Card className="table-card" bordered={false} title={<div className="card-title"><span>All cases</span><Tag>{cases.length} TOTAL</Tag></div>} extra={<div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <Input allowClear prefix={<SearchOutlined />} placeholder="Search cases" value={search} onChange={event => setSearch(event.target.value)} className="table-search" style={{ flex: 1 }} />
                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      // Trigger automatic reassignment of unassigned cases
                      reassignUnassignedCases();
                    }}
                    style={{ marginRight: '8px' }}
                  >
                    Re-trigger Assignment Rules
                  </Button>
                </div>}><Table rowKey="id" columns={caseColumns} dataSource={filteredCases} pagination={filteredCases.length > 20 ? { ...tablePagination, current: tablePaginationState.current, pageSize: tablePaginationState.pageSize, onShowSizeChange: (current, pageSize) => { setTablePaginationState({ current, pageSize }); }, onChange: (current, pageSize) => { setTablePaginationState({ current, pageSize }); }, style: { marginTop: 16 } } : false} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No cases match this search" /> }} scroll={{ x: 900 }} className="paginated-table" /></Card>
              <Card className="table-card utilization-card" bordered={false} title={<div className="card-title"><span>Team capacity</span><span className="muted">Active work / maximum capacity</span></div>}><div className="utilization-list">{stats.agentUtilization.map(agent => <div className="utilization-row" key={agent.id}><Avatar size={34} style={{ background: '#edf1ff', color: '#5265ba' }}>{agent.name.split(' ').map(part => part[0]).join('').slice(0, 2)}</Avatar><span className="utilization-name"><strong>{agent.name}</strong><small>{agent.currentWorkload} of {agent.maxCapacity} cases</small></span><Progress percent={Math.round(agent.utilization)} showInfo={false} strokeColor={agent.utilization >= 85 ? '#f0a347' : '#6682ee'} /><span className="utilization-percent">{Math.round(agent.utilization)}%</span></div>)}</div></Card>
            </> : page === 'skills' ? <>
              <Card className="table-card" bordered={false} title={<div className="card-title"><span>Routing skills</span><Tag>{skills.length} TOTAL</Tag></div>}><Table rowKey="id" columns={skillColumns} dataSource={skills} pagination={skills.length > 20 ? { ...tablePagination, current: tablePaginationState.current, pageSize: tablePaginationState.pageSize, onShowSizeChange: (current, pageSize) => { setTablePaginationState({ current, pageSize }); }, onChange: (current, pageSize) => { setTablePaginationState({ current, pageSize }); }, style: { marginTop: 16 } } : false} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No skills configured yet" /> }} scroll={{ x: 720 }} className="paginated-table" /></Card>
            </> : page === 'users' ? <>
              <Card className="table-card" bordered={false} title={<div className="card-title"><span>Users and agents</span><Tag>{users.length} TOTAL</Tag></div>}><Table rowKey="id" columns={userColumns} dataSource={users} pagination={users.length > 20 ? { ...tablePagination, current: tablePaginationState.current, pageSize: tablePaginationState.pageSize, onShowSizeChange: (current, pageSize) => { setTablePaginationState({ current, pageSize }); }, onChange: (current, pageSize) => { setTablePaginationState({ current, pageSize }); }, style: { marginTop: 16 } } : false} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No users configured yet" /> }} scroll={{ x: 920 }} className="paginated-table" /></Card>
            </> : <>
              <Row gutter={[16, 16]} className="stat-row"><Col xs={12} xl={6}><Metric title="Total cases" value={stats.totalCases} trend="All time" icon={<InboxOutlined />} tone="blue" /></Col><Col xs={12} xl={6}><Metric title="Open cases" value={stats.openCases} trend="Needs attention" icon={<ClockCircleOutlined />} tone="amber" /></Col><Col xs={12} xl={6}><Metric title="SLA compliance" value={stats.slaCompliance === null ? 'N/A' : Math.round(stats.slaCompliance)} suffix={stats.slaCompliance === null ? undefined : '%'} trend="Within SLA or resolved on time" icon={<CheckCircleOutlined />} tone="green" /></Col><Col xs={12} xl={6}><Metric title="Skill match" value={Math.round(stats.avgSkillMatch)} suffix="%" trend="Average routing score" icon={<ThunderboltOutlined />} tone="violet" /></Col></Row>
              <Row gutter={[16, 16]} className="overview-grid"><Col xs={24} xl={16}><Card className="chart-card" bordered={false} title={<div className="card-title"><span>Case volume</span><Tag color="green">LIVE</Tag></div>} extra={<span className="muted">Last 7 days</span>}><div className="chart-summary"><strong>{stats.totalCases}</strong><span>cases in the queue</span><span className="trend-positive">{stats.openCases} currently open</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={weeklyVolume(cases)} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}><defs><linearGradient id="casesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6482ef" stopOpacity={0.22} /><stop offset="100%" stopColor="#6482ef" stopOpacity={0.015} /></linearGradient></defs><CartesianGrid stroke="#edf0f5" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#9299a8', fontSize: 12 }} dy={10} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#9299a8', fontSize: 12 }} /><ChartTooltip contentStyle={{ border: '1px solid #e9edf3', borderRadius: 10, boxShadow: '0 8px 24px rgba(32,44,78,.09)' }} /><Area type="monotone" dataKey="cases" stroke="#6884ef" strokeWidth={2.5} fill="url(#casesFill)" activeDot={{ r: 5, fill: '#fff', stroke: '#6884ef', strokeWidth: 2 }} /></AreaChart></ResponsiveContainer></div></Card></Col>
                <Col xs={24} xl={8}><Card className="channel-card" bordered={false} title={<div className="card-title"><span>Channel mix</span><span className="muted">By case origin</span></div>}><div className="channel-list">{['web', 'phone', 'email', 'social'].map((channel, index) => { const count = stats.casesByChannel.find(item => item.label === channel)?.count || 0; const percent = stats.totalCases ? Math.round(count / stats.totalCases * 100) : 0; return <div className="channel-row" key={channel}><span className={`channel-icon channel-${channel}`}><ChannelIcon channel={channel} /></span><span className="channel-info"><strong>{channelNames[channel]}</strong><small>{count} {count === 1 ? 'case' : 'cases'}</small></span><span className="channel-share">{percent}%</span><Progress percent={percent} showInfo={false} strokeColor={['#6584ee', '#31a98f', '#e4a347', '#9674df'][index]} trailColor="#f0f2f6" /></div> })}</div><div className="channel-footer"><span><span className="legend-dot" /> Total cases</span><strong>{stats.totalCases}</strong></div></Card></Col></Row>
              <Row gutter={[16, 16]} className="bottom-grid" align="top"><Col xs={24} xl={16}><Card className="table-card" bordered={false} title={<div className="card-title"><span>Recent cases</span><Tag>{cases.length} CASES</Tag></div>} extra={<Button type="link" onClick={() => setPage('supervisor')}>View all <ArrowUpOutlined rotate={45} /></Button>}><Table rowKey="id" columns={caseColumns.slice(0, 6)} dataSource={filteredCases} pagination={filteredCases.length > 20 ? { ...tablePagination, current: tablePaginationState.current, pageSize: tablePaginationState.pageSize, onShowSizeChange: (current, pageSize) => { setTablePaginationState({ current, pageSize }); }, onChange: (current, pageSize) => { setTablePaginationState({ current, pageSize }); }, style: { marginTop: 16 } } : false} size="small" locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Your queue is clear. Submit a new case to get started." /> }} scroll={{ x: 720, y: 240 }} className="paginated-table" /></Card></Col><Col xs={24} xl={8}><Card className="reason-card" bordered={false} title={<div className="card-title"><span>Top contact reasons</span><span className="muted">All cases</span></div>}><div className="reason-list">{[...stats.casesByReason].sort((a, b) => b.count - a.count).slice(0, 4).map((item, index) => <div className="reason-row" key={item.label}><span className={`reason-rank rank-${index + 1}`}>0{index + 1}</span><span className="reason-name">{reasonNames[item.label] || item.label}</span><strong>{item.count}</strong></div>)}</div></Card></Col></Row>
            </>}
          </>}
        </Layout.Content>
        <footer className="app-footer"><span>Icelandair Service Operations</span><span><span className="live-dot" /> Data refreshes on demand</span></footer>
      </Layout>

      <Modal title={<div className="modal-heading"><span className="modal-icon"><FileAddOutlined /></span><span><strong>Create a support case</strong><small>We’ll identify the right skills and route it automatically.</small></span></div>} open={caseModalOpen} onCancel={() => setCaseModalOpen(false)} footer={null} destroyOnHidden width={560}>
        <div style={{ padding: '28px 36px', maxHeight: '58vh', overflowY: 'auto' }}>
          <Form form={form} layout="vertical" initialValues={{ priority: 'medium', caseOrigin: 'web' }} onFinish={submitCase} className="case-form">
            <Form.Item label="Case title" name="title" rules={[{ required: true, whitespace: true, message: 'Enter a short case title' }, { max: 120, message: 'Keep the title under 120 characters' }]}><Input size="large" placeholder="e.g. Delayed baggage from flight FI 615" /></Form.Item>
            <Form.Item label="What does the customer need help with?" name="description" rules={[{ required: true, whitespace: true, message: 'Add a few details so we can route this accurately' }, { min: 12, message: 'Add a little more detail (at least 12 characters)' }]}><Input.TextArea rows={4} showCount maxLength={1200} placeholder="Describe the customer’s issue, including relevant flight or booking details…" /></Form.Item>
            <Row gutter={12}><Col span={12}><Form.Item label="Priority" name="priority"><Select size="large" options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]} /></Form.Item></Col><Col span={12}><Form.Item label="Channel" name="caseOrigin"><Select size="large" options={[{ value: 'web', label: 'Web form' }, { value: 'phone', label: 'Phone' }, { value: 'email', label: 'Email' }, { value: 'social', label: 'Social media' }]} /></Form.Item></Col></Row>
            <div className="form-note"><ThunderboltOutlined /> Skills are detected from the description. The best available agent is selected automatically.</div>
            <div className="form-actions"><Button onClick={() => setCaseModalOpen(false)}>Cancel</Button><Button type="primary" htmlType="submit" loading={submitting} icon={<PlusOutlined />}>Create and route</Button></div>
          </Form>
        </div>
      </Modal>
      <Modal title="Edit case" open={!!caseEditor} onCancel={() => setCaseEditor(null)} footer={null} destroyOnHidden width={560}>
        <div style={{ padding: '28px 36px', maxHeight: '58vh', overflowY: 'auto' }}>
          <Form form={caseEditForm} layout="vertical" onFinish={saveCase}>
            <Form.Item label="Case title" name="title" rules={[{ required: true, whitespace: true }, { max: 120 }]}><Input /></Form.Item>
            <Form.Item label="Description" name="description" rules={[{ required: true, whitespace: true }, { max: 1200, min: 12 }]}><Input.TextArea rows={4} showCount maxLength={1200} /></Form.Item>
            <Row gutter={12}><Col span={12}><Form.Item label="Priority" name="priority" rules={[{ required: true }]}><Select options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]} /></Form.Item></Col><Col span={12}><Form.Item label="Channel" name="caseOrigin" rules={[{ required: true }]}><Select options={[{ value: 'web', label: 'Web' }, { value: 'phone', label: 'Phone' }, { value: 'email', label: 'Email' }, { value: 'social', label: 'Social' }]} /></Form.Item></Col></Row>
          {caseEditor && ['resolved', 'closed'].includes(caseEditor.status) && <Form.Item name="reopen" valuePropName="checked"><Checkbox>Reopen this case after saving</Checkbox></Form.Item>}
          {caseEditor && ['resolved', 'closed'].includes(caseEditor.status) && <p className="reassign-copy">Reopened cases are returned to the active queue and routed to an available agent when possible.</p>}
          <div className="form-actions"><Button onClick={() => setCaseEditor(null)}>Cancel</Button><Button type="primary" htmlType="submit">Save case</Button></div>
          </Form>
        </div>
      </Modal>
      <Modal title={editingUser ? 'Edit user' : 'Add user'} open={userModalOpen} onCancel={() => setUserModalOpen(false)} footer={null} destroyOnHidden width={660}>
        <div style={{ padding: '28px 36px', maxHeight: '58vh', overflowY: 'auto' }}>
          <Form form={userForm} layout="vertical" onFinish={saveUser}>
            <Form.Item label="Name" name="name" rules={[{ required: true, whitespace: true }, { max: 100 }]}><Input /></Form.Item>
            <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email' }, { max: 160 }]}><Input /></Form.Item>
            <Row gutter={12}><Col span={12}><Form.Item label="Role" name="role" rules={[{ required: true }]}><Select options={[{ value: 'agent', label: 'Agent' }, { value: 'supervisor', label: 'Supervisor' }]} /></Form.Item></Col><Col span={12}><Form.Item label="Availability" name="availabilityStatus" rules={[{ required: true }]}><Select options={[{ value: 'available', label: 'Available' }, { value: 'unavailable', label: 'Unavailable' }, { value: 'offline', label: 'Offline' }]} /></Form.Item></Col></Row>
          <Form.Item label="Maximum active cases" name="maxCapacity" rules={[{ required: true }, { type: 'number', min: 1, max: 100 }]}><InputNumber min={Math.max(1, editingUser?.currentWorkload || 0)} max={100} style={{ width: '100%' }} /></Form.Item>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.role !== current.role || previous.skillIds !== current.skillIds}>{({ getFieldValue }) => getFieldValue('role') === 'agent' ? <>
            <Form.Item label="Assigned skills" name="skillIds" extra="Choose the skills this agent supports, then set proficiency for each one."><Select mode="multiple" allowClear placeholder="Select agent skills" options={skills.map(skill => ({ value: skill.id, label: `${skill.name} · ${skill.category}` }))} /></Form.Item>
            <Form.Item noStyle shouldUpdate={(previous, current) => previous.skillIds !== current.skillIds}>{({ getFieldValue: getUpdatedValue }) => {
              const selectedSkillIds = (getUpdatedValue('skillIds') || []) as string[]
              return selectedSkillIds.map(skillId => {
                const skill = skills.find(item => item.id === skillId)
                return <div className="skill-proficiency-row" key={skillId}><span>{skill?.name || 'Skill'} proficiency</span><Form.Item name={['skillProficiency', skillId]} rules={[{ required: true }]}><Select aria-label={`${skill?.name || 'Skill'} proficiency`} options={[{ value: 1, label: '1 · Beginner' }, { value: 2, label: '2 · Basic' }, { value: 3, label: '3 · Proficient' }, { value: 4, label: '4 · Advanced' }, { value: 5, label: '5 · Expert' }]} /></Form.Item></div>
              })
            }}</Form.Item>
          </> : null}</Form.Item>
          <div className="form-actions" style={{ marginTop: 'auto' }}><Button onClick={() => setUserModalOpen(false)}>Cancel</Button><Button type="primary" htmlType="submit" loading={savingUser}>{editingUser ? 'Save changes' : 'Add user'}</Button></div>
          </Form>
        </div>
      </Modal>
      <Modal title={editingSkill ? 'Edit skill' : 'Add skill'} open={skillModalOpen} onCancel={() => setSkillModalOpen(false)} footer={null} destroyOnHidden>
        <div style={{ padding: '28px 36px', maxHeight: '58vh', overflowY: 'auto' }}>
          <Form form={skillForm} layout="vertical" onFinish={saveSkill}>
            <Form.Item label="Skill name" name="name" rules={[{ required: true, whitespace: true }, { max: 80 }]}><Input placeholder="e.g. Baggage Claims" /></Form.Item>
            <Form.Item label="Description" name="description" rules={[{ max: 240 }]}><Input.TextArea rows={2} maxLength={240} placeholder="What kind of cases need this skill?" /></Form.Item>
            <Form.Item label="Category" name="category" rules={[{ required: true, whitespace: true }, { max: 60 }]}><Input placeholder="e.g. Travel" /></Form.Item>
            <Form.Item label="Matching keywords" name="keywordsText" rules={[{ required: true, whitespace: true }, { validator: (_, value: string) => value?.split(/[,\\n]/).some(keyword => keyword.trim()) ? Promise.resolve() : Promise.reject(new Error('Enter at least one keyword')) }]} extra="Separate keywords with commas or new lines. These are used to detect this skill in case descriptions."><Input.TextArea rows={3} placeholder={'baggage, luggage, lost bag\\ndelayed bag'} /></Form.Item>
          <div className="form-actions" style={{ marginTop: 'auto' }}><Button onClick={() => setSkillModalOpen(false)}>Cancel</Button><Button type="primary" htmlType="submit" loading={savingSkill}>{editingSkill ? 'Save changes' : 'Add skill'}</Button></div>
          </Form>
        </div>
      </Modal>
      <Modal title="Reassign case" open={!!reassignCase} onCancel={() => setReassignCase(null)} footer={null} destroyOnHidden>
        <div style={{ padding: '28px 36px', maxHeight: '58vh', overflowY: 'auto' }}>
          <p className="reassign-copy">Choose an available agent for <strong>{reassignCase?.title}</strong>.</p>
          <Form layout="vertical" onFinish={reassign}>
            <Form.Item name="agentId" label="Available agent" rules={[{ required: true, message: 'Choose an agent' }]}><Select placeholder="Select an agent" options={agents.filter(agent => agent.availabilityStatus === 'available' && agent.currentWorkload < agent.maxCapacity).map(agent => ({ value: agent.id, label: `${agent.name} · ${agent.currentWorkload}/${agent.maxCapacity} active` }))} /></Form.Item>
            <div className="form-actions"><Button onClick={() => setReassignCase(null)}>Cancel</Button><Button type="primary" htmlType="submit">Reassign case</Button></div>
          </Form>
        </div>
      </Modal>

      {/* Case Detail Modal */}
      <Modal
        title="Case Details"
        open={caseDetailVisible}
        onCancel={() => setCaseDetailVisible(false)}
        destroyOnHidden
        width={760}
        footer={[
          <Button key="back" onClick={() => setCaseDetailVisible(false)}>
            Back to List
          </Button>,
          page === 'supervisor' ? (
            <Button key="edit" type="primary" onClick={() => {
              // Find the case in the cases list and open editor
              const caseToEdit = cases.find(c => c.id === selectedCaseDetail?.id);
              if (caseToEdit) {
                setCaseDetailVisible(false);
                setPage('supervisor');
                openCaseEditor(caseToEdit);
              }
            }}>
              Edit Case
            </Button>
          ) : null
        ]}
      >
        {selectedCaseDetail ? (
          <div style={{ padding: '28px 36px', maxHeight: '58vh', overflowY: 'auto' }}>
            {/* Header Section */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: '#f0f2f6',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <InboxOutlined style={{ fontSize: '24px', color: '#5366bd' }} />
                </div>
                <div>
                  <Typography.Title level={4} style={{
                    margin: '0 0 8px 0',
                    fontSize: '20px',
                    fontWeight: 600,
                    lineHeight: '1.3'
                  }}>
                    {selectedCaseDetail.title}
                  </Typography.Title>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <Tag
                      color={priorityColors[selectedCaseDetail.priority] || 'default'}
                      style={{
                        fontWeight: 500,
                        padding: '4px 10px',
                        borderRadius: '4px'
                      }}
                    >
                      {(selectedCaseDetail.priority || 'normal').toUpperCase()}
                    </Tag>
                    <Tag
                      color={statusColors[selectedCaseDetail.status] || 'default'}
                      style={{
                        fontWeight: 500,
                        padding: '4px 10px',
                        borderRadius: '4px'
                      }}
                    >
                      {selectedCaseDetail.status === 'inProgress' ? 'In Progress' :
                        selectedCaseDetail.status.charAt(0).toUpperCase() +
                        selectedCaseDetail.status.slice(1).toLowerCase()}
                    </Tag>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '4px 8px',
                      background: '#e6f7ff',
                      border: '1px solid #91d5ff',
                      borderRadius: '4px',
                      fontSize: '13px'
                    }}>
                      <ChannelIcon channel={selectedCaseDetail.caseOrigin} />
                      <span>{channelNames[selectedCaseDetail.caseOrigin] || selectedCaseDetail.caseOrigin}</span>
                    </span>
                    {/* SLA time visible on top after email */}
                    {selectedCaseDetail.slaExpiration ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '4px 8px',
                        background: '#fff7e6',
                        border: '1px solid #ffd591',
                        borderRadius: '4px',
                        fontSize: '13px',
                        color: '#d48806'
                      }}>
                        <ClockCircleOutlined style={{ fontSize: '14px' }} />
                        <span>
                          {selectedCaseDetail.status === 'resolved' || selectedCaseDetail.status === 'closed'
                            ? 'Resolved'
                            : getSlaState(selectedCaseDetail.slaExpiration, Date.now()).label}
                        </span>
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '4px 8px',
                        background: '#f6ffed',
                        border: '1px solid #b7eb8f',
                        borderRadius: '4px',
                        fontSize: '13px',
                        color: '#52c41a',
                        marginLeft: '12px'
                      }}>
                        <ClockCircleOutlined style={{ fontSize: '14px' }} />
                        <span>No SLA</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Description Section */}
            <div style={{ marginBottom: '28px' }}>
              <Typography.Text style={{
                fontSize: '15px',
                fontWeight: 600,
                marginBottom: '12px',
                color: 'rgba(0, 0, 0, 0.85)'
              }}>
                Case Description
              </Typography.Text>
              <div style={{
                minHeight: '80px',
                padding: '20px',
                border: '1px solid #f0f2f6',
                borderRadius: '8px',
                background: '#fff',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}>
                {selectedCaseDetail.description || 'No description provided'}
              </div>
            </div>

            {/* Required Skills Section */}
            {selectedCaseDetail.requiredSkills && selectedCaseDetail.requiredSkills.length > 0 && (
              <div style={{ marginTop: '28px' }}>
                <Typography.Text style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  marginBottom: '12px',
                  color: 'rgba(0, 0, 0, 0.85)'
                }}>
                  Required Skills
                </Typography.Text>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginTop: '5px'
                }}>
                  {selectedCaseDetail.requiredSkills.map((skillId, index) => (
                    <span
                      key={index}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        background: '#e6f7ff',
                        border: '1px solid #91d5ff',
                        borderRadius: '5px',
                        fontSize: '13px',
                        fontWeight: 500,
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#d4e9ff';
                        e.currentTarget.style.borderColor = '#91d5ff';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#e6f7ff';
                        e.currentTarget.style.borderColor = '#91d5ff';
                        e.currentTarget.style.transform = 'translateY(0px)';
                      }}
                    >
                      {skills.find(skill => skill.id === skillId)?.name || 'Unknown skill'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Assigned Agent Section - Supervisor Only */}
            {page === 'supervisor' && selectedCaseDetail.assignedAgentId && (
              <div style={{ marginTop: '28px' }}>
                <Typography.Text style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  marginBottom: '12px',
                  color: 'rgba(0, 0, 0, 0.85)'
                }}>
                  Assigned Agent
                </Typography.Text>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '20px',
                  border: '1px solid #f0f2f6',
                  borderRadius: '8px',
                  background: '#fff'
                }}>
                  <Avatar
                    icon={<UserOutlined />}
                    style={{
                      width: '48px',
                      height: '48px',
                      background: '#e6f7ff',
                      color: '#5366bd',
                      fontSize: '20px',
                      fontWeight: 600
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography.Text style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      marginBottom: '4px'
                    }}>
                      {agents.find(agent => agent.id === selectedCaseDetail.assignedAgentId)?.name || 'Unassigned'}
                    </Typography.Text>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '56px 36px',
            color: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px'
          }}>
            <Spin style={{ fontSize: '32px' }} />
            <div style={{ marginTop: '24px', fontSize: '16px' }}>
              Loading case details...
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}

function Metric({ title, value, suffix, trend, icon, tone }: { title: string; value: number | string; suffix?: string; trend?: string; icon: ReactNode; tone: string }) {
  return <Card className="metric-card" bordered={false}><div className="metric-head"><span>{title}</span><span className={`metric-icon metric-${tone}`}>{icon}</span></div><Statistic value={value} suffix={suffix} precision={0} /><div className="metric-foot">{trend || 'Across all channels'}</div></Card>
}

function weeklyVolume(cases: ServiceCase[]) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    return { key: date.toDateString(), day: date.toLocaleDateString([], { weekday: 'short' }), cases: 0 }
  })
  for (const item of cases) {
    const day = days.find(entry => entry.key === new Date(item.createdAt).toDateString())
    if (day) day.cases += 1
  }
  return days
}

export default App
