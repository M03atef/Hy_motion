import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { useUiStore } from '@/stores/ui-store'
import { useAuthStore } from '@/stores/auth-store'
import { consumeImpersonationTokenFromUrl } from '@/lib/impersonation-handoff'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Platform Console handoff — must run before first auth render.
if (consumeImpersonationTokenFromUrl()) {
  useAuthStore.getState().hydrate()
}

function Root() {
  const applyDocumentDirection = useUiStore((s) => s.applyDocumentDirection)
  useEffect(() => {
    applyDocumentDirection()
  }, [applyDocumentDirection])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
