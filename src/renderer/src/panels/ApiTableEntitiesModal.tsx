import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import {
  apiTableLinkKey,
  cloneApiTableDraft,
  flattenApiTableForSave,
  getActiveTableKey,
  getActiveTableLink,
  getApiTableLinks,
  isTableLinkSelected
} from '../store/apiTableUtils'
import { findReachableDatabases, getDatabaseTables } from '../store/graphQueries'
import { useDesignStore } from '../store/designStore'
import type { ApiTableLink, ApiTableNodeData, CanvasNode, CableData } from '../store/types'
import { isDeviceNode } from '../store/types'
import type { Edge } from '@xyflow/react'
import { ApiTableAttributeEditor } from './ApiTableAttributeEditor'

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

function initialExpandedDatabases(data: ApiTableNodeData, databases: CanvasNode[]): Set<string> {
  const expanded = new Set<string>()
  for (const link of getApiTableLinks(data)) {
    expanded.add(link.sourceDatabaseId)
  }
  if (expanded.size === 0 && databases[0]) {
    expanded.add(databases[0].id)
  }
  return expanded
}

interface ApiTableEntitiesModalProps {
  nodeId: string
  initialData: ApiTableNodeData
  onSave: (data: ApiTableNodeData) => void
  onClose: () => void
}

export function ApiTableEntitiesModal({
  nodeId,
  initialData,
  onSave,
  onClose
}: ApiTableEntitiesModalProps): JSX.Element {
  const ownerId = useDesignStore((s) => s.drillPath[s.drillPath.length - 1] ?? null)
  const rootNodes = useDesignStore(rootGraphNodes)
  const rootEdges = useDesignStore(rootGraphEdges)
  const panelRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<ApiTableNodeData>(() => cloneApiTableDraft(initialData))

  const databases = useMemo(() => {
    if (!ownerId) return [] as CanvasNode[]
    return findReachableDatabases(ownerId, rootNodes, rootEdges)
  }, [ownerId, rootNodes, rootEdges])

  const [expandedDatabases, setExpandedDatabases] = useState<Set<string>>(() =>
    initialExpandedDatabases(initialData, databases)
  )

  useEffect(() => {
    setDraft(cloneApiTableDraft(initialData))
    setExpandedDatabases(initialExpandedDatabases(initialData, databases))
  }, [initialData, nodeId, databases])

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  const activeKey = getActiveTableKey(draft)
  const activeLink = getActiveTableLink(draft)

  const toggleDatabase = useCallback((databaseId: string): void => {
    setExpandedDatabases((current) => {
      const next = new Set(current)
      if (next.has(databaseId)) next.delete(databaseId)
      else next.add(databaseId)
      return next
    })
  }, [])

  const focusTable = useCallback((databaseId: string, entityId: string): void => {
    const key = apiTableLinkKey(databaseId, entityId)
    setDraft((current) => {
      if (!isTableLinkSelected(current, databaseId, entityId)) return current
      return { ...current, activeTableKey: key }
    })
    setExpandedDatabases((current) => new Set(current).add(databaseId))
  }, [])

  const toggleTable = useCallback((databaseId: string, entityId: string, enabled: boolean): void => {
    const key = apiTableLinkKey(databaseId, entityId)
    setDraft((current) => {
      const links = getApiTableLinks(current)
      if (enabled) {
        if (links.some((link) => apiTableLinkKey(link.sourceDatabaseId, link.sourceEntityId) === key)) {
          return { ...current, activeTableKey: key, tableLinks: links }
        }
        const nextLinks: ApiTableLink[] = [
          ...links,
          { sourceDatabaseId: databaseId, sourceEntityId: entityId, attributes: [] }
        ]
        return { ...current, tableLinks: nextLinks, activeTableKey: key }
      }

      const nextLinks = links.filter(
        (link) => apiTableLinkKey(link.sourceDatabaseId, link.sourceEntityId) !== key
      )
      const nextActive =
        current.activeTableKey === key
          ? nextLinks[0]
            ? apiTableLinkKey(nextLinks[0].sourceDatabaseId, nextLinks[0].sourceEntityId)
            : undefined
          : current.activeTableKey
      return { ...current, tableLinks: nextLinks, activeTableKey: nextActive }
    })
    setExpandedDatabases((current) => new Set(current).add(databaseId))
  }, [])

  const updateActiveLink = useCallback((patch: Partial<ApiTableLink>): void => {
    if (!activeKey) return
    setDraft((current) => {
      const links = getApiTableLinks(current)
      const nextLinks = links.map((link) => {
        if (apiTableLinkKey(link.sourceDatabaseId, link.sourceEntityId) !== activeKey) return link
        return {
          ...link,
          ...patch,
          attributes: patch.attributes ?? link.attributes
        }
      })
      return flattenApiTableForSave({ ...current, tableLinks: nextLinks, activeTableKey: activeKey })
    })
  }, [activeKey])

  const editorData: ApiTableNodeData | null = activeLink
    ? {
        ...draft,
        sourceDatabaseId: activeLink.sourceDatabaseId,
        sourceEntityId: activeLink.sourceEntityId,
        attributes: activeLink.attributes
      }
    : null

  const save = (): void => {
    onSave(flattenApiTableForSave(draft))
    onClose()
  }

  return (
    <div className="config-modal config-modal--stacked" role="presentation" onPointerDown={onClose}>
      <div
        ref={panelRef}
        className="config-modal__panel table-entities-modal glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-entities-modal-title"
        tabIndex={-1}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="table-entities-modal__header">
          <h2 id="table-entities-modal-title">Table entities</h2>
          <p className="panel__kind">Select tables for this API, then configure exposed attributes</p>
        </div>
        <div className="table-entities-modal__body">
          <aside className="table-entities-modal__sidebar">
            <h3 className="table-entities-modal__sidebar-title">Databases</h3>
            {databases.length === 0 ? (
              <p className="table-entities-modal__empty">
                No reachable databases. Connect this app server to a database.
              </p>
            ) : (
              <div className="table-entities-accordion">
                {databases.map((database) => {
                  const expanded = expandedDatabases.has(database.id)
                  const tables = getDatabaseTables(database)
                  const selectedCount = tables.filter((table) =>
                    isTableLinkSelected(draft, database.id, table.id)
                  ).length
                  const label = isDeviceNode(database) ? database.data.label : database.id
                  return (
                    <section key={database.id} className="table-entities-accordion__item">
                      <button
                        type="button"
                        className={
                          expanded
                            ? 'table-entities-accordion__trigger is-open'
                            : 'table-entities-accordion__trigger'
                        }
                        aria-expanded={expanded}
                        onClick={() => toggleDatabase(database.id)}
                      >
                        <span className="table-entities-accordion__label">{label}</span>
                        <span className="table-entities-accordion__meta">
                          {selectedCount > 0 ? `${selectedCount} selected` : `${tables.length} tables`}
                        </span>
                        <span className="table-entities-accordion__chevron" aria-hidden="true">
                          {expanded ? '▾' : '▸'}
                        </span>
                      </button>
                      {expanded && (
                        <ul className="table-entities-accordion__panel">
                          {tables.length === 0 ? (
                            <li className="table-entities-modal__empty">No tables in ERD</li>
                          ) : (
                            tables.map((table) => {
                              const key = apiTableLinkKey(database.id, table.id)
                              const checked = isTableLinkSelected(draft, database.id, table.id)
                              const active = activeKey === key
                              return (
                                <li key={table.id}>
                                  <div
                                    className={[
                                      'table-entities-table-row',
                                      active ? 'is-active' : '',
                                      checked ? 'is-checked' : ''
                                    ].join(' ')}
                                  >
                                    <label className="table-entities-table-row__check">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(event) =>
                                          toggleTable(database.id, table.id, event.target.checked)
                                        }
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      className="table-entities-table-row__name"
                                      disabled={!checked}
                                      onClick={() => focusTable(database.id, table.id)}
                                    >
                                      {table.label}
                                    </button>
                                  </div>
                                </li>
                              )
                            })
                          )}
                        </ul>
                      )}
                    </section>
                  )
                })}
              </div>
            )}
          </aside>
          <div className="table-entities-modal__main">
            {editorData ? (
              <ApiTableAttributeEditor
                data={editorData}
                rootNodes={rootNodes}
                onChange={(patch) => {
                  if (patch.attributes) updateActiveLink({ attributes: patch.attributes })
                }}
              />
            ) : (
              <p className="api-table-editor__hint">
                Expand a database and check the tables this API should use.
              </p>
            )}
          </div>
        </div>
        <div className="config-modal__footer">
          <button type="button" className="glass-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="glass-btn glass-btn--accent" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
