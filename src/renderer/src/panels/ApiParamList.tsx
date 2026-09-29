import type { JSX } from 'react'
import { newApiParam } from '../store/apiTableUtils'
import type { ApiParam, ApiParamLocation } from '../store/types'
import { API_PARAM_LOCATIONS } from '../store/types'

interface ApiParamListProps {
  parameters: ApiParam[]
  showLocation?: boolean
  defaultLocation?: ApiParamLocation
  onChange: (parameters: ApiParam[]) => void
}

export function ApiParamList({
  parameters,
  showLocation,
  defaultLocation = 'query',
  onChange
}: ApiParamListProps): JSX.Element {
  return (
    <div className="api-param-list">
      {parameters.length === 0 ? (
        <p className="api-parameters-modal__empty">No parameters yet. Add one to define this endpoint’s inputs.</p>
      ) : (
        parameters.map((param, index) => (
          <div key={param.id} className={showLocation ? 'api-param-row api-param-row--rest' : 'api-param-row'}>
            {showLocation && (
              <select
                aria-label="Location"
                value={param.in ?? 'query'}
                onChange={(e) =>
                  onChange(
                    parameters.map((item, i) =>
                      i === index ? { ...item, in: e.target.value as ApiParam['in'] } : item
                    )
                  )
                }
              >
                {API_PARAM_LOCATIONS.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            )}
            <input
              aria-label="Name"
              placeholder="name"
              value={param.name}
              onChange={(e) =>
                onChange(parameters.map((item, i) => (i === index ? { ...item, name: e.target.value } : item)))
              }
            />
            <input
              aria-label="Type"
              placeholder="type"
              value={param.type}
              onChange={(e) =>
                onChange(parameters.map((item, i) => (i === index ? { ...item, type: e.target.value } : item)))
              }
            />
            <label className="api-param-row__required">
              <input
                type="checkbox"
                checked={param.required}
                onChange={(e) =>
                  onChange(
                    parameters.map((item, i) => (i === index ? { ...item, required: e.target.checked } : item))
                  )
                }
              />
              req
            </label>
            <button
              type="button"
              className="api-param-row__remove"
              aria-label="Remove parameter"
              onClick={() => onChange(parameters.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </div>
        ))
      )}
      <button
        type="button"
        className="api-param-add"
        onClick={() => onChange([...parameters, newApiParam(showLocation ? defaultLocation : undefined)])}
      >
        Add parameter
      </button>
    </div>
  )
}
