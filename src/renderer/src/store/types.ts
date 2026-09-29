import type { Edge, Node, Viewport } from '@xyflow/react'

export type DeviceKind =
  | 'client'
  | 'loadBalancer'
  | 'apiGateway'
  | 'appServer'
  | 'cache'
  | 'database'
  | 'messageQueue'
  | 'cdn'

export type DatabaseInteriorMode = 'erd' | 'uml' | 'object'
export type UmlDiagramType = 'class'
export type UmlVisibility = 'public' | 'private' | 'protected' | 'package'
export type UmlRelationKind = 'association' | 'inheritance' | 'aggregation' | 'composition'
export type UseCaseRelationKind = 'association' | 'include' | 'extend'
export type AppServerInteriorMode = 'api' | 'useCase' | 'sequence' | 'activity'
export type ClientInteriorMode = 'requests'
export type LifelineParticipant = 'actor' | 'appServer' | 'database' | 'cache' | 'messageQueue'
export type ActivityNodeKind = 'initial' | 'action' | 'decision' | 'merge' | 'fork' | 'join' | 'final'
export type SequenceMessageKind = 'sync' | 'async' | 'reply'
export type BehaviorPlaceKind = 'lifeline' | ActivityNodeKind

export const APP_SERVER_INTERIOR_MODES: AppServerInteriorMode[] = ['api', 'useCase', 'sequence', 'activity']
export const LIFELINE_PARTICIPANTS: LifelineParticipant[] = ['actor', 'appServer', 'database', 'cache', 'messageQueue']
export const ACTIVITY_NODE_KINDS: ActivityNodeKind[] = ['initial', 'action', 'decision', 'merge', 'fork', 'join', 'final']
export const SEQUENCE_MESSAGE_KINDS: SequenceMessageKind[] = ['sync', 'async', 'reply']

export const UML_VISIBILITY_MARK: Record<UmlVisibility, string> = {
  public: '+',
  private: '-',
  protected: '#',
  package: '~'
}

export const UML_VISIBILITIES: UmlVisibility[] = ['public', 'private', 'protected', 'package']

export const UML_RELATION_KINDS: UmlRelationKind[] = [
  'association',
  'inheritance',
  'aggregation',
  'composition'
]

export const USE_CASE_RELATION_KINDS: UseCaseRelationKind[] = ['association', 'include', 'extend']

export interface ErAttribute {
  id: string
  name: string
  type: string
  pk: boolean
  fk: boolean
  visibility?: UmlVisibility
}

export interface UmlMethod {
  id: string
  name: string
  visibility: UmlVisibility
  params: string
  returnType: string
}

export interface ApiAttributeRef extends ErAttribute {
  /** True when copied from a linked DB table; local-only attrs stay false. */
  fromSource?: boolean
}

export type ApiType = 'rest' | 'graphql' | 'grpc' | 'soap' | 'jsonrpc' | 'websocket' | 'sse' | 'webhook'

export const API_TYPE_LABELS: Record<ApiType, string> = {
  rest: 'REST',
  graphql: 'GraphQL',
  grpc: 'gRPC',
  soap: 'SOAP',
  jsonrpc: 'JSON-RPC',
  websocket: 'WebSocket',
  sse: 'SSE',
  webhook: 'Webhook'
}

export const API_TYPES = Object.keys(API_TYPE_LABELS) as ApiType[]

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export type ApiParamLocation = 'path' | 'query' | 'header' | 'cookie'

export const API_PARAM_LOCATIONS: ApiParamLocation[] = ['path', 'query', 'header', 'cookie']

export interface ApiParam {
  id: string
  name: string
  type: string
  required: boolean
  in?: ApiParamLocation
  description?: string
}

export interface RestApiConfig {
  method: HttpMethod
  path: string
  parameters: ApiParam[]
  requestBody?: { contentType: string; description?: string }
}

export type GraphqlOperationType = 'query' | 'mutation' | 'subscription'

export interface GraphqlApiConfig {
  path: string
  operationType: GraphqlOperationType
  operationName: string
  variables: ApiParam[]
}

export type GrpcStreaming = 'unary' | 'client' | 'server' | 'bidi'

export interface GrpcApiConfig {
  packageName: string
  service: string
  method: string
  streaming: GrpcStreaming
  requestMessage: string
  responseMessage: string
}

export interface SoapApiConfig {
  version: '1.1' | '1.2'
  action: string
  operation: string
  style: 'document' | 'rpc'
  parameters: ApiParam[]
}

export interface JsonRpcApiConfig {
  version: '2.0'
  method: string
  paramStyle: 'named' | 'positional'
  parameters: ApiParam[]
}

export interface WebsocketEvent {
  id: string
  name: string
  direction: 'in' | 'out'
}

export interface WebsocketApiConfig {
  path: string
  subprotocol: string
  events: WebsocketEvent[]
}

export interface SseEvent {
  id: string
  name: string
}

export interface SseApiConfig {
  path: string
  events: SseEvent[]
}

export interface WebhookApiConfig {
  method: HttpMethod
  path: string
  eventType: string
  parameters: ApiParam[]
}

export interface ApiConfigMap {
  rest?: RestApiConfig
  graphql?: GraphqlApiConfig
  grpc?: GrpcApiConfig
  soap?: SoapApiConfig
  jsonrpc?: JsonRpcApiConfig
  websocket?: WebsocketApiConfig
  sse?: SseApiConfig
  webhook?: WebhookApiConfig
}

export interface EntityData extends Record<string, unknown> {
  kind: 'entity'
  label: string
  attributes: ErAttribute[]
  methods?: UmlMethod[]
  /** Object diagram: instance name, shown as `objectLabel : label`. */
  objectLabel?: string
  /** Object diagram: example value per ErAttribute.id. */
  objectValues?: Record<string, string>
}

export interface ApiTableLink {
  sourceDatabaseId: string
  sourceEntityId: string
  attributes: ApiAttributeRef[]
}

export interface ApiTableNodeData extends Record<string, unknown> {
  kind: 'apiTable'
  label: string
  apiType?: ApiType
  apiConfig?: ApiConfigMap
  sourceDatabaseId?: string
  sourceEntityId?: string
  attributes: ApiAttributeRef[]
  tableLinks?: ApiTableLink[]
  activeTableKey?: string
}

export interface ApiCallNodeData extends Record<string, unknown> {
  kind: 'apiCall'
  label: string
  sourceAppServerId?: string
  sourceApiTableId?: string
  /** Values keyed by the linked API’s ApiParam.id */
  paramValues?: Record<string, string>
}

export interface ActorNodeData extends Record<string, unknown> {
  kind: 'actor'
  label: string
}

export interface UseCaseNodeData extends Record<string, unknown> {
  kind: 'useCase'
  label: string
  /** API nodes on this app server that realize the use case. */
  apiTableIds: string[]
}

export interface LifelineNodeData extends Record<string, unknown> {
  kind: 'lifeline'
  label: string
  participant: LifelineParticipant
  refId?: string
  description?: string
}

export interface ActivityStepNodeData extends Record<string, unknown> {
  kind: ActivityNodeKind
  label: string
  description?: string
  apiTableId?: string
}

export type BehaviorNodeData = LifelineNodeData | ActivityStepNodeData

export type BehaviorSubject = { kind: 'useCase'; id: string } | { kind: 'api'; id: string }

export interface BehaviorDiagram {
  id: string
  subject: BehaviorSubject
  nodes: CanvasNode[]
  edges: Edge<CableData>[]
  viewport: Viewport
}

export interface SequenceMessageData {
  order: number
  messageKind: SequenceMessageKind
  apiTableId?: string
}

export interface SubgraphData {
  nodes: CanvasNode[]
  edges: Edge<CableData>[]
  viewport: Viewport
}

export interface InteriorState<Mode extends string> {
  activeMode: Mode
  modes: Record<Mode, SubgraphData>
}

export type DatabaseInteriors = InteriorState<DatabaseInteriorMode> & {
  umlDiagramType: UmlDiagramType
}
export interface AppServerInteriors {
  activeMode: AppServerInteriorMode
  modes: Record<'api' | 'useCase', SubgraphData>
  sequenceDiagrams?: BehaviorDiagram[]
  activeSequenceId?: string | null
  activityDiagrams?: BehaviorDiagram[]
  activeActivityId?: string | null
}
export type ClientInteriors = InteriorState<ClientInteriorMode>

export interface DeviceData extends Record<string, unknown> {
  kind: DeviceKind
  label: string
  interiors?: DatabaseInteriors
  appInteriors?: AppServerInteriors
  clientInteriors?: ClientInteriors
}

export interface GroupData extends Record<string, unknown> {
  kind: 'group'
  label: string
  notes: string
}

export type CanvasNodeData =
  | DeviceData
  | GroupData
  | EntityData
  | ApiTableNodeData
  | ApiCallNodeData
  | ActorNodeData
  | UseCaseNodeData
  | BehaviorNodeData
export type CanvasNode = Node<CanvasNodeData>

export interface CableData extends Record<string, unknown> {
  flow?: number
  label?: string
  relationKind?: UmlRelationKind
  useCaseRelation?: UseCaseRelationKind
  sequenceMessage?: SequenceMessageData
  guard?: string
}

export type EditorTool = 'select' | 'pan' | 'connect' | 'delete'

const DEVICE_KINDS = new Set<string>([
  'client',
  'loadBalancer',
  'apiGateway',
  'appServer',
  'cache',
  'database',
  'messageQueue',
  'cdn'
])

export function isGroupData(data: CanvasNodeData): data is GroupData {
  return data.kind === 'group'
}

export function isEntityData(data: CanvasNodeData): data is EntityData {
  return data.kind === 'entity'
}

export function isApiTableData(data: CanvasNodeData): data is ApiTableNodeData {
  return data.kind === 'apiTable'
}

export function isApiCallData(data: CanvasNodeData): data is ApiCallNodeData {
  return data.kind === 'apiCall'
}

export function isDeviceData(data: CanvasNodeData): data is DeviceData {
  return DEVICE_KINDS.has(data.kind)
}

export function isGroupNode(node: CanvasNode): node is Node<GroupData, 'group'> {
  return node.type === 'group' || node.data.kind === 'group'
}

export function isEntityNode(node: CanvasNode): node is Node<EntityData, 'entity'> {
  return node.type === 'entity' || node.data.kind === 'entity'
}

export function isApiTableNode(node: CanvasNode): node is Node<ApiTableNodeData, 'apiTable'> {
  return node.type === 'apiTable' || node.data.kind === 'apiTable'
}

export function isApiCallNode(node: CanvasNode): node is Node<ApiCallNodeData, 'apiCall'> {
  return node.type === 'apiCall' || node.data.kind === 'apiCall'
}

export function isActorData(data: CanvasNodeData): data is ActorNodeData {
  return data.kind === 'actor'
}

export function isUseCaseData(data: CanvasNodeData): data is UseCaseNodeData {
  return data.kind === 'useCase'
}

export function isActorNode(node: CanvasNode): node is Node<ActorNodeData, 'actor'> {
  return node.type === 'actor' || node.data.kind === 'actor'
}

export function isUseCaseNode(node: CanvasNode): node is Node<UseCaseNodeData, 'useCase'> {
  return node.type === 'useCase' || node.data.kind === 'useCase'
}

export function isBehaviorData(data: CanvasNodeData): data is BehaviorNodeData {
  return data.kind === 'lifeline' || ACTIVITY_NODE_KINDS.includes(data.kind as ActivityNodeKind)
}

export function isBehaviorNode(node: CanvasNode): node is Node<BehaviorNodeData, 'behavior'> {
  return node.type === 'behavior' || isBehaviorData(node.data)
}

export function isActivityStepNode(node: CanvasNode): node is Node<ActivityStepNodeData, 'behavior'> {
  return isBehaviorNode(node) && node.data.kind !== 'lifeline'
}

export function isDeviceNode(node: CanvasNode): node is Node<DeviceData, 'device'> {
  return node.type === 'device' || isDeviceData(node.data)
}

export function isConnectableNode(node: CanvasNode): boolean {
  return isDeviceNode(node) || isEntityNode(node) || isActorNode(node) || isUseCaseNode(node)
}

export function emptySubgraph(): SubgraphData {
  return { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
}

export function emptyInteriors(): DatabaseInteriors {
  return {
    activeMode: 'erd',
    umlDiagramType: 'class',
    modes: {
      erd: emptySubgraph(),
      uml: emptySubgraph(),
      object: emptySubgraph()
    }
  }
}

export function emptyAppInteriors(): AppServerInteriors {
  return {
    activeMode: 'api',
    modes: {
      api: emptySubgraph(),
      useCase: emptySubgraph()
    },
    sequenceDiagrams: [],
    activeSequenceId: null,
    activityDiagrams: [],
    activeActivityId: null
  }
}

export function emptyClientInteriors(): ClientInteriors {
  return {
    activeMode: 'requests',
    modes: {
      requests: emptySubgraph()
    }
  }
}
