import { type JSX } from 'react'
import { ApiStyleFields } from './ApiStyleFields'
import {
  apiTypeHasParameters,
  getApiParameters,
  getApiParametersLabel
} from '../store/apiTableUtils'
import type {
  ActivityStepNodeData,
  ActorNodeData,
  ApiTableNodeData,
  ApiType,
  BehaviorNodeData,
  DeviceData,
  GroupData,
  LifelineNodeData,
  LifelineParticipant,
  SequenceMessageKind,
  UseCaseNodeData
} from '../store/types'
import { API_TYPE_LABELS, API_TYPES, SEQUENCE_MESSAGE_KINDS } from '../store/types'

interface DeviceFormProps {
  data: DeviceData
  onChange: (patch: Partial<DeviceData>) => void
}

export function DeviceConfigForm({ data, onChange }: DeviceFormProps): JSX.Element {
  return (
    <>
      <h2 id="config-modal-title">{data.label}</h2>
      <p className="panel__kind">{data.kind}</p>

      <label className="field">
        <span>Label</span>
        <input value={data.label} onChange={(e) => onChange({ label: e.target.value })} />
      </label>
    </>
  )
}

interface CableFormProps {
  label: string
  onChange: (label: string) => void
  messageKind?: SequenceMessageKind
  onMessageKind?: (kind: SequenceMessageKind) => void
  guard?: string
  onGuard?: (guard: string) => void
  apis?: Array<{ id: string; label: string }>
  apiTableId?: string
  onApi?: (id: string) => void
}

export function CableConfigForm({
  label,
  onChange,
  messageKind,
  onMessageKind,
  guard,
  onGuard,
  apis,
  apiTableId,
  onApi
}: CableFormProps): JSX.Element {
  const title = messageKind ? 'Message' : onGuard ? 'Decision exit' : 'Copper cable'
  return (
    <>
      <h2 id="config-modal-title">{label.trim() || title}</h2>
      <p className="panel__kind">{title}</p>
      <label className="field">
        <span>Label</span>
        <input
          value={label}
          onChange={(e) => onChange(e.target.value)}
          placeholder={messageKind ? 'What does this message say?' : 'What does this connection do?'}
        />
      </label>
      {messageKind && onMessageKind ? (
        <label className="field">
          <span>Kind</span>
          <select value={messageKind} onChange={(event) => onMessageKind(event.target.value as SequenceMessageKind)}>
            {SEQUENCE_MESSAGE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind === 'sync' ? 'Synchronous' : kind === 'async' ? 'Asynchronous' : 'Reply'}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {onGuard ? (
        <label className="field">
          <span>Guard</span>
          <input value={guard ?? ''} onChange={(event) => onGuard(event.target.value)} placeholder="paid" />
        </label>
      ) : null}
      {onApi && apis ? (
        <label className="field">
          <span>API</span>
          <select value={apiTableId ?? ''} onChange={(event) => onApi(event.target.value)}>
            <option value="">None</option>
            {apis.map((api) => (
              <option key={api.id} value={api.id}>
                {api.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {messageKind ? null : (
        <p className="field-hint">Shown on the cable so others can tell what traffic this link carries.</p>
      )}
    </>
  )
}

interface GroupFormProps {
  data: GroupData
  onChange: (patch: Partial<Pick<GroupData, 'label' | 'notes'>>) => void
}

export function GroupConfigForm({ data, onChange }: GroupFormProps): JSX.Element {
  return (
    <>
      <h2 id="config-modal-title">{data.label || 'Group'}</h2>
      <p className="panel__kind">Group card</p>
      <label className="field">
        <span>Title</span>
        <input value={data.label} onChange={(e) => onChange({ label: e.target.value })} />
      </label>
      <label className="field">
        <span>Notes</span>
        <textarea
          rows={5}
          value={data.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Describe this subsystem…"
        />
      </label>
    </>
  )
}

interface ApiFormProps {
  data: ApiTableNodeData
  onChange: (patch: Partial<ApiTableNodeData>) => void
  onOpenTableEntities: () => void
  onOpenParameters: () => void
}

export function ApiConfigForm({
  data,
  onChange,
  onOpenTableEntities,
  onOpenParameters
}: ApiFormProps): JSX.Element {
  const apiType = data.apiType ?? 'rest'
  const hasParameters = apiTypeHasParameters(apiType)
  const parametersLabel = getApiParametersLabel(apiType)
  const parameterCount = getApiParameters(data).length

  return (
    <>
      <h2 id="config-modal-title">{data.label || 'API'}</h2>
      <p className="panel__kind">API endpoint</p>

      <label className="field">
        <span>Label</span>
        <input value={data.label} onChange={(e) => onChange({ label: e.target.value })} />
      </label>

      <label className="field">
        <span>API type</span>
        <select
          value={apiType}
          onChange={(e) => onChange({ apiType: e.target.value as ApiType })}
        >
          {(API_TYPES).map((type) => (
            <option key={type} value={type}>
              {API_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      <ApiStyleFields data={data} onChange={onChange} />

      {hasParameters && (
        <div className="field">
          <span>{parametersLabel}</span>
          <button type="button" className="config-flyout__trigger" onClick={onOpenParameters}>
            <span>
              {parameterCount === 0
                ? `Configure ${parametersLabel.toLowerCase()}…`
                : `${parameterCount} ${parametersLabel.toLowerCase()} · Configure…`}
            </span>
            <span className="config-flyout__chevron" aria-hidden="true">
              ›
            </span>
          </button>
        </div>
      )}

      <div className="field config-flyout">
        <span>Table entities</span>
        <button type="button" className="config-flyout__trigger">
          <span>Configure…</span>
          <span className="config-flyout__chevron" aria-hidden="true">
            ›
          </span>
        </button>
        <div className="config-flyout__menu" role="menu">
          <button type="button" role="menuitem" onClick={onOpenTableEntities}>
            Tables
          </button>
          <button type="button" role="menuitem" disabled title="Coming soon">
            Views
          </button>
        </div>
      </div>
    </>
  )
}

interface ActorFormProps {
  data: ActorNodeData
  onChange: (patch: Partial<ActorNodeData>) => void
}

export function ActorConfigForm({ data, onChange }: ActorFormProps): JSX.Element {
  return (
    <>
      <h2 id="config-modal-title">{data.label || 'Actor'}</h2>
      <p className="panel__kind">Actor</p>
      <label className="field">
        <span>Label</span>
        <input value={data.label} onChange={(event) => onChange({ label: event.target.value })} />
      </label>
    </>
  )
}

interface UseCaseFormProps {
  data: UseCaseNodeData
  apis: Array<{ id: string; label: string }>
  onChange: (patch: Partial<UseCaseNodeData>) => void
}

export function UseCaseConfigForm({ data, apis, onChange }: UseCaseFormProps): JSX.Element {
  const toggleApi = (id: string): void => {
    const selected = data.apiTableIds.includes(id)
    onChange({
      apiTableIds: selected ? data.apiTableIds.filter((item) => item !== id) : [...data.apiTableIds, id]
    })
  }

  return (
    <>
      <h2 id="config-modal-title">{data.label || 'Use case'}</h2>
      <p className="panel__kind">Use case</p>
      <label className="field">
        <span>Label</span>
        <input value={data.label} onChange={(event) => onChange({ label: event.target.value })} />
      </label>
      <fieldset className="field usecase-apis">
        <legend>Realized by</legend>
        {apis.length === 0 ? (
          <p className="usecase-apis__empty">Add APIs on this server, then link them here.</p>
        ) : (
          apis.map((api) => (
            <label key={api.id} className="usecase-apis__option">
              <input
                type="checkbox"
                checked={data.apiTableIds.includes(api.id)}
                onChange={() => toggleApi(api.id)}
              />
              <span>{api.label}</span>
            </label>
          ))
        )}
      </fieldset>
    </>
  )
}

export interface LifelineChoice {
  participant: LifelineParticipant
  refId: string
  label: string
}

interface LifelineFormProps {
  data: LifelineNodeData
  choices: LifelineChoice[]
  onChange: (patch: Partial<LifelineNodeData>) => void
}

export function LifelineConfigForm({ data, choices, onChange }: LifelineFormProps): JSX.Element {
  const selected = choices.find((choice) => choice.participant === data.participant && choice.refId === data.refId)
  const value = selected ? `${selected.participant}:${selected.refId}` : ''
  return (
    <>
      <h2 id="config-modal-title">{data.label || 'Lifeline'}</h2>
      <p className="panel__kind">Lifeline</p>
      <label className="field">
        <span>Label</span>
        <input value={data.label} onChange={(event) => onChange({ label: event.target.value })} />
      </label>
      <label className="field">
        <span>Participant</span>
        <select
          value={value}
          onChange={(event) => {
            const separator = event.target.value.indexOf(':')
            if (separator < 0) return
            const participant = event.target.value.slice(0, separator) as LifelineParticipant
            const refId = event.target.value.slice(separator + 1)
            const choice = choices.find((item) => item.participant === participant && item.refId === refId)
            onChange({
              participant,
              refId,
              ...(choice && (data.label.startsWith('Lifeline') || !data.label.trim()) ? { label: choice.label } : {})
            })
          }}
        >
          {value === '' ? <option value="">Choose a participant</option> : null}
          {choices.map((choice) => (
            <option key={`${choice.participant}:${choice.refId}`} value={`${choice.participant}:${choice.refId}`}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}

interface ActivityFormProps {
  data: ActivityStepNodeData
  apis: Array<{ id: string; label: string }>
  onChange: (patch: Partial<ActivityStepNodeData>) => void
}

export function ActivityConfigForm({ data, apis, onChange }: ActivityFormProps): JSX.Element {
  return (
    <>
      <h2 id="config-modal-title">{data.label || 'Step'}</h2>
      <p className="panel__kind">{data.kind}</p>
      <label className="field">
        <span>Label</span>
        <input value={data.label} onChange={(event) => onChange({ label: event.target.value })} />
      </label>
      {data.kind === 'action' ? (
        <label className="field">
          <span>API step</span>
          <select
            value={data.apiTableId ?? ''}
            onChange={(event) => onChange({ apiTableId: event.target.value })}
          >
            <option value="">None</option>
            {apis.map((api) => (
              <option key={api.id} value={api.id}>
                {api.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </>
  )
}

export function isLifelineDraft(data: BehaviorNodeData): data is LifelineNodeData {
  return data.kind === 'lifeline'
}
