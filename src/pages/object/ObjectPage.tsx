import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Field, SelectField } from "@/components/Field"
import { Notice } from "@/components/Notice"
import { StatusBadge } from "@/components/StatusBadge"
import {
  createTask,
  deleteObject,
  getObject,
  isFailure,
  listExecutors,
  listTasksByObject,
  updateObject,
  type TaskListItem,
} from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { Profile, SiteObject } from "@/types/domain"

export function ObjectPage() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [object, setObject] = useState<SiteObject | null>(null)
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [executors, setExecutors] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState("")
  const [address, setAddress] = useState("")
  const [taskTitle, setTaskTitle] = useState("")
  const [description, setDescription] = useState("")
  const [assigneeId, setAssigneeId] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    void Promise.all([getObject(id), listTasksByObject(id), listExecutors()]).then(([objectResult, taskResult, executorResult]) => {
      if (!active) return
      if (isFailure(objectResult)) {
        setObject(null)
        setError(objectResult.error)
      } else {
        setObject(objectResult.data)
        setTitle(objectResult.data.title)
        setAddress(objectResult.data.address)
        setError(taskResult.error ?? executorResult.error)
      }
      setTasks(taskResult.data ?? [])
      const nextExecutors = executorResult.data ?? []
      setExecutors(nextExecutors)
      setAssigneeId((current) => current || nextExecutors[0]?.id || "")
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [id, version])

  if (!profile) return null
  if (loading) return <p className="page-state">Загрузка…</p>
  if (!object) return <Notice>{error ?? "Объект не найден или нет доступа"}</Notice>

  async function onSaveObject() {
    if (!object) return
    setPending(true)
    const result = await updateObject(object.id, { title, address })
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setEditing(false)
    setVersion((value) => value + 1)
  }

  async function onDeleteObject() {
    if (!object) return
    if (!window.confirm("Удалить объект вместе с задачами и их историей?")) return
    setPending(true)
    const result = await deleteObject(object.id)
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    void navigate("/objects")
  }

  async function onCreateTask() {
    if (!object || !profile) return
    setPending(true)
    const result = await createTask({
      objectId: object.id,
      title: taskTitle,
      description,
      assigneeId,
      authorId: profile.id,
    })
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setTaskTitle("")
    setDescription("")
    setVersion((value) => value + 1)
  }

  return (
    <article className="object-card">
      <Link className="object-card__back" to="/objects">
        Все объекты
      </Link>
      <h1 className="object-card__title">{object.title}</h1>
      <p className="object-card__address">{object.address}</p>
      {profile.role === "manager" ? (
        <div className="object-card__toolbar">
          <button className="ui-button ui-button--ghost" onClick={() => setEditing((value) => !value)} type="button">
            {editing ? "Закрыть" : "Изменить"}
          </button>
          <button className="ui-button ui-button--danger" disabled={pending} onClick={() => void onDeleteObject()} type="button">
            Удалить
          </button>
        </div>
      ) : null}
      {editing ? (
        <form
          className="editor"
          onSubmit={(event) => {
            event.preventDefault()
            void onSaveObject()
          }}
        >
          <Field label="Название" onChange={setTitle} value={title} />
          <Field label="Адрес" onChange={setAddress} value={address} />
          <button className="ui-button ui-button--primary" disabled={pending} type="submit">
            Сохранить
          </button>
        </form>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
      <h2 className="object-card__subtitle">Задачи</h2>
      {tasks.length === 0 ? <p className="page-state">Задач пока нет.</p> : null}
      <ul className="object-card__tasks">
        {tasks.map((task) => (
          <li className="object-card__task" key={task.id}>
            <Link className="object-card__task-link" to={`/tasks/${task.id}`}>
              <span className="object-card__task-title">{task.title}</span>
              <span className="object-card__task-meta">{task.assigneeName}</span>
              <StatusBadge status={task.status} />
            </Link>
          </li>
        ))}
      </ul>
      {profile.role === "manager" ? (
        <form
          className="editor"
          onSubmit={(event) => {
            event.preventDefault()
            void onCreateTask()
          }}
        >
          <h2 className="editor__title">Новая задача</h2>
          <Field label="Название" onChange={setTaskTitle} value={taskTitle} />
          <Field label="Описание" multiline onChange={setDescription} value={description} />
          <SelectField
            label="Исполнитель"
            onChange={setAssigneeId}
            options={executors.map((executor) => ({ value: executor.id, label: executor.full_name }))}
            value={assigneeId}
          />
          <button
            className="ui-button ui-button--primary"
            disabled={pending || taskTitle.trim() === "" || assigneeId === ""}
            type="submit"
          >
            Поставить задачу
          </button>
        </form>
      ) : null}
    </article>
  )
}
