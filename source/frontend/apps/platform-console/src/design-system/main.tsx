import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyDsDocument, DS_DEFAULT_THEME } from './theme'
import { DesignSystemApp } from './DesignSystemApp'
import { PreviewProvider } from './preview-context'
import './tokens.css'
import './components.css'
import './preview.css'

const q = new URLSearchParams(window.location.search)
const bootTheme = q.get('theme') === 'light' ? 'light' : DS_DEFAULT_THEME
const bootLocale = q.get('lang') === 'ar' ? 'ar' : 'en'
applyDsDocument(bootTheme, bootLocale)

createRoot(document.getElementById('ds-root')!).render(
  <StrictMode>
    <PreviewProvider>
      <DesignSystemApp />
    </PreviewProvider>
  </StrictMode>,
)
