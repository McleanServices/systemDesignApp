import type { JSX } from 'react'
import { useDesignStore } from '../store/designStore'
import type { EditorTool } from '../store/types'

const TOOLS: { id: EditorTool; label: string; hint: string; icon: JSX.Element }[] = [
  {
    id: 'select',
    label: 'Select',
    hint: 'Select, move, and drag ports to connect',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M5 3l6 16 2.2-6.2L19 11 5 3z"
          fill="currentColor"
          stroke="currentColor"
          strokeLinejoin="round"
        />
      </svg>
    )
  },
  {
    id: 'pan',
    label: 'Hand',
    hint: 'Drag the canvas to move around',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path
          d="M8.2 11.2V7.1a1.35 1.35 0 0 1 2.7 0v4"
          strokeLinecap="round"
        />
        <path
          d="M10.9 10.9V6.2a1.35 1.35 0 0 1 2.7 0V11"
          strokeLinecap="round"
        />
        <path
          d="M13.6 11.1V7.6a1.35 1.35 0 1 1 2.7 0v6.2c0 2.5-1.7 4.8-4.2 5.4-2.7.6-5.4-.8-6.2-3.3L5.1 13a1.45 1.45 0 0 1 2.1-1.9l1 1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  },
  {
    id: 'delete',
    label: 'Delete',
    hint: 'Click a device or cable to remove it',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M7 7l10 10M17 7L7 17" />
      </svg>
    )
  }
]

export function FloatingTools(): JSX.Element {
  const tool = useDesignStore((s) => s.tool)
  const setTool = useDesignStore((s) => s.setTool)

  return (
    <div className="tool-dock glass-panel" role="toolbar" aria-label="Canvas tools">
      <div className="tool-dock__group" role="radiogroup" aria-label="Tools">
        {TOOLS.map((item) => {
          const active = tool === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={active ? 'tool-btn is-active' : 'tool-btn'}
              title={item.hint}
              onClick={() => setTool(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
