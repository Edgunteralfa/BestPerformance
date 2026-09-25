// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useEffect, useRef } from 'react';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';

export interface HotkeyHandlers {
  toggleVisibility: () => void;
  toggleLock: () => void;
  quickEdit: () => void;
  emergencyUnlock: () => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
  cycleOpacity: () => void;
  positionPreset: (index: number) => void;
  nudge: (direction: 'up' | 'down' | 'left' | 'right') => void;
  toggleSettings: () => void;
  resetGeometry: () => void;
  quit: () => void;
  panic: () => void;
  copyAll: () => void;
  pasteReplace: () => void;
  clearText: () => void;
  previousChapter: () => void;
  nextChapter: () => void;
  previousLine: () => void;
  nextLine: () => void;
  toggleTimer: () => void;
  resetTimer: () => void;
}

// Wrapper that isolates each registration so one failure doesn't block the rest.
// Tauri 2 fires handlers on both Pressed and Released — we only act on Pressed.
async function tryRegister(shortcut: string, handler: () => void): Promise<boolean> {
  try {
    await register(shortcut, (event) => {
      if (event.state === 'Pressed') {
        handler();
      }
    });
    return true;
  } catch (error) {
    console.warn(`Failed to register hotkey "${shortcut}":`, error);
    return false;
  }
}

const POSITION_PRESET_KEYS = Array.from({ length: 9 }, (_, i) => `CmdOrCtrl+Alt+${i + 1}`);

export function useGlobalHotkeys(handlers: HotkeyHandlers) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    let mounted = true;
    const h = () => handlersRef.current;

    const registerAll = async () => {
      // Window controls
      await tryRegister('CmdOrCtrl+Shift+H', () => { if (mounted) h().toggleVisibility(); });
      await tryRegister('CmdOrCtrl+Shift+L', () => { if (mounted) h().toggleLock(); });
      await tryRegister('CmdOrCtrl+Shift+E', () => { if (mounted) h().quickEdit(); });

      // Emergency unlock via bare Escape is handled by a low-level keyboard hook in Rust

      // Font size
      await tryRegister('CmdOrCtrl+Shift+PageUp', () => { if (mounted) h().increaseFontSize(); });
      await tryRegister('CmdOrCtrl+Shift+PageDown', () => { if (mounted) h().decreaseFontSize(); });
      await tryRegister('CmdOrCtrl+Shift+Home', () => { if (mounted) h().resetFontSize(); });

      // Opacity
      await tryRegister('CmdOrCtrl+Shift+O', () => { if (mounted) h().cycleOpacity(); });

      // Position presets (3x3 grid)
      for (let i = 0; i < POSITION_PRESET_KEYS.length; i++) {
        const index = i + 1;
        const shortcut = POSITION_PRESET_KEYS[i];
        await tryRegister(shortcut, () => { if (mounted) h().positionPreset(index); });
      }

      // Nudge window
      await tryRegister('CmdOrCtrl+Shift+ArrowUp', () => { if (mounted) h().nudge('up'); });
      await tryRegister('CmdOrCtrl+Shift+ArrowDown', () => { if (mounted) h().nudge('down'); });
      await tryRegister('CmdOrCtrl+Alt+ArrowLeft', () => { if (mounted) h().nudge('left'); });
      await tryRegister('CmdOrCtrl+Alt+ArrowRight', () => { if (mounted) h().nudge('right'); });

      // App controls
      await tryRegister('CmdOrCtrl+Shift+S', () => { if (mounted) h().toggleSettings(); });
      await tryRegister('CmdOrCtrl+Shift+R', () => { if (mounted) h().resetGeometry(); });
      await tryRegister('CmdOrCtrl+Shift+Q', () => { if (mounted) h().quit(); });
      await tryRegister('CmdOrCtrl+Shift+F1', () => { if (mounted) h().panic(); });

      // Text operations
      await tryRegister('CmdOrCtrl+Shift+C', () => { if (mounted) h().copyAll(); });
      await tryRegister('CmdOrCtrl+Shift+V', () => { if (mounted) h().pasteReplace(); });
      await tryRegister('CmdOrCtrl+Shift+Delete', () => { if (mounted) h().clearText(); });

      // Chapter changes use Shift so plain arrows still reach the pitch deck.
      await tryRegister('CmdOrCtrl+Shift+ArrowLeft', () => { if (mounted) h().previousChapter(); });
      await tryRegister('CmdOrCtrl+Shift+ArrowRight', () => { if (mounted) h().nextChapter(); });
      await tryRegister('CmdOrCtrl+Alt+ArrowUp', () => { if (mounted) h().previousLine(); });
      await tryRegister('CmdOrCtrl+Alt+ArrowDown', () => { if (mounted) h().nextLine(); });
      await tryRegister('CmdOrCtrl+Shift+T', () => { if (mounted) h().toggleTimer(); });
      await tryRegister('CmdOrCtrl+Shift+Y', () => { if (mounted) h().resetTimer(); });
    };

    registerAll();

    return () => {
      mounted = false;
      unregisterAll().catch((e) =>
        console.error('Failed to unregister hotkeys:', e),
      );
    };
  }, []);
}
