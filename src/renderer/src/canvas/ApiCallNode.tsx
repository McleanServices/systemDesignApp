import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'

import { memo, useMemo, type JSX } from 'react'

import type { Edge } from '@xyflow/react'

import { hasApiCallSyncIssues, resolveApiCallTarget } from '../store/graphQueries'

import { useDesignStore } from '../store/designStore'

import type { ApiCallNodeData, CableData, CanvasNode } from '../store/types'

import { ApiIcon } from './icons'



function rootGraphNodes(state: {

  nodes: CanvasNode[]

  drillStack: Array<{ nodes: CanvasNode[] }>

}): CanvasNode[] {

  return state.drillStack[0]?.nodes ?? state.nodes

}



function rootGraphEdges(state: {

  edges: Edge<CableData>[]

  drillStack: Array<{ edges: Edge<CableData>[] }>

}): Edge<CableData>[] {

  return state.drillStack[0]?.edges ?? state.edges

}



function ApiCallNodeComponent({ id, data, selected }: NodeProps<Node<ApiCallNodeData>>): JSX.Element {

  const connectSourceId = useDesignStore((s) => s.connectSourceId)

  const clientId = useDesignStore((s) => s.drillPath[s.drillPath.length - 1] ?? null)

  const rootNodes = useDesignStore(rootGraphNodes)

  const rootEdges = useDesignStore(rootGraphEdges)

  const pending = connectSourceId === id



  const resolveOptions = useMemo(

    () => (clientId ? { clientId, edges: rootEdges } : undefined),

    [clientId, rootEdges]

  )



  const syncWarning = useMemo(

    () => (hasApiCallSyncIssues(data, rootNodes, resolveOptions) ? 'drifted' : null),

    [rootNodes, data, resolveOptions]

  )



  const summary = useMemo(() => {

    const resolved = resolveApiCallTarget(

      data.sourceAppServerId,

      data.sourceApiTableId,

      rootNodes,

      resolveOptions

    )

    if (resolved.unreachable) return 'Unreachable'

    if (resolved.missing) return 'Missing API'

    if (!resolved.api) return 'Unlinked'

    return resolved.api.summary

  }, [data.sourceAppServerId, data.sourceApiTableId, rootNodes, resolveOptions])



  return (

    <div className={['api-node', 'api-call-node', selected ? 'is-selected' : '', pending ? 'is-pending' : ''].join(' ')}>

      <Handle type="source" position={Position.Top} id="top" className="device-port" aria-label="Connect top" />

      <Handle type="source" position={Position.Right} id="right" className="device-port" aria-label="Connect right" />

      <Handle type="source" position={Position.Bottom} id="bottom" className="device-port" aria-label="Connect bottom" />

      <Handle type="source" position={Position.Left} id="left" className="device-port" aria-label="Connect left" />



      {syncWarning && (

        <div

          className="api-node__badge"

          title="Linked API is missing, unreachable from this client, or required parameters are empty"

        />

      )}



      <div className="api-node__body">

        <div className="api-node__icon">

          <ApiIcon />

        </div>

      </div>

      <div className="api-node__label">{data.label}</div>

      <div className="api-node__type">{summary}</div>

    </div>

  )

}



export const ApiCallNode = memo(ApiCallNodeComponent)


