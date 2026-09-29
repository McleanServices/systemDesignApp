import type { JSX } from 'react'
import {
  defaultGraphqlConfig,
  defaultGrpcConfig,
  defaultJsonRpcConfig,
  defaultRestConfig,
  defaultSoapConfig,
  defaultSseConfig,
  defaultWebhookConfig,
  defaultWebsocketConfig
} from '../store/apiTableUtils'
import type {
  ApiConfigMap,
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
} from '../store/types'
import { HTTP_METHODS } from '../store/types'

interface ApiStyleFieldsProps {
  data: ApiTableNodeData
  onChange: (patch: Partial<ApiTableNodeData>) => void
}

function patchConfig(data: ApiTableNodeData, patch: Partial<ApiConfigMap>): Partial<ApiTableNodeData> {
  return { apiConfig: { ...data.apiConfig, ...patch } }
}

function RestFields({
  config,
  onChange
}: {
  config: RestApiConfig
  onChange: (config: RestApiConfig) => void
}): JSX.Element {
  return (
    <>
      <label className="field">
        <span>Method</span>
        <select
          value={config.method}
          onChange={(e) => onChange({ ...config, method: e.target.value as RestApiConfig['method'] })}
        >
          {HTTP_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Path</span>
        <input
          value={config.path}
          onChange={(e) => onChange({ ...config, path: e.target.value })}
          placeholder="/users/{id}"
        />
      </label>
      <label className="field">
        <span>Request body content type</span>
        <input
          value={config.requestBody?.contentType ?? ''}
          onChange={(e) => {
            const contentType = e.target.value
            onChange({
              ...config,
              requestBody: contentType ? { contentType, description: config.requestBody?.description } : undefined
            })
          }}
          placeholder="application/json"
        />
      </label>
    </>
  )
}

function GraphqlFields({
  config,
  onChange
}: {
  config: GraphqlApiConfig
  onChange: (config: GraphqlApiConfig) => void
}): JSX.Element {
  return (
    <>
      <label className="field">
        <span>Endpoint path</span>
        <input value={config.path} onChange={(e) => onChange({ ...config, path: e.target.value })} />
      </label>
      <label className="field">
        <span>Operation type</span>
        <select
          value={config.operationType}
          onChange={(e) => onChange({ ...config, operationType: e.target.value as GraphqlApiConfig['operationType'] })}
        >
          <option value="query">Query</option>
          <option value="mutation">Mutation</option>
          <option value="subscription">Subscription</option>
        </select>
      </label>
      <label className="field">
        <span>Operation name</span>
        <input
          value={config.operationName}
          onChange={(e) => onChange({ ...config, operationName: e.target.value })}
          placeholder="GetUser"
        />
      </label>
    </>
  )
}

function GrpcFields({
  config,
  onChange
}: {
  config: GrpcApiConfig
  onChange: (config: GrpcApiConfig) => void
}): JSX.Element {
  return (
    <>
      <label className="field">
        <span>Package</span>
        <input value={config.packageName} onChange={(e) => onChange({ ...config, packageName: e.target.value })} />
      </label>
      <label className="field">
        <span>Service</span>
        <input value={config.service} onChange={(e) => onChange({ ...config, service: e.target.value })} />
      </label>
      <label className="field">
        <span>RPC method</span>
        <input value={config.method} onChange={(e) => onChange({ ...config, method: e.target.value })} />
      </label>
      <label className="field">
        <span>Streaming</span>
        <select
          value={config.streaming}
          onChange={(e) => onChange({ ...config, streaming: e.target.value as GrpcApiConfig['streaming'] })}
        >
          <option value="unary">Unary</option>
          <option value="client">Client streaming</option>
          <option value="server">Server streaming</option>
          <option value="bidi">Bidirectional</option>
        </select>
      </label>
      <label className="field">
        <span>Request message</span>
        <input value={config.requestMessage} onChange={(e) => onChange({ ...config, requestMessage: e.target.value })} />
      </label>
      <label className="field">
        <span>Response message</span>
        <input
          value={config.responseMessage}
          onChange={(e) => onChange({ ...config, responseMessage: e.target.value })}
        />
      </label>
    </>
  )
}

function SoapFields({
  config,
  onChange
}: {
  config: SoapApiConfig
  onChange: (config: SoapApiConfig) => void
}): JSX.Element {
  return (
    <>
      <label className="field">
        <span>SOAP version</span>
        <select
          value={config.version}
          onChange={(e) => onChange({ ...config, version: e.target.value as SoapApiConfig['version'] })}
        >
          <option value="1.1">1.1</option>
          <option value="1.2">1.2</option>
        </select>
      </label>
      <label className="field">
        <span>Action</span>
        <input value={config.action} onChange={(e) => onChange({ ...config, action: e.target.value })} />
      </label>
      <label className="field">
        <span>Operation</span>
        <input value={config.operation} onChange={(e) => onChange({ ...config, operation: e.target.value })} />
      </label>
      <label className="field">
        <span>Style</span>
        <select
          value={config.style}
          onChange={(e) => onChange({ ...config, style: e.target.value as SoapApiConfig['style'] })}
        >
          <option value="document">Document</option>
          <option value="rpc">RPC</option>
        </select>
      </label>
    </>
  )
}

function JsonRpcFields({
  config,
  onChange
}: {
  config: JsonRpcApiConfig
  onChange: (config: JsonRpcApiConfig) => void
}): JSX.Element {
  return (
    <>
      <label className="field">
        <span>Version</span>
        <input value={config.version} readOnly />
      </label>
      <label className="field">
        <span>Method</span>
        <input value={config.method} onChange={(e) => onChange({ ...config, method: e.target.value })} />
      </label>
      <label className="field">
        <span>Param style</span>
        <select
          value={config.paramStyle}
          onChange={(e) => onChange({ ...config, paramStyle: e.target.value as JsonRpcApiConfig['paramStyle'] })}
        >
          <option value="named">Named</option>
          <option value="positional">Positional</option>
        </select>
      </label>
    </>
  )
}

function WebsocketFields({
  config,
  onChange
}: {
  config: WebsocketApiConfig
  onChange: (config: WebsocketApiConfig) => void
}): JSX.Element {
  return (
    <>
      <label className="field">
        <span>Path</span>
        <input value={config.path} onChange={(e) => onChange({ ...config, path: e.target.value })} />
      </label>
      <label className="field">
        <span>Subprotocol</span>
        <input value={config.subprotocol} onChange={(e) => onChange({ ...config, subprotocol: e.target.value })} />
      </label>
      <div className="field">
        <span>Events</span>
        <div className="api-param-list">
          {config.events.map((event, index) => (
            <div key={event.id} className="api-param-row api-param-row--event">
              <input
                aria-label="Event name"
                placeholder="event"
                value={event.name}
                onChange={(e) =>
                  onChange({
                    ...config,
                    events: config.events.map((item, i) => (i === index ? { ...item, name: e.target.value } : item))
                  })
                }
              />
              <select
                aria-label="Direction"
                value={event.direction}
                onChange={(e) =>
                  onChange({
                    ...config,
                    events: config.events.map((item, i) =>
                      i === index ? { ...item, direction: e.target.value as 'in' | 'out' } : item
                    )
                  })
                }
              >
                <option value="in">in</option>
                <option value="out">out</option>
              </select>
              <button
                type="button"
                className="api-param-row__remove"
                aria-label="Remove event"
                onClick={() => onChange({ ...config, events: config.events.filter((_, i) => i !== index) })}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="api-param-add"
            onClick={() =>
              onChange({
                ...config,
                events: [
                  ...config.events,
                  { id: `event-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, name: '', direction: 'in' }
                ]
              })
            }
          >
            Add event
          </button>
        </div>
      </div>
    </>
  )
}

function SseFields({
  config,
  onChange
}: {
  config: SseApiConfig
  onChange: (config: SseApiConfig) => void
}): JSX.Element {
  return (
    <>
      <label className="field">
        <span>Path</span>
        <input value={config.path} onChange={(e) => onChange({ ...config, path: e.target.value })} />
      </label>
      <div className="field">
        <span>Event names</span>
        <div className="api-param-list">
          {config.events.map((event, index) => (
            <div key={event.id} className="api-param-row api-param-row--simple">
              <input
                aria-label="Event name"
                placeholder="event"
                value={event.name}
                onChange={(e) =>
                  onChange({
                    ...config,
                    events: config.events.map((item, i) => (i === index ? { ...item, name: e.target.value } : item))
                  })
                }
              />
              <button
                type="button"
                className="api-param-row__remove"
                aria-label="Remove event"
                onClick={() => onChange({ ...config, events: config.events.filter((_, i) => i !== index) })}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="api-param-add"
            onClick={() =>
              onChange({
                ...config,
                events: [...config.events, { id: `event-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, name: '' }]
              })
            }
          >
            Add event
          </button>
        </div>
      </div>
    </>
  )
}

function WebhookFields({
  config,
  onChange
}: {
  config: WebhookApiConfig
  onChange: (config: WebhookApiConfig) => void
}): JSX.Element {
  return (
    <>
      <label className="field">
        <span>Method</span>
        <select
          value={config.method}
          onChange={(e) => onChange({ ...config, method: e.target.value as WebhookApiConfig['method'] })}
        >
          {HTTP_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Path</span>
        <input value={config.path} onChange={(e) => onChange({ ...config, path: e.target.value })} />
      </label>
      <label className="field">
        <span>Event type</span>
        <input
          value={config.eventType}
          onChange={(e) => onChange({ ...config, eventType: e.target.value })}
          placeholder="payment.completed"
        />
      </label>
    </>
  )
}

export function ApiStyleFields({ data, onChange }: ApiStyleFieldsProps): JSX.Element {
  const apiType: ApiType = data.apiType ?? 'rest'

  switch (apiType) {
    case 'graphql':
      return (
        <GraphqlFields
          config={data.apiConfig?.graphql ?? defaultGraphqlConfig()}
          onChange={(graphql) => onChange(patchConfig(data, { graphql }))}
        />
      )
    case 'grpc':
      return (
        <GrpcFields
          config={data.apiConfig?.grpc ?? defaultGrpcConfig()}
          onChange={(grpc) => onChange(patchConfig(data, { grpc }))}
        />
      )
    case 'soap':
      return (
        <SoapFields
          config={data.apiConfig?.soap ?? defaultSoapConfig()}
          onChange={(soap) => onChange(patchConfig(data, { soap }))}
        />
      )
    case 'jsonrpc':
      return (
        <JsonRpcFields
          config={data.apiConfig?.jsonrpc ?? defaultJsonRpcConfig()}
          onChange={(jsonrpc) => onChange(patchConfig(data, { jsonrpc }))}
        />
      )
    case 'websocket':
      return (
        <WebsocketFields
          config={data.apiConfig?.websocket ?? defaultWebsocketConfig()}
          onChange={(websocket) => onChange(patchConfig(data, { websocket }))}
        />
      )
    case 'sse':
      return (
        <SseFields
          config={data.apiConfig?.sse ?? defaultSseConfig()}
          onChange={(sse) => onChange(patchConfig(data, { sse }))}
        />
      )
    case 'webhook':
      return (
        <WebhookFields
          config={data.apiConfig?.webhook ?? defaultWebhookConfig()}
          onChange={(webhook) => onChange(patchConfig(data, { webhook }))}
        />
      )
    default:
      return (
        <RestFields
          config={data.apiConfig?.rest ?? defaultRestConfig()}
          onChange={(rest) => onChange(patchConfig(data, { rest }))}
        />
      )
  }
}
