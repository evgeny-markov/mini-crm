import { useId } from "react"

type FieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
}

export function Field({ label, value, onChange, multiline = false }: FieldProps) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      {multiline ? (
        <textarea
          className="field__control"
          id={id}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          value={value}
        />
      ) : (
        <input
          className="field__control"
          id={id}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      )}
    </label>
  )
}

type SelectFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

export function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <select
        className="field__control"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
