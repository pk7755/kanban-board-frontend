/**
 * DragContext.tsx
 * Minimal context that tracks the in-flight drag state.
 * Both TaskCard (drag source) and Column (drop target) consume this.
 */

import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

/* ─── Shape ───────────────────────────────────────────────────────── */

interface DragState {
  taskId: string | null
  fromColumnId: string | null
}

interface DragContextValue extends DragState {
  isDragging: boolean
  startDrag: (taskId: string, fromColumnId: string) => void
  endDrag: () => void
}

/* ─── Context ─────────────────────────────────────────────────────── */

const DragContext = createContext<DragContextValue | null>(null)

/* ─── Provider ────────────────────────────────────────────────────── */

export function DragProvider({ children }: { children: ReactNode }) {
  const [drag, setDrag] = useState<DragState>({ taskId: null, fromColumnId: null })

  const startDrag = useCallback((taskId: string, fromColumnId: string) => {
    setDrag({ taskId, fromColumnId })
  }, [])

  const endDrag = useCallback(() => {
    setDrag({ taskId: null, fromColumnId: null })
  }, [])

  return (
    <DragContext.Provider
      value={{ ...drag, isDragging: drag.taskId !== null, startDrag, endDrag }}
    >
      {children}
    </DragContext.Provider>
  )
}

/* ─── Hook ────────────────────────────────────────────────────────── */

export function useDragContext(): DragContextValue {
  const ctx = useContext(DragContext)
  if (!ctx) throw new Error('useDragContext must be used inside DragProvider')
  return ctx
}
