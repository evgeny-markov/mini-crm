import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Field } from "@/components/Field"
import { Notice } from "@/components/Notice"
import { createObject, isFailure, listObjects } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { SiteObject } from "@/types/domain"

export function ObjectsPage() {
  const { profile } = useAuth()
  const [objects, setObjects] = useState<SiteObject[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState("")
  const [address, setAddress] = useState("")
  const [pending, setPending] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    void listObjects().then((result) => {
      if (!active) return
      if (isFailure(result)) setError(result.error)
      else {
        setError(null)
        setObjects(result.data)
      }
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [version])

  if (!profile) return null

  async function onCreate() {
    if (!profile) return
    setPending(true)
    const result = await createObject({ title, address, createdBy: profile.id })
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setTitle("")
    setAddress("")
    setVersion((value) => value + 1)
  }

  return (
    <section className="object-list">
      <h1 className="object-list__heading">Объекты</h1>
      {profile.role === "manager" ? (
        <form
          className="editor"
          onSubmit={(event) => {
            event.preventDefault()
            void onCreate()
          }}
        >
          <h2 className="editor__title">Новый объект</h2>
          <Field label="Название" onChange={setTitle} value={title} />
          <Field label="Адрес" onChange={setAddress} value={address} />
          <button className="ui-button ui-button--primary" disabled={pending || title.trim() === "" || address.trim() === ""} type="submit">
            Создать
          </button>
        </form>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
      {loading ? <p className="page-state">Загрузка…</p> : null}
      {!loading && objects.length === 0 ? <p className="page-state">Объектов пока нет.</p> : null}
      <ul className="object-list__items">
        {objects.map((object) => (
          <li className="object-list__item" key={object.id}>
            <Link className="object-list__link" to={`/objects/${object.id}`}>
              <span className="object-list__title">{object.title}</span>
              <span className="object-list__address">{object.address}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
