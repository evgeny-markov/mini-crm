import type { TaskStatus, UserRole } from "@/types/domain"

export type TaskAction = {
  toStatus: TaskStatus
  label: string
  needsComment: boolean
}

const actions: Record<TaskStatus, Partial<Record<UserRole, TaskAction[]>>> = {
  new: {
    executor: [{ toStatus: "in_progress", label: "В работу", needsComment: false }],
  },
  in_progress: {
    executor: [{ toStatus: "review", label: "На проверку", needsComment: false }],
  },
  review: {
    manager: [
      { toStatus: "accepted", label: "Принять", needsComment: false },
      { toStatus: "rework", label: "На доработку", needsComment: true },
    ],
  },
  rework: {
    executor: [{ toStatus: "in_progress", label: "В работу", needsComment: false }],
  },
  accepted: {},
}

export function actionsFor(role: UserRole, status: TaskStatus): TaskAction[] {
  return actions[status][role] ?? []
}
