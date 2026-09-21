// ネームカードボード TypeScript implementation.
// 座標はボードサイズに対する比率（0〜1）で保持する。
export {};

type Mode = 'move' | 'draw' | 'text';
type PenMode = 'pen' | 'erase';

interface Point {
  xRatio: number;
  yRatio: number;
}

interface Card {
  id: number;
  name: string;
  xRatio: number;
  yRatio: number;
  color: string;
}

interface DrawingPath {
  points: Point[];
  color: string;
  width: number;
}

interface BoardText {
  id: number;
  content: string;
  xRatio: number;
  yRatio: number;
  color: string;
  fontSize: number;
}

interface SavedCard {
  name: string;
  xRatio: number;
  yRatio: number;
  color: string;
}

interface SavedDrawing {
  points: Point[];
  color: string;
  width: number;
}

interface SavedText {
  content: string;
  xRatio: number;
  yRatio: number;
  color: string;
  fontSize: number;
}

interface SavedState {
  version: 1 | 2;
  cards: SavedCard[];
  drawings: SavedDrawing[];
  texts: SavedText[];
}

interface LegacyBoardSize {
  width: number;
  height: number;
}

interface SelectedCard {
  el: HTMLDivElement;
  card: Card;
}

interface SelectedText {
  el: HTMLDivElement;
  data: BoardText;
}

interface Position {
  x: number;
  y: number;
}

interface ModalApi {
  alert(message: string): Promise<void>;
  confirm(message: string, options?: { danger?: boolean }): Promise<boolean>;
}

interface Html2CanvasOptions {
  scale: number;
  backgroundColor: string;
  useCORS: boolean;
}

interface JsPdfInstance {
  addImage(imageData: string, format: string, x: number, y: number, width: number, height: number): void;
  save(filename: string): void;
}

interface JsPdfConstructor {
  new (options: { orientation: 'landscape'; unit: 'px'; format: [number, number] }): JsPdfInstance;
}

interface WindowWithDependencies {
  Modal?: ModalApi;
  html2canvas?: (element: HTMLElement, options: Html2CanvasOptions) => Promise<HTMLCanvasElement>;
  jspdf?: { jsPDF?: JsPdfConstructor };
}

interface DocumentWithWebkitFullscreen extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface HTMLElementWithWebkitFullscreen extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`必要な画面要素が見つかりません: #${id}`);
  return element as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRatio(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function readRequiredString(record: Record<string, unknown>, key: string, maxLength: number): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`保存データの ${key} が不正です。`);
  }
  return value.trim();
}

function readColor(record: Record<string, unknown>, key = 'color'): string {
  const value = record[key];
  if (!isHexColor(value)) throw new Error(`保存データの ${key} が不正です。`);
  return value;
}

function readRatio(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (!isRatio(value)) throw new Error(`保存データの ${key} が不正です。`);
  return value;
}

function readPositiveNumber(record: Record<string, unknown>, key: string, max: number): number {
  const value = record[key];
  if (!isFiniteNumber(value) || value <= 0 || value > max) {
    throw new Error(`保存データの ${key} が不正です。`);
  }
  return value;
}

function legacyRatio(
  record: Record<string, unknown>,
  ratioKey: string,
  pixelKey: string,
  boardSize: number,
): number {
  const ratio = record[ratioKey];
  if (ratio !== undefined && ratio !== null) {
    if (!isRatio(ratio)) throw new Error(`保存データの ${ratioKey} が不正です。`);
    return ratio;
  }
  const pixels = record[pixelKey];
  if (!isFiniteNumber(pixels) || boardSize <= 0) {
    throw new Error(`保存データの ${ratioKey} が不正です。`);
  }
  const converted = pixels / boardSize;
  if (!isRatio(converted)) throw new Error(`保存データの ${ratioKey} が不正です。`);
  return converted;
}

function parseSavedState(value: unknown): SavedState {
  if (!isRecord(value)) throw new Error('保存データの形式が不正です。');
  const rawVersion = value.version;
  const version: 1 | 2 = rawVersion === undefined ? 1 : rawVersion === 1 ? 1 : rawVersion === 2 ? 2 : (() => { throw new Error('保存データのバージョンが不正です。'); })();
  const legacySize: LegacyBoardSize = { width: 1, height: 1 };
  if (version === 1) {
    const rawSize = value.boardSize;
    if (isRecord(rawSize) && isFiniteNumber(rawSize.width) && rawSize.width > 0 && isFiniteNumber(rawSize.height) && rawSize.height > 0) {
      legacySize.width = rawSize.width;
      legacySize.height = rawSize.height;
    } else if (rawSize !== undefined) {
      throw new Error('保存データのボードサイズが不正です。');
    }
  }

  const cards: SavedCard[] = [];
  if (value.cards !== undefined) {
    if (!Array.isArray(value.cards)) throw new Error('保存データのカード一覧が不正です。');
    value.cards.forEach((rawCard) => {
      if (!isRecord(rawCard)) throw new Error('保存データのカードが不正です。');
      cards.push({
        name: readRequiredString(rawCard, 'name', 200),
        xRatio: version === 1 ? legacyRatio(rawCard, 'xRatio', 'x', legacySize.width) : readRatio(rawCard, 'xRatio'),
        yRatio: version === 1 ? legacyRatio(rawCard, 'yRatio', 'y', legacySize.height) : readRatio(rawCard, 'yRatio'),
        color: readColor(rawCard),
      });
    });
  }

  const drawings: SavedDrawing[] = [];
  if (value.drawings !== undefined) {
    if (!Array.isArray(value.drawings)) throw new Error('保存データの描画一覧が不正です。');
    value.drawings.forEach((rawDrawing) => {
      if (!isRecord(rawDrawing) || !Array.isArray(rawDrawing.points)) throw new Error('保存データの描画が不正です。');
      const points: Point[] = rawDrawing.points.map((rawPoint) => {
        if (!isRecord(rawPoint)) throw new Error('保存データの描画点が不正です。');
        return {
          xRatio: version === 1 ? legacyRatio(rawPoint, 'xRatio', 'x', legacySize.width) : readRatio(rawPoint, 'xRatio'),
          yRatio: version === 1 ? legacyRatio(rawPoint, 'yRatio', 'y', legacySize.height) : readRatio(rawPoint, 'yRatio'),
        };
      });
      drawings.push({ points, color: readColor(rawDrawing), width: readPositiveNumber(rawDrawing, 'width', 100) });
    });
  }

  const texts: SavedText[] = [];
  if (value.texts !== undefined) {
    if (!Array.isArray(value.texts)) throw new Error('保存データのテキスト一覧が不正です。');
    value.texts.forEach((rawText) => {
      if (!isRecord(rawText)) throw new Error('保存データのテキストが不正です。');
      texts.push({
        content: readRequiredString(rawText, 'content', 2000),
        xRatio: version === 1 ? legacyRatio(rawText, 'xRatio', 'x', legacySize.width) : readRatio(rawText, 'xRatio'),
        yRatio: version === 1 ? legacyRatio(rawText, 'yRatio', 'y', legacySize.height) : readRatio(rawText, 'yRatio'),
        color: readColor(rawText),
        fontSize: readPositiveNumber(rawText, 'fontSize', 200),
      });
    });
  }
  return { version, cards, drawings, texts };
}

const appWindow = window as WindowWithDependencies;
const modal: ModalApi = appWindow.Modal ?? {
  alert: async (message: string): Promise<void> => { window.alert(message); },
  confirm: async (message: string): Promise<boolean> => window.confirm(message),
};

const whiteboard = byId<HTMLDivElement>('whiteboard');
const drawCanvas = byId<HTMLCanvasElement>('drawCanvas');
const context: CanvasRenderingContext2D = (() => {
  const value = drawCanvas.getContext('2d');
  if (!value) throw new Error('描画コンテキストを取得できません。');
  return value;
})();
const modeButtons = document.querySelectorAll<HTMLButtonElement>('.mode-btn');
const nameInputBtn = byId<HTMLButtonElement>('nameInputBtn');
const saveStateBtn = byId<HTMLButtonElement>('saveStateBtn');
const loadStateBtn = byId<HTMLButtonElement>('loadStateBtn');
const loadFileInput = byId<HTMLInputElement>('loadFileInput');
const exportImgBtn = byId<HTMLButtonElement>('exportImgBtn');
const exportPdfBtn = byId<HTMLButtonElement>('exportPdfBtn');
const fullscreenBtn = byId<HTMLButtonElement>('fullscreenBtn');
const drawTools = byId<HTMLElement>('drawTools');
const cardTools = byId<HTMLElement>('cardTools');
const textTools = byId<HTMLElement>('textTools');
const penColorInput = byId<HTMLInputElement>('penColor');
const penWidthInput = byId<HTMLInputElement>('penWidth');
const penModeBtn = byId<HTMLButtonElement>('penModeBtn');
const eraserModeBtn = byId<HTMLButtonElement>('eraserModeBtn');
const penControls = byId<HTMLElement>('penControls');
const eraserControls = byId<HTMLElement>('eraserControls');
const eraserWidthInput = byId<HTMLInputElement>('eraserWidth');
const eraserCursorEl = byId<HTMLDivElement>('eraserCursor');
const undoBtn = byId<HTMLButtonElement>('undoBtn');
const clearDrawBtn = byId<HTMLButtonElement>('clearDrawBtn');
const cardColorPalette = byId<HTMLElement>('cardColorPalette');
const deleteCardBtn = byId<HTMLButtonElement>('deleteCardBtn');
const textColorInput = byId<HTMLInputElement>('textColor');
const textSizeSelect = byId<HTMLSelectElement>('textSize');
const selectedTextTools = byId<HTMLElement>('selectedTextTools');
const editTextBtn = byId<HTMLButtonElement>('editTextBtn');
const deleteTextBtn = byId<HTMLButtonElement>('deleteTextBtn');
const nameModal = byId<HTMLDivElement>('nameModal');
const nameInput = byId<HTMLTextAreaElement>('nameInput');
const closeModalBtn = byId<HTMLButtonElement>('closeModalBtn');
const generateCardsBtn = byId<HTMLButtonElement>('generateCardsBtn');
const clearAllBtn = byId<HTMLButtonElement>('clearAllBtn');
const modalColorSwatches = document.querySelectorAll<HTMLButtonElement>('.modal-color');

let mode: Mode = 'move';
let cards: Card[] = [];
let drawings: DrawingPath[] = [];
let texts: BoardText[] = [];
let nextCardId = 0;
let nextTextId = 0;
let dragTarget: HTMLDivElement | null = null;
let dragOffset: Position = { x: 0, y: 0 };
let isDragging = false;
let isDrawing = false;
let currentPath: DrawingPath | null = null;
let penColor = '#333333';
let penWidth = 3;
let penMode: PenMode = 'pen';
let eraserWidth = 20;
let textColor = '#333333';
let textFontSize = 18;
let selectedCard: SelectedCard | null = null;
let selectedText: SelectedText | null = null;
let modalCardColor = '#ffeb3b';

function boardRect(): DOMRect { return whiteboard.getBoundingClientRect(); }

function setMode(newMode: Mode): void {
  mode = newMode;
  const textInput = whiteboard.querySelector<HTMLInputElement>('.board-text-input');
  textInput?.blur();
  modeButtons.forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
  whiteboard.className = `whiteboard mode-${mode}`;
  drawTools.style.display = mode === 'draw' ? 'flex' : 'none';
  textTools.style.display = mode === 'text' ? 'flex' : 'none';
  if (mode !== 'draw') {
    eraserCursorEl.style.display = 'none';
    setPenMode('pen');
  }
  if (mode !== 'move') {
    cardTools.style.display = 'none';
    deselectAll();
  }
}

function resizeCanvas(): void {
  const dpr = Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  const rect = boardRect();
  drawCanvas.width = Math.round(rect.width * dpr);
  drawCanvas.height = Math.round(rect.height * dpr);
  drawCanvas.style.width = `${rect.width}px`;
  drawCanvas.style.height = `${rect.height}px`;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.scale(dpr, dpr);
  redrawCanvas();
  repositionAllCards();
  repositionAllTexts();
}

function redrawCanvas(): void {
  const rect = boardRect();
  context.clearRect(0, 0, rect.width, rect.height);
  drawings.forEach((path) => {
    if (path.points.length < 2) return;
    context.beginPath();
    context.strokeStyle = path.color;
    context.lineWidth = path.width;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    path.points.forEach((point, index) => {
      const x = point.xRatio * rect.width;
      const y = point.yRatio * rect.height;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.stroke();
  });
}

function repositionAllCards(): void {
  const rect = boardRect();
  cards.forEach((card) => {
    const element = whiteboard.querySelector<HTMLDivElement>(`.name-card[data-id="${card.id}"]`);
    if (element) {
      element.style.left = `${card.xRatio * rect.width}px`;
      element.style.top = `${card.yRatio * rect.height}px`;
    }
  });
}

function repositionAllTexts(): void {
  const rect = boardRect();
  texts.forEach((text) => {
    const element = whiteboard.querySelector<HTMLDivElement>(`.board-text[data-text-id="${text.id}"]`);
    if (element) {
      element.style.left = `${text.xRatio * rect.width}px`;
      element.style.top = `${text.yRatio * rect.height}px`;
    }
  });
}

function createCard(name: string, xRatio: number, yRatio: number, color: string): Card {
  const card: Card = { id: nextCardId++, name, xRatio: Math.max(0, Math.min(1, xRatio)), yRatio: Math.max(0, Math.min(1, yRatio)), color };
  cards.push(card);
  const rect = boardRect();
  const element = document.createElement('div');
  element.className = 'name-card';
  element.dataset.id = String(card.id);
  element.textContent = card.name;
  element.style.left = `${card.xRatio * rect.width}px`;
  element.style.top = `${card.yRatio * rect.height}px`;
  element.style.backgroundColor = card.color;
  element.style.color = isLightColor(card.color) ? '#333' : '#fff';
  setupCardDrag(element, card);
  element.addEventListener('click', (event) => {
    if (mode === 'move' && !isDragging) {
      event.stopPropagation();
      selectCard(element, card);
    }
  });
  whiteboard.appendChild(element);
  return card;
}

function selectCard(element: HTMLDivElement, card: Card): void {
  deselectAll();
  selectedCard = { el: element, card };
  element.classList.add('selected');
  cardTools.style.display = 'flex';
}

function selectText(element: HTMLDivElement, data: BoardText): void {
  deselectAll();
  selectedText = { el: element, data };
  element.classList.add('selected');
  selectedTextTools.style.display = 'flex';
}

function deselectAll(): void {
  selectedCard?.el.classList.remove('selected');
  selectedText?.el.classList.remove('selected');
  selectedCard = null;
  selectedText = null;
  cardTools.style.display = 'none';
  selectedTextTools.style.display = 'none';
}

function deleteSelectedCard(): void {
  if (!selectedCard) return;
  cards = cards.filter((card) => card.id !== selectedCard?.card.id);
  selectedCard.el.remove();
  selectedCard = null;
  cardTools.style.display = 'none';
}

function deleteSelectedText(): void {
  if (!selectedText) return;
  texts = texts.filter((text) => text.id !== selectedText?.data.id);
  selectedText.el.remove();
  selectedText = null;
  selectedTextTools.style.display = 'none';
}

function editSelectedText(): void {
  if (!selectedText) return;
  const data = selectedText.data;
  const rect = boardRect();
  selectedText.el.remove();
  texts = texts.filter((text) => text.id !== data.id);
  selectedText = null;
  selectedTextTools.style.display = 'none';
  setMode('text');
  createTextInput(data.xRatio * rect.width, data.yRatio * rect.height);
}

function getEventPosition(event: MouseEvent | TouchEvent): Position {
  if (event instanceof TouchEvent) {
    const touch = event.touches.item(0);
    if (touch) return { x: touch.clientX, y: touch.clientY };
  }
  if (event instanceof MouseEvent) return { x: event.clientX, y: event.clientY };
  return { x: 0, y: 0 };
}

function setupCardDrag(element: HTMLDivElement, card: Card): void {
  function onStart(event: MouseEvent | TouchEvent): void {
    if (mode !== 'move') return;
    event.preventDefault();
    const position = getEventPosition(event);
    const rect = boardRect();
    dragTarget = element;
    isDragging = false;
    dragOffset = { x: position.x - element.offsetLeft - rect.left, y: position.y - element.offsetTop - rect.top };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }
  function onMove(event: MouseEvent | TouchEvent): void {
    if (!dragTarget) return;
    event.preventDefault();
    isDragging = true;
    const position = getEventPosition(event);
    const rect = boardRect();
    const x = Math.max(0, Math.min(position.x - rect.left - dragOffset.x, rect.width - dragTarget.offsetWidth));
    const y = Math.max(0, Math.min(position.y - rect.top - dragOffset.y, rect.height - dragTarget.offsetHeight));
    dragTarget.style.left = `${x}px`;
    dragTarget.style.top = `${y}px`;
  }
  function onEnd(): void {
    if (dragTarget) {
      const rect = boardRect();
      card.xRatio = rect.width > 0 ? dragTarget.offsetLeft / rect.width : 0;
      card.yRatio = rect.height > 0 ? dragTarget.offsetTop / rect.height : 0;
    }
    dragTarget = null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    window.setTimeout(() => { isDragging = false; }, 10);
  }
  element.addEventListener('mousedown', onStart);
  element.addEventListener('touchstart', onStart, { passive: false });
}

function setupTextDrag(element: HTMLDivElement, data: BoardText): void {
  function onStart(event: MouseEvent | TouchEvent): void {
    if (mode !== 'move') return;
    event.preventDefault();
    event.stopPropagation();
    const position = getEventPosition(event);
    const rect = boardRect();
    dragTarget = element;
    isDragging = false;
    dragOffset = { x: position.x - element.offsetLeft - rect.left, y: position.y - element.offsetTop - rect.top };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }
  function onMove(event: MouseEvent | TouchEvent): void {
    if (!dragTarget) return;
    event.preventDefault();
    isDragging = true;
    const position = getEventPosition(event);
    const rect = boardRect();
    const x = Math.max(0, Math.min(position.x - rect.left - dragOffset.x, rect.width - dragTarget.offsetWidth));
    const y = Math.max(0, Math.min(position.y - rect.top - dragOffset.y, rect.height - dragTarget.offsetHeight));
    dragTarget.style.left = `${x}px`;
    dragTarget.style.top = `${y}px`;
  }
  function onEnd(): void {
    if (dragTarget) {
      const rect = boardRect();
      data.xRatio = rect.width > 0 ? dragTarget.offsetLeft / rect.width : 0;
      data.yRatio = rect.height > 0 ? dragTarget.offsetTop / rect.height : 0;
    }
    dragTarget = null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    window.setTimeout(() => { isDragging = false; }, 10);
  }
  element.addEventListener('mousedown', onStart);
  element.addEventListener('touchstart', onStart, { passive: false });
}

function getWhiteboardPosition(event: MouseEvent | TouchEvent): Position {
  const rect = boardRect();
  const position = getEventPosition(event);
  return { x: position.x - rect.left, y: position.y - rect.top };
}

function setupDrawing(): void {
  drawCanvas.addEventListener('mousedown', startDraw);
  drawCanvas.addEventListener('mousemove', continueDraw);
  drawCanvas.addEventListener('mouseup', endDraw);
  drawCanvas.addEventListener('mouseleave', onDrawLeave);
  drawCanvas.addEventListener('touchstart', startDraw, { passive: false });
  drawCanvas.addEventListener('touchmove', continueDraw, { passive: false });
  drawCanvas.addEventListener('touchend', endDraw);
  whiteboard.addEventListener('mousemove', updateEraserCursor);
  whiteboard.addEventListener('mouseleave', () => { eraserCursorEl.style.display = 'none'; });
}

function updateEraserCursor(event: MouseEvent): void {
  if (mode !== 'draw' || penMode !== 'erase') { eraserCursorEl.style.display = 'none'; return; }
  const rect = boardRect();
  eraserCursorEl.style.display = 'block';
  eraserCursorEl.style.width = `${eraserWidth}px`;
  eraserCursorEl.style.height = `${eraserWidth}px`;
  eraserCursorEl.style.left = `${event.clientX - rect.left}px`;
  eraserCursorEl.style.top = `${event.clientY - rect.top}px`;
}

function startDraw(event: MouseEvent | TouchEvent): void {
  if (mode !== 'draw') return;
  event.preventDefault();
  isDrawing = true;
  const position = getWhiteboardPosition(event);
  if (penMode === 'erase') { eraseAtPoint(position); return; }
  const rect = boardRect();
  currentPath = { points: [{ xRatio: rect.width > 0 ? position.x / rect.width : 0, yRatio: rect.height > 0 ? position.y / rect.height : 0 }], color: penColor, width: penWidth };
  context.beginPath();
  context.strokeStyle = penColor;
  context.lineWidth = penWidth;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.moveTo(position.x, position.y);
}

function continueDraw(event: MouseEvent | TouchEvent): void {
  if (!isDrawing || mode !== 'draw') return;
  event.preventDefault();
  const position = getWhiteboardPosition(event);
  if (penMode === 'erase') { eraseAtPoint(position); return; }
  const rect = boardRect();
  currentPath?.points.push({ xRatio: rect.width > 0 ? position.x / rect.width : 0, yRatio: rect.height > 0 ? position.y / rect.height : 0 });
  context.lineTo(position.x, position.y);
  context.stroke();
  context.beginPath();
  context.moveTo(position.x, position.y);
}

function endDraw(): void {
  if (!isDrawing) return;
  isDrawing = false;
  if (penMode === 'pen' && currentPath && currentPath.points.length > 1) drawings.push(currentPath);
  currentPath = null;
}

function onDrawLeave(): void { endDraw(); eraserCursorEl.style.display = 'none'; }

function eraseAtPoint(position: Position): void {
  const rect = boardRect();
  const radius = eraserWidth / 2;
  const before = drawings.length;
  drawings = drawings.filter((path) => !path.points.some((point) => Math.hypot(point.xRatio * rect.width - position.x, point.yRatio * rect.height - position.y) < radius));
  if (drawings.length !== before) redrawCanvas();
}

function setPenMode(newPenMode: PenMode): void {
  penMode = newPenMode;
  penModeBtn.classList.toggle('active', penMode === 'pen');
  eraserModeBtn.classList.toggle('active', penMode === 'erase');
  penControls.style.display = penMode === 'pen' ? 'flex' : 'none';
  eraserControls.style.display = penMode === 'erase' ? 'flex' : 'none';
  if (penMode !== 'erase') eraserCursorEl.style.display = 'none';
}

function setupTextMode(): void {
  whiteboard.addEventListener('click', (event: MouseEvent) => {
    if (mode !== 'text' || (event.target !== whiteboard && event.target !== drawCanvas)) return;
    const rect = boardRect();
    createTextInput(event.clientX - rect.left, event.clientY - rect.top);
  });
}

function createTextInput(x: number, y: number): void {
  whiteboard.querySelector<HTMLInputElement>('.board-text-input')?.blur();
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'board-text-input';
  input.style.left = `${x}px`;
  input.style.top = `${y}px`;
  input.style.fontSize = `${textFontSize}px`;
  input.style.color = textColor;
  whiteboard.appendChild(input);
  input.focus();
  let committed = false;
  const commitText = (): void => {
    if (committed) return;
    committed = true;
    const content = input.value.trim();
    if (content) {
      const rect = boardRect();
      addTextElement(content, rect.width > 0 ? x / rect.width : 0, rect.height > 0 ? y / rect.height : 0, textColor, textFontSize);
    }
    input.remove();
  };
  input.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') commitText();
    if (event.key === 'Escape') { committed = true; input.remove(); }
  });
  input.addEventListener('blur', commitText);
}

function addTextElement(content: string, xRatio: number, yRatio: number, color: string, fontSize: number): void {
  const data: BoardText = { id: nextTextId++, content, xRatio: Math.max(0, Math.min(1, xRatio)), yRatio: Math.max(0, Math.min(1, yRatio)), color, fontSize };
  texts.push(data);
  const rect = boardRect();
  const element = document.createElement('div');
  element.className = 'board-text';
  element.dataset.textId = String(data.id);
  element.textContent = data.content;
  element.style.left = `${data.xRatio * rect.width}px`;
  element.style.top = `${data.yRatio * rect.height}px`;
  element.style.color = data.color;
  element.style.fontSize = `${data.fontSize}px`;
  setupTextDrag(element, data);
  element.addEventListener('click', (event) => {
    if (mode === 'move' && !isDragging) { event.stopPropagation(); selectText(element, data); }
  });
  whiteboard.appendChild(element);
}

function readInputNumber(input: HTMLInputElement, fallback: number, min: number, max: number): number {
  return readNumberText(input.value, fallback, min, max);
}

function readNumberText(text: string, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(text, 10);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function setupToolbar(): void {
  const penColorButtons = document.querySelectorAll<HTMLButtonElement>('.pen-color-btn');
  penColorButtons.forEach((button) => button.addEventListener('click', () => {
    const color = button.dataset.penColor;
    if (!isHexColor(color)) return;
    penColor = color;
    penColorInput.value = color;
    penColorButtons.forEach((other) => other.classList.remove('active'));
    button.classList.add('active');
  }));
  penColorInput.addEventListener('input', () => {
    if (isHexColor(penColorInput.value)) penColor = penColorInput.value;
    penColorButtons.forEach((button) => button.classList.remove('active'));
  });
  penWidthInput.addEventListener('input', () => { penWidth = readInputNumber(penWidthInput, penWidth, 1, 100); });
  penModeBtn.addEventListener('click', () => setPenMode('pen'));
  eraserModeBtn.addEventListener('click', () => setPenMode('erase'));
  eraserWidthInput.addEventListener('input', () => { eraserWidth = readInputNumber(eraserWidthInput, eraserWidth, 1, 200); });
  undoBtn.addEventListener('click', () => { if (drawings.length > 0) { drawings.pop(); redrawCanvas(); } });
  clearDrawBtn.addEventListener('click', () => {
    if (drawings.length === 0) return;
    void modal.confirm('全ての描画を消去します。', { danger: true }).then((confirmed) => { if (confirmed) { drawings = []; redrawCanvas(); } });
  });
  cardColorPalette.querySelectorAll<HTMLButtonElement>('.color-swatch').forEach((swatch) => swatch.addEventListener('click', () => {
    if (!selectedCard) return;
    const color = swatch.dataset.color;
    if (!isHexColor(color)) return;
    selectedCard.card.color = color;
    selectedCard.el.style.backgroundColor = color;
    selectedCard.el.style.color = isLightColor(color) ? '#333' : '#fff';
  }));
  deleteCardBtn.addEventListener('click', deleteSelectedCard);
  editTextBtn.addEventListener('click', editSelectedText);
  deleteTextBtn.addEventListener('click', deleteSelectedText);
  textColorInput.addEventListener('input', () => { if (isHexColor(textColorInput.value)) textColor = textColorInput.value; });
  textSizeSelect.addEventListener('change', () => { textFontSize = readNumberText(textSizeSelect.value, textFontSize, 1, 200); });
  saveStateBtn.addEventListener('click', saveState);
  loadStateBtn.addEventListener('click', () => loadFileInput.click());
  loadFileInput.addEventListener('change', loadState);
  exportImgBtn.addEventListener('click', () => { void exportAsImage(); });
  exportPdfBtn.addEventListener('click', () => { void exportAsPdf(); });
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  whiteboard.addEventListener('click', (event) => { if (mode === 'move' && (event.target === whiteboard || event.target === drawCanvas)) deselectAll(); });
}

function setupModeButtons(): void {
  modeButtons.forEach((button) => button.addEventListener('click', () => {
    const requestedMode = button.dataset.mode;
    if (requestedMode === 'move' || requestedMode === 'draw' || requestedMode === 'text') setMode(requestedMode);
  }));
}

function setupModal(): void {
  nameInputBtn.addEventListener('click', () => { nameModal.style.display = 'flex'; });
  closeModalBtn.addEventListener('click', () => { nameModal.style.display = 'none'; });
  nameModal.addEventListener('click', (event) => { if (event.target === nameModal) nameModal.style.display = 'none'; });
  modalColorSwatches.forEach((swatch) => swatch.addEventListener('click', () => {
    const color = swatch.dataset.color;
    if (!isHexColor(color)) return;
    modalColorSwatches.forEach((other) => other.classList.remove('active'));
    swatch.classList.add('active');
    modalCardColor = color;
  }));
  generateCardsBtn.addEventListener('click', generateCards);
  clearAllBtn.addEventListener('click', () => { void clearAll(); });
}

function generateCards(): void {
  const names = nameInput.value.split('\n').map((name) => name.trim()).filter((name) => name.length > 0 && name.length <= 200);
  if (names.length === 0) return;
  const rect = boardRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const cardWidth = 120;
  const cardHeight = 36;
  const padding = 15;
  const cols = Math.max(1, Math.floor((rect.width - padding * 2) / (cardWidth + padding)));
  let startYRatio = padding / rect.height;
  if (cards.length > 0) startYRatio = Math.max(...cards.map((card) => card.yRatio)) + (cardHeight + padding * 2) / rect.height;
  names.forEach((name, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const xRatio = Math.min(1, (padding + col * (cardWidth + padding)) / rect.width);
    const yRatio = Math.min(1, startYRatio + row * (cardHeight + padding) / rect.height);
    createCard(name, xRatio, yRatio, modalCardColor);
  });
  nameInput.value = '';
  nameModal.style.display = 'none';
}

async function clearAll(): Promise<void> {
  if (cards.length === 0 && drawings.length === 0 && texts.length === 0) return;
  if (!(await modal.confirm('全てのカード・描画・テキストを削除しますか？', { danger: true }))) return;
  whiteboard.querySelectorAll('.name-card, .board-text').forEach((element) => element.remove());
  cards = [];
  drawings = [];
  texts = [];
  nextCardId = 0;
  nextTextId = 0;
  selectedCard = null;
  selectedText = null;
  cardTools.style.display = 'none';
  selectedTextTools.style.display = 'none';
  redrawCanvas();
  nameModal.style.display = 'none';
}

function currentSavedState(): SavedState {
  return {
    version: 2,
    cards: cards.map(({ name, xRatio, yRatio, color }) => ({ name, xRatio, yRatio, color })),
    drawings: drawings.map(({ points, color, width }) => ({ points: points.map(({ xRatio, yRatio }) => ({ xRatio, yRatio })), color, width })),
    texts: texts.map(({ content, xRatio, yRatio, color, fontSize }) => ({ content, xRatio, yRatio, color, fontSize })),
  };
}

function saveState(): void {
  if (cards.length === 0 && drawings.length === 0 && texts.length === 0) { void modal.alert('保存するデータがありません。'); return; }
  const blob = new Blob([JSON.stringify(currentSavedState(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  anchor.href = url;
  anchor.download = `ネームカードボード_${date}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function loadState(event: Event): void {
  if (!(event.currentTarget instanceof HTMLInputElement)) return;
  const file = event.currentTarget.files?.item(0);
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      if (typeof reader.result !== 'string') throw new Error('ファイル内容が文字列ではありません。');
      applyState(parseSavedState(JSON.parse(reader.result) as unknown));
    } catch (error) {
      void modal.alert('ファイルの読み込みに失敗しました。');
      console.error(error);
    }
  });
  reader.readAsText(file);
  event.currentTarget.value = '';
}

function clearBoardElements(): void {
  whiteboard.querySelectorAll('.name-card, .board-text').forEach((element) => element.remove());
  cards = [];
  drawings = [];
  texts = [];
  nextCardId = 0;
  nextTextId = 0;
  selectedCard = null;
  selectedText = null;
  cardTools.style.display = 'none';
  selectedTextTools.style.display = 'none';
}

function applyState(state: SavedState): void {
  clearBoardElements();
  state.cards.forEach((card) => createCard(card.name, card.xRatio, card.yRatio, card.color));
  drawings = state.drawings.map((drawing) => ({ points: drawing.points.map((point) => ({ ...point })), color: drawing.color, width: drawing.width }));
  redrawCanvas();
  state.texts.forEach((text) => addTextElement(text.content, text.xRatio, text.yRatio, text.color, text.fontSize));
}

async function exportAsImage(): Promise<void> {
  deselectAll();
  try {
    const html2canvas = appWindow.html2canvas;
    if (!html2canvas) throw new Error('画像出力ライブラリが読み込まれていません。');
    const canvas = await html2canvas(whiteboard, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const anchor = document.createElement('a');
    anchor.href = canvas.toDataURL('image/jpeg', 0.95);
    anchor.download = 'ネームカードボード.jpg';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } catch (error) {
    console.error(error);
    void modal.alert('画像の保存に失敗しました。');
  }
}

async function exportAsPdf(): Promise<void> {
  deselectAll();
  try {
    const html2canvas = appWindow.html2canvas;
    const JsPdf = appWindow.jspdf?.jsPDF;
    if (!html2canvas || !JsPdf) throw new Error('PDF出力ライブラリが読み込まれていません。');
    const canvas = await html2canvas(whiteboard, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const width = canvas.width / 2;
    const height = canvas.height / 2;
    const pdf = new JsPdf({ orientation: 'landscape', unit: 'px', format: [width, height] });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, width, height);
    pdf.save('ネームカードボード.pdf');
  } catch (error) {
    console.error(error);
    void modal.alert('PDFの保存に失敗しました。');
  }
}

function toggleFullscreen(): void {
  const main = document.querySelector<HTMLElement>('main');
  if (!main) return;
  const fullscreenDocument = document as DocumentWithWebkitFullscreen;
  const fullscreenMain = main as HTMLElementWithWebkitFullscreen;
  if (!document.fullscreenElement && !fullscreenDocument.webkitFullscreenElement) {
    if (main.requestFullscreen) void main.requestFullscreen();
    else if (fullscreenMain.webkitRequestFullscreen) void fullscreenMain.webkitRequestFullscreen();
  } else if (document.exitFullscreen) void document.exitFullscreen();
  else if (fullscreenDocument.webkitExitFullscreen) void fullscreenDocument.webkitExitFullscreen();
}

function onFullscreenChange(): void {
  const fullscreenDocument = document as DocumentWithWebkitFullscreen;
  const isFullscreen = Boolean(document.fullscreenElement || fullscreenDocument.webkitFullscreenElement);
  const icon = fullscreenBtn.querySelector<HTMLElement>('i');
  const label = fullscreenBtn.querySelector<HTMLElement>('.btn-label');
  if (icon) icon.className = isFullscreen ? 'fas fa-compress' : 'fas fa-expand';
  if (label) label.textContent = isFullscreen ? '解除' : '全画面';
  window.setTimeout(resizeCanvas, 100);
}

function isLightColor(hex: string): boolean {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255 > 0.6;
}

function init(): void {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  setupModeButtons();
  setupDrawing();
  setupTextMode();
  setupToolbar();
  setupModal();
  setMode('move');
  console.log('ネームカードボード初期化完了');
}

init();
