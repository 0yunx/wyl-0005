import type { ParsedCommand, ActionType, ShapeType, ColorType, PositionType, Point } from './types';

const COLOR_MAP: Record<ColorType, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  black: '#000000',
  white: '#ffffff',
  purple: '#a855f7',
  orange: '#f97316',
  pink: '#ec4899',
  gray: '#6b7280',
};

const COLOR_KEYWORDS: Record<string, ColorType> = {
  '红色': 'red', '红': 'red', 'red': 'red',
  '蓝色': 'blue', '蓝': 'blue', 'blue': 'blue',
  '绿色': 'green', '绿': 'green', 'green': 'green',
  '黄色': 'yellow', '黄': 'yellow', 'yellow': 'yellow',
  '黑色': 'black', '黑': 'black', 'black': 'black',
  '白色': 'white', '白': 'white', 'white': 'white',
  '紫色': 'purple', '紫': 'purple', 'purple': 'purple',
  '橙色': 'orange', '橙': 'orange', 'orange': 'orange',
  '粉色': 'pink', '粉': 'pink', 'pink': 'pink',
  '灰色': 'gray', '灰': 'gray', 'gray': 'grey',
};

const SHAPE_KEYWORDS: Record<string, ShapeType> = {
  '圆形': 'circle', '圆': 'circle', 'circle': 'circle',
  '矩形': 'rectangle', '长方形': 'rectangle', '方形': 'rectangle', 'rectangle': 'rectangle', 'square': 'rectangle',
  '三角形': 'triangle', 'triangle': 'triangle',
  '直线': 'line', '线': 'line', 'line': 'line',
  '折线': 'polyline', 'polyline': 'polyline',
  '文字': 'text', '文本': 'text', 'text': 'text',
  '点': 'point', 'point': 'point',
};

const POSITION_KEYWORDS: Record<string, PositionType> = {
  '左上角': 'top-left', '左上': 'top-left', 'top-left': 'top-left', 'top left': 'top-left',
  '右上角': 'top-right', '右上': 'top-right', 'top-right': 'top-right', 'top right': 'top-right',
  '左下角': 'bottom-left', '左下': 'bottom-left', 'bottom-left': 'bottom-left', 'bottom left': 'bottom-left',
  '右下角': 'bottom-right', '右下': 'bottom-right', 'bottom-right': 'bottom-right', 'bottom right': 'bottom-right',
  '中间': 'center', '中央': 'center', 'center': 'center', 'middle': 'center',
  '顶部': 'top', '上方': 'top', 'top': 'top',
  '底部': 'bottom', '下方': 'bottom', 'bottom': 'bottom',
  '左边': 'left', '左侧': 'left', 'left': 'left',
  '右边': 'right', '右侧': 'right', 'right': 'right',
};

const ACTION_KEYWORDS: Record<string, ActionType> = {
  '画': 'draw', '绘制': 'draw', 'draw': 'draw', 'paint': 'draw',
  '连接': 'connect', 'link': 'connect', 'connect': 'connect',
  '添加': 'add', 'add': 'add',
  '创建': 'create', 'create': 'create', 'make': 'create',
  '放置': 'place', 'place': 'place', 'put': 'place',
  '写': 'write', '写入': 'write', 'write': 'write',
};

const SIZE_PATTERNS = [
  /(\d+)\s*(px|像素)?/i,
  /(大|小|中)(号|型)?/,
];

const POINT_PATTERN = /([A-Z])\s*点?/g;

export function parseCommand(rawText: string): ParsedCommand {
  const text = rawText.toLowerCase().trim();
  let result: ParsedCommand = {
    action: 'draw',
  };

  for (const [keyword, action] of Object.entries(ACTION_KEYWORDS)) {
    if (text.includes(keyword.toLowerCase())) {
      result.action = action;
      break;
    }
  }

  for (const [keyword, shape] of Object.entries(SHAPE_KEYWORDS)) {
    if (text.includes(keyword.toLowerCase())) {
      result.shape = shape;
      break;
    }
  }

  for (const [keyword, colorType] of Object.entries(COLOR_KEYWORDS)) {
    if (text.includes(keyword.toLowerCase())) {
      result.color = COLOR_MAP[colorType];
      break;
    }
  }

  for (const [keyword, position] of Object.entries(POSITION_KEYWORDS)) {
    if (text.includes(keyword.toLowerCase())) {
      result.position = position;
      break;
    }
  }

  const pointMatches = [...rawText.matchAll(POINT_PATTERN)];
  if (pointMatches.length > 0) {
    result.points = pointMatches.map(m => ({
      x: 0,
      y: 0,
      label: m[1].toUpperCase(),
    }));
  }

  const connectMatch = rawText.match(/连接\s*([A-Z])\s*(?:点)?\s*(?:和|与|及|to|and)\s*([A-Z])\s*(?:点)?/i);
  if (connectMatch) {
    result.startLabel = connectMatch[1].toUpperCase();
    result.endLabel = connectMatch[2].toUpperCase();
    result.action = 'connect';
    if (!result.shape) {
      result.shape = 'line';
    }
  }

  const polylineMatch = rawText.match(/(?:折线|polyline)\s*(?:连接)?\s*([A-Z])(?:\s*[、,，]\s*([A-Z]))+/i);
  if (polylineMatch) {
    result.shape = 'polyline';
    result.action = 'connect';
    const labels = [...rawText.matchAll(/([A-Z])\s*点?/g)].map(m => m[1].toUpperCase());
    result.points = labels.map(label => ({ x: 0, y: 0, label }));
  }

  const textMatch = rawText.match(/(?:写|文字|文本|text)\s*["'“]([^"'”]+)["'”]/);
  if (textMatch) {
    result.text = textMatch[1];
    result.action = 'write';
    result.shape = 'text';
  }

  const sizeMatch = rawText.match(SIZE_PATTERNS[0]);
  if (sizeMatch) {
    result.size = parseInt(sizeMatch[1]);
  } else if (text.includes('大')) {
    result.size = 80;
  } else if (text.includes('小')) {
    result.size = 30;
  } else if (text.includes('中')) {
    result.size = 50;
  }

  if (!result.color) {
    result.color = COLOR_MAP.blue;
  }
  if (!result.shape && result.action !== 'connect') {
    result.shape = 'circle';
  }
  if (!result.position) {
    result.position = 'center';
  }
  if (!result.size) {
    result.size = 50;
  }

  return result;
}

export function getColorHex(colorName: ColorType): string {
  return COLOR_MAP[colorName] || COLOR_MAP.blue;
}

export function resolvePosition(position: PositionType, canvasWidth: number, canvasHeight: number, size: number = 50): Point {
  const padding = 60;
  const halfSize = size / 2;

  switch (position) {
    case 'top-left':
      return { x: padding + halfSize, y: padding + halfSize };
    case 'top-right':
      return { x: canvasWidth - padding - halfSize, y: padding + halfSize };
    case 'bottom-left':
      return { x: padding + halfSize, y: canvasHeight - padding - halfSize };
    case 'bottom-right':
      return { x: canvasWidth - padding - halfSize, y: canvasHeight - padding - halfSize };
    case 'center':
      return { x: canvasWidth / 2, y: canvasHeight / 2 };
    case 'top':
      return { x: canvasWidth / 2, y: padding + halfSize };
    case 'bottom':
      return { x: canvasWidth / 2, y: canvasHeight - padding - halfSize };
    case 'left':
      return { x: padding + halfSize, y: canvasHeight / 2 };
    case 'right':
      return { x: canvasWidth - padding - halfSize, y: canvasHeight / 2 };
    default:
      return { x: canvasWidth / 2, y: canvasHeight / 2 };
  }
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}
