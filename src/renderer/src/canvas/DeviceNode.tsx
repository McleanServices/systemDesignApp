import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo, type JSX } from 'react'
import { useDesignStore } from '../store/designStore'
import type { DeviceData } from '../store/types'
import { DeviceIcon } from './icons'

function DeviceNodeComponent({ id, data, selected }: NodeProps<Node<DeviceData>>): JSX.Element {
  const connectSourceId = useDesignStore((s) => s.connectSourceId)
  const pending = connectSourceId === id

  return (
    <div
      className={[
        'device-node',
        `device-node--${data.kind}`,
        selected ? 'is-selected' : '',
        pending ? 'is-pending' : ''
      ].join(' ')}
      title={
        data.kind === 'database'
          ? 'Double-click to open database interior'
          : data.kind === 'appServer'
            ? 'Double-click to open API interior'
            : undefined
      }
    >
      <Handle type="source" position={Position.Top} id="top" className="device-port" aria-label="Connect top" />
      <Handle type="source" position={Position.Right} id="right" className="device-port" aria-label="Connect right" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="device-port" aria-label="Connect bottom" />
      <Handle type="source" position={Position.Left} id="left" className="device-port" aria-label="Connect left" />
      <div className="device-node__body">
        <div className="device-node__icon">
          <DeviceIcon kind={data.kind} />
        </div>
      </div>
      <div className="device-node__label">{data.label}</div>
    </div>
  )
}

export const DeviceNode = memo(DeviceNodeComponent)
