import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { Edge } from '@xyflow/react'
import { useDesignStore } from '../store/designStore'
import { actorsLinkedToUseCase, reachableStores } from '../store/behaviorDiagrams'
import { cloneApiTableDraft } from '../store/apiTableUtils'
import { resolveApiCallTarget } from '../store/graphQueries'
import type {
  ActorNodeData,
  ApiCallNodeData,
  ApiTableNodeData,
  BehaviorNodeData,
  CableData,
  CanvasNode,
  DeviceData,
  GroupData,
  SequenceMessageKind,
  UseCaseNodeData
} from '../store/types'
import {
  isActivityStepNode,
  isActorNode,
  isApiCallNode,
  isApiTableNode,
  isBehaviorNode,
  isDeviceNode,
  isGroupNode,
  isUseCaseNode
} from '../store/types'
import { ApiCallConfigForm, cloneApiCallDraft } from './ApiCallConfigForm'
import { ApiCallParametersModal } from './ApiCallParametersModal'
import { ApiParametersModal } from './ApiParametersModal'
import { ApiTableEntitiesModal } from './ApiTableEntitiesModal'
import {
  ActivityConfigForm,
  ActorConfigForm,
  ApiConfigForm,
  CableConfigForm,
  DeviceConfigForm,
  GroupConfigForm,
  LifelineConfigForm,
  UseCaseConfigForm,
  isLifelineDraft,
  type LifelineChoice
} from './ConfigForm'

interface CableDraft {
  label: string
  guard: string
  messageKind: SequenceMessageKind
  apiTableId: string
  isMessage: boolean
  showGuard: boolean
}

interface ConfigModalProps {
  targetId: string
  onClose: () => void
}

function rootGraphNodes(state: {
  nodes: CanvasNode[]
  drillStack: Array<{ nodes: CanvasNode[] }>
}): CanvasNode[] {
  return state.drillStack[0]?.nodes ?? state.nodes
}

function rootGraphEdges(state: {
  edges: Edge<CableData>[]
  drillStack: Array<{ edges: Edge<CableData>[] }>
}): Edge<CableData>[] {
  return state.drillStack[0]?.edges ?? state.edges
}

function appServerApiNodes(state: {
  drillPath: string[]
  drillStack: Array<{ nodes: CanvasNode[]; ownerId: string }>
}): CanvasNode[] | undefined {
  const ownerId = state.drillPath[state.drillPath.length - 1]
  const frame = state.drillStack[state.drillStack.length - 1]
  const owner = frame?.nodes.find((node) => node.id === ownerId)
  if (!owner || !isDeviceNode(owner) || owner.data.kind !== 'appServer') return undefined
  return owner.data.appInteriors?.modes.api.nodes
}

interface DrillFrame {
  nodes: CanvasNode[]
  edges: Edge<CableData>[]
  ownerId: string
}

const NO_LIFELINE_CHOICES: LifelineChoice[] = []
const NO_ACTIVITY_APIS: Array<{ id: string; label: string }> = []

function appServerOwner(drillStack: DrillFrame[], drillPath: string[]) {
  const frame = drillStack[drillStack.length - 1]
  const ownerId = drillPath[drillPath.length - 1]
  const owner = frame?.nodes.find((item) => item.id === ownerId)
  if (!owner || !isDeviceNode(owner) || owner.data.kind !== 'appServer' || !owner.data.appInteriors) return null
  return { frame, owner, interiors: owner.data.appInteriors }
}

function lifelineChoicesFor(drillStack: DrillFrame[], drillPath: string[]): LifelineChoice[] {
  const current = appServerOwner(drillStack, drillPath)
  if (!current?.frame) return NO_LIFELINE_CHOICES
  const { frame, owner, interiors } = current
  const diagram = (interiors.sequenceDiagrams ?? []).find((item) => item.id === interiors.activeSequenceId)
  const choices: LifelineChoice[] = []
  if (diagram?.subject.kind === 'useCase') {
    for (const actor of actorsLinkedToUseCase(interiors.modes.useCase, diagram.subject.id)) {
      if (!isActorNode(actor)) continue
      choices.push({ participant: 'actor', refId: actor.id, label: actor.data.label || 'Actor' })
    }
  }
  choices.push({ participant: 'appServer', refId: owner.id, label: owner.data.label || 'App server' })
  for (const store of reachableStores(frame.nodes, frame.edges, owner.id)) {
    if (!isDeviceNode(store)) continue
    const kind = store.data.kind
    if (kind !== 'database' && kind !== 'cache' && kind !== 'messageQueue') continue
    choices.push({ participant: kind, refId: store.id, label: store.data.label || kind })
  }
  return choices
}

function activityApisFor(drillStack: DrillFrame[], drillPath: string[]): Array<{ id: string; label: string }> {
  const current = appServerOwner(drillStack, drillPath)
  if (!current) return NO_ACTIVITY_APIS
  const { interiors } = current
  const diagram = (interiors.activityDiagrams ?? []).find((item) => item.id === interiors.activeActivityId)
  const useCaseId = diagram?.subject.kind === 'useCase' ? diagram.subject.id : null
  const useCase = interiors.modes.useCase.nodes.find((item) => item.id === useCaseId && isUseCaseNode(item))
  const allowed = new Set(useCase && isUseCaseNode(useCase) ? useCase.data.apiTableIds : [])
  return (interiors.modes.api.nodes ?? []).flatMap((item) =>
    isApiTableNode(item) && allowed.has(item.id) ? [{ id: item.id, label: item.data.label || 'API' }] : []
  )
}

function draftsFromTarget(targetId: string): {
  device: DeviceData | null
  group: Pick<GroupData, 'label' | 'notes'> | null
  cable: CableDraft | null
  apiTable: ApiTableNodeData | null
  apiCall: ApiCallNodeData | null
  actor: ActorNodeData | null
  useCase: UseCaseNodeData | null
  behavior: BehaviorNodeData | null
} {
  const empty = {
    device: null,
    group: null,
    cable: null,
    apiTable: null,
    apiCall: null,
    actor: null,
    useCase: null,
    behavior: null
  }
  const state = useDesignStore.getState()
  const node = state.nodes.find((item) => item.id === targetId)
  if (node && isDeviceNode(node)) {
    return { ...empty, device: { ...node.data } }
  }
  if (node && isGroupNode(node)) {
    return { ...empty, group: { label: node.data.label, notes: node.data.notes } }
  }
  if (node && isApiTableNode(node)) {
    return { ...empty, apiTable: cloneApiTableDraft(node.data) }
  }
  if (node && isApiCallNode(node)) {
    return { ...empty, apiCall: cloneApiCallDraft(node.data) }
  }
  if (node && isActorNode(node)) {
    return { ...empty, actor: { ...node.data } }
  }
  if (node && isUseCaseNode(node)) {
    return { ...empty, useCase: { ...node.data, apiTableIds: [...node.data.apiTableIds] } }
  }
  if (node && isBehaviorNode(node)) {
    return { ...empty, behavior: { ...node.data } }
  }
  const edge = state.edges.find((item) => item.id === targetId)
  if (edge) {
    const source = state.nodes.find((item) => item.id === edge.source)
    return {
      ...empty,
      cable: {
        label: edge.data?.label ?? '',
        guard: edge.data?.guard ?? '',
        messageKind: edge.data?.sequenceMessage?.messageKind ?? 'sync',
        apiTableId: edge.data?.sequenceMessage?.apiTableId ?? '',
        isMessage: Boolean(edge.data?.sequenceMessage),
        showGuard: Boolean(source && isActivityStepNode(source) && source.data.kind === 'decision')
      }
    }
  }
  return empty
}

export function ConfigModal({ targetId, onClose }: ConfigModalProps): JSX.Element | null {
  const node = useDesignStore((s) => s.nodes.find((item) => item.id === targetId))
  const edge = useDesignStore((s) => s.edges.find((item) => item.id === targetId))
  const ownerId = useDesignStore((s) => s.drillPath[s.drillPath.length - 1] ?? null)
  const rootNodes = useDesignStore(rootGraphNodes)
  const rootEdges = useDesignStore(rootGraphEdges)
  const updateDevice = useDesignStore((s) => s.updateDevice)
  const updateGroup = useDesignStore((s) => s.updateGroup)
  const updateCable = useDesignStore((s) => s.updateCable)
  const updateApiTable = useDesignStore((s) => s.updateApiTable)
  const updateApiCall = useDesignStore((s) => s.updateApiCall)
  const updateActor = useDesignStore((s) => s.updateActor)
  const updateUseCase = useDesignStore((s) => s.updateUseCase)
  const updateBehaviorNode = useDesignStore((s) => s.updateBehaviorNode)
  const apiNodes = useDesignStore(appServerApiNodes)
  const drillStack = useDesignStore((s) => s.drillStack)
  const drillPath = useDesignStore((s) => s.drillPath)
  const lifelineChoices = useMemo(() => lifelineChoicesFor(drillStack, drillPath), [drillPath, drillStack])
  const activityApis = useMemo(() => activityApisFor(drillStack, drillPath), [drillPath, drillStack])
  const realizedApis = useMemo(
    () =>
      (apiNodes ?? []).flatMap((node) =>
        isApiTableNode(node) ? [{ id: node.id, label: node.data.label || 'API' }] : []
      ),
    [apiNodes]
  )
  const panelRef = useRef<HTMLDivElement>(null)

  const initial = draftsFromTarget(targetId)
  const [deviceDraft, setDeviceDraft] = useState<DeviceData | null>(initial.device)
  const [groupDraft, setGroupDraft] = useState<Pick<GroupData, 'label' | 'notes'> | null>(initial.group)
  const [cableDraft, setCableDraft] = useState<CableDraft | null>(initial.cable)
  const [apiTableDraft, setApiTableDraft] = useState<ApiTableNodeData | null>(initial.apiTable)
  const [apiCallDraft, setApiCallDraft] = useState<ApiCallNodeData | null>(initial.apiCall)
  const [actorDraft, setActorDraft] = useState<ActorNodeData | null>(initial.actor)
  const [useCaseDraft, setUseCaseDraft] = useState<UseCaseNodeData | null>(initial.useCase)
  const [behaviorDraft, setBehaviorDraft] = useState<BehaviorNodeData | null>(initial.behavior)
  const [showTableEntities, setShowTableEntities] = useState(false)
  const [showParameters, setShowParameters] = useState(false)
  const [showApiCallParameters, setShowApiCallParameters] = useState(false)

  useEffect(() => {
    const next = draftsFromTarget(targetId)
    setDeviceDraft(next.device)
    setGroupDraft(next.group)
    setCableDraft(next.cable)
    setApiTableDraft(next.apiTable)
    setApiCallDraft(next.apiCall)
    setActorDraft(next.actor)
    setUseCaseDraft(next.useCase)
    setBehaviorDraft(next.behavior)
    setShowTableEntities(false)
    setShowParameters(false)
    setShowApiCallParameters(false)
  }, [targetId])

  useEffect(() => {
    if (!node && !edge) onClose()
  }, [edge, node, onClose])

  useEffect(() => {
    panelRef.current?.focus()
  }, [targetId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (showTableEntities || showParameters || showApiCallParameters) return
      event.preventDefault()
      event.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose, showApiCallParameters, showParameters, showTableEntities])

  const apply = useCallback((): boolean => {
    if (node && isDeviceNode(node) && deviceDraft) {
      updateDevice(node.id, deviceDraft)
      return true
    }
    if (node && isGroupNode(node) && groupDraft) {
      updateGroup(node.id, groupDraft)
      return true
    }
    if (edge && cableDraft) {
      updateCable(edge.id, {
        label: cableDraft.label.trim(),
        guard: cableDraft.guard.trim(),
        ...(cableDraft.isMessage
          ? {
              sequenceMessage: {
                order: edge.data?.sequenceMessage?.order ?? 1,
                messageKind: cableDraft.messageKind,
                ...(cableDraft.apiTableId ? { apiTableId: cableDraft.apiTableId } : {})
              }
            }
          : {})
      })
      return true
    }
    if (node && isApiTableNode(node) && apiTableDraft) {
      updateApiTable(node.id, apiTableDraft)
      return true
    }
    if (node && isApiCallNode(node) && apiCallDraft) {
      updateApiCall(node.id, apiCallDraft)
      return true
    }
    if (node && isActorNode(node) && actorDraft) {
      updateActor(node.id, actorDraft)
      return true
    }
    if (node && isUseCaseNode(node) && useCaseDraft) {
      updateUseCase(node.id, useCaseDraft)
      return true
    }
    if (node && isBehaviorNode(node) && behaviorDraft) {
      updateBehaviorNode(node.id, behaviorDraft)
      return true
    }
    return false
  }, [
    actorDraft,
    apiCallDraft,
    apiTableDraft,
    cableDraft,
    deviceDraft,
    edge,
    groupDraft,
    node,
    updateActor,
    updateApiCall,
    updateApiTable,
    updateCable,
    updateDevice,
    updateGroup,
    behaviorDraft,
    updateBehaviorNode,
    updateUseCase,
    useCaseDraft
  ])

  const save = useCallback((): void => {
    if (apply()) onClose()
  }, [apply, onClose])

  const apiCallResolved = useMemo(() => {
    if (!apiCallDraft) return null
    return resolveApiCallTarget(
      apiCallDraft.sourceAppServerId,
      apiCallDraft.sourceApiTableId,
      rootNodes,
      { clientId: ownerId ?? undefined, edges: rootEdges }
    )
  }, [apiCallDraft, ownerId, rootEdges, rootNodes])

  const apiCallAppServerLabel = useMemo(() => {
    if (!apiCallDraft?.sourceAppServerId) return 'App server'
    const server = rootNodes.find((item) => item.id === apiCallDraft.sourceAppServerId)
    return server && isDeviceNode(server) ? server.data.label : 'App server'
  }, [apiCallDraft?.sourceAppServerId, rootNodes])

  const isDevice = Boolean(node && isDeviceNode(node) && deviceDraft)
  const isGroup = Boolean(node && isGroupNode(node) && groupDraft)
  const isCable = Boolean(edge && cableDraft)
  const isApiTable = Boolean(node && isApiTableNode(node) && apiTableDraft)
  const isApiCall = Boolean(node && isApiCallNode(node) && apiCallDraft)
  const isActor = Boolean(node && isActorNode(node) && actorDraft)
  const isUseCase = Boolean(node && isUseCaseNode(node) && useCaseDraft)
  const isBehavior = Boolean(node && isBehaviorNode(node) && behaviorDraft)
  if (!isDevice && !isGroup && !isCable && !isApiTable && !isApiCall && !isActor && !isUseCase && !isBehavior) return null

  const panelClassName =
    isApiTable || isApiCall
      ? 'config-modal__panel config-modal__panel--api glass-panel'
      : 'config-modal__panel glass-panel'

  return (
    <>
      <div className="config-modal" role="presentation" onPointerDown={onClose}>
        <div
          ref={panelRef}
          className={panelClassName}
          role="dialog"
          aria-modal="true"
          aria-labelledby="config-modal-title"
          tabIndex={-1}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="config-modal__body">
            {isDevice && deviceDraft && (
              <DeviceConfigForm
                data={deviceDraft}
                onChange={(patch) => setDeviceDraft((current) => (current ? { ...current, ...patch } : current))}
              />
            )}
            {isGroup && groupDraft && (
              <GroupConfigForm
                data={{ kind: 'group', ...groupDraft }}
                onChange={(patch) => setGroupDraft((current) => (current ? { ...current, ...patch } : current))}
              />
            )}
            {isCable && cableDraft && (
              <CableConfigForm
                label={cableDraft.label}
                onChange={(label) => setCableDraft((current) => (current ? { ...current, label } : current))}
                {...(cableDraft.isMessage
                  ? {
                      messageKind: cableDraft.messageKind,
                      onMessageKind: (messageKind: SequenceMessageKind) =>
                        setCableDraft((current) => (current ? { ...current, messageKind } : current)),
                      apis: realizedApis,
                      apiTableId: cableDraft.apiTableId,
                      onApi: (apiTableId: string) =>
                        setCableDraft((current) => (current ? { ...current, apiTableId } : current))
                    }
                  : {})}
                {...(cableDraft.showGuard
                  ? {
                      guard: cableDraft.guard,
                      onGuard: (guard: string) => setCableDraft((current) => (current ? { ...current, guard } : current))
                    }
                  : {})}
              />
            )}
            {isApiTable && apiTableDraft && (
              <ApiConfigForm
                data={apiTableDraft}
                onChange={(patch) =>
                  setApiTableDraft((current) => (current ? { ...current, ...patch } : current))
                }
                onOpenTableEntities={() => setShowTableEntities(true)}
                onOpenParameters={() => setShowParameters(true)}
              />
            )}
            {isApiCall && apiCallDraft && (
              <ApiCallConfigForm
                data={apiCallDraft}
                onChange={(patch) =>
                  setApiCallDraft((current) => (current ? { ...current, ...patch } : current))
                }
                onOpenParameters={() => setShowApiCallParameters(true)}
              />
            )}
            {isActor && actorDraft && (
              <ActorConfigForm
                data={actorDraft}
                onChange={(patch) => setActorDraft((current) => (current ? { ...current, ...patch } : current))}
              />
            )}
            {isUseCase && useCaseDraft && (
              <UseCaseConfigForm
                data={useCaseDraft}
                apis={realizedApis}
                onChange={(patch) =>
                  setUseCaseDraft((current) => (current ? { ...current, ...patch } : current))
                }
              />
            )}
            {isBehavior && behaviorDraft && isLifelineDraft(behaviorDraft) && (
              <LifelineConfigForm
                data={behaviorDraft}
                choices={lifelineChoices}
                onChange={(patch) =>
                  setBehaviorDraft((current) => (current && isLifelineDraft(current) ? { ...current, ...patch } : current))
                }
              />
            )}
            {isBehavior && behaviorDraft && !isLifelineDraft(behaviorDraft) && (
              <ActivityConfigForm
                data={behaviorDraft}
                apis={activityApis}
                onChange={(patch) =>
                  setBehaviorDraft((current) =>
                    current && !isLifelineDraft(current) ? { ...current, ...patch } : current
                  )
                }
              />
            )}
          </div>
          <div className="config-modal__footer">
            <button type="button" className="glass-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="glass-btn" onClick={() => apply()}>
              Apply
            </button>
            <button type="button" className="glass-btn glass-btn--accent" onClick={save}>
              Save
            </button>
          </div>
        </div>
      </div>
      {showParameters && isApiTable && apiTableDraft && (
        <ApiParametersModal
          initialData={apiTableDraft}
          onSave={(data) => setApiTableDraft(data)}
          onClose={() => setShowParameters(false)}
        />
      )}
      {showTableEntities && isApiTable && apiTableDraft && node && (
        <ApiTableEntitiesModal
          nodeId={node.id}
          initialData={apiTableDraft}
          onSave={(data) => setApiTableDraft(data)}
          onClose={() => setShowTableEntities(false)}
        />
      )}
      {showApiCallParameters &&
        isApiCall &&
        apiCallDraft &&
        apiCallResolved?.api &&
        !apiCallResolved.unreachable && (
          <ApiCallParametersModal
            initialData={apiCallDraft}
            api={apiCallResolved.api}
            appServerLabel={apiCallAppServerLabel}
            onSave={(data) => setApiCallDraft(data)}
            onClose={() => setShowApiCallParameters(false)}
          />
        )}
    </>
  )
}
