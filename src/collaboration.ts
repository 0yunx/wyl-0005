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
  StateRequestMessage,
} from './types';

const CHANNEL_NAME = 'ai-canvas-collaboration';
const STORAGE_KEY = 'ai-canvas-collab-storage';
const HEARTBEAT_INTERVAL = 2000;
const PEER_TIMEOUT = 5000;
const STATE_REQUEST_DELAY = 300;
const STORAGE_MESSAGE_TTL = 2000;
const INITIAL_SYNC_WINDOW = 3000;

export interface CollaborationState {
  connectionStatus: ConnectionStatus;
  peers: PeerInfo[];
  version: number;
  syncLatency: number;
  transport: 'broadcast' | 'storage' | 'none';
  origin: string;
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

type TransportType = 'broadcast' | 'storage';

interface StorageEnvelope {
  message: SyncMessage;
  nonce: string;
  expireAt: number;
}

export class CollaborationManager {
  private broadcastChannel: BroadcastChannel | null = null;
  private storageHandler: ((e: StorageEvent) => void) | null = null;
  private processedNonces: Set<string> = new Set();

  private clientId: string;
  private callbacks: CollaborationCallbacks;
  private version: number = 0;
  private peers: Map<string, number> = new Map();
  private heartbeatTimer: number | null = null;
  private peerCheckTimer: number | null = null;
  private stateRequestTimer: number | null = null;
  private initialSyncTimer: number | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private syncLatency: number = 0;
  private lastSentTimestamp: number = 0;
  private isAwaitingInitialSync: boolean = false;
  private activeTransport: TransportType | null = null;
  private connectedAt: number = 0;

  constructor(callbacks: CollaborationCallbacks) {
    this.clientId = this.generateClientId();
    this.callbacks = callbacks;
  }

  private generateClientId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
  }

  private generateNonce(): string {
    return `${this.clientId}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  }

  getClientId(): string {
    return this.clientId;
  }

  connect(): void {
    if (this.broadcastChannel || this.storageHandler) {
      return;
    }

    let transportConnected = false;

    try {
      this.broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
      this.broadcastChannel.onmessage = this.handleMessage.bind(this);
      this.broadcastChannel.onmessageerror = this.handleMessageError.bind(this);
      this.activeTransport = 'broadcast';
      transportConnected = true;
    } catch (error) {
      console.warn('BroadcastChannel unavailable, falling back to localStorage:', error);
    }

    try {
      this.storageHandler = this.handleStorageEvent.bind(this);
      window.addEventListener('storage', this.storageHandler);
      if (!transportConnected) {
        this.activeTransport = 'storage';
        transportConnected = true;
      }
    } catch (error) {
      console.error('Failed to setup localStorage fallback:', error);
    }

    if (!transportConnected) {
      this.activeTransport = null;
      this.updateConnectionStatus('disconnected');
      return;
    }

    this.isAwaitingInitialSync = true;
    this.connectedAt = Date.now();
    this.updateConnectionStatus('syncing');

    this.sendHello();

    this.scheduleStateRequest();

    this.initialSyncTimer = window.setTimeout(() => {
      if (this.isAwaitingInitialSync) {
        this.isAwaitingInitialSync = false;
        if (this.peers.size > 0) {
          this.updateConnectionStatus('connected');
        } else {
          this.updateConnectionStatus('disconnected');
        }
      }
    }, INITIAL_SYNC_WINDOW);

    this.heartbeatTimer = window.setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL);

    this.peerCheckTimer = window.setInterval(() => {
      this.checkPeerTimeouts();
    }, PEER_TIMEOUT);
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
    if (this.initialSyncTimer) {
      clearTimeout(this.initialSyncTimer);
      this.initialSyncTimer = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    if (this.storageHandler) {
      window.removeEventListener('storage', this.storageHandler);
      this.storageHandler = null;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {
    }
    this.processedNonces.clear();
    this.peers.clear();
    this.activeTransport = null;
    this.isAwaitingInitialSync = false;
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

  private handleStorageEvent(event: StorageEvent): void {
    if (event.key !== STORAGE_KEY || !event.newValue) {
      return;
    }

    try {
      const envelope: StorageEnvelope = JSON.parse(event.newValue);
      if (!envelope || !envelope.message || !envelope.nonce) {
        return;
      }
      if (Date.now() > envelope.expireAt) {
        return;
      }
      if (this.processedNonces.has(envelope.nonce)) {
        return;
      }
      this.processedNonces.add(envelope.nonce);

      if (this.processedNonces.size > 1000) {
        const arr = Array.from(this.processedNonces);
        this.processedNonces = new Set(arr.slice(arr.length - 500));
      }

      this.processIncomingMessage(envelope.message);
    } catch (_) {
    }
  }

  private handleMessage(event: MessageEvent<SyncMessage>): void {
    this.processIncomingMessage(event.data);
  }

  private processIncomingMessage(message: SyncMessage): void {
    if (!message || !message.type || !message.senderId) {
      return;
    }

    if (message.senderId === this.clientId) {
      return;
    }

    this.updatePeerLastSeen(message.senderId);

    if (message.version > this.version + 1 && message.type !== 'state-sync') {
      this.isAwaitingInitialSync = true;
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
    const { commands } = this.callbacks.getState();
    const hasContent = commands.length > 0;

    if (hasContent) {
      this.sendStateSync(message.senderId);
    }

    this.sendStateRequestTo(message.senderId);
  }

  private handleCommandAdd(message: CommandAddMessage): void {
    this.measureLatency(message.timestamp);
    if (message.version > this.version) {
      this.version = message.version;
      this.callbacks.onCommandAdd(message.command, message.newCurrentIndex, true);
    }
    this.tryCompleteInitialSync();
  }

  private handleUndo(message: UndoMessage): void {
    this.measureLatency(message.timestamp);
    if (message.version > this.version) {
      this.version = message.version;
      this.callbacks.onUndo(message.newCurrentIndex, true);
    }
    this.tryCompleteInitialSync();
  }

  private handleRedo(message: RedoMessage): void {
    this.measureLatency(message.timestamp);
    if (message.version > this.version) {
      this.version = message.version;
      this.callbacks.onRedo(message.newCurrentIndex, true);
    }
    this.tryCompleteInitialSync();
  }

  private handleClear(message: ClearMessage): void {
    this.measureLatency(message.timestamp);
    if (message.version > this.version) {
      this.version = message.version;
      this.callbacks.onClear(true);
    }
    this.tryCompleteInitialSync();
  }

  private handleRollback(message: RollbackMessage): void {
    this.measureLatency(message.timestamp);
    if (message.version > this.version) {
      this.version = message.version;
      this.callbacks.onRollback(message.newCurrentIndex, true);
    }
    this.tryCompleteInitialSync();
  }

  private handleStateRequest(message: StateRequestMessage): void {
    this.sendStateSync(message.requesterId);
  }

  private handleStateSync(message: StateSyncMessage): void {
    if (message.targetId !== this.clientId) {
      return;
    }

    this.measureLatency(message.timestamp);
    this.version = message.version;
    this.callbacks.onStateSync(message.commands, message.currentIndex);

    this.isAwaitingInitialSync = false;
    if (this.initialSyncTimer) {
      clearTimeout(this.initialSyncTimer);
      this.initialSyncTimer = null;
    }
    this.updateConnectionStatus('connected');
  }

  private tryCompleteInitialSync(): void {
    if (this.isAwaitingInitialSync && Date.now() - this.connectedAt > 500) {
      this.isAwaitingInitialSync = false;
      if (this.initialSyncTimer) {
        clearTimeout(this.initialSyncTimer);
        this.initialSyncTimer = null;
      }
      if (this.peers.size > 0) {
        this.updateConnectionStatus('connected');
      }
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
    this.version++;
    this.lastSentTimestamp = Date.now();

    const fullMessage: SyncMessage = {
      ...message,
      senderId: this.clientId,
      version: this.version,
      timestamp: Date.now(),
    } as SyncMessage;

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(fullMessage);
      } catch (error) {
        console.error('BroadcastChannel send failed:', error);
      }
    }

    if (this.activeTransport === 'storage' || !this.broadcastChannel) {
      try {
        const nonce = this.generateNonce();
        this.processedNonces.add(nonce);
        const envelope: StorageEnvelope = {
          message: fullMessage,
          nonce,
          expireAt: Date.now() + STORAGE_MESSAGE_TTL,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
      } catch (error) {
        console.error('localStorage send failed:', error);
      }
    }
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
    const baseMessage = {
      type: 'state-request' as const,
      requesterId: this.clientId,
    };
    this.send(baseMessage);
  }

  private sendStateRequestTo(_targetId: string): void {
    this.version++;
    this.lastSentTimestamp = Date.now();

    const message: StateRequestMessage = {
      type: 'state-request',
      senderId: this.clientId,
      version: this.version,
      timestamp: Date.now(),
      requesterId: this.clientId,
    };

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(message);
      } catch (error) {
        console.error('BroadcastChannel send failed:', error);
      }
    }

    if (this.activeTransport === 'storage' || !this.broadcastChannel) {
      try {
        const nonce = this.generateNonce();
        this.processedNonces.add(nonce);
        const envelope: StorageEnvelope = {
          message,
          nonce,
          expireAt: Date.now() + STORAGE_MESSAGE_TTL,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
      } catch (error) {
        console.error('localStorage send failed:', error);
      }
    }
  }

  private sendStateSync(targetId: string): void {
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

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(message);
      } catch (error) {
        console.error('BroadcastChannel send failed:', error);
      }
    }

    if (this.activeTransport === 'storage' || !this.broadcastChannel) {
      try {
        const nonce = this.generateNonce();
        this.processedNonces.add(nonce);
        const envelope: StorageEnvelope = {
          message,
          nonce,
          expireAt: Date.now() + STORAGE_MESSAGE_TTL,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
      } catch (error) {
        console.error('localStorage send failed:', error);
      }
    }
  }

  private updatePeerLastSeen(peerId: string): void {
    this.peers.set(peerId, Date.now());
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
      if (this.peers.size === 0 && !this.isAwaitingInitialSync) {
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
      transport: this.activeTransport ?? 'none',
      origin: typeof window !== 'undefined' ? window.location.origin : '',
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
      transport: this.activeTransport ?? 'none',
      origin: typeof window !== 'undefined' ? window.location.origin : '',
    };
  }
}
