import { useCallback, useMemo, useState, type JSX } from 'react'
import type { Edge } from '@xyflow/react'
import {
  findReachableAppServers,
  getAppServerApis,
  resolveApiCallTarget,
  type AppServerApiOption
} from '../store/graphQueries'
import { useDesignStore } from '../store/designStore'
import type { ApiCallNodeData, CableData, CanvasNode } from '../store/types'
import { isDeviceNode } from '../store/types'

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

export function cloneApiCallDraft(data: ApiCallNodeData): ApiCallNodeData {
  return {
    ...data,
    ...(data.paramValues ? { paramValues: { ...data.paramValues } } : {})
  }
}

function seedParamValues(
  parameters: AppServerApiOption['parameters'],
  previous?: Record<string, string>
): Record<string, string> {
  const next: Record<string, string> = {}
  for (const param of parameters) {
    next[param.id] = previous?.[param.id] ?? ''
  }
  return next
}

interface ApiCallConfigFormProps {
  data: ApiCallNodeData
  onChange: (patch: Partial<ApiCallNodeData>) => void
  onOpenParameters: () => void
}

export function ApiCallConfigForm({
  data,
  onChange,
  onOpenParameters
}: ApiCallConfigFormProps): JSX.Element {
  const ownerId = useDesignStore((s) => s.drillPath[s.drillPath.length - 1] ?? null)
  const rootNodes = useDesignStore(rootGraphNodes)
  const rootEdges = useDesignStore(rootGraphEdges)

  const appServers = useMemo(() => {
    if (!ownerId) return [] as CanvasNode[]
    return findReachableAppServers(ownerId, rootNodes, rootEdges)
  }, [ownerId, rootNodes, rootEdges])

  const [expandedServers, setExpandedServers] = useState<Set<string>>(() => {
    const expanded = new Set<string>()
    if (data.sourceAppServerId) expanded.add(data.sourceAppServerId)
    else if (appServers[0]) expanded.add(appServers[0].id)
    return expanded
  })

  const resolved = useMemo(
    () =>
      resolveApiCallTarget(data.sourceAppServerId, data.sourceApiTableId, rootNodes, {
        clientId: ownerId ?? undefined,
        edges: rootEdges
      }),
    [data.sourceAppServerId, data.sourceApiTableId, ownerId, rootEdges, rootNodes]
  )

  const toggleServer = useCallback((serverId: string): void => {
    setExpandedServers((current) => {
      const next = new Set(current)
      if (next.has(serverId)) next.delete(serverId)
      else next.add(serverId)
      return next
    })
  }, [])

  const selectApi = useCallback(
    (appServerId: string, api: AppServerApiOption): void => {
      const previous =
        data.sourceAppServerId === appServerId && data.sourceApiTableId === api.id
          ? data.paramValues
          : undefined
      onChange({
        sourceAppServerId: appServerId,
        sourceApiTableId: api.id,
        label: data.label?.startsWith('Request ') || !data.label ? api.label : data.label,
        paramValues: seedParamValues(api.parameters, previous)
      })
    },
    [data.label, data.paramValues, data.sourceApiTableId, data.sourceAppServerId, onChange]
  )

  const clearLink = useCallback((): void => {
    onChange({
      sourceAppServerId: undefined,
      sourceApiTableId: undefined,
      paramValues: {}
    })
  }, [onChange])

  const parameterCount = resolved.api?.parameters.length ?? 0
  const filledCount = resolved.api
    ? resolved.api.parameters.filter((param) => (data.paramValues?.[param.id] ?? '').trim() !== '')
        .length
    : 0

  return (
    <>
      <h2 id="config-modal-title">{data.label || 'Request'}</h2>
      <p className="panel__kind">Client API call</p>

      <label className="field">
        <span>Label</span>
        <input value={data.label} onChange={(e) => onChange({ label: e.target.value })} />
      </label>

      <div className="field">
        <span>API endpoint</span>
        {appServers.length === 0 ? (
          <p className="api-table-editor__missing">
            No reachable app servers. Connect this client to an app server.
          </p>
        ) : (
          <div className="api-call-picker">
            {appServers.map((server) => {
              if (!isDeviceNode(server)) return null
              const apis = getAppServerApis(server)
              const expanded = expandedServers.has(server.id)
              return (
                <div key={server.id} className="api-call-picker__server">
                  <button
                    type="button"
                    className="api-call-picker__server-toggle"
                    onClick={() => toggleServer(server.id)}
                    aria-expanded={expanded}
                  >
                    <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
                    <span>{server.data.label}</span>
                    <span className="api-call-picker__count">{apis.length}</span>
                  </button>
                  {expanded && (
                    <ul className="api-call-picker__apis">
                      {apis.length === 0 ? (
                        <li className="api-call-picker__empty">No APIs defined on this server.</li>
                      ) : (
                        apis.map((api) => {
                          const selected =
                            data.sourceAppServerId === server.id && data.sourceApiTableId === api.id
                          return (
                            <li key={api.id}>
                              <button
                                type="button"
                                className={
                                  selected
                                    ? 'api-call-picker__api is-selected'
                                    : 'api-call-picker__api'
                                }
                                onClick={() => selectApi(server.id, api)}
                              >
                                <strong>{api.label}</strong>
                                <span>{api.summary}</span>
                              </button>
                            </li>
                          )
                        })
                      )}
                    </ul>
                  )}
                </div>
              )
            })}
            {(data.sourceAppServerId || data.sourceApiTableId) && (
              <button type="button" className="glass-btn api-call-picker__clear" onClick={clearLink}>
                Clear link
              </button>
            )}
          </div>
        )}
      </div>

      {resolved.unreachable && (
        <p className="api-table-editor__missing">
          Linked app server is not connected to this client. Connect the client to that app server,
          or pick an API from a reachable server.
        </p>
      )}

      {resolved.missing && !resolved.unreachable && (
        <p className="api-table-editor__missing">Linked API is missing or was deleted.</p>
      )}

      {resolved.api && !resolved.unreachable && (
        <div className="field">
          <span>Parameter values</span>
          <p className="api-call-config__linked-api">
            {resolved.api.label}
            <span>
              {' '}
              · {resolved.api.summary}
            </span>
          </p>
          <button
            type="button"
            className="config-flyout__trigger"
            onClick={onOpenParameters}
            disabled={parameterCount === 0}
            title={parameterCount === 0 ? 'This API has no parameters' : undefined}
          >
            <span>
              {parameterCount === 0
                ? 'No parameters on this API'
                : filledCount === 0
                  ? `Configure ${parameterCount} parameter${parameterCount === 1 ? '' : 's'}…`
                  : `${filledCount}/${parameterCount} values · Configure…`}
            </span>
            <span className="config-flyout__chevron" aria-hidden="true">
              ›
            </span>
          </button>
        </div>
      )}
    </>
  )
}
