import type { FieldMetadata } from '../../services/mementoApi'

import {
  RichTextEditor,
  type PendingEditorImage,
} from './RichTextEditor'

interface FieldRendererProps {
  field: FieldMetadata
  value: unknown
  onChange: (value: unknown) => void
  doctype?: string
  docname?: string
  editable?: boolean
  allowPendingImages?: boolean
  onPendingImagesChange?: (images: PendingEditorImage[]) => void
}

const TABLE_FIELD_TYPES = new Set([
  'Table',
  'Table MultiSelect',
])

function displayValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2) ?? ''
  }

  return String(value)
}

function isChecked(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

export function FieldRenderer({
  field,
  value,
  onChange,
  doctype,
  docname,
  editable = true,
  allowPendingImages = false,
  onPendingImagesChange,
}: FieldRendererProps) {
  if (field.hidden) {
    return null
  }

  const id = `memento-field-${field.fieldname}`
  const valueText = displayValue(value)
  const disabled = !editable || field.read_only
  const required = field.required && !disabled

  // Rich-text field: formatting, links, and image handling.
  if (field.fieldtype === 'Text Editor') {
    return (
      <div className="metadata-form__field">
        <label htmlFor={id}>
          <span>
            {field.label}
            {field.required && (
              <span className="metadata-form__required"> *</span>
            )}
            {field.read_only && (
              <span className="metadata-form__readonly">
                {' '}
                · Read only
              </span>
            )}
          </span>
        </label>

        <RichTextEditor
          id={id}
          value={valueText}
          onChange={onChange}
          doctype={doctype}
          docname={docname}
          fieldname={field.fieldname}
          editable={!disabled}
          allowPendingImages={allowPendingImages}
          onPendingImagesChange={onPendingImagesChange}
        />

        {field.description && (
          <small
            id={`${id}-help`}
            className="metadata-form__help"
          >
            {field.description}
          </small>
        )}
      </div>
    )
  }

  // Checkbox field.
  if (field.fieldtype === 'Check') {
    return (
      <div className="metadata-form__field">
        <label className="metadata-form__checkbox" htmlFor={id}>
          <input
            id={id}
            name={field.fieldname}
            type="checkbox"
            checked={isChecked(value)}
            disabled={disabled}
            onChange={(event) =>
              onChange(event.target.checked ? 1 : 0)
            }
          />

          <span>
            {field.label}
            {field.required && (
              <span className="metadata-form__required"> *</span>
            )}
          </span>
        </label>

        {field.description && (
          <small className="metadata-form__help">
            {field.description}
          </small>
        )}
      </div>
    )
  }

  const sharedProps = {
    id,
    name: field.fieldname,
    required,
    disabled,
    'aria-describedby': field.description
      ? `${id}-help`
      : undefined,
  }

  let control

  if (field.fieldtype === 'Select') {
    control = (
      <select
        {...sharedProps}
        value={valueText}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select {field.label}</option>

        {(field.select_options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  } else if (TABLE_FIELD_TYPES.has(field.fieldtype)) {
    control = (
      <textarea
        {...sharedProps}
        value={valueText}
        rows={4}
        spellCheck={false}
        placeholder="[]"
        onChange={(event) => onChange(event.target.value)}
      />
    )
  } else if (
    field.fieldtype === 'Text' ||
    field.fieldtype === 'Small Text' ||
    field.fieldtype === 'Code' ||
    field.fieldtype === 'JSON'
  ) {
    control = (
      <textarea
        {...sharedProps}
        value={valueText}
        rows={field.fieldtype === 'Text' ? 3 : 5}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  } else {
    const typeByField: Record<string, string> = {
      Email: 'email',
      Phone: 'tel',
      Password: 'password',
      Date: 'date',
      Datetime: 'datetime-local',
      Time: 'time',
      Color: 'color',
      Int: 'number',
      Float: 'number',
      Currency: 'number',
      Percent: 'number',
      Rating: 'number',
    }

    const inputType = typeByField[field.fieldtype] ?? 'text'

    const inputValue =
      field.fieldtype === 'Datetime' && valueText
        ? valueText.replace(' ', 'T').slice(0, 16)
        : valueText

    control = (
      <input
        {...sharedProps}
        type={inputType}
        value={
          field.fieldtype === 'Color' && !inputValue
            ? '#000000'
            : inputValue
        }
        step={
          field.fieldtype === 'Int'
            ? 1
            : inputType === 'number'
              ? 'any'
              : undefined
        }
        maxLength={field.length}
        placeholder={
          field.fieldtype === 'Link'
            ? `Enter ${field.link_doctypes ?? 'record'} name`
            : `Enter ${field.label.toLowerCase()}`
        }
        onChange={(event) => {
          const nextValue = event.target.value

          if (
            inputType === 'number' &&
            nextValue !== '' &&
            Number.isFinite(Number(nextValue))
          ) {
            onChange(Number(nextValue))
          } else {
            onChange(nextValue)
          }
        }}
      />
    )
  }

  return (
    <div className="metadata-form__field">
      <label htmlFor={id}>
        <span>
          {field.label}
          {field.required && (
            <span className="metadata-form__required"> *</span>
          )}
          {field.read_only && (
            <span className="metadata-form__readonly">
              {' '}
              · Read only
            </span>
          )}
        </span>

        {control}
      </label>

      {field.description && (
        <small
          id={`${id}-help`}
          className="metadata-form__help"
        >
          {field.description}
        </small>
      )}

      {TABLE_FIELD_TYPES.has(field.fieldtype) && (
        <small className="metadata-form__help">
          Enter a JSON array of child-row objects. The required row
          structure depends on the linked Frappe child DocType.
        </small>
      )}

      {field.fieldtype === 'Link' && field.link_doctypes && (
        <small className="metadata-form__help">
          Linked DocType: {field.link_doctypes}
        </small>
      )}
    </div>
  )
}