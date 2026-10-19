// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useEffect, useState } from 'react';
import { bindDialogQueue, shiftDialog, type DialogRequest } from '../dialogQueue';
import { useI18n } from '../i18n';
import '../styles/AppDialog.css';

function AppDialog() {
  const { t } = useI18n();
  const [current, setCurrent] = useState<DialogRequest | null>(null);

  useEffect(() => {
    const showNext = () => {
      setCurrent((shown) => shown ?? shiftDialog());
    };
    bindDialogQueue(showNext);
    showNext();
    return () => {
      bindDialogQueue(null);
    };
  }, []);

  const close = (value: boolean) => {
    current?.resolve(value);
    const next = shiftDialog();
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
