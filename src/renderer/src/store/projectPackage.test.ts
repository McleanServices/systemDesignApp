import { describe, expect, it } from 'vitest'
import { parseProject, serializeProject } from './schema'
import {
  mergeProjectPackage,
  splitProjectPackage,
  stringifyPackageFile
} from './projectPackage'
import type { DeviceData } from './types'

describe('sdlab project packages', () => {
  it('splits device details into LLD files and keeps topology in HLD', () => {
    const packed = splitProjectPackage({
      name: 'Ferry',
      nodes: [
        {
          id: 'group-1',
          type: 'group',
          position: { x: 0, y: 0 },
          width: 200,
          height: 160,
          data: { kind: 'group', label: 'Backend', notes: 'API tier' }
        },
        {
          id: 'database-1',
          type: 'device',
          parentId: 'group-1',
          position: { x: 20, y: 40 },
          selected: true,
          data: {
            kind: 'database',
            label: 'PostgreSQL',
            interiors: {
              activeMode: 'erd',
              umlDiagramType: 'class',
              modes: {
                erd: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
                uml: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
                object: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
              }
            }
          } satisfies DeviceData
        }
      ],
      edges: [],
      viewport: { x: 1, y: 2, zoom: 1.5 }
    })

    expect(packed.manifest.format).toBe('sdlab-package')
    expect(packed.manifest.hld).toBe('hld.sdlab.json')
    expect(packed.manifest.lld['database-1']).toBe('lld/database-1.sdlab.json')
    expect(packed.hld.nodes).toHaveLength(2)

    const hldDb = packed.hld.nodes.find((node) => node.id === 'database-1')
    expect(hldDb?.data).toEqual({ kind: 'database', label: 'PostgreSQL' })
    expect(hldDb?.lld).toBe('lld/database-1.sdlab.json')
    expect(hldDb?.parentId).toBe('group-1')
    expect(hldDb).not.toHaveProperty('selected')

    const lld = packed.lldFiles['lld/database-1.sdlab.json']
    expect(lld.nodeId).toBe('database-1')
    expect(lld.data).toMatchObject({
      interiors: { activeMode: 'erd' }
    })
    expect(lld.data).not.toHaveProperty('kind')
    expect(lld.data).not.toHaveProperty('label')

    const group = packed.hld.nodes.find((node) => node.id === 'group-1')
    expect(group?.data).toEqual({ kind: 'group', label: 'Backend', notes: 'API tier' })
    expect(group).not.toHaveProperty('lld')
  })

  it('round-trips a package through merge', () => {
    const raw = serializeProject({
      name: 'Round trip',
      nodes: [
        {
          id: 'client-1',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            kind: 'client',
            label: 'Client 1'
          } satisfies DeviceData
        },
        {
          id: 'appServer-1',
          type: 'device',
          position: { x: 200, y: 0 },
          data: {
            kind: 'appServer',
            label: 'App',
            appInteriors: {
              activeMode: 'api',
              modes: {
                api: {
                  nodes: [
                    {
                      id: 'apiTable-1',
                      type: 'apiTable',
                      position: { x: 10, y: 10 },
                      data: {
                        kind: 'apiTable',
                        label: 'Users',
                        attributes: [
                          { id: 'attr-1', name: 'id', type: 'uuid', pk: true, fk: false }
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
          } satisfies DeviceData
        }
      ],
      edges: [
        {
          id: 'cable-1',
          source: 'client-1',
          target: 'appServer-1',
          type: 'cable',
          data: { label: 'HTTPS', flow: 10 }
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    })

    const doc = parseProject(raw)
    const packed = splitProjectPackage(doc)
    const merged = mergeProjectPackage({
      manifest: packed.manifest,
      hld: packed.hld,
      lldFiles: packed.lldFiles
    })

    expect(merged.name).toBe('Round trip')
    expect(merged.edges[0].data?.label).toBe('HTTPS')
    expect(merged.nodes).toHaveLength(2)

    const app = merged.nodes.find((node) => node.id === 'appServer-1')
    expect(app?.data).toMatchObject({
      kind: 'appServer',
      label: 'App'
    })
    if (app?.data.kind === 'appServer') {
      expect(app.data.appInteriors?.modes.api.nodes[0]?.data).toMatchObject({
        kind: 'apiTable',
        label: 'Users'
      })
    }
  })

  it('stringifies package files with trailing newline', () => {
    expect(stringifyPackageFile({ a: 1 })).toBe('{\n  "a": 1\n}\n')
  })
})
