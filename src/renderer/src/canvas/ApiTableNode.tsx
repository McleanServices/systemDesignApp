import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo, useMemo, type JSX } from 'react'
import { hasApiTableSyncIssues } from '../store/graphQueries'
import { useDesignStore } from '../store/designStore'
import type { ApiTableNodeData, CanvasNode } from '../store/types'
import { API_TYPE_LABELS } from '../store/types'
import { ApiIcon } from './icons'

function rootGraphNodes(state: {
  nodes: CanvasNode[]
  drillStack: Array<{ nodes: CanvasNode[] }>
}): CanvasNode[] {
  return state.drillStack[0]?.nodes ?? state.nodes
}

function ApiTableNodeComponent({ id, data, selected }: NodeProps<Node<ApiTableNodeData>>): JSX.Element {
  const connectSourceId = useDesignStore((s) => s.connectSourceId)
  const rootNodes = useDesignStore(rootGraphNodes)
  const pending = connectSourceId === id

  const syncWarning = useMemo(
    () => (hasApiTableSyncIssues(data, rootNodes) ? 'drifted' : null),
    [rootNodes, data]
  )

  const apiType = data.apiType ?? 'rest'
  const rest = data.apiConfig?.rest
  const typeLabel =
    apiType === 'rest' && rest && (rest.method !== 'GET' || (rest.path && rest.path !== '/'))
      ? `${rest.method} ${rest.path || '/'}`
      : API_TYPE_LABELS[apiType]

  return (
    <div className={['api-node', selected ? 'is-selected' : '', pending ? 'is-pending' : ''].join(' ')}>
      <Handle type="source" position={Position.Top} id="top" className="device-port" aria-label="Connect top" />
      <Handle type="source" position={Position.Right} id="right" className="device-port" aria-label="Connect right" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="device-port" aria-label="Connect bottom" />
      <Handle type="source" position={Position.Left} id="left" className="device-port" aria-label="Connect left" />

      {syncWarning && (
        <div
          className="api-node__badge"
          title="Linked table attributes are missing or out of sync with the database"
        />
      )}

      <div className="api-node__body">
        <div className="api-node__icon">
          <ApiIcon />
        </div>
      </div>
      <div className="api-node__label">{data.label}</div>
      <div className="api-node__type">{typeLabel}</div>
    </div>
  )
}

export const ApiTableNode = memo(ApiTableNodeComponent)
