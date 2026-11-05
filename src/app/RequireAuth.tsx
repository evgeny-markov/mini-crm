import { Navigate, Outlet } from "react-router-dom"
import { Notice } from "@/components/Notice"
import { useAuth } from "@/lib/auth"
import { supabaseConfigError } from "@/lib/supabase"

export function RequireAuth() {
  const { ready, session, profile, profileError } = useAuth()

  if (supabaseConfigError) {
    return (
      <main className="login">
        <Notice>{supabaseConfigError}</Notice>
      </main>
    )
  }

  if (!ready) return <p className="page-state">Загрузка…</p>
  if (!session) return <Navigate replace to="/login" />
  if (profileError) {
    return (
      <main className="login">
        <Notice>{profileError}</Notice>
      </main>
    )
  }
  if (!profile) return <p className="page-state">Загрузка…</p>
  return <Outlet />
}
