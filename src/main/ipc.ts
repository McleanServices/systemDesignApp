import { dialog, ipcMain } from 'electron'
import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises'
import path from 'path'

const LEGACY_FILTERS = [{ name: 'System Design Lab', extensions: ['sdlab'] }]
const MANIFEST_FILTERS = [
  { name: 'System Design Lab Project', extensions: ['sdlab.json'] },
  { name: 'Legacy System Design Lab', extensions: ['sdlab'] }
]
const MANIFEST_NAME = 'project.sdlab.json'

export type PackageFileMap = Record<string, string>

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

async function readPackageFromRoot(root: string): Promise<{
  path: string
  package: { manifest: string; hld: string; lldFiles: PackageFileMap }
}> {
  const manifestPath = path.join(root, MANIFEST_NAME)
  const manifestRaw = await readFile(manifestPath, 'utf8')
  const manifest = JSON.parse(manifestRaw) as {
    hld?: string
    lld?: Record<string, string>
  }
  if (typeof manifest.hld !== 'string' || !manifest.hld) {
    throw new Error('Project manifest is missing hld path')
  }

  const hldRaw = await readFile(path.join(root, manifest.hld), 'utf8')
  const lldFiles: PackageFileMap = {}
  const lldIndex = manifest.lld && typeof manifest.lld === 'object' ? manifest.lld : {}

  for (const relative of Object.values(lldIndex)) {
    if (typeof relative !== 'string' || !relative) continue
    const absolute = path.join(root, relative)
    lldFiles[relative.replace(/\\/g, '/')] = await readFile(absolute, 'utf8')
  }

  return {
    path: root,
    package: {
      manifest: manifestRaw,
      hld: hldRaw,
      lldFiles
    }
  }
}

async function writePackageToRoot(root: string, files: PackageFileMap): Promise<void> {
  await mkdir(root, { recursive: true })

  const lldDir = path.join(root, 'lld')
  if (await pathExists(lldDir)) {
    await rm(lldDir, { recursive: true, force: true })
  }

  for (const [relative, content] of Object.entries(files)) {
    const normalized = relative.replace(/\\/g, '/')
    const absolute = path.join(root, normalized)
    await mkdir(path.dirname(absolute), { recursive: true })
    await writeFile(absolute, content, 'utf8')
  }
}

export function registerFileIpc(): void {
  ipcMain.handle('sdlab:open', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Design',
      properties: ['openFile', 'openDirectory'],
      filters: MANIFEST_FILTERS
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }

    const selected = result.filePaths[0]
    const selectedStat = await stat(selected)

    try {
      if (selectedStat.isDirectory()) {
        const packed = await readPackageFromRoot(selected)
        return { canceled: false, ...packed }
      }

      const base = path.basename(selected)
      if (base === MANIFEST_NAME) {
        const packed = await readPackageFromRoot(path.dirname(selected))
        return { canceled: false, ...packed }
      }

      if (selected.endsWith('.sdlab')) {
        const content = await readFile(selected, 'utf8')
        return { canceled: false, path: selected, content, legacy: true }
      }

      // Allow opening hld.sdlab.json by resolving sibling manifest
      if (base.endsWith('.sdlab.json')) {
        const root = path.dirname(selected)
        if (await pathExists(path.join(root, MANIFEST_NAME))) {
          const packed = await readPackageFromRoot(root)
          return { canceled: false, ...packed }
        }
      }

      return { canceled: true, error: 'Select a project folder or project.sdlab.json' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open project'
      return { canceled: true, error: message }
    }
  })

  ipcMain.handle(
    'sdlab:save',
    async (
      _event,
      payload: { path: string; files?: PackageFileMap; content?: string }
    ) => {
      if (!payload?.path) {
        return { canceled: true }
      }

      try {
        if (payload.files && typeof payload.files === 'object') {
          const root = payload.path.endsWith('.sdlab') ? payload.path.replace(/\.sdlab$/i, '') : payload.path
          await writePackageToRoot(root, payload.files)
          return { canceled: false, path: root }
        }

        if (typeof payload.content === 'string') {
          await writeFile(payload.path, payload.content, 'utf8')
          return { canceled: false, path: payload.path }
        }

        return { canceled: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save project'
        return { canceled: true, error: message }
      }
    }
  )

  ipcMain.handle(
    'sdlab:save-as',
    async (_event, payload: { files?: PackageFileMap; content?: string; defaultName?: string }) => {
      try {
        if (payload?.files && typeof payload.files === 'object') {
          const result = await dialog.showOpenDialog({
            title: 'Save Design Package',
            properties: ['openDirectory', 'createDirectory'],
            buttonLabel: 'Save Here'
          })
          if (result.canceled || result.filePaths.length === 0) {
            return { canceled: true }
          }

          const parent = result.filePaths[0]
          const folderName = (payload.defaultName || 'untitled').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
          let root = path.join(parent, folderName)

          // If user already selected a folder that looks like a project, write into it.
          if (await pathExists(path.join(parent, MANIFEST_NAME))) {
            root = parent
          } else if (await pathExists(root)) {
            // Keep writing into the named folder even if it exists.
          }

          await writePackageToRoot(root, payload.files)
          return { canceled: false, path: root }
        }

        if (typeof payload?.content === 'string') {
          const result = await dialog.showSaveDialog({
            title: 'Save Design',
            filters: LEGACY_FILTERS,
            defaultPath: 'untitled.sdlab'
          })
          if (result.canceled || !result.filePath) {
            return { canceled: true }
          }
          const filePath = result.filePath.endsWith('.sdlab')
            ? result.filePath
            : `${result.filePath}.sdlab`
          await writeFile(filePath, payload.content, 'utf8')
          return { canceled: false, path: filePath }
        }

        return { canceled: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save project'
        return { canceled: true, error: message }
      }
    }
  )
}
