import type { CanvasNode } from './types'
import { isDeviceNode, isGroupNode } from './types'

export const DEVICE_NODE_WIDTH = 116
export const DEVICE_NODE_HEIGHT = 86
export const GROUP_PAD_X = 24
export const GROUP_PAD_TOP = 88
export const GROUP_PAD_BOTTOM = 24

export function nodeSize(node: CanvasNode): { width: number; height: number } {
  if (isGroupNode(node)) {
    return {
      width: Number(node.style?.width ?? node.width ?? 240),
      height: Number(node.style?.height ?? node.height ?? 160)
    }
  }
  return { width: DEVICE_NODE_WIDTH, height: DEVICE_NODE_HEIGHT }
}

export function absolutePosition(
  node: CanvasNode,
  nodes: CanvasNode[],
  seen: Set<string> = new Set()
): { x: number; y: number } {
  if (!node.parentId || seen.has(node.id)) return { ...node.position }
  seen.add(node.id)
  const parent = nodes.find((item) => item.id === node.parentId)
  if (!parent) return { ...node.position }
  const origin = absolutePosition(parent, nodes, seen)
  return { x: origin.x + node.position.x, y: origin.y + node.position.y }
}

function withoutParent(node: CanvasNode): CanvasNode {
  const { parentId: _parentId, ...rest } = node
  return rest
}

export function toAbsoluteNode(node: CanvasNode, nodes: CanvasNode[]): CanvasNode {
  if (!node.parentId) return withoutParent(node)
  return {
    ...withoutParent(node),
    position: absolutePosition(node, nodes)
  }
}

function groupBounds(nodes: CanvasNode[], devices: CanvasNode[]): {
  x: number
  y: number
  width: number
  height: number
} {
  const boxes = devices.map((node) => {
    const position = absolutePosition(node, nodes)
    const size = nodeSize(node)
    return {
      x: position.x,
      y: position.y,
      right: position.x + size.width,
      bottom: position.y + size.height
    }
  })
  const minX = Math.min(...boxes.map((box) => box.x))
  const minY = Math.min(...boxes.map((box) => box.y))
  const maxX = Math.max(...boxes.map((box) => box.right))
  const maxY = Math.max(...boxes.map((box) => box.bottom))
  return {
    x: minX - GROUP_PAD_X,
    y: minY - GROUP_PAD_TOP,
    width: maxX - minX + GROUP_PAD_X * 2,
    height: maxY - minY + GROUP_PAD_TOP + GROUP_PAD_BOTTOM
  }
}

function occupiedParents(nodes: CanvasNode[]): Set<string> {
  return new Set(nodes.map((node) => node.parentId).filter((id): id is string => Boolean(id)))
}

export function dropEmptyGroups(nodes: CanvasNode[], keepIds: Set<string> = new Set()): CanvasNode[] {
  const used = occupiedParents(nodes)
  return nodes.filter((node) => !isGroupNode(node) || keepIds.has(node.id) || used.has(node.id))
}

export function createGroupFromSelection(
  nodes: CanvasNode[],
  selectedIds: string[],
  nextId: (prefix: string) => string
): CanvasNode[] | null {
  const devices = nodes.filter((node) => isDeviceNode(node) && selectedIds.includes(node.id))
  if (devices.length === 0) return null

  const bounds = groupBounds(nodes, devices)
  const groupId = nextId('group')
  const groupCount = nodes.filter(isGroupNode).length + 1
  const selectedDeviceIds = new Set(devices.map((node) => node.id))
  const group: CanvasNode = {
    id: groupId,
    type: 'group',
    position: { x: bounds.x, y: bounds.y },
    width: bounds.width,
    height: bounds.height,
    style: { width: bounds.width, height: bounds.height },
    selected: true,
    connectable: false,
    data: {
      kind: 'group',
      label: `Group ${groupCount}`,
      notes: ''
    }
  }

  const next = nodes.map((node) => {
    if (!selectedDeviceIds.has(node.id)) {
      return { ...node, selected: false }
    }
    const abs = absolutePosition(node, nodes)
    return {
      ...withoutParent(node),
      parentId: groupId,
      position: { x: abs.x - bounds.x, y: abs.y - bounds.y },
      selected: true
    }
  })

  return dropEmptyGroups([group, ...next], new Set([groupId]))
}

export function dissolveGroups(nodes: CanvasNode[], groupIds: string[]): CanvasNode[] {
  const dissolve = new Set(groupIds.filter((id) => nodes.some((node) => node.id === id && isGroupNode(node))))
  if (dissolve.size === 0) return nodes

  return nodes.flatMap((node) => {
    if (dissolve.has(node.id) && isGroupNode(node)) return []
    if (node.parentId && dissolve.has(node.parentId)) {
      return [{ ...toAbsoluteNode(node, nodes), selected: node.selected }]
    }
    return [node]
  })
}

export function unparentSelectedDevices(nodes: CanvasNode[], selectedIds: string[]): CanvasNode[] {
  const selected = new Set(selectedIds)
  const next = nodes.map((node) => {
    if (!selected.has(node.id) || !node.parentId || isGroupNode(node)) return node
    return toAbsoluteNode(node, nodes)
  })
  return dropEmptyGroups(next)
}

function containsPoint(
  node: CanvasNode,
  point: { x: number; y: number },
  nodes: CanvasNode[],
  padding = 0
): boolean {
  const origin = absolutePosition(node, nodes)
  const size = nodeSize(node)
  return (
    point.x >= origin.x - padding &&
    point.y >= origin.y - padding &&
    point.x <= origin.x + size.width + padding &&
    point.y <= origin.y + size.height + padding
  )
}

export function reconcileParents(nodes: CanvasNode[]): CanvasNode[] {
  const groups = nodes.filter(isGroupNode)
  const next = nodes.map((node) => {
    if (isGroupNode(node)) return node
    const abs = absolutePosition(node, nodes)
    const size = nodeSize(node)
    const center = { x: abs.x + size.width / 2, y: abs.y + size.height / 2 }
    const currentParent = node.parentId ? groups.find((group) => group.id === node.parentId) : undefined
    const stillInside = currentParent ? containsPoint(currentParent, center, nodes, -8) : false
    const host =
      stillInside && currentParent
        ? currentParent
        : groups.find((group) => group.id !== node.id && containsPoint(group, center, nodes, -12))

    if (!host) {
      return node.parentId ? toAbsoluteNode(node, nodes) : node
    }
    if (node.parentId === host.id) return node
    const origin = absolutePosition(host, nodes)
    return {
      ...withoutParent(node),
      parentId: host.id,
      position: { x: abs.x - origin.x, y: abs.y - origin.y }
    }
  })
  return dropEmptyGroups(next)
}
