# Kanban Task Board

A production-quality Kanban project tracking app built with **React 19 + TypeScript (strict) + Vite**.

- **No UI libraries** — every component hand-crafted.
- **No drag-and-drop libraries** — native HTML5 Drag and Drop API.
- **No CSS frameworks** — custom design system with CSS variables and `tokens.css`.
- **Two roles:** Manager and Team Member with enforced permissions throughout.

---

## Features

| Area                | Details                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Boards**          | Create, rename, delete, switch via sidebar                                               |
| **Columns**         | Add, rename, reorder (drag), delete per board                                            |
| **Tasks**           | Full CRUD — title, description (markdown), priority, due date, assignee, tags, checklist |
| **Drag & Drop**     | Move tasks between columns and reorder within a column                                   |
| **Inline edit**     | Click any task title to edit in-place                                                    |
| **Search**          | Debounced 300ms global search across title + description                                 |
| **Filter**          | Priority, tag, assignee, due-date range, overdue-only                                    |
| **Sort**            | Per-column sort by priority, due date, or manual order                                   |
| **Undo / Redo**     | Last 20 actions (move, delete, update task) — `Ctrl+Z` / `Ctrl+Shift+Z`                  |
| **Themes**          | Light / Dark / System with smooth CSS variable transition                                |
| **Import / Export** | Full board JSON export and import                                                        |
| **Roles**           | Manager: full control. Team Member: own tasks only, read-only on others                  |
| **User Management** | Manager-only: create, edit, deactivate, reset password for team members                  |
| **Offline**         | `navigator.onLine` banner — app stays functional with cached data                        |
| **Accessibility**   | Full keyboard navigation, focus trap in dialogs, ARIA roles, WCAG AA contrast            |

---

## Getting Started

```bash
npm install
npm run dev          # dev server at http://localhost:5173
npm run build        # production build (tsc + vite)
npm run lint         # ESLint — must exit with 0 warnings
npm test             # Vitest unit tests (44 tests across 5 suites)
npm run format:check # Prettier check
```

**Default mock credentials** (when `VITE_USE_MOCK=true`):

| Role        | Email              | Password      |
| ----------- | ------------------ | ------------- |
| Manager     | `manager@test.com` | `Manager@123` |
| Team Member | `member@test.com`  | `Member@123`  |

---

## Switching Between Mock API and Real API

All network calls go through `src/utils/api.ts`, which acts as a one-line switch:

```env
# .env.local — localStorage-backed mock (default for development)
VITE_USE_MOCK=true

# .env.local — real backend via ngrok
VITE_USE_MOCK=false
VITE_API_BASE_URL=https://your-ngrok-url.ngrok-free.app
```

`mockApiClient.ts` and `apiClient.ts` export **identical function signatures**.
Switching requires only the env flag — zero component changes.

The real API client (`apiClient.ts`):

- Prepends `VITE_API_BASE_URL` to every request
- Adds `Authorization: Bearer <token>` and `ngrok-skip-browser-warning: true` headers
- On 401, attempts one silent token refresh then forces logout
- Supports `AbortController` via `signal` option for request cancellation

---

## Folder Structure

```
src/
├── components/
│   ├── auth/               # ProtectedRoute, RoleGuard
│   ├── board/              # Column, TaskCard, FilterBar, TagPicker,
│   │                       #   CreateTaskModal, ManageTagsModal, BoardMembersModal
│   ├── layout/             # AppLayout, AppLayoutWrapper, Header, Sidebar
│   └── ui/                 # Button, Badge, Input, Skeleton, EmptyState,
│                           #   Toast, ConfirmModal, ErrorBoundary
├── context/
│   ├── AuthContext.tsx     # JWT auth — login, logout, token refresh, /auth/me
│   ├── BoardContext.tsx    # Board + task state (useReducer + undo/redo)
│   ├── DragContext.tsx     # In-flight drag-state tracking
│   ├── FilterContext.tsx   # Per-board filter state
│   ├── SearchContext.tsx   # Debounced global search + new-board dialog state
│   ├── ThemeContext.tsx    # light / dark / system theme
│   └── ToastContext.tsx    # Toast notification queue
├── hooks/
│   ├── useDebounce.ts      # Generic debounce — used for search (300 ms)
│   ├── useKeyboardShortcut.ts  # Declarative keyboard shortcut registration
│   ├── useLocalStorage.ts  # Versioned, type-safe localStorage persistence
│   ├── usePermissions.ts   # Role-based permission checks (single source of truth)
│   └── useUndoRedo.ts      # Generic undo/redo stack, capped at 20 entries
├── pages/
│   ├── BoardPage.tsx       # Main kanban board view
│   ├── LoginPage.tsx       # /login — public
│   ├── NotAuthorizedPage.tsx  # Shown when a team member hits /users directly
│   ├── ProfilePage.tsx     # /profile — edit name, email, avatar, password
│   ├── TaskDetail.tsx      # Lazy-loaded task detail <dialog>
│   └── UsersPage.tsx       # /users — Manager-only user management
├── styles/
│   ├── tokens.css          # ALL design tokens: colors (9-step scale), spacing,
│   │   tokens.dark.css     #   typography, radii, shadows — light + dark themes
│   ├── global.css          # Reset, base styles, prefers-reduced-motion
│   ├── board/              # Column.css, Column.drop.css, TaskCard.css,
│   │                       #   TaskCard.detail.css, FilterBar.css, FilterBar.dropdown.css
│   ├── components/         # Button.css, Badge.css, Input.css, Toast.css, Skeleton.css,
│   │                       #   EmptyState.css, ConfirmModal.css, BoardMembersModal.css,
│   │                       #   BoardMembersModal.list.css, ManageTagsModal.css,
│   │                       #   ManageTagsModal.form.css, TagPicker.css, TagPicker.dropdown.css
│   ├── layout/             # AppLayout.css, Header.css, Sidebar.css, Sidebar.nav.css
│   └── pages/              # BoardPage.css, LoginPage.css, ProfilePage.css,
│                           #   ProfilePage.form.css, TaskDetail.css, TaskDetail.form.css,
│                           #   TaskDetail.checklist.css, UsersPage.css, UsersPage.table.css
├── test/
│   ├── boardReducer.test.ts    # 22 reducer tests (board/column/task/tag/loading)
│   ├── useDebounce.test.ts     # 4 tests
│   ├── useKeyboardShortcut.test.ts  # 5 tests
│   ├── useLocalStorage.test.ts # 6 tests (incl. versioning + migration)
│   └── useUndoRedo.test.ts     # 7 tests
├── types/
│   ├── actions.ts          # Discriminated union BoardAction (ADD_TASK | UPDATE_TASK | …)
│   ├── api.ts              # API response envelope shapes
│   ├── auth.ts             # LoginCredentials, AuthState
│   ├── entities.ts         # Board, Column, Task, User, Tag, ChecklistItem + type guards
│   └── index.ts            # Re-exports
└── utils/
    ├── adapters.ts         # Raw API → domain type transformers
    ├── api.ts              # Single import point: switches mock ↔ real by env flag
    ├── apiClient.ts        # Real fetch wrapper (base URL, JWT, ngrok header, refresh)
    ├── mockApiClient.ts    # localStorage-backed mock — identical API shape
    ├── storage.ts          # Versioned localStorage read/write with migration support
    └── tokenStore.ts       # In-memory JWT access-token store
```

---

## Custom Hooks

| Hook                  | Purpose                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useLocalStorage<T>`  | Read/write to localStorage with optional **versioning** and **migration function**. Generic constraint `T extends object` ensures type safety.                                                                                             |
| `useDebounce<T>`      | Returns a debounced copy of any value — generic, reusable. Used for search (300 ms delay).                                                                                                                                                 |
| `useUndoRedo<T>`      | Generic circular undo/redo stack capped at 20 entries. Uses `useRef` for the stack (no re-render on push/pop) and separate `useState` for the reactive `canUndo`/`canRedo` flags.                                                          |
| `useKeyboardShortcut` | Declaratively register a keyboard shortcut. Automatically skips when focus is inside an `<input>`, `<textarea>`, or `[contenteditable]` to avoid stealing keystrokes.                                                                      |
| `usePermissions`      | Single source of truth for role-based UI gates. Exposes `canEditTask(task)`, `canDragTask(task)`, `canDeleteTask(task)`, `canReassign(task)`, and `canManageUsers`. All components import this — no scattered `role === 'MANAGER'` checks. |

---

## Keyboard Shortcuts

| Key                | Action                                                          |
| ------------------ | --------------------------------------------------------------- |
| `N`                | Open "Add task" form in the first column                        |
| `/`                | Focus the global search input                                   |
| `↑ / ↓`            | Move focus up / down within the current column                  |
| `← / →`            | Move focus to the same-index task in the previous / next column |
| `Enter` or `Space` | Open task detail popup when a card is focused                   |
| `Esc`              | Close any open popup or dialog                                  |
| `Ctrl + Z`         | Undo the last action (move, delete, or edit task)               |
| `Ctrl + Shift + Z` | Redo                                                            |
| `Ctrl + Y`         | Redo (alternative)                                              |

---

## Testing

```bash
npm test             # run all 44 tests
npm run test -- --run  # CI mode (no watch)
```

**Test suites:**

| Suite                         | Tests | What it covers                                                                                                              |
| ----------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| `boardReducer.test.ts`        | 22    | Board CRUD, column CRUD, task CRUD, task movement (cross-column + same-column reorder), tag management, loading/error state |
| `useUndoRedo.test.ts`         | 7     | Push, undo, redo, max history cap, state isolation                                                                          |
| `useLocalStorage.test.ts`     | 6     | Read, write, version match, migration, SSR safety                                                                           |
| `useKeyboardShortcut.test.ts` | 5     | Key binding, modifier keys, skip-in-input                                                                                   |
| `useDebounce.test.ts`         | 4     | Delay, immediate value, cleanup                                                                                             |

---

## One Thing I Found Difficult

**Keeping undo/redo stable with `useReducer` — avoiding infinite loops and stale closures.**

The challenge: `useReducer` replaces state on every dispatch. To undo, we need a snapshot of the state _before_ an action fires. A naïve second `useReducer` for the undo stack created circular dependencies — pushing a snapshot dispatched an action, which triggered effects, which dispatched more actions.

**Solution:** The undo/redo stacks live in `useRef` arrays (mutation does not trigger re-renders). Three separate `useState` variables (`canUndo`, `canRedo`, `lastUndoDescription`) are updated only when the stacks actually change, via a `syncFlags` callback. A `stateRef` always points at the latest state, letting the undo/redo callbacks read it without being listed in `useEffect` dependencies. This gives reactive UI updates without making the stacks themselves reactive and without any risk of circular dispatches.

---

## Architecture Notes

- **Auth:** Access token is stored in memory (`tokenStore.ts`) so it is never accessible to JS injected in the page. Refresh token is in `localStorage` (tradeoff documented: httpOnly cookies require server-side config the backend intern has not yet added). On 401, the API client attempts one silent refresh; if that also fails, it calls `forceLogout`.
- **State:** Board data lives in `BoardContext` (`useReducer`). Theme in `ThemeContext`. Auth in `AuthContext`. No external state library.
- **CSS design system:** All colours are CSS variables in `styles/tokens.css` using a 9-step scale (50–900) for each role (primary, gray, danger, warning, success, info). No hardcoded hex values in component CSS files. Dark-theme overrides live in `tokens.dark.css`. Themes switch by toggling a class on `<html>`.
- **Offline:** `navigator.onLine` + `online`/`offline` events drive the offline banner in the header. The app stays functional with cached board data.
- **Import / Export:** Export serialises the active board + all its tasks to JSON and triggers a browser download. Import reads the file, validates the shape, and dispatches `IMPORT_BOARD` to merge the data.
- **Container queries:** `board-column__body` has `container-type: inline-size`. Task cards use `@container task-column` rules to adapt their layout at narrow (< 220px) and wide (> 400px) column widths.
- **Animations:** All transitions use `cubic-bezier(0.16, 1, 0.3, 1)` for entrances. `prefers-reduced-motion: reduce` disables keyframe animations globally.

---

## Screenshot

```md
![Kanban Task Board - Home](docs/KanbanBoard.png)
![Kanban Task Board - Team Members](docs/TeamMembers.png)
![Kanban Task Board - My Profile](docs/MyProfile.png)
```
