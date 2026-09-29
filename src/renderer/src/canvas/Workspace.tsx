import {
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Edge,
  type OnSelectionChangeParams
} from '@xyflow/react'
import { useCallback, useEffect, useRef, useState, type DragEvent, type JSX, type MouseEvent } from 'react'
import { useDesignStore } from '../store/designStore'
import type { DeviceKind } from '../store/types'
import type { AppServerInteriors, BehaviorDiagram, CanvasNode } from '../store/types'
import { isActorNode, isApiCallNode, isApiTableNode, isBehaviorNode, isDeviceNode, isGroupNode, isUseCaseNode } from '../store/types'
import { ConfigModal } from '../panels/ConfigModal'
import { DeleteCableConfirmModal } from '../panels/DeleteCableConfirmModal'
import { ActorNode } from './ActorNode'
import { ApiCallNode } from './ApiCallNode'
import { ApiTableNode } from './ApiTableNode'
import { CableEdge } from './CableEdge'
import { ContextMenu, type ContextMenuState } from './ContextMenu'
import { DeviceNode } from './DeviceNode'
import { DevicePalette } from './DevicePalette'
import { EntityNode } from './EntityNode'
import { FloatingTools } from './FloatingTools'
import { GroupNode } from './GroupNode'
import { Toolbar } from './Toolbar'
import { UseCaseNode } from './UseCaseNode'
import { BehaviorNode } from './BehaviorNode'

const nodeTypes = {
  device: DeviceNode,
  group: GroupNode,
  entity: EntityNode,
  apiTable: ApiTableNode,
  apiCall: ApiCallNode,
  actor: ActorNode,
  useCase: UseCaseNode,
  behavior: BehaviorNode
}
const edgeTypes = { cable: CableEdge }

function subjectName(interiors: AppServerInteriors, diagram: BehaviorDiagram): string {
  if (diagram.subject.kind === 'useCase') {
    const node = interiors.modes.useCase.nodes.find((item) => item.id === diagram.subject.id)
    return node && isUseCaseNode(node) ? node.data.label || 'Use case' : 'Use case'
  }
  const node = interiors.modes.api.nodes.find((item) => item.id === diagram.subject.id)
  return node && isApiTableNode(node) ? node.data.label || 'API' : 'API'
}

function diagramOptionLabel(diagrams: BehaviorDiagram[], interiors: AppServerInteriors, diagram: BehaviorDiagram): string {
  const base = subjectName(interiors, diagram)
  const same = diagrams.filter(
    (item) => item.subject.kind === diagram.subject.kind && item.subject.id === diagram.subject.id
  )
  if (same.length < 2) return base
  return `${base} (${same.findIndex((item) => item.id === diagram.id) + 1})`
}

function workspaceMode(
  tool: string,
  pendingKind: string | null,
  pendingEntity: boolean,
  pendingApiTable: boolean,
  pendingApiCall: boolean,
  pendingActor: boolean,
  pendingUseCase: boolean,
  pendingBehavior: boolean
): string {
  if (pendingKind || pendingEntity || pendingApiTable || pendingApiCall || pendingActor || pendingUseCase || pendingBehavior) {
    return 'workspace--place'
  }
  if (tool === 'pan') return 'workspace--pan'
  if (tool === 'connect') return 'workspace--connect'
  if (tool === 'delete') return 'workspace--delete'
  return 'workspace--select'
}

function absoluteNodePosition(node: CanvasNode, nodes: CanvasNode[]): { x: number; y: number } {
  let position = { ...node.position }
  let parentId = node.parentId
  const visited = new Set<string>()

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    const parent = nodes.find((item) => item.id === parentId)
    if (!parent) break
    position = {
      x: position.x + parent.position.x,
      y: position.y + parent.position.y
    }
    parentId = parent.parentId
  }

  return position
}

function FlowCanvas(): JSX.Element {
  const { screenToFlowPosition, setCenter, fitView } = useReactFlow()
  const nodes = useDesignStore((s) => s.nodes)
  const edges = useDesignStore((s) => s.edges)
  const tool = useDesignStore((s) => s.tool)
  const pendingKind = useDesignStore((s) => s.pendingKind)
  const selectedIds = useDesignStore((s) => s.selectedIds)
  const interiorMode = useDesignStore((s) => s.interiorMode)
  const onNodesChange = useDesignStore((s) => s.onNodesChange)
  const onEdgesChange = useDesignStore((s) => s.onEdgesChange)
  const onConnect = useDesignStore((s) => s.onConnect)
  const isValidConnection = useDesignStore((s) => s.isValidConnection)
  const beginReconnect = useDesignStore((s) => s.beginReconnect)
  const onReconnect = useDesignStore((s) => s.onReconnect)
  const onReconnectEnd = useDesignStore((s) => s.onReconnectEnd)
  const addDevice = useDesignStore((s) => s.addDevice)
  const addEntity = useDesignStore((s) => s.addEntity)
  const pendingEntity = useDesignStore((s) => s.pendingEntity)
  const setPendingEntity = useDesignStore((s) => s.setPendingEntity)
  const addApiTable = useDesignStore((s) => s.addApiTable)
  const pendingApiTable = useDesignStore((s) => s.pendingApiTable)
  const setPendingApiTable = useDesignStore((s) => s.setPendingApiTable)
  const addApiCall = useDesignStore((s) => s.addApiCall)
  const pendingApiCall = useDesignStore((s) => s.pendingApiCall)
  const setPendingApiCall = useDesignStore((s) => s.setPendingApiCall)
  const addActor = useDesignStore((s) => s.addActor)
  const pendingActor = useDesignStore((s) => s.pendingActor)
  const setPendingActor = useDesignStore((s) => s.setPendingActor)
  const addUseCase = useDesignStore((s) => s.addUseCase)
  const pendingUseCase = useDesignStore((s) => s.pendingUseCase)
  const setPendingUseCase = useDesignStore((s) => s.setPendingUseCase)
  const addBehaviorNode = useDesignStore((s) => s.addBehaviorNode)
  const pendingBehavior = useDesignStore((s) => s.pendingBehavior)
  const setPendingBehavior = useDesignStore((s) => s.setPendingBehavior)
  const handleNodeClick = useDesignStore((s) => s.handleNodeClick)
  const handleEdgeClick = useDesignStore((s) => s.handleEdgeClick)
  const setSelected = useDesignStore((s) => s.setSelected)
  const setViewport = useDesignStore((s) => s.setViewport)
  const setPendingKind = useDesignStore((s) => s.setPendingKind)
  const syncSelection = useDesignStore((s) => s.syncSelection)
  const beginNodeDrag = useDesignStore((s) => s.beginNodeDrag)
  const endNodeDrag = useDesignStore((s) => s.endNodeDrag)
  const deleteSelected = useDesignStore((s) => s.deleteSelected)
  const requestDelete = useDesignStore((s) => s.requestDelete)
  const pendingDeleteImpact = useDesignStore((s) => s.pendingDeleteImpact)
  const confirmPendingDelete = useDesignStore((s) => s.confirmPendingDelete)
  const cancelPendingDelete = useDesignStore((s) => s.cancelPendingDelete)
  const duplicateSelected = useDesignStore((s) => s.duplicateSelected)
  const groupSelected = useDesignStore((s) => s.groupSelected)
  const ungroupSelected = useDesignStore((s) => s.ungroupSelected)
  const selectAll = useDesignStore((s) => s.selectAll)
  const drillPath = useDesignStore((s) => s.drillPath)
  const enterDatabase = useDesignStore((s) => s.enterDatabase)
  const enterAppServer = useDesignStore((s) => s.enterAppServer)
  const enterClient = useDesignStore((s) => s.enterClient)
  const exitDrill = useDesignStore((s) => s.exitDrill)
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [propertiesId, setPropertiesId] = useState<string | null>(null)
  const ignoreSelectionRef = useRef(false)

  const placing =
    pendingKind != null ||
    pendingEntity ||
    pendingApiTable ||
    pendingApiCall ||
    pendingActor ||
    pendingUseCase ||
    pendingBehavior != null
  const selectMode = tool === 'select' && !placing
  const panMode = tool === 'pan' && !placing
  const canConnect = (tool === 'select' || tool === 'connect') && !placing

  const closeMenu = useCallback(() => setMenu(null), [])

  useEffect(() => {
    if (!menu) return
    const onPointerDown = (): void => setMenu(null)
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [menu])

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      const entityDrop = event.dataTransfer.getData('application/sdlab-entity')
      if (entityDrop) {
        addEntity(screenToFlowPosition({ x: event.clientX, y: event.clientY }), { keepArmed: false })
        setPendingEntity(false)
        return
      }
      const apiTableDrop = event.dataTransfer.getData('application/sdlab-apitable')
      if (apiTableDrop) {
        addApiTable(screenToFlowPosition({ x: event.clientX, y: event.clientY }), { keepArmed: false })
        setPendingApiTable(false)
        return
      }
      const apiCallDrop = event.dataTransfer.getData('application/sdlab-apicall')
      if (apiCallDrop) {
        addApiCall(screenToFlowPosition({ x: event.clientX, y: event.clientY }), { keepArmed: false })
        setPendingApiCall(false)
        return
      }
      const actorDrop = event.dataTransfer.getData('application/sdlab-actor')
      if (actorDrop) {
        addActor(screenToFlowPosition({ x: event.clientX, y: event.clientY }), { keepArmed: false })
        setPendingActor(false)
        return
      }
      const useCaseDrop = event.dataTransfer.getData('application/sdlab-usecase')
      if (useCaseDrop) {
        addUseCase(screenToFlowPosition({ x: event.clientX, y: event.clientY }), { keepArmed: false })
        setPendingUseCase(false)
        return
      }
      const behaviorDrop = event.dataTransfer.getData('application/sdlab-behavior')
      if (behaviorDrop) {
        addBehaviorNode(
          behaviorDrop as 'lifeline' | 'initial' | 'final' | 'action' | 'decision' | 'merge' | 'fork' | 'join',
          screenToFlowPosition({ x: event.clientX, y: event.clientY }),
          { keepArmed: false }
        )
        setPendingBehavior(null)
        return
      }
      const kind = event.dataTransfer.getData('application/sdlab') as DeviceKind
      if (!kind) return
      addDevice(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }), { keepArmed: false })
      setPendingKind(null)
    },
    [
      addApiCall,
      addActor,
      addApiTable,
      addDevice,
      addEntity,
      addBehaviorNode,
      addUseCase,
      screenToFlowPosition,
      setPendingActor,
      setPendingApiCall,
      setPendingApiTable,
      setPendingBehavior,
      setPendingEntity,
      setPendingKind,
      setPendingUseCase
    ]
  )

  const onNodeClick = useCallback(
    (_event: MouseEvent, node: CanvasNode) => {
      closeMenu()
      const connecting = useDesignStore.getState().tool === 'connect'
      const once = useDesignStore.getState().connectOnce
      handleNodeClick(node.id)
      if (connecting && once) ignoreSelectionRef.current = true
    },
    [closeMenu, handleNodeClick]
  )

  const onNodeDoubleClick = useCallback(
    (_event: MouseEvent, node: CanvasNode) => {
      if (
        isApiTableNode(node) ||
        isApiCallNode(node) ||
        isActorNode(node) ||
        isUseCaseNode(node) ||
        isBehaviorNode(node)
      ) {
        if (useDesignStore.getState().tool === 'delete') return
        setPropertiesId(node.id)
        return
      }
      const isDrillable =
        node.data.kind === 'database' || node.data.kind === 'appServer' || node.data.kind === 'client'
      if (
        !isDrillable ||
        useDesignStore.getState().tool !== 'select' ||
        useDesignStore.getState().pendingKind
      ) {
        return
      }
      const position = absoluteNodePosition(node, nodes)
      const width = node.measured?.width ?? node.width ?? 100
      const height = node.measured?.height ?? node.height ?? 100
      const centerX = position.x + width / 2
      const centerY = position.y + height / 2
      setCenter(centerX, centerY, { zoom: 2.2, duration: 350 })
      window.setTimeout(() => {
        if (node.data.kind === 'database') enterDatabase(node.id)
        else if (node.data.kind === 'appServer') enterAppServer(node.id)
        else enterClient(node.id)
        window.requestAnimationFrame(() => {
          void fitView({ duration: 350, padding: 0.25 })
        })
      }, 350)
    },
    [enterAppServer, enterClient, enterDatabase, fitView, nodes, setCenter]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || drillPath.length === 0) return
      const state = useDesignStore.getState()
      if (state.pendingKind || state.connectSourceId || state.tool !== 'select') return
      event.preventDefault()
      exitDrill()
      window.requestAnimationFrame(() => {
        void fitView({ duration: 350, padding: 0.2 })
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drillPath.length, exitDrill, fitView])

  const handleConnect = useCallback(
    (connection: Parameters<typeof onConnect>[0]) => {
      if (useDesignStore.getState().connectOnce) ignoreSelectionRef.current = true
      onConnect(connection)
    },
    [onConnect]
  )

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
      if (ignoreSelectionRef.current) {
        ignoreSelectionRef.current = false
        return
      }
      syncSelection(
        selectedNodes.map((node) => node.id),
        selectedEdges.map((edge) => edge.id)
      )
    },
    [syncSelection]
  )

  const openMenu = (
    event: { preventDefault: () => void; clientX: number; clientY: number },
    target: ContextMenuState['target'],
    id?: string
  ): void => {
    event.preventDefault()
    setMenu({ x: event.clientX, y: event.clientY, target, id })
    if (id && !useDesignStore.getState().selectedIds.includes(id)) setSelected(id)
  }

  const selectedNodes = nodes.filter((node) => selectedIds.includes(node.id))
  const canGroup = selectedNodes.some(isDeviceNode)
  const canUngroup = selectedNodes.some((node) => isGroupNode(node) || Boolean(node.parentId))
  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        isValidConnection={isValidConnection}
        onReconnect={onReconnect}
        onReconnectStart={(_event, edge) => beginReconnect(edge as Edge)}
        onReconnectEnd={(_event, edge) => onReconnectEnd(edge as Edge)}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onSelectionChange={onSelectionChange}
        onPaneClick={(event) => {
          closeMenu()
          const state = useDesignStore.getState()
          if (state.pendingEntity) {
            addEntity(screenToFlowPosition({ x: event.clientX, y: event.clientY }), { keepArmed: true })
            return
          }
          if (state.pendingApiTable) {
            addApiTable(screenToFlowPosition({ x: event.clientX, y: event.clientY }), { keepArmed: true })
            return
          }
          if (state.pendingApiCall) {
            addApiCall(screenToFlowPosition({ x: event.clientX, y: event.clientY }), { keepArmed: true })
            return
          }
          if (state.pendingActor) {
            addActor(screenToFlowPosition({ x: event.clientX, y: event.clientY }), { keepArmed: true })
            return
          }
          if (state.pendingUseCase) {
            addUseCase(screenToFlowPosition({ x: event.clientX, y: event.clientY }), { keepArmed: true })
            return
          }
          if (state.pendingBehavior) {
            addBehaviorNode(state.pendingBehavior, screenToFlowPosition({ x: event.clientX, y: event.clientY }), {
              keepArmed: true
            })
            return
          }
          if (state.pendingKind) {
            addDevice(state.pendingKind, screenToFlowPosition({ x: event.clientX, y: event.clientY }), {
              keepArmed: true
            })
            return
          }
          useDesignStore.setState({ connectSourceId: null })
          if (tool === 'select') setSelected(null)
        }}
        onPaneContextMenu={(event) => openMenu(event, 'pane')}
        onNodeContextMenu={(event, node) => openMenu(event, 'node', node.id)}
        onEdgeContextMenu={(event, edge) => openMenu(event, 'edge', edge.id)}
        onMoveEnd={(_, viewport) => setViewport(viewport)}
        onEdgeClick={(_event, edge) => {
          closeMenu()
          handleEdgeClick(edge.id)
        }}
        onEdgeDoubleClick={(event, edge) => {
          event.stopPropagation()
          closeMenu()
          if (useDesignStore.getState().tool === 'delete') {
            handleEdgeClick(edge.id)
            return
          }
          handleEdgeClick(edge.id)
          setPropertiesId(edge.id)
        }}
        onNodeDragStart={beginNodeDrag}
        onNodeDragStop={endNodeDrag}
        nodesDraggable={selectMode}
        nodesConnectable={canConnect}
        edgesReconnectable={selectMode}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ stroke: '#3f3f3f', strokeWidth: 2.4 }}
        reconnectRadius={24}
        elementsSelectable={selectMode}
        selectionOnDrag={selectMode}
        selectNodesOnDrag={false}
        panOnDrag={panMode ? [0, 1] : [1]}
        multiSelectionKeyCode="Shift"
        deleteKeyCode={null}
        fitViewOptions={{ padding: 0.2 }}
        className="workspace-flow"
        proOptions={{ hideAttribution: true }}
      >
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            if (isGroupNode(node as CanvasNode)) return '#d8ccb0'
            const canvasNode = node as CanvasNode
            if (canvasNode.data.kind === 'entity') {
              return interiorMode === 'uml' ? '#c8e6c9' : '#5a7a9a'
            }
            if (canvasNode.data.kind === 'apiTable') return '#8a5a9a'
            if (canvasNode.data.kind === 'apiCall') return '#5a8a7a'
            if (canvasNode.data.kind === 'actor') return '#3d6b8a'
            if (canvasNode.data.kind === 'useCase') return '#2f6f4e'
            if (isBehaviorNode(canvasNode)) return '#6a5a8a'
            if (isDeviceNode(canvasNode)) return '#8a8a8a'
            return '#8a8a8a'
          }}
          maskColor="rgba(40, 40, 40, 0.18)"
        />
      </ReactFlow>
      {menu && (
        <ContextMenu
          menu={menu}
          canDelete={menu.target !== 'pane' || selectedIds.length > 0}
          canDuplicate={
            menu.target === 'node' ||
            selectedIds.some((id) => nodes.some((node) => node.id === id))
          }
          canProperties={
            Boolean(menu.id) &&
            selectedIds.length <= 1 &&
            (menu.target === 'edge' ||
              (menu.target === 'node' &&
                nodes.some(
                  (item) =>
                    item.id === menu.id &&
                    (isDeviceNode(item) ||
                      isGroupNode(item) ||
                      isApiTableNode(item) ||
                      isApiCallNode(item) ||
                      isActorNode(item) ||
                      isUseCaseNode(item) ||
                      isBehaviorNode(item))
                )))
          }
          canGroup={canGroup}
          canUngroup={canUngroup}
          onProperties={() => {
            if (menu.id) setPropertiesId(menu.id)
          }}
          onDelete={() => {
            if (menu.id && selectedIds.length <= 1) requestDelete([menu.id])
            else deleteSelected()
            closeMenu()
          }}
          onDuplicate={() => {
            duplicateSelected()
            closeMenu()
          }}
          onGroup={groupSelected}
          onUngroup={ungroupSelected}
          onSelectAll={selectAll}
          onClose={closeMenu}
        />
      )}
      {propertiesId && (
        <ConfigModal targetId={propertiesId} onClose={() => setPropertiesId(null)} />
      )}
      {pendingDeleteImpact && (
        <DeleteCableConfirmModal
          impact={pendingDeleteImpact}
          onCancel={cancelPendingDelete}
          onConfirm={confirmPendingDelete}
        />
      )}
    </>
  )
}

function BehaviorSubjectSelect({
  mode,
  interiors,
  pickingSubject,
  onPickSubject,
  onCancelPick,
  onSelectDiagram,
  onCreateSequence,
  onCreateActivity
}: {
  mode: 'sequence' | 'activity'
  interiors: AppServerInteriors
  pickingSubject: boolean
  onPickSubject: () => void
  onCancelPick: () => void
  onSelectDiagram: (id: string) => void
  onCreateSequence: (subject: { kind: 'useCase' | 'api'; id: string }) => void
  onCreateActivity: (useCaseId: string) => void
}): JSX.Element {
  const diagrams = mode === 'sequence' ? (interiors.sequenceDiagrams ?? []) : (interiors.activityDiagrams ?? [])
  const activeId = mode === 'sequence' ? (interiors.activeSequenceId ?? '') : (interiors.activeActivityId ?? '')
  const useCases = interiors.modes.useCase.nodes.flatMap((node) =>
    isUseCaseNode(node) ? [{ id: node.id, label: node.data.label || 'Use case' }] : []
  )
  const apis = interiors.modes.api.nodes.flatMap((node) =>
    isApiTableNode(node) ? [{ id: node.id, label: node.data.label || 'API' }] : []
  )
  const subjects = mode === 'sequence' ? [...useCases.map((item) => ({ ...item, kind: 'useCase' as const })), ...apis.map((item) => ({ ...item, kind: 'api' as const }))] : useCases.map((item) => ({ ...item, kind: 'useCase' as const }))

  return (
    <>
      <select
        className="drill-breadcrumb__mode"
        value={diagrams.some((diagram) => diagram.id === activeId) ? activeId : ''}
        aria-label={mode === 'sequence' ? 'Sequence diagram' : 'Activity diagram'}
        onChange={(event) => {
          if (event.target.value === '__new__') {
            onPickSubject()
            return
          }
          onCancelPick()
          if (event.target.value) onSelectDiagram(event.target.value)
        }}
      >
        {diagrams.length === 0 ? <option value="">No diagram yet</option> : null}
        {diagrams.map((diagram) => (
          <option key={diagram.id} value={diagram.id}>
            {diagramOptionLabel(diagrams, interiors, diagram)}
          </option>
        ))}
        <option value="__new__">New…</option>
      </select>
      {pickingSubject ? (
        <select
          className="drill-breadcrumb__mode"
          value=""
          aria-label={mode === 'sequence' ? 'New sequence for' : 'New activity for'}
          onChange={(event) => {
            const value = event.target.value
            if (!value) return
            const separator = value.indexOf(':')
            const kind = value.slice(0, separator)
            const id = value.slice(separator + 1)
            if (mode === 'activity' && kind === 'useCase') onCreateActivity(id)
            else if (kind === 'useCase' || kind === 'api') onCreateSequence({ kind, id })
            onCancelPick()
          }}
        >
          <option value="">{mode === 'sequence' ? 'Use case or API' : 'Use case'}</option>
          {subjects.length === 0 ? (
            <option value="" disabled>
              {mode === 'sequence' ? 'Add a use case or API first' : 'Add a use case first'}
            </option>
          ) : (
            subjects.map((subject) => (
              <option key={`${subject.kind}:${subject.id}`} value={`${subject.kind}:${subject.id}`}>
                {mode === 'sequence' ? `${subject.kind === 'api' ? 'API' : 'Use case'}: ${subject.label}` : subject.label}
              </option>
            ))
          )}
        </select>
      ) : null}
    </>
  )
}

export function Workspace(): JSX.Element {
  const tool = useDesignStore((s) => s.tool)
  const pendingKind = useDesignStore((s) => s.pendingKind)
  const name = useDesignStore((s) => s.name)
  const drillPath = useDesignStore((s) => s.drillPath)
  const drillStack = useDesignStore((s) => s.drillStack)
  const interiorMode = useDesignStore((s) => s.interiorMode)
  const pendingEntity = useDesignStore((s) => s.pendingEntity)
  const pendingApiTable = useDesignStore((s) => s.pendingApiTable)
  const pendingApiCall = useDesignStore((s) => s.pendingApiCall)
  const pendingActor = useDesignStore((s) => s.pendingActor)
  const pendingUseCase = useDesignStore((s) => s.pendingUseCase)
  const pendingBehavior = useDesignStore((s) => s.pendingBehavior)
  const exitDrill = useDesignStore((s) => s.exitDrill)
  const exitToRoot = useDesignStore((s) => s.exitToRoot)
  const setInteriorMode = useDesignStore((s) => s.setInteriorMode)
  const createSequenceDiagram = useDesignStore((s) => s.createSequenceDiagram)
  const createActivityDiagram = useDesignStore((s) => s.createActivityDiagram)
  const setActiveBehaviorDiagram = useDesignStore((s) => s.setActiveBehaviorDiagram)
  const [pickingSubject, setPickingSubject] = useState(false)

  const labels = drillStack.map((frame) => {
    const node = frame.nodes.find((item) => item.id === frame.ownerId)
    return node && isDeviceNode(node) ? node.data.label : 'Device'
  })
  const isAppServerInterior =
    interiorMode === 'api' ||
    interiorMode === 'useCase' ||
    interiorMode === 'sequence' ||
    interiorMode === 'activity'
  const isClientInterior = interiorMode === 'requests'
  const appInteriors = useDesignStore((s) => {
    if (s.drillPath.length === 0) return null
    const frame = s.drillStack[s.drillStack.length - 1]
    const owner = frame?.nodes.find((node) => node.id === s.drillPath[s.drillPath.length - 1])
    if (!owner || !isDeviceNode(owner) || owner.data.kind !== 'appServer') return null
    return owner.data.appInteriors ?? null
  })

  useEffect(() => {
    setPickingSubject(false)
  }, [interiorMode])

  return (
    <section
      className={`workspace ${workspaceMode(tool, pendingKind, pendingEntity, pendingApiTable, pendingApiCall, pendingActor, pendingUseCase, pendingBehavior != null)}`}
    >
      <div className="workspace__stage">
        {drillPath.length > 0 && (
          <nav className="drill-breadcrumb" aria-label="Canvas location">
            <button type="button" onClick={exitToRoot}>
              {name}
            </button>
            {labels.map((label, index) => (
              <span key={`${label}-${index}`} className="drill-breadcrumb__item">
                <span aria-hidden="true">›</span>
                <button type="button" onClick={index === labels.length - 1 ? exitDrill : exitToRoot}>
                  {label}
                </button>
              </span>
            ))}
            <span className="drill-breadcrumb__item">
              <span aria-hidden="true">›</span>
              {isAppServerInterior ? (
                <>
                  <select
                    className="drill-breadcrumb__mode"
                    value={interiorMode ?? 'api'}
                    aria-label="App server interior mode"
                    onChange={(event) =>
                      setInteriorMode(event.target.value as 'api' | 'useCase' | 'sequence' | 'activity')
                    }
                  >
                    <option value="api">API</option>
                    <option value="useCase">Use case</option>
                    <option value="sequence">Sequence</option>
                    <option value="activity">Activity</option>
                  </select>
                  {(interiorMode === 'sequence' || interiorMode === 'activity') && appInteriors ? (
                    <BehaviorSubjectSelect
                      mode={interiorMode}
                      interiors={appInteriors}
                      pickingSubject={pickingSubject}
                      onPickSubject={() => setPickingSubject(true)}
                      onCancelPick={() => setPickingSubject(false)}
                      onSelectDiagram={setActiveBehaviorDiagram}
                      onCreateSequence={createSequenceDiagram}
                      onCreateActivity={createActivityDiagram}
                    />
                  ) : null}
                </>
              ) : isClientInterior ? (
                <span className="drill-breadcrumb__mode-label">Requests</span>
              ) : (
                <select
                  className="drill-breadcrumb__mode"
                  value={interiorMode ?? 'erd'}
                  aria-label="Database interior mode"
                  onChange={(event) => setInteriorMode(event.target.value as 'erd' | 'uml' | 'object')}
                >
                  <option value="erd">ERD</option>
                  <option value="uml">Class diagram</option>
                  <option value="object">Object diagram</option>
                </select>
              )}
            </span>
            <button type="button" className="drill-breadcrumb__back" onClick={exitDrill}>
              Back
            </button>
          </nav>
        )}
        <FlowCanvas />
        <Toolbar />
        <FloatingTools />
      </div>
      <DevicePalette />
    </section>
  )
}
