import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AppShell } from "@/app/AppShell"
import { RequireAuth } from "@/app/RequireAuth"
import { AuthProvider } from "@/lib/auth"
import { LoginPage } from "@/pages/login/LoginPage"
import { MyTasksPage } from "@/pages/my-tasks/MyTasksPage"
import { ObjectPage } from "@/pages/object/ObjectPage"
import { ObjectsPage } from "@/pages/objects/ObjectsPage"
import { TaskPage } from "@/pages/task/TaskPage"

function routerBasename(): string | undefined {
  const base = import.meta.env.BASE_URL
  if (!base || base === "/") return undefined
  return base.endsWith("/") ? base.slice(0, -1) : base
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={routerBasename()}>
        <Routes>
          <Route element={<LoginPage />} path="/login" />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route element={<Navigate replace to="/objects" />} path="/" />
              <Route element={<ObjectsPage />} path="/objects" />
              <Route element={<ObjectPage />} path="/objects/:id" />
              <Route element={<TaskPage />} path="/tasks/:id" />
              <Route element={<MyTasksPage />} path="/my-tasks" />
            </Route>
          </Route>
          <Route element={<Navigate replace to="/objects" />} path="*" />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
