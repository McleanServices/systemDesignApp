import { type Node, type NodeProps } from '@xyflow/react'
import { memo, type ChangeEvent, type JSX } from 'react'
import { useDesignStore } from '../store/designStore'
import type { GroupData } from '../store/types'

function GroupNodeComponent({ id, data, selected }: NodeProps<Node<GroupData, 'group'>>): JSX.Element {
  const updateGroup = useDesignStore((s) => s.updateGroup)

  const onTitle = (event: ChangeEvent<HTMLInputElement>): void => {
    updateGroup(id, { label: event.target.value })
  }

  const onNotes = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    updateGroup(id, { notes: event.target.value })
  }

  return (
    <div className={selected ? 'group-node is-selected' : 'group-node'}>
      <div className="group-node__header">
        <input
          className="group-node__title nodrag nopan"
          value={data.label}
          onChange={onTitle}
          placeholder="Group title"
          aria-label="Group title"
        />
        <textarea
          className="group-node__notes nodrag nopan nowheel"
          value={data.notes}
          onChange={onNotes}
          placeholder="Add notes…"
          aria-label="Group notes"
          rows={3}
        />
      </div>
    </div>
  )
}

export const GroupNode = memo(GroupNodeComponent)
