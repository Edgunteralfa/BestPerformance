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

interface InkPiece {
  text: string;
  color: string | null;
}

function mergePieces(pieces: InkPiece[]): InkPiece[] {
  const merged: InkPiece[] = [];
  for (const piece of pieces) {
    if (piece.text.length === 0) continue;
    const previous = merged[merged.length - 1];
    if (previous && previous.color === piece.color) previous.text += piece.text;
    else merged.push({ text: piece.text, color: piece.color });
  }
  return merged;
}

function parsePieces(raw: string): InkPiece[] {
  const pieces: InkPiece[] = [];
  const pattern = /\{\{(#[0-9a-fA-F]{6})\}\}([\s\S]*?)\{\{\/\}\}/g;
  let last = 0;
  for (const match of raw.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) pieces.push({ text: raw.slice(last, index), color: null });
    if (match[2]) pieces.push({ text: match[2], color: match[1].toUpperCase() });
    last = index + match[0].length;
  }
  if (last < raw.length) pieces.push({ text: raw.slice(last), color: null });
  return mergePieces(pieces);
}

function serializePieces(pieces: InkPiece[]): string {
  return mergePieces(pieces)
    .map((piece) => (piece.color ? `{{${piece.color}}}${piece.text}{{/}}` : piece.text))
    .join('');
}

function piecesFromDom(block: HTMLElement): InkPiece[] {
  const pieces: InkPiece[] = [];
  const walk = (node: Node, color: string | null) => {
    if (node instanceof HTMLBRElement) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\u00a0/g, ' ');
      if (text.length > 0) pieces.push({ text, color });
      return;
    }
    if (node instanceof HTMLElement) {
      const ink = node.dataset.ink && /^#[0-9a-fA-F]{6}$/.test(node.dataset.ink) ? node.dataset.ink.toUpperCase() : color;
      for (const child of node.childNodes) walk(child, ink);
    }
  };
  for (const child of block.childNodes) walk(child, null);
  return mergePieces(pieces);
}

function writePieces(block: HTMLElement, pieces: InkPiece[]) {
  block.replaceChildren();
  const merged = mergePieces(pieces);
  if (merged.length === 0) {
    block.appendChild(document.createElement('br'));
    return;
  }
  for (const piece of merged) {
    if (!piece.color) {
      block.appendChild(document.createTextNode(piece.text));
      continue;
    }
    const span = document.createElement('span');
    span.className = 'word-ink';
    span.dataset.ink = piece.color;
    span.style.color = piece.color;
    span.textContent = piece.text;
    block.appendChild(span);
  }
}

function lineElement(node: Node | null, root: HTMLElement): HTMLElement | null {
  const element = node instanceof Element ? node : node?.parentElement ?? null;
  const line = element?.closest('.line');
  if (!(line instanceof HTMLElement) || line.parentElement !== root) return null;
  return line;
}

function offsetInLine(line: HTMLElement, container: Node, offset: number): number | null {
  try {
    const probe = document.createRange();
    probe.setStart(line, 0);
    probe.setEnd(container, offset);
    return probe.toString().replace(/\u00a0/g, ' ').length;
  } catch {
    return null;
  }
}

function paintRange(pieces: InkPiece[], from: number, to: number, color: string | null): InkPiece[] {
  const next: InkPiece[] = [];
  let at = 0;
  for (const piece of pieces) {
    const end = at + piece.text.length;
    const cut = (start: number, stop: number, ink: string | null) => {
      if (stop <= start) return;
      next.push({ text: piece.text.slice(start - at, stop - at), color: ink });
    };
    cut(at, Math.min(end, from), piece.color);
    cut(Math.max(at, from), Math.min(end, to), color);
    cut(Math.max(at, to), end, piece.color);
    at = end;
  }
  return mergePieces(next);
}

function placeRange(line: HTMLElement, from: number, to: number) {
  const selection = window.getSelection();
  if (!selection) return;
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let startNode: Node | null = null;
  let startOffset = 0;
  let endNode: Node | null = null;
  let endOffset = 0;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (!startNode && seen + length >= from) {
      startNode = node;
      startOffset = from - seen;
    }
    if (seen + length >= to) {
      endNode = node;
      endOffset = to - seen;
      break;
    }
    seen += length;
    node = walker.nextNode();
  }
  if (!startNode || !endNode) return;
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function readLines(root: HTMLElement): Line[] {
  const blocks = [...root.children].filter((node): node is HTMLElement => node instanceof HTMLElement);
  if (blocks.length === 0) {
    return [{ kind: 'body', text: '' }];
  }
  return blocks.map((block) => ({
    kind: (block.dataset.kind as LineKind | undefined) ?? 'body',
    text: serializePieces(piecesFromDom(block)),
  }));
}

export function applyWordInk(root: HTMLElement, color: string | null): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  const line = lineElement(range.startContainer, root);
  if (!line || line !== lineElement(range.endContainer, root)) return false;
  const start = offsetInLine(line, range.startContainer, range.startOffset);
  const end = offsetInLine(line, range.endContainer, range.endOffset);
  if (start === null || end === null || start === end) return false;
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  writePieces(line, paintRange(piecesFromDom(line), from, to, color ? color.toUpperCase() : null));
  placeRange(line, from, to);
  return true;
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
    writePieces(block, parsePieces(line.text));
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
