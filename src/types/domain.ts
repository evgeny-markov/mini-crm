export const taskStatuses = ["new", "in_progress", "review", "accepted", "rework"] as const

export type TaskStatus = (typeof taskStatuses)[number]
export type UserRole = "manager" | "executor"

export type Profile = {
  id: string
  full_name: string
  role: UserRole
}

export type SiteObject = {
  id: string
  title: string
  address: string
  created_by: string
  created_at: string
}

export type Task = {
  id: string
  object_id: string
  title: string
  description: string
  assignee_id: string
  status: TaskStatus
  author_id: string
  created_at: string
}

export type HistoryEntry = {
  id: string
  task_id: string
  actor_id: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  comment: string | null
  created_at: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function isRole(value: unknown): value is UserRole {
  return value === "manager" || value === "executor"
}

export function isStatus(value: unknown): value is TaskStatus {
  return taskStatuses.some((status) => status === value)
}

export function parseProfile(value: unknown): Profile | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== "string" || typeof value.full_name !== "string" || !isRole(value.role)) {
    return null
  }
  return { id: value.id, full_name: value.full_name, role: value.role }
}

export function parseObject(value: unknown): SiteObject | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.address !== "string" ||
    typeof value.created_by !== "string" ||
    typeof value.created_at !== "string"
  ) {
    return null
  }
  return {
    id: value.id,
    title: value.title,
    address: value.address,
    created_by: value.created_by,
    created_at: value.created_at,
  }
}

export function parseTask(value: unknown): Task | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== "string" ||
    typeof value.object_id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.description !== "string" ||
    typeof value.assignee_id !== "string" ||
    typeof value.author_id !== "string" ||
    typeof value.created_at !== "string" ||
    !isStatus(value.status)
  ) {
    return null
  }
  return {
    id: value.id,
    object_id: value.object_id,
    title: value.title,
    description: value.description,
    assignee_id: value.assignee_id,
    status: value.status,
    author_id: value.author_id,
    created_at: value.created_at,
  }
}

export function parseHistory(value: unknown): HistoryEntry | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== "string" ||
    typeof value.task_id !== "string" ||
    typeof value.actor_id !== "string" ||
    typeof value.created_at !== "string" ||
    !isStatus(value.to_status) ||
    (value.from_status !== null && !isStatus(value.from_status)) ||
    (value.comment !== null && typeof value.comment !== "string")
  ) {
    return null
  }
  return {
    id: value.id,
    task_id: value.task_id,
    actor_id: value.actor_id,
    from_status: isStatus(value.from_status) ? value.from_status : null,
    to_status: value.to_status,
    comment: typeof value.comment === "string" ? value.comment : null,
    created_at: value.created_at,
  }
}
