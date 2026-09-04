import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { FatalError } from './components/FatalError'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallback={(retry) => <FatalError retry={retry} />}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
