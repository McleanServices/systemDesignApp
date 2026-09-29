import type { JSX } from 'react'
import { KIND_LABEL } from '../store/catalog'
import { useDesignStore } from '../store/designStore'
import { isDeviceNode } from '../store/types'

export function StatusBar(): JSX.Element {
  const tool = useDesignStore((s) => s.tool)
  const pendingKind = useDesignStore((s) => s.pendingKind)
  const connectSourceId = useDesignStore((s) => s.connectSourceId)
  const selectedIds = useDesignStore((s) => s.selectedIds)
  const nodes = useDesignStore((s) => s.nodes)
  const edges = useDesignStore((s) => s.edges)

  let hint = 'Hover a device and drag a port to connect. Select a cable and drag an endpoint to reconnect or drop it to disconnect.'
  if (pendingKind) {
    hint = `Click the workspace to place ${KIND_LABEL[pendingKind]}. Press Esc to cancel.`
  } else if (tool === 'pan') {
    hint = 'Drag the canvas to move around. Press Esc to return to Select.'
  } else if (tool === 'connect') {
    hint = connectSourceId
      ? 'Click a destination device to finish the cable.'
      : 'Click a source device, then a destination. You can also drag from a port.'
  } else if (tool === 'delete') {
    hint = 'Click a device or cable to remove it. Press Esc to return to Select.'
  } else if (selectedIds.length > 1) {
    hint = `${selectedIds.length} items selected. Right-click to group; Ctrl+D duplicates.`
  }

  const toolLabel = tool === 'select' && pendingKind ? 'Place' : tool === 'pan' ? 'hand' : tool

  return (
    <footer className="status-bar">
      <div className="status-bar__cell">{toolLabel}</div>
      <div className="status-bar__cell is-wide">{hint}</div>
      <div className="status-bar__cell">
        {nodes.filter(isDeviceNode).length} devices · {edges.length} cables
      </div>
    </footer>
  )
}
