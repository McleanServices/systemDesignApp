import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  type Edge,
  type EdgeProps
} from '@xyflow/react'
import { useEffect, useRef, useState, type CSSProperties, type JSX, type KeyboardEvent, type MouseEvent } from 'react'
import { useDesignStore } from '../store/designStore'
import type { CableData, UmlRelationKind } from '../store/types'

function UmlMarkers({
  id,
  kind,
  color
}: {
  id: string
  kind: UmlRelationKind
  color: string
}): JSX.Element | null {
  if (kind === 'association') return null
  if (kind === 'inheritance') {
    return (
      <defs>
        <marker
          id={`${id}-uml-end`}
          markerWidth="14"
          markerHeight="12"
          refX="12"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0 0 L12 6 L0 12 Z" fill="#fff" stroke={color} strokeWidth="1.4" />
        </marker>
      </defs>
    )
  }
  return (
    <defs>
      <marker
        id={`${id}-uml-start`}
        markerWidth="14"
        markerHeight="14"
        refX="2"
        refY="7"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path
          d="M2 7 L7 2 L12 7 L7 12 Z"
          fill={kind === 'composition' ? color : '#fff'}
          stroke={color}
          strokeWidth="1.4"
        />
      </marker>
    </defs>
  )
}

export function CableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data
}: EdgeProps<Edge<CableData>>): JSX.Element {
  const tool = useDesignStore((s) => s.tool)
  const interiorMode = useDesignStore((s) => s.interiorMode)
  const selectedInStore = useDesignStore((s) => s.selectedId === id || s.selectedIds.includes(id))
  const updateCable = useDesignStore((s) => s.updateCable)
  const setSelected = useDesignStore((s) => s.setSelected)
  const relationKind = data?.relationKind
  const useCaseRelation = data?.useCaseRelation
  const sequenceMessage = data?.sequenceMessage
  const guard = data?.guard?.trim() ?? ''
  const useStraight =
    Boolean(relationKind) ||
    Boolean(useCaseRelation) ||
    Boolean(sequenceMessage) ||
    Boolean(guard) ||
    interiorMode === 'uml' ||
    interiorMode === 'erd' ||
    interiorMode === 'useCase' ||
    interiorMode === 'sequence' ||
    interiorMode === 'activity'
  const pathFn = useStraight ? getStraightPath : getBezierPath
  const [edgePath, labelX, labelY] = pathFn({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition
  })

  const savedLabel = data?.label ?? ''
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(savedLabel)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(savedLabel)
  }, [editing, savedLabel])

  useEffect(() => {
    if (!selectedInStore) setEditing(false)
  }, [selectedInStore])

  useEffect(() => {
    if (!editing) return
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [editing])

  const deleteHover = tool === 'delete'
  const canEdit = tool === 'select'
  const trimmed = savedLabel.trim()
  const showChip =
    !relationKind &&
    !useCaseRelation &&
    (editing ||
      Boolean(trimmed) ||
      Boolean(sequenceMessage) ||
      Boolean(guard) ||
      ((selected || selectedInStore) &&
        canEdit &&
        (interiorMode == null || interiorMode === 'sequence' || interiorMode === 'activity')))

  const commit = (): void => {
    const next = draft.trim()
    setEditing(false)
    if (next !== savedLabel.trim()) updateCable(id, { label: next })
    else setDraft(savedLabel)
  }

  const beginEdit = (event: MouseEvent): void => {
    if (!canEdit || relationKind || useCaseRelation) return
    event.stopPropagation()
    event.preventDefault()
    if (!selectedInStore) setSelected(id)
    setDraft(savedLabel)
    setEditing(true)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      commit()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setDraft(savedLabel)
      setEditing(false)
    }
  }

  const umlColor = selected ? '#e38b2a' : '#111'
  const dashedUseCase = useCaseRelation === 'include' || useCaseRelation === 'extend'
  const dashedMessage = sequenceMessage?.messageKind === 'reply' || sequenceMessage?.messageKind === 'async'
  const edgeStyle: CSSProperties = useStraight
    ? {
        stroke: selected ? '#e38b2a' : deleteHover ? '#8a8a8a' : '#111',
        strokeWidth: selected ? 2.2 : 1.5,
        strokeDasharray: dashedUseCase || dashedMessage ? '7 5' : undefined
      }
    : {
        stroke: selected ? '#e38b2a' : deleteHover ? '#8a8a8a' : '#3f3f3f',
        strokeWidth: selected ? 3.2 : 2.4,
        strokeDasharray: selected ? '6 3' : undefined
      }

  const markerStart =
    relationKind === 'aggregation' || relationKind === 'composition'
      ? `url(#${id}-uml-start)`
      : undefined
  const markerEnd =
    relationKind === 'inheritance' || dashedUseCase
      ? `url(#${id}-uml-end)`
      : sequenceMessage
        ? `url(#${id}-msg-end)`
        : undefined
  const stereotype =
    useCaseRelation === 'include' ? '«include»' : useCaseRelation === 'extend' ? '«extend»' : null

  return (
    <>
      {relationKind ? <UmlMarkers id={id} kind={relationKind} color={umlColor} /> : null}
      {sequenceMessage ? (
        <defs>
          <marker
            id={`${id}-msg-end`}
            markerWidth="14"
            markerHeight="12"
            refX="12"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0 0 L12 6 L0 12 Z" fill={umlColor} />
          </marker>
        </defs>
      ) : null}
      {dashedUseCase ? (
        <defs>
          <marker
            id={`${id}-uml-end`}
            markerWidth="14"
            markerHeight="12"
            refX="12"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0 0 L12 6 L0 12 Z" fill="#fff" stroke={umlColor} strokeWidth="1.4" />
          </marker>
        </defs>
      ) : null}
      <BaseEdge
        id={id}
        path={edgePath}
        interactionWidth={24}
        style={edgeStyle}
        markerStart={markerStart}
        markerEnd={markerEnd}
      />
      {stereotype && (
        <EdgeLabelRenderer>
          <div
            className="usecase-edge-label nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`
            }}
          >
            {stereotype}
          </div>
        </EdgeLabelRenderer>
      )}
      {showChip && (
        <EdgeLabelRenderer>
          <div
            className={`cable-label nodrag nopan${editing ? ' is-editing' : ''}${selected || selectedInStore ? ' is-selected' : ''}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              zIndex: 1001
            }}
            onClick={beginEdit}
            onDoubleClick={beginEdit}
          >
            {editing ? (
              <input
                ref={inputRef}
                className="cable-label__input"
                value={draft}
                placeholder="What does this connection do?"
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={onKeyDown}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              />
            ) : (
              <span className={`cable-label__text${trimmed || sequenceMessage || guard ? '' : ' is-empty'}`}>
                {sequenceMessage
                  ? `${sequenceMessage.order}${trimmed ? `. ${trimmed}` : ''}`
                  : guard
                    ? `[${guard}]${trimmed ? ` ${trimmed}` : ''}`
                    : trimmed || 'Add label'}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
