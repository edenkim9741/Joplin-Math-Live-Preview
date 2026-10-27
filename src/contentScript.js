import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { StateField } from '@codemirror/state';
import katex from 'katex';

// For safety, do not interpret KaTeX \href/\html extensions in untrusted notes.
const renderMath = (source, displayMode) => katex.renderToString(source, {
  displayMode, throwOnError: false, trust: false, strict: 'ignore', output: 'html',
});

class MathWidget extends WidgetType {
  constructor(source, displayMode) {
    super();
    this.source = source;
    this.displayMode = displayMode;
  }
  eq(other) {
    return other.source === this.source && other.displayMode === this.displayMode;
  }
  toDOM() {
    const element = document.createElement(this.displayMode ? 'div' : 'span');
    element.className = this.displayMode ? 'jmlp-display' : 'jmlp-inline';
    element.innerHTML = renderMath(this.source, this.displayMode);
    return element;
  }
  ignoreEvent() { return false; }
}

function isEscaped(text, i) {
  let count = 0;
  for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) count++;
  return count % 2 === 1;
}

function codeExclusionRanges(text) {
  const ranges = [];
  // Ignore fenced code blocks; supports backtick and tilde fences.
  const lines = text.match(/[^\n]*(?:\n|$)/g) || [];
  let pos = 0;
  let fence = null;
  for (const line of lines) {
    if (!line) continue;
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!fence && marker) {
      fence = { char: marker[1][0], length: marker[1].length, start: pos };
    } else if (fence && marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) {
      ranges.push([fence.start, pos + line.length]);
      fence = null;
    }
    pos += line.length;
  }
  if (fence) ranges.push([fence.start, text.length]);
  // Also ignore inline backtick spans outside code fences.
  const inFence = (i) => ranges.some(([a, b]) => a <= i && i < b);
  for (let i = 0; i < text.length;) {
    if (inFence(i)) { i++; continue; }
    if (text[i] !== '`' || isEscaped(text, i)) { i++; continue; }
    let endRun = i + 1;
    while (text[endRun] === '`') endRun++;
    const delimiter = text.slice(i, endRun);
    let closing = text.indexOf(delimiter, endRun);
    while (closing !== -1 && (inFence(closing) || text[closing + delimiter.length] === '`')) {
      closing = text.indexOf(delimiter, closing + 1);
    }
    if (closing !== -1) {
      ranges.push([i, closing + delimiter.length]);
      i = closing + delimiter.length;
    } else i = endRun;
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

function findMath(text) {
  const excluded = codeExclusionRanges(text);
  const found = [];
  const overlaps = (from, to) => excluded.some(([a, b]) => from < b && a < to);
  const startsWith = (needle, at) => text.startsWith(needle, at) && !isEscaped(text, at);
  for (let i = 0; i < text.length;) {
    if (excluded.some(([a, b]) => a <= i && i < b)) { i++; continue; }
    let open = '', close = '', displayMode = false;
    if (startsWith('$$', i)) { open = '$$'; close = '$$'; displayMode = true; }
    else if (startsWith('\\[', i)) { open = '\\['; close = '\\]'; displayMode = true; }
    else if (startsWith('\\(', i)) { open = '\\('; close = '\\)'; }
    else if (startsWith('$', i) && text[i + 1] !== '$' && text[i + 1] !== ' ' && text[i + 1] !== '\n') {
      open = '$'; close = '$';
    }
    if (!open) { i++; continue; }
    const contentStart = i + open.length;
    let end = -1;
    for (let j = contentStart; j < text.length; j++) {
      if (close === '$' && text[j] === '\n') break;
      if (startsWith(close, j) && !(close === '$' && text[j + 1] === '$')) {
        end = j; break;
      }
    }
    if (end < 0 || end === contentStart || overlaps(i, end + close.length)) { i += open.length; continue; }
    const source = text.slice(contentStart, end);
    if (!displayMode && /\s$/.test(source)) { i += open.length; continue; }
    found.push({ from: i, to: end + close.length, source: displayMode ? source.trim() : source, displayMode });
    i = end + close.length;
  }
  return found;
}

function selectionTouches(selection, from, to) {
  // Keep the source visible while a selection/caret touches the expression.
  return selection.ranges.some(r => r.from <= to && r.to >= from);
}

function mathDecorations(state) {
  const text = state.doc.toString();
  const decorations = [];
  for (const math of findMath(text)) {
    if (selectionTouches(state.selection, math.from, math.to)) continue;
    decorations.push(Decoration.replace({
      widget: new MathWidget(math.source, math.displayMode),
      block: math.displayMode,
    }).range(math.from, math.to));
  }
  return Decoration.set(decorations, true);
}

const mathLivePreview = StateField.define({
  create: state => mathDecorations(state),
  update: (decorations, transaction) => transaction.docChanged || transaction.selection
    ? mathDecorations(transaction.state)
    : decorations,
  provide: field => EditorView.decorations.from(field),
});

export default () => ({
  plugin: (wrapper) => {
    if (!wrapper.cm6) return;
    wrapper.addExtension(mathLivePreview);
  },
  assets: () => [
    { name: './math-live-preview.css' },
    { name: './katex.min.css' },
  ],
});
