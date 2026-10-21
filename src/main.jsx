import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { prefetchSheetMenu } from './lib/sheetMenu'

// Someone who is probably signed in will open the menu next: start downloading it now,
// instead of waiting for the sign-in check and the live-date lookup to finish first.
try {
  if (Object.keys(localStorage).some(key => /^sb-.+-auth-token$/.test(key))) prefetchSheetMenu()
} catch { /* storage blocked: the menu page fetches it anyway */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
