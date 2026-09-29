import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'

export function buildAppMenu(getWindow: () => BrowserWindow | null): Menu {
  const send = (channel: string): void => {
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel)
    }
  }

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => send('sdlab:menu-new') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => send('sdlab:menu-open') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('sdlab:menu-save') },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => send('sdlab:menu-save-as')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]

  return Menu.buildFromTemplate(template)
}
