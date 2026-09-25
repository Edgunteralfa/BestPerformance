// MIT License - Copyright (c) 2026 BestPerformance Contributors

import type { Config } from './types';

export type LineKind = 'body' | 'heading' | 'mark' | 'note';

export interface Line {
  kind: LineKind;
  text: string;
}

const PREFIX: Record<Exclude<LineKind, 'body'>, string> = {
  heading: '# ',
  mark: '! ',
  note: '~ ',
};

function kindOf(line: string): Line {
  if (line.startsWith(PREFIX.heading)) return { kind: 'heading', text: line.slice(2) };
  if (line.startsWith(PREFIX.mark)) return { kind: 'mark', text: line.slice(2) };
  if (line.startsWith(PREFIX.note)) return { kind: 'note', text: line.slice(2) };
  return { kind: 'body', text: line };
}

export function parseText(text: string): Line[] {
  if (text.length === 0) return [{ kind: 'body', text: '' }];
  return text.split('\n').map(kindOf);
}

export function serialize(lines: Line[]): string {
  return lines
    .map((line) => (line.kind === 'body' ? line.text : `${PREFIX[line.kind]}${line.text}`))
    .join('\n');
}

export function readLines(root: HTMLElement): Line[] {
  const blocks = [...root.children].filter((node): node is HTMLElement => node instanceof HTMLElement);
  if (blocks.length === 0) {
    return [{ kind: 'body', text: '' }];
  }
  return blocks.map((block) => ({
    kind: (block.dataset.kind as LineKind | undefined) ?? 'body',
    text: block.textContent?.replace(/\u00a0/g, ' ') ?? '',
  }));
}

function colorFor(kind: LineKind, config: Config): string {
  if (kind === 'heading') return config.headingColor;
  if (kind === 'mark') return config.markColor;
  if (kind === 'note') return config.noteColor;
  return config.fontColor;
}

export function paintLine(block: HTMLElement, line: Line, config: Config) {
  block.dataset.kind = line.kind;
  block.style.color = colorFor(line.kind, config);
  block.style.fontWeight = line.kind === 'heading' ? '650' : '400';
}

export function fillEditor(root: HTMLElement, lines: Line[], config: Config) {
  root.replaceChildren();
  for (const line of lines) {
    const block = document.createElement('div');
    block.className = 'line';
    paintLine(block, line, config);
    block.textContent = line.text;
    if (line.text.length === 0) {
      block.appendChild(document.createElement('br'));
    }
    root.appendChild(block);
  }
}

export function toggleLineKind(root: HTMLElement, kind: Exclude<LineKind, 'body'>, config: Config): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  let node: Node | null = selection.anchorNode;
  while (node && node.parentElement !== root) {
    node = node.parentNode;
  }
  if (!(node instanceof HTMLElement) || !root.contains(node)) return false;
  const current = (node.dataset.kind as LineKind | undefined) ?? 'body';
  paintLine(node, { kind: current === kind ? 'body' : kind, text: node.textContent ?? '' }, config);
  return true;
}
