import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Field, SelectField } from "@/components/Field"
import { HistoryList } from "@/components/HistoryList"
import { Notice } from "@/components/Notice"
import { StatusBadge } from "@/components/StatusBadge"
import { TaskActions } from "@/components/TaskActions"
import {
  deleteTask,
  listExecutors,
  listObjects,
  loadTask,
  transitionTask,
  updateTask,
  type HistoryView,
} from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDate } from "@/lib/format"
import { actionsFor, type TaskAction } from "@/lib/task-actions"
import type { Profile, SiteObject, Task } from "@/types/domain"

export function TaskPage() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [task, setTask] = useState<Task | null>(null)
  const [objectTitle, setObjectTitle] = useState("")
  const [objectId, setObjectId] = useState("")
  const [assigneeName, setAssigneeName] = useState("")
  const [authorName, setAuthorName] = useState("")
  const [history, setHistory] = useState<HistoryView[]>([])
  const [objects, setObjects] = useState<SiteObject[]>([])
  const [executors, setExecutors] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [assigneeId, setAssigneeId] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    void Promise.all([loadTask(id), listObjects(), listExecutors()]).then(([taskResult, objectResult, executorResult]) => {
      if (!active) return
      if (taskResult.error || !taskResult.data) {
        setTask(null)
        setError(taskResult.error ?? "Задача не найдена или нет доступа")
      } else {
        const details = taskResult.data
        setTask(details.task)
        setTitle(details.task.title)
        setDescription(details.task.description)
        setAssigneeId(details.task.assignee_id)
        setObjectId(details.task.object_id)
        setObjectTitle(details.object.title)
        setAssigneeName(details.assigneeName)
        setAuthorName(details.authorName)
        setHistory(details.history)
        setError(objectResult.error ?? executorResult.error)
      }
      setObjects(objectResult.data ?? [])
      setExecutors(executorResult.data ?? [])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [id, version])

  if (!profile) return null
  if (loading) return <p className="page-state">Загрузка…</p>
  if (!task) return <Notice>{error ?? "Задача не найдена или нет доступа"}</Notice>

  const actions =
    profile.role === "executor" && task.assignee_id !== profile.id ? [] : actionsFor(profile.role, task.status)

  async function onTransition(action: TaskAction, comment: string) {
    if (!task) return
    setPending(true)
    const result = await transitionTask(task.id, action.toStatus, action.needsComment ? comment : null)
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setError(null)
    setVersion((value) => value + 1)
  }

  async function onSave() {
    if (!task) return
    setPending(true)
    const result = await updateTask(task.id, { title, description, objectId, assigneeId })
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setEditing(false)
    setVersion((value) => value + 1)
  }

  async function onDelete() {
    if (!task) return
    if (!window.confirm("Удалить задачу вместе с историей?")) return
    setPending(true)
    const result = await deleteTask(task.id)
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    void navigate(`/objects/${task.object_id}`)
  }

  const waiting =
    actions.length > 0
      ? null
      : task.status === "accepted"
        ? "Задача принята. Дальше статус не меняется."
        : profile.role === "manager"
          ? "Дальше статус меняет назначенный исполнитель."
          : "Дальше статус меняет постановщик."

  return (
    <article className="task-card">
      <Link className="task-card__back" to={`/objects/${task.object_id}`}>
        {objectTitle}
      </Link>
      <div className="task-card__heading">
        <h1 className="task-card__title">{task.title}</h1>
        <StatusBadge status={task.status} />
      </div>
      <dl className="task-card__meta">
        <div className="task-card__meta-row">
          <dt className="task-card__meta-label">Исполнитель</dt>
          <dd className="task-card__meta-value">{assigneeName}</dd>
        </div>
        <div className="task-card__meta-row">
          <dt className="task-card__meta-label">Автор</dt>
          <dd className="task-card__meta-value">{authorName}</dd>
        </div>
        <div className="task-card__meta-row">
          <dt className="task-card__meta-label">Создана</dt>
          <dd className="task-card__meta-value">{formatDate(task.created_at)}</dd>
        </div>
      </dl>
      <p className="task-card__description">{task.description || "Без описания"}</p>
      {profile.role === "manager" ? (
        <div className="task-card__toolbar">
          <button className="ui-button ui-button--ghost" onClick={() => setEditing((value) => !value)} type="button">
            {editing ? "Закрыть" : "Изменить"}
          </button>
          <button className="ui-button ui-button--danger" disabled={pending} onClick={() => void onDelete()} type="button">
            Удалить
          </button>
        </div>
      ) : null}
      {editing ? (
        <form
          className="editor"
          onSubmit={(event) => {
            event.preventDefault()
            void onSave()
          }}
        >
          <Field label="Название" onChange={setTitle} value={title} />
          <Field label="Описание" multiline onChange={setDescription} value={description} />
          <SelectField
            label="Объект"
            onChange={setObjectId}
            options={objects.map((object) => ({ value: object.id, label: object.title }))}
            value={objectId}
          />
          <SelectField
            label="Исполнитель"
            onChange={setAssigneeId}
            options={executors.map((executor) => ({ value: executor.id, label: executor.full_name }))}
            value={assigneeId}
          />
          <button className="ui-button ui-button--primary" disabled={pending || title.trim() === ""} type="submit">
            Сохранить
          </button>
        </form>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
      <TaskActions actions={actions} onTransition={(action, comment) => void onTransition(action, comment)} pending={pending} />
      {waiting ? <p className="page-state">{waiting}</p> : null}
      <HistoryList entries={history} />
    </article>
  )
}
