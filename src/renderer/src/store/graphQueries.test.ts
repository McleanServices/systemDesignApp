import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'
import {
  findReachableAppServers,
  formatApiTableSummary,
  getAppServerApis,
  hasApiCallSyncIssues,
  resolveApiCallTarget
} from './graphQueries'
import type { CableData, CanvasNode } from './types'
import { emptyAppInteriors } from './types'

describe('graphQueries client API helpers', () => {
  it('summarizes REST APIs as method + path', () => {
    expect(
      formatApiTableSummary({
        kind: 'apiTable',
        label: 'Users',
        attributes: [],
        apiConfig: {
          rest: { method: 'GET', path: '/users', parameters: [] }
        }
      })
    ).toBe('GET /users')
  })

  it('lists APIs from an app server interior', () => {
    const interiors = emptyAppInteriors()
    interiors.modes.api.nodes = [
      {
        id: 'apiTable-1',
        type: 'apiTable',
        position: { x: 0, y: 0 },
        data: {
          kind: 'apiTable',
          label: 'Get Users',
          attributes: [],
          apiConfig: {
            rest: { method: 'GET', path: '/users', parameters: [] }
          }
        }
      }
    ]

    const appServer: CanvasNode = {
      id: 'appServer-1',
      type: 'device',
      position: { x: 0, y: 0 },
      data: {
        kind: 'appServer',
        label: 'API',
        appInteriors: interiors
      }
    }

    expect(getAppServerApis(appServer)).toEqual([
      {
        id: 'apiTable-1',
        label: 'Get Users',
        summary: 'GET /users',
        apiType: 'rest',
        parameters: []
      }
    ])
  })

  it('resolves and validates apiCall targets', () => {
    const interiors = emptyAppInteriors()
    interiors.modes.api.nodes = [
      {
        id: 'apiTable-1',
        type: 'apiTable',
        position: { x: 0, y: 0 },
        data: {
          kind: 'apiTable',
          label: 'Get Users',
          attributes: [],
          apiConfig: {
            rest: {
              method: 'GET',
              path: '/users',
              parameters: [
                { id: 'param-1', name: 'Authorization', type: 'text', required: true, in: 'header' }
              ]
            }
          }
        }
      }
    ]

    const nodes: CanvasNode[] = [
      {
        id: 'client-1',
        type: 'device',
        position: { x: 0, y: 0 },
        data: { kind: 'client', label: 'Client' }
      },
      {
        id: 'appServer-1',
        type: 'device',
        position: { x: 100, y: 0 },
        data: { kind: 'appServer', label: 'API', appInteriors: interiors }
      }
    ]
    const edges: Edge<CableData>[] = [
      { id: 'cable-1', source: 'client-1', target: 'appServer-1', type: 'cable', data: {} }
    ]

    expect(findReachableAppServers('client-1', nodes, edges).map((node) => node.id)).toEqual([
      'appServer-1'
    ])

    expect(resolveApiCallTarget('appServer-1', 'apiTable-1', nodes).missing).toBe(false)
    expect(resolveApiCallTarget('appServer-1', 'apiTable-1', nodes).unreachable).toBe(false)
    expect(resolveApiCallTarget('appServer-1', 'gone', nodes).missing).toBe(true)

    expect(
      resolveApiCallTarget('appServer-1', 'apiTable-1', nodes, {
        clientId: 'client-1',
        edges: []
      }).unreachable
    ).toBe(true)

    expect(
      hasApiCallSyncIssues(
        {
          kind: 'apiCall',
          label: 'Call',
          sourceAppServerId: 'appServer-1',
          sourceApiTableId: 'apiTable-1',
          paramValues: { 'param-1': 'Bearer x' }
        },
        nodes,
        { clientId: 'client-1', edges: [] }
      )
    ).toBe(true)

    expect(
      hasApiCallSyncIssues(
        {
          kind: 'apiCall',
          label: 'Call',
          sourceAppServerId: 'appServer-1',
          sourceApiTableId: 'apiTable-1',
          paramValues: {}
        },
        nodes
      )
    ).toBe(true)

    expect(
      hasApiCallSyncIssues(
        {
          kind: 'apiCall',
          label: 'Call',
          sourceAppServerId: 'appServer-1',
          sourceApiTableId: 'apiTable-1',
          paramValues: { 'param-1': 'Bearer x' }
        },
        nodes,
        { clientId: 'client-1', edges }
      )
    ).toBe(false)
  })

  it('does not treat app servers as reachable through a shared database', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'client-1',
        type: 'device',
        position: { x: 0, y: 0 },
        data: { kind: 'client', label: 'Client' }
      },
      {
        id: 'appServer-empty',
        type: 'device',
        position: { x: 100, y: 0 },
        data: { kind: 'appServer', label: 'Empty API' }
      },
      {
        id: 'appServer-with-api',
        type: 'device',
        position: { x: 100, y: 100 },
        data: {
          kind: 'appServer',
          label: 'Users API',
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
                      label: 'Get Users',
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
        id: 'database-1',
        type: 'device',
        position: { x: 200, y: 50 },
        data: { kind: 'database', label: 'DB' }
      }
    ]
    const edges: Edge<CableData>[] = [
      { id: 'c1', source: 'client-1', target: 'appServer-empty', type: 'cable', data: {} },
      { id: 'c2', source: 'appServer-empty', target: 'database-1', type: 'cable', data: {} },
      { id: 'c3', source: 'appServer-with-api', target: 'database-1', type: 'cable', data: {} }
    ]

    expect(findReachableAppServers('client-1', nodes, edges).map((node) => node.id)).toEqual([
      'appServer-empty'
    ])

    expect(
      resolveApiCallTarget('appServer-with-api', 'apiTable-1', nodes, {
        clientId: 'client-1',
        edges
      })
    ).toMatchObject({ unreachable: true, missing: false })

    expect(
      hasApiCallSyncIssues(
        {
          kind: 'apiCall',
          label: 'Get Users',
          sourceAppServerId: 'appServer-with-api',
          sourceApiTableId: 'apiTable-1',
          paramValues: {}
        },
        nodes,
        { clientId: 'client-1', edges }
      )
    ).toBe(true)
  })
})
