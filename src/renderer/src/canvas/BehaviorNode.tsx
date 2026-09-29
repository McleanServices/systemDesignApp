import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo, type JSX } from 'react'
import { useDesignStore } from '../store/designStore'
import type { BehaviorNodeData } from '../store/types'

function BehaviorNodeComponent({ id, data, selected }: NodeProps<Node<BehaviorNodeData>>): JSX.Element {
  const connectSourceId = useDesignStore((s) => s.connectSourceId)
  const pending = connectSourceId === id
  const kind = data.kind
  const className = [
    'behavior-node',
    kind === 'lifeline' ? 'behavior-node--lifeline' : '',
    kind === 'initial' ? 'behavior-node--initial' : '',
    kind === 'final' ? 'behavior-node--final' : '',
    kind === 'decision' || kind === 'merge' ? 'behavior-node--diamond' : '',
    kind === 'fork' || kind === 'join' ? 'behavior-node--bar' : '',
    selected ? 'is-selected' : '',
    pending ? 'is-pending' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      <Handle type="source" position={Position.Top} id="top" className="device-port" aria-label="Connect top" />
      <Handle type="source" position={Position.Right} id="right" className="device-port" aria-label="Connect right" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="device-port" aria-label="Connect bottom" />
      <Handle type="source" position={Position.Left} id="left" className="device-port" aria-label="Connect left" />
      <div className="behavior-node__label">{data.label}</div>
      {data.kind !== 'lifeline' && data.description ? (
        <div className="behavior-node__description">{data.description}</div>
      ) : null}
    </div>
  )
}

export const BehaviorNode = memo(BehaviorNodeComponent)
