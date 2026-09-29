import type { Edge, Viewport } from '@xyflow/react'
import type {
  ApiAttributeRef,
  ActorNodeData,
  ApiCallNodeData,
  ApiConfigMap,
  ApiParam,
  ApiParamLocation,
  ApiTableLink,
  ApiTableNodeData,
  ApiType,
  ActivityNodeKind,
  ActivityStepNodeData,
  AppServerInteriorMode,
  AppServerInteriors,
  BehaviorDiagram,
  BehaviorNodeData,
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
  EntityData,
  ErAttribute,
  GraphqlApiConfig,
  GraphqlOperationType,
  GroupData,
  GrpcApiConfig,
  GrpcStreaming,
  HttpMethod,
  JsonRpcApiConfig,
  LifelineNodeData,
  LifelineParticipant,
  RestApiConfig,
  SoapApiConfig,
  SseApiConfig,
  SequenceMessageData,
  SequenceMessageKind,
  SseEvent,
  SubgraphData,
  UmlDiagramType,
  UmlMethod,
  UmlRelationKind,
  UmlVisibility,
  UseCaseNodeData,
  UseCaseRelationKind,
  WebhookApiConfig,
  WebsocketApiConfig,
  WebsocketEvent
} from './types'
import {
  ACTIVITY_NODE_KINDS,
  API_PARAM_LOCATIONS,
  API_TYPES,
  APP_SERVER_INTERIOR_MODES,
  HTTP_METHODS,
  LIFELINE_PARTICIPANTS,
  SEQUENCE_MESSAGE_KINDS,
  UML_RELATION_KINDS,
  UML_VISIBILITIES,
  USE_CASE_RELATION_KINDS,
  emptySubgraph
} from './types'

export const PROJECT_VERSION = 1

export interface ProjectDocument {
  version: number
  name: string
  nodes: CanvasNode[]
  edges: Edge<CableData>[]
  viewport: Viewport
}

const KINDS = new Set<DeviceKind>([
  'client',
  'loadBalancer',
  'apiGateway',
  'appServer',
  'cache',
  'database',
  'messageQueue',
  'cdn'
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function parseGroupData(data: Record<string, unknown>): GroupData {
  const label = typeof data.label === 'string' && data.label.trim() ? data.label : 'Group'
  const notes = typeof data.notes === 'string' ? data.notes : ''
  return { kind: 'group', label, notes }
}

function parseVisibility(value: unknown): UmlVisibility | undefined {
  return typeof value === 'string' && UML_VISIBILITIES.includes(value as UmlVisibility)
    ? (value as UmlVisibility)
    : undefined
}

function parseRelationKind(value: unknown): UmlRelationKind | undefined {
  return typeof value === 'string' && UML_RELATION_KINDS.includes(value as UmlRelationKind)
    ? (value as UmlRelationKind)
    : undefined
}

function parseUseCaseRelation(value: unknown): UseCaseRelationKind | undefined {
  return typeof value === 'string' && USE_CASE_RELATION_KINDS.includes(value as UseCaseRelationKind)
    ? (value as UseCaseRelationKind)
    : undefined
}

function parseAttribute(raw: unknown, index: number): ErAttribute {
  if (!isRecord(raw)) {
    return { id: `attr-${index}`, name: '', type: 'text', pk: false, fk: false }
  }
  const id = typeof raw.id === 'string' && raw.id ? raw.id : `attr-${index}`
  const name = typeof raw.name === 'string' ? raw.name : ''
  const type = typeof raw.type === 'string' && raw.type.trim() ? raw.type : 'text'
  const visibility = parseVisibility(raw.visibility)
  return {
    id,
    name,
    type,
    pk: raw.pk === true,
    fk: raw.fk === true,
    ...(visibility ? { visibility } : {})
  }
}

function parseMethod(raw: unknown, index: number): UmlMethod {
  if (!isRecord(raw)) {
    return { id: `method-${index}`, name: '', visibility: 'public', params: '', returnType: '' }
  }
  const id = typeof raw.id === 'string' && raw.id ? raw.id : `method-${index}`
  const name = typeof raw.name === 'string' ? raw.name : ''
  const params = typeof raw.params === 'string' ? raw.params : ''
  const returnType = typeof raw.returnType === 'string' ? raw.returnType : ''
  return {
    id,
    name,
    visibility: parseVisibility(raw.visibility) ?? 'public',
    params,
    returnType
  }
}

function parseApiAttribute(raw: unknown, index: number): ApiAttributeRef {
  const attribute = parseAttribute(raw, index)
  if (!isRecord(raw) || raw.fromSource === undefined) return attribute
  return { ...attribute, fromSource: raw.fromSource === true }
}

function parseObjectValues(raw: unknown): Record<string, string> | undefined {
  if (!isRecord(raw)) return undefined
  const entries = Object.entries(raw).filter(([, value]) => typeof value === 'string') as [string, string][]
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function parseEntityData(data: Record<string, unknown>): EntityData {
  const label = typeof data.label === 'string' && data.label.trim() ? data.label : 'Entity'
  const attributes = Array.isArray(data.attributes)
    ? data.attributes.map((item, index) => parseAttribute(item, index))
    : []
  const methods = Array.isArray(data.methods)
    ? data.methods.map((item, index) => parseMethod(item, index))
    : undefined
  const objectLabel = typeof data.objectLabel === 'string' ? data.objectLabel : undefined
  const objectValues = parseObjectValues(data.objectValues)
  return {
    kind: 'entity',
    label,
    attributes,
    ...(methods && methods.length > 0 ? { methods } : {}),
    ...(objectLabel ? { objectLabel } : {}),
    ...(objectValues ? { objectValues } : {})
  }
}

const API_TYPE_SET = new Set<string>(API_TYPES)

function parseApiType(value: unknown): ApiType | undefined {
  if (typeof value !== 'string' || value === 'rest' || !API_TYPE_SET.has(value)) return undefined
  return value as ApiType
}

function parseHttpMethod(value: unknown, fallback: HttpMethod): HttpMethod {
  return typeof value === 'string' && HTTP_METHODS.includes(value as HttpMethod) ? (value as HttpMethod) : fallback
}

function parseParamLocation(value: unknown): ApiParamLocation | undefined {
  return typeof value === 'string' && API_PARAM_LOCATIONS.includes(value as ApiParamLocation)
    ? (value as ApiParamLocation)
    : undefined
}

function parseApiParam(raw: unknown, index: number): ApiParam {
  if (!isRecord(raw)) {
    return { id: `param-${index}`, name: '', type: 'string', required: false }
  }
  const location = parseParamLocation(raw.in)
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `param-${index}`,
    name: typeof raw.name === 'string' ? raw.name : '',
    type: typeof raw.type === 'string' && raw.type.trim() ? raw.type : 'string',
    required: raw.required === true,
    ...(location ? { in: location } : {}),
    ...(typeof raw.description === 'string' && raw.description ? { description: raw.description } : {})
  }
}

function parseParamList(value: unknown): ApiParam[] {
  return Array.isArray(value) ? value.map((item, index) => parseApiParam(item, index)) : []
}

function parseRestConfig(raw: Record<string, unknown>): RestApiConfig {
  const contentType = isRecord(raw.requestBody) && typeof raw.requestBody.contentType === 'string'
    ? raw.requestBody.contentType
    : undefined
  const description = isRecord(raw.requestBody) && typeof raw.requestBody.description === 'string'
    ? raw.requestBody.description
    : undefined
  return {
    method: parseHttpMethod(raw.method, 'GET'),
    path: typeof raw.path === 'string' ? raw.path : '/',
    parameters: parseParamList(raw.parameters),
    ...(contentType || description
      ? {
          requestBody: {
            contentType: contentType ?? 'application/json',
            ...(description ? { description } : {})
          }
        }
      : {})
  }
}

function parseGraphqlConfig(raw: Record<string, unknown>): GraphqlApiConfig {
  const operationType: GraphqlOperationType =
    raw.operationType === 'mutation' || raw.operationType === 'subscription' ? raw.operationType : 'query'
  return {
    path: typeof raw.path === 'string' ? raw.path : '/graphql',
    operationType,
    operationName: typeof raw.operationName === 'string' ? raw.operationName : '',
    variables: parseParamList(raw.variables)
  }
}

function parseGrpcConfig(raw: Record<string, unknown>): GrpcApiConfig {
  const streaming: GrpcStreaming =
    raw.streaming === 'client' || raw.streaming === 'server' || raw.streaming === 'bidi' ? raw.streaming : 'unary'
  return {
    packageName: typeof raw.packageName === 'string' ? raw.packageName : '',
    service: typeof raw.service === 'string' ? raw.service : '',
    method: typeof raw.method === 'string' ? raw.method : '',
    streaming,
    requestMessage: typeof raw.requestMessage === 'string' ? raw.requestMessage : '',
    responseMessage: typeof raw.responseMessage === 'string' ? raw.responseMessage : ''
  }
}

function parseSoapConfig(raw: Record<string, unknown>): SoapApiConfig {
  return {
    version: raw.version === '1.2' ? '1.2' : '1.1',
    action: typeof raw.action === 'string' ? raw.action : '',
    operation: typeof raw.operation === 'string' ? raw.operation : '',
    style: raw.style === 'rpc' ? 'rpc' : 'document',
    parameters: parseParamList(raw.parameters)
  }
}

function parseJsonRpcConfig(raw: Record<string, unknown>): JsonRpcApiConfig {
  return {
    version: '2.0',
    method: typeof raw.method === 'string' ? raw.method : '',
    paramStyle: raw.paramStyle === 'positional' ? 'positional' : 'named',
    parameters: parseParamList(raw.parameters)
  }
}

function parseWebsocketEvent(raw: unknown, index: number): WebsocketEvent {
  if (!isRecord(raw)) return { id: `event-${index}`, name: '', direction: 'in' }
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `event-${index}`,
    name: typeof raw.name === 'string' ? raw.name : '',
    direction: raw.direction === 'out' ? 'out' : 'in'
  }
}

function parseWebsocketConfig(raw: Record<string, unknown>): WebsocketApiConfig {
  return {
    path: typeof raw.path === 'string' ? raw.path : '/',
    subprotocol: typeof raw.subprotocol === 'string' ? raw.subprotocol : '',
    events: Array.isArray(raw.events) ? raw.events.map(parseWebsocketEvent) : []
  }
}

function parseSseEvent(raw: unknown, index: number): SseEvent {
  if (typeof raw === 'string') return { id: `event-${index}`, name: raw }
  if (!isRecord(raw)) return { id: `event-${index}`, name: '' }
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `event-${index}`,
    name: typeof raw.name === 'string' ? raw.name : ''
  }
}

function parseSseConfig(raw: Record<string, unknown>): SseApiConfig {
  return {
    path: typeof raw.path === 'string' ? raw.path : '/',
    events: Array.isArray(raw.events) ? raw.events.map(parseSseEvent) : []
  }
}

function parseWebhookConfig(raw: Record<string, unknown>): WebhookApiConfig {
  return {
    method: parseHttpMethod(raw.method, 'POST'),
    path: typeof raw.path === 'string' ? raw.path : '/',
    eventType: typeof raw.eventType === 'string' ? raw.eventType : '',
    parameters: parseParamList(raw.parameters)
  }
}

function cloneParam(param: ApiParam): ApiParam {
  return { ...param }
}

function isDefaultRest(config: RestApiConfig): boolean {
  return (
    config.method === 'GET' &&
    (config.path === '/' || config.path === '') &&
    config.parameters.length === 0 &&
    !config.requestBody
  )
}

function isDefaultGraphql(config: GraphqlApiConfig): boolean {
  return (
    (config.path === '/graphql' || config.path === '') &&
    config.operationType === 'query' &&
    !config.operationName &&
    config.variables.length === 0
  )
}

function isDefaultGrpc(config: GrpcApiConfig): boolean {
  return (
    !config.packageName &&
    !config.service &&
    !config.method &&
    config.streaming === 'unary' &&
    !config.requestMessage &&
    !config.responseMessage
  )
}

function isDefaultSoap(config: SoapApiConfig): boolean {
  return (
    config.version === '1.1' &&
    !config.action &&
    !config.operation &&
    config.style === 'document' &&
    config.parameters.length === 0
  )
}

function isDefaultJsonRpc(config: JsonRpcApiConfig): boolean {
  return config.version === '2.0' && !config.method && config.paramStyle === 'named' && config.parameters.length === 0
}

function isDefaultWebsocket(config: WebsocketApiConfig): boolean {
  return (config.path === '/' || config.path === '') && !config.subprotocol && config.events.length === 0
}

function isDefaultSse(config: SseApiConfig): boolean {
  return (config.path === '/' || config.path === '') && config.events.length === 0
}

function isDefaultWebhook(config: WebhookApiConfig): boolean {
  return (
    config.method === 'POST' &&
    (config.path === '/' || config.path === '') &&
    !config.eventType &&
    config.parameters.length === 0
  )
}

function parseApiConfig(value: unknown): ApiConfigMap | undefined {
  if (!isRecord(value)) return undefined
  const next: ApiConfigMap = {}
  if (isRecord(value.rest)) next.rest = parseRestConfig(value.rest)
  if (isRecord(value.graphql)) next.graphql = parseGraphqlConfig(value.graphql)
  if (isRecord(value.grpc)) next.grpc = parseGrpcConfig(value.grpc)
  if (isRecord(value.soap)) next.soap = parseSoapConfig(value.soap)
  if (isRecord(value.jsonrpc)) next.jsonrpc = parseJsonRpcConfig(value.jsonrpc)
  if (isRecord(value.websocket)) next.websocket = parseWebsocketConfig(value.websocket)
  if (isRecord(value.sse)) next.sse = parseSseConfig(value.sse)
  if (isRecord(value.webhook)) next.webhook = parseWebhookConfig(value.webhook)
  return Object.keys(next).length ? next : undefined
}

function normalizeApiConfig(config: ApiConfigMap | undefined): ApiConfigMap | undefined {
  if (!config) return undefined
  const next: ApiConfigMap = {}
  if (config.rest && !isDefaultRest(config.rest)) {
    next.rest = {
      ...config.rest,
      parameters: config.rest.parameters.map(cloneParam),
      ...(config.rest.requestBody ? { requestBody: { ...config.rest.requestBody } } : {})
    }
  }
  if (config.graphql && !isDefaultGraphql(config.graphql)) {
    next.graphql = { ...config.graphql, variables: config.graphql.variables.map(cloneParam) }
  }
  if (config.grpc && !isDefaultGrpc(config.grpc)) next.grpc = { ...config.grpc }
  if (config.soap && !isDefaultSoap(config.soap)) {
    next.soap = { ...config.soap, parameters: config.soap.parameters.map(cloneParam) }
  }
  if (config.jsonrpc && !isDefaultJsonRpc(config.jsonrpc)) {
    next.jsonrpc = { ...config.jsonrpc, parameters: config.jsonrpc.parameters.map(cloneParam) }
  }
  if (config.websocket && !isDefaultWebsocket(config.websocket)) {
    next.websocket = { ...config.websocket, events: config.websocket.events.map((event) => ({ ...event })) }
  }
  if (config.sse && !isDefaultSse(config.sse)) {
    next.sse = { ...config.sse, events: config.sse.events.map((event) => ({ ...event })) }
  }
  if (config.webhook && !isDefaultWebhook(config.webhook)) {
    next.webhook = { ...config.webhook, parameters: config.webhook.parameters.map(cloneParam) }
  }
  return Object.keys(next).length ? next : undefined
}

function parseApiTableLink(raw: unknown): ApiTableLink | null {
  if (!isRecord(raw)) return null
  const sourceDatabaseId = typeof raw.sourceDatabaseId === 'string' ? raw.sourceDatabaseId : undefined
  const sourceEntityId = typeof raw.sourceEntityId === 'string' ? raw.sourceEntityId : undefined
  if (!sourceDatabaseId || !sourceEntityId) return null
  const attributes = Array.isArray(raw.attributes)
    ? raw.attributes.map((item, index) => parseApiAttribute(item, index))
    : []
  return { sourceDatabaseId, sourceEntityId, attributes }
}

function parseApiTableData(data: Record<string, unknown>): ApiTableNodeData {
  const label = typeof data.label === 'string' && data.label.trim() ? data.label : 'API'
  const apiType = parseApiType(data.apiType)
  const apiConfig = parseApiConfig(data.apiConfig)
  const sourceDatabaseId = typeof data.sourceDatabaseId === 'string' ? data.sourceDatabaseId : undefined
  const sourceEntityId = typeof data.sourceEntityId === 'string' ? data.sourceEntityId : undefined
  const attributes = Array.isArray(data.attributes)
    ? data.attributes.map((item, index) => parseApiAttribute(item, index))
    : []
  const tableLinks = Array.isArray(data.tableLinks)
    ? data.tableLinks.map(parseApiTableLink).filter((item): item is ApiTableLink => item != null)
    : undefined
  const activeTableKey = typeof data.activeTableKey === 'string' ? data.activeTableKey : undefined
  return {
    kind: 'apiTable',
    label,
    attributes,
    ...(apiType ? { apiType } : {}),
    ...(apiConfig ? { apiConfig } : {}),
    ...(sourceDatabaseId ? { sourceDatabaseId } : {}),
    ...(sourceEntityId ? { sourceEntityId } : {}),
    ...(tableLinks?.length ? { tableLinks } : {}),
    ...(activeTableKey ? { activeTableKey } : {})
  }
}

function normalizeApiTableData(data: ApiTableNodeData): ApiTableNodeData {
  const { apiType, apiConfig, ...rest } = data
  const normalizedConfig = normalizeApiConfig(apiConfig)
  return {
    ...rest,
    attributes: data.attributes.map((attribute) => ({ ...attribute })),
    ...(data.tableLinks
      ? {
          tableLinks: data.tableLinks.map((link) => ({
            ...link,
            attributes: link.attributes.map((attribute) => ({ ...attribute }))
          }))
        }
      : {}),
    ...(apiType && apiType !== 'rest' ? { apiType } : {}),
    ...(normalizedConfig ? { apiConfig: normalizedConfig } : {})
  }
}

function parseApiCallData(data: Record<string, unknown>): ApiCallNodeData {
  const label = typeof data.label === 'string' && data.label.trim() ? data.label : 'Request'
  const sourceAppServerId = typeof data.sourceAppServerId === 'string' ? data.sourceAppServerId : undefined
  const sourceApiTableId = typeof data.sourceApiTableId === 'string' ? data.sourceApiTableId : undefined
  const paramValues: Record<string, string> = {}
  if (isRecord(data.paramValues)) {
    for (const [key, value] of Object.entries(data.paramValues)) {
      if (typeof value === 'string') paramValues[key] = value
    }
  }
  return {
    kind: 'apiCall',
    label,
    ...(sourceAppServerId ? { sourceAppServerId } : {}),
    ...(sourceApiTableId ? { sourceApiTableId } : {}),
    ...(Object.keys(paramValues).length ? { paramValues } : {})
  }
}

function normalizeApiCallData(data: ApiCallNodeData): ApiCallNodeData {
  return {
    ...data,
    ...(data.paramValues ? { paramValues: { ...data.paramValues } } : {})
  }
}

function parseActorData(data: Record<string, unknown>): ActorNodeData {
  const label = typeof data.label === 'string' && data.label.trim() ? data.label : 'Actor'
  return { kind: 'actor', label }
}

function parseUseCaseData(data: Record<string, unknown>): UseCaseNodeData {
  const label = typeof data.label === 'string' && data.label.trim() ? data.label : 'Use case'
  const apiTableIds = Array.isArray(data.apiTableIds)
    ? data.apiTableIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  return { kind: 'useCase', label, apiTableIds }
}

function parseLifelineParticipant(value: unknown): LifelineParticipant {
  return typeof value === 'string' && (LIFELINE_PARTICIPANTS as readonly string[]).includes(value)
    ? (value as LifelineParticipant)
    : 'appServer'
}

function parseActivityKind(value: unknown): ActivityNodeKind {
  return typeof value === 'string' && (ACTIVITY_NODE_KINDS as readonly string[]).includes(value)
    ? (value as ActivityNodeKind)
    : 'action'
}

function parseBehaviorData(data: Record<string, unknown>): BehaviorNodeData {
  const description = typeof data.description === 'string' && data.description.trim() ? data.description : undefined
  if (data.kind === 'lifeline') {
    const label = typeof data.label === 'string' && data.label.trim() ? data.label : 'Lifeline'
    const refId = typeof data.refId === 'string' && data.refId ? data.refId : undefined
    const lifeline: LifelineNodeData = {
      kind: 'lifeline',
      label,
      participant: parseLifelineParticipant(data.participant),
      ...(refId ? { refId } : {}),
      ...(description ? { description } : {})
    }
    return lifeline
  }
  const kind = parseActivityKind(data.kind)
  const fallback = kind === 'initial' ? 'Start' : kind === 'final' ? 'End' : 'Action'
  const label = typeof data.label === 'string' && data.label.trim() ? data.label : fallback
  const apiTableId =
    kind === 'action' && typeof data.apiTableId === 'string' && data.apiTableId ? data.apiTableId : undefined
  const step: ActivityStepNodeData = {
    kind,
    label,
    ...(description ? { description } : {}),
    ...(apiTableId ? { apiTableId } : {})
  }
  return step
}

function parseBehaviorSubject(raw: unknown): BehaviorSubject | undefined {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id) return undefined
  if (raw.kind === 'useCase') return { kind: 'useCase', id: raw.id }
  if (raw.kind === 'api') return { kind: 'api', id: raw.id }
  return undefined
}

function parseBehaviorDiagram(raw: unknown): BehaviorDiagram | undefined {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id) return undefined
  const subject = parseBehaviorSubject(raw.subject)
  const graph = parseSubgraph(raw)
  if (!subject || !graph) return undefined
  return { id: raw.id, subject, nodes: graph.nodes, edges: graph.edges, viewport: graph.viewport }
}

function parseBehaviorDiagrams(raw: unknown): BehaviorDiagram[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    const diagram = parseBehaviorDiagram(item)
    return diagram ? [diagram] : []
  })
}

function parseSequenceMessage(raw: unknown): SequenceMessageData | undefined {
  if (!isRecord(raw)) return undefined
  const order = typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : 1
  const messageKind =
    typeof raw.messageKind === 'string' && (SEQUENCE_MESSAGE_KINDS as readonly string[]).includes(raw.messageKind)
      ? (raw.messageKind as SequenceMessageKind)
      : 'sync'
  const apiTableId = typeof raw.apiTableId === 'string' && raw.apiTableId ? raw.apiTableId : undefined
  return { order, messageKind, ...(apiTableId ? { apiTableId } : {}) }
}

function deviceDataForSave(data: DeviceData): DeviceData {
  return {
    kind: data.kind,
    label: data.label,
    ...(data.interiors ? { interiors: data.interiors } : {}),
    ...(data.appInteriors ? { appInteriors: data.appInteriors } : {}),
    ...(data.clientInteriors ? { clientInteriors: data.clientInteriors } : {})
  }
}

function normalizeNodeForSerialize(node: CanvasNode): CanvasNode {
  if (node.data.kind === 'apiTable') {
    return { ...node, data: normalizeApiTableData(node.data) }
  }
  if (node.data.kind === 'apiCall') {
    return { ...node, data: normalizeApiCallData(node.data) }
  }
  if (node.data.kind === 'useCase') {
    return { ...node, data: { ...node.data, apiTableIds: [...node.data.apiTableIds] } }
  }
  if (node.data.kind === 'appServer' && node.data.appInteriors) {
    const api = node.data.appInteriors.modes.api
    const useCase = node.data.appInteriors.modes.useCase ?? emptySubgraph()
    const normalizeDiagram = (diagram: BehaviorDiagram): BehaviorDiagram => ({
      ...diagram,
      nodes: diagram.nodes.map(normalizeNodeForSerialize)
    })
    return {
      ...node,
      data: {
        ...deviceDataForSave(node.data),
        appInteriors: {
          ...node.data.appInteriors,
          modes: {
            api: {
              ...api,
              nodes: api.nodes.map(normalizeNodeForSerialize)
            },
            useCase: {
              ...useCase,
              nodes: useCase.nodes.map(normalizeNodeForSerialize)
            }
          },
          sequenceDiagrams: (node.data.appInteriors.sequenceDiagrams ?? []).map(normalizeDiagram),
          activityDiagrams: (node.data.appInteriors.activityDiagrams ?? []).map(normalizeDiagram)
        }
      }
    }
  }
  if (node.data.kind === 'client' && node.data.clientInteriors) {
    const requests = node.data.clientInteriors.modes.requests
    return {
      ...node,
      data: {
        ...deviceDataForSave(node.data),
        clientInteriors: {
          ...node.data.clientInteriors,
          modes: {
            requests: {
              ...requests,
              nodes: requests.nodes.map(normalizeNodeForSerialize)
            }
          }
        }
      }
    }
  }
  if (
    node.data.kind === 'client' ||
    node.data.kind === 'loadBalancer' ||
    node.data.kind === 'apiGateway' ||
    node.data.kind === 'appServer' ||
    node.data.kind === 'cache' ||
    node.data.kind === 'database' ||
    node.data.kind === 'messageQueue' ||
    node.data.kind === 'cdn'
  ) {
    return { ...node, data: deviceDataForSave(node.data) }
  }
  return node
}

function parseSubgraph(raw: unknown): SubgraphData | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return undefined
  return {
    nodes: raw.nodes.map(parseNode),
    edges: raw.edges.map(parseEdge),
    viewport: isRecord(raw.viewport)
      ? {
          x: Number(raw.viewport.x) || 0,
          y: Number(raw.viewport.y) || 0,
          zoom: Number(raw.viewport.zoom) || 1
        }
      : { x: 0, y: 0, zoom: 1 }
  }
}

function parseInteriorMode(value: unknown): DatabaseInteriorMode {
  if (value === 'uml' || value === 'physical') return 'uml'
  if (value === 'object') return 'object'
  return 'erd'
}

function parseUmlDiagramType(_value: unknown): UmlDiagramType {
  return 'class'
}

function subgraphHasContent(graph: SubgraphData): boolean {
  return graph.nodes.length > 0 || graph.edges.length > 0
}

/** Keep ERD, UML class, and Object diagrams on the same nodes/edges; viewports stay independent. */
function syncSharedDatabaseModes(
  erd: SubgraphData,
  uml: SubgraphData,
  object: SubgraphData
): {
  erd: SubgraphData
  uml: SubgraphData
  object: SubgraphData
} {
  const canonical = subgraphHasContent(erd)
    ? erd
    : subgraphHasContent(uml)
      ? uml
      : subgraphHasContent(object)
        ? object
        : erd
  return {
    erd: { ...erd, nodes: canonical.nodes, edges: canonical.edges },
    uml: { ...uml, nodes: canonical.nodes, edges: canonical.edges },
    object: { ...object, nodes: canonical.nodes, edges: canonical.edges }
  }
}

function parseInteriors(raw: unknown, legacySubgraph?: SubgraphData): DatabaseInteriors | undefined {
  if (isRecord(raw) && isRecord(raw.modes)) {
    const activeMode = parseInteriorMode(raw.activeMode)
    const erd = parseSubgraph(raw.modes.erd) ?? emptySubgraph()
    const umlFromNew = parseSubgraph(raw.modes.uml)
    const umlFromLegacyPhysical = parseSubgraph(raw.modes.physical)
    const uml = umlFromNew ?? umlFromLegacyPhysical ?? emptySubgraph()
    const object = parseSubgraph(raw.modes.object) ?? emptySubgraph()
    const modes = syncSharedDatabaseModes(erd, uml, object)
    return {
      activeMode,
      umlDiagramType: parseUmlDiagramType(raw.umlDiagramType),
      modes
    }
  }
  if (legacySubgraph) {
    const modes = syncSharedDatabaseModes(emptySubgraph(), legacySubgraph, emptySubgraph())
    return {
      activeMode: 'uml',
      umlDiagramType: 'class',
      modes
    }
  }
  return undefined
}

function parseAppInteriorMode(value: unknown): AppServerInteriorMode {
  return typeof value === 'string' && APP_SERVER_INTERIOR_MODES.includes(value as AppServerInteriorMode)
    ? (value as AppServerInteriorMode)
    : 'api'
}

function parseAppInteriors(raw: unknown): AppServerInteriors | undefined {
  if (isRecord(raw) && isRecord(raw.modes)) {
    const activeMode = parseAppInteriorMode(raw.activeMode)
    const api = parseSubgraph(raw.modes.api) ?? emptySubgraph()
    const useCase = parseSubgraph(raw.modes.useCase) ?? emptySubgraph()
    const sequenceDiagrams = parseBehaviorDiagrams(raw.sequenceDiagrams)
    const activityDiagrams = parseBehaviorDiagrams(raw.activityDiagrams).filter(
      (diagram) => diagram.subject.kind === 'useCase'
    )
    const activeSequenceId =
      typeof raw.activeSequenceId === 'string' && sequenceDiagrams.some((diagram) => diagram.id === raw.activeSequenceId)
        ? raw.activeSequenceId
        : null
    const activeActivityId =
      typeof raw.activeActivityId === 'string' && activityDiagrams.some((diagram) => diagram.id === raw.activeActivityId)
        ? raw.activeActivityId
        : null
    return {
      activeMode,
      modes: { api, useCase },
      sequenceDiagrams,
      activeSequenceId,
      activityDiagrams,
      activeActivityId
    }
  }
  return undefined
}

function parseClientInteriorMode(_value: unknown): ClientInteriorMode {
  return 'requests'
}

function parseClientInteriors(raw: unknown): ClientInteriors | undefined {
  if (isRecord(raw) && isRecord(raw.modes)) {
    const activeMode = parseClientInteriorMode(raw.activeMode)
    const requests = parseSubgraph(raw.modes.requests) ?? emptySubgraph()
    return { activeMode, modes: { requests } }
  }
  return undefined
}

function parseNode(raw: unknown): CanvasNode {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !isRecord(raw.data)) {
    throw new Error('Invalid project graph')
  }
  const data = raw.data as CanvasNodeData
  const type = typeof raw.type === 'string' ? raw.type : undefined
  const isGroup = type === 'group' || data.kind === 'group'
  const isEntity = type === 'entity' || data.kind === 'entity'
  const isApiTable = type === 'apiTable' || data.kind === 'apiTable'
  const isApiCall = type === 'apiCall' || data.kind === 'apiCall'
  const isActor = type === 'actor' || data.kind === 'actor'
  const isUseCase = type === 'useCase' || data.kind === 'useCase'
  const isBehavior =
    type === 'behavior' ||
    data.kind === 'lifeline' ||
    (typeof data.kind === 'string' && (ACTIVITY_NODE_KINDS as readonly string[]).includes(data.kind))
  const position = isRecord(raw.position)
    ? { x: Number(raw.position.x) || 0, y: Number(raw.position.y) || 0 }
    : { x: 0, y: 0 }
  const parentId = typeof raw.parentId === 'string' ? raw.parentId : undefined
  const width = raw.width == null ? undefined : Number(raw.width)
  const height = raw.height == null ? undefined : Number(raw.height)
  const style = isRecord(raw.style) ? { ...raw.style } : undefined

  if (isGroup) {
    const groupData = parseGroupData(data)
    const resolvedWidth = width ?? (typeof style?.width === 'number' ? style.width : 240)
    const resolvedHeight = height ?? (typeof style?.height === 'number' ? style.height : 160)
    return {
      id: raw.id,
      type: 'group',
      position,
      width: resolvedWidth,
      height: resolvedHeight,
      style: { ...style, width: resolvedWidth, height: resolvedHeight },
      connectable: false,
      data: groupData,
      ...(parentId ? { parentId } : {})
    }
  }

  if (isEntity) {
    const entityData = parseEntityData(data)
    return {
      id: raw.id,
      type: 'entity',
      position,
      data: entityData,
      ...(parentId ? { parentId } : {})
    }
  }

  if (isApiTable) {
    const apiTableData = parseApiTableData(data)
    return {
      id: raw.id,
      type: 'apiTable',
      position,
      data: apiTableData,
      ...(parentId ? { parentId } : {})
    }
  }

  if (isApiCall) {
    const apiCallData = parseApiCallData(data)
    return {
      id: raw.id,
      type: 'apiCall',
      position,
      data: apiCallData,
      ...(parentId ? { parentId } : {})
    }
  }

  if (isActor) {
    return {
      id: raw.id,
      type: 'actor',
      position,
      data: parseActorData(data),
      ...(parentId ? { parentId } : {})
    }
  }

  if (isUseCase) {
    return {
      id: raw.id,
      type: 'useCase',
      position,
      data: parseUseCaseData(data),
      ...(parentId ? { parentId } : {})
    }
  }

  if (isBehavior) {
    return {
      id: raw.id,
      type: 'behavior',
      position,
      data: parseBehaviorData(data),
      ...(parentId ? { parentId } : {})
    }
  }

  if (!data.kind || !KINDS.has(data.kind as DeviceKind)) {
    throw new Error('Project contains an unknown device type')
  }

  const legacySubgraph = data.kind === 'database' ? parseSubgraph(data.subgraph) : undefined
  const interiors =
    data.kind === 'database' ? parseInteriors(data.interiors, legacySubgraph) : undefined
  const appInteriors = data.kind === 'appServer' ? parseAppInteriors(data.appInteriors) : undefined
  const clientInteriors = data.kind === 'client' ? parseClientInteriors(data.clientInteriors) : undefined

  return {
    ...(raw as CanvasNode),
    id: raw.id,
    type: type ?? 'device',
    position,
    data: {
      kind: data.kind as DeviceKind,
      label: typeof data.label === 'string' ? data.label : 'Device',
      ...(interiors ? { interiors } : {}),
      ...(appInteriors ? { appInteriors } : {}),
      ...(clientInteriors ? { clientInteriors } : {})
    } as CanvasNodeData,
    ...(parentId ? { parentId } : {})
  }
}

function parseEdge(raw: unknown): Edge<CableData> {
  if (!isRecord(raw) || typeof raw.source !== 'string' || typeof raw.target !== 'string') {
    throw new Error('Invalid project graph')
  }
  const data = isRecord(raw.data) ? raw.data : {}
  const label = typeof data.label === 'string' ? data.label : ''
  const flow = typeof data.flow === 'number' && Number.isFinite(data.flow) ? data.flow : 0
  const relationKind = parseRelationKind(data.relationKind)
  const useCaseRelation = parseUseCaseRelation(data.useCaseRelation)
  const sequenceMessage = parseSequenceMessage(data.sequenceMessage)
  const guard = typeof data.guard === 'string' ? data.guard : undefined
  const id = typeof raw.id === 'string' && raw.id ? raw.id : `${raw.source}-${raw.target}`
  const sourceHandle = typeof raw.sourceHandle === 'string' && raw.sourceHandle ? raw.sourceHandle : undefined
  const targetHandle = typeof raw.targetHandle === 'string' && raw.targetHandle ? raw.targetHandle : undefined
  return {
    ...(raw as Edge<CableData>),
    id,
    source: raw.source,
    target: raw.target,
    sourceHandle,
    targetHandle,
    type: typeof raw.type === 'string' ? raw.type : 'cable',
    data: {
      ...data,
      label,
      flow,
      ...(relationKind ? { relationKind } : {}),
      ...(useCaseRelation ? { useCaseRelation } : {}),
      ...(sequenceMessage ? { sequenceMessage } : {}),
      ...(guard != null ? { guard } : {})
    } as unknown as CableData
  }
}

export function normalizeProject(doc: Omit<ProjectDocument, 'version'>): Omit<ProjectDocument, 'version'> {
  return {
    name: doc.name,
    nodes: doc.nodes.map(normalizeNodeForSerialize),
    edges: doc.edges,
    viewport: doc.viewport
  }
}

export function serializeProject(doc: Omit<ProjectDocument, 'version'>): string {
  const payload: ProjectDocument = {
    version: PROJECT_VERSION,
    ...normalizeProject(doc)
  }
  return `${JSON.stringify(payload, null, 2)}\n`
}

export function parseProject(raw: string): ProjectDocument {
  const data = JSON.parse(raw) as ProjectDocument
  if (!data || data.version !== PROJECT_VERSION) {
    throw new Error('Unsupported or missing .sdlab version')
  }
  if (typeof data.name !== 'string') {
    throw new Error('Invalid project name')
  }
  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    throw new Error('Invalid project graph')
  }

  const nodes = data.nodes.map(parseNode)
  const ids = new Set(nodes.map((node) => node.id))
  const normalized = nodes.map((node) => {
    if (!node.parentId || ids.has(node.parentId)) return node
    const { parentId: _parentId, ...rest } = node
    return rest
  })

  return {
    version: PROJECT_VERSION,
    name: data.name,
    nodes: normalized,
    edges: data.edges.map(parseEdge),
    viewport: data.viewport ?? { x: 0, y: 0, zoom: 1 }
  }
}
