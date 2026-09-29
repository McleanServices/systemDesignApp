import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import {
  apiTypeUsesParamLocation,
  cloneApiTableDraft,
  getApiParameters,
  getApiParametersLabel,
  setApiParameters
} from '../store/apiTableUtils'
import type { ApiParam, ApiParamLocation, ApiTableNodeData } from '../store/types'
import { API_PARAM_LOCATIONS } from '../store/types'
import { ApiParamList } from './ApiParamList'

type LocationFilter = 'all' | ApiParamLocation

interface ApiParametersModalProps {
  initialData: ApiTableNodeData
  onSave: (data: ApiTableNodeData) => void
  onClose: () => void
}

function paramLocation(param: ApiParam): ApiParamLocation {
  return param.in ?? 'query'
}

export function ApiParametersModal({
  initialData,
  onSave,
  onClose
}: ApiParametersModalProps): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<ApiTableNodeData>(() => cloneApiTableDraft(initialData))
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all')

  const showLocation = apiTypeUsesParamLocation(draft.apiType)
  const title = getApiParametersLabel(draft.apiType)
  const parameters = getApiParameters(draft)

  useEffect(() => {
    setDraft(cloneApiTableDraft(initialData))
    setLocationFilter('all')
  }, [initialData])

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

  const locationCounts = useMemo(() => {
    const counts: Record<ApiParamLocation, number> = {
      path: 0,
      query: 0,
      header: 0,
      cookie: 0
    }
    for (const param of parameters) {
      counts[paramLocation(param)] += 1
    }
    return counts
  }, [parameters])

  const visibleParameters =
    !showLocation || locationFilter === 'all'
      ? parameters
      : parameters.filter((param) => paramLocation(param) === locationFilter)

  const updateParameters = (nextVisible: ApiParam[]): void => {
    if (!showLocation || locationFilter === 'all') {
      setDraft((current) => setApiParameters(current, nextVisible))
      return
    }
    const kept = parameters.filter((param) => paramLocation(param) !== locationFilter)
    setDraft((current) => setApiParameters(current, [...kept, ...nextVisible]))
  }

  const save = (): void => {
    onSave(draft)
    onClose()
  }

  return (
    <div className="config-modal config-modal--stacked" role="presentation" onPointerDown={onClose}>
      <div
        ref={panelRef}
        className="config-modal__panel api-parameters-modal glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-parameters-modal-title"
        tabIndex={-1}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="api-parameters-modal__header">
          <h2 id="api-parameters-modal-title">{title}</h2>
          <p className="panel__kind">
            {showLocation
              ? 'Configure path, query, header, and cookie inputs for this endpoint'
              : `Configure ${title.toLowerCase()} for this endpoint`}
          </p>
        </div>
        <div className="api-parameters-modal__body">
          {showLocation && (
            <aside className="api-parameters-modal__sidebar">
              <h3 className="api-parameters-modal__sidebar-title">Locations</h3>
              <ul className="api-parameters-modal__location-list">
                <li>
                  <button
                    type="button"
                    className={locationFilter === 'all' ? 'is-active' : undefined}
                    onClick={() => setLocationFilter('all')}
                  >
                    <span>All</span>
                    <span className="api-parameters-modal__count">{parameters.length}</span>
                  </button>
                </li>
                {API_PARAM_LOCATIONS.map((location) => (
                  <li key={location}>
                    <button
                      type="button"
                      className={locationFilter === location ? 'is-active' : undefined}
                      onClick={() => setLocationFilter(location)}
                    >
                      <span>{location}</span>
                      <span className="api-parameters-modal__count">{locationCounts[location]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          )}
          <div className="api-parameters-modal__main">
            <ApiParamList
              parameters={visibleParameters}
              showLocation={showLocation}
              defaultLocation={locationFilter === 'all' ? 'query' : locationFilter}
              onChange={updateParameters}
            />
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
