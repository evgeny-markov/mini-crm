import type { TaskStatus } from "@/types/domain"
import { statusLabel } from "@/types/labels"

const modifier: Record<TaskStatus, string> = {
  new: "status status--new",
  in_progress: "status status--in-progress",
  review: "status status--review",
  accepted: "status status--accepted",
  rework: "status status--rework",
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={modifier[status]}>{statusLabel[status]}</span>
}
