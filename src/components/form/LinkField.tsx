
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'

import {
  mementoApi,
  type LinkOption,
} from '../../services/mementoApi'

import './LinkField.css'

interface LinkFieldProps {
  sourceDoctype: string
  fieldname: string
  value: string
  onChange: (value: string) => void
  operation: 'create' | 'update'
  referenceDoctype?: string
  isDynamicLink?: boolean
  id?: string
  disabled?: boolean
  required?: boolean
  placeholder?: string
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to load linked records.'
}

export function LinkField({
  sourceDoctype,
  fieldname,
  value,
  onChange,
  operation,
  referenceDoctype,
  isDynamicLink = false,
  id,
  disabled = false,
  required = false,
  placeholder = 'Search records…',
}: LinkFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const listboxId = `${inputId}-options`
  const errorId = `${inputId}-error`

  const inputRef = useRef<HTMLInputElement>(null)

  // Prevent the value-sync effect from clearing text as the user types
  // while replacing an existing selection.
  // const userEditingRef = useRef(false)
  const [isUserEditing, setIsUserEditing] = useState(false)

  const [inputValue, setInputValue] = useState(value)
  const [searchTerm, setSearchTerm] = useState(value)
  const [options, setOptions] = useState<LinkOption[]>([])
  const [selectedOption, setSelectedOption] =
    useState<LinkOption | null>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const selectedValue = selectedOption?.value
  const displyedInputValue =isUserEditing
  ? inputValue
  : selectedValue === value
    ? selectedOption?.label ?? ''
    : value

  const waitingForReference =
    isDynamicLink && !referenceDoctype?.trim()

  // Synchronize external form values, including values loaded in update mode.
  // useEffect(() => {
  //   if (!value) {
  //     setSelectedOption(null)

  //     if (userEditingRef.current) {
  //       userEditingRef.current = false
  //       return
  //     }

  //     setInputValue('')
  //     setSearchTerm('')
  //     return
  //   }

  //   if (selectedOption?.value === value) {
  //     setInputValue(selectedOption.label)
  //     setSearchTerm(selectedOption.label)
  //     return
  //   }

  //   setSelectedOption(null)
  //   setInputValue(value)
  //   setSearchTerm(value)
  // }, [
  //   value,
  //   selectedOption,
  // ])

  // Load options on demand. Existing saved values are also looked up so
  // the input can display their labels instead of raw record IDs.
  // useEffect(() => {
  //   if (waitingForReference) {
  //     setOptions([])
  //     setLoading(false)
  //     setError(null)
  //     return
  //   }

  //   if (!isOpen && !value) {
  //     return
  //   }

  //   let cancelled = false

  //   const timer = window.setTimeout(() => {
  //     setLoading(true)
  //     setError(null)

  //     void mementoApi
  //       .searchLinkOptions({
  //         source_doctype: sourceDoctype,
  //         fieldname,
  //         operation,
  //         search: searchTerm.trim(),
  //         reference_doctype: referenceDoctype,
  //         page_length: 20,
  //       })
  //       .then((response) => {
  //         if (cancelled) return

  //         const results = response.data ?? []
  //         setOptions(results)
  //         setActiveIndex(0)

  //         const matchingValue = value
  //           ? results.find((option) => option.value === value)
  //           : undefined

  //         if (matchingValue) {
  //           setSelectedOption(matchingValue)
  //           setInputValue(matchingValue.label)
  //         }
  //       })
  //       .catch((requestError: unknown) => {
  //         if (cancelled) return

  //         setOptions([])
  //         setError(getErrorMessage(requestError))
  //       })
  //       .finally(() => {
  //         if (!cancelled) {
  //           setLoading(false)
  //         }
  //       })
  //   }, 250)

  //   return () => {
  //     cancelled = true
  //     window.clearTimeout(timer)
  //   }
  // }, [
  //   sourceDoctype,
  //   fieldname,
  //   operation,
  //   referenceDoctype,
  //   waitingForReference,
  //   searchTerm,
  //   isOpen,
  //   value,
  // ])


  useEffect(() => {
  // The dropdown is disabled until a Dynamic Link has a target DocType.
  // Avoid synchronous state updates in this effect.
    if (waitingForReference) {
      return
    }

    if (!isOpen && !value) {
      return
    }

    let cancelled = false

    const requestedSearch =
      !isUserEditing && value && selectedValue !== value
        ? value
        : searchTerm

    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)

      void mementoApi
        .searchLinkOptions({
          source_doctype: sourceDoctype,
          fieldname,
          operation,
          search: requestedSearch.trim(),
          reference_doctype: referenceDoctype,
          page_length: 20,
        })
        .then((response) => {
          if (cancelled) return

          const results = response.data ?? []
          setOptions(results)
          setActiveIndex(0)

          const matchingValue = value
            ? results.find((option) => option.value === value)
            : undefined

          if (matchingValue) {
            setSelectedOption(matchingValue)
            setInputValue(matchingValue.label)
          }
        })
        .catch((requestError: unknown) => {
          if (cancelled) return

          setOptions([])
          setError(getErrorMessage(requestError))
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false)
          }
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    sourceDoctype,
    fieldname,
    operation,
    referenceDoctype,
    waitingForReference,
    searchTerm,
    isOpen,
    value,
    selectedValue,
    isUserEditing
  ])

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const nextValue = event.target.value

    setIsUserEditing(true)

    setInputValue(nextValue)
    setSearchTerm(nextValue)
    setSelectedOption(null)
    setActiveIndex(0)
    setIsOpen(true)

    if (value) {
      onChange('')
    }
  }

  function selectOption(option: LinkOption) {
    setIsUserEditing(true)

    setSelectedOption(option)
    setInputValue(option.label)
    setSearchTerm(option.label)
    setIsOpen(false)
    setError(null)

    // Submit the real linked record name, not its display label.
    onChange(option.value)
  }

  function clearSelection() {
    setIsUserEditing(true)

    setSelectedOption(null)
    setInputValue('')
    setSearchTerm('')
    setOptions([])
    setActiveIndex(0)
    setIsOpen(false)
    setError(null)

    onChange('')
    inputRef.current?.focus()
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)

      if (options.length > 0) {
        setActiveIndex((current) =>
          Math.min(current + 1, options.length - 1),
        )
      }

      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()

      if (options.length > 0) {
        setActiveIndex((current) =>
          Math.max(current - 1, 0),
        )
      }

      return
    }

    if (event.key === 'Enter' && isOpen && options.length > 0) {
      event.preventDefault()
      selectOption(options[activeIndex] ?? options[0])
      return
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const inputDisabled = disabled || waitingForReference

  return (
    <div className="link-field">
      <div className="link-field__control">
        {/* <i
          className="ri-search-line link-field__search-icon"
          aria-hidden="true"
        /> */}

        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          value={displyedInputValue}
          disabled={inputDisabled}
          placeholder={
            waitingForReference
              ? 'Select a document type first'
              : placeholder
          }
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 120)
          }}
          onKeyDown={handleKeyDown}
        />

        {loading && (
          <span
            className="link-field__spinner"
            role="status"
            aria-label="Loading linked records"
          />
        )}

        {!loading && value && !disabled && (
          <button
            type="button"
            className="link-field__clear"
            aria-label="Clear selection"
            title="Clear selection"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearSelection}
          >
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        )}

        {!loading && !value && (
          <i
            className="ri-arrow-down-s-line link-field__chevron"
            aria-hidden="true"
          />
        )}
      </div>

      {isOpen && !inputDisabled && (
        <div
          className="link-field__dropdown"
          id={listboxId}
          role="listbox"
          aria-label="Matching records"
        >
          {loading && (
            <div className="link-field__message" role="status">
              Searching records…
            </div>
          )}

          {!loading && error && (
            <div className="link-field__message link-field__message--error">
              <span>{error}</span>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setError(null)
                  setIsOpen(true)
                  setSearchTerm((current) => `${current} `)
                }}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && options.length === 0 && (
            <div className="link-field__message">
              {searchTerm.trim()
                ? 'No matching records found.'
                : 'No records available.'}
            </div>
          )}

          {!loading && !error && options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={
                selectedOption?.value === option.value
              }
              className={[
                'link-field__option',
                index === activeIndex
                  ? 'link-field__option--active'
                  : '',
              ].filter(Boolean).join(' ')}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectOption(option)}
            >
              <span className="link-field__option-label">
                {option.label}
              </span>

              {option.label !== option.value && (
                <span className="link-field__option-value">
                  {option.value}
                </span>
              )}

              {selectedOption?.value === option.value && (
                <i
                  className="ri-check-line link-field__selected-icon"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {waitingForReference && (
        <p className="link-field__hint">
          Choose the reference type before selecting a record.
        </p>
      )}

      {error && !isOpen && (
        <p id={errorId} className="link-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
