export type ShapeType = 'circle' | 'rectangle' | 'triangle' | 'line' | 'polyline' | 'text' | 'point';

export type ColorType = 'red' | 'blue' | 'green' | 'yellow' | 'black' | 'white' | 'purple' | 'orange' | 'pink' | 'gray';

export type PositionType = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'top' | 'bottom' | 'left' | 'right';

export type ActionType = 'draw' | 'connect' | 'add' | 'create' | 'place' | 'write';

export interface Point {
  x: number;
  y: number;
  label?: string;
}

export interface Shape {
  id: string;
  type: ShapeType;
  color: string;
  fill?: boolean;
  strokeWidth?: number;
  points?: Point[];
  position?: PositionType;
  text?: string;
  radius?: number;
  width?: number;
  height?: number;
  startPoint?: Point;
  endPoint?: Point;
}

export interface Command {
  id: string;
  rawText: string;
  parsedResult: ParsedCommand;
  shapes: Shape[];
  timestamp: number;
}

export interface ParsedCommand {
  action: ActionType;
  shape?: ShapeType;
  color?: string;
  position?: PositionType;
  points?: Point[];
  startLabel?: string;
  endLabel?: string;
  text?: string;
  size?: number;
}

export interface HistoryState {
  past: Command[];
  present: Command[];
  future: Command[];
}
