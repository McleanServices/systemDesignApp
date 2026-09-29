import { useEffect, useRef, useState, type JSX } from 'react'
import { useProjectActions } from '../file/useProjectActions'

export function Toolbar(): JSX.Element {
  const { newFile, openFile, saveFile, saveFileAs } = useProjectActions()
  const [fileOpen, setFileOpen] = useState(false)
  const fileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!fileOpen) return

    const onPointerDown = (event: PointerEvent): void => {
      if (!fileMenuRef.current?.contains(event.target as Node)) {
        setFileOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setFileOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [fileOpen])

  const runFileAction = (action: () => Promise<void>): void => {
    setFileOpen(false)
    void action()
  }

  return (
    <div className="file-dock glass-panel" ref={fileMenuRef}>
      <button
        type="button"
        className={fileOpen ? 'tool-btn is-active' : 'tool-btn'}
        aria-haspopup="menu"
        aria-expanded={fileOpen}
        title="File"
        onClick={() => setFileOpen((open) => !open)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M7 4.5h6.2L17 8.3V19.5H7V4.5z" />
          <path d="M13.2 4.5V8.3H17" />
        </svg>
        <span>File</span>
      </button>
      {fileOpen ? (
        <div className="file-dock__dropdown glass-panel" role="menu">
          <button type="button" role="menuitem" onClick={() => runFileAction(newFile)}>
            New
          </button>
          <button type="button" role="menuitem" onClick={() => runFileAction(openFile)}>
            Open
          </button>
          <button type="button" role="menuitem" onClick={() => runFileAction(saveFile)}>
            Save
          </button>
          <button type="button" role="menuitem" onClick={() => runFileAction(saveFileAs)}>
            Save As
          </button>
        </div>
      ) : null}
    </div>
  )
}
