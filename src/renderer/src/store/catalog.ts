import type { DeviceKind } from './types'

export type LoadBalanceAlgorithm = 'roundRobin' | 'leastConnections' | 'weighted' | 'ipHash'
export type RateLimitAlgorithm = 'tokenBucket' | 'leakyBucket' | 'fixedWindow' | 'slidingWindow'

export interface DeviceDefaults {
  kind: DeviceKind
  label: string
  arrivalRate?: number
  instances?: number
  serviceRate?: number
  hitRatio?: number
  readRatio?: number
  databaseRole?: 'primary' | 'replica'
  ramGb?: number
  workingSetGb?: number
  placement: 'local'
  rateLimit?: number
  rateLimitAlgorithm?: RateLimitAlgorithm
  lbAlgorithm?: LoadBalanceAlgorithm
}

export interface DeviceCategory {
  id: string
  title: string
  items: DeviceDefaults[]
}

export const DEVICE_CATEGORIES: DeviceCategory[] = [
  {
    id: 'clients',
    title: 'Clients',
  items: [{ kind: 'client', label: 'Client', arrivalRate: 100, readRatio: 0.8, placement: 'local' }]
  },
  {
    id: 'edge',
    title: 'Edge',
    items: [
      {
        kind: 'loadBalancer',
        label: 'Load Balancer',
        instances: 2,
        serviceRate: 5000,
        lbAlgorithm: 'weighted',
        placement: 'local'
      },
      {
        kind: 'apiGateway',
        label: 'API Gateway',
        instances: 2,
        serviceRate: 8000,
        rateLimit: 1000,
        rateLimitAlgorithm: 'tokenBucket',
        placement: 'local'
      },
      { kind: 'cdn', label: 'CDN', instances: 4, serviceRate: 20000, hitRatio: 0.9, placement: 'local' }
    ]
  },
  {
    id: 'compute',
    title: 'Compute',
    items: [{ kind: 'appServer', label: 'App Server', instances: 4, serviceRate: 50, placement: 'local' }]
  },
  {
    id: 'data',
    title: 'Data',
    items: [
      { kind: 'cache', label: 'Cache', instances: 2, serviceRate: 10000, hitRatio: 0.8, placement: 'local' },
      {
        kind: 'database',
        label: 'Database',
        instances: 1,
        serviceRate: 200,
        databaseRole: 'primary',
        ramGb: 8,
        workingSetGb: 32,
        placement: 'local'
      }
    ]
  },
  {
    id: 'async',
    title: 'Async',
    items: [{ kind: 'messageQueue', label: 'Message Queue', instances: 1, serviceRate: 1000, placement: 'local' }]
  }
]

export const DEVICE_DEFAULTS: Record<DeviceKind, DeviceDefaults> = Object.fromEntries(
  DEVICE_CATEGORIES.flatMap((c) => c.items).map((item) => [item.kind, item])
) as Record<DeviceKind, DeviceDefaults>

export const STARTER_SCENARIOS = [
  { id: 'url-shortener', label: 'URL shortener', goal: 'Keep redirect reads fast with cache and replicas.' },
  { id: 'news-feed', label: 'News feed', goal: 'Handle read-heavy traffic without overloading the primary.' },
  { id: 'chat', label: 'Chat system', goal: 'Separate synchronous requests from asynchronous delivery.' }
] as const

export const KIND_LABEL: Record<DeviceKind, string> = {
  client: 'Client',
  loadBalancer: 'Load Balancer',
  apiGateway: 'API Gateway',
  appServer: 'App Server',
  cache: 'Cache',
  database: 'Database',
  messageQueue: 'Message Queue',
  cdn: 'CDN'
}
