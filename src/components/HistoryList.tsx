import { formatDate } from "@/lib/format"
import type { HistoryView } from "@/lib/api"
import { transitionLabel } from "@/types/labels"

export function HistoryList({ entries }: { entries: HistoryView[] }) {
  return (
    <section className="history">
      <h2 className="history__title">История</h2>
      {entries.length === 0 ? <p className="page-state">Записей пока нет.</p> : null}
      <ol className="history__list">
        {entries.map((entry) => (
          <li className="history__item" key={entry.id}>
            <p className="history__line">
              {entry.actorName}
              <span className="history__time">{formatDate(entry.created_at)}</span>
            </p>
            <p className="history__change">{transitionLabel(entry.from_status, entry.to_status)}</p>
            {entry.comment ? <p className="history__comment">{entry.comment}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
