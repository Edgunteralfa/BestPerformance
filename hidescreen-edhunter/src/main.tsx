import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import './index.css'
import App from './App.tsx'
import CardApp from './components/CardWindow.tsx'
import { isMac, MAC_SHELL_NAME } from './platform'

if (isMac) document.title = MAC_SHELL_NAME

// Disable right-click context menu
document.addEventListener('contextmenu', (e) => e.preventDefault());

const Root = getCurrentWindow().label === 'card' ? CardApp : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
