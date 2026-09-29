import { useMemo, type ChangeEvent, type JSX } from 'react'
import {
  diffApiAttributes,
  resolveApiAttributes,
  type ApiAttributeSyncStatus
} from '../store/graphQueries'
import type { ApiAttributeRef, ApiTableNodeData, CanvasNode } from '../store/types'

function statusHint(status: ApiAttributeSyncStatus): string | null {
  if (status === 'missing') return 'Missing from source table'
  if (status === 'drifted') return 'Out of sync with DB'
  return null
}

interface ApiTableAttributeEditorProps {
  data: ApiTableNodeData
  rootNodes: CanvasNode[]
  onChange: (patch: Partial<ApiTableNodeData>) => void
}

export function ApiTableAttributeEditor({
  data,
  rootNodes,
  onChange
}: ApiTableAttributeEditorProps): JSX.Element {
  const { sourceAttributes, sourceMissing, attributeStatus } = useMemo(() => {
    const resolved = resolveApiAttributes(data.sourceDatabaseId, data.sourceEntityId, rootNodes)
    const sourceLinked = Boolean(data.sourceDatabaseId && data.sourceEntityId)
    const diffs = diffApiAttributes(data.attributes, resolved.attributes, resolved.missing, sourceLinked)
    return {
      sourceAttributes: resolved.attributes,
      sourceMissing: resolved.missing,
      attributeStatus: new Map(diffs.map((diff) => [diff.id, diff.status]))
    }
  }, [rootNodes, data.sourceDatabaseId, data.sourceEntityId, data.attributes])

  const setAttributes = (attributes: ApiAttributeRef[]): void => {
    onChange({ attributes })
  }

  const onAttributeChange = (
    attributeId: string,
    patch: Partial<Pick<ApiAttributeRef, 'name' | 'type' | 'pk' | 'fk'>>
  ): void => {
    setAttributes(
      data.attributes.map((attribute) =>
        attribute.id === attributeId ? { ...attribute, ...patch } : attribute
      )
    )
  }

  const addAttribute = (): void => {
    setAttributes([
      ...data.attributes,
      { id: `attr-${Date.now()}`, name: '', type: 'text', pk: false, fk: false, fromSource: false }
    ])
  }

  const addFromSource = (event: ChangeEvent<HTMLSelectElement>): void => {
    const attributeId = event.target.value
    event.target.value = ''
    if (!attributeId) return
    const source = sourceAttributes.find((attribute) => attribute.id === attributeId)
    if (!source) return
    if (data.attributes.some((attribute) => attribute.id === source.id || attribute.name === source.name)) {
      return
    }
    setAttributes([...data.attributes, { ...source, fromSource: true }])
  }

  const removeAttribute = (attributeId: string): void => {
    setAttributes(data.attributes.filter((attribute) => attribute.id !== attributeId))
  }

  const unusedSourceAttributes = sourceAttributes.filter(
    (source) =>
      !data.attributes.some((attribute) => attribute.id === source.id || attribute.name === source.name)
  )

  const hasSource = Boolean(data.sourceDatabaseId && data.sourceEntityId)

  return (
    <div className="api-table-editor">
      {!hasSource && (
        <p className="api-table-editor__hint">Select a table from the sidebar to configure attributes.</p>
      )}
      {sourceMissing && hasSource && (
        <div className="api-table-editor__missing">Source table not found</div>
      )}
      <div className="api-table-editor__attributes">
        {data.attributes.map((attribute) => {
          const status = attributeStatus.get(attribute.id) ?? 'ok'
          const hint = statusHint(status)
          const errored = status === 'missing' || status === 'drifted'
          return (
            <div key={attribute.id} className="api-table-editor__attr">
              <div
                className={['api-table-editor__row', errored ? 'api-table-editor__row--error' : ''].join(' ')}
              >
                <input
                  className="api-table-editor__field api-table-editor__field--name"
                  value={attribute.name}
                  placeholder="name"
                  onChange={(event) => onAttributeChange(attribute.id, { name: event.target.value })}
                />
                <input
                  className="api-table-editor__field api-table-editor__field--type"
                  value={attribute.type}
                  placeholder="type"
                  onChange={(event) => onAttributeChange(attribute.id, { type: event.target.value })}
                />
                <label className="api-table-editor__flag" title="Primary key">
                  <input
                    type="checkbox"
                    checked={attribute.pk}
                    onChange={(event) => onAttributeChange(attribute.id, { pk: event.target.checked })}
                  />
                  PK
                </label>
                <label className="api-table-editor__flag" title="Foreign key">
                  <input
                    type="checkbox"
                    checked={attribute.fk}
                    onChange={(event) => onAttributeChange(attribute.id, { fk: event.target.checked })}
                  />
                  FK
                </label>
                <button
                  type="button"
                  className="api-table-editor__remove"
                  aria-label="Remove attribute"
                  onClick={() => removeAttribute(attribute.id)}
                >
                  ×
                </button>
              </div>
              {hint && <div className="api-table-editor__row-hint">{hint}</div>}
            </div>
          )
        })}
        {hasSource && unusedSourceAttributes.length > 0 && (
          <select
            className="api-table-editor__select api-table-editor__select--add"
            defaultValue=""
            onChange={addFromSource}
            aria-label="Add attribute from source table"
          >
            <option value="">+ From table…</option>
            {unusedSourceAttributes.map((attribute) => (
              <option key={attribute.id} value={attribute.id}>
                {attribute.name || '(unnamed)'} ({attribute.type})
              </option>
            ))}
          </select>
        )}
        {hasSource && (
          <button type="button" className="api-table-editor__add" onClick={addAttribute}>
            + Attribute
          </button>
        )}
      </div>
    </div>
  )
}
