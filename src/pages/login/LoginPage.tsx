import { useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import { Notice } from "@/components/Notice"
import { useAuth } from "@/lib/auth"
import { supabase, supabaseConfigError } from "@/lib/supabase"

export function LoginPage() {
  const { session, profile, ready } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (supabaseConfigError) {
    return (
      <main className="login">
        <section className="login__panel">
          <h1 className="login__title">Объекты и задачи</h1>
          <Notice>{supabaseConfigError}</Notice>
        </section>
      </main>
    )
  }

  if (ready && session && profile) return <Navigate replace to="/objects" />

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setPending(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setPending(false)
    if (signInError) {
      setError(signInError.code === "invalid_credentials" ? "Неверный email или пароль" : signInError.message)
    }
  }

  return (
    <main className="login">
      <section className="login__panel">
        <h1 className="login__title">Объекты и задачи</h1>
        <p className="login__lead">Вход для постановщика и исполнителя. Учётную запись выдаёт администратор.</p>
        <form className="editor" onSubmit={(event) => void onSubmit(event)}>
          <label className="field">
            <span className="field__label">Email</span>
            <input
              autoComplete="username"
              className="field__control"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label className="field">
            <span className="field__label">Пароль</span>
            <input
              autoComplete="current-password"
              className="field__control"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          {error ? <Notice>{error}</Notice> : null}
          <button className="ui-button ui-button--primary" disabled={pending} type="submit">
            Войти
          </button>
        </form>
      </section>
    </main>
  )
}
