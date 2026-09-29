import { useEffect, useMemo, useRef, useState, type JSX } from 'react'

import type { ApiCallNodeData, ApiParam, ApiParamLocation } from '../store/types'

import { API_PARAM_LOCATIONS } from '../store/types'

import type { AppServerApiOption } from '../store/graphQueries'

import { cloneApiCallDraft } from './ApiCallConfigForm'



type LocationFilter = 'all' | ApiParamLocation



interface ApiCallParametersModalProps {

  initialData: ApiCallNodeData

  api: AppServerApiOption

  appServerLabel: string

  onSave: (data: ApiCallNodeData) => void

  onClose: () => void

}



function paramLocation(param: ApiParam): ApiParamLocation {

  return param.in ?? 'query'

}



export function ApiCallParametersModal({

  initialData,

  api,

  appServerLabel,

  onSave,

  onClose

}: ApiCallParametersModalProps): JSX.Element {

  const panelRef = useRef<HTMLDivElement>(null)

  const [draft, setDraft] = useState<ApiCallNodeData>(() => cloneApiCallDraft(initialData))

  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all')



  const parameters = api.parameters



  useEffect(() => {

    setDraft(cloneApiCallDraft(initialData))

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

    locationFilter === 'all'

      ? parameters

      : parameters.filter((param) => paramLocation(param) === locationFilter)



  const setParamValue = (paramId: string, value: string): void => {

    setDraft((current) => ({

      ...current,

      paramValues: {

        ...(current.paramValues ?? {}),

        [paramId]: value

      }

    }))

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

        aria-labelledby="api-call-parameters-modal-title"

        tabIndex={-1}

        onPointerDown={(event) => event.stopPropagation()}

      >

        <div className="api-parameters-modal__header">

          <h2 id="api-call-parameters-modal-title">Parameter values</h2>

          <p className="panel__kind">

            {api.label}

            <span className="api-call-parameters-modal__api-meta">

              {' '}

              · {api.summary} · {appServerLabel}

            </span>

          </p>

        </div>

        <div className="api-parameters-modal__body">

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

          <div className="api-parameters-modal__main">

            {visibleParameters.length === 0 ? (

              <p className="api-parameters-modal__empty">

                {parameters.length === 0

                  ? 'This API has no parameters.'

                  : 'No parameters in this location.'}

              </p>

            ) : (

              <div className="api-call-params">

                {visibleParameters.map((param) => {

                  const value = draft.paramValues?.[param.id] ?? ''

                  const emptyRequired = param.required && value.trim() === ''

                  return (

                    <label

                      key={param.id}

                      className={

                        emptyRequired

                          ? 'api-call-params__row api-call-params__row--error'

                          : 'api-call-params__row'

                      }

                    >

                      <span className="api-call-params__meta">

                        <strong>{param.name}</strong>

                        <span>

                          {param.in ?? 'query'} · {param.type}

                          {param.required ? ' · required' : ''}

                        </span>

                      </span>

                      <input

                        value={value}

                        placeholder={param.description ?? ''}

                        onChange={(e) => setParamValue(param.id, e.target.value)}

                      />

                      {emptyRequired && (

                        <span className="api-call-params__hint">Required value is empty</span>

                      )}

                    </label>

                  )

                })}

              </div>

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


