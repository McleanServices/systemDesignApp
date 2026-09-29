import type { Edge, Viewport } from '@xyflow/react'
import { parseProject, PROJECT_VERSION, normalizeProject, type ProjectDocument } from './schema'
import type { CableData, CanvasNode, CanvasNodeData, DeviceData } from './types'
import { isDeviceData, isDeviceNode } from './types'

export const PACKAGE_FORMAT = 'sdlab-package' as const
export const PACKAGE_VERSION = 1
export const MANIFEST_FILENAME = 'project.sdlab.json'
export const HLD_FILENAME = 'hld.sdlab.json'
export const LLD_DIR = 'lld'

export interface ProjectManifest {
  version: number
  format: typeof PACKAGE_FORMAT
  name: string
  hld: string
  lld: Record<string, string>
}

export interface LldDocument {
  version: number
  nodeId: string
  kind: string
  data: Record<string, unknown>
}

export interface HldDocument {
  version: number
  nodes: Array<Record<string, unknown>>
  edges: Edge<CableData>[]
  viewport: Viewport
}

export interface ProjectPackageFiles {
  manifest: ProjectManifest
  hld: HldDocument
  /** Relative path → LLD document */
  lldFiles: Record<string, LldDocument>
}

const HLD_DEVICE_KEYS = new Set(['kind', 'label'])

function lldPathFor(nodeId: string): string {
  const safe = nodeId.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
  return `${LLD_DIR}/${safe}.sdlab.json`
}

function stripUiFields(node: CanvasNode): Record<string, unknown> {
  const {
    selected: _selected,
    dragging: _dragging,
    measured: _measured,
    resizing: _resizing,
    ...rest
  } = node as CanvasNode & {
    selected?: boolean
    dragging?: boolean
    measured?: unknown
    resizing?: boolean
  }
  return { ...rest }
}

function splitDeviceData(data: DeviceData): {
  hldData: Pick<DeviceData, 'kind' | 'label'>
  lldData: Record<string, unknown>
} {
  const hldData = { kind: data.kind, label: data.label }
  const lldData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (HLD_DEVICE_KEYS.has(key)) continue
    lldData[key] = value
  }
  return { hldData, lldData }
}

/** Split a merged project document into HLD + per-node LLD package files. */
export function splitProjectPackage(doc: Omit<ProjectDocument, 'version'>): ProjectPackageFiles {
  const normalized = normalizeProject(doc)
  const lld: Record<string, string> = {}
  const lldFiles: Record<string, LldDocument> = {}

  const nodes = normalized.nodes.map((node) => {
    const base = stripUiFields(node)

    if (!isDeviceNode(node) || !isDeviceData(node.data)) {
      return base
    }

    const path = lldPathFor(node.id)
    const { hldData, lldData } = splitDeviceData(node.data)
    lld[node.id] = path
    lldFiles[path] = {
      version: PACKAGE_VERSION,
      nodeId: node.id,
      kind: node.data.kind,
      data: lldData
    }

    return {
      ...base,
      data: hldData,
      lld: path
    }
  })

  return {
    manifest: {
      version: PACKAGE_VERSION,
      format: PACKAGE_FORMAT,
      name: normalized.name,
      hld: HLD_FILENAME,
      lld
    },
    hld: {
      version: PACKAGE_VERSION,
      nodes,
      edges: normalized.edges.map((edge) => {
        const { selected: _selected, ...rest } = edge as Edge<CableData> & { selected?: boolean }
        return rest
      }),
      viewport: normalized.viewport
    },
    lldFiles
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

/** Merge package files back into a single ProjectDocument (via parseProject). */
export function mergeProjectPackage(files: {
  manifest: unknown
  hld: unknown
  lldFiles: Record<string, unknown>
}): ProjectDocument {
  if (!isRecord(files.manifest)) {
    throw new Error('Invalid project manifest')
  }
  const manifest = files.manifest
  if (manifest.format !== PACKAGE_FORMAT) {
    throw new Error('Unsupported project package format')
  }
  if (manifest.version !== PACKAGE_VERSION) {
    throw new Error('Unsupported or missing project package version')
  }
  if (typeof manifest.name !== 'string') {
    throw new Error('Invalid project name')
  }
  if (!isRecord(files.hld) || !Array.isArray(files.hld.nodes) || !Array.isArray(files.hld.edges)) {
    throw new Error('Invalid HLD document')
  }

  const lldIndex = isRecord(manifest.lld) ? (manifest.lld as Record<string, string>) : {}

  const mergedNodes = files.hld.nodes.map((raw) => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !isRecord(raw.data)) {
      throw new Error('Invalid HLD node')
    }

    const declaredPath =
      (typeof raw.lld === 'string' && raw.lld) ||
      (typeof lldIndex[raw.id] === 'string' ? lldIndex[raw.id] : undefined)

    if (!declaredPath) {
      const { lld: _lld, ...rest } = raw
      return rest
    }

    const lldRaw = files.lldFiles[declaredPath]
    if (!isRecord(lldRaw)) {
      throw new Error(`Missing LLD file: ${declaredPath}`)
    }
    if (lldRaw.version !== PACKAGE_VERSION) {
      throw new Error(`Unsupported LLD version in ${declaredPath}`)
    }
    if (lldRaw.nodeId !== raw.id) {
      throw new Error(`LLD nodeId mismatch in ${declaredPath}`)
    }
    if (!isRecord(lldRaw.data)) {
      throw new Error(`Invalid LLD data in ${declaredPath}`)
    }

    const hldData = raw.data as CanvasNodeData
    const mergedData = {
      ...lldRaw.data,
      kind: hldData.kind,
      label: typeof hldData.label === 'string' ? hldData.label : String(lldRaw.kind ?? 'Node')
    }

    const { lld: _lld, ...rest } = raw
    return { ...rest, data: mergedData }
  })

  const legacyDoc = {
    version: PROJECT_VERSION,
    name: manifest.name,
    nodes: mergedNodes,
    edges: files.hld.edges,
    viewport: files.hld.viewport ?? { x: 0, y: 0, zoom: 1 }
  }

  return parseProject(JSON.stringify(legacyDoc))
}

export function stringifyPackageFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}
