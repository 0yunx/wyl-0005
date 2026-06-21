import type { Command } from '@/types';

interface HistoryListProps {
  commands: Command[];
  currentIndex: number;
  onRollback: (index: number) => void;
}

export function HistoryList({ commands, currentIndex, onRollback }: HistoryListProps) {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      draw: '绘制',
      connect: '连接',
      add: '添加',
      create: '创建',
      place: '放置',
      write: '写入',
    };
    return labels[action] || action;
  };

  const getShapeLabel = (shape?: string) => {
    if (!shape) return '';
    const labels: Record<string, string> = {
      circle: '圆形',
      rectangle: '矩形',
      triangle: '三角形',
      line: '直线',
      polyline: '折线',
      text: '文字',
      point: '点',
    };
    return labels[shape] || shape;
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">历史指令</h3>
        <p className="text-xs text-muted-foreground mt-1">
          点击任意指令可回滚到该状态
        </p>
      </div>
      <div className="divide-y divide-border">
        {commands.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            暂无历史记录
          </div>
        ) : (
          commands.map((cmd, index) => (
          <div
            key={cmd.id}
            onClick={() => onRollback(index)}
            className={`p-3 cursor-pointer transition-colors ${
              index < currentIndex
                ? 'bg-muted/50'
                : index === currentIndex
                ? 'bg-primary/10 border-l-4 border-primary'
                : 'hover:bg-accent/50'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{cmd.rawText}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                    #{index + 1}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-accent text-accent-foreground">
                    {getActionLabel(cmd.parsedResult.action)}
                    {cmd.parsedResult.shape && ` ${getShapeLabel(cmd.parsedResult.shape)}`}
                  </span>
                  {cmd.parsedResult.color && (
                    <span
                      className="text-xs px-2 py-0.5 rounded border"
                      style={{
                        backgroundColor: cmd.parsedResult.color,
                        color: '#fff',
                      }}
                    >
                      {cmd.parsedResult.color}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatTime(cmd.timestamp)}
              </span>
            </div>
          </div>
        )))}
      </div>
    </div>
  );
}
