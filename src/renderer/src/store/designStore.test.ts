import { beforeEach, describe, expect, it } from 'vitest'
import { useDesignStore } from './designStore'
import {
  diffApiAttributes,
  findReachableAppServers,
  findReachableDatabases,
  hasApiCallSyncIssues,
  resolveApiAttributes
} from './graphQueries'
import { isDeviceNode } from './types'

describe('designStore editor interactions', () => {
  beforeEach(() => {
    useDesignStore.getState().newDesign()
  })

  it('switches tools and clears placement/connect state', () => {
    useDesignStore.getState().setPendingKind('client')
    useDesignStore.getState().setTool('connect')
    useDesignStore.getState().handleNodeClick('unused')

    useDesignStore.getState().setTool('delete')

    expect(useDesignStore.getState().tool).toBe('delete')
    expect(useDesignStore.getState().pendingKind).toBeNull()
    expect(useDesignStore.getState().connectSourceId).toBeNull()
  })

  it('hand tool pans without selecting or connecting devices', () => {
    useDesignStore.getState().addDevice('client', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('appServer', { x: 160, y: 0 }, { keepArmed: false })
    const [client, app] = useDesignStore.getState().nodes
    useDesignStore.getState().setSelected(client.id)
    useDesignStore.getState().setTool('pan')

    useDesignStore.getState().handleNodeClick(app.id)
    useDesignStore.getState().handleEdgeClick('missing-edge')
    useDesignStore.getState().syncSelection([app.id], [])

    const state = useDesignStore.getState()
    expect(state.tool).toBe('pan')
    expect(state.pendingKind).toBeNull()
    expect(state.connectSourceId).toBeNull()
    expect(state.selectedId).toBe(client.id)
    expect(state.edges).toHaveLength(0)
  })

  it('keeps a palette device armed after click-to-place', () => {
    useDesignStore.getState().setPendingKind('client')
    useDesignStore.getState().addDevice('client', { x: 10, y: 20 }, { keepArmed: true })

    const state = useDesignStore.getState()
    expect(state.nodes).toHaveLength(1)
    expect(state.pendingKind).toBe('client')
    expect(state.tool).toBe('select')
    expect(state.selectedId).toBeNull()
  })

  it('drills into a database and restores its interior on exit', () => {
    useDesignStore.getState().addDevice('database', { x: 40, y: 40 }, { keepArmed: false })
    const database = useDesignStore.getState().nodes[0]

    useDesignStore.getState().enterDatabase(database.id)
    expect(useDesignStore.getState().drillPath).toEqual([database.id])
    expect(useDesignStore.getState().nodes).toHaveLength(0)

    useDesignStore.getState().exitDrill()
    const state = useDesignStore.getState()
    expect(state.drillPath).toEqual([])
    const db = state.nodes[0]
    expect(isDeviceNode(db)).toBe(true)
    if (isDeviceNode(db)) {
      expect(db.data.interiors?.modes.uml).toMatchObject({ nodes: [], edges: [] })
    }
  })

  it('syncs ERD entities into the UML class diagram when switching modes', () => {
    useDesignStore.getState().addDevice('database', { x: 40, y: 40 }, { keepArmed: false })
    const database = useDesignStore.getState().nodes[0]

    useDesignStore.getState().enterDatabase(database.id)
    useDesignStore.getState().setInteriorMode('erd')
    useDesignStore.getState().addEntity({ x: 20, y: 20 }, { keepArmed: false })
    useDesignStore.getState().setInteriorMode('uml')
    expect(useDesignStore.getState().nodes).toHaveLength(1)
    expect(useDesignStore.getState().nodes[0].data.kind).toBe('entity')
    expect(useDesignStore.getState().umlDiagramType).toBe('class')

    useDesignStore.getState().updateEntity(useDesignStore.getState().nodes[0].id, {
      label: 'Booking'
    })
    useDesignStore.getState().setInteriorMode('erd')
    expect(useDesignStore.getState().nodes[0].data).toMatchObject({
      kind: 'entity',
      label: 'Booking'
    })

    useDesignStore.getState().exitDrill()
    const savedDb = useDesignStore.getState().nodes[0]
    expect(isDeviceNode(savedDb)).toBe(true)
    if (isDeviceNode(savedDb)) {
      expect(savedDb.data.interiors?.modes.erd.nodes).toHaveLength(1)
      expect(savedDb.data.interiors?.modes.uml.nodes).toHaveLength(1)
      expect(savedDb.data.interiors?.modes.uml.nodes[0].data).toMatchObject({
        kind: 'entity',
        label: 'Booking'
      })
    }
  })

  it('syncs ERD/UML entities into the Object diagram and back', () => {
    useDesignStore.getState().addDevice('database', { x: 40, y: 40 }, { keepArmed: false })
    const database = useDesignStore.getState().nodes[0]

    useDesignStore.getState().enterDatabase(database.id)
    useDesignStore.getState().setInteriorMode('erd')
    useDesignStore.getState().addEntity({ x: 20, y: 20 }, { keepArmed: false })
    useDesignStore.getState().updateEntity(useDesignStore.getState().nodes[0].id, { label: 'Booking' })

    useDesignStore.getState().setInteriorMode('object')
    expect(useDesignStore.getState().nodes).toHaveLength(1)
    expect(useDesignStore.getState().nodes[0].data).toMatchObject({
      kind: 'entity',
      label: 'Booking'
    })

    const objectEntity = useDesignStore.getState().nodes[0]
    useDesignStore.getState().updateEntity(objectEntity.id, {
      objectLabel: 'booking1',
      objectValues: { 'attr-1': '42' }
    })

    useDesignStore.getState().setInteriorMode('uml')
    expect(useDesignStore.getState().nodes[0].data).toMatchObject({
      kind: 'entity',
      label: 'Booking'
    })

    useDesignStore.getState().setInteriorMode('object')
    expect(useDesignStore.getState().nodes[0].data).toMatchObject({
      objectLabel: 'booking1',
      objectValues: { 'attr-1': '42' }
    })

    useDesignStore.getState().setInteriorMode('erd')
    useDesignStore.getState().addEntity({ x: 240, y: 20 }, { keepArmed: false })
    expect(useDesignStore.getState().nodes).toHaveLength(2)

    useDesignStore.getState().setInteriorMode('object')
    expect(useDesignStore.getState().nodes).toHaveLength(2)

    useDesignStore.getState().exitDrill()
    const savedDb = useDesignStore.getState().nodes[0]
    expect(isDeviceNode(savedDb)).toBe(true)
    if (isDeviceNode(savedDb)) {
      expect(savedDb.data.interiors?.modes.object.nodes).toHaveLength(2)
      expect(savedDb.data.interiors?.modes.object.nodes[0].data).toMatchObject({
        label: 'Booking',
        objectLabel: 'booking1',
        objectValues: { 'attr-1': '42' }
      })
      expect(savedDb.data.interiors?.modes.erd.nodes).toHaveLength(2)
      expect(savedDb.data.interiors?.modes.uml.nodes).toHaveLength(2)
    }
  })

  it('preserves UML methods across ERD/UML mode switches', () => {
    useDesignStore.getState().addDevice('database', { x: 40, y: 40 }, { keepArmed: false })
    const database = useDesignStore.getState().nodes[0]
    useDesignStore.getState().enterDatabase(database.id)
    useDesignStore.getState().setInteriorMode('uml')
    useDesignStore.getState().addEntity({ x: 20, y: 20 }, { keepArmed: false })
    const entity = useDesignStore.getState().nodes[0]

    useDesignStore.getState().updateEntity(entity.id, {
      label: 'Animal',
      attributes: [
        { id: 'attr-1', name: 'age', type: 'Int', pk: false, fk: false, visibility: 'public' }
      ],
      methods: [
        {
          id: 'method-1',
          name: 'isMammal',
          visibility: 'public',
          params: '',
          returnType: 'boolean'
        }
      ]
    })

    useDesignStore.getState().setInteriorMode('erd')
    expect(useDesignStore.getState().nodes[0].data).toMatchObject({
      kind: 'entity',
      label: 'Animal',
      attributes: [{ name: 'age', type: 'Int' }],
      methods: [{ name: 'isMammal', returnType: 'boolean' }]
    })

    useDesignStore.getState().setInteriorMode('uml')
    expect(useDesignStore.getState().nodes[0].data).toMatchObject({
      methods: [{ id: 'method-1', name: 'isMammal', visibility: 'public' }]
    })
  })

  it('stores inheritance relationKind when connecting in UML class mode', () => {
    useDesignStore.getState().addDevice('database', { x: 40, y: 40 }, { keepArmed: false })
    const database = useDesignStore.getState().nodes[0]
    useDesignStore.getState().enterDatabase(database.id)
    useDesignStore.getState().setInteriorMode('uml')
    useDesignStore.getState().addEntity({ x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addEntity({ x: 200, y: 0 }, { keepArmed: false })
    const [child, parent] = useDesignStore.getState().nodes

    useDesignStore.getState().setPendingRelationKind('inheritance')
    useDesignStore.getState().onConnect({
      source: child.id,
      target: parent.id,
      sourceHandle: 'bottom',
      targetHandle: 'top'
    })

    const edge = useDesignStore.getState().edges[0]
    expect(edge.data).toMatchObject({ relationKind: 'inheritance' })
    expect(useDesignStore.getState().pendingRelationKind).toBeNull()
    expect(useDesignStore.getState().tool).toBe('select')
  })

  it('updates entity attributes in ERD mode', () => {
    useDesignStore.getState().addDevice('database', { x: 40, y: 40 }, { keepArmed: false })
    const database = useDesignStore.getState().nodes[0]
    useDesignStore.getState().enterDatabase(database.id)
    useDesignStore.getState().setInteriorMode('erd')
    useDesignStore.getState().addEntity({ x: 20, y: 20 }, { keepArmed: false })
    const entity = useDesignStore.getState().nodes[0]

    useDesignStore.getState().updateEntity(entity.id, {
      label: 'Passenger',
      attributes: [{ id: 'attr-1', name: 'email', type: 'text', pk: false, fk: false }]
    })

    expect(useDesignStore.getState().nodes[0].data).toMatchObject({
      kind: 'entity',
      label: 'Passenger',
      attributes: [{ id: 'attr-1', name: 'email', type: 'text', pk: false, fk: false }]
    })
  })

  it('keeps existing ERD tables when adding another after reload', () => {
    useDesignStore.getState().addDevice('database', { x: 40, y: 40 }, { keepArmed: false })
    const database = useDesignStore.getState().nodes[0]
    useDesignStore.getState().enterDatabase(database.id)
    useDesignStore.getState().setInteriorMode('erd')
    useDesignStore.getState().addEntity({ x: 20, y: 20 }, { keepArmed: false })
    useDesignStore.getState().addEntity({ x: 240, y: 20 }, { keepArmed: false })
    const originalIds = useDesignStore.getState().nodes.map((node) => node.id)
    useDesignStore.getState().exitDrill()
    const json = useDesignStore.getState().toJson()

    useDesignStore.getState().newDesign()
    useDesignStore.getState().loadFromJson(json, null)

    const loaded = useDesignStore.getState().nodes[0]
    useDesignStore.getState().enterDatabase(loaded.id)
    useDesignStore.getState().setInteriorMode('erd')
    expect(useDesignStore.getState().nodes.map((node) => node.id)).toEqual(originalIds)

    useDesignStore.getState().addEntity({ x: 20, y: 160 }, { keepArmed: false })
    const ids = useDesignStore.getState().nodes.map((node) => node.id)
    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(3)
    expect(ids).toEqual(expect.arrayContaining(originalIds))
  })

  it('connects two devices with the connect tool', () => {
    useDesignStore.getState().addDevice('client', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('loadBalancer', { x: 160, y: 0 }, { keepArmed: false })
    const [source, target] = useDesignStore.getState().nodes

    useDesignStore.getState().setTool('connect')
    useDesignStore.getState().handleNodeClick(source.id)
    expect(useDesignStore.getState().connectSourceId).toBe(source.id)

    useDesignStore.getState().handleNodeClick(target.id)

    const state = useDesignStore.getState()
    expect(state.edges).toHaveLength(1)
    expect(state.edges[0].source).toBe(source.id)
    expect(state.edges[0].target).toBe(target.id)
    expect(state.edges[0].sourceHandle).toBe('right')
    expect(state.edges[0].targetHandle).toBe('left')
    expect(state.connectSourceId).toBeNull()
    expect(state.tool).toBe('connect')
    expect(state.selectedId).toBe(target.id)
  })

  it('disarms the palette cable after one connection', () => {
    useDesignStore.getState().addDevice('client', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('cache', { x: 160, y: 0 }, { keepArmed: false })
    const [source, target] = useDesignStore.getState().nodes

    useDesignStore.getState().setTool('connect', { once: true })
    useDesignStore.getState().handleNodeClick(source.id)
    useDesignStore.getState().handleNodeClick(target.id)

    const state = useDesignStore.getState()
    expect(state.edges).toHaveLength(1)
    expect(state.tool).toBe('select')
    expect(state.connectOnce).toBe(false)
    expect(state.selectedId).toBeNull()
    expect(state.selectedIds).toEqual([])
  })

  it('stores handle ids when connecting by drag', () => {
    useDesignStore.getState().addDevice('client', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('cache', { x: 160, y: 0 }, { keepArmed: false })
    const [source, target] = useDesignStore.getState().nodes

    useDesignStore.getState().onConnect({
      source: source.id,
      target: target.id,
      sourceHandle: 'top',
      targetHandle: 'bottom'
    })

    const edge = useDesignStore.getState().edges[0]
    expect(edge.sourceHandle).toBe('top')
    expect(edge.targetHandle).toBe('bottom')
  })

  it('reconnects a cable to a different device', () => {
    useDesignStore.getState().addDevice('client', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('cache', { x: 160, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('appServer', { x: 320, y: 0 }, { keepArmed: false })
    const [source, mid, dest] = useDesignStore.getState().nodes
    useDesignStore.getState().onConnect({
      source: source.id,
      target: mid.id,
      sourceHandle: 'right',
      targetHandle: 'left'
    })
    const edge = useDesignStore.getState().edges[0]

    useDesignStore.getState().beginReconnect(edge)
    useDesignStore.getState().onReconnect(edge, {
      source: source.id,
      target: dest.id,
      sourceHandle: 'bottom',
      targetHandle: 'top'
    })
    useDesignStore.getState().onReconnectEnd(edge)

    const next = useDesignStore.getState().edges[0]
    expect(useDesignStore.getState().edges).toHaveLength(1)
    expect(next.target).toBe(dest.id)
    expect(next.sourceHandle).toBe('bottom')
    expect(next.targetHandle).toBe('top')
  })

  it('disconnects a cable when reconnect is dropped on empty space', () => {
    useDesignStore.getState().addDevice('client', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('cache', { x: 160, y: 0 }, { keepArmed: false })
    const [source, target] = useDesignStore.getState().nodes
    useDesignStore.getState().onConnect({
      source: source.id,
      target: target.id,
      sourceHandle: 'right',
      targetHandle: 'left'
    })
    const edge = useDesignStore.getState().edges[0]

    useDesignStore.getState().beginReconnect(edge)
    useDesignStore.getState().onReconnectEnd(edge)

    expect(useDesignStore.getState().edges).toHaveLength(0)
    expect(useDesignStore.getState().nodes).toHaveLength(2)
  })

  it('removes a connection when the delete tool clicks the edge', () => {
    useDesignStore.getState().addDevice('client', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('loadBalancer', { x: 160, y: 0 }, { keepArmed: false })
    const [source, target] = useDesignStore.getState().nodes
    useDesignStore.getState().onConnect({
      source: source.id,
      target: target.id,
      sourceHandle: null,
      targetHandle: null
    })

    const edgeId = useDesignStore.getState().edges[0]?.id
    expect(edgeId).toBeTruthy()

    useDesignStore.getState().setTool('delete')
    useDesignStore.getState().handleEdgeClick(edgeId)

    expect(useDesignStore.getState().edges).toHaveLength(0)
    expect(useDesignStore.getState().nodes).toHaveLength(2)
  })

  it('deletes a selected connection', () => {
    useDesignStore.getState().addDevice('client', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('appServer', { x: 160, y: 0 }, { keepArmed: false })
    const [source, target] = useDesignStore.getState().nodes
    useDesignStore.getState().onConnect({
      source: source.id,
      target: target.id,
      sourceHandle: null,
      targetHandle: null
    })

    const edgeId = useDesignStore.getState().edges[0].id
    useDesignStore.getState().setSelected(edgeId)
    useDesignStore.getState().deleteSelected()

    expect(useDesignStore.getState().edges).toHaveLength(0)
  })

  it('deletes a selected device and its incident cables', () => {
    useDesignStore.getState().addDevice('client', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('cache', { x: 160, y: 0 }, { keepArmed: false })
    const [source, target] = useDesignStore.getState().nodes
    useDesignStore.getState().onConnect({
      source: source.id,
      target: target.id,
      sourceHandle: null,
      targetHandle: null
    })

    useDesignStore.getState().setSelected(source.id)
    useDesignStore.getState().deleteSelected()

    const state = useDesignStore.getState()
    expect(state.nodes).toHaveLength(1)
    expect(state.nodes[0].id).toBe(target.id)
    expect(state.edges).toHaveLength(0)
    expect(state.selectedId).toBeNull()
  })

  it('deletes multiple selected devices together', () => {
    useDesignStore.getState().addDevice('client', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('cdn', { x: 80, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('database', { x: 160, y: 0 }, { keepArmed: false })
    const ids = useDesignStore.getState().nodes.map((node) => node.id)

    useDesignStore.getState().syncSelection(ids.slice(0, 2), [])
    useDesignStore.getState().deleteSelected()

    expect(useDesignStore.getState().nodes).toHaveLength(1)
    expect(useDesignStore.getState().nodes[0].id).toBe(ids[2])
  })

  it('undoes and redoes a deletion', () => {
    useDesignStore.getState().addDevice('client', { x: 0, y: 0 }, { keepArmed: false })
    const id = useDesignStore.getState().nodes[0].id
    useDesignStore.getState().setSelected(id)
    useDesignStore.getState().deleteSelected()
    expect(useDesignStore.getState().nodes).toHaveLength(0)

    useDesignStore.getState().undo()
    expect(useDesignStore.getState().nodes.map((node) => node.id)).toEqual([id])

    useDesignStore.getState().redo()
    expect(useDesignStore.getState().nodes).toHaveLength(0)
  })

  it('duplicates selected devices and connecting cables', () => {
    useDesignStore.getState().addDevice('client', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('appServer', { x: 100, y: 0 }, { keepArmed: false })
    const [source, target] = useDesignStore.getState().nodes
    useDesignStore.getState().onConnect({
      source: source.id,
      target: target.id,
      sourceHandle: null,
      targetHandle: null
    })
    useDesignStore.getState().syncSelection([source.id, target.id], [])
    useDesignStore.getState().duplicateSelected()

    const state = useDesignStore.getState()
    expect(state.nodes).toHaveLength(4)
    expect(state.edges).toHaveLength(2)
  })

  it('labels a copper cable and keeps the label after device updates', () => {
    useDesignStore.getState().addDevice('client', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('appServer', { x: 160, y: 0 }, { keepArmed: false })
    const [source, target] = useDesignStore.getState().nodes
    useDesignStore.getState().onConnect({
      source: source.id,
      target: target.id,
      sourceHandle: null,
      targetHandle: null
    })

    const edgeId = useDesignStore.getState().edges[0].id
    useDesignStore.getState().updateCable(edgeId, { label: 'HTTPS /api' })
    useDesignStore.getState().updateDevice(source.id, { label: 'Web' })

    const edge = useDesignStore.getState().edges.find((item) => item.id === edgeId)
    expect(edge?.data?.label).toBe('HTTPS /api')
  })

  it('cancelInteraction steps back through place, tool, and selection', () => {
    useDesignStore.getState().addDevice('client', { x: 0, y: 0 }, { keepArmed: false })
    const id = useDesignStore.getState().nodes[0].id
    useDesignStore.getState().setPendingKind('database')
    useDesignStore.getState().cancelInteraction()
    expect(useDesignStore.getState().pendingKind).toBeNull()
    expect(useDesignStore.getState().tool).toBe('select')

    useDesignStore.getState().setTool('delete')
    useDesignStore.getState().cancelInteraction()
    expect(useDesignStore.getState().tool).toBe('select')

    useDesignStore.getState().setSelected(id)
    useDesignStore.getState().cancelInteraction()
    expect(useDesignStore.getState().selectedId).toBeNull()
    expect(useDesignStore.getState().selectedIds).toEqual([])
  })

  it('groups selected devices into a card', () => {
    useDesignStore.getState().addDevice('database', { x: 40, y: 80 }, { keepArmed: false })
    useDesignStore.getState().addDevice('appServer', { x: 200, y: 80 }, { keepArmed: false })
    const [database, api] = useDesignStore.getState().nodes
    useDesignStore.getState().syncSelection([database.id, api.id], [])
    useDesignStore.getState().groupSelected()

    const state = useDesignStore.getState()
    const group = state.nodes.find((node) => node.data.kind === 'group')
    const children = state.nodes.filter((node) => node.parentId === group?.id)
    expect(group).toBeTruthy()
    expect(children).toHaveLength(2)
    expect(children.every((node) => node.position.x >= 0 && node.position.y >= 0)).toBe(true)
  })

  it('keeps devices when a group card is deleted', () => {
    useDesignStore.getState().addDevice('database', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('cache', { x: 160, y: 0 }, { keepArmed: false })
    const deviceIds = useDesignStore.getState().nodes.map((node) => node.id)
    useDesignStore.getState().syncSelection(deviceIds, [])
    useDesignStore.getState().groupSelected()
    const groupId = useDesignStore.getState().nodes.find((node) => node.data.kind === 'group')?.id
    expect(groupId).toBeTruthy()

    useDesignStore.getState().deleteIds([groupId!])

    const state = useDesignStore.getState()
    expect(state.nodes.some((node) => node.data.kind === 'group')).toBe(false)
    expect(state.nodes.map((node) => node.id).sort()).toEqual([...deviceIds].sort())
    expect(state.nodes.every((node) => !node.parentId)).toBe(true)
  })

  it('ungroups selected cards and restores free-floating devices', () => {
    useDesignStore.getState().addDevice('database', { x: 12, y: 24 }, { keepArmed: false })
    useDesignStore.getState().addDevice('appServer', { x: 180, y: 24 }, { keepArmed: false })
    const deviceIds = useDesignStore.getState().nodes.map((node) => node.id)
    useDesignStore.getState().syncSelection(deviceIds, [])
    useDesignStore.getState().groupSelected()
    const groupId = useDesignStore.getState().nodes.find((node) => node.data.kind === 'group')?.id
    useDesignStore.getState().setSelected(groupId ?? null)
    useDesignStore.getState().updateGroup(groupId!, { notes: 'Supabase compute + data' })
    expect(useDesignStore.getState().nodes.find((node) => node.id === groupId)?.data.notes).toBe(
      'Supabase compute + data'
    )

    useDesignStore.getState().ungroupSelected()

    const state = useDesignStore.getState()
    expect(state.nodes.some((node) => node.data.kind === 'group')).toBe(false)
    expect(state.nodes).toHaveLength(2)
    expect(state.nodes.every((node) => !node.parentId)).toBe(true)
  })

  it('round-trips grouped designs through project JSON', () => {
    useDesignStore.getState().addDevice('database', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('appServer', { x: 120, y: 0 }, { keepArmed: false })
    const deviceIds = useDesignStore.getState().nodes.map((node) => node.id)
    useDesignStore.getState().syncSelection(deviceIds, [])
    useDesignStore.getState().groupSelected()
    const json = useDesignStore.getState().toJson()

    useDesignStore.getState().newDesign()
    useDesignStore.getState().loadFromJson(json, null)

    const state = useDesignStore.getState()
    const group = state.nodes.find((node) => node.data.kind === 'group')
    expect(group).toBeTruthy()
    expect(state.nodes.filter((node) => node.parentId === group?.id)).toHaveLength(2)
  })

  it('drills into an app server and restores its API interior on exit', () => {
    useDesignStore.getState().addDevice('appServer', { x: 40, y: 40 }, { keepArmed: false })
    const appServer = useDesignStore.getState().nodes[0]

    useDesignStore.getState().enterAppServer(appServer.id)
    expect(useDesignStore.getState().drillPath).toEqual([appServer.id])
    expect(useDesignStore.getState().interiorMode).toBe('api')
    expect(useDesignStore.getState().nodes).toHaveLength(0)

    useDesignStore.getState().addApiTable({ x: 10, y: 10 }, { keepArmed: false })
    expect(useDesignStore.getState().nodes).toHaveLength(1)
    expect(useDesignStore.getState().nodes[0].data.kind).toBe('apiTable')

    useDesignStore.getState().exitDrill()
    const state = useDesignStore.getState()
    expect(state.drillPath).toEqual([])
    const server = state.nodes[0]
    expect(isDeviceNode(server)).toBe(true)
    if (isDeviceNode(server)) {
      expect(server.data.appInteriors?.modes.api.nodes).toHaveLength(1)
    }
  })

  it('updates an API table node label and source table selection', () => {
    useDesignStore.getState().addDevice('appServer', { x: 0, y: 0 }, { keepArmed: false })
    const appServer = useDesignStore.getState().nodes[0]
    useDesignStore.getState().enterAppServer(appServer.id)
    useDesignStore.getState().addApiTable({ x: 0, y: 0 }, { keepArmed: false })
    const apiNode = useDesignStore.getState().nodes[0]

    useDesignStore.getState().updateApiTable(apiNode.id, {
      label: 'Get Bookings',
      sourceDatabaseId: 'database-1',
      sourceEntityId: 'entity-1',
      attributes: [{ id: 'attr-1', name: 'email', type: 'text', pk: false, fk: false }]
    })

    expect(useDesignStore.getState().nodes[0].data).toMatchObject({
      kind: 'apiTable',
      label: 'Get Bookings',
      sourceDatabaseId: 'database-1',
      sourceEntityId: 'entity-1',
      attributes: [{ id: 'attr-1', name: 'email', type: 'text', pk: false, fk: false }]
    })
  })

  it('finds databases reachable from an app server through multiple hops', () => {
    useDesignStore.getState().addDevice('appServer', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('loadBalancer', { x: 100, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('cache', { x: 200, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('database', { x: 300, y: 0 }, { keepArmed: false })
    const [appServer, lb, cache, database] = useDesignStore.getState().nodes

    useDesignStore.getState().onConnect({
      source: appServer.id,
      target: lb.id,
      sourceHandle: null,
      targetHandle: null
    })
    useDesignStore.getState().onConnect({
      source: lb.id,
      target: cache.id,
      sourceHandle: null,
      targetHandle: null
    })
    useDesignStore.getState().onConnect({
      source: cache.id,
      target: database.id,
      sourceHandle: null,
      targetHandle: null
    })

    const state = useDesignStore.getState()
    const reachable = findReachableDatabases(appServer.id, state.nodes, state.edges)
    expect(reachable.map((node) => node.id)).toEqual([database.id])
  })

  it('exposes a live-synced attribute snapshot for an API node source table', () => {
    useDesignStore.getState().addDevice('database', { x: 0, y: 0 }, { keepArmed: false })
    const database = useDesignStore.getState().nodes[0]
    useDesignStore.getState().enterDatabase(database.id)
    useDesignStore.getState().setInteriorMode('erd')
    useDesignStore.getState().addEntity({ x: 0, y: 0 }, { keepArmed: false })
    const entity = useDesignStore.getState().nodes[0]
    useDesignStore.getState().updateEntity(entity.id, {
      label: 'Booking',
      attributes: [{ id: 'attr-1', name: 'email', type: 'text', pk: false, fk: false }]
    })
    useDesignStore.getState().exitDrill()

    const resolved = resolveApiAttributes(database.id, entity.id, useDesignStore.getState().nodes)
    expect(resolved.missing).toBe(false)
    expect(resolved.attributes).toEqual([{ id: 'attr-1', name: 'email', type: 'text', pk: false, fk: false }])

    const missing = resolveApiAttributes('missing-db', 'missing-entity', useDesignStore.getState().nodes)
    expect(missing.missing).toBe(true)
  })

  it('diffs API attributes as missing, drifted, or local-only ok', () => {
    const source = [{ id: 'attr-1', name: 'email', type: 'text', pk: false, fk: false }]

    const deleted = diffApiAttributes(
      [{ id: 'attr-1', name: 'email', type: 'text', pk: false, fk: false, fromSource: true }],
      [],
      false,
      true
    )
    expect(deleted).toEqual([{ id: 'attr-1', status: 'missing' }])

    const drifted = diffApiAttributes(
      [{ id: 'attr-1', name: 'email', type: 'int', pk: false, fk: false, fromSource: true }],
      source,
      false,
      true
    )
    expect(drifted).toEqual([{ id: 'attr-1', status: 'drifted' }])

    const localOnly = diffApiAttributes(
      [{ id: 'attr-local', name: 'extra', type: 'text', pk: false, fk: false, fromSource: false }],
      source,
      false,
      true
    )
    expect(localOnly).toEqual([{ id: 'attr-local', status: 'ok' }])

    const legacyMissing = diffApiAttributes(
      [{ id: 'attr-gone', name: 'name', type: 'text', pk: false, fk: false }],
      source,
      false,
      true
    )
    expect(legacyMissing).toEqual([{ id: 'attr-gone', status: 'missing' }])

    const sourceTableGone = diffApiAttributes(
      [{ id: 'attr-1', name: 'email', type: 'text', pk: false, fk: false, fromSource: true }],
      [],
      true,
      true
    )
    expect(sourceTableGone).toEqual([{ id: 'attr-1', status: 'missing' }])

    const unlinked = diffApiAttributes(
      [{ id: 'attr-1', name: 'email', type: 'text', pk: false, fk: false, fromSource: true }],
      [],
      false,
      false
    )
    expect(unlinked).toEqual([{ id: 'attr-1', status: 'ok' }])

    // Same name on ERD after recreate (new id) should not false-positive as missing.
    const recreatedByName = diffApiAttributes(
      [
        {
          id: 'attr-1789656599595',
          name: 'organization_id',
          type: 'uuid',
          pk: false,
          fk: true,
          fromSource: true
        }
      ],
      [{ id: 'attr-1789659399134', name: 'organization_id', type: 'uuid', pk: false, fk: true }],
      false,
      true
    )
    expect(recreatedByName).toEqual([{ id: 'attr-1789656599595', status: 'ok' }])
  })

  it('drills into a client and restores its request interior on exit', () => {
    useDesignStore.getState().addDevice('client', { x: 40, y: 40 }, { keepArmed: false })
    const client = useDesignStore.getState().nodes[0]

    useDesignStore.getState().enterClient(client.id)
    expect(useDesignStore.getState().drillPath).toEqual([client.id])
    expect(useDesignStore.getState().interiorMode).toBe('requests')
    expect(useDesignStore.getState().nodes).toHaveLength(0)

    useDesignStore.getState().addApiCall({ x: 10, y: 10 }, { keepArmed: false })
    expect(useDesignStore.getState().nodes).toHaveLength(1)
    expect(useDesignStore.getState().nodes[0].data.kind).toBe('apiCall')

    useDesignStore.getState().exitDrill()
    const state = useDesignStore.getState()
    expect(state.drillPath).toEqual([])
    const owner = state.nodes[0]
    expect(isDeviceNode(owner)).toBe(true)
    if (isDeviceNode(owner)) {
      expect(owner.data.clientInteriors?.modes.requests.nodes).toHaveLength(1)
    }
  })

  it('finds app servers reachable from a client and detects apiCall sync issues', () => {
    useDesignStore.getState().addDevice('client', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('appServer', { x: 160, y: 0 }, { keepArmed: false })
    const [client, appServer] = useDesignStore.getState().nodes

    useDesignStore.getState().onConnect({
      source: client.id,
      target: appServer.id,
      sourceHandle: null,
      targetHandle: null
    })

    useDesignStore.getState().enterAppServer(appServer.id)
    useDesignStore.getState().addApiTable({ x: 0, y: 0 }, { keepArmed: false })
    const apiTable = useDesignStore.getState().nodes[0]
    useDesignStore.getState().updateApiTable(apiTable.id, {
      label: 'Get Users',
      apiConfig: {
        rest: {
          method: 'GET',
          path: '/users',
          parameters: [
            {
              id: 'param-auth',
              name: 'Authorization',
              type: 'text',
              required: true,
              in: 'header'
            }
          ]
        }
      }
    })
    useDesignStore.getState().exitDrill()

    const root = useDesignStore.getState()
    const reachable = findReachableAppServers(client.id, root.nodes, root.edges)
    expect(reachable.map((node) => node.id)).toEqual([appServer.id])

    expect(
      hasApiCallSyncIssues(
        {
          kind: 'apiCall',
          label: 'Load users',
          sourceAppServerId: appServer.id,
          sourceApiTableId: apiTable.id,
          paramValues: {}
        },
        root.nodes
      )
    ).toBe(true)

    expect(
      hasApiCallSyncIssues(
        {
          kind: 'apiCall',
          label: 'Load users',
          sourceAppServerId: appServer.id,
          sourceApiTableId: apiTable.id,
          paramValues: { 'param-auth': 'Bearer x' }
        },
        root.nodes
      )
    ).toBe(false)

    expect(
      hasApiCallSyncIssues(
        {
          kind: 'apiCall',
          label: 'Load users',
          sourceAppServerId: appServer.id,
          sourceApiTableId: 'missing-api',
          paramValues: {}
        },
        root.nodes
      )
    ).toBe(true)
  })

  it('keeps API and use case canvases separate when switching modes', () => {
    useDesignStore.getState().addDevice('appServer', { x: 0, y: 0 }, { keepArmed: false })
    const appServer = useDesignStore.getState().nodes[0]
    useDesignStore.getState().enterAppServer(appServer.id)
    useDesignStore.getState().addApiTable({ x: 0, y: 0 }, { keepArmed: false })
    const apiId = useDesignStore.getState().nodes[0].id

    useDesignStore.getState().setInteriorMode('useCase')
    expect(useDesignStore.getState().nodes).toHaveLength(0)
    useDesignStore.getState().addActor({ x: 20, y: 20 }, { keepArmed: false })
    expect(useDesignStore.getState().nodes[0].data.kind).toBe('actor')

    useDesignStore.getState().setInteriorMode('api')
    expect(useDesignStore.getState().nodes.map((node) => node.id)).toEqual([apiId])

    useDesignStore.getState().setInteriorMode('useCase')
    expect(useDesignStore.getState().nodes[0].data.kind).toBe('actor')
  })

  it('rejects use case links that do not match the relation', () => {
    useDesignStore.getState().addDevice('appServer', { x: 0, y: 0 }, { keepArmed: false })
    const appServer = useDesignStore.getState().nodes[0]
    useDesignStore.getState().enterAppServer(appServer.id)
    useDesignStore.getState().setInteriorMode('useCase')
    useDesignStore.getState().addActor({ x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addUseCase({ x: 80, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addUseCase({ x: 80, y: 120 }, { keepArmed: false })
    const [actor, placeOrder, pay] = useDesignStore.getState().nodes

    useDesignStore.getState().setPendingUseCaseRelation('association')
    useDesignStore.getState().onConnect({
      source: placeOrder.id,
      target: pay.id,
      sourceHandle: null,
      targetHandle: null
    })
    expect(useDesignStore.getState().edges).toHaveLength(0)

    useDesignStore.getState().setPendingUseCaseRelation('include')
    useDesignStore.getState().onConnect({
      source: actor.id,
      target: placeOrder.id,
      sourceHandle: null,
      targetHandle: null
    })
    expect(useDesignStore.getState().edges).toHaveLength(0)

    useDesignStore.getState().setPendingUseCaseRelation('include')
    useDesignStore.getState().onConnect({
      source: placeOrder.id,
      target: pay.id,
      sourceHandle: null,
      targetHandle: null
    })
    expect(useDesignStore.getState().edges).toHaveLength(1)
    expect(useDesignStore.getState().edges[0].data).toMatchObject({ useCaseRelation: 'include' })
  })

  it('removes a deleted API from use cases that realize it', () => {
    useDesignStore.getState().addDevice('appServer', { x: 0, y: 0 }, { keepArmed: false })
    const appServer = useDesignStore.getState().nodes[0]
    useDesignStore.getState().enterAppServer(appServer.id)
    useDesignStore.getState().addApiTable({ x: 0, y: 0 }, { keepArmed: false })
    const apiId = useDesignStore.getState().nodes[0].id

    useDesignStore.getState().setInteriorMode('useCase')
    useDesignStore.getState().addUseCase({ x: 40, y: 40 }, { keepArmed: false })
    const useCaseId = useDesignStore.getState().nodes[0].id
    useDesignStore.getState().updateUseCase(useCaseId, { apiTableIds: [apiId] })

    useDesignStore.getState().setInteriorMode('api')
    useDesignStore.getState().deleteIds([apiId])
    useDesignStore.getState().setInteriorMode('useCase')

    expect(useDesignStore.getState().nodes[0].data).toMatchObject({
      kind: 'useCase',
      apiTableIds: []
    })
  })

  it('switches to sequence and activity without wiping API or use case graphs', () => {
    useDesignStore.getState().addDevice('appServer', { x: 0, y: 0 }, { keepArmed: false })
    const appServer = useDesignStore.getState().nodes[0]
    useDesignStore.getState().enterAppServer(appServer.id)
    useDesignStore.getState().addApiTable({ x: 0, y: 0 }, { keepArmed: false })
    const apiId = useDesignStore.getState().nodes[0].id

    useDesignStore.getState().setInteriorMode('useCase')
    useDesignStore.getState().addUseCase({ x: 40, y: 40 }, { keepArmed: false })
    const useCaseId = useDesignStore.getState().nodes[0].id

    useDesignStore.getState().setInteriorMode('sequence')
    expect(useDesignStore.getState().nodes).toHaveLength(0)
    useDesignStore.getState().setInteriorMode('api')
    expect(useDesignStore.getState().nodes.map((node) => node.id)).toEqual([apiId])

    useDesignStore.getState().setInteriorMode('activity')
    useDesignStore.getState().setInteriorMode('useCase')
    expect(useDesignStore.getState().nodes.map((node) => node.id)).toEqual([useCaseId])
  })

  it('seeds a sequence from the actor, this server, and a cabled database', () => {
    useDesignStore.getState().addDevice('appServer', { x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addDevice('database', { x: 200, y: 0 }, { keepArmed: false })
    const [appServer, database] = useDesignStore.getState().nodes
    useDesignStore.getState().onConnect({
      source: appServer.id,
      target: database.id,
      sourceHandle: null,
      targetHandle: null
    })
    useDesignStore.getState().enterAppServer(appServer.id)
    useDesignStore.getState().addApiTable({ x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().setInteriorMode('useCase')
    useDesignStore.getState().addActor({ x: 0, y: 0 }, { keepArmed: false })
    useDesignStore.getState().addUseCase({ x: 160, y: 0 }, { keepArmed: false })
    const actor = useDesignStore.getState().nodes.find((node) => node.data.kind === 'actor')
    const useCase = useDesignStore.getState().nodes.find((node) => node.data.kind === 'useCase')
    expect(actor).toBeTruthy()
    expect(useCase).toBeTruthy()
    useDesignStore.getState().onConnect({
      source: actor!.id,
      target: useCase!.id,
      sourceHandle: null,
      targetHandle: null
    })

    useDesignStore.getState().setInteriorMode('sequence')
    useDesignStore.getState().createSequenceDiagram({ kind: 'useCase', id: useCase!.id })

    const lifelines = useDesignStore.getState().nodes.map((node) => node.data)
    expect(lifelines).toEqual([
      expect.objectContaining({ kind: 'lifeline', participant: 'actor', refId: actor!.id }),
      expect.objectContaining({ kind: 'lifeline', participant: 'appServer', refId: appServer.id }),
      expect.objectContaining({ kind: 'lifeline', participant: 'database', refId: database.id })
    ])

    const [left, right] = useDesignStore.getState().nodes
    useDesignStore.setState({
      nodes: [
        ...useDesignStore.getState().nodes,
        {
          id: 'behavior-extra',
          type: 'behavior',
          position: { x: 0, y: 200 },
          data: { kind: 'action', label: 'Not a lifeline' }
        }
      ]
    })
    expect(
      useDesignStore.getState().isValidConnection({
        source: left.id,
        target: 'behavior-extra',
        sourceHandle: null,
        targetHandle: null
      })
    ).toBe(false)
    useDesignStore.getState().onConnect({
      source: left.id,
      target: 'behavior-extra',
      sourceHandle: null,
      targetHandle: null
    })
    expect(useDesignStore.getState().edges).toHaveLength(0)

    useDesignStore.getState().onConnect({
      source: left.id,
      target: right.id,
      sourceHandle: null,
      targetHandle: null
    })
    expect(useDesignStore.getState().edges[0]?.data?.sequenceMessage).toMatchObject({
      order: 1,
      messageKind: 'sync'
    })
  })

  it('places one activity action per realized API and clears that link when the API is deleted', () => {
    useDesignStore.getState().addDevice('appServer', { x: 0, y: 0 }, { keepArmed: false })
    const appServer = useDesignStore.getState().nodes[0]
    useDesignStore.getState().enterAppServer(appServer.id)
    useDesignStore.getState().addApiTable({ x: 0, y: 0 }, { keepArmed: false })
    const apiId = useDesignStore.getState().nodes[0].id
    useDesignStore.getState().setInteriorMode('useCase')
    useDesignStore.getState().addUseCase({ x: 40, y: 40 }, { keepArmed: false })
    const useCaseId = useDesignStore.getState().nodes[0].id
    useDesignStore.getState().updateUseCase(useCaseId, { apiTableIds: [apiId] })

    useDesignStore.getState().setInteriorMode('activity')
    useDesignStore.getState().createActivityDiagram(useCaseId)
    expect(useDesignStore.getState().nodes.map((node) => node.data)).toEqual([
      expect.objectContaining({ kind: 'initial', label: 'Start' }),
      expect.objectContaining({ kind: 'action', apiTableId: apiId })
    ])

    useDesignStore.getState().setInteriorMode('api')
    useDesignStore.getState().deleteIds([apiId])
    useDesignStore.getState().setInteriorMode('activity')
    const action = useDesignStore.getState().nodes.find((node) => node.data.kind === 'action')
    expect(action?.data).toMatchObject({ kind: 'action' })
    expect(action?.data).not.toHaveProperty('apiTableId')
  })
})
