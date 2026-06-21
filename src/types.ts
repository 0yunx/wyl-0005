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

export type ConnectionStatus = 'connected' | 'disconnected' | 'syncing';

export type SyncMessageType =
  | 'command-add'
  | 'undo'
  | 'redo'
  | 'clear'
  | 'rollback'
  | 'state-request'
  | 'state-sync'
  | 'heartbeat'
  | 'hello';

export interface SyncMessageBase {
  type: SyncMessageType;
  senderId: string;
  version: number;
  timestamp: number;
}

export interface CommandAddMessage extends SyncMessageBase {
  type: 'command-add';
  command: Command;
  newCurrentIndex: number;
}

export interface UndoMessage extends SyncMessageBase {
  type: 'undo';
  newCurrentIndex: number;
}

export interface RedoMessage extends SyncMessageBase {
  type: 'redo';
  newCurrentIndex: number;
}

export interface ClearMessage extends SyncMessageBase {
  type: 'clear';
}

export interface RollbackMessage extends SyncMessageBase {
  type: 'rollback';
  newCurrentIndex: number;
}

export interface StateRequestMessage extends SyncMessageBase {
  type: 'state-request';
  requesterId: string;
}

export interface StateSyncMessage extends SyncMessageBase {
  type: 'state-sync';
  targetId: string;
  commands: Command[];
  currentIndex: number;
}

export interface HeartbeatMessage extends SyncMessageBase {
  type: 'heartbeat';
}

export interface HelloMessage extends SyncMessageBase {
  type: 'hello';
}

export type SyncMessage =
  | CommandAddMessage
  | UndoMessage
  | RedoMessage
  | ClearMessage
  | RollbackMessage
  | StateRequestMessage
  | StateSyncMessage
  | HeartbeatMessage
  | HelloMessage;

export interface PeerInfo {
  id: string;
  lastSeen: number;
}
