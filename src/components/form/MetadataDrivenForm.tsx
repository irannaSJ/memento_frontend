import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'

import {
  mementoApi,
  type DocTypeMetadata,
  type FieldMetadata,
  type MementoRecord,
  type MetadataPurpose,
  type RecordMutationResult,
} from '../../services/mementoApi'

import { FieldRenderer } from './FieldRenderer'
import type { PendingEditorImage } from './RichTextEditor'

import './MetadataDrivenForm.css'

type FormMode = 'create' | 'update'
type FormValues = Record<string, unknown>

const TABLE_FIELD_TYPES = new Set([
  'Table',
  'Table MultiSelect',
])

const JSON_FIELD_TYPES = new Set([
  'JSON',
  'Table',
  'Table MultiSelect',
])

function localDate(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function localDateTime(): string {
  const date = new Date()

  return `${localDate()}T${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
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

    if (JSON_FIELD_TYPES.has(field.fieldtype)) {
      return JSON.stringify(value ?? [], null, 2)
    }

    if (
      field.fieldtype === 'Datetime' &&
      typeof value === 'string'
    ) {
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

    if (
      JSON_FIELD_TYPES.has(field.fieldtype) &&
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

/**
 * Removes temporary browser blob images before saving a record.
 * Temporary preview URLs must never be persisted in Frappe.
 */
function stripTemporaryImageHtml(html: string): string {
  if (!html) return '<p></p>'

  const parsed = new DOMParser().parseFromString(
    html,
    'text/html',
  )

  parsed.querySelectorAll('img').forEach((image) => {
    const src = image.getAttribute('src') ?? ''

    if (src.startsWith('blob:')) {
      image.remove()
    }
  })

  return parsed.body.innerHTML.trim() || '<p></p>'
}

/**
 * Replaces temporary preview URLs with permanent Frappe file URLs.
 * Any blob image without a completed upload is removed.
 */
function resolveTemporaryImageUrls(
  html: string,
  uploadedUrls: Record<string, string>,
): string {
  if (!html) return '<p></p>'

  const parsed = new DOMParser().parseFromString(
    html,
    'text/html',
  )

  parsed.querySelectorAll('img').forEach((image) => {
    const src = image.getAttribute('src') ?? ''

    if (!src.startsWith('blob:')) {
      return
    }

    const permanentUrl = uploadedUrls[src]

    if (permanentUrl) {
      image.setAttribute('src', permanentUrl)
    } else {
      image.remove()
    }
  })

  return parsed.body.innerHTML.trim() || '<p></p>'
}

function isEmptyFieldValue(
  field: FieldMetadata,
  value: unknown,
): boolean {
  if (value === undefined || value === null) {
    return true
  }

  if (typeof value !== 'string') {
    return false
  }

  if (field.fieldtype === 'Text Editor') {
    const parsed = new DOMParser().parseFromString(
      value,
      'text/html',
    )

    return (
      !parsed.body.textContent?.trim() &&
      !parsed.body.querySelector('img')
    )
  }

  return !value.trim()
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

    if (field.required && isEmptyFieldValue(field, value)) {
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

    if (JSON_FIELD_TYPES.has(field.fieldtype)) {
      if (typeof value === 'string' && !value.trim()) {
        if (mode === 'update') {
          payload[field.fieldname] = ''
        }

        continue
      }

      try {
        const parsed =
          typeof value === 'string'
            ? JSON.parse(value)
            : value

        if (
          TABLE_FIELD_TYPES.has(field.fieldtype) &&
          !Array.isArray(parsed)
        ) {
          throw new Error(
            `${field.label} must be a JSON array.`,
          )
        }

        payload[field.fieldname] = parsed
      } catch (error : unknown) {
        // if (
        //   error instanceof Error &&
        //   error.message === `${field.label} must be a JSON array.`
        // ) {
        //   throw error
        // }
        throw new Error(
          `Image upload failed : ${getErrorMessage(error)}`,{cause : error},
        )

        // throw new Error(
        //   `${field.label} must contain valid JSON.`,
        // )
      }

      continue
    }

    if (
      field.fieldtype === 'Datetime' &&
      typeof value === 'string'
    ) {
      payload[field.fieldname] = value.replace('T', ' ')
      continue
    }

    if (typeof value === 'string' && value.trim() === '') {
      // Omit empty optional fields at creation so backend defaults apply.
      // For updates, send the empty string to clear the field.
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
}: {
  doctype: string
  mode: FormMode
  recordName?: string
  onCancel: () => void
  onSuccess: (record: RecordMutationResult) => void
}) {
  const purpose: MetadataPurpose = mode

  const [metadata, setMetadata] =
    useState<DocTypeMetadata | null>(null)

  const [values, setValues] = useState<FormValues>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  // Images selected before a new record exists.
  const [pendingImages, setPendingImages] =
    useState<PendingEditorImage[]>([])

  // Retained after partial failure so retry won't create a duplicate.
  const [createdRecordForImages, setCreatedRecordForImages] =
    useState<RecordMutationResult | null>(null)

  // Successful uploads are retained across retries.
  const [uploadedImageUrls, setUploadedImageUrls] =
    useState<Record<string, string>>({})

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

  function handlePendingImagesChange(
    fieldname: string,
    fieldImages: PendingEditorImage[],
  ) {
    setPendingImages((current) => [
      ...current.filter(
        (image) => image.fieldname !== fieldname,
      ),
      ...fieldImages,
    ])
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!metadata || submitting) return

    const canSubmit =
      mode === 'create'
        ? metadata.capabilities.can_create
        : metadata.capabilities.can_update

    if (!canSubmit) {
      setSubmitError(
        `You do not have permission to ${mode} ${metadata.label.toLowerCase()}.`,
      )
      return
    }

    const stagedFieldnames = [
      ...new Set(pendingImages.map((image) => image.fieldname)),
    ]

    // Upload only staged images that are still in the current HTML.
    const imagesToUpload =
      mode === 'create'
        ? pendingImages.filter((image) => {
            const html = values[image.fieldname]

            return (
              typeof html === 'string' &&
              html.includes(image.previewUrl)
            )
          })
        : []

    const retryingCreatedRecord =
      mode === 'create' && createdRecordForImages !== null

    // Saving a record with embedded images needs update permission too,
    // because the final HTML is saved after the images are uploaded.
    if (
      (imagesToUpload.length > 0 || retryingCreatedRecord) &&
      !metadata.capabilities.can_update
    ) {
      setSubmitError(
        'You need update permission to save a record with embedded images.',
      )
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    let savedRecord: RecordMutationResult | null = null

    try {
      const payload = buildPayload(
        metadata.fields,
        values,
        mode,
      )

      if (mode === 'create') {
        if (createdRecordForImages) {
          // A prior attempt already created the record.
          // Update its regular fields before retrying failed uploads.
          savedRecord = createdRecordForImages

          const retryPayload: FormValues = { ...payload }

          for (const fieldname of stagedFieldnames) {
            const fieldValue = retryPayload[fieldname]

            if (typeof fieldValue === 'string') {
              retryPayload[fieldname] =
                stripTemporaryImageHtml(fieldValue)
            }
          }

          await mementoApi.updateDocTypeRecord(
            doctype,
            savedRecord.name,
            retryPayload,
          )
        } else {
          // Never send temporary browser blob URLs to Frappe.
          const createPayload: FormValues = { ...payload }

          for (const fieldname of stagedFieldnames) {
            const fieldValue = createPayload[fieldname]

            if (typeof fieldValue === 'string') {
              createPayload[fieldname] =
                stripTemporaryImageHtml(fieldValue)
            }
          }

          const createResponse =
            await mementoApi.createDocTypeRecord(
              doctype,
              createPayload,
            )

          savedRecord = createResponse.data

          if (imagesToUpload.length > 0) {
            setCreatedRecordForImages(savedRecord)
          }
        }

        const needsImageFinalization =
          imagesToUpload.length > 0 || retryingCreatedRecord

        if (needsImageFinalization) {
          if (!savedRecord) {
            throw new Error(
              'The created record could not be identified.',
            )
          }

          const resolvedUrls = { ...uploadedImageUrls }

          // Upload each currently used image once.
          for (const image of imagesToUpload) {
            if (resolvedUrls[image.previewUrl]) {
              continue
            }

            const uploadedFile = await mementoApi.uploadFile(
              image.file,
              {
                doctype,
                docname: savedRecord.name,
              },
            )

            resolvedUrls[image.previewUrl] =
              uploadedFile.file_url

            setUploadedImageUrls({ ...resolvedUrls })
          }

          // Restore HTML, substituting permanent file URLs for previews.
          const descriptionPayload: FormValues = {}

          for (const fieldname of stagedFieldnames) {
            const fieldValue = values[fieldname]

            const html =
              typeof fieldValue === 'string'
                ? fieldValue
                : ''

            descriptionPayload[fieldname] =
              resolveTemporaryImageUrls(html, resolvedUrls)
          }

          if (Object.keys(descriptionPayload).length > 0) {
            await mementoApi.updateDocTypeRecord(
              doctype,
              savedRecord.name,
              descriptionPayload,
            )
          }

          setCreatedRecordForImages(null)
        }
      } else {
        if (!recordName) {
          throw new Error(
            'A record name is required to update a record.',
          )
        }

        const updateResponse =
          await mementoApi.updateDocTypeRecord(
            doctype,
            recordName,
            payload,
          )

        savedRecord = updateResponse.data
      }

      if (!savedRecord) {
        throw new Error(
          'The record was saved without a record identifier.',
        )
      }

      onSuccess(savedRecord)
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error)

      // A record may already exist if an image upload or the final
      // description update failed. Preserve it for a safe retry.
      if (
        mode === 'create' &&
        savedRecord &&
        (imagesToUpload.length > 0 || retryingCreatedRecord)
      ) {
        setCreatedRecordForImages(savedRecord)

        setSubmitError(
          `Record "${savedRecord.name}" was created, but image uploading or the final description save failed. Submit again to retry without creating a duplicate. Details: ${errorMessage}`,
        )
      } else {
        setSubmitError(errorMessage)
      }
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

  const submitLabel =
    mode === 'create'
      ? createdRecordForImages
        ? 'Retry image upload'
        : 'Create'
      : 'Save changes'

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
          doctype={doctype}
          docname={mode === 'update' ? recordName : undefined}
          editable={canSubmit}
          operation={mode}
          referenceDoctype={
            field.fieldtype === 'Dynamic Link' && field.options_field
              ? String(values[field.options_field] ?? '')
              : undefined
          }
          allowPendingImages={mode === 'create'}
          onPendingImagesChange={(fieldImages) =>
            handlePendingImagesChange(field.fieldname, fieldImages)
          }
          onChange={(nextValue) => {
            setValues((current) => {
              const nextValues = {
                ...current,
                [field.fieldname]: nextValue,
              }

              // Changing a Dynamic Link's target type invalidates its
              // previously selected record.
              for (const candidate of metadata?.fields ?? []) {
                if (
                  candidate.fieldtype === 'Dynamic Link' &&
                  candidate.options_field === field.fieldname
                ) {
                  nextValues[candidate.fieldname] = ''
                }
              }

              return nextValues
            })
          }}
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
              {submitLabel}
            </>
          )}
        </button>
      </div>
    </form>
  )
}