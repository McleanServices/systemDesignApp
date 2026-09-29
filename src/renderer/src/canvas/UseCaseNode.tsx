import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo, useMemo, type JSX } from 'react'
import { useDesignStore } from '../store/designStore'
import type { CanvasNode, UseCaseNodeData } from '../store/types'
import { isApiTableNode, isDeviceNode } from '../store/types'

function apiNodesForOwner(state: {
  drillPath: string[]
  drillStack: Array<{ nodes: CanvasNode[]; ownerId: string }>
}): CanvasNode[] | undefined {
  const ownerId = state.drillPath[state.drillPath.length - 1]
  const frame = state.drillStack[state.drillStack.length - 1]
  const owner = frame?.nodes.find((node) => node.id === ownerId)
  if (!owner || !isDeviceNode(owner) || owner.data.kind !== 'appServer') return undefined
  return owner.data.appInteriors?.modes.api.nodes
}

function UseCaseNodeComponent({ id, data, selected }: NodeProps<Node<UseCaseNodeData>>): JSX.Element {
  const connectSourceId = useDesignStore((s) => s.connectSourceId)
  const apiNodes = useDesignStore(apiNodesForOwner)
  const labels = useMemo(
    () =>
      data.apiTableIds.flatMap((apiId) => {
        const api = apiNodes?.find((node) => node.id === apiId)
        return api && isApiTableNode(api) ? [api.data.label || 'API'] : []
      }),
    [apiNodes, data.apiTableIds]
  )
  const pending = connectSourceId === id

  return (
    <div className={['usecase-node', selected ? 'is-selected' : '', pending ? 'is-pending' : ''].join(' ')}>
      <Handle type="source" position={Position.Top} id="top" className="device-port" aria-label="Connect top" />
      <Handle type="source" position={Position.Right} id="right" className="device-port" aria-label="Connect right" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="device-port" aria-label="Connect bottom" />
      <Handle type="source" position={Position.Left} id="left" className="device-port" aria-label="Connect left" />
      <div className="usecase-node__ellipse">{data.label}</div>
      {labels.length > 0 && <div className="usecase-node__apis">{labels.join(', ')}</div>}
    </div>
  )
}

export const UseCaseNode = memo(UseCaseNodeComponent)
