import { describe, expect, it } from 'vitest'
import {
  apiTableLinkKey,
  apiTypeHasParameters,
  cloneApiTableDraft,
  flattenApiTableForSave,
  getApiParameters,
  getApiParametersLabel,
  getApiTableLinks,
  isTableLinkSelected,
  setApiParameters
} from './apiTableUtils'
import type { ApiTableNodeData } from './types'

describe('apiTableUtils', () => {
  it('migrates legacy single-table data into tableLinks', () => {
    const data: ApiTableNodeData = {
      kind: 'apiTable',
      label: 'Users API',
      sourceDatabaseId: 'database-1',
      sourceEntityId: 'entity-1',
      attributes: [{ id: 'attr-1', name: 'id', type: 'uuid', pk: true, fk: false }]
    }

    expect(getApiTableLinks(data)).toHaveLength(1)
    expect(getApiTableLinks(data)[0].sourceEntityId).toBe('entity-1')
  })

  it('tracks selected tables by link key', () => {
    const data: ApiTableNodeData = {
      kind: 'apiTable',
      label: 'API',
      attributes: [],
      tableLinks: [
        {
          sourceDatabaseId: 'database-1',
          sourceEntityId: 'entity-1',
          attributes: []
        }
      ]
    }

    expect(isTableLinkSelected(data, 'database-1', 'entity-1')).toBe(true)
    expect(isTableLinkSelected(data, 'database-1', 'entity-2')).toBe(false)
  })

  it('flattens active link back onto legacy fields for compatibility', () => {
    const data: ApiTableNodeData = {
      kind: 'apiTable',
      label: 'API',
      attributes: [],
      activeTableKey: apiTableLinkKey('database-1', 'entity-2'),
      tableLinks: [
        {
          sourceDatabaseId: 'database-1',
          sourceEntityId: 'entity-1',
          attributes: [{ id: 'a1', name: 'id', type: 'uuid', pk: true, fk: false }]
        },
        {
          sourceDatabaseId: 'database-1',
          sourceEntityId: 'entity-2',
          attributes: [{ id: 'a2', name: 'email', type: 'text', pk: false, fk: false }]
        }
      ]
    }

    const saved = flattenApiTableForSave(data)
    expect(saved.sourceEntityId).toBe('entity-2')
    expect(saved.attributes[0]?.name).toBe('email')
    expect(saved.tableLinks).toHaveLength(2)
  })

  it('clones apiConfig so draft edits do not mutate the original', () => {
    const data: ApiTableNodeData = {
      kind: 'apiTable',
      label: 'API',
      attributes: [],
      apiConfig: {
        rest: {
          method: 'POST',
          path: '/users',
          parameters: [{ id: 'p1', name: 'id', type: 'uuid', required: true, in: 'path' }]
        }
      }
    }

    const draft = cloneApiTableDraft(data)
    draft.apiConfig!.rest!.path = '/changed'
    draft.apiConfig!.rest!.parameters[0].name = 'userId'

    expect(data.apiConfig?.rest?.path).toBe('/users')
    expect(data.apiConfig?.rest?.parameters[0].name).toBe('id')
  })

  it('reads and writes REST parameters through helpers', () => {
    const data: ApiTableNodeData = {
      kind: 'apiTable',
      label: 'API',
      attributes: [],
      apiConfig: {
        rest: {
          method: 'GET',
          path: '/users',
          parameters: [{ id: 'p1', name: 'Authorization', type: 'text', required: true, in: 'header' }]
        }
      }
    }

    expect(getApiParameters(data)).toHaveLength(1)
    expect(getApiParametersLabel('rest')).toBe('Parameters')
    expect(apiTypeHasParameters('rest')).toBe(true)
    expect(apiTypeHasParameters('grpc')).toBe(false)

    const next = setApiParameters(data, [
      { id: 'p2', name: 'email', type: 'text', required: false, in: 'query' }
    ])
    expect(next.apiConfig?.rest?.parameters[0]?.name).toBe('email')
    expect(data.apiConfig?.rest?.parameters[0]?.name).toBe('Authorization')
  })
})
