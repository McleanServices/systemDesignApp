import { useCallback, useEffect } from 'react'
import { useDesignStore } from '../store/designStore'
import {
  HLD_FILENAME,
  MANIFEST_FILENAME,
  mergeProjectPackage,
  splitProjectPackage,
  stringifyPackageFile
} from '../store/projectPackage'

async function confirmDiscard(): Promise<boolean> {
  const { dirty } = useDesignStore.getState()
  if (!dirty) return true
  return window.confirm('Discard unsaved changes?')
}

function packageFilesFromState(): Record<string, string> {
  const doc = useDesignStore.getState().toDocument()
  const packed = splitProjectPackage(doc)
  const files: Record<string, string> = {
    [MANIFEST_FILENAME]: stringifyPackageFile(packed.manifest),
    [HLD_FILENAME]: stringifyPackageFile(packed.hld)
  }
  for (const [relative, lld] of Object.entries(packed.lldFiles)) {
    files[relative] = stringifyPackageFile(lld)
  }
  return files
}

function loadOpenedResult(result: {
  path?: string
  content?: string
  legacy?: boolean
  package?: { manifest: string; hld: string; lldFiles: Record<string, string> }
  error?: string
}): void {
  if (result.error) {
    window.alert(result.error)
    return
  }
  if (!result.path) return

  if (result.package) {
    const lldFiles: Record<string, unknown> = {}
    for (const [relative, raw] of Object.entries(result.package.lldFiles)) {
      lldFiles[relative] = JSON.parse(raw)
    }
    const doc = mergeProjectPackage({
      manifest: JSON.parse(result.package.manifest),
      hld: JSON.parse(result.package.hld),
      lldFiles
    })
    useDesignStore.getState().loadDocument(doc, result.path)
    return
  }

  if (result.content) {
    useDesignStore.getState().loadFromJson(result.content, result.path)
  }
}

export function useProjectActions(): {
  newFile: () => Promise<void>
  openFile: () => Promise<void>
  saveFile: () => Promise<void>
  saveFileAs: () => Promise<void>
} {
  const newFile = useCallback(async () => {
    if (!(await confirmDiscard())) return
    useDesignStore.getState().newDesign()
  }, [])

  const openFile = useCallback(async () => {
    if (!window.sdlab) {
      window.alert('Native Open is available in the desktop app.')
      return
    }
    if (!(await confirmDiscard())) return
    const result = await window.sdlab.open()
    if (result.canceled) {
      if (result.error) window.alert(result.error)
      return
    }
    try {
      loadOpenedResult(result)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to open project')
    }
  }, [])

  const saveFile = useCallback(async () => {
    const state = useDesignStore.getState()
    if (!window.sdlab) {
      window.alert('Native Save is available in the desktop app.')
      return
    }
    const files = packageFilesFromState()
    if (state.filePath) {
      const result = await window.sdlab.save({ path: state.filePath, files })
      if (result.error) window.alert(result.error)
      if (!result.canceled && result.path) state.markSaved(result.path)
      return
    }
    const result = await window.sdlab.saveAs({ files, defaultName: state.name || 'untitled' })
    if (result.error) window.alert(result.error)
    if (!result.canceled && result.path) state.markSaved(result.path)
  }, [])

  const saveFileAs = useCallback(async () => {
    const state = useDesignStore.getState()
    if (!window.sdlab) {
      window.alert('Native Save As is available in the desktop app.')
      return
    }
    const files = packageFilesFromState()
    const result = await window.sdlab.saveAs({ files, defaultName: state.name || 'untitled' })
    if (result.error) window.alert(result.error)
    if (!result.canceled && result.path) state.markSaved(result.path)
  }, [])

  useEffect(() => {
    if (!window.sdlab) return
    const offs = [
      window.sdlab.onMenu('sdlab:menu-new', () => {
        void newFile()
      }),
      window.sdlab.onMenu('sdlab:menu-open', () => {
        void openFile()
      }),
      window.sdlab.onMenu('sdlab:menu-save', () => {
        void saveFile()
      }),
      window.sdlab.onMenu('sdlab:menu-save-as', () => {
        void saveFileAs()
      })
    ]
    return () => offs.forEach((off) => off())
  }, [newFile, openFile, saveFile, saveFileAs])

  return { newFile, openFile, saveFile, saveFileAs }
}
