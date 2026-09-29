import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo, type JSX } from 'react'
import { useDesignStore } from '../store/designStore'
import type { ActorNodeData } from '../store/types'

function ActorNodeComponent({ id, data, selected }: NodeProps<Node<ActorNodeData>>): JSX.Element {
  const connectSourceId = useDesignStore((s) => s.connectSourceId)
  const pending = connectSourceId === id

  return (
    <div className={['actor-node', selected ? 'is-selected' : '', pending ? 'is-pending' : ''].join(' ')}>
      <Handle type="source" position={Position.Top} id="top" className="device-port" aria-label="Connect top" />
      <Handle type="source" position={Position.Right} id="right" className="device-port" aria-label="Connect right" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="device-port" aria-label="Connect bottom" />
      <Handle type="source" position={Position.Left} id="left" className="device-port" aria-label="Connect left" />
      <svg className="actor-node__figure" viewBox="0 0 32 48" aria-hidden="true">
        <circle cx="16" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16 12 v14 M8 20 h16 M16 26 l-7 14 M16 26 l7 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <div className="actor-node__label">{data.label}</div>
    </div>
  )
}

export const ActorNode = memo(ActorNodeComponent)
