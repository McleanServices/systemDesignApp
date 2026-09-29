import { useCallback, useState, type DragEvent, type JSX, type KeyboardEvent, type PointerEvent } from 'react'
import type { DeviceKind } from '../store/types'
import { DEVICE_CATEGORIES } from '../store/catalog'
import { useDesignStore } from '../store/designStore'
import type { ActivityNodeKind } from '../store/types'
import { isDeviceNode } from '../store/types'
import { DeviceIcon, ApiIcon } from './icons'

const ACTIVITY_TOOLS: ActivityNodeKind[] = ['initial', 'action', 'decision', 'merge', 'fork', 'join', 'final']

const ACTIVITY_TOOL_LABEL: Record<ActivityNodeKind, string> = {
  initial: 'Initial',
  action: 'Action',
  decision: 'Decision',
  merge: 'Merge',
  fork: 'Fork',
  join: 'Join',
  final: 'Final'
}

const HEIGHT_STORAGE_KEY = 'sdlab.device-tray-height'
const DEFAULT_HEIGHT = 140
const MIN_HEIGHT = 96
const HEIGHT_STEP = 12

function maxHeight(): number {
  return Math.round(window.innerHeight * 0.45)
}

function clampHeight(value: number): number {
  return Math.min(Math.max(value, MIN_HEIGHT), maxHeight())
}

function readStoredHeight(): number {
  try {
    const raw = localStorage.getItem(HEIGHT_STORAGE_KEY)
    if (raw == null) return DEFAULT_HEIGHT
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return DEFAULT_HEIGHT
    return clampHeight(parsed)
  } catch {
    return DEFAULT_HEIGHT
  }
}

function persistHeight(value: number): void {
  try {
    localStorage.setItem(HEIGHT_STORAGE_KEY, String(value))
  } catch {
    /* ignore quota / private mode */
  }
}

export function DevicePalette(): JSX.Element {
  const pendingKind = useDesignStore((s) => s.pendingKind)
  const setPendingKind = useDesignStore((s) => s.setPendingKind)
  const tool = useDesignStore((s) => s.tool)
  const connectOnce = useDesignStore((s) => s.connectOnce)
  const setTool = useDesignStore((s) => s.setTool)
  const drilledIn = useDesignStore((s) => s.drillPath.length > 0)
  const interiorMode = useDesignStore((s) => s.interiorMode)
  const pendingEntity = useDesignStore((s) => s.pendingEntity)
  const setPendingEntity = useDesignStore((s) => s.setPendingEntity)
  const pendingApiTable = useDesignStore((s) => s.pendingApiTable)
  const setPendingApiTable = useDesignStore((s) => s.setPendingApiTable)
  const pendingApiCall = useDesignStore((s) => s.pendingApiCall)
  const setPendingApiCall = useDesignStore((s) => s.setPendingApiCall)
  const pendingActor = useDesignStore((s) => s.pendingActor)
  const setPendingActor = useDesignStore((s) => s.setPendingActor)
  const pendingUseCase = useDesignStore((s) => s.pendingUseCase)
  const setPendingUseCase = useDesignStore((s) => s.setPendingUseCase)
  const pendingRelationKind = useDesignStore((s) => s.pendingRelationKind)
  const setPendingRelationKind = useDesignStore((s) => s.setPendingRelationKind)
  const pendingUseCaseRelation = useDesignStore((s) => s.pendingUseCaseRelation)
  const setPendingUseCaseRelation = useDesignStore((s) => s.setPendingUseCaseRelation)
  const pendingBehavior = useDesignStore((s) => s.pendingBehavior)
  const setPendingBehavior = useDesignStore((s) => s.setPendingBehavior)
  const hasBehaviorDiagram = useDesignStore((s) => {
    const frame = s.drillStack[s.drillStack.length - 1]
    const owner = frame?.nodes.find((node) => node.id === frame.ownerId)
    if (!owner || !isDeviceNode(owner) || owner.data.kind !== 'appServer') return false
    if (s.interiorMode === 'sequence') return Boolean(owner.data.appInteriors?.activeSequenceId)
    if (s.interiorMode === 'activity') return Boolean(owner.data.appInteriors?.activeActivityId)
    return false
  })
  const [categoryId, setCategoryId] = useState(DEVICE_CATEGORIES[0]?.id ?? 'clients')
  const [height, setHeight] = useState(readStoredHeight)
  const [resizing, setResizing] = useState(false)
  const category = DEVICE_CATEGORIES.find((item) => item.id === categoryId) ?? DEVICE_CATEGORIES[0]
  const showErdTools = drilledIn && interiorMode === 'erd'
  const showUmlClassTools = drilledIn && interiorMode === 'uml'
  const showObjectTools = drilledIn && interiorMode === 'object'
  const showUseCaseTools = drilledIn && interiorMode === 'useCase'
  const showSequenceTools = drilledIn && interiorMode === 'sequence'
  const showActivityTools = drilledIn && interiorMode === 'activity'

  const armRelation = (kind: 'association' | 'inheritance' | 'aggregation' | 'composition'): void => {
    if (pendingRelationKind === kind && tool === 'connect' && connectOnce) {
      setPendingRelationKind(null)
      return
    }
    setPendingRelationKind(kind)
  }

  const applyHeight = useCallback((next: number, persist = false): void => {
    const clamped = clampHeight(next)
    setHeight(clamped)
    if (persist) persistHeight(clamped)
  }, [])

  const onDragStart = (event: DragEvent, kind: DeviceKind): void => {
    event.dataTransfer.setData('application/sdlab', kind)
    event.dataTransfer.effectAllowed = 'copy'
    setPendingKind(kind)
  }

  const onEntityDragStart = (event: DragEvent): void => {
    event.dataTransfer.setData('application/sdlab-entity', 'entity')
    event.dataTransfer.effectAllowed = 'copy'
    setPendingEntity(true)
  }

  const onApiTableDragStart = (event: DragEvent): void => {
    event.dataTransfer.setData('application/sdlab-apitable', 'apiTable')
    event.dataTransfer.effectAllowed = 'copy'
    setPendingApiTable(true)
  }

  const armUseCaseRelation = (kind: 'association' | 'include' | 'extend'): void => {
    if (pendingUseCaseRelation === kind && tool === 'connect' && connectOnce) {
      setPendingUseCaseRelation(null)
      return
    }
    setPendingUseCaseRelation(kind)
  }

  const onActorDragStart = (event: DragEvent): void => {
    event.dataTransfer.setData('application/sdlab-actor', 'actor')
    event.dataTransfer.effectAllowed = 'copy'
    setPendingActor(true)
  }

  const onUseCaseDragStart = (event: DragEvent): void => {
    event.dataTransfer.setData('application/sdlab-usecase', 'useCase')
    event.dataTransfer.effectAllowed = 'copy'
    setPendingUseCase(true)
  }

  const onBehaviorDragStart = (event: DragEvent, kind: 'lifeline' | ActivityNodeKind): void => {
    event.dataTransfer.setData('application/sdlab-behavior', kind)
    event.dataTransfer.effectAllowed = 'copy'
    setPendingBehavior(kind)
  }

  const armSequenceMessage = (): void => {
    if (tool === 'connect' && connectOnce) {
      setTool('select')
      return
    }
    setPendingBehavior(null)
    setTool('connect', { once: true })
  }

  const onApiCallDragStart = (event: DragEvent): void => {
    event.dataTransfer.setData('application/sdlab-apicall', 'apiCall')
    event.dataTransfer.effectAllowed = 'copy'
    setPendingApiCall(true)
  }

  const onResizePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    const startY = event.clientY
    const startHeight = height
    try {
      handle.setPointerCapture(event.pointerId)
    } catch {
      /* capture is optional; window-like listeners on the handle still work */
    }
    setResizing(true)

    const onMove = (move: globalThis.PointerEvent): void => {
      applyHeight(startHeight + (startY - move.clientY))
    }
    const onUp = (up: globalThis.PointerEvent): void => {
      const next = clampHeight(startHeight + (startY - up.clientY))
      applyHeight(next, true)
      setResizing(false)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
    }

    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  const onResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      applyHeight(height + HEIGHT_STEP, true)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      applyHeight(height - HEIGHT_STEP, true)
    } else if (event.key === 'Home') {
      event.preventDefault()
      applyHeight(maxHeight(), true)
    } else if (event.key === 'End') {
      event.preventDefault()
      applyHeight(MIN_HEIGHT, true)
    }
  }

  return (
    <aside
      className={resizing ? 'device-tray is-resizing' : 'device-tray'}
      aria-label="Device palette"
      style={{ height }}
    >
      <div
        className="device-tray__resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize device palette"
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={maxHeight()}
        aria-valuenow={Math.round(height)}
        tabIndex={0}
        onPointerDown={onResizePointerDown}
        onKeyDown={onResizeKeyDown}
      />
      <div className="device-tray__tabs" role="tablist">
        {showErdTools ? (
          <button type="button" role="tab" aria-selected className="device-tray__tab is-active">
            ERD
          </button>
        ) : showUmlClassTools ? (
          <button type="button" role="tab" aria-selected className="device-tray__tab is-active">
            Class diagram
          </button>
        ) : showObjectTools ? (
          <button type="button" role="tab" aria-selected className="device-tray__tab is-active">
            Object diagram
          </button>
        ) : showSequenceTools ? (
          <button type="button" role="tab" aria-selected className="device-tray__tab is-active">
            Sequence
          </button>
        ) : showActivityTools ? (
          <button type="button" role="tab" aria-selected className="device-tray__tab is-active">
            Activity
          </button>
        ) : drilledIn && interiorMode === 'useCase' ? (
          <button type="button" role="tab" aria-selected className="device-tray__tab is-active">
            Use case
          </button>
        ) : drilledIn && interiorMode === 'api' ? (
          <button type="button" role="tab" aria-selected className="device-tray__tab is-active">
            API
          </button>
        ) : drilledIn && interiorMode === 'requests' ? (
          <button type="button" role="tab" aria-selected className="device-tray__tab is-active">
            Requests
          </button>
        ) : drilledIn ? (
          <button type="button" role="tab" aria-selected className="device-tray__tab is-active">
            Interior
          </button>
        ) : (
          <>
            {DEVICE_CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={categoryId === item.id}
                className={categoryId === item.id ? 'device-tray__tab is-active' : 'device-tray__tab'}
                onClick={() => setCategoryId(item.id)}
              >
                {item.title}
              </button>
            ))}
            <button
              type="button"
              role="tab"
              aria-selected={categoryId === 'connections'}
              className={categoryId === 'connections' ? 'device-tray__tab is-active' : 'device-tray__tab'}
              onClick={() => setCategoryId('connections')}
            >
              Connections
            </button>
          </>
        )}
      </div>

      <div className="device-tray__body" role="tabpanel">
        {showSequenceTools ? (
          hasBehaviorDiagram ? (
            <>
              <button
                type="button"
                className={pendingBehavior === 'lifeline' ? 'device-tile is-armed' : 'device-tile'}
                draggable
                onDragStart={(event) => onBehaviorDragStart(event, 'lifeline')}
                onClick={() => setPendingBehavior(pendingBehavior === 'lifeline' ? null : 'lifeline')}
                title="Click the workspace to place a lifeline, or drag it onto the canvas"
              >
                <span>Lifeline</span>
              </button>
              <button
                type="button"
                className={tool === 'connect' && connectOnce ? 'device-tile is-armed' : 'device-tile'}
                title="Message: click one lifeline, then another"
                onClick={armSequenceMessage}
              >
                <span>Message</span>
              </button>
            </>
          ) : (
            <p className="device-tray__hint">
              Choose New in the breadcrumb, then pick a use case or API. The diagram starts with the actor, this
              server, and any database, cache, or queue this server can reach.
            </p>
          )
        ) : showActivityTools ? (
          hasBehaviorDiagram ? (
            <>
              {ACTIVITY_TOOLS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={pendingBehavior === kind ? 'device-tile is-armed' : 'device-tile'}
                  draggable
                  onDragStart={(event) => onBehaviorDragStart(event, kind)}
                  onClick={() => setPendingBehavior(pendingBehavior === kind ? null : kind)}
                  title="Click the workspace to place it, or drag it onto the canvas"
                >
                  <span>{ACTIVITY_TOOL_LABEL[kind]}</span>
                </button>
              ))}
            </>
          ) : (
            <p className="device-tray__hint">
              Choose New in the breadcrumb, then pick a use case. The diagram starts with that use case’s API steps.
            </p>
          )
        ) : showUseCaseTools ? (
          <>
            <button
              type="button"
              className={pendingActor ? 'device-tile is-armed' : 'device-tile'}
              draggable
              onDragStart={onActorDragStart}
              onClick={() => setPendingActor(!pendingActor)}
              title="Click the workspace to place an actor, or drag it onto the canvas"
            >
              <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="16" cy="6" r="3" />
                <path d="M16 9v8M10 14h12M16 17l-5 9M16 17l5 9" />
              </svg>
              <span>Actor</span>
            </button>
            <button
              type="button"
              className={pendingUseCase ? 'device-tile is-armed' : 'device-tile'}
              draggable
              onDragStart={onUseCaseDragStart}
              onClick={() => setPendingUseCase(!pendingUseCase)}
              title="Click the workspace to place a use case, or drag it onto the canvas"
            >
              <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
                <ellipse cx="16" cy="16" rx="12" ry="8" />
              </svg>
              <span>Use case</span>
            </button>
            <button
              type="button"
              className={
                tool === 'connect' && connectOnce && pendingUseCaseRelation === 'association'
                  ? 'device-tile is-armed'
                  : 'device-tile'
              }
              title="Association: click an actor and a use case"
              onClick={() => armUseCaseRelation('association')}
            >
              <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 16h20" />
              </svg>
              <span>Association</span>
            </button>
            <button
              type="button"
              className={
                tool === 'connect' && connectOnce && pendingUseCaseRelation === 'include'
                  ? 'device-tile is-armed'
                  : 'device-tile'
              }
              title="Include: click the base use case, then the included use case"
              onClick={() => armUseCaseRelation('include')}
            >
              <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="4 3">
                <path d="M6 16h12" />
                <path d="M18 10 L28 16 L18 22 Z" strokeDasharray="0" />
              </svg>
              <span>Include</span>
            </button>
            <button
              type="button"
              className={
                tool === 'connect' && connectOnce && pendingUseCaseRelation === 'extend'
                  ? 'device-tile is-armed'
                  : 'device-tile'
              }
              title="Extend: click the extending use case, then the base use case"
              onClick={() => armUseCaseRelation('extend')}
            >
              <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="4 3">
                <path d="M6 16h12" />
                <path d="M18 10 L28 16 L18 22 Z" strokeDasharray="0" />
              </svg>
              <span>Extend</span>
            </button>
          </>
        ) : drilledIn && interiorMode === 'api' ? (
          <button
            type="button"
            className={pendingApiTable ? 'device-tile is-armed' : 'device-tile'}
            draggable
            onDragStart={onApiTableDragStart}
            onClick={() => setPendingApiTable(!pendingApiTable)}
            title="Click the workspace to place an API, or drag it onto the canvas"
          >
            <ApiIcon className="device-icon" />
            <span>API</span>
          </button>
        ) : drilledIn && interiorMode === 'requests' ? (
          <button
            type="button"
            className={pendingApiCall ? 'device-tile is-armed' : 'device-tile'}
            draggable
            onDragStart={onApiCallDragStart}
            onClick={() => setPendingApiCall(!pendingApiCall)}
            title="Click the workspace to place a request, or drag it onto the canvas"
          >
            <ApiIcon className="device-icon" />
            <span>Request</span>
          </button>
        ) : showObjectTools ? (
          <p className="device-tray__hint">
            Objects mirror the classes from the ERD and Class diagram. Fill in an instance name and example
            values here — add or remove classes from the ERD or Class diagram.
          </p>
        ) : showUmlClassTools ? (
          <>
            <button
              type="button"
              className={pendingEntity ? 'device-tile is-armed' : 'device-tile'}
              draggable
              onDragStart={onEntityDragStart}
              onClick={() => setPendingEntity(!pendingEntity)}
              title="Click the workspace to place a class, or drag it onto the canvas"
            >
              <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="6" y="4" width="20" height="24" />
                <path d="M6 11h20M6 19h20" />
              </svg>
              <span>Class</span>
            </button>
            <button
              type="button"
              className={
                tool === 'connect' && connectOnce && pendingRelationKind === 'association'
                  ? 'device-tile is-armed'
                  : 'device-tile'
              }
              title="Association: click source class, then target"
              onClick={() => armRelation('association')}
            >
              <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 16h20" />
              </svg>
              <span>Association</span>
            </button>
            <button
              type="button"
              className={
                tool === 'connect' && connectOnce && pendingRelationKind === 'inheritance'
                  ? 'device-tile is-armed'
                  : 'device-tile'
              }
              title="Inheritance: click subclass, then superclass"
              onClick={() => armRelation('inheritance')}
            >
              <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 16h12" />
                <path d="M18 10 L28 16 L18 22 Z" />
              </svg>
              <span>Inheritance</span>
            </button>
            <button
              type="button"
              className={
                tool === 'connect' && connectOnce && pendingRelationKind === 'aggregation'
                  ? 'device-tile is-armed'
                  : 'device-tile'
              }
              title="Aggregation: click whole, then part"
              onClick={() => armRelation('aggregation')}
            >
              <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 16 L10 10 L16 16 L10 22 Z" />
                <path d="M16 16h12" />
              </svg>
              <span>Aggregation</span>
            </button>
            <button
              type="button"
              className={
                tool === 'connect' && connectOnce && pendingRelationKind === 'composition'
                  ? 'device-tile is-armed'
                  : 'device-tile'
              }
              title="Composition: click whole, then part"
              onClick={() => armRelation('composition')}
            >
              <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="currentColor" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 16 L10 10 L16 16 L10 22 Z" />
                <path d="M16 16h12" fill="none" />
              </svg>
              <span>Composition</span>
            </button>
          </>
        ) : showErdTools ? (
          <>
            <button
              type="button"
              className={pendingEntity ? 'device-tile is-armed' : 'device-tile'}
              draggable
              onDragStart={onEntityDragStart}
              onClick={() => setPendingEntity(!pendingEntity)}
              title="Click the workspace to place an entity, or drag it onto the canvas"
            >
              <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="5" y="6" width="22" height="20" rx="2" />
                <path d="M5 12h22" />
              </svg>
              <span>Entity</span>
            </button>
            <button
              type="button"
              className={tool === 'connect' && connectOnce && !pendingRelationKind ? 'device-tile is-armed' : 'device-tile'}
              title="Click a source entity, then a destination to add a relationship"
              onClick={() => {
                if (tool === 'connect' && connectOnce && !pendingRelationKind) setTool('select')
                else setTool('connect', { once: true })
              }}
            >
              <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="7" cy="16" r="3" />
                <circle cx="25" cy="16" r="3" />
                <path d="M10 16h12" />
              </svg>
              <span>Relationship</span>
            </button>
          </>
        ) : categoryId === 'connections' ? (
          <button
            type="button"
            className={tool === 'connect' && connectOnce ? 'device-tile is-armed' : 'device-tile'}
            title="Click a source device, then a destination to add a cable"
            onClick={() => {
              if (tool === 'connect' && connectOnce) setTool('select')
              else setTool('connect', { once: true })
            }}
          >
            <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="7" cy="16" r="3" />
              <circle cx="25" cy="16" r="3" />
              <path d="M10 16h12" />
            </svg>
            <span>Copper cable</span>
          </button>
        ) : (
          category.items.map((item) => (
            <button
              key={item.kind}
              type="button"
              className={pendingKind === item.kind ? 'device-tile is-armed' : 'device-tile'}
              draggable
              onDragStart={(event) => onDragStart(event, item.kind)}
              onClick={() => setPendingKind(pendingKind === item.kind ? null : item.kind)}
              title={`Click the workspace to place ${item.label}, or drag it onto the canvas`}
            >
              <DeviceIcon kind={item.kind} />
              <span>{item.label}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  )
}
