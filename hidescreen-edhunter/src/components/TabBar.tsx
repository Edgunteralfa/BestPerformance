// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Pace } from '../hooks/usePitchTimer';
import type { NoteTab } from '../types';
import '../styles/TabBar.css';

interface TabBarProps {
  tabs: NoteTab[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onReorder: (tabs: NoteTab[]) => void;
  totalLabel: string;
  chapterLabel: string;
  totalPace: Pace;
  chapterPace: Pace;
  running: boolean;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onReview: () => void;
  startLabel: string;
  pauseLabel: string;
  resetLabel: string;
  reviewLabel: string;
}

function TabBar({
  tabs,
  activeTabId,
  onSelect,
  onReorder,
  totalLabel,
  chapterLabel,
  totalPace,
  chapterPace,
  running,
  onToggleTimer,
  onResetTimer,
  onReview,
  startLabel,
  pauseLabel,
  resetLabel,
  reviewLabel,
}: TabBarProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; moved: boolean } | null>(null);
  const orderRef = useRef<string[] | null>(null);
  const suppressClickRef = useRef(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [orderIds, setOrderIds] = useState<string[] | null>(null);

  useEffect(() => {
    if (!orderIds) return;
    const same = orderIds.length === tabs.length && orderIds.every((id, index) => tabs[index]?.id === id);
    if (same) setOrderIds(null);
  }, [orderIds, tabs]);

  const shown = (orderIds ?? tabs.map((tab) => tab.id))
    .map((id) => tabs.find((tab) => tab.id === id))
    .filter((tab): tab is NoteTab => tab !== undefined);

  const applyOrder = (ids: string[]) => {
    orderRef.current = ids;
    setOrderIds(ids);
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0) return;
    dragRef.current = { id, startX: event.clientX, moved: false };
    orderRef.current = tabs.map((tab) => tab.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const list = listRef.current;
    if (!drag || !list) return;
    if (!drag.moved && Math.abs(event.clientX - drag.startX) < 6) return;
    drag.moved = true;
    setDragId(drag.id);

    const current = orderRef.current ?? tabs.map((tab) => tab.id);
    const target = [...list.querySelectorAll<HTMLButtonElement>('.tab')].find((button) => {
      const rect = button.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right;
    });
    const toId = target?.dataset.tabId;
    if (!toId || toId === drag.id) return;
    const from = current.indexOf(drag.id);
    const to = current.indexOf(toId);
    if (from < 0 || to < 0) return;
    const next = [...current];
    next.splice(from, 1);
    next.splice(to, 0, drag.id);
    applyOrder(next);
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragId(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag?.moved) {
      orderRef.current = null;
      setOrderIds(null);
      return;
    }
    suppressClickRef.current = true;
    const ids = orderRef.current ?? tabs.map((tab) => tab.id);
    const next = ids
      .map((id) => tabs.find((tab) => tab.id === id))
      .filter((tab): tab is NoteTab => tab !== undefined);
    onReorder(next);
  };

  return (
    <div className="tab-bar">
      <div className="tab-list" ref={listRef}>
      {shown.map((tab) => {
        const active = tab.id === activeTabId;
        const dragging = tab.id === dragId;
        return (
          <button
            key={tab.id}
            type="button"
            data-tab-id={tab.id}
            className={`tab${active ? ' active' : ''}${dragging ? ' dragging' : ''}`}
            style={{
              color: active ? '#ffffff' : tab.color,
              backgroundColor: active ? tab.color : 'transparent',
              borderColor: tab.color,
            }}
            title={tab.name}
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              onSelect(tab.id);
            }}
            onPointerDown={(event) => onPointerDown(event, tab.id)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {tab.name}
          </button>
        );
      })}
      </div>
      <div className="pitch-timer">
        <span className={`timer-total${totalPace === 'warn' || totalPace === 'over' ? ` ${totalPace}` : ''}`} title={totalLabel}>{totalLabel}</span>
        <span className={`timer-chapter${chapterPace === 'warn' || chapterPace === 'over' ? ` ${chapterPace}` : ''}`} title={chapterLabel}>{chapterLabel}</span>
        <button type="button" className="timer-button" onClick={onToggleTimer} title={running ? pauseLabel : startLabel}>
          {running ? pauseLabel : startLabel}
        </button>
        <button type="button" className="timer-button" onClick={onResetTimer} title={resetLabel}>
          {resetLabel}
        </button>
        <button type="button" className="timer-button" onClick={onReview} title={reviewLabel}>
          {reviewLabel}
        </button>
      </div>
    </div>
  );
}

export default TabBar;
