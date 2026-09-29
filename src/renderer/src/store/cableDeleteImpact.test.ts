import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'
import { analyzeCableDeleteImpact } from './cableDeleteImpact'
import type { CableData, CanvasNode } from './types'

describe('analyzeCableDeleteImpact', () => {
  it('reports client API calls that become unreachable when a cable is removed', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'client-1',
        type: 'device',
        position: { x: 0, y: 0 },
        data: {
          kind: 'client',
          label: 'Client 1',
          clientInteriors: {
            activeMode: 'requests',
            modes: {
              requests: {
                nodes: [
                  {
                    id: 'apiCall-1',
                    type: 'apiCall',
                    position: { x: 0, y: 0 },
                    data: {
                      kind: 'apiCall',
                      label: 'Get Users',
                      sourceAppServerId: 'appServer-2',
                      sourceApiTableId: 'apiTable-1'
                    }
                  }
                ],
                edges: [],
                viewport: { x: 0, y: 0, zoom: 1 }
              }
            }
          }
        }
      },
      {
        id: 'appServer-2',
        type: 'device',
        position: { x: 100, y: 0 },
        data: {
          kind: 'appServer',
          label: 'App Server 1',
          appInteriors: {
            activeMode: 'api',
            modes: {
              api: {
                nodes: [
                  {
                    id: 'apiTable-1',
                    type: 'apiTable',
                    position: { x: 0, y: 0 },
                    data: {
                      kind: 'apiTable',
                      label: 'users',
                      attributes: [],
                      apiConfig: {
                        rest: { method: 'GET', path: '/users', parameters: [] }
                      }
                    }
                  }
                ],
                edges: [],
                viewport: { x: 0, y: 0, zoom: 1 }
              },
              useCase: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
            }
          }
        }
      },
      {
        id: 'appServer-empty',
        type: 'device',
        position: { x: 100, y: 80 },
        data: { kind: 'appServer', label: 'App Server 2' }
      }
    ]

    const edges: Edge<CableData>[] = [
      {
        id: 'cable-client-api',
        source: 'client-1',
        target: 'appServer-2',
        type: 'cable',
        data: {}
      },
      {
        id: 'cable-client-empty',
        source: 'client-1',
        target: 'appServer-empty',
        type: 'cable',
        data: {}
      }
    ]

    const impact = analyzeCableDeleteImpact(['cable-client-api'], nodes, edges)
    expect(impact).not.toBeNull()
    expect(impact?.cableSummaries).toEqual(['Client 1 → App Server 1'])
    expect(impact?.items).toHaveLength(1)
    expect(impact?.items[0]).toMatchObject({
      kind: 'apiCall',
      title: 'Client 1 · Get Users'
    })
    expect(impact?.items[0].detail).toContain('App Server 1')
    expect(impact?.items[0].detail).toContain('GET /users')

    expect(analyzeCableDeleteImpact(['cable-client-empty'], nodes, edges)).toBeNull()
  })

  it('reports API table database links that become unreachable', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'appServer-1',
        type: 'device',
        position: { x: 0, y: 0 },
        data: {
          kind: 'appServer',
          label: 'API',
          appInteriors: {
            activeMode: 'api',
            modes: {
              api: {
                nodes: [
                  {
                    id: 'apiTable-1',
                    type: 'apiTable',
                    position: { x: 0, y: 0 },
                    data: {
                      kind: 'apiTable',
                      label: 'Users API',
                      sourceDatabaseId: 'database-1',
                      sourceEntityId: 'entity-1',
                      attributes: [],
                      tableLinks: [
                        {
                          sourceDatabaseId: 'database-1',
                          sourceEntityId: 'entity-1',
                          attributes: []
                        }
                      ]
                    }
                  }
                ],
                edges: [],
                viewport: { x: 0, y: 0, zoom: 1 }
              },
              useCase: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
            }
          }
        }
      },
      {
        id: 'database-1',
        type: 'device',
        position: { x: 160, y: 0 },
        data: {
          kind: 'database',
          label: 'Database 1',
          interiors: {
            activeMode: 'erd',
            umlDiagramType: 'class',
            modes: {
              erd: {
                nodes: [
                  {
                    id: 'entity-1',
                    type: 'entity',
                    position: { x: 0, y: 0 },
                    data: { kind: 'entity', label: 'users', attributes: [] }
                  }
                ],
                edges: [],
                viewport: { x: 0, y: 0, zoom: 1 }
              },
              uml: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
              object: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
            }
          }
        }
      }
    ]
    const edges: Edge<CableData>[] = [
      { id: 'cable-db', source: 'appServer-1', target: 'database-1', type: 'cable', data: {} }
    ]

    const impact = analyzeCableDeleteImpact(['cable-db'], nodes, edges)
    expect(impact?.items).toHaveLength(1)
    expect(impact?.items[0]).toMatchObject({
      kind: 'apiTable',
      title: 'API · Users API'
    })
    expect(impact?.items[0].detail).toContain('Database 1')
    expect(impact?.items[0].detail).toContain('users')
  })
})
