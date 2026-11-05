import { NavLink, Outlet } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import { roleLabel } from "@/types/labels"

export function AppShell() {
  const { profile, signOut } = useAuth()
  if (!profile) return null

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand">
          <p className="app-shell__title">Объекты и задачи</p>
          <p className="app-shell__user">
            {profile.full_name}, {roleLabel[profile.role]}
          </p>
        </div>
        <nav className="app-shell__nav">
          <NavLink
            className={({ isActive }) => (isActive ? "app-shell__link is-current" : "app-shell__link")}
            to="/objects"
          >
            Объекты
          </NavLink>
          {profile.role === "executor" ? (
            <NavLink
              className={({ isActive }) => (isActive ? "app-shell__link is-current" : "app-shell__link")}
              to="/my-tasks"
            >
              Мои задачи
            </NavLink>
          ) : null}
        </nav>
        <button className="app-shell__logout ui-button ui-button--ghost" onClick={() => void signOut()} type="button">
          Выйти
        </button>
      </header>
      <main className="app-shell__main">
        <Outlet />
      </main>
    </div>
  )
}
