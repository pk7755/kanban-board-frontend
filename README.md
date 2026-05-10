# Kanban Task Board

A full-featured Kanban-style project tracking app built with **React 19 + TypeScript (strict) + Vite**.  
No UI libraries. No drag-and-drop libraries. All logic hand-crafted.

---

## Getting Started

```bash
npm install
npm run dev          # dev server at http://localhost:5173
npm run build        # production build
npm run lint         # ESLint (must be 0 warnings)
npm test             # Vitest unit tests
```

**Default mock credentials** (when `VITE_USE_MOCK=true`):

| Role        | Email              | Password      |
| ----------- | ------------------ | ------------- |
| Manager     | `manager@test.com` | `Manager@123` |
| Team Member | `member@test.com`  | `Member@123`  |

---

## Switching Between Mock API and Real API

All network calls go through `src/utils/api.ts`, which acts as a switch:

```env
# .env.local — use localStorage-backed mock (default for development)
VITE_USE_MOCK=true

# .env.local — use real backend
VITE_USE_MOCK=false
VITE_API_BASE_URL=https://your-ngrok-url.ngrok-free.app
```

The mock client (`src/utils/mockApiClient.ts`) and the real client (`src/utils/apiClient.ts`) export identical function signatures. Switching between them requires only changing the env flag — no component code changes.

---

## Folder Structure

```
src/
├── components/
│   ├── auth/          # ProtectedRoute, RoleGuard
│   ├── board/         # Column, TaskCard, FilterBar
│   ├── layout/        # AppLayout, AppLayoutWrapper, Header, Sidebar
│   └── ui/            # Button, Badge, Skeleton, EmptyState, Toast, ErrorBoundary
├── context/
│   ├── AuthContext.tsx      # JWT auth, login/logout, token refresh
│   ├── BoardContext.tsx     # Board + task state (useReducer), undo/redo
│   ├── DragContext.tsx      # In-flight drag tracking
│   ├── FilterContext.tsx    # Column filter state
│   ├── SearchContext.tsx    # Debounced global search
│   ├── ThemeContext.tsx     # light / dark / system theme
│   └── ToastContext.tsx     # Toast queue
├── hooks/
│   ├── useDebounce.ts       # Generic debounce
│   ├── useKeyboardShortcut.ts
│   ├── useLocalStorage.ts   # Generic versioned localStorage hook
│   ├── usePermissions.ts    # Role-based permission checks
│   └── useUndoRedo.ts       # Generic undo/redo stack (tested separately)
├── pages/
│   ├── BoardPage.tsx        # Main kanban board
│   ├── LoginPage.tsx
│   ├── NotAuthorizedPage.tsx
│   ├── TaskDetail.tsx       # Lazy-loaded task detail popup
│   └── UsersPage.tsx        # Manager-only user management
├── styles/
│   ├── tokens.css           # All design tokens (colors, spacing, typography)
│   ├── global.css
│   ├── board/               # Column.css, TaskCard.css, FilterBar.css
│   ├── components/          # Button.css, Badge.css, Toast.css, …
│   ├── layout/              # AppLayout.css, Header.css, Sidebar.css
│   └── pages/               # BoardPage.css, LoginPage.css, UsersPage.css
├── types/
│   ├── actions.ts           # Discriminated union BoardAction
│   ├── api.ts               # API response shapes
│   ├── auth.ts              # LoginCredentials, AuthState
│   ├── entities.ts          # Board, Column, Task, User, Tag, ChecklistItem
│   └── index.ts             # Re-exports
└── utils/
    ├── api.ts               # Single import point (mock / real switch)
    ├── apiClient.ts         # Real fetch wrapper (ngrok, JWT, refresh)
    ├── mockApiClient.ts     # localStorage-backed mock
    ├── storage.ts           # Versioned localStorage persistence
    └── tokenStore.ts        # In-memory JWT storage
```

---

## Custom Hooks

| Hook                  | Purpose                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `useLocalStorage<T>`  | Read/write localStorage with versioning and type safety                                                                      |
| `useDebounce<T>`      | Delay a value update — used for search (300 ms)                                                                              |
| `useUndoRedo<T>`      | Generic undo/redo stack, capped at 20 entries                                                                                |
| `useKeyboardShortcut` | Declaratively register keyboard shortcuts; skips when focus is in inputs                                                     |
| `usePermissions`      | Single source of truth for role-based checks: `canEditTask`, `canDragTask`, `canDeleteTask`, `canReassign`, `canManageUsers` |

---

## Keyboard Shortcuts

| Key                             | Action                                                    |
| ------------------------------- | --------------------------------------------------------- |
| `N`                             | Open "Add task" form in the first column                  |
| `/`                             | Focus the global search input                             |
| `↑ / ↓`                         | Move focus up/down within a column                        |
| `← / →`                         | Move focus to same-index task in the previous/next column |
| `Enter` or `Space`              | Open task detail popup when a card is focused             |
| `Esc`                           | Close any open popup or dialog                            |
| `Ctrl + Z`                      | Undo last action (move, delete, or edit task)             |
| `Ctrl + Shift + Z` / `Ctrl + Y` | Redo                                                      |

---

## One Thing I Found Difficult

**Making undo/redo work with `useReducer` without infinite loops.**

The challenge: `useReducer` produces a new state object on every action. To undo, we need to snapshot the _previous_ state before the action fires. Using a second `useReducer` or `useState` for the undo stack caused circular dependencies where snapshotting mutated state, which triggered effects, which dispatched actions.

**Solution:** I keep the undo/redo stacks in `useRef` arrays (no re-render on push/pop) and maintain three separate state variables (`canUndo`, `canRedo`, `lastUndoDescription`) that are updated only when the stacks actually change via a `syncFlags` callback. This gives reactive UI updates without making the stacks themselves reactive. The `stateRef` (always pointing to the current state) lets undo/redo callbacks read the latest state without being listed as effect dependencies.

---

## Screenshot

> Add a screenshot of the app here: `docs/screenshot.png`

---

## Architecture Notes

- **Auth:** JWT stored in memory (`tokenStore.ts`). Refresh token in `localStorage`. On 401, the API client attempts one silent refresh; if that fails too, it calls `forceLogout`.
- **State:** Board data lives in `BoardContext` (useReducer). Theme in `ThemeContext`. Auth in `AuthContext`. All are React Context — no external state library.
- **CSS:** All colors are CSS variables defined in `styles/tokens.css`. No hardcoded hex values in component CSS files. Themes are switched by toggling a class on `<html>`.
- **Offline:** `navigator.onLine` + `online`/`offline` events drive the offline banner in the header.
- **Import/Export:** Export serialises the active board + its tasks to JSON. Import parses and dispatches `IMPORT_BOARD`.
