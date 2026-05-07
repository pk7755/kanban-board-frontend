/**
 * AppLayoutWrapper.tsx
 * Wires AppLayout to board and search providers.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BoardProvider, useBoardContext } from '@/context/BoardContext'
import { SearchProvider } from '@/context/SearchContext'
import { AppLayout } from './AppLayout'
import { boardsApi } from '@/utils/api'

function AppLayoutShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, dispatch, undo, redo, canUndo, canRedo } = useBoardContext()
  const [searchQuery, setSearchQuery] = useState('')
  const [newBoardDialogOpen, setNewBoardDialogOpen] = useState(false)

  // Ctrl+Z → undo, Ctrl+Shift+Z / Ctrl+Y → redo (spec: undo/redo keyboard)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (isEditing) return

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey && canUndo) {
          e.preventDefault()
          undo()
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          if (canRedo) {
            e.preventDefault()
            redo()
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canUndo, canRedo, undo, redo])

  const handleNewBoard = useCallback(() => {
    setNewBoardDialogOpen(true)
    if (!location.pathname.startsWith('/boards')) {
      navigate('/boards')
    }
  }, [location.pathname, navigate])

  const handleDeleteBoard = useCallback(async (boardId: string) => {
    await boardsApi.delete(boardId)
    dispatch({ type: 'DELETE_BOARD', payload: { boardId } })
  }, [dispatch])

  const contextValue = useMemo(
    () => ({
      searchQuery,
      newBoardDialogOpen,
      openNewBoardDialog: () => setNewBoardDialogOpen(true),
      closeNewBoardDialog: () => setNewBoardDialogOpen(false),
    }),
    [newBoardDialogOpen, searchQuery],
  )

  return (
    <SearchProvider value={contextValue}>
      <AppLayout
        boards={state.boards}
        activeBoardId={state.activeBoardId ?? undefined}
        onNewBoard={handleNewBoard}
        onDeleteBoard={handleDeleteBoard}
        onSearch={setSearchQuery}
      />
    </SearchProvider>
  )
}

export function AppLayoutWrapper() {
  return (
    <BoardProvider>
      <AppLayoutShell />
    </BoardProvider>
  )
}
