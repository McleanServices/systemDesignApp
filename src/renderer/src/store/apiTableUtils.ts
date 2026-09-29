import type {
  ApiConfigMap,
  ApiParam,
  ApiParamLocation,
  ApiTableLink,
  ApiTableNodeData,
  ApiType,
  GraphqlApiConfig,
  GrpcApiConfig,
  JsonRpcApiConfig,
  RestApiConfig,
  SoapApiConfig,
  SseApiConfig,
  WebhookApiConfig,
  WebsocketApiConfig
} from './types'

export function apiTableLinkKey(sourceDatabaseId: string, sourceEntityId: string): string {
  return `${sourceDatabaseId}::${sourceEntityId}`
}

export function getApiTableLinks(data: ApiTableNodeData): ApiTableLink[] {
  if (data.tableLinks?.length) {
    return data.tableLinks.map((link) => ({
      sourceDatabaseId: link.sourceDatabaseId,
      sourceEntityId: link.sourceEntityId,
      attributes: link.attributes.map((attribute) => ({ ...attribute }))
    }))
  }
  if (data.sourceDatabaseId && data.sourceEntityId) {
    return [
      {
        sourceDatabaseId: data.sourceDatabaseId,
        sourceEntityId: data.sourceEntityId,
        attributes: data.attributes.map((attribute) => ({ ...attribute }))
      }
    ]
  }
  return []
}

export function getActiveTableKey(data: ApiTableNodeData): string | undefined {
  const links = getApiTableLinks(data)
  if (data.activeTableKey && links.some((link) => apiTableLinkKey(link.sourceDatabaseId, link.sourceEntityId) === data.activeTableKey)) {
    return data.activeTableKey
  }
  if (data.sourceDatabaseId && data.sourceEntityId) {
    const legacyKey = apiTableLinkKey(data.sourceDatabaseId, data.sourceEntityId)
    if (links.some((link) => apiTableLinkKey(link.sourceDatabaseId, link.sourceEntityId) === legacyKey)) {
      return legacyKey
    }
  }
  if (links.length === 0) return undefined
  return apiTableLinkKey(links[0].sourceDatabaseId, links[0].sourceEntityId)
}

export function getActiveTableLink(data: ApiTableNodeData): ApiTableLink | undefined {
  const activeKey = getActiveTableKey(data)
  if (!activeKey) return undefined
  return getApiTableLinks(data).find(
    (link) => apiTableLinkKey(link.sourceDatabaseId, link.sourceEntityId) === activeKey
  )
}

export function flattenApiTableForSave(data: ApiTableNodeData): ApiTableNodeData {
  const tableLinks = getApiTableLinks(data)
  const activeKey = getActiveTableKey(data)
  const active =
    tableLinks.find((link) => apiTableLinkKey(link.sourceDatabaseId, link.sourceEntityId) === activeKey) ??
    tableLinks[0]

  return {
    ...data,
    tableLinks,
    ...(activeKey ? { activeTableKey: activeKey } : {}),
    sourceDatabaseId: active?.sourceDatabaseId,
    sourceEntityId: active?.sourceEntityId,
    attributes: active?.attributes ?? []
  }
}

export function cloneApiParam(param: ApiParam): ApiParam {
  return { ...param }
}

export function cloneApiConfig(config: ApiConfigMap | undefined): ApiConfigMap | undefined {
  if (!config) return undefined
  const next: ApiConfigMap = {}
  if (config.rest) {
    next.rest = {
      ...config.rest,
      parameters: config.rest.parameters.map(cloneApiParam),
      ...(config.rest.requestBody ? { requestBody: { ...config.rest.requestBody } } : {})
    }
  }
  if (config.graphql) {
    next.graphql = { ...config.graphql, variables: config.graphql.variables.map(cloneApiParam) }
  }
  if (config.grpc) next.grpc = { ...config.grpc }
  if (config.soap) next.soap = { ...config.soap, parameters: config.soap.parameters.map(cloneApiParam) }
  if (config.jsonrpc) next.jsonrpc = { ...config.jsonrpc, parameters: config.jsonrpc.parameters.map(cloneApiParam) }
  if (config.websocket) {
    next.websocket = { ...config.websocket, events: config.websocket.events.map((event) => ({ ...event })) }
  }
  if (config.sse) next.sse = { ...config.sse, events: config.sse.events.map((event) => ({ ...event })) }
  if (config.webhook) next.webhook = { ...config.webhook, parameters: config.webhook.parameters.map(cloneApiParam) }
  return Object.keys(next).length ? next : undefined
}

export function cloneApiTableDraft(data: ApiTableNodeData): ApiTableNodeData {
  const normalized = flattenApiTableForSave(data)
  const { apiConfig: existingConfig, ...rest } = normalized
  const apiConfig = cloneApiConfig(existingConfig)
  return {
    ...rest,
    tableLinks: rest.tableLinks?.map((link) => ({
      ...link,
      attributes: link.attributes.map((attribute) => ({ ...attribute }))
    })),
    attributes: rest.attributes.map((attribute) => ({ ...attribute })),
    ...(apiConfig ? { apiConfig } : {})
  }
}

export function defaultRestConfig(): RestApiConfig {
  return { method: 'GET', path: '/', parameters: [] }
}

export function defaultGraphqlConfig(): GraphqlApiConfig {
  return { path: '/graphql', operationType: 'query', operationName: '', variables: [] }
}

export function defaultGrpcConfig(): GrpcApiConfig {
  return {
    packageName: '',
    service: '',
    method: '',
    streaming: 'unary',
    requestMessage: '',
    responseMessage: ''
  }
}

export function defaultSoapConfig(): SoapApiConfig {
  return { version: '1.1', action: '', operation: '', style: 'document', parameters: [] }
}

export function defaultJsonRpcConfig(): JsonRpcApiConfig {
  return { version: '2.0', method: '', paramStyle: 'named', parameters: [] }
}

export function defaultWebsocketConfig(): WebsocketApiConfig {
  return { path: '/', subprotocol: '', events: [] }
}

export function defaultSseConfig(): SseApiConfig {
  return { path: '/', events: [] }
}

export function defaultWebhookConfig(): WebhookApiConfig {
  return { method: 'POST', path: '/', eventType: '', parameters: [] }
}

export function newApiParam(location?: ApiParamLocation): ApiParam {
  return {
    id: `param-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    name: '',
    type: 'string',
    required: false,
    ...(location ? { in: location } : {})
  }
}

export function isTableLinkSelected(data: ApiTableNodeData, databaseId: string, entityId: string): boolean {
  const key = apiTableLinkKey(databaseId, entityId)
  return getApiTableLinks(data).some(
    (link) => apiTableLinkKey(link.sourceDatabaseId, link.sourceEntityId) === key
  )
}

export function apiTypeHasParameters(apiType: ApiType | undefined): boolean {
  const type = apiType ?? 'rest'
  return type === 'rest' || type === 'graphql' || type === 'soap' || type === 'jsonrpc' || type === 'webhook'
}

export function apiTypeUsesParamLocation(apiType: ApiType | undefined): boolean {
  return (apiType ?? 'rest') === 'rest'
}

export function getApiParametersLabel(apiType: ApiType | undefined): string {
  return (apiType ?? 'rest') === 'graphql' ? 'Variables' : 'Parameters'
}

export function getApiParameters(data: ApiTableNodeData): ApiParam[] {
  const apiType = data.apiType ?? 'rest'
  switch (apiType) {
    case 'graphql':
      return (data.apiConfig?.graphql ?? defaultGraphqlConfig()).variables.map(cloneApiParam)
    case 'soap':
      return (data.apiConfig?.soap ?? defaultSoapConfig()).parameters.map(cloneApiParam)
    case 'jsonrpc':
      return (data.apiConfig?.jsonrpc ?? defaultJsonRpcConfig()).parameters.map(cloneApiParam)
    case 'webhook':
      return (data.apiConfig?.webhook ?? defaultWebhookConfig()).parameters.map(cloneApiParam)
    case 'rest':
    default:
      return (data.apiConfig?.rest ?? defaultRestConfig()).parameters.map(cloneApiParam)
  }
}

export function setApiParameters(data: ApiTableNodeData, parameters: ApiParam[]): ApiTableNodeData {
  const apiType = data.apiType ?? 'rest'
  const apiConfig = { ...data.apiConfig }
  switch (apiType) {
    case 'graphql':
      apiConfig.graphql = { ...(data.apiConfig?.graphql ?? defaultGraphqlConfig()), variables: parameters.map(cloneApiParam) }
      break
    case 'soap':
      apiConfig.soap = { ...(data.apiConfig?.soap ?? defaultSoapConfig()), parameters: parameters.map(cloneApiParam) }
      break
    case 'jsonrpc':
      apiConfig.jsonrpc = {
        ...(data.apiConfig?.jsonrpc ?? defaultJsonRpcConfig()),
        parameters: parameters.map(cloneApiParam)
      }
      break
    case 'webhook':
      apiConfig.webhook = {
        ...(data.apiConfig?.webhook ?? defaultWebhookConfig()),
        parameters: parameters.map(cloneApiParam)
      }
      break
    case 'rest':
    default:
      apiConfig.rest = { ...(data.apiConfig?.rest ?? defaultRestConfig()), parameters: parameters.map(cloneApiParam) }
      break
  }
  return { ...data, apiConfig }
}
