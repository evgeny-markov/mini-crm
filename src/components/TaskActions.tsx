import { useState } from "react"
import type { TaskAction } from "@/lib/task-actions"
import { Field } from "@/components/Field"

type TaskActionsProps = {
  actions: TaskAction[]
  pending: boolean
  onTransition: (action: TaskAction, comment: string) => void
}

export function TaskActions({ actions, pending, onTransition }: TaskActionsProps) {
  const [comment, setComment] = useState("")
  const needsComment = actions.some((action) => action.needsComment)
  if (actions.length === 0) return null

  return (
    <div className="task-actions">
      {needsComment ? (
        <Field label="Комментарий для доработки" multiline onChange={setComment} value={comment} />
      ) : null}
      <div className="task-actions__row">
        {actions.map((action) => (
          <button
            className={action.needsComment ? "ui-button" : "ui-button ui-button--primary"}
            disabled={pending || (action.needsComment && comment.trim() === "")}
            key={action.toStatus}
            onClick={() => onTransition(action, comment.trim())}
            type="button"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
