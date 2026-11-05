import { supabase } from "@/lib/supabase"
import {
  parseHistory,
  parseObject,
  parseProfile,
  parseTask,
  type HistoryEntry,
  type Profile,
  type SiteObject,
  type Task,
  type TaskStatus,
} from "@/types/domain"

export type Result<T> = { data: T; error: null } | { data: null; error: string }

export function isFailure<T>(result: Result<T>): result is { data: null; error: string } {
  return result.error !== null
}

export type HistoryView = HistoryEntry & { actorName: string }

export type TaskListItem = Task & { assigneeName: string; objectTitle: string }

function client() {
  return supabase
}

function failure(error: { message: string } | null, fallback: string): string {
  return error?.message || fallback
}

function rowsOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export async function listObjects(): Promise<Result<SiteObject[]>> {
  const db = client()
  if (!db) return { data: null, error: "Нет подключения к Supabase" }
  const { data, error } = await db.from("objects").select("*").order("created_at", { ascending: false })
  if (error) return { data: null, error: failure(error, "Не удалось загрузить объекты") }
  return { data: rowsOf(data).flatMap((row) => { const item = parseObject(row); return item ? [item] : [] }), error: null }
}

export async function createObject(input: {
  title: string
  address: string
  createdBy: string
}): Promise<Result<true>> {
  const db = client()
  if (!db) return { data: null, error: "Нет подключения к Supabase" }
  const { error } = await db.from("objects").insert({
    title: input.title.trim(),
    address: input.address.trim(),
    created_by: input.createdBy,
  })
  if (error) return { data: null, error: failure(error, "Не удалось создать объект") }
  return { data: true, error: null }
}

export async function updateObject(id: string, input: { title: string; address: string }): Promise<Result<true>> {
  const db = client()
  if (!db) return { data: null, error: "Нет подключения к Supabase" }
  const { data, error } = await db
    .from("objects")
    .update({ title: input.title.trim(), address: input.address.trim() })
    .eq("id", id)
    .select("id")
  if (error) return { data: null, error: failure(error, "Не удалось сохранить объект") }
  if (rowsOf(data).length === 0) return { data: null, error: "Не удалось сохранить объект" }
  return { data: true, error: null }
}

export async function deleteObject(id: string): Promise<Result<true>> {
  const db = client()
  if (!db) return { data: null, error: "Нет подключения к Supabase" }
  const { data, error } = await db.from("objects").delete().eq("id", id).select("id")
  if (error) return { data: null, error: failure(error, "Не удалось удалить объект") }
  if (rowsOf(data).length === 0) return { data: null, error: "Не удалось удалить объект" }
  return { data: true, error: null }
}

export async function getObject(id: string): Promise<Result<SiteObject>> {
  const db = client()
  if (!db) return { data: null, error: "Нет подключения к Supabase" }
  const { data, error } = await db.from("objects").select("*").eq("id", id).maybeSingle()
  if (error) return { data: null, error: failure(error, "Не удалось загрузить объект") }
  const object = parseObject(data)
  if (!object) return { data: null, error: "Объект не найден или нет доступа" }
  return { data: object, error: null }
}

async function namesById(ids: string[]): Promise<Result<Map<string, string>>> {
  const db = client()
  if (!db) return { data: null, error: "Нет подключения к Supabase" }
  const unique = [...new Set(ids)]
  if (unique.length === 0) return { data: new Map(), error: null }
  const { data, error } = await db.from("profiles").select("id, full_name, role").in("id", unique)
  if (error) return { data: null, error: failure(error, "Не удалось загрузить имена") }
  const names = new Map<string, string>()
  for (const row of rowsOf(data)) {
    const profile = parseProfile(row)
    if (profile) names.set(profile.id, profile.full_name)
  }
  return { data: names, error: null }
}

export async function listTasksByObject(objectId: string): Promise<Result<TaskListItem[]>> {
  const db = client()
  if (!db) return { data: null, error: "Нет подключения к Supabase" }
  const { data, error } = await db
    .from("tasks")
    .select("*")
    .eq("object_id", objectId)
    .order("created_at", { ascending: false })
  if (error) return { data: null, error: failure(error, "Не удалось загрузить задачи") }
  const tasks = rowsOf(data).flatMap((row) => {
    const task = parseTask(row)
    return task ? [task] : []
  })
  const names = await namesById(tasks.map((task) => task.assignee_id))
  if (isFailure(names)) return { data: null, error: names.error }
  return {
    data: tasks.map((task) => ({
      ...task,
      assigneeName: names.data.get(task.assignee_id) ?? "Неизвестный пользователь",
      objectTitle: "",
    })),
    error: null,
  }
}

export async function listMyTasks(assigneeId: string): Promise<Result<TaskListItem[]>> {
  const db = client()
  if (!db) return { data: null, error: "Нет подключения к Supabase" }
  const { data, error } = await db
    .from("tasks")
    .select("*")
    .eq("assignee_id", assigneeId)
    .order("created_at", { ascending: false })
  if (error) return { data: null, error: failure(error, "Не удалось загрузить задачи") }
  const tasks = rowsOf(data).flatMap((row) => {
    const task = parseTask(row)
    return task ? [task] : []
  })
  const [names, objects] = await Promise.all([
    namesById(tasks.map((task) => task.assignee_id)),
    listObjects(),
  ])
  if (isFailure(names)) return { data: null, error: names.error }
  if (isFailure(objects)) return { data: null, error: objects.error }
  const titles = new Map(objects.data.map((object) => [object.id, object.title]))
  return {
    data: tasks.map((task) => ({
      ...task,
      assigneeName: names.data.get(task.assignee_id) ?? "Неизвестный пользователь",
      objectTitle: titles.get(task.object_id) ?? "Объект",
    })),
    error: null,
  }
}

export async function listExecutors(): Promise<Result<Profile[]>> {
  const db = client()
  if (!db) return { data: null, error: "Нет подключения к Supabase" }
  const { data, error } = await db.from("profiles").select("id, full_name, role").eq("role", "executor").order("full_name")
  if (error) return { data: null, error: failure(error, "Не удалось загрузить исполнителей") }
  return {
    data: rowsOf(data).flatMap((row) => {
      const profile = parseProfile(row)
      return profile ? [profile] : []
    }),
    error: null,
  }
}

export async function createTask(input: {
  objectId: string
  title: string
  description: string
  assigneeId: string
  authorId: string
}): Promise<Result<true>> {
  const db = client()
  if (!db) return { data: null, error: "Нет подключения к Supabase" }
  const { error } = await db.from("tasks").insert({
    object_id: input.objectId,
    title: input.title.trim(),
    description: input.description.trim(),
    assignee_id: input.assigneeId,
    author_id: input.authorId,
    status: "new",
  })
  if (error) return { data: null, error: failure(error, "Не удалось создать задачу") }
  return { data: true, error: null }
}

export async function updateTask(
  id: string,
  input: { title: string; description: string; objectId: string; assigneeId: string },
): Promise<Result<true>> {
  const db = client()
  if (!db) return { data: null, error: "Нет подключения к Supabase" }
  const { data, error } = await db
    .from("tasks")
    .update({
      title: input.title.trim(),
      description: input.description.trim(),
      object_id: input.objectId,
      assignee_id: input.assigneeId,
    })
    .eq("id", id)
    .select("id")
  if (error) return { data: null, error: failure(error, "Не удалось сохранить задачу") }
  if (rowsOf(data).length === 0) return { data: null, error: "Не удалось сохранить задачу" }
  return { data: true, error: null }
}

export async function deleteTask(id: string): Promise<Result<true>> {
  const db = client()
  if (!db) return { data: null, error: "Нет подключения к Supabase" }
  const { data, error } = await db.from("tasks").delete().eq("id", id).select("id")
  if (error) return { data: null, error: failure(error, "Не удалось удалить задачу") }
  if (rowsOf(data).length === 0) return { data: null, error: "Не удалось удалить задачу" }
  return { data: true, error: null }
}

export async function loadTask(taskId: string): Promise<
  Result<{
    task: Task
    object: SiteObject
    assigneeName: string
    authorName: string
    history: HistoryView[]
  }>
> {
  const db = client()
  if (!db) return { data: null, error: "Нет подключения к Supabase" }
  const taskResult = await db.from("tasks").select("*").eq("id", taskId).maybeSingle()
  if (taskResult.error) return { data: null, error: failure(taskResult.error, "Не удалось загрузить задачу") }
  const task = parseTask(taskResult.data)
  if (!task) return { data: null, error: "Задача не найдена или нет доступа" }

  const [objectResult, historyResult] = await Promise.all([
    db.from("objects").select("*").eq("id", task.object_id).maybeSingle(),
    db.from("task_status_history").select("*").eq("task_id", task.id).order("created_at", { ascending: true }),
  ])
  if (objectResult.error) return { data: null, error: failure(objectResult.error, "Не удалось загрузить объект") }
  if (historyResult.error) return { data: null, error: failure(historyResult.error, "Не удалось загрузить историю") }
  const object = parseObject(objectResult.data)
  if (!object) return { data: null, error: "Объект не найден или нет доступа" }
  const history = rowsOf(historyResult.data).flatMap((row) => {
    const entry = parseHistory(row)
    return entry ? [entry] : []
  })
  const names = await namesById([task.assignee_id, task.author_id, ...history.map((entry) => entry.actor_id)])
  if (isFailure(names)) return { data: null, error: names.error }
  return {
    data: {
      task,
      object,
      assigneeName: names.data.get(task.assignee_id) ?? "Неизвестный пользователь",
      authorName: names.data.get(task.author_id) ?? "Неизвестный пользователь",
      history: history.map((entry) => ({
        ...entry,
        actorName: names.data.get(entry.actor_id) ?? "Неизвестный пользователь",
      })),
    },
    error: null,
  }
}

export async function transitionTask(
  taskId: string,
  toStatus: TaskStatus,
  comment: string | null,
): Promise<Result<true>> {
  const db = client()
  if (!db) return { data: null, error: "Нет подключения к Supabase" }
  const { error } = await db.rpc("transition_task", {
    task_id: taskId,
    to_status: toStatus,
    comment,
  })
  if (error) return { data: null, error: failure(error, "Не удалось сменить статус") }
  return { data: true, error: null }
}
