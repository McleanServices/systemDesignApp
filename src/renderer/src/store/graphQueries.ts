import type { Edge } from '@xyflow/react'
import { getApiParameters } from './apiTableUtils'
import { useDesignStore } from './designStore'
import type {
  ApiAttributeRef,
  ApiCallNodeData,
  ApiParam,
  ApiTableNodeData,
  ApiType,
  CableData,
  CanvasNode,
  ErAttribute
} from './types'
import { API_TYPE_LABELS, isApiTableNode, isDeviceNode, isEntityNode } from './types'

export interface RootGraph {
  nodes: CanvasNode[]
  edges: Edge<CableData>[]
}

/**
 * Returns the root-level graph, even while drilled into a nested interior
 * (the root frame is preserved at the bottom of the drill stack).
 */
export function getRootGraph(): RootGraph {
  const state = useDesignStore.getState()
  const rootFrame = state.drillStack[0]
  if (rootFrame) return { nodes: rootFrame.nodes, edges: rootFrame.edges }
  return { nodes: state.nodes, edges: state.edges }
}

/**
 * BFS over root-level cables starting at `startId`, collecting every database
 * node reachable through any number of hops (load balancers, caches, etc).
 */
export function findReachableDatabases(
  startId: string,
  nodes: CanvasNode[],
  edges: Edge<CableData>[]
): CanvasNode[] {
  return findReachableKind(startId, nodes, edges, 'database')
}

/**
 * BFS from a client (or other upstream node) collecting reachable app servers.
 * Does not traverse through databases / message queues — those create false
 * paths between unrelated app servers that share a datastore.
 */
export function findReachableAppServers(
  startId: string,
  nodes: CanvasNode[],
  edges: Edge<CableData>[]
): CanvasNode[] {
  return findReachableKind(startId, nodes, edges, 'appServer', {
    blockKinds: ['database', 'messageQueue']
  })
}

function findReachableKind(
  startId: string,
  nodes: CanvasNode[],
  edges: Edge<CableData>[],
  kind: 'database' | 'appServer',
  options?: { blockKinds?: Array<'database' | 'messageQueue'> }
): CanvasNode[] {
  const blockKinds = new Set(options?.blockKinds ?? [])
  const adjacency = new Map<string, Set<string>>()
  const link = (a: string, b: string): void => {
    if (!adjacency.has(a)) adjacency.set(a, new Set())
    adjacency.get(a)?.add(b)
  }
  edges.forEach((edge) => {
    link(edge.source, edge.target)
    link(edge.target, edge.source)
  })

  const visited = new Set<string>([startId])
  const queue: string[] = [startId]
  const matches: CanvasNode[] = []

  while (queue.length > 0) {
    const current = queue.shift() as string
    const neighbors = adjacency.get(current)
    if (!neighbors) continue
    for (const neighborId of neighbors) {
      if (visited.has(neighborId)) continue
      visited.add(neighborId)
      const node = nodes.find((item) => item.id === neighborId)
      if (!node) continue
      if (isDeviceNode(node) && node.data.kind === kind) {
        matches.push(node)
      }
      // Data stores are sinks for client→API reachability: arrive, but do not cross.
      if (isDeviceNode(node) && blockKinds.has(node.data.kind as 'database' | 'messageQueue')) {
        continue
      }
      queue.push(neighborId)
    }
  }

  return matches
}

export interface DatabaseTableOption {
  id: string
  label: string
  attributes: ErAttribute[]
}

/** Reads the ERD entities (tables) stored inside a database node's interior. */
export function getDatabaseTables(databaseNode: CanvasNode): DatabaseTableOption[] {
  if (!isDeviceNode(databaseNode) || databaseNode.data.kind !== 'database') return []
  const erdNodes = databaseNode.data.interiors?.modes.erd.nodes ?? []
  return erdNodes.filter(isEntityNode).map((node) => ({
    id: node.id,
    label: node.data.label,
    attributes: node.data.attributes
  }))
}

export interface AppServerApiOption {
  id: string
  label: string
  summary: string
  apiType: ApiType
  parameters: ApiParam[]
}

export function formatApiTableSummary(data: ApiTableNodeData): string {
  const apiType = data.apiType ?? 'rest'
  if (apiType === 'rest') {
    const rest = data.apiConfig?.rest
    if (rest && (rest.method !== 'GET' || (rest.path && rest.path !== '/'))) {
      return `${rest.method} ${rest.path || '/'}`
    }
  }
  if (apiType === 'graphql') {
    const graphql = data.apiConfig?.graphql
    if (graphql?.operationName) return `${graphql.operationType} ${graphql.operationName}`
  }
  if (apiType === 'grpc') {
    const grpc = data.apiConfig?.grpc
    if (grpc?.service && grpc?.method) return `${grpc.service}/${grpc.method}`
  }
  return API_TYPE_LABELS[apiType]
}

/** Reads API table endpoints stored inside an app server node's interior. */
export function getAppServerApis(appServerNode: CanvasNode): AppServerApiOption[] {
  if (!isDeviceNode(appServerNode) || appServerNode.data.kind !== 'appServer') return []
  const apiNodes = appServerNode.data.appInteriors?.modes.api.nodes ?? []
  return apiNodes.filter(isApiTableNode).map((node) => ({
    id: node.id,
    label: node.data.label,
    summary: formatApiTableSummary(node.data),
    apiType: node.data.apiType ?? 'rest',
    parameters: getApiParameters(node.data)
  }))
}

export interface ResolvedApiCallTarget {
  api: AppServerApiOption | null
  missing: boolean
  /** True when the linked app server exists but is not reachable from the client over HLD cables. */
  unreachable: boolean
}

export interface ResolveApiCallOptions {
  clientId?: string
  edges?: Edge<CableData>[]
}

/**
 * Resolves the live API an apiCall node points at. Returns `missing: true` if
 * the referenced app server or API table can no longer be found, and
 * `unreachable: true` if the app server is not connected to the client.
 */
export function resolveApiCallTarget(
  sourceAppServerId: string | undefined,
  sourceApiTableId: string | undefined,
  nodes: CanvasNode[],
  options?: ResolveApiCallOptions
): ResolvedApiCallTarget {
  if (!sourceAppServerId || !sourceApiTableId) {
    return { api: null, missing: false, unreachable: false }
  }
  const appServer = nodes.find((node) => node.id === sourceAppServerId)
  if (!appServer) return { api: null, missing: true, unreachable: false }

  if (options?.clientId && options.edges) {
    const reachable = findReachableAppServers(options.clientId, nodes, options.edges)
    if (!reachable.some((node) => node.id === sourceAppServerId)) {
      const api = getAppServerApis(appServer).find((item) => item.id === sourceApiTableId) ?? null
      return { api, missing: !api, unreachable: true }
    }
  }

  const api = getAppServerApis(appServer).find((item) => item.id === sourceApiTableId)
  if (!api) return { api: null, missing: true, unreachable: false }
  return { api, missing: false, unreachable: false }
}

export function hasApiCallSyncIssues(
  data: ApiCallNodeData,
  nodes: CanvasNode[],
  options?: ResolveApiCallOptions
): boolean {
  if (!data.sourceAppServerId || !data.sourceApiTableId) return false
  const resolved = resolveApiCallTarget(
    data.sourceAppServerId,
    data.sourceApiTableId,
    nodes,
    options
  )
  if (resolved.missing || resolved.unreachable || !resolved.api) return true
  return resolved.api.parameters.some((param) => {
    if (!param.required) return false
    const value = data.paramValues?.[param.id]
    return value == null || value.trim() === ''
  })
}

export interface ResolvedApiAttributes {
  attributes: ErAttribute[]
  missing: boolean
}

/**
 * Resolves the live attribute list for a table an API node points at. Returns
 * `missing: true` if the referenced database or table can no longer be found
 * (e.g. it was deleted or renamed away).
 */
export function resolveApiAttributes(
  sourceDatabaseId: string | undefined,
  sourceEntityId: string | undefined,
  nodes: CanvasNode[]
): ResolvedApiAttributes {
  if (!sourceDatabaseId || !sourceEntityId) return { attributes: [], missing: false }
  const database = nodes.find((node) => node.id === sourceDatabaseId)
  if (!database) return { attributes: [], missing: true }
  const table = getDatabaseTables(database).find((item) => item.id === sourceEntityId)
  if (!table) return { attributes: [], missing: true }
  return { attributes: table.attributes, missing: false }
}

export type ApiAttributeSyncStatus = 'ok' | 'missing' | 'drifted'

export interface ApiAttributeDiff {
  id: string
  status: ApiAttributeSyncStatus
}

function isLinkedApiAttribute(attribute: ApiAttributeRef): boolean {
  // Explicit local attrs are never validated. Legacy files omit the flag and
  // are treated as linked so deleted DB attrs still surface as errors.
  return attribute.fromSource !== false
}

function fieldsMatch(api: ApiAttributeRef, source: ErAttribute): boolean {
  return (
    api.name === source.name &&
    api.type === source.type &&
    api.pk === source.pk &&
    api.fk === source.fk
  )
}

/**
 * Compares API attribute snapshots against the live ERD source table.
 * Local-only attributes (`fromSource: false`) always report `ok`.
 *
 * Matching prefers attribute `id`, then falls back to the same `name` on the
 * source table (covers attrs re-added on the ERD with a new id).
 */
export function diffApiAttributes(
  apiAttributes: ApiAttributeRef[],
  sourceAttributes: ErAttribute[],
  sourceMissing: boolean,
  sourceLinked: boolean
): ApiAttributeDiff[] {
  if (!sourceLinked) {
    return apiAttributes.map((attribute) => ({ id: attribute.id, status: 'ok' as const }))
  }

  const sourceById = new Map(sourceAttributes.map((attribute) => [attribute.id, attribute]))
  const claimedSourceIds = new Set<string>()

  const resolveSource = (attribute: ApiAttributeRef): ErAttribute | undefined => {
    const byId = sourceById.get(attribute.id)
    if (byId) {
      claimedSourceIds.add(byId.id)
      return byId
    }
    if (!attribute.name) return undefined
    const byName = sourceAttributes.find(
      (source) => source.name === attribute.name && !claimedSourceIds.has(source.id)
    )
    if (byName) {
      claimedSourceIds.add(byName.id)
      return byName
    }
    return undefined
  }

  return apiAttributes.map((attribute) => {
    if (!isLinkedApiAttribute(attribute)) {
      return { id: attribute.id, status: 'ok' as const }
    }
    if (sourceMissing) {
      return { id: attribute.id, status: 'missing' as const }
    }
    const source = resolveSource(attribute)
    if (!source) {
      return { id: attribute.id, status: 'missing' as const }
    }
    if (!fieldsMatch(attribute, source)) {
      return { id: attribute.id, status: 'drifted' as const }
    }
    return { id: attribute.id, status: 'ok' as const }
  })
}

export function hasApiTableSyncIssues(data: ApiTableNodeData, nodes: CanvasNode[]): boolean {
  const links =
    data.tableLinks?.length
      ? data.tableLinks
      : data.sourceDatabaseId && data.sourceEntityId
        ? [
            {
              sourceDatabaseId: data.sourceDatabaseId,
              sourceEntityId: data.sourceEntityId,
              attributes: data.attributes
            }
          ]
        : []

  if (links.length === 0) return false

  return links.some((link) => {
    const resolved = resolveApiAttributes(link.sourceDatabaseId, link.sourceEntityId, nodes)
    const diffs = diffApiAttributes(link.attributes, resolved.attributes, resolved.missing, true)
    if (resolved.missing) return true
    return diffs.some((diff) => diff.status === 'drifted' || diff.status === 'missing')
  })
}
