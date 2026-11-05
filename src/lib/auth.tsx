import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { parseProfile, type Profile } from "@/types/domain"

type AuthValue = {
  ready: boolean
  session: Session | null
  profile: Profile | null
  profileError: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileReady, setProfileReady] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setSessionReady(true)
      setProfileReady(true)
      return
    }

    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setSessionReady(true)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setSessionReady(true)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session) {
      setProfile(null)
      setProfileError(null)
      setProfileReady(sessionReady)
      return
    }

    let active = true
    setProfileReady(false)
    void supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setProfile(null)
          setProfileError(error.message)
        } else {
          const next = parseProfile(data)
          setProfile(next)
          setProfileError(next ? null : "Профиль пользователя не найден")
        }
        setProfileReady(true)
      })

    return () => {
      active = false
    }
  }, [session, sessionReady])

  const value = useMemo<AuthValue>(
    () => ({
      ready: sessionReady && profileReady,
      session,
      profile,
      profileError,
      signOut: async () => {
        await supabase?.auth.signOut()
      },
    }),
    [profile, profileError, profileReady, session, sessionReady],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth вызывается внутри AuthProvider")
  return value
}
