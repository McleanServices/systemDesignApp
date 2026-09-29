import { contextBridge, ipcRenderer } from 'electron'

const MENU_CHANNELS = [
  'sdlab:menu-new',
  'sdlab:menu-open',
  'sdlab:menu-save',
  'sdlab:menu-save-as'
] as const

contextBridge.exposeInMainWorld('sdlab', {
  open: () => ipcRenderer.invoke('sdlab:open'),
  save: (payload: { path: string; content?: string; files?: Record<string, string> }) =>
    ipcRenderer.invoke('sdlab:save', payload),
  saveAs: (payload: { content?: string; files?: Record<string, string>; defaultName?: string }) =>
    ipcRenderer.invoke('sdlab:save-as', payload),
  onMenu: (channel: string, callback: () => void) => {
    if (!MENU_CHANNELS.includes(channel as (typeof MENU_CHANNELS)[number])) {
      return () => undefined
    }
    const listener = (): void => {
      callback()
    }
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  }
})
