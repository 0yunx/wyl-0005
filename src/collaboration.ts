import type {
  Command,
  SyncMessage,
  ConnectionStatus,
  PeerInfo,
  CommandAddMessage,
  UndoMessage,
  RedoMessage,
  ClearMessage,
  RollbackMessage,
  StateSyncMessage,
} from './types';

const CHANNEL_NAME = 'ai-canvas-collaboration';
const HEARTBEAT_INTERVAL = 2000;
const PEER_TIMEOUT = 5000;
const STATE_REQUEST_DELAY = 500;

export interface CollaborationState {
  connectionStatus: ConnectionStatus;
  peers: PeerInfo[];
  version: number;
  syncLatency: number;
}

export interface CollaborationCallbacks {
  onCommandAdd: (command: Command, newCurrentIndex: number, remote: boolean) => void;
  onUndo: (newCurrentIndex: number, remote: boolean) => void;
  onRedo: (newCurrentIndex: number, remote: boolean) => void;
  onClear: (remote: boolean) => void;
  onRollback: (newCurrentIndex: number, remote: boolean) => void;
  onStateSync: (commands: Command[], currentIndex: number) => void;
  onStateChange: (state: CollaborationState) => void;
  getState: () => { commands: Command[]; currentIndex: number };
}

export class CollaborationManager {
  private channel: BroadcastChannel | null = null;
  private clientId: string;
  private callbacks: CollaborationCallbacks;
  private version: number = 0;
  private peers: Map<string, number> = new Map();
  private heartbeatTimer: number | null = null;
  private peerCheckTimer: number | null = null;
  private stateRequestTimer: number | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private syncLatency: number = 0;
  private lastSentTimestamp: number = 0;
  private isSyncing: boolean = false;

  constructor(callbacks: CollaborationCallbacks) {
    this.clientId = this.generateClientId();
    this.callbacks = callbacks;
  }

  private generateClientId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
  }

  getClientId(): string {
    return this.clientId;
  }

  connect(): void {
    if (this.channel) {
      return;
    }

    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = this.handleMessage.bind(this);
      this.channel.onmessageerror = this.handleMessageError.bind(this);

      this.sendHello();

      this.scheduleStateRequest();

      this.heartbeatTimer = window.setInterval(() => {
        this.sendHeartbeat();
      }, HEARTBEAT_INTERVAL);

      this.peerCheckTimer = window.setInterval(() => {
        this.checkPeerTimeouts();
      }, PEER_TIMEOUT);

      this.updateConnectionStatus('syncing');
    } catch (error) {
      console.error('Failed to create BroadcastChannel:', error);
      this.updateConnectionStatus('disconnected');
    }
  }

  disconnect(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.peerCheckTimer) {
      clearInterval(this.peerCheckTimer);
      this.peerCheckTimer = null;
    }
    if (this.stateRequestTimer) {
      clearTimeout(this.stateRequestTimer);
      this.stateRequestTimer = null;
    }
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.peers.clear();
    this.updateConnectionStatus('disconnected');
  }

  private scheduleStateRequest(): void {
    if (this.stateRequestTimer) {
      clearTimeout(this.stateRequestTimer);
    }
    this.stateRequestTimer = window.setTimeout(() => {
      this.sendStateRequest();
    }, STATE_REQUEST_DELAY);
  }

  private handleMessage(event: MessageEvent<SyncMessage>): void {
    const message = event.data;

    if (!message || !message.type || !message.senderId) {
      return;
    }

    if (message.senderId === this.clientId) {
      return;
    }

    this.updatePeerLastSeen(message.senderId);

    if (message.version > this.version + 1 && message.type !== 'state-sync') {
      this.isSyncing = true;
      this.updateConnectionStatus('syncing');
      this.sendStateRequest();
      return;
    }

    switch (message.type) {
      case 'hello':
        this.handleHello(message);
        break;
      case 'heartbeat':
        break;
      case 'command-add':
        this.handleCommandAdd(message);
        break;
      case 'undo':
        this.handleUndo(message);
        break;
      case 'redo':
        this.handleRedo(message);
        break;
      case 'clear':
        this.handleClear(message);
        break;
      case 'rollback':
        this.handleRollback(message);
        break;
      case 'state-request':
        this.handleStateRequest(message);
        break;
      case 'state-sync':
        this.handleStateSync(message);
        break;
    }
  }

  private handleMessageError(event: MessageEvent): void {
    console.error('BroadcastChannel message error:', event);
  }

  private handleHello(message: SyncMessage): void {
    this.sendStateRequestTo(message.senderId);
  }

  private handleCommandAdd(message: CommandAddMessage): void {
    this.measureLatency(message.timestamp);
    if (message.version > this.version) {
      this.version = message.version;
      this.callbacks.onCommandAdd(message.command, message.newCurrentIndex, true);
    }
    this.completeSyncing();
  }

  private handleUndo(message: UndoMessage): void {
    this.measureLatency(message.timestamp);
    if (message.version > this.version) {
      this.version = message.version;
      this.callbacks.onUndo(message.newCurrentIndex, true);
    }
    this.completeSyncing();
  }

  private handleRedo(message: RedoMessage): void {
    this.measureLatency(message.timestamp);
    if (message.version > this.version) {
      this.version = message.version;
      this.callbacks.onRedo(message.newCurrentIndex, true);
    }
    this.completeSyncing();
  }

  private handleClear(message: ClearMessage): void {
    this.measureLatency(message.timestamp);
    if (message.version > this.version) {
      this.version = message.version;
      this.callbacks.onClear(true);
    }
    this.completeSyncing();
  }

  private handleRollback(message: RollbackMessage): void {
    this.measureLatency(message.timestamp);
    if (message.version > this.version) {
      this.version = message.version;
      this.callbacks.onRollback(message.newCurrentIndex, true);
    }
    this.completeSyncing();
  }

  private handleStateRequest(message: SyncMessage): void {
    if ('requesterId' in message) {
      this.sendStateSync(message.requesterId);
    }
  }

  private handleStateSync(message: StateSyncMessage): void {
    if (message.targetId !== this.clientId) {
      return;
    }

    this.measureLatency(message.timestamp);
    this.version = message.version;
    this.callbacks.onStateSync(message.commands, message.currentIndex);
    this.completeSyncing();
  }

  private completeSyncing(): void {
    this.isSyncing = false;
    if (this.peers.size > 0) {
      this.updateConnectionStatus('connected');
    }
  }

  private measureLatency(remoteTimestamp: number): void {
    if (this.lastSentTimestamp > 0) {
      this.syncLatency = Date.now() - this.lastSentTimestamp;
      this.lastSentTimestamp = 0;
    } else if (remoteTimestamp > 0) {
      this.syncLatency = Date.now() - remoteTimestamp;
    }
    this.notifyStateChange();
  }

  private send(message: Omit<SyncMessage, 'senderId' | 'version' | 'timestamp'>): void {
    if (!this.channel) {
      return;
    }

    this.version++;
    this.lastSentTimestamp = Date.now();

    const fullMessage: SyncMessage = {
      ...message,
      senderId: this.clientId,
      version: this.version,
      timestamp: Date.now(),
    } as SyncMessage;

    this.channel.postMessage(fullMessage);
  }

  sendCommandAdd(command: Command, newCurrentIndex: number): void {
    this.send({
      type: 'command-add',
      command,
      newCurrentIndex,
    } as Omit<CommandAddMessage, 'senderId' | 'version' | 'timestamp'>);
  }

  sendUndo(newCurrentIndex: number): void {
    this.send({
      type: 'undo',
      newCurrentIndex,
    } as Omit<UndoMessage, 'senderId' | 'version' | 'timestamp'>);
  }

  sendRedo(newCurrentIndex: number): void {
    this.send({
      type: 'redo',
      newCurrentIndex,
    } as Omit<RedoMessage, 'senderId' | 'version' | 'timestamp'>);
  }

  sendClear(): void {
    this.send({
      type: 'clear',
    } as Omit<ClearMessage, 'senderId' | 'version' | 'timestamp'>);
  }

  sendRollback(newCurrentIndex: number): void {
    this.send({
      type: 'rollback',
      newCurrentIndex,
    } as Omit<RollbackMessage, 'senderId' | 'version' | 'timestamp'>);
  }

  private sendHello(): void {
    this.send({
      type: 'hello',
    });
  }

  private sendHeartbeat(): void {
    this.send({
      type: 'heartbeat',
    });
  }

  private sendStateRequest(): void {
    if (!this.channel) return;

    this.version++;
    this.lastSentTimestamp = Date.now();

    const message: SyncMessage = {
      type: 'state-request',
      senderId: this.clientId,
      version: this.version,
      timestamp: Date.now(),
      requesterId: this.clientId,
    } as SyncMessage;

    this.channel.postMessage(message);
  }

  private sendStateRequestTo(targetId: string): void {
    if (!this.channel) return;

    this.version++;

    const message: SyncMessage = {
      type: 'state-request',
      senderId: this.clientId,
      version: this.version,
      timestamp: Date.now(),
      requesterId: targetId,
    } as SyncMessage;

    this.channel.postMessage(message);
  }

  private sendStateSync(targetId: string): void {
    if (!this.channel) return;

    const { commands, currentIndex } = this.callbacks.getState();

    this.version++;
    this.lastSentTimestamp = Date.now();

    const message: StateSyncMessage = {
      type: 'state-sync',
      senderId: this.clientId,
      version: this.version,
      timestamp: Date.now(),
      targetId,
      commands,
      currentIndex,
    };

    this.channel.postMessage(message);
  }

  private updatePeerLastSeen(peerId: string): void {
    this.peers.set(peerId, Date.now());
    if (!this.isSyncing && this.connectionStatus !== 'connected') {
      this.updateConnectionStatus('connected');
    }
    this.notifyStateChange();
  }

  private checkPeerTimeouts(): void {
    const now = Date.now();
    let changed = false;

    for (const [peerId, lastSeen] of this.peers.entries()) {
      if (now - lastSeen > PEER_TIMEOUT) {
        this.peers.delete(peerId);
        changed = true;
      }
    }

    if (changed) {
      if (this.peers.size === 0 && !this.isSyncing) {
        this.updateConnectionStatus('disconnected');
      }
      this.notifyStateChange();
    }
  }

  private updateConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.notifyStateChange();
    }
  }

  private notifyStateChange(): void {
    this.callbacks.onStateChange({
      connectionStatus: this.connectionStatus,
      peers: Array.from(this.peers.entries()).map(([id, lastSeen]) => ({
        id,
        lastSeen,
      })),
      version: this.version,
      syncLatency: this.syncLatency,
    });
  }

  getState(): CollaborationState {
    return {
      connectionStatus: this.connectionStatus,
      peers: Array.from(this.peers.entries()).map(([id, lastSeen]) => ({
        id,
        lastSeen,
      })),
      version: this.version,
      syncLatency: this.syncLatency,
    };
  }
}
