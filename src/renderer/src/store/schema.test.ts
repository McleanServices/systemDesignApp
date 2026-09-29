import { describe, expect, it } from 'vitest'
import { parseProject, serializeProject } from './schema'
import type { DeviceData } from './types'

describe('sdlab project files', () => {
  it('round-trips a design document', () => {
    const raw = serializeProject({
      name: 'Web Shop',
      nodes: [
        {
          id: 'client-1',
          type: 'device',
          position: { x: 0, y: 0 },
          data: { kind: 'client', label: 'Client 1' } satisfies DeviceData
        }
      ],
      edges: [],
      viewport: { x: 10, y: 20, zoom: 1.2 }
    })

    expect(raw).toContain('"version": 1')
    const doc = parseProject(raw)
    expect(doc.name).toBe('Web Shop')
    expect(doc.nodes[0].data.kind).toBe('client')
    expect(doc.nodes[0].data.label).toBe('Client 1')
    expect(doc.viewport.zoom).toBe(1.2)
  })

  it('round-trips copper cable labels', () => {
    const raw = serializeProject({
      name: 'Labeled Link',
      nodes: [
        {
          id: 'client-1',
          type: 'device',
          position: { x: 0, y: 0 },
          data: { kind: 'client', label: 'Client 1' } satisfies DeviceData
        },
        {
          id: 'app-1',
          type: 'device',
          position: { x: 200, y: 0 },
          data: { kind: 'appServer', label: 'App 1' } satisfies DeviceData
        }
      ],
      edges: [
        {
          id: 'cable-1',
          source: 'client-1',
          target: 'app-1',
          type: 'cable',
          data: { label: 'REST reads', flow: 0 }
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    })

    const doc = parseProject(raw)
    expect(doc.edges[0].data?.label).toBe('REST reads')
  })

  it('round-trips cable handle attachment sides', () => {
    const raw = serializeProject({
      name: 'Ported Link',
      nodes: [
        {
          id: 'client-1',
          type: 'device',
          position: { x: 0, y: 0 },
          data: { kind: 'client', label: 'Client 1' } satisfies DeviceData
        },
        {
          id: 'app-1',
          type: 'device',
          position: { x: 200, y: 0 },
          data: { kind: 'appServer', label: 'App 1' } satisfies DeviceData
        }
      ],
      edges: [
        {
          id: 'cable-1',
          source: 'client-1',
          target: 'app-1',
          sourceHandle: 'top',
          targetHandle: 'bottom',
          type: 'cable',
          data: { label: '', flow: 0 }
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    })

    const doc = parseProject(raw)
    expect(doc.edges[0].sourceHandle).toBe('top')
    expect(doc.edges[0].targetHandle).toBe('bottom')
  })

  it('defaults missing cable labels to empty string', () => {
    const doc = parseProject(
      JSON.stringify({
        version: 1,
        name: 'x',
        nodes: [
          {
            id: 'client-1',
            type: 'device',
            position: { x: 0, y: 0 },
            data: { kind: 'client', label: 'Client 1' }
          },
          {
            id: 'app-1',
            type: 'device',
            position: { x: 120, y: 0 },
            data: { kind: 'appServer', label: 'App 1' }
          }
        ],
        edges: [{ id: 'cable-1', source: 'client-1', target: 'app-1' }]
      })
    )
    expect(doc.edges[0].type).toBe('cable')
    expect(doc.edges[0].data?.label).toBe('')
  })

  it('rejects unknown versions and kinds', () => {
    expect(() => parseProject('{"version":2,"name":"x","nodes":[],"edges":[]}')).toThrow(/version/i)
    expect(() =>
      parseProject(
        JSON.stringify({
          version: 1,
          name: 'x',
          nodes: [{ id: 'n', data: { kind: 'router' } }],
          edges: []
        })
      )
    ).toThrow(/unknown device/i)
  })

  it('round-trips group cards and child parent ids', () => {
    const raw = serializeProject({
      name: 'Supabase',
      nodes: [
        {
          id: 'group-1',
          type: 'group',
          position: { x: 10, y: 20 },
          width: 280,
          height: 220,
          style: { width: 280, height: 220 },
          data: { kind: 'group', label: 'Supabase', notes: 'DB + API' }
        },
        {
          id: 'database-1',
          type: 'device',
          parentId: 'group-1',
          position: { x: 24, y: 88 },
          data: { kind: 'database', label: 'Database 1' }
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    })

    const doc = parseProject(raw)
    const group = doc.nodes.find((node) => node.id === 'group-1')
    const database = doc.nodes.find((node) => node.id === 'database-1')
    expect(group?.type).toBe('group')
    expect(group?.data).toEqual({ kind: 'group', label: 'Supabase', notes: 'DB + API' })
    expect(database?.parentId).toBe('group-1')
    expect(database?.data).toMatchObject({ kind: 'database', label: 'Database 1' })
  })

  it('round-trips database interiors with ERD entities', () => {
    const raw = serializeProject({
      name: 'Nested database',
      nodes: [
        {
          id: 'database-1',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            kind: 'database',
            label: 'PostgreSQL',
            interiors: {
              activeMode: 'erd',
              umlDiagramType: 'class',
              modes: {
                erd: {
                  nodes: [
                    {
                      id: 'entity-1',
                      type: 'entity',
                      position: { x: 10, y: 20 },
                      data: {
                        kind: 'entity',
                        label: 'Booking',
                        attributes: [
                          { id: 'attr-1', name: 'id', type: 'uuid', pk: true, fk: false }
                        ]
                      }
                    }
                  ],
                  edges: [],
                  viewport: { x: 4, y: 8, zoom: 1.25 }
                },
                uml: {
                  nodes: [],
                  edges: [],
                  viewport: { x: 0, y: 0, zoom: 1 }
                },
                object: {
                  nodes: [],
                  edges: [],
                  viewport: { x: 0, y: 0, zoom: 1 }
                }
              }
            }
          } satisfies DeviceData
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    })

    const doc = parseProject(raw)
    const db = doc.nodes[0]
    expect(db.data.kind).toBe('database')
    if (db.data.kind === 'database') {
      expect(db.data.interiors?.activeMode).toBe('erd')
      expect(db.data.interiors?.umlDiagramType).toBe('class')
      expect(db.data.interiors?.modes.erd.nodes[0].data).toMatchObject({
        kind: 'entity',
        label: 'Booking'
      })
      expect(db.data.interiors?.modes.uml.nodes[0].data).toMatchObject({
        kind: 'entity',
        label: 'Booking'
      })
      expect(db.data.interiors?.modes.object.nodes[0].data).toMatchObject({
        kind: 'entity',
        label: 'Booking'
      })
    }
  })

  it('round-trips UML methods, visibility, and relation kinds', () => {
    const raw = serializeProject({
      name: 'UML classes',
      nodes: [
        {
          id: 'database-1',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            kind: 'database',
            label: 'PostgreSQL',
            interiors: {
              activeMode: 'uml',
              umlDiagramType: 'class',
              modes: {
                erd: {
                  nodes: [
                    {
                      id: 'entity-1',
                      type: 'entity',
                      position: { x: 10, y: 20 },
                      data: {
                        kind: 'entity',
                        label: 'Animal',
                        attributes: [
                          {
                            id: 'attr-1',
                            name: 'age',
                            type: 'Int',
                            pk: false,
                            fk: false,
                            visibility: 'public'
                          }
                        ],
                        methods: [
                          {
                            id: 'method-1',
                            name: 'mate',
                            visibility: 'public',
                            params: '',
                            returnType: 'void'
                          }
                        ]
                      }
                    },
                    {
                      id: 'entity-2',
                      type: 'entity',
                      position: { x: 200, y: 20 },
                      data: {
                        kind: 'entity',
                        label: 'Dog',
                        attributes: [],
                        methods: []
                      }
                    }
                  ],
                  edges: [
                    {
                      id: 'cable-1',
                      source: 'entity-2',
                      target: 'entity-1',
                      type: 'cable',
                      data: { flow: 0, label: '', relationKind: 'inheritance' }
                    }
                  ],
                  viewport: { x: 0, y: 0, zoom: 1 }
                },
                uml: {
                  nodes: [],
                  edges: [],
                  viewport: { x: 0, y: 0, zoom: 1 }
                },
                object: {
                  nodes: [],
                  edges: [],
                  viewport: { x: 0, y: 0, zoom: 1 }
                }
              }
            }
          } satisfies DeviceData
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    })

    const doc = parseProject(raw)
    const db = doc.nodes[0]
    expect(db.data.kind).toBe('database')
    if (db.data.kind === 'database') {
      const entity = db.data.interiors?.modes.uml.nodes[0]
      expect(entity?.data).toMatchObject({
        kind: 'entity',
        label: 'Animal',
        attributes: [{ name: 'age', visibility: 'public' }],
        methods: [{ name: 'mate', visibility: 'public', returnType: 'void' }]
      })
      expect(db.data.interiors?.modes.uml.edges[0].data).toMatchObject({
        relationKind: 'inheritance'
      })
    }
  })

  it('round-trips object diagram instance data and syncs it with ERD/UML', () => {
    const raw = serializeProject({
      name: 'Object diagram',
      nodes: [
        {
          id: 'database-1',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            kind: 'database',
            label: 'PostgreSQL',
            interiors: {
              activeMode: 'object',
              umlDiagramType: 'class',
              modes: {
                erd: {
                  nodes: [
                    {
                      id: 'entity-1',
                      type: 'entity',
                      position: { x: 10, y: 20 },
                      data: {
                        kind: 'entity',
                        label: 'Booking',
                        attributes: [
                          { id: 'attr-1', name: 'id', type: 'uuid', pk: true, fk: false }
                        ],
                        objectLabel: 'booking1',
                        objectValues: { 'attr-1': '9f1c' }
                      }
                    }
                  ],
                  edges: [],
                  viewport: { x: 0, y: 0, zoom: 1 }
                },
                uml: {
                  nodes: [],
                  edges: [],
                  viewport: { x: 0, y: 0, zoom: 1 }
                },
                object: {
                  nodes: [],
                  edges: [],
                  viewport: { x: 2, y: 3, zoom: 1.1 }
                }
              }
            }
          } satisfies DeviceData
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    })

    const doc = parseProject(raw)
    const db = doc.nodes[0]
    expect(db.data.kind).toBe('database')
    if (db.data.kind === 'database') {
      expect(db.data.interiors?.activeMode).toBe('object')
      expect(db.data.interiors?.modes.object.viewport).toEqual({ x: 2, y: 3, zoom: 1.1 })
      for (const mode of ['erd', 'uml', 'object'] as const) {
        expect(db.data.interiors?.modes[mode].nodes[0].data).toMatchObject({
          kind: 'entity',
          label: 'Booking',
          objectLabel: 'booking1',
          objectValues: { 'attr-1': '9f1c' }
        })
      }
    }
  })

  it('defaults a missing object mode to an empty synced subgraph for older projects', () => {
    const doc = parseProject(
      JSON.stringify({
        version: 1,
        name: 'Pre-object-diagram project',
        nodes: [
          {
            id: 'database-1',
            type: 'device',
            position: { x: 0, y: 0 },
            data: {
              kind: 'database',
              label: 'PostgreSQL',
              interiors: {
                activeMode: 'erd',
                modes: {
                  erd: {
                    nodes: [
                      {
                        id: 'entity-1',
                        type: 'entity',
                        position: { x: 10, y: 20 },
                        data: { kind: 'entity', label: 'Trip', attributes: [] }
                      }
                    ],
                    edges: [],
                    viewport: { x: 0, y: 0, zoom: 1 }
                  },
                  uml: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
                }
              }
            }
          }
        ],
        edges: []
      })
    )

    const db = doc.nodes[0]
    expect(db.data.kind).toBe('database')
    if (db.data.kind === 'database') {
      expect(db.data.interiors?.modes.object.nodes[0].data).toMatchObject({
        kind: 'entity',
        label: 'Trip'
      })
    }
  })

  it('migrates legacy subgraph into uml mode', () => {
    const doc = parseProject(
      JSON.stringify({
        version: 1,
        name: 'Legacy',
        nodes: [
          {
            id: 'database-1',
            type: 'device',
            position: { x: 0, y: 0 },
            data: {
              kind: 'database',
              label: 'PostgreSQL',
              subgraph: {
                nodes: [],
                edges: [],
                viewport: { x: 4, y: 8, zoom: 1.25 }
              }
            }
          }
        ],
        edges: []
      })
    )

    const db = doc.nodes[0]
    expect(db.data.kind).toBe('database')
    if (db.data.kind === 'database') {
      expect(db.data.interiors).toMatchObject({
        activeMode: 'uml',
        umlDiagramType: 'class',
        modes: {
          uml: {
            nodes: [],
            edges: [],
            viewport: { x: 4, y: 8, zoom: 1.25 }
          }
        }
      })
    }
  })

  it('migrates physical mode interiors to uml', () => {
    const doc = parseProject(
      JSON.stringify({
        version: 1,
        name: 'Physical legacy',
        nodes: [
          {
            id: 'database-1',
            type: 'device',
            position: { x: 0, y: 0 },
            data: {
              kind: 'database',
              label: 'PostgreSQL',
              interiors: {
                activeMode: 'physical',
                modes: {
                  erd: {
                    nodes: [
                      {
                        id: 'entity-1',
                        type: 'entity',
                        position: { x: 10, y: 20 },
                        data: {
                          kind: 'entity',
                          label: 'Trip',
                          attributes: []
                        }
                      }
                    ],
                    edges: [],
                    viewport: { x: 0, y: 0, zoom: 1 }
                  },
                  physical: {
                    nodes: [],
                    edges: [],
                    viewport: { x: 1, y: 2, zoom: 1.5 }
                  }
                }
              }
            }
          }
        ],
        edges: []
      })
    )

    const db = doc.nodes[0]
    expect(db.data.kind).toBe('database')
    if (db.data.kind === 'database') {
      expect(db.data.interiors?.activeMode).toBe('uml')
      expect(db.data.interiors?.modes.uml.viewport).toEqual({ x: 1, y: 2, zoom: 1.5 })
      expect(db.data.interiors?.modes.uml.nodes[0].data).toMatchObject({
        kind: 'entity',
        label: 'Trip'
      })
      expect(db.data.interiors?.modes.erd.nodes[0].data).toMatchObject({
        kind: 'entity',
        label: 'Trip'
      })
    }
  })

  it('drops dangling parent ids', () => {
    const doc = parseProject(
      JSON.stringify({
        version: 1,
        name: 'x',
        nodes: [
          {
            id: 'database-1',
            type: 'device',
            parentId: 'missing-group',
            position: { x: 0, y: 0 },
            data: { kind: 'database', label: 'Database 1' }
          }
        ],
        edges: []
      })
    )
    expect(doc.nodes[0].parentId).toBeUndefined()
  })

  it('opens an old API gateway and drops rate-limit fields', () => {
    const doc = parseProject(
      JSON.stringify({
        version: 1,
        name: 'Gateway',
        nodes: [
          {
            id: 'gw-1',
            type: 'device',
            position: { x: 0, y: 0 },
            data: {
              kind: 'apiGateway',
              label: 'API Gateway 1',
              instances: 2,
              serviceRate: 8000,
              rateLimit: 250,
              rateLimitAlgorithm: 'leakyBucket'
            }
          }
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      })
    )

    expect(doc.nodes[0].data).toEqual({
      kind: 'apiGateway',
      label: 'API Gateway 1'
    })
  })

  it('round-trips app server API interiors with apiTable nodes', () => {
    const raw = serializeProject({
      name: 'API design',
      nodes: [
        {
          id: 'appServer-1',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            kind: 'appServer',
            label: 'Laravel API',
            appInteriors: {
              activeMode: 'api',
              modes: {
                api: {
                  nodes: [
                    {
                      id: 'apiTable-1',
                      type: 'apiTable',
                      position: { x: 10, y: 20 },
                      data: {
                        kind: 'apiTable',
                        label: 'Get Bookings',
                        sourceDatabaseId: 'database-1',
                        sourceEntityId: 'entity-1',
                        attributes: [
                          { id: 'attr-1', name: 'id', type: 'uuid', pk: true, fk: false, fromSource: true },
                          { id: 'attr-2', name: 'email', type: 'text', pk: false, fk: false, fromSource: false }
                        ]
                      }
                    }
                  ],
                  edges: [],
                  viewport: { x: 4, y: 8, zoom: 1.25 }
                },
                useCase: {
                  nodes: [],
                  edges: [],
                  viewport: { x: 0, y: 0, zoom: 1 }
                }
              }
            }
          } satisfies DeviceData
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    })

    const doc = parseProject(raw)
    const appServer = doc.nodes[0]
    expect(appServer.data.kind).toBe('appServer')
    if (appServer.data.kind === 'appServer') {
      expect(appServer.data.appInteriors?.activeMode).toBe('api')
      const apiNode = appServer.data.appInteriors?.modes.api.nodes[0]
      expect(apiNode?.data).toMatchObject({
        kind: 'apiTable',
        label: 'Get Bookings',
        sourceDatabaseId: 'database-1',
        sourceEntityId: 'entity-1',
        attributes: [
          { id: 'attr-1', name: 'id', type: 'uuid', pk: true, fk: false, fromSource: true },
          { id: 'attr-2', name: 'email', type: 'text', pk: false, fk: false, fromSource: false }
        ]
      })
    }
  })

  it('round-trips apiTable apiType and omits rest from serialized output', () => {
    const raw = serializeProject({
      name: 'API types',
      nodes: [
        {
          id: 'appServer-1',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            kind: 'appServer',
            label: 'API Server',
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
                        label: 'REST API',
                        apiType: 'rest',
                        attributes: []
                      }
                    },
                    {
                      id: 'apiTable-2',
                      type: 'apiTable',
                      position: { x: 100, y: 0 },
                      data: {
                        kind: 'apiTable',
                        label: 'Graph API',
                        apiType: 'graphql',
                        attributes: []
                      }
                    }
                  ],
                  edges: [],
                  viewport: { x: 0, y: 0, zoom: 1 }
                },
                useCase: {
                  nodes: [],
                  edges: [],
                  viewport: { x: 0, y: 0, zoom: 1 }
                }
              }
            }
          } satisfies DeviceData
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    })

    expect(raw).not.toContain('"apiType": "rest"')
    expect(raw).toContain('"apiType": "graphql"')

    const doc = parseProject(raw)
    const appServer = doc.nodes[0]
    if (appServer.data.kind === 'appServer') {
      const nodes = appServer.data.appInteriors?.modes.api.nodes ?? []
      expect(nodes[0]?.data).toMatchObject({ kind: 'apiTable', label: 'REST API' })
      expect(nodes[0]?.data).not.toHaveProperty('apiType')
      expect(nodes[1]?.data).toMatchObject({ kind: 'apiTable', label: 'Graph API', apiType: 'graphql' })
    }
  })

  it('round-trips apiConfig parameters and omits default rest config', () => {
    const raw = serializeProject({
      name: 'API config',
      nodes: [
        {
          id: 'appServer-1',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            kind: 'appServer',
            label: 'API Server',
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
                        label: 'REST API',
                        apiType: 'rest',
                        apiConfig: { rest: { method: 'GET', path: '/', parameters: [] } },
                        attributes: []
                      }
                    },
                    {
                      id: 'apiTable-2',
                      type: 'apiTable',
                      position: { x: 100, y: 0 },
                      data: {
                        kind: 'apiTable',
                        label: 'Users',
                        apiType: 'rest',
                        apiConfig: {
                          rest: {
                            method: 'GET',
                            path: '/users/{id}',
                            parameters: [
                              { id: 'p1', name: 'id', type: 'uuid', required: true, in: 'path' }
                            ]
                          }
                        },
                        attributes: []
                      }
                    },
                    {
                      id: 'apiTable-3',
                      type: 'apiTable',
                      position: { x: 200, y: 0 },
                      data: {
                        kind: 'apiTable',
                        label: 'Notify',
                        apiType: 'webhook',
                        apiConfig: {
                          webhook: {
                            method: 'POST',
                            path: '/hooks/payment',
                            eventType: 'payment.completed',
                            parameters: [{ id: 'p2', name: 'orderId', type: 'string', required: true }]
                          }
                        },
                        attributes: []
                      }
                    }
                  ],
                  edges: [],
                  viewport: { x: 0, y: 0, zoom: 1 }
                },
                useCase: {
                  nodes: [],
                  edges: [],
                  viewport: { x: 0, y: 0, zoom: 1 }
                }
              }
            }
          } satisfies DeviceData
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    })

    expect(raw).not.toContain('"apiType": "rest"')
    expect(raw).toContain('"apiType": "webhook"')
    expect(raw).not.toMatch(/"rest": \{\s*"method": "GET",\s*"path": "\/"/)
    expect(raw).toContain('"/users/{id}"')
    expect(raw).toContain('"orderId"')

    const doc = parseProject(raw)
    const appServer = doc.nodes[0]
    if (appServer.data.kind === 'appServer') {
      const nodes = appServer.data.appInteriors?.modes.api.nodes ?? []
      expect(nodes[0]?.data).not.toHaveProperty('apiConfig')
      expect(nodes[1]?.data).toMatchObject({
        apiConfig: {
          rest: {
            method: 'GET',
            path: '/users/{id}',
            parameters: [{ id: 'p1', name: 'id', type: 'uuid', required: true, in: 'path' }]
          }
        }
      })
      expect(nodes[2]?.data).toMatchObject({
        apiType: 'webhook',
        apiConfig: {
          webhook: {
            method: 'POST',
            path: '/hooks/payment',
            eventType: 'payment.completed'
          }
        }
      })
    }
  })

  it('opens an old load balancer and drops its algorithm field', () => {
    const doc = parseProject(
      JSON.stringify({
        version: 1,
        name: 'x',
        nodes: [
          {
            id: 'lb-1',
            type: 'device',
            position: { x: 0, y: 0 },
            data: { kind: 'loadBalancer', label: 'Load Balancer 1', lbAlgorithm: 'weighted' }
          }
        ],
        edges: []
      })
    )
    expect(doc.nodes[0].data).toEqual({
      kind: 'loadBalancer',
      label: 'Load Balancer 1'
    })
  })

  it('round-trips client request interiors with apiCall nodes', () => {
    const raw = serializeProject({
      name: 'Client calls',
      nodes: [
        {
          id: 'client-1',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            kind: 'client',
            label: 'Web Client',
            clientInteriors: {
              activeMode: 'requests',
              modes: {
                requests: {
                  nodes: [
                    {
                      id: 'apiCall-1',
                      type: 'apiCall',
                      position: { x: 12, y: 24 },
                      data: {
                        kind: 'apiCall',
                        label: 'Load users',
                        sourceAppServerId: 'appServer-2',
                        sourceApiTableId: 'apiTable-6',
                        paramValues: {
                          'param-authorization': 'Bearer token'
                        }
                      }
                    }
                  ],
                  edges: [],
                  viewport: { x: 1, y: 2, zoom: 1.5 }
                }
              }
            }
          } satisfies DeviceData
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    })

    const doc = parseProject(raw)
    const client = doc.nodes[0]
    expect(client.data.kind).toBe('client')
    if (client.data.kind === 'client') {
      expect(client.data.clientInteriors?.activeMode).toBe('requests')
      const call = client.data.clientInteriors?.modes.requests.nodes[0]
      expect(call?.data).toMatchObject({
        kind: 'apiCall',
        label: 'Load users',
        sourceAppServerId: 'appServer-2',
        sourceApiTableId: 'apiTable-6',
        paramValues: {
          'param-authorization': 'Bearer token'
        }
      })
    }
  })

  it('round-trips an app server use case diagram', () => {
    const raw = serializeProject({
      name: 'Use cases',
      nodes: [
        {
          id: 'appServer-1',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            kind: 'appServer',
            label: 'Orders',
            appInteriors: {
              activeMode: 'useCase',
              modes: {
                api: {
                  nodes: [
                    {
                      id: 'apiTable-1',
                      type: 'apiTable',
                      position: { x: 0, y: 0 },
                      data: { kind: 'apiTable', label: 'Create order', attributes: [] }
                    }
                  ],
                  edges: [],
                  viewport: { x: 0, y: 0, zoom: 1 }
                },
                useCase: {
                  nodes: [
                    {
                      id: 'actor-1',
                      type: 'actor',
                      position: { x: 10, y: 10 },
                      data: { kind: 'actor', label: 'Customer' }
                    },
                    {
                      id: 'useCase-1',
                      type: 'useCase',
                      position: { x: 80, y: 10 },
                      data: { kind: 'useCase', label: 'Place order', apiTableIds: ['apiTable-1'] }
                    },
                    {
                      id: 'useCase-2',
                      type: 'useCase',
                      position: { x: 80, y: 120 },
                      data: { kind: 'useCase', label: 'Pay', apiTableIds: [] }
                    }
                  ],
                  edges: [
                    {
                      id: 'cable-1',
                      source: 'useCase-1',
                      target: 'useCase-2',
                      type: 'cable',
                      data: { flow: 0, label: '', useCaseRelation: 'include' }
                    }
                  ],
                  viewport: { x: 1, y: 2, zoom: 1 }
                }
              }
            }
          } satisfies DeviceData
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    })

    const doc = parseProject(raw)
    const appServer = doc.nodes[0]
    expect(appServer.data.kind).toBe('appServer')
    if (appServer.data.kind !== 'appServer') return
    expect(appServer.data.appInteriors?.activeMode).toBe('useCase')
    expect(appServer.data.appInteriors?.modes.useCase.nodes.map((node) => node.data)).toMatchObject([
      { kind: 'actor', label: 'Customer' },
      { kind: 'useCase', label: 'Place order', apiTableIds: ['apiTable-1'] },
      { kind: 'useCase', label: 'Pay', apiTableIds: [] }
    ])
    expect(appServer.data.appInteriors?.modes.useCase.edges[0]?.data).toMatchObject({
      useCaseRelation: 'include'
    })
  })

  it('loads a stored database useCase diagram type as a class diagram', () => {
    const doc = parseProject(
      JSON.stringify({
        version: 1,
        name: 'Legacy UML',
        nodes: [
          {
            id: 'database-1',
            type: 'device',
            position: { x: 0, y: 0 },
            data: {
              kind: 'database',
              label: 'DB',
              interiors: {
                activeMode: 'uml',
                umlDiagramType: 'useCase',
                modes: {
                  erd: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
                  uml: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
                }
              }
            }
          }
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      })
    )
    const database = doc.nodes[0]
    expect(database.data.kind).toBe('database')
    if (database.data.kind === 'database') {
      expect(database.data.interiors?.umlDiagramType).toBe('class')
    }
  })

  it('round-trips sequence and activity diagrams and fills them in for older app servers', () => {
    const raw = serializeProject({
      name: 'Behavior',
      nodes: [
        {
          id: 'appServer-1',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            kind: 'appServer',
            label: 'Orders',
            appInteriors: {
              activeMode: 'sequence',
              modes: {
                api: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
                useCase: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
              },
              activeSequenceId: 'sequence-1',
              sequenceDiagrams: [
                {
                  id: 'sequence-1',
                  subject: { kind: 'api', id: 'apiTable-1' },
                  nodes: [
                    {
                      id: 'lifeline-1',
                      type: 'behavior',
                      position: { x: 40, y: 48 },
                      data: { kind: 'lifeline', label: 'Orders', participant: 'appServer', refId: 'appServer-1' }
                    }
                  ],
                  edges: [
                    {
                      id: 'cable-1',
                      source: 'lifeline-1',
                      target: 'lifeline-1',
                      data: {
                        flow: 0,
                        label: 'save',
                        sequenceMessage: { order: 1, messageKind: 'sync', apiTableId: 'apiTable-1' }
                      }
                    }
                  ],
                  viewport: { x: 0, y: 0, zoom: 1 }
                }
              ],
              activeActivityId: 'activity-1',
              activityDiagrams: [
                {
                  id: 'activity-1',
                  subject: { kind: 'useCase', id: 'useCase-1' },
                  nodes: [
                    {
                      id: 'behavior-1',
                      type: 'behavior',
                      position: { x: 48, y: 80 },
                      data: { kind: 'action', label: 'Place order', apiTableId: 'apiTable-1' }
                    }
                  ],
                  edges: [
                    {
                      id: 'cable-2',
                      source: 'behavior-1',
                      target: 'behavior-1',
                      data: { flow: 0, label: '', guard: 'paid' }
                    }
                  ],
                  viewport: { x: 0, y: 0, zoom: 1 }
                }
              ]
            }
          } satisfies DeviceData
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    })

    const doc = parseProject(raw)
    const appServer = doc.nodes[0]
    expect(appServer.data.kind).toBe('appServer')
    if (appServer.data.kind !== 'appServer') return
    const interiors = appServer.data.appInteriors
    expect(interiors?.activeMode).toBe('sequence')
    expect(interiors?.sequenceDiagrams?.[0]?.nodes[0]?.data).toMatchObject({
      kind: 'lifeline',
      participant: 'appServer',
      refId: 'appServer-1'
    })
    expect(interiors?.sequenceDiagrams?.[0]?.edges[0]?.data?.sequenceMessage).toMatchObject({
      order: 1,
      messageKind: 'sync',
      apiTableId: 'apiTable-1'
    })
    expect(interiors?.activityDiagrams?.[0]?.nodes[0]?.data).toMatchObject({
      kind: 'action',
      label: 'Place order',
      apiTableId: 'apiTable-1'
    })
    expect(interiors?.activityDiagrams?.[0]?.edges[0]?.data?.guard).toBe('paid')

    const legacy = parseProject(
      JSON.stringify({
        version: 1,
        name: 'Old server',
        nodes: [
          {
            id: 'appServer-9',
            type: 'device',
            position: { x: 0, y: 0 },
            data: {
              kind: 'appServer',
              label: 'Legacy',
              appInteriors: {
                activeMode: 'api',
                modes: {
                  api: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
                  useCase: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
                }
              }
            }
          }
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      })
    )
    const legacyServer = legacy.nodes[0]
    expect(legacyServer.data.kind).toBe('appServer')
    if (legacyServer.data.kind === 'appServer') {
      expect(legacyServer.data.appInteriors?.sequenceDiagrams).toEqual([])
      expect(legacyServer.data.appInteriors?.activityDiagrams).toEqual([])
      expect(legacyServer.data.appInteriors?.activeSequenceId).toBeNull()
      expect(legacyServer.data.appInteriors?.activeActivityId).toBeNull()
    }
  })
})
