import type { ConnectionStatus as ConnectionStatusType, PeerInfo } from '@/types';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  peers: PeerInfo[];
  latency: number;
  version: number;
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

export function ConnectionStatus({ status, peers, latency, version }: ConnectionStatusProps) {
  const config = statusConfig[status];
  const peerCount = peers.length;

  return (
    <div className="flex items-center gap-3 text-xs">
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
    </div>
  );
}
