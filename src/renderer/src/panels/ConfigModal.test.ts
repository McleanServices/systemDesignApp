/**
 * @vitest-environment happy-dom
 */
import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useDesignStore } from '../store/designStore'
import { isApiTableNode } from '../store/types'
import { ConfigModal } from './ConfigModal'

describe('ConfigModal properties', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    useDesignStore.getState().newDesign()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  async function showProperties(targetId: string): Promise<void> {
    await act(async () => {
      root.render(createElement(ConfigModal, { targetId, onClose: () => undefined }))
    })
  }

  it('opens API properties inside an app server without crashing', async () => {
    useDesignStore.getState().addDevice('appServer', { x: 0, y: 0 })
    const server = useDesignStore.getState().nodes[0]
    useDesignStore.getState().enterAppServer(server.id)
    useDesignStore.getState().addApiTable({ x: 40, y: 40 })
    const api = useDesignStore.getState().nodes.find(isApiTableNode)
    expect(api).toBeTruthy()

    await showProperties(api!.id)

    expect(host.textContent).toContain('API endpoint')
    expect(host.textContent).toContain('API 1')
    expect(host.querySelector('input')?.value).toBe('API 1')
  })

  it('opens device properties on the high-level canvas', async () => {
    useDesignStore.getState().addDevice('database', { x: 0, y: 0 })
    const database = useDesignStore.getState().nodes[0]

    await showProperties(database.id)

    expect(host.textContent).toContain('database')
    expect(host.querySelector('input')?.value).toBe(database.data && 'label' in database.data ? database.data.label : '')
  })
})
