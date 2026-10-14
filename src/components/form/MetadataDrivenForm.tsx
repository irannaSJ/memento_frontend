import { useEffect, useState, type FormEvent } from 'react'

import {
  mementoApi,
  type DocTypeMetadata,
  type FieldMetadata,
  type MementoRecord,
  type MetadataPurpose,
  type RecordMutationResult,
} from '../../services/mementoApi'

import { FieldRenderer } from './FieldRenderer'
import './MetadataDrivenForm.css'

type FormMode = 'create' | 'update'

type FormValues = Record<string, unknown>

interface MetadataDrivenFormProps {
  doctype: string
  mode: FormMode
  recordName?: string
  onCancel: () => void
  onSuccess: (record: RecordMutationResult) => void
}

const TABLE_FIELD_TYPES = new Set(['Table', 'Table MultiSelect'])

function localDate(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function localDateTime(): string {
  return `${localDate()}T${String(new Date().getHours()).padStart(2, '0')}:${String(
    new Date().getMinutes(),
  ).padStart(2, '0')}`
}

function getInitialValue(
  field: FieldMetadata,
  record?: MementoRecord,
): unknown {
  const hasRecordValue =
    record &&
    Object.prototype.hasOwnProperty.call(record, field.fieldname)

  if (hasRecordValue) {
    const value = record[field.fieldname]

    if (TABLE_FIELD_TYPES.has(field.fieldtype)) {
      return JSON.stringify(value ?? [], null, 2)
    }

    if (field.fieldtype === 'Datetime' && typeof value === 'string') {
      return value.replace(' ', 'T').slice(0, 16)
    }

    return value ?? ''
  }

  if (field.default !== undefined && field.default !== '') {
    if (
      field.fieldtype === 'Date' &&
      typeof field.default === 'string' &&
      field.default.toLowerCase() === 'today'
    ) {
      return localDate()
    }

    if (
      field.fieldtype === 'Datetime' &&
      typeof field.default === 'string' &&
      ['now', 'today'].includes(field.default.toLowerCase())
    ) {
      return localDateTime()
    }

    if (TABLE_FIELD_TYPES.has(field.fieldtype)) {
      return JSON.stringify(field.default, null, 2)
    }

    if (
      field.fieldtype === 'JSON' &&
      typeof field.default === 'object'
    ) {
      return JSON.stringify(field.default, null, 2)
    }

    return field.default
  }

  if (field.fieldtype === 'Check') {
    return 0
  }

  if (TABLE_FIELD_TYPES.has(field.fieldtype)) {
    return '[]'
  }

  if (field.fieldtype === 'JSON') {
    return ''
  }

  return ''
}

function buildPayload(
  fields: FieldMetadata[],
  values: FormValues,
  mode: FormMode,
): FormValues {
  const payload: FormValues = {}

  for (const field of fields) {
    if (field.hidden || field.read_only) {
      continue
    }

    const value = values[field.fieldname]

    if (
      field.required &&
      (value === undefined ||
        value === null ||
        (typeof value === 'string' && !value.trim()))
    ) {
      throw new Error(`${field.label} is required.`)
    }

    if (value === undefined || value === null) {
      if (mode === 'update') {
        payload[field.fieldname] = ''
      }

      continue
    }

    if (field.fieldtype === 'Check') {
      payload[field.fieldname] =
        value === true || value === 1 || value === '1' ? 1 : 0
      continue
    }

    if (TABLE_FIELD_TYPES.has(field.fieldtype)) {
      let rows: unknown

      try {
        rows = typeof value === 'string' ? JSON.parse(value) : value
      } catch {
        throw new Error(
          `${field.label} must contain valid JSON.`,
        )
      }

      if (!Array.isArray(rows)) {
        throw new Error(
          `${field.label} must be a JSON array.`,
        )
      }

      payload[field.fieldname] = rows
      continue
    }

    if (field.fieldtype === 'JSON') {
      if (typeof value === 'string' && !value.trim()) {
        if (mode === 'update') {
          payload[field.fieldname] = ''
        }

        continue
      }

      try {
        payload[field.fieldname] =
          typeof value === 'string' ? JSON.parse(value) : value
      } catch {
        throw new Error(
          `${field.label} must contain valid JSON.`,
        )
      }

      continue
    }

    if (typeof value === 'string' && value.trim() === '') {
      // Omit empty optional fields during creation so Frappe can
      // apply its normal defaults. During updates, an empty value
      // intentionally clears the field.
      if (mode === 'update') {
        payload[field.fieldname] = ''
      }

      continue
    }

    payload[field.fieldname] = value
  }

  return payload
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

export function MetadataDrivenForm({
  doctype,
  mode,
  recordName,
  onCancel,
  onSuccess,
}: MetadataDrivenFormProps) {
  const purpose: MetadataPurpose = mode

  const [metadata, setMetadata] = useState<DocTypeMetadata | null>(null)
  const [values, setValues] = useState<FormValues>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    const recordRequest =
      mode === 'update'
        ? recordName
          ? mementoApi.getDocTypeRecord(doctype, recordName)
          : Promise.reject(
              new Error('A record name is required to edit a record.'),
            )
        : Promise.resolve(null)

    void Promise.all([
      mementoApi.getDocTypeMetadata(doctype, purpose),
      recordRequest,
    ])
      .then(([metadataResponse, recordResponse]) => {
        if (cancelled) return

        const nextMetadata = metadataResponse.data
        const currentRecord = recordResponse?.data

        const initialValues: FormValues = {}

        for (const field of nextMetadata.fields) {
          initialValues[field.fieldname] = getInitialValue(
            field,
            currentRecord,
          )
        }

        setMetadata(nextMetadata)
        setValues(initialValues)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [doctype, mode, purpose, recordName, retryKey])

  function updateField(fieldname: string, value: unknown) {
    setValues((current) => ({
      ...current,
      [fieldname]: value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!metadata || submitting) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const payload = buildPayload(
        metadata.fields,
        values,
        mode,
      )

      const canSubmit =
        mode === 'create'
          ? metadata.capabilities.can_create
          : metadata.capabilities.can_update

      if (!canSubmit) {
        throw new Error(
          `You do not have permission to ${mode} ${metadata.label.toLowerCase()}.`,
        )
      }

      const response =
        mode === 'create'
          ? await mementoApi.createDocTypeRecord(doctype, payload)
          : await mementoApi.updateDocTypeRecord(
              doctype,
              recordName!,
              payload,
            )

      onSuccess(response.data)
    } catch (error: unknown) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="metadata-form__loading" role="status">
        Loading form fields…
      </div>
    )
  }

  if (loadError || !metadata) {
    return (
      <div className="metadata-form">
        <div className="metadata-form__error" role="alert">
          {loadError ?? 'Form metadata is not available.'}
        </div>

        <div className="metadata-form__actions">
          <button
            type="button"
            className="feature-dialog__secondary"
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="button"
            className="feature-dialog__primary"
            onClick={() => {
              setLoading(true)
              setLoadError(null)
              setRetryKey((current) => current + 1)
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const canSubmit =
    mode === 'create'
      ? metadata.capabilities.can_create
      : metadata.capabilities.can_update

  const visibleFields = metadata.fields.filter(
    (field) => !field.hidden,
  )

  return (
    <form
      className="feature-dialog__form metadata-form"
      onSubmit={handleSubmit}
    >
      {!canSubmit && (
        <div className="metadata-form__error" role="alert">
          You do not have permission to {mode} this record.
        </div>
      )}

      {submitError && (
        <div className="metadata-form__error" role="alert">
          {submitError}
        </div>
      )}

      {visibleFields.length === 0 ? (
        <p className="metadata-form__empty">
          No permitted fields are available for this form.
        </p>
      ) : (
        visibleFields.map((field) => (
          <FieldRenderer
            key={field.fieldname}
            field={field}
            value={values[field.fieldname]}
            onChange={(value) =>
              updateField(field.fieldname, value)
            }
          />
        ))
      )}

      <div className="metadata-form__actions">
        <button
          className="feature-dialog__secondary"
          type="button"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>

        <button
          className="feature-dialog__primary"
          type="submit"
          disabled={
            submitting ||
            !canSubmit ||
            visibleFields.length === 0
          }
        >
          {submitting ? (
            'Saving…'
          ) : (
            <>
              <i
                className={
                  mode === 'create'
                    ? 'ri-add-line'
                    : 'ri-save-line'
                }
                aria-hidden="true"
              />
              {mode === 'create' ? 'Create' : 'Save changes'}
            </>
          )}
        </button>
      </div>
    </form>
  )
}