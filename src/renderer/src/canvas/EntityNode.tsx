import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo, type ChangeEvent, type JSX } from 'react'
import { useDesignStore } from '../store/designStore'
import type { EntityData, ErAttribute, UmlMethod, UmlVisibility } from '../store/types'
import { UML_VISIBILITIES, UML_VISIBILITY_MARK } from '../store/types'

const noDrag = 'nodrag nopan'

function NodeDragGrip(): JSX.Element {
  return <span className="node-drag-grip" role="img" aria-label="Drag to move" />
}

function EntityNodeComponent({ id, data, selected }: NodeProps<Node<EntityData>>): JSX.Element {
  const updateEntity = useDesignStore((s) => s.updateEntity)
  const connectSourceId = useDesignStore((s) => s.connectSourceId)
  const interiorMode = useDesignStore((s) => s.interiorMode)
  const pending = connectSourceId === id
  const isUmlClass = interiorMode === 'uml'
  const isObjectView = interiorMode === 'object'
  const methods = data.methods ?? []
  const objectValues = data.objectValues ?? {}

  const setAttributes = (attributes: ErAttribute[]): void => {
    updateEntity(id, { attributes })
  }

  const setMethods = (nextMethods: UmlMethod[]): void => {
    updateEntity(id, { methods: nextMethods })
  }

  const onLabelChange = (event: ChangeEvent<HTMLInputElement>): void => {
    updateEntity(id, { label: event.target.value })
  }

  const onObjectLabelChange = (event: ChangeEvent<HTMLInputElement>): void => {
    updateEntity(id, { objectLabel: event.target.value })
  }

  const onObjectValueChange = (attributeId: string, value: string): void => {
    updateEntity(id, { objectValues: { ...objectValues, [attributeId]: value } })
  }

  const onAttributeChange = (
    attributeId: string,
    patch: Partial<Pick<ErAttribute, 'name' | 'type' | 'pk' | 'fk' | 'visibility'>>
  ): void => {
    setAttributes(
      data.attributes.map((attribute) =>
        attribute.id === attributeId ? { ...attribute, ...patch } : attribute
      )
    )
  }

  const addAttribute = (): void => {
    setAttributes([
      ...data.attributes,
      {
        id: `attr-${Date.now()}`,
        name: '',
        type: isUmlClass ? 'String' : 'text',
        pk: false,
        fk: false,
        ...(isUmlClass ? { visibility: 'public' as const } : {})
      }
    ])
  }

  const removeAttribute = (attributeId: string): void => {
    setAttributes(data.attributes.filter((attribute) => attribute.id !== attributeId))
  }

  const onMethodChange = (
    methodId: string,
    patch: Partial<Pick<UmlMethod, 'name' | 'visibility' | 'params' | 'returnType'>>
  ): void => {
    setMethods(methods.map((method) => (method.id === methodId ? { ...method, ...patch } : method)))
  }

  const addMethod = (): void => {
    setMethods([
      ...methods,
      {
        id: `method-${Date.now()}`,
        name: '',
        visibility: 'public',
        params: '',
        returnType: ''
      }
    ])
  }

  const removeMethod = (methodId: string): void => {
    setMethods(methods.filter((method) => method.id !== methodId))
  }

  if (isUmlClass) {
    return (
      <div
        className={['uml-class-node', selected ? 'is-selected' : '', pending ? 'is-pending' : ''].join(' ')}
      >
        <Handle type="source" position={Position.Top} id="top" className="device-port" aria-label="Connect top" />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="device-port"
          aria-label="Connect right"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="device-port"
          aria-label="Connect bottom"
        />
        <Handle type="source" position={Position.Left} id="left" className="device-port" aria-label="Connect left" />

        <div className="uml-class-node__header">
          <NodeDragGrip />
          <input
            className={`uml-class-node__title ${noDrag}`}
            value={data.label}
            onChange={onLabelChange}
            aria-label="Class name"
          />
        </div>

        <div className="uml-class-node__section">
          {data.attributes.map((attribute) => {
            const visibility = attribute.visibility ?? 'public'
            return (
              <div key={attribute.id} className="uml-class-node__row">
                <select
                  className={`uml-class-node__visibility ${noDrag}`}
                  value={visibility}
                  aria-label="Attribute visibility"
                  onChange={(event) =>
                    onAttributeChange(attribute.id, { visibility: event.target.value as UmlVisibility })
                  }
                >
                  {UML_VISIBILITIES.map((value) => (
                    <option key={value} value={value}>
                      {UML_VISIBILITY_MARK[value]}
                    </option>
                  ))}
                </select>
                <input
                  className={`uml-class-node__field uml-class-node__field--name ${noDrag}`}
                  value={attribute.name}
                  placeholder="name"
                  onChange={(event) => onAttributeChange(attribute.id, { name: event.target.value })}
                />
                <span className="uml-class-node__sep">:</span>
                <input
                  className={`uml-class-node__field uml-class-node__field--type ${noDrag}`}
                  value={attribute.type}
                  placeholder="Type"
                  onChange={(event) => onAttributeChange(attribute.id, { type: event.target.value })}
                />
                <button
                  type="button"
                  className={`uml-class-node__remove ${noDrag}`}
                  aria-label="Remove attribute"
                  onClick={() => removeAttribute(attribute.id)}
                >
                  ×
                </button>
              </div>
            )
          })}
          <button type="button" className={`uml-class-node__add ${noDrag}`} onClick={addAttribute}>
            + Attribute
          </button>
        </div>

        <div className="uml-class-node__section">
          {methods.map((method) => (
            <div key={method.id} className="uml-class-node__row uml-class-node__row--method">
              <select
                className={`uml-class-node__visibility ${noDrag}`}
                value={method.visibility}
                aria-label="Method visibility"
                onChange={(event) =>
                  onMethodChange(method.id, { visibility: event.target.value as UmlVisibility })
                }
              >
                {UML_VISIBILITIES.map((value) => (
                  <option key={value} value={value}>
                    {UML_VISIBILITY_MARK[value]}
                  </option>
                ))}
              </select>
              <input
                className={`uml-class-node__field uml-class-node__field--name ${noDrag}`}
                value={method.name}
                placeholder="method"
                onChange={(event) => onMethodChange(method.id, { name: event.target.value })}
              />
              <span className="uml-class-node__sep">(</span>
              <input
                className={`uml-class-node__field uml-class-node__field--params ${noDrag}`}
                value={method.params}
                placeholder="params"
                onChange={(event) => onMethodChange(method.id, { params: event.target.value })}
              />
              <span className="uml-class-node__sep">)</span>
              <span className="uml-class-node__sep">:</span>
              <input
                className={`uml-class-node__field uml-class-node__field--type ${noDrag}`}
                value={method.returnType}
                placeholder="void"
                onChange={(event) => onMethodChange(method.id, { returnType: event.target.value })}
              />
              <button
                type="button"
                className={`uml-class-node__remove ${noDrag}`}
                aria-label="Remove method"
                onClick={() => removeMethod(method.id)}
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className={`uml-class-node__add ${noDrag}`} onClick={addMethod}>
            + Method
          </button>
        </div>
      </div>
    )
  }

  if (isObjectView) {
    return (
      <div
        className={['uml-object-node', selected ? 'is-selected' : '', pending ? 'is-pending' : ''].join(' ')}
      >
        <Handle type="source" position={Position.Top} id="top" className="device-port" aria-label="Connect top" />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="device-port"
          aria-label="Connect right"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="device-port"
          aria-label="Connect bottom"
        />
        <Handle type="source" position={Position.Left} id="left" className="device-port" aria-label="Connect left" />

        <div className="uml-object-node__header">
          <NodeDragGrip />
          <input
            className={`uml-object-node__title ${noDrag}`}
            value={data.objectLabel ?? ''}
            placeholder="instance"
            onChange={onObjectLabelChange}
            aria-label="Object instance name"
          />
          <span className="uml-object-node__sep">:</span>
          <span className="uml-object-node__class">{data.label}</span>
        </div>

        <div className="uml-object-node__section">
          {data.attributes.map((attribute) => (
            <div key={attribute.id} className="uml-object-node__row">
              <span className="uml-object-node__field uml-object-node__field--name">{attribute.name}</span>
              <span className="uml-object-node__sep">=</span>
              <input
                className={`uml-object-node__field uml-object-node__field--value ${noDrag}`}
                value={objectValues[attribute.id] ?? ''}
                placeholder="value"
                onChange={(event) => onObjectValueChange(attribute.id, event.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={['entity-node', selected ? 'is-selected' : '', pending ? 'is-pending' : ''].join(' ')}>
      <Handle type="source" position={Position.Top} id="top" className="device-port" aria-label="Connect top" />
      <Handle type="source" position={Position.Right} id="right" className="device-port" aria-label="Connect right" />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="device-port"
        aria-label="Connect bottom"
      />
      <Handle type="source" position={Position.Left} id="left" className="device-port" aria-label="Connect left" />

      <div className="entity-node__header">
        <NodeDragGrip />
        <input
          className={`entity-node__title ${noDrag}`}
          value={data.label}
          onChange={onLabelChange}
          aria-label="Entity name"
        />
      </div>

      <div className="entity-node__attributes">
        {data.attributes.map((attribute) => (
          <div key={attribute.id} className="entity-node__row">
            <input
              className={`entity-node__field entity-node__field--name ${noDrag}`}
              value={attribute.name}
              placeholder="name"
              onChange={(event) => onAttributeChange(attribute.id, { name: event.target.value })}
            />
            <input
              className={`entity-node__field entity-node__field--type ${noDrag}`}
              value={attribute.type}
              placeholder="type"
              onChange={(event) => onAttributeChange(attribute.id, { type: event.target.value })}
            />
            <label className={`entity-node__flag ${noDrag}`} title="Primary key">
              <input
                type="checkbox"
                checked={attribute.pk}
                onChange={(event) => onAttributeChange(attribute.id, { pk: event.target.checked })}
              />
              PK
            </label>
            <label className={`entity-node__flag ${noDrag}`} title="Foreign key">
              <input
                type="checkbox"
                checked={attribute.fk}
                onChange={(event) => onAttributeChange(attribute.id, { fk: event.target.checked })}
              />
              FK
            </label>
            <button
              type="button"
              className={`entity-node__remove ${noDrag}`}
              aria-label="Remove attribute"
              onClick={() => removeAttribute(attribute.id)}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className={`entity-node__add ${noDrag}`} onClick={addAttribute}>
          + Attribute
        </button>
      </div>
    </div>
  )
}

export const EntityNode = memo(EntityNodeComponent)
