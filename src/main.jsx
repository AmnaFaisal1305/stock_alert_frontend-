import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, dehydrate, hydrate } from '@tanstack/react-query'
import '@fontsource-variable/figtree'
import './index.css'
import App from './App.jsx'

// Capture the install prompt before React hydrates — it can fire very early
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__pwaInstallPrompt = e
})

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() => import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })))
  : null

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // never retry a 401 — it would double-dispatch sst:session-expired
      retry: (failureCount, error) => error?.status !== 401 && failureCount < 1,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
})

// The lists the offline forms need survive a reload with no signal. login/logout clear the
// client, which empties the saved copy too, so it only ever holds the signed-in user's data.
// shortcut: localStorage (~5 MB) is fine for one facility's lists; move to IndexedDB if a larger role needs offline
const CACHE_KEY = 'sst_query_cache'
const PERSISTED = new Set(['vaccines', 'users', 'holdings', 'dashboard'])
try {
  const saved = localStorage.getItem(CACHE_KEY)
  if (saved) hydrate(queryClient, JSON.parse(saved))
} catch { /* corrupt or blocked storage: start empty */ }
let saveTimer
queryClient.getQueryCache().subscribe(() => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const state = dehydrate(queryClient, {
      // Keep data even when the last refetch failed (no signal): an error state still holds it.
      shouldDehydrateQuery: (q) => q.state.data !== undefined && q.queryKey.length === 1 && PERSISTED.has(q.queryKey[0]),
    })
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)) } catch { /* quota: keep the previous copy */ }
  }, 1000)
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {ReactQueryDevtools && (
        <Suspense>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      )}
    </QueryClientProvider>
  </StrictMode>,
)
