// MIT License - Copyright (c) 2026 BestPerformance Contributors

export type DialogKind = 'info' | 'warning' | 'error';

export interface DialogRequest {
  title: string;
  body: string;
  kind: DialogKind;
  confirm: boolean;
  resolve: (value: boolean) => void;
}

let notify: (() => void) | null = null;
const pending: DialogRequest[] = [];

function push(request: DialogRequest) {
  pending.push(request);
  notify?.();
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

export function bindDialogQueue(handler: (() => void) | null) {
  notify = handler;
}

export function shiftDialog(): DialogRequest | null {
  return pending.shift() ?? null;
}
