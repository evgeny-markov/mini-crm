export function Notice({ children }: { children: string }) {
  return (
    <p className="notice" role="alert">
      {children}
    </p>
  )
}
