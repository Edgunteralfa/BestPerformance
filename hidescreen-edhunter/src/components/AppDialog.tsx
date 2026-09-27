// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import '../styles/AppDialog.css';

type DialogKind = 'info' | 'warning' | 'error';

interface DialogRequest {
  title: string;
  body: string;
  kind: DialogKind;
  confirm: boolean;
  resolve: (value: boolean) => void;
}

let enqueue: ((request: DialogRequest) => void) | null = null;
const pending: DialogRequest[] = [];

function push(request: DialogRequest) {
  if (enqueue) enqueue(request);
  else pending.push(request);
}

export function appMessage(body: string, options: { title: string; kind?: DialogKind }): Promise<void> {
  return new Promise((resolve) => {
    push({
      title: options.title,
      body,
      kind: options.kind ?? 'info',
      confirm: false,
      resolve: () => resolve(),
    });
  });
}

export function appConfirm(body: string, options: { title: string; kind?: DialogKind }): Promise<boolean> {
  return new Promise((resolve) => {
    push({
      title: options.title,
      body,
      kind: options.kind ?? 'warning',
      confirm: true,
      resolve,
    });
  });
}

function AppDialog() {
  const { t } = useI18n();
  const [current, setCurrent] = useState<DialogRequest | null>(null);

  useEffect(() => {
    const showNext = () => {
      setCurrent((shown) => shown ?? pending.shift() ?? null);
    };
    enqueue = (request) => {
      pending.push(request);
      showNext();
    };
    showNext();
    return () => {
      enqueue = null;
    };
  }, []);

  const close = (value: boolean) => {
    current?.resolve(value);
    const next = pending.shift() ?? null;
    setCurrent(next);
  };

  if (!current) return null;

  return (
    <div className="app-dialog-backdrop">
      <div className={`app-dialog ${current.kind}`} role="dialog" aria-modal="true">
        <h2>{current.title}</h2>
        <p>{current.body}</p>
        <div className="app-dialog-actions">
          {current.confirm ? (
            <button type="button" className="button cancel-button" onClick={() => close(false)}>
              {t('cancel')}
            </button>
          ) : null}
          <button type="button" className="button save-button" onClick={() => close(true)}>
            {current.confirm ? t('dialogYes') : t('dialogOk')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AppDialog;
