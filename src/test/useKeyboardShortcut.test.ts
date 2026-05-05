/**
 * useKeyboardShortcut.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'
import { fireEvent } from '@testing-library/react'

describe('useKeyboardShortcut', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('calls the handler for a registered key', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ n: handler }))

    fireEvent.keyDown(document, { key: 'n' })

    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not call handler for unregistered key', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ n: handler }))

    fireEvent.keyDown(document, { key: 'm' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('suppresses shortcut when focus is inside an input (ignoreInputs: true)', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ n: handler }, { ignoreInputs: true }))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    fireEvent.keyDown(input, { key: 'n' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('fires shortcut inside input when ignoreInputs is false', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ n: handler }, { ignoreInputs: false }))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    fireEvent.keyDown(input, { key: 'n' })

    expect(handler).toHaveBeenCalledOnce()
  })

  it('cleans up the event listener on unmount', () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() => useKeyboardShortcut({ n: handler }))

    unmount()
    fireEvent.keyDown(document, { key: 'n' })

    expect(handler).not.toHaveBeenCalled()
  })
})
