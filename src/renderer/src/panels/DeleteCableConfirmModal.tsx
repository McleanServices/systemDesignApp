import { useEffect, useRef, type JSX } from 'react'
import type { CableDeleteImpact } from '../store/cableDeleteImpact'

interface DeleteCableConfirmModalProps {
  impact: CableDeleteImpact
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteCableConfirmModal({
  impact,
  onCancel,
  onConfirm
}: DeleteCableConfirmModalProps): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onCancel()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onConfirm()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onCancel, onConfirm])

  return (
    <div className="config-modal" role="presentation" onPointerDown={onCancel}>
      <div
        ref={panelRef}
        className="config-modal__panel glass-panel delete-cable-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-cable-modal-title"
        tabIndex={-1}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="config-modal__body">
          <h2 id="delete-cable-modal-title">Delete cable?</h2>
          <p className="panel__kind">This connection carries linked design data</p>

          <div className="delete-cable-modal__section">
            <h3>Cables</h3>
            <ul className="delete-cable-modal__list">
              {impact.cableSummaries.map((summary) => (
                <li key={summary}>{summary}</li>
              ))}
            </ul>
          </div>

          <div className="delete-cable-modal__section">
            <h3>Impact if deleted</h3>
            <ul className="delete-cable-modal__impact">
              {impact.items.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="config-modal__footer">
          <button type="button" className="glass-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="glass-btn glass-btn--danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
