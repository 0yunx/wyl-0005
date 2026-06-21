interface ToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  commandCount: number;
}

export function Toolbar({ canUndo, canRedo, onUndo, onRedo, onClear, commandCount }: ToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 mr-4">
          <div className="w-3 h-3 rounded-full bg-destructive" />
          <div className="w-3 h-3 rounded-full bg-warning" />
          <div className="w-3 h-3 rounded-full bg-success" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">
          AI 画布
        </h1>
        <span className="text-xs text-muted-foreground ml-2">
          ({commandCount} 条指令
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="撤销 (Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="重做 (Ctrl+Y)"
        >
          ↷ Redo
        </button>
        <button
          onClick={onClear}
          disabled={commandCount === 0}
          className="px-3 py-1.5 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          清空
        </button>
      </div>
    </div>
  );
}
