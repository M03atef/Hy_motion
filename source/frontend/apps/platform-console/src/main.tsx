import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import { setUnauthorizedHandler } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

setUnauthorizedHandler(() => {
  useAuthStore.getState().logout()
  useUiStore.getState().setBanner(useUiStore.getState().t('platform.sessionExpired'))
  if (window.location.pathname !== '/login') {
    window.location.assign(`/login`)
  }
})

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.query.state.status === 'error') {
    const err = event.query.state.error
    const msg = err instanceof Error ? err.message : useUiStore.getState().t('errors.generic')
    if (!msg.toLowerCase().includes('401') && !msg.toLowerCase().includes('unauthorized')) {
      if (String(err).includes('Network') || (err as { status?: number })?.status && (err as { status: number }).status >= 500) {
        useUiStore.getState().setBanner(useUiStore.getState().t('errors.generic'))
      }
    }
  }
})

useUiStore.getState().applyDocumentDirection()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
