import type { Edge } from '@xyflow/react'
import { getApiTableLinks } from './apiTableUtils'
import {
  findReachableAppServers,
  findReachableDatabases,
  formatApiTableSummary,
  getDatabaseTables
} from './graphQueries'
import type { CableData, CanvasNode } from './types'
import { isApiCallNode, isApiTableNode, isDeviceNode } from './types'

export interface CableDeleteImpactItem {
  id: string
  kind: 'apiCall' | 'apiTable'
  title: string
  detail: string
}

export interface CableDeleteImpact {
  cableIds: string[]
  cableSummaries: string[]
  items: CableDeleteImpactItem[]
}

function nodeLabel(nodes: CanvasNode[], id: string): string {
  const node = nodes.find((item) => item.id === id)
  if (!node) return id
  if (isDeviceNode(node)) return node.data.label || node.data.kind
  return id
}

function reachableIdSet(
  startId: string,
  nodes: CanvasNode[],
  edges: Edge<CableData>[],
  kind: 'appServer' | 'database'
): Set<string> {
  const list =
    kind === 'appServer'
      ? findReachableAppServers(startId, nodes, edges)
      : findReachableDatabases(startId, nodes, edges)
  return new Set(list.map((node) => node.id))
}

/**
 * Describes LLD links that would break if the given HLD cables were removed
 * (client API calls that lose their app server, API tables that lose their DB).
 */
export function analyzeCableDeleteImpact(
  cableIds: string[],
  nodes: CanvasNode[],
  edges: Edge<CableData>[]
): CableDeleteImpact | null {
  const remove = new Set(cableIds.filter((id) => edges.some((edge) => edge.id === id)))
  if (remove.size === 0) return null

  const removedEdges = edges.filter((edge) => remove.has(edge.id))
  const remainingEdges = edges.filter((edge) => !remove.has(edge.id))
  const cableSummaries = removedEdges.map(
    (edge) => `${nodeLabel(nodes, edge.source)} → ${nodeLabel(nodes, edge.target)}`
  )

  const items: CableDeleteImpactItem[] = []
  const seen = new Set<string>()

  for (const client of nodes) {
    if (!isDeviceNode(client) || client.data.kind !== 'client') continue
    const calls = client.data.clientInteriors?.modes.requests.nodes ?? []
    const before = reachableIdSet(client.id, nodes, edges, 'appServer')
    const after = reachableIdSet(client.id, nodes, remainingEdges, 'appServer')

    for (const callNode of calls) {
      if (!isApiCallNode(callNode)) continue
      const serverId = callNode.data.sourceAppServerId
      const apiId = callNode.data.sourceApiTableId
      if (!serverId || !apiId) continue
      if (!before.has(serverId) || after.has(serverId)) continue

      const key = `apiCall:${callNode.id}`
      if (seen.has(key)) continue
      seen.add(key)

      const server = nodes.find((item) => item.id === serverId)
      const api =
        server && isDeviceNode(server)
          ? (server.data.appInteriors?.modes.api.nodes ?? []).find((item) => item.id === apiId)
          : undefined
      const apiLabel =
        api && isApiTableNode(api)
          ? `${api.data.label} (${formatApiTableSummary(api.data)})`
          : apiId

      items.push({
        id: key,
        kind: 'apiCall',
        title: `${client.data.label} · ${callNode.data.label}`,
        detail: `Would lose reachability to ${nodeLabel(nodes, serverId)} API “${apiLabel}”.`
      })
    }
  }

  for (const appServer of nodes) {
    if (!isDeviceNode(appServer) || appServer.data.kind !== 'appServer') continue
    const apis = appServer.data.appInteriors?.modes.api.nodes ?? []
    const before = reachableIdSet(appServer.id, nodes, edges, 'database')
    const after = reachableIdSet(appServer.id, nodes, remainingEdges, 'database')

    for (const apiNode of apis) {
      if (!isApiTableNode(apiNode)) continue
      for (const link of getApiTableLinks(apiNode.data)) {
        if (!before.has(link.sourceDatabaseId) || after.has(link.sourceDatabaseId)) continue

        const key = `apiTable:${apiNode.id}:${link.sourceDatabaseId}:${link.sourceEntityId}`
        if (seen.has(key)) continue
        seen.add(key)

        const database = nodes.find((item) => item.id === link.sourceDatabaseId)
        const table =
          database && isDeviceNode(database)
            ? getDatabaseTables(database).find((item) => item.id === link.sourceEntityId)
            : undefined

        items.push({
          id: key,
          kind: 'apiTable',
          title: `${appServer.data.label} · ${apiNode.data.label}`,
          detail: `Would lose reachability to database “${nodeLabel(nodes, link.sourceDatabaseId)}” table “${table?.label ?? link.sourceEntityId}”.`
        })
      }
    }
  }

  if (items.length === 0) return null
  return {
    cableIds: [...remove],
    cableSummaries,
    items
  }
}
