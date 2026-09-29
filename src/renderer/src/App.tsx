import { ReactFlowProvider } from '@xyflow/react'
import { useEffect, type JSX } from 'react'
import { StatusBar } from './canvas/StatusBar'
import { Workspace } from './canvas/Workspace'
import { useDesignStore } from './store/designStore'

function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export default function App(): JSX.Element {
  const name = useDesignStore((s) => s.name)
  const dirty = useDesignStore((s) => s.dirty)

  useEffect(() => {
    document.title = `${dirty ? '• ' : ''}${name} — System Design Lab`
  }, [name, dirty])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isEditingTarget(event.target)) return
      const store = useDesignStore.getState()
      const key = event.key.toLowerCase()
      const meta = event.ctrlKey || event.metaKey

      if (event.key === 'Escape') {
        event.preventDefault()
        store.cancelInteraction()
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!store.selectedId && store.selectedIds.length === 0) return
        event.preventDefault()
        store.deleteSelected()
        return
      }

      if (meta && key === 'z' && !event.shiftKey) {
        event.preventDefault()
        store.undo()
        return
      }

      if (meta && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault()
        store.redo()
        return
      }

      if (meta && key === 'a') {
        event.preventDefault()
        store.selectAll()
        return
      }

      if (meta && key === 'd') {
        event.preventDefault()
        store.duplicateSelected()
        return
      }

      if (meta && key === 'g' && event.shiftKey) {
        event.preventDefault()
        store.ungroupSelected()
        return
      }

      if (meta && key === 'g') {
        event.preventDefault()
        store.groupSelected()
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <ReactFlowProvider>
      <div className="app-shell">
        <main className="app-main">
          <Workspace />
        </main>
        <StatusBar />
      </div>
    </ReactFlowProvider>
  )
}
