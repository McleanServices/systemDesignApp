import type { JSX } from 'react'

export interface ContextMenuState {
  x: number
  y: number
  target: 'node' | 'edge' | 'pane'
  id?: string
}

interface ContextMenuProps {
  menu: ContextMenuState
  canProperties: boolean
  canDuplicate: boolean
  canDelete: boolean
  canGroup: boolean
  canUngroup: boolean
  onProperties: () => void
  onDelete: () => void
  onDuplicate: () => void
  onGroup: () => void
  onUngroup: () => void
  onSelectAll: () => void
  onClose: () => void
}

export function ContextMenu({
  menu,
  canProperties,
  canDuplicate,
  canDelete,
  canGroup,
  canUngroup,
  onProperties,
  onDelete,
  onDuplicate,
  onGroup,
  onUngroup,
  onSelectAll,
  onClose
}: ContextMenuProps): JSX.Element {
  return (
    <div
      className="context-menu"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        disabled={!canProperties}
        onClick={() => {
          onProperties()
          onClose()
        }}
      >
        Properties
      </button>
      <div className="context-menu__sep" />
      <button type="button" role="menuitem" disabled={!canDelete} onClick={onDelete}>
        Delete
      </button>
      <button type="button" role="menuitem" disabled={!canDuplicate} onClick={onDuplicate}>
        Duplicate
      </button>
      <div className="context-menu__sep" />
      <button
        type="button"
        role="menuitem"
        disabled={!canGroup}
        onClick={() => {
          onGroup()
          onClose()
        }}
      >
        Group selected
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!canUngroup}
        onClick={() => {
          onUngroup()
          onClose()
        }}
      >
        Ungroup
      </button>
      <div className="context-menu__sep" />
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onSelectAll()
          onClose()
        }}
      >
        Select All
      </button>
    </div>
  )
}
