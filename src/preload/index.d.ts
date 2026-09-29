export interface FileDialogResult {
  canceled: boolean
  path?: string
  content?: string
  legacy?: boolean
  error?: string
  package?: {
    manifest: string
    hld: string
    lldFiles: Record<string, string>
  }
}

export interface PackageSavePayload {
  path: string
  files: Record<string, string>
}

export interface PackageSaveAsPayload {
  files: Record<string, string>
  defaultName?: string
}

export interface SdlabsAPI {
  open: () => Promise<FileDialogResult>
  save: (
    payload: PackageSavePayload | { path: string; content: string }
  ) => Promise<FileDialogResult>
  saveAs: (
    payload: PackageSaveAsPayload | { content: string }
  ) => Promise<FileDialogResult>
  onMenu: (channel: string, callback: () => void) => () => void
}

declare global {
  interface Window {
    sdlab?: SdlabsAPI
  }
}

export {}
