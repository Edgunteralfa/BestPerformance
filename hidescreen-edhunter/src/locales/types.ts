import type { en } from './en';

export type Messages = { [K in keyof typeof en]: string };
