import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Notice } from "@/components/Notice"
import { StatusBadge } from "@/components/StatusBadge"
import { isFailure, listMyTasks, type TaskListItem } from "@/lib/api"
import { useAuth } from "@/lib/auth"

export function MyTasksPage() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile || profile.role !== "executor") return
    let active = true
    void listMyTasks(profile.id).then((result) => {
      if (!active) return
      if (isFailure(result)) setError(result.error)
      else setTasks(result.data)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [profile])

  if (!profile) return null
  if (profile.role !== "executor") {
    return (
      <section className="task-list">
        <h1 className="task-list__heading">Мои задачи</h1>
        <p className="page-state">Этот экран для исполнителя.</p>
        <Link className="task-list__back" to="/objects">
          К объектам
        </Link>
      </section>
    )
  }

  return (
    <section className="task-list">
      <h1 className="task-list__heading">Мои задачи</h1>
      {error ? <Notice>{error}</Notice> : null}
      {loading ? <p className="page-state">Загрузка…</p> : null}
      {!loading && tasks.length === 0 ? <p className="page-state">Назначенных задач нет.</p> : null}
      <ul className="task-list__items">
        {tasks.map((task) => (
          <li className="task-list__item" key={task.id}>
            <Link className="task-list__link" to={`/tasks/${task.id}`}>
              <span className="task-list__title">{task.title}</span>
              <span className="task-list__object">{task.objectTitle}</span>
              <StatusBadge status={task.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
