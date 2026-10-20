# Omni-Channel Prototype — Current Product and Technical Plan

## Purpose

Build a local, working prototype of Salesforce Service Cloud Omni-Channel behavior for airline customer-support cases. The application accepts cases, identifies required skills, routes work to qualified agents, and provides supervisors and agents with queue and SLA visibility.

This document reflects the implementation currently in the repository. It replaces the earlier proposed architecture and file list where those no longer match the project.

## Current Implementation

### User experience

- **Overview:** operational metrics and case/agent summaries.
- **Supervisor workspace:** view the case queue and assignment details, manually reassign work, edit cases, reopen resolved or closed cases, and monitor SLA deadlines.
- **Agent workspace:** view assigned cases, accept or decline assignments, update case progress, and see SLA status.
- **Skills:** create and edit skills, including their names, descriptions, categories, and matching keywords.
- **Users:** list agents and supervisors, create and edit users, assign skills to agents, and set each assigned skill's proficiency from 1–5. Existing scores are shown when editing; new assignments default to 3 unless changed.
- **Case entry:** submit cases with channel, priority, title, and description. The backend infers case reason and required skills from the case content.

The interface is a local prototype; it does not currently implement user login or enforce supervisor-only access on API routes.

### Routing behavior

- A case must match **all** of its required skills to be eligible for assignment.
- Only users with the agent role, available status, remaining capacity, and non-zero proficiency in every required skill are eligible.
- Routing prioritizes the eligible agent with the lowest current workload; routing score breaks workload ties.
- The routing score factors skill proficiency, channel proficiency, and remaining capacity.
- A declined assignment is recorded. The same case is retried against eligible agents who have not already declined it.
- If no eligible agent remains, the case stays unassigned in the new-case queue.

### SLA behavior

- Cases receive an SLA deadline from case creation, based on **priority and channel**. The current configuration is:

| Priority | Web | Phone | Email | Social |
|---|---:|---:|---:|---:|
| Low | 4 hours | 1 hour | 8 hours | 2 hours |
| Medium | 2 hours | 30 minutes | 4 hours | 1 hour |
| High | 1 hour | 15 minutes | 2 hours | 30 minutes |
| Urgent | 30 minutes | 5 minutes | 1 hour | 15 minutes |

- If a priority/channel combination has no configured duration, the SLA calculator falls back to **1 hour**.
- Agent and supervisor views show the remaining time or overdue state, with the exact deadline available in the interface.
- Resolved and closed cases are shown as completed rather than with an active countdown.

## End-to-End Workflow

1. **Configure the team and skills.** A supervisor creates or edits skills with names, categories, descriptions, and classification keywords. They add or edit users, set agent availability and capacity, assign agent skills, and set proficiency from 1–5. New skill assignments default to 3/5.
2. **Submit a customer case.** A case is entered with a title, description, priority, and origin channel (`web`, `phone`, `email`, or `social`). The API validates the fields and stores the case.
3. **Classify the case and determine its requirements.** The backend analyzes the description to infer a case reason and the skill IDs required to handle the case.
4. **Set the SLA deadline.** The API calculates an expiration using the priority/channel SLA table, starting from case creation time. The deadline is stored on the case and is visible as a countdown or overdue indicator to agents and supervisors.
5. **Find an eligible agent and route the case.** The router requires a candidate to be an available agent with remaining capacity and non-zero proficiency in every required skill. It prioritizes the least-loaded eligible agent, using the weighted skill/channel/capacity score to break ties. The case and assignment record are saved, and the agent's workload is incremented. If no agent qualifies, the case remains new and unassigned.
6. **Work or decline the assignment.** The agent reviews the case and SLA, then accepts it or declines it. Accepting begins the normal case-progress flow. On decline, the assignment is recorded, workload is released, and routing retries eligible agents who have not already declined this case. If no candidate remains, the case returns to the unassigned queue.
7. **Monitor and manage the queue.** Supervisors review case status, workload, routing, and SLA indicators. They may reassign work, edit case details, or reopen a resolved/closed case. A reopened case is returned to the active queue and routed when an eligible agent is available.
8. **Recalculate the deadline after SLA-driving edits.** When priority or channel changes, the API recalculates `slaExpiration` using the updated priority/channel duration from the case's original `createdAt`. If neither changes, the existing deadline is preserved. The returned case data updates the displayed SLA countdown.
9. **Resolve the case.** The agent progresses the work through its lifecycle and marks it resolved (or it may be closed). The UI shows completed status rather than a running countdown; dashboard SLA compliance compares completed assignment times against the stored deadline.

All of these flows run locally through the React interface and Express API, with case, user, skill, and assignment data persisted in SQLite. This prototype does not authenticate users or enforce supervisor-only permissions at the API layer.

## Data and Technology

### Frontend

- React 19 and TypeScript
- Vite 8
- Ant Design 6
- Recharts for dashboard visualizations
- Fetch-based requests to the local REST API

### Backend and persistence

- Node.js and Express 5 (the backend is CommonJS JavaScript, not TypeScript)
- SQLite using Node's built-in `node:sqlite` `DatabaseSync`
- JSON-serialized arrays/objects for skill keywords, user skill assignments and proficiency, channel proficiency, and case required skills
- Local REST API; default frontend API URL is `http://localhost:5000/api`

### Main entities

- **User:** agent or supervisor, availability, workload/capacity, channel proficiency, and assigned skill/proficiency pairs.
- **Skill:** name, description, category, and keywords used by case classification.
- **Case:** customer inquiry, priority, origin channel, inferred reason and required skills, status, SLA deadline, and optional assigned agent.
- **Work item assignment:** case/agent routing record, status, channel, timestamps, and skill-match score.

### Stored fields and relationships

The database creates these tables directly in SQLite (`backend/database.js`). Application timestamps are ISO-8601 strings. JSON values are stored as text and decoded by the database mapping functions.

#### `skills`

| Field | SQLite type | Constraints / default | Meaning |
|---|---|---|---|
| `id` | TEXT | Primary key | UUID for the skill |
| `name` | TEXT | Required, unique | Display name |
| `description` | TEXT | Required, default `''` | Description of the skill |
| `category` | TEXT | Required, default `''` | Skill category |
| `isChannelSpecific` | INTEGER | Required, default `0` | Boolean flag, mapped to a boolean in API data |
| `keywords` | TEXT | Required, default `[]` | JSON array of case-classification terms |
| `createdAt` | TEXT | Required | Creation timestamp |
| `updatedAt` | TEXT | Required | Last-update timestamp |

#### `users`

| Field | SQLite type | Constraints / default | Meaning |
|---|---|---|---|
| `id` | TEXT | Primary key | UUID for the user |
| `name` | TEXT | Required | Display name |
| `email` | TEXT | Required, unique | User email |
| `role` | TEXT | Required | `agent` or `supervisor` |
| `availabilityStatus` | TEXT | Required, default `available` | Availability used by routing |
| `currentWorkload` | INTEGER | Required, default `0` | Current active assignment count |
| `maxCapacity` | INTEGER | Required, default `5` | Maximum active assignment count |
| `channelProficiency` | TEXT | Required, default `{}` | JSON object mapping channel names to proficiency values, e.g. `{ "web": 3, "phone": 4 }` |
| `skills` | TEXT | Required, default `[]` | JSON array of `{ "skillId": "…", "proficiency": 1 }` entries; proficiency is an integer from 1 to 5 |
| `createdAt` | TEXT | Required | Creation timestamp |
| `updatedAt` | TEXT | Required | Last-update timestamp |

Skill assignments are embedded in the user's `skills` JSON, rather than held in a separate join table. `skillId` refers to `skills.id`; proficiency belongs to that user-skill assignment.

#### `cases`

| Field | SQLite type | Constraints / default | Meaning |
|---|---|---|---|
| `id` | TEXT | Primary key | UUID for the case |
| `title` | TEXT | Required | Case title |
| `description` | TEXT | Required | Case details used for classification |
| `priority` | TEXT | Required | Case priority (`low`, `medium`, `high`, or `urgent`) |
| `caseOrigin` | TEXT | Required | Origin channel (`web`, `phone`, `email`, or `social`) |
| `caseReason` | TEXT | Required | Inferred reason/category |
| `status` | TEXT | Required, default `new` | Case lifecycle state |
| `requiredSkills` | TEXT | Required, default `[]` | JSON array of required skill IDs inferred from the case |
| `assignedAgentId` | TEXT | Foreign key to `users.id`, nullable | Currently assigned agent |
| `slaExpiration` | TEXT | Nullable | SLA deadline timestamp |
| `slaBreachRisk` | INTEGER | Required, default `0` | Boolean risk flag, mapped to a boolean in API data |
| `escalationLevel` | INTEGER | Required, default `0` | Escalation level counter |
| `createdAt` | TEXT | Required | Creation timestamp |
| `updatedAt` | TEXT | Required | Last-update timestamp |

#### `work_item_assignments`

| Field | SQLite type | Constraints / default | Meaning |
|---|---|---|---|
| `id` | TEXT | Primary key | UUID for the assignment |
| `caseId` | TEXT | Required, foreign key to `cases.id` | Assigned case |
| `agentId` | TEXT | Required, foreign key to `users.id` | Target agent |
| `assignedAt` | TEXT | Required | Assignment timestamp |
| `acceptedAt` | TEXT | Nullable | Acceptance timestamp |
| `completedAt` | TEXT | Nullable | Completion timestamp |
| `status` | TEXT | Required | Assignment lifecycle state, including declined assignments |
| `routingChannel` | TEXT | Required | Case channel used during routing |
| `skillMatchScore` | REAL | Required, default `0` | Routing skill-match score |
| `createdAt` | TEXT | Required | Record creation timestamp |
| `updatedAt` | TEXT | Required | Last-update timestamp |

Assignments preserve routing history: one case can have multiple assignment records, for example after an agent declines and routing retries another agent. The schema indexes case status/creation time and assignment agent/status and case/status lookups.

## API Surface

The backend currently provides:

- `GET /api/health`
- `GET`, `POST`, and `PATCH /api/skills` (updates use `/api/skills/:id`)
- `GET`, `POST`, and `PATCH /api/users` (updates use `/api/users/:id`)
- `GET /api/agents`
- `GET` and `POST /api/cases`, plus `PATCH /api/cases/:id` and `PATCH /api/cases/:id/reassign`
- `GET /api/assignments` and `PATCH /api/assignments/:id/:action`
- `GET /api/dashboard/stats`

## Verification

The frontend production build is checked with `npm run build`. Backend JavaScript syntax can be checked with `node --check server.js`. The repository does not currently define an automated test suite; backend `npm test` is still the default placeholder and is not a passing test suite.

When validating changes, prioritize these flows:

1. Create/edit a skill and use its keywords in a submitted case.
2. Create/edit an agent, assign one or more skills, change individual proficiency scores, save, and verify the scores remain after refreshing/reopening the user.
3. Submit cases that require different skills/channels and verify classification and routing eligibility.
4. Confirm a free matching agent is selected ahead of a more-loaded one.
5. Decline assignments in sequence and verify retries exclude agents who already declined; verify the case remains unassigned when none remain.
6. Edit/reopen a case and confirm its queue/routing state.
7. Confirm agent and supervisor SLA indicators update and completed cases stop counting down.

## Deliberate Scope and Future Work

The following items from the original proposal are not part of the current implementation and should not be treated as completed requirements unless requested:

- PostgreSQL, Sequelize, migrations, or PostgreSQL setup instructions; the project uses SQLite directly.
- JWT authentication, login/registration, or API-level role authorization.
- WebSockets or other real-time push updates.
- Per-channel availability schedules, shift management, skill certifications/expiry, or configurable routing rules.
- Automatic SLA escalation actions such as priority changes or SLA-driven reassignment.
- Advanced analytics/reports such as channel effectiveness, response-time trends, and productivity per hour.
- A separate customer-facing application, Salesforce DX integration, or Salesforce-hosted deployment.

These may be considered as future enhancements, but should not be added implicitly as prerequisites for this local prototype.
