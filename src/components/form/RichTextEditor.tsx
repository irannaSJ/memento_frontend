import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'

import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import DOMPurify from 'dompurify'

import { mementoApi } from '../../services/mementoApi'

import './RichTextEditor.css'

export interface PendingEditorImage {
  fieldname: string
  file: File
  previewUrl: string
}

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  doctype?: string
  docname?: string
  id?: string
  editable?: boolean
  fieldname?: string
  allowPendingImages?: boolean
  onPendingImagesChange?: (images: PendingEditorImage[]) => void
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeEditorContent(value: string): string {
  if (!value.trim()) {
    return '<p></p>'
  }

  const hasHtml = /<\/?[a-z][^>]*>/i.test(value)

  const html = hasHtml
    ? value
    : `<p>${escapeHtml(value).replace(/\r?\n/g, '<br>')}</p>`

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },

    // Preserve temporary image previews during editing.
    // These URLs must be replaced with Frappe file URLs before saving.
    ALLOWED_URI_REGEXP:
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|matrix|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  })
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`rich-text-editor__tool${active ? ' is-active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  doctype,
  docname,
  id,
  editable = true,
  fieldname,
  allowPendingImages = false,
  onPendingImagesChange,
}: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pendingImageUrlsRef = useRef<string[]>([])

  const [pendingImages, setPendingImages] =
    useState<PendingEditorImage[]>([])

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)

  const canUploadImage = Boolean(doctype?.trim() && docname?.trim())

  // Existing records upload directly. New records stage local previews.
  const canAddImage =
    editable &&
    (
      canUploadImage ||
      (allowPendingImages && Boolean(fieldname))
    )

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: 'rich-text-editor__image',
        },
      }),
    ],
    content: normalizeEditorContent(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: 'rich-text-editor__content',
        'aria-label': 'Rich-text description',
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      onChange(activeEditor.getHTML())
    },
  })

  // Apply permission changes to the existing editor instance.
  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])

  // Synchronize backend/form values without emitting another change.
  useEffect(() => {
    if (!editor) return

    const nextContent = normalizeEditorContent(value)

    if (editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent, {
        emitUpdate: false,
      })
    }
  }, [editor, value])

  // Revoke local preview URLs after the editor unmounts.
  useEffect(() => {
    const previewUrls = pendingImageUrlsRef.current

    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url))
      previewUrls.length = 0
    }
  }, [])

  async function handleImageSelected(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]

    // Allow selecting the same file again after an attempt.
    event.target.value = ''

    if (!file || !editor || !editable) return

    setUploadError(null)
    setUploadMessage(null)

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setUploadError('Choose a PNG, JPEG, WebP, or GIF image.')
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setUploadError('Images must be 5 MB or smaller.')
      return
    }

    // CREATE MODE: preview locally until a record has been created.
    if (!canUploadImage) {
      if (!allowPendingImages || !fieldname) {
        setUploadError(
          'Save the record first, then open Update to upload images.',
        )
        return
      }

      const previewUrl = URL.createObjectURL(file)

      pendingImageUrlsRef.current.push(previewUrl)

      const nextImages: PendingEditorImage[] = [
        ...pendingImages,
        {
          fieldname,
          file,
          previewUrl,
        },
      ]

      setPendingImages(nextImages)
      onPendingImagesChange?.(nextImages)

      editor
        .chain()
        .focus()
        .setImage({
          src: previewUrl,
          alt: file.name,
          title: file.name,
        })
        .run()

      setUploadMessage(
        'Image added. It will upload when you save the record.',
      )

      return
    }

    // UPDATE MODE: the saved record is available for attachment.
    if (!doctype || !docname) return

    setUploading(true)

    try {
      const uploadedFile = await mementoApi.uploadFile(file, {
        doctype,
        docname,
      })

      editor
        .chain()
        .focus()
        .setImage({
          src: uploadedFile.file_url,
          alt: file.name,
          title: file.name,
        })
        .run()

      setUploadMessage('Image uploaded and inserted.')
    } catch (error: unknown) {
      setUploadError(
        error instanceof Error
          ? error.message
          : 'Unable to upload the image.',
      )
    } finally {
      setUploading(false)
    }
  }

  function insertLink() {
    if (!editor || !editable) return

    const currentUrl = editor.getAttributes('link').href as
      | string
      | undefined

    const url = window.prompt(
      'Enter the link URL',
      currentUrl ?? 'https://',
    )

    if (url === null) return

    const trimmedUrl = url.trim()

    if (!trimmedUrl) {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .unsetLink()
        .run()

      return
    }

    try {
      const parsedUrl = new URL(trimmedUrl)

      if (
        !['https:', 'http:', 'mailto:'].includes(parsedUrl.protocol)
      ) {
        setUploadError('Use an HTTP, HTTPS, or email link.')
        return
      }

      setUploadError(null)

      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({
          href: trimmedUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
        })
        .run()
    } catch {
      setUploadError('Enter a valid link URL.')
    }
  }

  if (!editor) {
    return (
      <div className="rich-text-editor__loading" role="status">
        Preparing rich-text editor…
      </div>
    )
  }

  return (
    <div className="rich-text-editor">
      {editable && (
        <div
          className="rich-text-editor__toolbar"
          role="toolbar"
          aria-label="Description formatting"
        >
          <ToolbarButton
            label="Paragraph"
            active={editor.isActive('paragraph')}
            onClick={() =>
              editor.chain().focus().setParagraph().run()
            }
          >
            P
          </ToolbarButton>

          {[1, 2, 3].map((level) => (
            <ToolbarButton
              key={level}
              label={`Heading ${level}`}
              active={editor.isActive('heading', { level })}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleHeading({
                    level: level as 1 | 2 | 3,
                  })
                  .run()
              }
            >
              H{level}
            </ToolbarButton>
          ))}

          <span className="rich-text-editor__separator" />

          <ToolbarButton
            label="Bold"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <i className="ri-bold" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Italic"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <i className="ri-italic" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Underline"
            active={editor.isActive('underline')}
            onClick={() =>
              editor.chain().focus().toggleUnderline().run()
            }
          >
            <i className="ri-underline" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Strikethrough"
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <i className="ri-strikethrough" aria-hidden="true" />
          </ToolbarButton>

          <span className="rich-text-editor__separator" />

          <ToolbarButton
            label="Bulleted list"
            active={editor.isActive('bulletList')}
            onClick={() =>
              editor.chain().focus().toggleBulletList().run()
            }
          >
            <i className="ri-list-unordered" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Numbered list"
            active={editor.isActive('orderedList')}
            onClick={() =>
              editor.chain().focus().toggleOrderedList().run()
            }
          >
            <i className="ri-list-ordered" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Blockquote"
            active={editor.isActive('blockquote')}
            onClick={() =>
              editor.chain().focus().toggleBlockquote().run()
            }
          >
            <i className="ri-double-quotes-l" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Add or edit link"
            active={editor.isActive('link')}
            onClick={insertLink}
          >
            <i className="ri-link" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Insert horizontal divider"
            onClick={() =>
              editor.chain().focus().setHorizontalRule().run()
            }
          >
            <i className="ri-separator" aria-hidden="true" />
          </ToolbarButton>

          <span className="rich-text-editor__separator" />

          <ToolbarButton
            label="Undo"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <i className="ri-arrow-go-back-line" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Redo"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <i className="ri-arrow-go-forward-line" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label={
              canAddImage
                ? 'Upload and insert image'
                : 'Save the record before uploading images'
            }
            disabled={uploading || !canAddImage}
            onClick={() => imageInputRef.current?.click()}
          >
            <i className="ri-image-add-line" aria-hidden="true" />
          </ToolbarButton>

          <input
            ref={imageInputRef}
            className="rich-text-editor__file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => void handleImageSelected(event)}
            aria-label="Select an image"
          />
        </div>
      )}

      <EditorContent editor={editor} />

      <div className="rich-text-editor__footer">
        <span>
          Rich text · Formatting is saved with the description
        </span>
        {uploading && (
          <span role="status">Uploading image…</span>
        )}
      </div>

      {uploadError && (
        <p
          className="rich-text-editor__feedback is-error"
          role="alert"
        >
          {uploadError}
        </p>
      )}

      {uploadMessage && (
        <p className="rich-text-editor__feedback" role="status">
          {uploadMessage}
        </p>
      )}

      {!canUploadImage && allowPendingImages && (
        <p className="rich-text-editor__hint">
          Images will be uploaded after this record is created.
        </p>
      )}

      {!canUploadImage && !allowPendingImages && (
        <p className="rich-text-editor__hint">
          Save the record first, then open Update to upload images.
        </p>
      )}
    </div>
  )
}