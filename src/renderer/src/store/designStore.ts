import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type Viewport
} from '@xyflow/react'
import { create } from 'zustand'
import { DEVICE_DEFAULTS, KIND_LABEL } from './catalog'
import { analyzeCableDeleteImpact, type CableDeleteImpact } from './cableDeleteImpact'
import { parseProject, serializeProject, type ProjectDocument } from './schema'
import { cloneApiConfig } from './apiTableUtils'
import { seedActivityGraph, seedSequenceGraph } from './behaviorDiagrams'
import {
  createGroupFromSelection,
  dissolveGroups,
  reconcileParents,
  unparentSelectedDevices
} from './groups'
import type {
  ActorNodeData,
  ApiCallNodeData,
  AppServerInteriorMode,
  AppServerInteriors,
  ApiTableNodeData,
  BehaviorDiagram,
  BehaviorNodeData,
  BehaviorPlaceKind,
  BehaviorSubject,
  CableData,
  CanvasNode,
  CanvasNodeData,
  ClientInteriorMode,
  ClientInteriors,
  DatabaseInteriorMode,
  DatabaseInteriors,
  DeviceData,
  DeviceKind,
  EditorTool,
  EntityData,
  GroupData,
  SubgraphData,
  UmlDiagramType,
  UmlRelationKind,
  UseCaseNodeData,
  UseCaseRelationKind
} from './types'
import {
  ACTIVITY_NODE_KINDS,
  APP_SERVER_INTERIOR_MODES,
  emptyAppInteriors,
  emptyClientInteriors,
  emptyInteriors,
  emptySubgraph,
  isActorNode,
  isApiCallData,
  isApiCallNode,
  isApiTableData,
  isApiTableNode,
  isBehaviorNode,
  isDeviceNode,
  isEntityData,
  isEntityNode,
  isGroupNode,
  isUseCaseData,
  isUseCaseNode
} from './types'

let seq = 1
const HISTORY_LIMIT = 50

function numericIdSuffix(id: string): number {
  const value = Number(String(id).split('-').pop())
  return Number.isFinite(value) ? value : 0
}

function bumpSeqFromId(id: string): void {
  const value = numericIdSuffix(id)
  if (value >= seq) seq = value + 1
}

function visitGraphs(
  nodes: CanvasNode[],
  edges: Array<{ id: string }>,
  visitNode: (node: CanvasNode) => void,
  visitEdge: (id: string) => void
): void {
  for (const edge of edges) visitEdge(edge.id)
  for (const node of nodes) {
    visitNode(node)
    if (!isDeviceNode(node)) continue
    if (node.data.kind === 'database' && node.data.interiors) {
      const { erd, uml } = node.data.interiors.modes
      visitGraphs(erd.nodes, erd.edges, visitNode, visitEdge)
      visitGraphs(uml.nodes, uml.edges, visitNode, visitEdge)
    }
    if (node.data.kind === 'appServer' && node.data.appInteriors) {
      const { api, useCase } = node.data.appInteriors.modes
      visitGraphs(api.nodes, api.edges, visitNode, visitEdge)
      if (useCase) visitGraphs(useCase.nodes, useCase.edges, visitNode, visitEdge)
      for (const diagram of node.data.appInteriors.sequenceDiagrams ?? []) {
        visitGraphs(diagram.nodes, diagram.edges, visitNode, visitEdge)
      }
      for (const diagram of node.data.appInteriors.activityDiagrams ?? []) {
        visitGraphs(diagram.nodes, diagram.edges, visitNode, visitEdge)
      }
    }
    if (node.data.kind === 'client' && node.data.clientInteriors) {
      const { requests } = node.data.clientInteriors.modes
      visitGraphs(requests.nodes, requests.edges, visitNode, visitEdge)
    }
  }
}

function bumpSeqFromGraph(nodes: CanvasNode[], edges: Array<{ id: string }>): void {
  visitGraphs(
    nodes,
    edges,
    (node) => {
      bumpSeqFromId(node.id)
      if (isEntityData(node.data) || isApiTableData(node.data)) {
        for (const attribute of node.data.attributes) bumpSeqFromId(attribute.id)
      }
      if (isEntityData(node.data)) {
        for (const method of node.data.methods ?? []) bumpSeqFromId(method.id)
      }
      if (isApiTableData(node.data)) {
        for (const link of node.data.tableLinks ?? []) {
          for (const attribute of link.attributes) bumpSeqFromId(attribute.id)
        }
      }
    },
    bumpSeqFromId
  )
}

function takenIds(state: {
  nodes: CanvasNode[]
  edges: Array<{ id: string }>
  drillStack: Array<{ nodes: CanvasNode[]; edges: Array<{ id: string }> }>
}): Set<string> {
  const ids = new Set<string>()
  const collect = (nodes: CanvasNode[], edges: Array<{ id: string }>): void => {
    visitGraphs(
      nodes,
      edges,
      (node) => {
        ids.add(node.id)
        if (isEntityData(node.data) || isApiTableData(node.data)) {
          for (const attribute of node.data.attributes) ids.add(attribute.id)
        }
        if (isEntityData(node.data)) {
          for (const method of node.data.methods ?? []) ids.add(method.id)
        }
        if (isApiTableData(node.data)) {
          for (const link of node.data.tableLinks ?? []) {
            for (const attribute of link.attributes) ids.add(attribute.id)
          }
        }
      },
      (id) => ids.add(id)
    )
  }
  collect(state.nodes, state.edges)
  for (const frame of state.drillStack) collect(frame.nodes, frame.edges)
  return ids
}

const nextId = (prefix: string, taken?: Set<string>): string => {
  let id = `${prefix}-${seq++}`
  if (!taken) return id
  while (taken.has(id)) id = `${prefix}-${seq++}`
  taken.add(id)
  return id
}

interface GraphSnapshot {
  nodes: CanvasNode[]
  edges: Edge<CableData>[]
}

interface DrillFrame extends GraphSnapshot {
  viewport: Viewport
  ownerId: string
}

export interface DesignState {
  name: string
  filePath: string | null
  dirty: boolean
  nodes: CanvasNode[]
  edges: Edge<CableData>[]
  viewport: Viewport
  drillPath: string[]
  drillStack: DrillFrame[]
  interiorMode: DatabaseInteriorMode | AppServerInteriorMode | ClientInteriorMode | null
  umlDiagramType: UmlDiagramType | null
  pendingEntity: boolean
  pendingRelationKind: UmlRelationKind | null
  pendingUseCaseRelation: UseCaseRelationKind | null
  pendingApiTable: boolean
  pendingApiCall: boolean
  pendingActor: boolean
  pendingUseCase: boolean
  selectedId: string | null
  selectedIds: string[]
  tool: EditorTool
  connectSourceId: string | null
  connectOnce: boolean
  pendingKind: DeviceKind | null
  undoStack: GraphSnapshot[]
  redoStack: GraphSnapshot[]
  dragSnapshot: GraphSnapshot | null
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void
  onEdgesChange: (changes: EdgeChange<Edge<CableData>>[]) => void
  onConnect: (connection: Connection) => void
  isValidConnection: (connection: Connection | Edge<CableData>) => boolean
  beginReconnect: (edge: Edge<CableData>) => void
  onReconnect: (oldEdge: Edge<CableData>, connection: Connection) => void
  onReconnectEnd: (edge: Edge<CableData>) => void
  addDevice: (kind: DeviceKind, position: { x: number; y: number }, options?: { keepArmed?: boolean }) => void
  updateDevice: (id: string, patch: Partial<DeviceData>) => void
  updateCable: (
    id: string,
    patch: Partial<Pick<CableData, 'label' | 'relationKind' | 'guard' | 'sequenceMessage'>>
  ) => void
  updateGroup: (id: string, patch: Partial<Pick<GroupData, 'label' | 'notes'>>) => void
  groupSelected: () => void
  ungroupSelected: () => void
  handleNodeClick: (id: string) => void
  handleEdgeClick: (id: string) => void
  setTool: (tool: EditorTool, options?: { once?: boolean; relationKind?: UmlRelationKind }) => void
  setPendingKind: (kind: DeviceKind | null) => void
  setSelected: (id: string | null) => void
  syncSelection: (nodeIds: string[], edgeIds: string[]) => void
  setViewport: (viewport: Viewport) => void
  enterDatabase: (id: string) => void
  enterAppServer: (id: string) => void
  enterClient: (id: string) => void
  exitDrill: () => void
  exitToRoot: () => void
  setInteriorMode: (mode: DatabaseInteriorMode | AppServerInteriorMode) => void
  setUmlDiagramType: (type: UmlDiagramType) => void
  setPendingEntity: (value: boolean) => void
  setPendingRelationKind: (kind: UmlRelationKind | null) => void
  setPendingUseCaseRelation: (kind: UseCaseRelationKind | null) => void
  addEntity: (position: { x: number; y: number }, options?: { keepArmed?: boolean }) => void
  updateEntity: (id: string, patch: Partial<EntityData>) => void
  setPendingApiTable: (value: boolean) => void
  addApiTable: (position: { x: number; y: number }, options?: { keepArmed?: boolean }) => void
  updateApiTable: (id: string, patch: Partial<ApiTableNodeData>) => void
  setPendingApiCall: (value: boolean) => void
  addApiCall: (position: { x: number; y: number }, options?: { keepArmed?: boolean }) => void
  updateApiCall: (id: string, patch: Partial<ApiCallNodeData>) => void
  setPendingActor: (value: boolean) => void
  addActor: (position: { x: number; y: number }, options?: { keepArmed?: boolean }) => void
  updateActor: (id: string, patch: Partial<ActorNodeData>) => void
  setPendingUseCase: (value: boolean) => void
  addUseCase: (position: { x: number; y: number }, options?: { keepArmed?: boolean }) => void
  updateUseCase: (id: string, patch: Partial<UseCaseNodeData>) => void
  pendingBehavior: BehaviorPlaceKind | null
  setPendingBehavior: (kind: BehaviorPlaceKind | null) => void
  addBehaviorNode: (
    kind: BehaviorPlaceKind,
    position: { x: number; y: number },
    options?: { keepArmed?: boolean }
  ) => void
  updateBehaviorNode: (id: string, data: BehaviorNodeData) => void
  createSequenceDiagram: (subject: BehaviorSubject) => void
  createActivityDiagram: (useCaseId: string) => void
  setActiveBehaviorDiagram: (id: string) => void
  deleteSelected: () => void
  deleteIds: (ids: string[]) => void
  requestDelete: (ids: string[]) => void
  confirmPendingDelete: () => void
  cancelPendingDelete: () => void
  pendingDeleteImpact: CableDeleteImpact | null
  pendingDeleteIds: string[] | null
  duplicateSelected: () => void
  selectAll: () => void
  cancelInteraction: () => void
  beginNodeDrag: () => void
  endNodeDrag: () => void
  undo: () => void
  redo: () => void
  newDesign: () => void
  loadDocument: (doc: ProjectDocument, path: string | null) => void
  loadFromJson: (raw: string, path: string | null) => void
  toDocument: () => Omit<ProjectDocument, 'version'>
  toJson: () => string
  markSaved: (path: string) => void
  setName: (name: string) => void
}


function cloneNodeData(data: CanvasNodeData): CanvasNodeData {
  if (isEntityData(data)) {
    return {
      ...data,
      attributes: data.attributes.map((attribute) => ({ ...attribute })),
      ...(data.methods ? { methods: data.methods.map((method) => ({ ...method })) } : {})
    }
  }
  if (isApiTableData(data)) {
    return {
      ...data,
      attributes: data.attributes.map((attribute) => ({ ...attribute })),
      ...(data.tableLinks
        ? {
            tableLinks: data.tableLinks.map((link) => ({
              ...link,
              attributes: link.attributes.map((attribute) => ({ ...attribute }))
            }))
          }
        : {})
    }
  }
  if (isApiCallData(data)) {
    return {
      ...data,
      ...(data.paramValues ? { paramValues: { ...data.paramValues } } : {})
    }
  }
  if (isUseCaseData(data)) {
    return { ...data, apiTableIds: [...data.apiTableIds] }
  }
  return { ...data }
}

function cloneGraph(nodes: CanvasNode[], edges: Edge<CableData>[]): GraphSnapshot {
  return {
    nodes: nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      data: cloneNodeData(node.data),
      style: node.style ? { ...node.style } : node.style,
      selected: false
    })),
    edges: edges.map((edge) => ({
      ...edge,
      data: { ...edge.data },
      selected: false
    }))
  }
}

const DATABASE_INTERIOR_MODES: DatabaseInteriorMode[] = ['erd', 'uml', 'object']

function isDatabaseInteriorMode(mode: string): mode is DatabaseInteriorMode {
  return (DATABASE_INTERIOR_MODES as string[]).includes(mode)
}

function interiorsForDb(data: DeviceData): DatabaseInteriors {
  const interiors = data.interiors ?? emptyInteriors()
  const activeMode = DATABASE_INTERIOR_MODES.includes(interiors.activeMode) ? interiors.activeMode : 'erd'
  return {
    activeMode,
    umlDiagramType: 'class',
    modes: {
      erd: interiors.modes.erd ?? emptySubgraph(),
      uml: interiors.modes.uml ?? emptySubgraph(),
      object: interiors.modes.object ?? emptySubgraph()
    }
  }
}

function isAppServerInteriorMode(mode: string): mode is AppServerInteriorMode {
  return (APP_SERVER_INTERIOR_MODES as string[]).includes(mode)
}

function interiorsForApp(data: DeviceData): AppServerInteriors {
  const interiors = data.appInteriors ?? emptyAppInteriors()
  const activeMode = isAppServerInteriorMode(interiors.activeMode) ? interiors.activeMode : 'api'
  const sequenceDiagrams = interiors.sequenceDiagrams ?? []
  const activityDiagrams = (interiors.activityDiagrams ?? []).filter((diagram) => diagram.subject.kind === 'useCase')
  const activeSequenceId =
    interiors.activeSequenceId && sequenceDiagrams.some((diagram) => diagram.id === interiors.activeSequenceId)
      ? interiors.activeSequenceId
      : null
  const activeActivityId =
    interiors.activeActivityId && activityDiagrams.some((diagram) => diagram.id === interiors.activeActivityId)
      ? interiors.activeActivityId
      : null
  return {
    activeMode,
    modes: {
      api: interiors.modes.api ?? emptySubgraph(),
      useCase: interiors.modes.useCase ?? emptySubgraph()
    },
    sequenceDiagrams,
    activeSequenceId,
    activityDiagrams,
    activeActivityId
  }
}

function activeDiagramGraph(interiors: AppServerInteriors, mode: 'sequence' | 'activity'): SubgraphData {
  const diagrams = mode === 'sequence' ? (interiors.sequenceDiagrams ?? []) : (interiors.activityDiagrams ?? [])
  const activeId = mode === 'sequence' ? interiors.activeSequenceId : interiors.activeActivityId
  const diagram = diagrams.find((item) => item.id === activeId)
  if (!diagram) return emptySubgraph()
  return { nodes: diagram.nodes, edges: diagram.edges, viewport: diagram.viewport }
}

function writeBehaviorGraph(
  interiors: AppServerInteriors,
  mode: 'sequence' | 'activity',
  graph: SubgraphData
): AppServerInteriors {
  if (mode === 'sequence') {
    if (!interiors.activeSequenceId) return interiors
    return {
      ...interiors,
      sequenceDiagrams: (interiors.sequenceDiagrams ?? []).map((diagram) =>
        diagram.id === interiors.activeSequenceId
          ? { ...diagram, nodes: graph.nodes, edges: graph.edges, viewport: graph.viewport }
          : diagram
      )
    }
  }
  if (!interiors.activeActivityId) return interiors
  return {
    ...interiors,
    activityDiagrams: (interiors.activityDiagrams ?? []).map((diagram) =>
      diagram.id === interiors.activeActivityId
        ? { ...diagram, nodes: graph.nodes, edges: graph.edges, viewport: graph.viewport }
        : diagram
    )
  }
}

function writeAppGraph(
  interiors: AppServerInteriors,
  graph: SubgraphData,
  mode: AppServerInteriorMode
): AppServerInteriors {
  if (mode === 'sequence' || mode === 'activity') {
    return { ...writeBehaviorGraph(interiors, mode, graph), activeMode: mode }
  }
  return {
    ...interiors,
    activeMode: mode,
    modes: {
      ...interiors.modes,
      [mode]: graph
    }
  }
}

function withOwnerInteriors(stack: DrillFrame[], interiors: AppServerInteriors): DrillFrame[] {
  if (stack.length === 0) return stack
  const frame = stack[stack.length - 1]
  const next = stack.slice()
  next[next.length - 1] = {
    ...frame,
    nodes: frame.nodes.map((node) =>
      node.id === frame.ownerId && isDeviceNode(node) && node.data.kind === 'appServer'
        ? { ...node, data: { ...node.data, appInteriors: interiors } }
        : node
    )
  }
  return next
}

function appOwner(state: {
  drillPath: string[]
  drillStack: DrillFrame[]
}): { frame: DrillFrame; ownerId: string; interiors: AppServerInteriors } | null {
  if (state.drillPath.length === 0 || state.drillStack.length === 0) return null
  const frame = state.drillStack[state.drillStack.length - 1]
  const ownerId = state.drillPath[state.drillPath.length - 1]
  const owner = frame.nodes.find((node) => node.id === ownerId)
  if (!owner || !isDeviceNode(owner) || owner.data.kind !== 'appServer') return null
  return { frame, ownerId, interiors: interiorsForApp(owner.data) }
}

function interiorsForClient(data: DeviceData): ClientInteriors {
  return data.clientInteriors ?? emptyClientInteriors()
}

function graphForNode(node: CanvasNode): SubgraphData {
  if (!isDeviceNode(node)) return emptySubgraph()
  if (node.data.kind === 'database') {
    const interiors = interiorsForDb(node.data)
    return interiors.modes[interiors.activeMode] ?? emptySubgraph()
  }
  if (node.data.kind === 'appServer') {
    const interiors = interiorsForApp(node.data)
    if (interiors.activeMode === 'sequence' || interiors.activeMode === 'activity') {
      return activeDiagramGraph(interiors, interiors.activeMode)
    }
    return interiors.modes[interiors.activeMode] ?? emptySubgraph()
  }
  if (node.data.kind === 'client') {
    const interiors = interiorsForClient(node.data)
    return interiors.modes[interiors.activeMode] ?? emptySubgraph()
  }
  return emptySubgraph()
}

function writeActiveModeGraph<Mode extends string>(
  interiors: { activeMode: Mode; modes: Record<Mode, SubgraphData> },
  graph: SubgraphData
): { activeMode: Mode; modes: Record<Mode, SubgraphData> } {
  return {
    ...interiors,
    modes: {
      ...interiors.modes,
      [interiors.activeMode]: graph
    }
  }
}

/** Persist the active DB mode graph and mirror nodes/edges into the sibling ERD/UML/Object modes. */
function writeDatabaseGraph(interiors: DatabaseInteriors, graph: SubgraphData): DatabaseInteriors {
  const activeMode = interiors.activeMode
  const siblingModes = DATABASE_INTERIOR_MODES.filter((mode) => mode !== activeMode)
  const nextModes = { ...interiors.modes, [activeMode]: graph }
  for (const mode of siblingModes) {
    const sibling = interiors.modes[mode] ?? emptySubgraph()
    nextModes[mode] = { ...sibling, nodes: graph.nodes, edges: graph.edges }
  }
  return {
    ...interiors,
    modes: nextModes
  }
}

function allowsEntityEditing(
  mode: DatabaseInteriorMode | AppServerInteriorMode | ClientInteriorMode | null,
  umlDiagramType: UmlDiagramType | null
): boolean {
  if (mode === 'erd') return true
  return mode === 'uml' && umlDiagramType === 'class'
}

function patchOwnerInteriors(
  nodes: CanvasNode[],
  ownerId: string,
  graph: SubgraphData,
  activeMode?: DatabaseInteriorMode | AppServerInteriorMode | ClientInteriorMode
): CanvasNode[] {
  return nodes.map((node) => {
    if (node.id !== ownerId || !isDeviceNode(node)) return node
    if (node.data.kind === 'database') {
      const interiors = interiorsForDb(node.data)
      const withGraph = writeDatabaseGraph(interiors, graph)
      return {
        ...node,
        data: {
          ...node.data,
          interiors:
            activeMode && isDatabaseInteriorMode(activeMode)
              ? { ...withGraph, activeMode }
              : withGraph
        }
      }
    }
    if (node.data.kind === 'appServer') {
      const interiors = interiorsForApp(node.data)
      const mode = activeMode && isAppServerInteriorMode(activeMode) ? activeMode : interiors.activeMode
      return {
        ...node,
        data: {
          ...node.data,
          appInteriors: writeAppGraph(interiors, graph, mode)
        }
      }
    }
    if (node.data.kind === 'client') {
      const interiors = interiorsForClient(node.data)
      const nextInteriors = writeActiveModeGraph(interiors, graph)
      return {
        ...node,
        data: {
          ...node.data,
          clientInteriors: nextInteriors
        }
      }
    }
    return node
  })
}

function foldDrillStack(
  nodes: CanvasNode[],
  edges: Edge<CableData>[],
  viewport: Viewport,
  stack: DrillFrame[]
): { nodes: CanvasNode[]; edges: Edge<CableData>[]; viewport: Viewport } {
  let current: SubgraphData = { nodes, edges, viewport }
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const frame = stack[index]
    current = {
      nodes: patchOwnerInteriors(frame.nodes, frame.ownerId, current),
      edges: frame.edges,
      viewport: frame.viewport
    }
  }
  return current
}

function markSelection(
  nodes: CanvasNode[],
  edges: Edge<CableData>[],
  selectedIds: string[]
): { nodes: CanvasNode[]; edges: Edge<CableData>[] } {
  const selected = new Set(selectedIds)
  return {
    nodes: nodes.map((node) => ({ ...node, selected: selected.has(node.id) })),
    edges: edges.map((edge) => ({ ...edge, selected: selected.has(edge.id) }))
  }
}

function countKind(nodes: CanvasNode[], kind: DeviceKind): number {
  return nodes.filter((n) => isDeviceNode(n) && n.data.kind === kind).length + 1
}

function primarySelection(nodeIds: string[], edgeIds: string[]): string | null {
  return nodeIds[0] ?? edgeIds[0] ?? null
}

function removeByIds(
  nodes: CanvasNode[],
  edges: Edge<CableData>[],
  ids: string[]
): { nodes: CanvasNode[]; edges: Edge<CableData>[] } {
  const remove = new Set(ids)
  const nextNodes = nodes.flatMap((node) => {
    if (remove.has(node.id)) return []
    if (node.parentId && remove.has(node.parentId)) {
      const parent = nodes.find((item) => item.id === node.parentId)
      const origin = parent?.position ?? { x: 0, y: 0 }
      const { parentId: _parentId, ...rest } = node
      return [{ ...rest, position: { x: origin.x + node.position.x, y: origin.y + node.position.y } }]
    }
    return [node]
  })
  const remaining = new Set(nextNodes.map((node) => node.id))
  const nextEdges = edges.filter(
    (edge) => !remove.has(edge.id) && remaining.has(edge.source) && remaining.has(edge.target)
  )
  return { nodes: nextNodes, edges: nextEdges }
}

const PORTS = new Set(['top', 'right', 'bottom', 'left'])
let reconnectingEdgeId: string | null = null
let reconnectDidConnect = false

function portId(value: string | null | undefined, fallback?: string): string | undefined {
  if (typeof value === 'string' && PORTS.has(value)) return value
  return fallback
}

function useCaseLinkOk(
  nodes: CanvasNode[],
  connection: Pick<Connection, 'source' | 'target'>,
  relation: UseCaseRelationKind
): boolean {
  const sourceNode = nodes.find((node) => node.id === connection.source)
  const targetNode = nodes.find((node) => node.id === connection.target)
  if (!sourceNode || !targetNode) return false
  const sourceKind = sourceNode.data.kind
  const targetKind = targetNode.data.kind
  if (relation === 'association') {
    return (
      (sourceKind === 'actor' && targetKind === 'useCase') ||
      (sourceKind === 'useCase' && targetKind === 'actor')
    )
  }
  return sourceKind === 'useCase' && targetKind === 'useCase'
}

function stripRealizedApis(nodes: CanvasNode[], removedApiIds: Set<string>): CanvasNode[] {
  if (removedApiIds.size === 0) return nodes
  return nodes.map((node) => {
    if (!isUseCaseNode(node)) return node
    const apiTableIds = node.data.apiTableIds.filter((id) => !removedApiIds.has(id))
    if (apiTableIds.length === node.data.apiTableIds.length) return node
    return { ...node, data: { ...node.data, apiTableIds } }
  })
}

function canLink(
  nodes: CanvasNode[],
  edges: Edge<CableData>[],
  connection: Pick<Connection, 'source' | 'target'>,
  ignoreEdgeId?: string | null
): boolean {
  if (!connection.source || !connection.target || connection.source === connection.target) return false
  const sourceNode = nodes.find((node) => node.id === connection.source)
  const targetNode = nodes.find((node) => node.id === connection.target)
  if (!sourceNode || !targetNode || isGroupNode(sourceNode) || isGroupNode(targetNode)) return false
  return !edges.some(
    (edge) =>
      edge.id !== ignoreEdgeId &&
      edge.source === connection.source &&
      edge.target === connection.target
  )
}

function sequenceLinkOk(nodes: CanvasNode[], connection: Pick<Connection, 'source' | 'target'>): boolean {
  const sourceNode = nodes.find((node) => node.id === connection.source)
  const targetNode = nodes.find((node) => node.id === connection.target)
  return Boolean(
    sourceNode &&
      targetNode &&
      isBehaviorNode(sourceNode) &&
      isBehaviorNode(targetNode) &&
      sourceNode.data.kind === 'lifeline' &&
      targetNode.data.kind === 'lifeline'
  )
}

function nextSequenceOrder(edges: Edge<CableData>[]): number {
  let max = 0
  for (const edge of edges) {
    const order = edge.data?.sequenceMessage?.order
    if (typeof order === 'number' && order > max) max = order
  }
  return max + 1
}

function behaviorPlaceData(kind: BehaviorPlaceKind): BehaviorNodeData {
  if (kind === 'lifeline') return { kind: 'lifeline', label: 'Lifeline', participant: 'appServer' }
  const label =
    kind === 'initial' ? 'Start' : kind === 'final' ? 'End' : kind === 'action' ? 'Action' : kind[0].toUpperCase() + kind.slice(1)
  return { kind, label }
}

function stripRemovedApis(interiors: AppServerInteriors, removedApiIds: Set<string>): AppServerInteriors {
  if (removedApiIds.size === 0) return interiors
  const stripNode = (node: CanvasNode): CanvasNode => {
    if (!isBehaviorNode(node) || node.data.kind === 'lifeline' || !node.data.apiTableId) return node
    if (!removedApiIds.has(node.data.apiTableId)) return node
    const { apiTableId: _apiTableId, ...rest } = node.data
    return { ...node, data: rest }
  }
  const stripEdge = (edge: Edge<CableData>): Edge<CableData> => {
    const message = edge.data?.sequenceMessage
    if (!message?.apiTableId || !removedApiIds.has(message.apiTableId)) return edge
    const { apiTableId: _apiTableId, ...sequenceMessage } = message
    return { ...edge, data: { ...edge.data, sequenceMessage } }
  }
  return {
    ...interiors,
    sequenceDiagrams: (interiors.sequenceDiagrams ?? []).map((diagram) => ({
      ...diagram,
      edges: diagram.edges.map(stripEdge)
    })),
    activityDiagrams: (interiors.activityDiagrams ?? []).map((diagram) => ({
      ...diagram,
      nodes: diagram.nodes.map(stripNode),
      edges: diagram.edges.map(stripEdge)
    }))
  }
}

export const useDesignStore = create<DesignState>((set, get) => ({
  name: 'Untitled Design',
  filePath: null,
  dirty: false,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  drillPath: [],
  drillStack: [],
  interiorMode: null,
  umlDiagramType: null,
  pendingEntity: false,
  pendingRelationKind: null,
  pendingUseCaseRelation: null,
  pendingApiTable: false,
  pendingApiCall: false,
  pendingActor: false,
  pendingUseCase: false, pendingBehavior: null,
  pendingDeleteImpact: null,
  pendingDeleteIds: null,
  selectedId: null,
  selectedIds: [],
  tool: 'select',
  connectSourceId: null,
  connectOnce: false,
  pendingKind: null,
  undoStack: [],
  redoStack: [],
  dragSnapshot: null,

  onNodesChange: (changes) => {
    const nodes = applyNodeChanges(changes, get().nodes)
    const structural = changes.some((change) => change.type === 'remove' || change.type === 'add')
    const selectionOnly = changes.every((change) => change.type === 'select')
    if (structural) {
      const snapshot = cloneGraph(get().nodes, get().edges)
      
      const selectedIds = get().selectedIds.filter(
        (id) => nodes.some((node) => node.id === id) || get().edges.some((edge) => edge.id === id)
      )
      set({
        nodes,
        edges: get().edges,
        dirty: true,
        selectedIds,
        selectedId: selectedIds.includes(get().selectedId ?? '') ? get().selectedId : (selectedIds[0] ?? null),
        undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
        redoStack: []
      })
      return
    }
    if (selectionOnly) {
      set({ nodes })
      return
    }
    set({ nodes, dirty: true })
  },

  onEdgesChange: (changes) => {
    const edges = applyEdgeChanges(changes, get().edges)
    if (changes.every((change) => change.type === 'select')) {
      set({ edges })
      return
    }
    const structural = changes.some((change) => change.type === 'remove' || change.type === 'add')
    const snapshot = structural ? cloneGraph(get().nodes, get().edges) : null
    
    const selectedIds = get().selectedIds.filter(
      (id) => get().nodes.some((node) => node.id === id) || edges.some((edge) => edge.id === id)
    )
    set({
      edges: edges,
      dirty: true,
      selectedIds,
      selectedId: selectedIds.includes(get().selectedId ?? '') ? get().selectedId : (selectedIds[0] ?? null),
      ...(snapshot
        ? { undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT), redoStack: [] }
        : {})
    })
  },

  isValidConnection: (connection) => {
    const state = get()
    if (!canLink(state.nodes, state.edges, connection, reconnectingEdgeId)) return false
    if (state.interiorMode === 'sequence' && !sequenceLinkOk(state.nodes, connection)) return false
    if (state.interiorMode !== 'useCase') return true
    const relation =
      (reconnectingEdgeId
        ? state.edges.find((edge) => edge.id === reconnectingEdgeId)?.data?.useCaseRelation
        : state.pendingUseCaseRelation) ?? 'association'
    return useCaseLinkOk(state.nodes, connection, relation)
  },

  beginReconnect: (edge) => {
    reconnectingEdgeId = edge.id
    reconnectDidConnect = false
  },

  onReconnect: (oldEdge, connection) => {
    if (!canLink(get().nodes, get().edges, connection, oldEdge.id)) return
    if (!connection.source || !connection.target) return
    if (get().interiorMode === 'sequence' && !sequenceLinkOk(get().nodes, connection)) return
    if (get().interiorMode === 'useCase') {
      const relation = oldEdge.data?.useCaseRelation ?? 'association'
      if (!useCaseLinkOk(get().nodes, connection, relation)) return
    }
    const snapshot = cloneGraph(get().nodes, get().edges)
    const edges = get().edges.map((edge) =>
      edge.id === oldEdge.id
        ? {
            ...edge,
            source: connection.source as string,
            target: connection.target as string,
            sourceHandle: portId(connection.sourceHandle, 'right'),
            targetHandle: portId(connection.targetHandle, 'left')
          }
        : edge
    )
    
    reconnectDidConnect = true
    set({
      edges: edges,
      dirty: true,
      undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  onReconnectEnd: (edge) => {
    const failed = !reconnectDidConnect
    reconnectingEdgeId = null
    reconnectDidConnect = false
    if (failed && get().edges.some((item) => item.id === edge.id)) {
      get().deleteIds([edge.id])
    }
  },

  onConnect: (connection) => {
    if (!canLink(get().nodes, get().edges, connection)) return
    if (!connection.source || !connection.target) return
    const state = get()
    if (state.interiorMode === 'sequence' && !sequenceLinkOk(state.nodes, connection)) return
    const snapshot = cloneGraph(get().nodes, get().edges)
    const useCaseRelation =
      state.interiorMode === 'useCase' ? (state.pendingUseCaseRelation ?? 'association') : undefined
    if (useCaseRelation && !useCaseLinkOk(state.nodes, connection, useCaseRelation)) return
    const relationKind =
      state.interiorMode === 'uml' && state.umlDiagramType === 'class'
        ? (state.pendingRelationKind ?? 'association')
        : undefined
    const sequenceMessage =
      state.interiorMode === 'sequence'
        ? { order: nextSequenceOrder(state.edges), messageKind: 'sync' as const }
        : undefined
    const edge: Edge<CableData> = {
      id: nextId('cable', takenIds(get())),
      source: connection.source,
      target: connection.target,
      sourceHandle: portId(connection.sourceHandle, 'right'),
      targetHandle: portId(connection.targetHandle, 'left'),
      type: 'cable',
      data: {
        flow: 0,
        label: '',
        ...(relationKind ? { relationKind } : {}),
        ...(useCaseRelation ? { useCaseRelation } : {}),
        ...(sequenceMessage ? { sequenceMessage } : {})
      }
    }
    
    const connected = [...get().edges, edge]
    const connectOnce = get().connectOnce
    if (connectOnce) {
      const unmarked = markSelection(get().nodes, connected, [])
      set({
        nodes: unmarked.nodes,
        edges: unmarked.edges,
        dirty: true,
        tool: 'select',
        connectOnce: false,
        connectSourceId: null,
        pendingRelationKind: null,
        pendingUseCaseRelation: null,
        selectedId: null,
        selectedIds: [],
        undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
        redoStack: []
      })
      return
    }
    set({
      edges: connected,
      dirty: true,
      connectSourceId: null,
      undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  addDevice: (kind, position, options) => {
    if (get().drillPath.length > 0) return
    const keepArmed = options?.keepArmed ?? get().pendingKind != null
    const snapshot = cloneGraph(get().nodes, get().edges)
    const defaults = DEVICE_DEFAULTS[kind]
    const index = countKind(get().nodes, kind)
    const taken = takenIds(get())
    const node: CanvasNode = {
      id: nextId(kind, taken),
      type: 'device',
      position,
      selected: !keepArmed,
      data: {
        ...defaults,
        label: `${KIND_LABEL[kind]} ${index}`
      }
    }
    const nodes = [...get().nodes.map((item) => ({ ...item, selected: keepArmed ? item.selected : false })), node]
    
    set({
      nodes,
      edges: get().edges,
      selectedId: keepArmed ? get().selectedId : node.id,
      selectedIds: keepArmed ? get().selectedIds : [node.id],
      dirty: true,
      undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  updateDevice: (id, patch) => {
    const snapshot = cloneGraph(get().nodes, get().edges)
    const nodes = get().nodes.map((node) =>
      node.id === id && isDeviceNode(node) ? { ...node, data: { ...node.data, ...patch } } : node
    )
    
    set({
      nodes,
      edges: get().edges,
      dirty: true,
      undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  updateCable: (id, patch) => {
    const current = get().edges.find((edge) => edge.id === id)
    if (!current) return
    const snapshot = cloneGraph(get().nodes, get().edges)
    const label = patch.label == null ? (current.data?.label ?? '') : patch.label
    const relationKind =
      patch.relationKind === undefined ? current.data?.relationKind : patch.relationKind
    const edges = get().edges.map((edge) =>
      edge.id === id
        ? {
            ...edge,
            data: {
              ...edge.data,
              label,
              ...(relationKind ? { relationKind } : {}),
              ...(patch.guard !== undefined ? { guard: patch.guard } : {}),
              ...(patch.sequenceMessage !== undefined ? { sequenceMessage: patch.sequenceMessage } : {})
            }
          }
        : edge
    )
    
    set({
      edges: edges,
      dirty: true,
      undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  updateGroup: (id, patch) => {
    const current = get().nodes.find((node) => node.id === id)
    if (!current || !isGroupNode(current)) return
    const snapshot = cloneGraph(get().nodes, get().edges)
    const nodes = get().nodes.map((node) =>
      node.id === id && isGroupNode(node) ? { ...node, data: { ...node.data, ...patch } } : node
    )
    set({
      nodes,
      dirty: true,
      undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  groupSelected: () => {
    const { nodes, edges, selectedIds } = get()
    const grouped = createGroupFromSelection(nodes, selectedIds, nextId)
    if (!grouped) return
    const snapshot = cloneGraph(nodes, edges)
    const groupId = grouped.find(isGroupNode)?.id ?? null
    const marked = markSelection(grouped, edges, groupId ? [groupId] : selectedIds)
    
    set({
      ...marked,
      edges: marked.edges,
      selectedId: groupId,
      selectedIds: groupId ? [groupId] : selectedIds,
      dirty: true,
      undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  ungroupSelected: () => {
    const { nodes, edges, selectedIds } = get()
    const groupIds = selectedIds.filter((id) => nodes.some((node) => node.id === id && isGroupNode(node)))
    const hasGroupedDevices = nodes.some((node) => selectedIds.includes(node.id) && Boolean(node.parentId))
    if (groupIds.length === 0 && !hasGroupedDevices) return
    const dissolved = dissolveGroups(nodes, groupIds)
    const nextNodes = unparentSelectedDevices(dissolved, selectedIds)
    const snapshot = cloneGraph(nodes, edges)
    const remainingIds = selectedIds.filter((id) => nextNodes.some((node) => node.id === id))
    const marked = markSelection(nextNodes, edges, remainingIds)
    
    set({
      ...marked,
      edges: marked.edges,
      selectedId: remainingIds[0] ?? null,
      selectedIds: remainingIds,
      dirty: true,
      undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  handleNodeClick: (id) => {
    const { tool, connectSourceId } = get()
    if (tool === 'delete') {
      get().requestDelete([id])
      return
    }
    if (tool === 'connect') {
      const node = get().nodes.find((item) => item.id === id)
      if (!node || isGroupNode(node)) {
        set({ selectedId: id, selectedIds: [id], connectSourceId: null, pendingKind: null })
        return
      }
      if (!connectSourceId) {
        set({ connectSourceId: id, selectedId: null, selectedIds: [], pendingKind: null, pendingEntity: false })
        return
      }
      if (connectSourceId === id) {
        set({ connectSourceId: null })
        return
      }
      get().onConnect({
        source: connectSourceId,
        target: id,
        sourceHandle: 'right',
        targetHandle: 'left'
      })
      if (get().tool === 'connect') {
        set({ connectSourceId: null, selectedId: id, selectedIds: [id] })
      }
      return
    }
    if (tool === 'pan') return
    set({ selectedId: id, connectSourceId: null, pendingKind: null, pendingEntity: false })
  },

  handleEdgeClick: (id) => {
    if (get().tool === 'delete') {
      get().requestDelete([id])
      return
    }
    if (get().tool === 'pan') return
    set({ selectedId: id, selectedIds: [id], connectSourceId: null, pendingKind: null })
  },

  setTool: (tool, options) =>
    set({
      tool,
      connectSourceId: null,
      pendingKind: null,
      pendingEntity: false,
      pendingUseCaseRelation: null,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingActor: false,
      pendingUseCase: false, pendingBehavior: null,
      pendingRelationKind: tool === 'connect' ? (options?.relationKind ?? null) : null,
      connectOnce: tool === 'connect' ? Boolean(options?.once) : false
    }),

  setPendingKind: (kind) =>
    set({
      pendingKind: get().drillPath.length > 0 ? null : kind,
      pendingEntity: false,
      pendingRelationKind: null,
      pendingUseCaseRelation: null,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingActor: false,
      pendingUseCase: false, pendingBehavior: null,
      tool: 'select',
      connectSourceId: null,
      connectOnce: false
    }),

  setSelected: (id) => {
    const selectedIds = id ? [id] : []
    const marked = markSelection(get().nodes, get().edges, selectedIds)
    set({
      selectedId: id,
      selectedIds,
      ...marked
    })
  },

  syncSelection: (nodeIds, edgeIds) => {
    if (get().tool === 'delete' || get().tool === 'connect' || get().tool === 'pan') return
    const selectedIds = [...nodeIds, ...edgeIds]
    set({
      selectedIds,
      selectedId: primarySelection(nodeIds, edgeIds)
    })
  },

  setViewport: (viewport) => set({ viewport }),

  enterDatabase: (id) => {
    const state = get()
    const node = state.nodes.find((item) => item.id === id)
    if (!node || !isDeviceNode(node) || node.data.kind !== 'database') return
    const subgraph = graphForNode(node)
    const interiors = interiorsForDb(node.data)
    bumpSeqFromGraph([node], [])
    bumpSeqFromGraph(subgraph.nodes, subgraph.edges)
    set({
      nodes: subgraph.nodes.map((item) => ({ ...item, selected: false })),
      edges: subgraph.edges.map((edge) => ({ ...edge, selected: false })),
      viewport: subgraph.viewport,
      drillPath: [...state.drillPath, id],
      drillStack: [
        ...state.drillStack,
        { nodes: state.nodes, edges: state.edges, viewport: state.viewport, ownerId: id }
      ],
      interiorMode: interiors.activeMode,
      umlDiagramType: interiors.umlDiagramType,
      pendingEntity: false,
      pendingRelationKind: null,
      pendingUseCaseRelation: null,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingActor: false,
      pendingUseCase: false, pendingBehavior: null,
      selectedId: null,
      selectedIds: [],
      pendingKind: null,
      connectSourceId: null,
      tool: 'select',
      connectOnce: false,
      undoStack: [],
      redoStack: []
    })
  },

  enterAppServer: (id) => {
    const state = get()
    const node = state.nodes.find((item) => item.id === id)
    if (!node || !isDeviceNode(node) || node.data.kind !== 'appServer') return
    const subgraph = graphForNode(node)
    const interiors = interiorsForApp(node.data)
    bumpSeqFromGraph([node], [])
    bumpSeqFromGraph(subgraph.nodes, subgraph.edges)
    set({
      nodes: subgraph.nodes.map((item) => ({ ...item, selected: false })),
      edges: subgraph.edges.map((edge) => ({ ...edge, selected: false })),
      viewport: subgraph.viewport,
      drillPath: [...state.drillPath, id],
      drillStack: [
        ...state.drillStack,
        { nodes: state.nodes, edges: state.edges, viewport: state.viewport, ownerId: id }
      ],
      interiorMode: interiors.activeMode,
      umlDiagramType: null,
      pendingEntity: false,
      pendingRelationKind: null,
      pendingUseCaseRelation: null,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingActor: false,
      pendingUseCase: false, pendingBehavior: null,
      selectedId: null,
      selectedIds: [],
      pendingKind: null,
      connectSourceId: null,
      tool: 'select',
      connectOnce: false,
      undoStack: [],
      redoStack: []
    })
  },

  enterClient: (id) => {
    const state = get()
    const node = state.nodes.find((item) => item.id === id)
    if (!node || !isDeviceNode(node) || node.data.kind !== 'client') return
    const subgraph = graphForNode(node)
    const interiors = interiorsForClient(node.data)
    bumpSeqFromGraph([node], [])
    bumpSeqFromGraph(subgraph.nodes, subgraph.edges)
    set({
      nodes: subgraph.nodes.map((item) => ({ ...item, selected: false })),
      edges: subgraph.edges.map((edge) => ({ ...edge, selected: false })),
      viewport: subgraph.viewport,
      drillPath: [...state.drillPath, id],
      drillStack: [
        ...state.drillStack,
        { nodes: state.nodes, edges: state.edges, viewport: state.viewport, ownerId: id }
      ],
      interiorMode: interiors.activeMode,
      umlDiagramType: null,
      pendingEntity: false,
      pendingRelationKind: null,
      pendingUseCaseRelation: null,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingActor: false,
      pendingUseCase: false, pendingBehavior: null,
      selectedId: null,
      selectedIds: [],
      pendingKind: null,
      connectSourceId: null,
      tool: 'select',
      connectOnce: false,
      undoStack: [],
      redoStack: []
    })
  },

  exitDrill: () => {
    const state = get()
    const frame = state.drillStack[state.drillStack.length - 1]
    if (!frame) return
    const nested: SubgraphData = { nodes: state.nodes, edges: state.edges, viewport: state.viewport }
    const parentNodes = patchOwnerInteriors(frame.nodes, frame.ownerId, nested, state.interiorMode ?? undefined)
    set({
      nodes: parentNodes,
      edges: frame.edges,
      viewport: frame.viewport,
      drillPath: state.drillPath.slice(0, -1),
      drillStack: state.drillStack.slice(0, -1),
      interiorMode: null,
      umlDiagramType: null,
      pendingEntity: false,
      pendingRelationKind: null,
      pendingUseCaseRelation: null,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingActor: false,
      pendingUseCase: false, pendingBehavior: null,
      selectedId: null,
      selectedIds: [],
      pendingKind: null,
      connectSourceId: null,
      tool: 'select',
      connectOnce: false,
      undoStack: [],
      redoStack: [],
      dirty: true
    })
  },

  exitToRoot: () => {
    const state = get()
    if (state.drillStack.length === 0) return
    const root = foldDrillStack(state.nodes, state.edges, state.viewport, state.drillStack)
    set({
      nodes: root.nodes,
      edges: root.edges,
      viewport: root.viewport,
      drillPath: [],
      drillStack: [],
      interiorMode: null,
      umlDiagramType: null,
      pendingEntity: false,
      pendingRelationKind: null,
      pendingUseCaseRelation: null,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingActor: false,
      pendingUseCase: false, pendingBehavior: null,
      selectedId: null,
      selectedIds: [],
      pendingKind: null,
      connectSourceId: null,
      tool: 'select',
      connectOnce: false,
      undoStack: [],
      redoStack: [],
      dirty: true
    })
  },

  setInteriorMode: (mode) => {
    const state = get()
    if (state.drillPath.length === 0 || state.interiorMode === mode) return
    const ownerId = state.drillPath[state.drillPath.length - 1]
    const frame = state.drillStack[state.drillStack.length - 1]
    if (!frame) return

    const currentGraph: SubgraphData = {
      nodes: state.nodes,
      edges: state.edges,
      viewport: state.viewport
    }
    const ownerNode = frame.nodes.find((item) => item.id === ownerId)
    if (!ownerNode || !isDeviceNode(ownerNode)) return

    const cleared = {
      pendingEntity: false,
      pendingRelationKind: null,
      pendingUseCaseRelation: null,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingActor: false,
      pendingUseCase: false, pendingBehavior: null,
      selectedId: null,
      selectedIds: [] as string[],
      pendingKind: null,
      connectSourceId: null,
      tool: 'select' as const,
      connectOnce: false,
      undoStack: [] as GraphSnapshot[],
      redoStack: [] as GraphSnapshot[],
      dirty: true
    }

    if (ownerNode.data.kind === 'database') {
      if (!isDatabaseInteriorMode(mode)) return
      let interiors = writeDatabaseGraph(interiorsForDb(ownerNode.data), currentGraph)
      interiors = { ...interiors, activeMode: mode }
      const nextGraph = interiors.modes[mode] ?? emptySubgraph()
      bumpSeqFromGraph(nextGraph.nodes, nextGraph.edges)
      const updatedStack = [...state.drillStack]
      updatedStack[updatedStack.length - 1] = {
        ...frame,
        nodes: frame.nodes.map((node) =>
          node.id === ownerId && isDeviceNode(node) && node.data.kind === 'database'
            ? { ...node, data: { ...node.data, interiors } }
            : node
        )
      }

      set({
        nodes: nextGraph.nodes.map((item) => ({ ...item, selected: false })),
        edges: nextGraph.edges.map((edge) => ({ ...edge, selected: false })),
        viewport: nextGraph.viewport,
        drillStack: updatedStack,
        interiorMode: mode,
        umlDiagramType: interiors.umlDiagramType,
        ...cleared,
      })
      return
    }

    if (ownerNode.data.kind !== 'appServer') return
    if (!isAppServerInteriorMode(mode)) return
    const fromMode = state.interiorMode
    let interiors = interiorsForApp(ownerNode.data)
    if (fromMode && isAppServerInteriorMode(fromMode)) {
      interiors = writeAppGraph(interiors, currentGraph, fromMode)
    }
    interiors = { ...interiors, activeMode: mode }
    const nextGraph =
      mode === 'sequence' || mode === 'activity'
        ? activeDiagramGraph(interiors, mode)
        : (interiors.modes[mode] ?? emptySubgraph())
    bumpSeqFromGraph(nextGraph.nodes, nextGraph.edges)
    const updatedStack = [...state.drillStack]
    updatedStack[updatedStack.length - 1] = {
      ...frame,
      nodes: frame.nodes.map((node) =>
        node.id === ownerId && isDeviceNode(node) && node.data.kind === 'appServer'
          ? { ...node, data: { ...node.data, appInteriors: interiors } }
          : node
      )
    }

    set({
      nodes: nextGraph.nodes.map((item) => ({ ...item, selected: false })),
      edges: nextGraph.edges.map((edge) => ({ ...edge, selected: false })),
      viewport: nextGraph.viewport,
      drillStack: updatedStack,
      interiorMode: mode,
      umlDiagramType: null,
      ...cleared,
    })
  },

  setUmlDiagramType: (type) => {
    const state = get()
    if (state.drillPath.length === 0 || state.interiorMode !== 'uml') return
    if (state.umlDiagramType === type) return
    const ownerId = state.drillPath[state.drillPath.length - 1]
    const frame = state.drillStack[state.drillStack.length - 1]
    if (!frame) return

    const currentGraph: SubgraphData = {
      nodes: state.nodes,
      edges: state.edges,
      viewport: state.viewport
    }
    const ownerNode = frame.nodes.find((item) => item.id === ownerId)
    if (!ownerNode || !isDeviceNode(ownerNode) || ownerNode.data.kind !== 'database') return

    const interiors = {
      ...writeDatabaseGraph(interiorsForDb(ownerNode.data), currentGraph),
      umlDiagramType: type,
      activeMode: 'uml' as const
    }
    const updatedStack = [...state.drillStack]
    updatedStack[updatedStack.length - 1] = {
      ...frame,
      nodes: frame.nodes.map((node) =>
        node.id === ownerId && isDeviceNode(node) && node.data.kind === 'database'
          ? { ...node, data: { ...node.data, interiors } }
          : node
      )
    }

    set({
      drillStack: updatedStack,
      umlDiagramType: type,
      pendingEntity: false,
      pendingRelationKind: null,
      pendingUseCaseRelation: null,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingActor: false,
      pendingUseCase: false, pendingBehavior: null,
      pendingKind: null,
      connectSourceId: null,
      tool: 'select',
      connectOnce: false,
      dirty: true
    })
  },

  setPendingEntity: (value) => {
    if (get().drillPath.length === 0 || !allowsEntityEditing(get().interiorMode, get().umlDiagramType)) {
      set({ pendingEntity: false })
      return
    }
    set({
      pendingEntity: value,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingActor: false,
      pendingUseCase: false, pendingBehavior: null,
      pendingRelationKind: null,
      pendingUseCaseRelation: null,
      pendingKind: null,
      tool: 'select',
      connectSourceId: null,
      connectOnce: false
    })
  },

  setPendingRelationKind: (kind) => {
    const state = get()
    if (
      state.drillPath.length === 0 ||
      state.interiorMode !== 'uml' ||
      state.umlDiagramType !== 'class'
    ) {
      set({ pendingRelationKind: null })
      return
    }
    if (kind == null) {
      set({
        pendingRelationKind: null,
        tool: 'select',
        connectOnce: false,
        connectSourceId: null
      })
      return
    }
    set({
      pendingRelationKind: kind,
      pendingEntity: false,
      pendingUseCaseRelation: null,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingActor: false,
      pendingUseCase: false, pendingBehavior: null,
      pendingKind: null,
      tool: 'connect',
      connectOnce: true,
      connectSourceId: null
    })
  },

  addEntity: (position, options) => {
    const state = get()
    if (state.drillPath.length === 0 || !allowsEntityEditing(state.interiorMode, state.umlDiagramType)) {
      return
    }
    const keepArmed = options?.keepArmed ?? state.pendingEntity
    const snapshot = cloneGraph(state.nodes, state.edges)
    const index = state.nodes.filter(isEntityNode).length + 1
    const taken = takenIds(state)
    const isUmlClass = state.interiorMode === 'uml'
    const node: CanvasNode = {
      id: nextId('entity', taken),
      type: 'entity',
      position,
      selected: !keepArmed,
      data: {
        kind: 'entity',
        label: isUmlClass ? `Class ${index}` : `Entity ${index}`,
        attributes: [
          {
            id: nextId('attr', taken),
            name: 'id',
            type: isUmlClass ? 'Int' : 'uuid',
            pk: true,
            fk: false,
            ...(isUmlClass ? { visibility: 'public' as const } : {})
          }
        ],
        ...(isUmlClass ? { methods: [] } : {})
      }
    }
    const nodes = [
      ...state.nodes.map((item) => ({ ...item, selected: keepArmed ? item.selected : false })),
      node
    ]
    
    set({
      nodes,
      edges: state.edges,
      pendingEntity: keepArmed,
      selectedId: keepArmed ? state.selectedId : node.id,
      selectedIds: keepArmed ? state.selectedIds : [node.id],
      dirty: true,
      undoStack: [...state.undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  updateEntity: (id, patch) => {
    const snapshot = cloneGraph(get().nodes, get().edges)
    const nodes = get().nodes.map((node) => {
      if (node.id !== id || !isEntityNode(node)) return node
      const attributes = patch.attributes ?? node.data.attributes
      const methods = patch.methods ?? node.data.methods
      return {
        ...node,
        data: {
          ...node.data,
          ...patch,
          attributes: attributes.map((attribute) => ({ ...attribute })),
          ...(methods ? { methods: methods.map((method) => ({ ...method })) } : {})
        }
      }
    })
    
    set({
      nodes,
      edges: get().edges,
      dirty: true,
      undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  setPendingApiTable: (value) => {
    if (get().drillPath.length === 0 || get().interiorMode !== 'api') {
      set({ pendingApiTable: false })
      return
    }
    set({
      pendingApiTable: value,
      pendingEntity: false,
      pendingApiCall: false,
      pendingActor: false,
      pendingUseCase: false, pendingBehavior: null,
      pendingRelationKind: null,
      pendingUseCaseRelation: null,
      pendingKind: null,
      tool: 'select',
      connectSourceId: null,
      connectOnce: false
    })
  },

  addApiTable: (position, options) => {
    const state = get()
    if (state.drillPath.length === 0 || state.interiorMode !== 'api') return
    const keepArmed = options?.keepArmed ?? state.pendingApiTable
    const snapshot = cloneGraph(state.nodes, state.edges)
    const index = state.nodes.filter(isApiTableNode).length + 1
    const taken = takenIds(state)
    const node: CanvasNode = {
      id: nextId('apiTable', taken),
      type: 'apiTable',
      position,
      selected: !keepArmed,
      data: {
        kind: 'apiTable',
        label: `API ${index}`,
        attributes: []
      }
    }
    const nodes = [
      ...state.nodes.map((item) => ({ ...item, selected: keepArmed ? item.selected : false })),
      node
    ]
    
    set({
      nodes,
      edges: state.edges,
      pendingApiTable: keepArmed,
      selectedId: keepArmed ? state.selectedId : node.id,
      selectedIds: keepArmed ? state.selectedIds : [node.id],
      dirty: true,
      undoStack: [...state.undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  updateApiTable: (id, patch) => {
    const snapshot = cloneGraph(get().nodes, get().edges)
    const nodes = get().nodes.map((node) => {
      if (node.id !== id || !isApiTableNode(node)) return node
      const attributes = patch.attributes ?? node.data.attributes
      const apiConfig = cloneApiConfig(patch.apiConfig ?? node.data.apiConfig)
      return {
        ...node,
        data: {
          ...node.data,
          ...patch,
          attributes: attributes.map((attribute) => ({ ...attribute })),
          ...(apiConfig ? { apiConfig } : {})
        }
      }
    })
    
    set({
      nodes,
      edges: get().edges,
      dirty: true,
      undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  setPendingApiCall: (value) => {
    if (get().drillPath.length === 0 || get().interiorMode !== 'requests') {
      set({ pendingApiCall: false })
      return
    }
    set({
      pendingApiCall: value,
      pendingEntity: false,
      pendingApiTable: false,
      pendingActor: false,
      pendingUseCase: false, pendingBehavior: null,
      pendingRelationKind: null,
      pendingUseCaseRelation: null,
      pendingKind: null,
      tool: 'select',
      connectSourceId: null,
      connectOnce: false
    })
  },

  addApiCall: (position, options) => {
    const state = get()
    if (state.drillPath.length === 0 || state.interiorMode !== 'requests') return
    const keepArmed = options?.keepArmed ?? state.pendingApiCall
    const snapshot = cloneGraph(state.nodes, state.edges)
    const index = state.nodes.filter(isApiCallNode).length + 1
    const taken = takenIds(state)
    const node: CanvasNode = {
      id: nextId('apiCall', taken),
      type: 'apiCall',
      position,
      selected: !keepArmed,
      data: {
        kind: 'apiCall',
        label: `Request ${index}`
      }
    }
    const nodes = [
      ...state.nodes.map((item) => ({ ...item, selected: keepArmed ? item.selected : false })),
      node
    ]
    
    set({
      nodes,
      edges: state.edges,
      pendingApiCall: keepArmed,
      selectedId: keepArmed ? state.selectedId : node.id,
      selectedIds: keepArmed ? state.selectedIds : [node.id],
      dirty: true,
      undoStack: [...state.undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  updateApiCall: (id, patch) => {
    const snapshot = cloneGraph(get().nodes, get().edges)
    const nodes = get().nodes.map((node) => {
      if (node.id !== id || !isApiCallNode(node)) return node
      return {
        ...node,
        data: {
          ...node.data,
          ...patch,
          ...(patch.paramValues
            ? { paramValues: { ...patch.paramValues } }
            : node.data.paramValues
              ? { paramValues: { ...node.data.paramValues } }
              : {})
        }
      }
    })
    
    set({
      nodes,
      edges: get().edges,
      dirty: true,
      undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  setPendingActor: (value) => {
    if (get().drillPath.length === 0 || get().interiorMode !== 'useCase') {
      set({ pendingActor: false })
      return
    }
    set({
      pendingActor: value,
      pendingUseCase: false, pendingBehavior: null,
      pendingEntity: false,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingRelationKind: null,
      pendingUseCaseRelation: null,
      pendingKind: null,
      tool: 'select',
      connectSourceId: null,
      connectOnce: false
    })
  },

  addActor: (position, options) => {
    const state = get()
    if (state.drillPath.length === 0 || state.interiorMode !== 'useCase') return
    const keepArmed = options?.keepArmed ?? state.pendingActor
    const snapshot = cloneGraph(state.nodes, state.edges)
    const index = state.nodes.filter(isActorNode).length + 1
    const taken = takenIds(state)
    const node: CanvasNode = {
      id: nextId('actor', taken),
      type: 'actor',
      position,
      selected: !keepArmed,
      data: {
        kind: 'actor',
        label: `Actor ${index}`
      }
    }
    const nodes = [
      ...state.nodes.map((item) => ({ ...item, selected: keepArmed ? item.selected : false })),
      node
    ]
    
    set({
      nodes,
      edges: state.edges,
      pendingActor: keepArmed,
      selectedId: keepArmed ? state.selectedId : node.id,
      selectedIds: keepArmed ? state.selectedIds : [node.id],
      dirty: true,
      undoStack: [...state.undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  updateActor: (id, patch) => {
    const snapshot = cloneGraph(get().nodes, get().edges)
    const nodes = get().nodes.map((node) => {
      if (node.id !== id || !isActorNode(node)) return node
      return { ...node, data: { ...node.data, ...patch } }
    })
    
    set({
      nodes,
      edges: get().edges,
      dirty: true,
      undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  setPendingUseCase: (value) => {
    if (get().drillPath.length === 0 || get().interiorMode !== 'useCase') {
      set({ pendingUseCase: false })
      return
    }
    set({
      pendingUseCase: value,
      pendingActor: false,
      pendingEntity: false,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingRelationKind: null,
      pendingUseCaseRelation: null,
      pendingKind: null,
      tool: 'select',
      connectSourceId: null,
      connectOnce: false
    })
  },

  addUseCase: (position, options) => {
    const state = get()
    if (state.drillPath.length === 0 || state.interiorMode !== 'useCase') return
    const keepArmed = options?.keepArmed ?? state.pendingUseCase
    const snapshot = cloneGraph(state.nodes, state.edges)
    const index = state.nodes.filter(isUseCaseNode).length + 1
    const taken = takenIds(state)
    const node: CanvasNode = {
      id: nextId('useCase', taken),
      type: 'useCase',
      position,
      selected: !keepArmed,
      data: {
        kind: 'useCase',
        label: `Use case ${index}`,
        apiTableIds: []
      }
    }
    const nodes = [
      ...state.nodes.map((item) => ({ ...item, selected: keepArmed ? item.selected : false })),
      node
    ]
    
    set({
      nodes,
      edges: state.edges,
      pendingUseCase: keepArmed,
      selectedId: keepArmed ? state.selectedId : node.id,
      selectedIds: keepArmed ? state.selectedIds : [node.id],
      dirty: true,
      undoStack: [...state.undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  updateUseCase: (id, patch) => {
    const snapshot = cloneGraph(get().nodes, get().edges)
    const nodes = get().nodes.map((node) => {
      if (node.id !== id || !isUseCaseNode(node)) return node
      const apiTableIds = patch.apiTableIds ?? node.data.apiTableIds
      return { ...node, data: { ...node.data, ...patch, apiTableIds: [...apiTableIds] } }
    })
    
    set({
      nodes,
      edges: get().edges,
      dirty: true,
      undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  setPendingBehavior: (kind) => {
    const state = get()
    const owner = appOwner(state)
    const mode = state.interiorMode
    const allowed = Boolean(
      owner &&
        kind &&
        ((mode === 'sequence' && kind === 'lifeline' && owner.interiors.activeSequenceId) ||
          (mode === 'activity' &&
            kind !== 'lifeline' &&
            (ACTIVITY_NODE_KINDS as string[]).includes(kind) &&
            owner.interiors.activeActivityId))
    )
    if (!allowed) {
      set({ pendingBehavior: null })
      return
    }
    set({
      pendingBehavior: kind,
      pendingEntity: false,
      pendingRelationKind: null,
      pendingUseCaseRelation: null,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingActor: false,
      pendingUseCase: false,
      pendingKind: null,
      tool: 'select',
      connectSourceId: null,
      connectOnce: false
    })
  },

  addBehaviorNode: (kind, position, options) => {
    const state = get()
    const owner = appOwner(state)
    if (!owner) return
    const sequenceOk = state.interiorMode === 'sequence' && kind === 'lifeline' && owner.interiors.activeSequenceId
    const activityOk =
      state.interiorMode === 'activity' &&
      kind !== 'lifeline' &&
      (ACTIVITY_NODE_KINDS as string[]).includes(kind) &&
      owner.interiors.activeActivityId
    if (!sequenceOk && !activityOk) return
    const keepArmed = options?.keepArmed ?? state.pendingBehavior === kind
    const snapshot = cloneGraph(state.nodes, state.edges)
    const taken = takenIds(state)
    const node: CanvasNode = {
      id: nextId('behavior', taken),
      type: 'behavior',
      position,
      selected: !keepArmed,
      data: behaviorPlaceData(kind)
    }
    const nodes = [...state.nodes.map((item) => ({ ...item, selected: keepArmed ? item.selected : false })), node]
    
    set({
      nodes,
      edges: state.edges,
      pendingBehavior: keepArmed ? kind : null,
      selectedId: keepArmed ? state.selectedId : node.id,
      selectedIds: keepArmed ? state.selectedIds : [node.id],
      dirty: true,
      undoStack: [...state.undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  updateBehaviorNode: (id, data) => {
    const current = get().nodes.find((node) => node.id === id)
    if (!current || !isBehaviorNode(current)) return
    const snapshot = cloneGraph(get().nodes, get().edges)
    const nextData: BehaviorNodeData =
      data.kind === 'lifeline' || data.apiTableId
        ? data
        : (({ apiTableId: _apiTableId, ...rest }) => rest)(data)
    const nodes = get().nodes.map((node) => (node.id === id ? { ...node, data: nextData } : node))
    
    set({
      nodes,
      edges: get().edges,
      dirty: true,
      undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  createSequenceDiagram: (subject) => {
    const state = get()
    if (state.interiorMode !== 'sequence') return
    const owner = appOwner(state)
    if (!owner) return
    const source = owner.frame.nodes.find((node) => node.id === owner.ownerId)
    if (!source || !isDeviceNode(source)) return
    if (subject.kind === 'useCase') {
      const exists = owner.interiors.modes.useCase.nodes.some((node) => node.id === subject.id && isUseCaseNode(node))
      if (!exists) return
    } else {
      const exists = owner.interiors.modes.api.nodes.some((node) => node.id === subject.id && isApiTableNode(node))
      if (!exists) return
    }
    let saved = writeBehaviorGraph(owner.interiors, 'sequence', {
      nodes: state.nodes,
      edges: state.edges,
      viewport: state.viewport
    })
    const taken = takenIds(state)
    const seeded = seedSequenceGraph({
      subject,
      useCase: saved.modes.useCase,
      ownerId: owner.ownerId,
      ownerLabel: source.data.label,
      parentNodes: owner.frame.nodes,
      parentEdges: owner.frame.edges,
      nextNodeId: () => nextId('behavior', taken)
    })
    const diagram: BehaviorDiagram = {
      id: nextId('sequence', taken),
      subject,
      nodes: seeded.nodes,
      edges: seeded.edges,
      viewport: seeded.viewport
    }
    saved = {
      ...saved,
      activeMode: 'sequence',
      sequenceDiagrams: [...(saved.sequenceDiagrams ?? []), diagram],
      activeSequenceId: diagram.id
    }
    const snapshot = cloneGraph(state.nodes, state.edges)
    
    set({
      nodes: seeded.nodes,
      edges: seeded.edges,
      viewport: seeded.viewport,
      drillStack: withOwnerInteriors(state.drillStack, saved),
      pendingBehavior: null,
      selectedId: null,
      selectedIds: [],
      dirty: true,
      undoStack: [...state.undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  createActivityDiagram: (useCaseId) => {
    const state = get()
    if (state.interiorMode !== 'activity') return
    const owner = appOwner(state)
    if (!owner) return
    let saved = writeBehaviorGraph(owner.interiors, 'activity', {
      nodes: state.nodes,
      edges: state.edges,
      viewport: state.viewport
    })
    const taken = takenIds(state)
    const seeded = seedActivityGraph({
      useCaseId,
      useCase: saved.modes.useCase,
      api: saved.modes.api,
      nextNodeId: () => nextId('behavior', taken)
    })
    if (!seeded) return
    const diagram: BehaviorDiagram = {
      id: nextId('activity', taken),
      subject: { kind: 'useCase', id: useCaseId },
      nodes: seeded.nodes,
      edges: seeded.edges,
      viewport: seeded.viewport
    }
    saved = {
      ...saved,
      activeMode: 'activity',
      activityDiagrams: [...(saved.activityDiagrams ?? []), diagram],
      activeActivityId: diagram.id
    }
    const snapshot = cloneGraph(state.nodes, state.edges)
    
    set({
      nodes: seeded.nodes,
      edges: seeded.edges,
      viewport: seeded.viewport,
      drillStack: withOwnerInteriors(state.drillStack, saved),
      pendingBehavior: null,
      selectedId: null,
      selectedIds: [],
      dirty: true,
      undoStack: [...state.undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  setActiveBehaviorDiagram: (id) => {
    const state = get()
    const mode = state.interiorMode
    if (mode !== 'sequence' && mode !== 'activity') return
    const owner = appOwner(state)
    if (!owner) return
    const diagrams = mode === 'sequence' ? (owner.interiors.sequenceDiagrams ?? []) : (owner.interiors.activityDiagrams ?? [])
    if (!diagrams.some((diagram) => diagram.id === id)) return
    const currentId = mode === 'sequence' ? owner.interiors.activeSequenceId : owner.interiors.activeActivityId
    if (currentId === id) return
    let saved = writeBehaviorGraph(owner.interiors, mode, {
      nodes: state.nodes,
      edges: state.edges,
      viewport: state.viewport
    })
    saved =
      mode === 'sequence'
        ? { ...saved, activeSequenceId: id, activeMode: 'sequence' }
        : { ...saved, activeActivityId: id, activeMode: 'activity' }
    const nextGraph = activeDiagramGraph(saved, mode)
    bumpSeqFromGraph(nextGraph.nodes, nextGraph.edges)
    set({
      nodes: nextGraph.nodes.map((item) => ({ ...item, selected: false })),
      edges: nextGraph.edges.map((edge) => ({ ...edge, selected: false })),
      viewport: nextGraph.viewport,
      drillStack: withOwnerInteriors(state.drillStack, saved),
      pendingBehavior: null,
      selectedId: null,
      selectedIds: [],
      tool: 'select',
      connectOnce: false,
      connectSourceId: null,
      dirty: true,
      undoStack: [],
      redoStack: [],
    })
  },

  setPendingUseCaseRelation: (kind) => {
    const state = get()
    if (state.drillPath.length === 0 || state.interiorMode !== 'useCase') {
      set({ pendingUseCaseRelation: null })
      return
    }
    if (kind == null) {
      set({
        pendingUseCaseRelation: null,
        tool: 'select',
        connectOnce: false,
        connectSourceId: null
      })
      return
    }
    set({
      pendingUseCaseRelation: kind,
      pendingActor: false,
      pendingUseCase: false, pendingBehavior: null,
      pendingEntity: false,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingRelationKind: null,
      pendingKind: null,
      tool: 'connect',
      connectOnce: true,
      connectSourceId: null
    })
  },

  deleteSelected: () => {
    const selectedId = get().selectedId
    const ids = get().selectedIds.length > 0 ? get().selectedIds : selectedId ? [selectedId] : []
    if (ids.length === 0) return
    get().requestDelete(ids)
  },

  requestDelete: (ids) => {
    if (ids.length === 0) return
    const state = get()
    // Interior deletes and pure node deletes skip the HLD cable impact prompt.
    if (state.drillPath.length > 0) {
      get().deleteIds(ids)
      return
    }
    const cableIds = ids.filter((id) => state.edges.some((edge) => edge.id === id))
    if (cableIds.length === 0) {
      get().deleteIds(ids)
      return
    }
    const impact = analyzeCableDeleteImpact(cableIds, state.nodes, state.edges)
    if (!impact) {
      get().deleteIds(ids)
      return
    }
    set({
      pendingDeleteImpact: impact,
      pendingDeleteIds: ids
    })
  },

  confirmPendingDelete: () => {
    const ids = get().pendingDeleteIds
    set({ pendingDeleteImpact: null, pendingDeleteIds: null })
    if (ids?.length) get().deleteIds(ids)
  },

  cancelPendingDelete: () => {
    set({ pendingDeleteImpact: null, pendingDeleteIds: null })
  },

  deleteIds: (ids) => {
    if (ids.length === 0) return
    const state = get()
    const snapshot = cloneGraph(state.nodes, state.edges)
    const removedApiIds = new Set(
      ids.filter((id) => state.nodes.some((node) => node.id === id && isApiTableNode(node)))
    )
    const removed = removeByIds(state.nodes, state.edges, ids)
    let drillStack = state.drillStack
    if (state.interiorMode === 'api' && removedApiIds.size > 0 && drillStack.length > 0) {
      const frame = drillStack[drillStack.length - 1]
      drillStack = [...drillStack]
      drillStack[drillStack.length - 1] = {
        ...frame,
        nodes: frame.nodes.map((node) => {
          if (node.id !== frame.ownerId || !isDeviceNode(node) || node.data.kind !== 'appServer') return node
          const interiors = stripRemovedApis(interiorsForApp(node.data), removedApiIds)
          const useCase = interiors.modes.useCase
          return {
            ...node,
            data: {
              ...node.data,
              appInteriors: {
                ...interiors,
                modes: {
                  ...interiors.modes,
                  useCase: {
                    ...useCase,
                    nodes: stripRealizedApis(useCase.nodes, removedApiIds)
                  }
                }
              }
            }
          }
        })
      }
    }
    
    set({
      nodes: removed.nodes,
      edges: removed.edges,
      drillStack,
      selectedId: null,
      selectedIds: [],
      pendingDeleteImpact: null,
      pendingDeleteIds: null,
      connectSourceId: ids.includes(state.connectSourceId ?? '') ? null : state.connectSourceId,
      dirty: true,
      undoStack: [...state.undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  duplicateSelected: () => {
    const { nodes, edges, selectedIds } = get()
    const selected = new Set(selectedIds.filter((id) => nodes.some((node) => node.id === id)))
    nodes.forEach((node) => {
      if (node.parentId && selected.has(node.parentId)) selected.add(node.id)
    })
    const toCopy = [
      ...nodes.filter((node) => selected.has(node.id) && isGroupNode(node)),
      ...nodes.filter((node) => selected.has(node.id) && isDeviceNode(node)),
      ...nodes.filter((node) => selected.has(node.id) && isEntityNode(node)),
      ...nodes.filter((node) => selected.has(node.id) && isApiTableNode(node)),
      ...nodes.filter((node) => selected.has(node.id) && isActorNode(node)),
      ...nodes.filter((node) => selected.has(node.id) && isUseCaseNode(node)),
      ...nodes.filter((node) => selected.has(node.id) && isBehaviorNode(node))
    ]
    if (toCopy.length === 0) return
    const snapshot = cloneGraph(nodes, edges)
    const idMap = new Map<string, string>()
    const taken = takenIds(get())
    const copies = toCopy
      .map((node) => {
        const id = nextId(node.data.kind, taken)
        idMap.set(node.id, id)
        const copy: CanvasNode = {
          ...node,
          id,
          position: { x: node.position.x + 48, y: node.position.y + 48 },
          selected: true,
          data: cloneNodeData(node.data),
          style: node.style ? { ...node.style } : node.style
        }
        if (node.parentId && selected.has(node.parentId)) return copy
        if (node.parentId) {
          const { parentId: _parentId, ...rest } = copy
          const parent = nodes.find((item) => item.id === node.parentId)
          const origin = parent?.position ?? { x: 0, y: 0 }
          return {
            ...rest,
            position: { x: origin.x + node.position.x + 48, y: origin.y + node.position.y + 48 }
          }
        }
        return copy
      })
      .map((node) =>
        node.parentId && idMap.has(node.parentId) ? { ...node, parentId: idMap.get(node.parentId) } : node
      )
    const copiedEdges = edges
      .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
      .map((edge) => ({
        ...edge,
        id: nextId('cable', taken),
        source: idMap.get(edge.source) as string,
        target: idMap.get(edge.target) as string,
        selected: false,
        data: { ...edge.data }
      }))
    const nextNodes = [...nodes.map((node) => ({ ...node, selected: false })), ...copies]
    
    const newIds = copies.map((node) => node.id)
    set({
      nodes: nextNodes,
      edges: [...edges, ...copiedEdges],
      selectedId: newIds[0] ?? null,
      selectedIds: newIds,
      dirty: true,
      undoStack: [...get().undoStack, snapshot].slice(-HISTORY_LIMIT),
      redoStack: []
    })
  },

  selectAll: () => {
    const nodeIds = get().nodes.map((node) => node.id)
    const edgeIds = get().edges.map((edge) => edge.id)
    const selectedIds = [...nodeIds, ...edgeIds]
    const marked = markSelection(get().nodes, get().edges, selectedIds)
    set({
      selectedIds,
      selectedId: nodeIds[0] ?? edgeIds[0] ?? null,
      ...marked
    })
  },

  cancelInteraction: () => {
    const { connectSourceId, pendingKind, tool, selectedIds, pendingDeleteImpact } = get()
    if (pendingDeleteImpact) {
      set({ pendingDeleteImpact: null, pendingDeleteIds: null })
      return
    }
    if (connectSourceId) {
      set({ connectSourceId: null })
      return
    }
    if (pendingKind) {
      set({ pendingKind: null })
      return
    }
    if (get().pendingEntity) {
      set({ pendingEntity: false })
      return
    }
    if (get().pendingRelationKind) {
      set({ pendingRelationKind: null, tool: 'select', connectOnce: false, connectSourceId: null })
      return
    }
    if (get().pendingUseCaseRelation) {
      set({ pendingUseCaseRelation: null, tool: 'select', connectOnce: false, connectSourceId: null })
      return
    }
    if (get().pendingApiTable) {
      set({ pendingApiTable: false })
      return
    }
    if (get().pendingApiCall) {
      set({ pendingApiCall: false })
      return
    }
    if (get().pendingActor) {
      set({ pendingActor: false })
      return
    }
    if (get().pendingUseCase) {
      set({ pendingUseCase: false })
      return
    }
    if (get().pendingBehavior) {
      set({ pendingBehavior: null })
      return
    }
    if (tool !== 'select') {
      set({ tool: 'select' })
      return
    }
    if (selectedIds.length > 0) {
      get().setSelected(null)
    }
  },

  beginNodeDrag: () => {
    set({ dragSnapshot: cloneGraph(get().nodes, get().edges) })
  },

  endNodeDrag: () => {
    const { dragSnapshot, nodes, undoStack } = get()
    if (!dragSnapshot) return
    const settled = reconcileParents(nodes)
    const moved = settled.some((node) => {
      const previous = dragSnapshot.nodes.find((item) => item.id === node.id)
      return (
        !previous ||
        previous.position.x !== node.position.x ||
        previous.position.y !== node.position.y ||
        previous.parentId !== node.parentId
      )
    })
    if (!moved) {
      set({ dragSnapshot: null, nodes: settled })
      return
    }
    set({
      nodes: settled,
      undoStack: [...undoStack, dragSnapshot].slice(-HISTORY_LIMIT),
      redoStack: [],
      dragSnapshot: null,
      dirty: true
    })
  },

  undo: () => {
    const { undoStack, nodes, edges, redoStack } = get()
    const previous = undoStack[undoStack.length - 1]
    if (!previous) return
    
    set({
      nodes: previous.nodes,
      edges: previous.edges,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, cloneGraph(nodes, edges)],
      selectedId: null,
      selectedIds: [],
      connectSourceId: null,
      dirty: true
    })
  },

  redo: () => {
    const { redoStack, nodes, edges, undoStack } = get()
    const future = redoStack[redoStack.length - 1]
    if (!future) return
    
    set({
      nodes: future.nodes,
      edges: future.edges,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, cloneGraph(nodes, edges)],
      selectedId: null,
      selectedIds: [],
      connectSourceId: null,
      dirty: true
    })
  },

  newDesign: () => {
    seq = 1
    reconnectingEdgeId = null
    reconnectDidConnect = false
    set({
      name: 'Untitled Design',
      filePath: null,
      dirty: false,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      drillPath: [],
      drillStack: [],
      interiorMode: null,
      umlDiagramType: null,
      pendingEntity: false,
      pendingRelationKind: null,
      pendingUseCaseRelation: null,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingActor: false,
      pendingUseCase: false, pendingBehavior: null,
      pendingDeleteImpact: null,
      pendingDeleteIds: null,
      selectedId: null,
      selectedIds: [],
      connectSourceId: null,
      pendingKind: null,
      tool: 'select',
      connectOnce: false,
      undoStack: [],
      redoStack: [],
      dragSnapshot: null
    })
  },

  loadDocument: (doc, path) => {
    seq = 1
    bumpSeqFromGraph(doc.nodes, doc.edges)
    reconnectingEdgeId = null
    reconnectDidConnect = false
    
    set({
      name: doc.name,
      filePath: path,
      dirty: false,
      nodes: doc.nodes.map((node) => ({ ...node, selected: false })),
      viewport: doc.viewport,
      drillPath: [],
      drillStack: [],
      interiorMode: null,
      umlDiagramType: null,
      pendingEntity: false,
      pendingRelationKind: null,
      pendingUseCaseRelation: null,
      pendingApiTable: false,
      pendingApiCall: false,
      pendingActor: false,
      pendingUseCase: false, pendingBehavior: null,
      pendingDeleteImpact: null,
      pendingDeleteIds: null,
      selectedId: null,
      selectedIds: [],
      connectSourceId: null,
      pendingKind: null,
      tool: 'select',
      connectOnce: false,
      undoStack: [],
      redoStack: [],
      dragSnapshot: null,
      edges: doc.edges
    })
  },

  loadFromJson: (raw, path) => {
    get().loadDocument(parseProject(raw), path)
  },

  toDocument: () => {
    const { name, nodes, edges, viewport, drillStack } = get()
    const root = foldDrillStack(nodes, edges, viewport, drillStack)
    return { name, ...root }
  },

  toJson: () => {
    return serializeProject(get().toDocument())
  },

  markSaved: (path) => set({ filePath: path, dirty: false }),
  setName: (name) => set({ name, dirty: true })
}))

