import type { TaskStatus, UserRole } from "@/types/domain"

export const statusLabel: Record<TaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  review: "На проверке",
  accepted: "Принята",
  rework: "На доработке",
}

export const roleLabel: Record<UserRole, string> = {
  manager: "Постановщик",
  executor: "Исполнитель",
}

export function transitionLabel(from: TaskStatus | null, to: TaskStatus): string {
  if (!from) return `Создана со статусом «${statusLabel[to]}»`
  return `${statusLabel[from]} → ${statusLabel[to]}`
}
