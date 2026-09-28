// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useEffect, useState } from 'react';

function usesBeam(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('button, a, select, input, label, .title-bar-button, .resize-grip')) return false;
  return Boolean(target.closest('.text-editor, [contenteditable="true"]'));
}

function LocalCursor({ active }: { active: boolean }) {
  const [spot, setSpot] = useState<{ x: number; y: number; beam: boolean } | null>(null);

  useEffect(() => {
    if (!active) return;
    const move = (event: PointerEvent) => {
      setSpot({ x: event.clientX, y: event.clientY, beam: usesBeam(event.target) });
    };
    const leave = (event: PointerEvent) => {
      if (event.relatedTarget === null) setSpot(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerout', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerout', leave);
    };
  }, [active]);

  if (!active || !spot) return null;

  if (spot.beam) {
    return <div className="local-cursor beam" style={{ left: spot.x, top: spot.y }} />;
  }

  return (
    <svg
      className="local-cursor"
      style={{ left: spot.x, top: spot.y }}
      width="14"
      height="18"
      viewBox="0 0 14 18"
      aria-hidden="true"
    >
      <path d="M1 1 L1 15 L4.2 11.6 L7.4 17 L9.2 16 L6 10.6 L11 10.6 Z" fill="#ffffff" stroke="#111111" strokeWidth="1" />
    </svg>
  );
}

export default LocalCursor;
