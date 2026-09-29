import type { Edge, Viewport } from '@xyflow/react'
import type {
  BehaviorNodeData,
  BehaviorSubject,
  CableData,
  CanvasNode,
  LifelineParticipant,
  SubgraphData
} from './types'
import { isActorNode, isApiTableNode, isDeviceNode, isUseCaseNode } from './types'

const STORE_KINDS = new Set<LifelineParticipant>(['database', 'cache', 'messageQueue'])

export function actorsLinkedToUseCase(
  graph: { nodes: CanvasNode[]; edges: Edge<CableData>[] },
  useCaseId: string
): CanvasNode[] {
  const linked = new Set<string>()
  for (const edge of graph.edges) {
    const relation = edge.data?.useCaseRelation ?? 'association'
    if (relation !== 'association') continue
    if (edge.source === useCaseId) linked.add(edge.target)
    if (edge.target === useCaseId) linked.add(edge.source)
  }
  return graph.nodes.filter((node) => linked.has(node.id) && isActorNode(node))
}

/** Databases, caches, and queues this server can reach without walking through another store. */
export function reachableStores(nodes: CanvasNode[], edges: Edge<CableData>[], startId: string): CanvasNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const adjacency = new Map<string, string[]>()
  const link = (from: string, to: string): void => {
    const next = adjacency.get(from)
    if (next) next.push(to)
    else adjacency.set(from, [to])
  }
  for (const edge of edges) {
    link(edge.source, edge.target)
    link(edge.target, edge.source)
  }

  const seen = new Set<string>([startId])
  const queue = [startId]
  const found: CanvasNode[] = []
  while (queue.length > 0) {
    const id = queue.shift()
    if (!id) break
    for (const nextId of adjacency.get(id) ?? []) {
      if (seen.has(nextId)) continue
      seen.add(nextId)
      const node = byId.get(nextId)
      if (!node || !isDeviceNode(node)) continue
      if (STORE_KINDS.has(node.data.kind as LifelineParticipant)) {
        found.push(node)
        continue
      }
      queue.push(nextId)
    }
  }
  return found
}

function behaviorNode(id: string, position: { x: number; y: number }, data: BehaviorNodeData): CanvasNode {
  return { id, type: 'behavior', position, data, selected: false }
}

export function seedSequenceGraph(args: {
  subject: BehaviorSubject
  useCase: SubgraphData
  ownerId: string
  ownerLabel: string
  parentNodes: CanvasNode[]
  parentEdges: Edge<CableData>[]
  nextNodeId: () => string
}): { nodes: CanvasNode[]; edges: Edge<CableData>[]; viewport: Viewport } {
  const lifelines: Array<{ participant: LifelineParticipant; refId: string; label: string }> = []
  if (args.subject.kind === 'useCase') {
    for (const actor of actorsLinkedToUseCase(args.useCase, args.subject.id)) {
      if (!isActorNode(actor)) continue
      lifelines.push({ participant: 'actor', refId: actor.id, label: actor.data.label || 'Actor' })
    }
  }
  lifelines.push({
    participant: 'appServer',
    refId: args.ownerId,
    label: args.ownerLabel || 'App server'
  })
  for (const store of reachableStores(args.parentNodes, args.parentEdges, args.ownerId)) {
    if (!isDeviceNode(store)) continue
    const kind = store.data.kind
    if (kind !== 'database' && kind !== 'cache' && kind !== 'messageQueue') continue
    lifelines.push({ participant: kind, refId: store.id, label: store.data.label || kind })
  }

  return {
    nodes: lifelines.map((item, index) =>
      behaviorNode(args.nextNodeId(), { x: 40 + index * 180, y: 48 }, {
        kind: 'lifeline',
        label: item.label,
        participant: item.participant,
        refId: item.refId
      })
    ),
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  }
}

export function seedActivityGraph(args: {
  useCaseId: string
  useCase: SubgraphData
  api: SubgraphData
  nextNodeId: () => string
}): { nodes: CanvasNode[]; edges: Edge<CableData>[]; viewport: Viewport } | null {
  const useCase = args.useCase.nodes.find((node) => node.id === args.useCaseId)
  if (!useCase || !isUseCaseNode(useCase)) return null
  const actions = useCase.data.apiTableIds.flatMap((apiId) => {
    const api = args.api.nodes.find((node) => node.id === apiId)
    if (!api || !isApiTableNode(api)) return []
    return [{ apiTableId: api.id, label: api.data.label || 'Action' }]
  })
  return {
    nodes: [
      behaviorNode(args.nextNodeId(), { x: 48, y: 40 }, { kind: 'initial', label: 'Start' }),
      ...actions.map((action, index) =>
        behaviorNode(args.nextNodeId(), { x: 48, y: 160 + index * 110 }, {
          kind: 'action',
          label: action.label,
          apiTableId: action.apiTableId
        })
      )
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  }
}
