import type { ConnectionStatus as ConnectionStatusType, PeerInfo } from '@/types';

type TransportType = 'broadcast' | 'storage' | 'none';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  peers: PeerInfo[];
  latency: number;
  version: number;
  transport: TransportType;
  origin: string;
}

const statusConfig: Record<ConnectionStatusType, { label: string; color: string; bgColor: string }> = {
  connected: {
    label: '已连接',
    color: 'text-success',
    bgColor: 'bg-success',
  },
  disconnected: {
    label: '未连接',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted-foreground',
  },
  syncing: {
    label: '同步中',
    color: 'text-warning',
    bgColor: 'bg-warning',
  },
};

const transportLabels: Record<TransportType, string> = {
  broadcast: 'BroadcastChannel',
  storage: 'LocalStorage',
  none: '无',
};

export function ConnectionStatus({ status, peers, latency, version, transport, origin }: ConnectionStatusProps) {
  const config = statusConfig[status];
  const peerCount = peers.length;

  return (
    <div className="flex items-center gap-3 text-xs" title={`Origin: ${origin} | Transport: ${transportLabels[transport]}`}>
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <div className={`w-2 h-2 rounded-full ${config.bgColor}`} />
          {status === 'syncing' && (
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-warning animate-ping opacity-75" />
          )}
          {status === 'connected' && peerCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-3 h-3 text-[10px] font-bold bg-primary text-primary-foreground rounded-full">
              {peerCount}
            </span>
          )}
        </div>
        <span className={`font-medium ${config.color}`}>{config.label}</span>
      </div>

      {status === 'connected' && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {latency}ms
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
            {transportLabels[transport]}
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span>v{version}</span>
        </div>
      )}

      {status === 'syncing' && (
        <div className="text-muted-foreground flex items-center gap-1">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          正在同步状态...
        </div>
      )}

      {status === 'disconnected' && peerCount === 0 && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>请确保多端使用相同的 origin 访问</span>
          <span className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">
            {origin || 'unknown'}
          </span>
        </div>
      )}
    </div>
  );
}
