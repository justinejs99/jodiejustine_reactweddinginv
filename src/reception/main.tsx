import React from 'react'
import ReactDOM from 'react-dom/client'
import ReceptionApp from './ReceptionApp.tsx'
import '../index.css'

ReactDOM.createRoot(document.getElementById('reception-root')!).render(
  <React.StrictMode>
    <ReceptionApp />
  </React.StrictMode>,
)
