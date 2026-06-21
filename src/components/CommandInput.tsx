import { useState, type KeyboardEvent } from 'react';

interface CommandInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

const EXAMPLE_COMMANDS = [
  '画一个红色圆形在左上角',
  '画一个蓝色矩形在右下角',
  '画一个绿色三角形在中间',
  '连接A点和B点',
  '用折线连接A、B、C点',
  '写"Hello"在顶部',
];

export function CommandInput({ onSend, disabled }: CommandInputProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExampleClick = (cmd: string) => {
    setText(cmd);
  };

  return (
    <div className="p-4 border-t border-border bg-card">
      <div className="flex flex-wrap gap-2 mb-3">
        {EXAMPLE_COMMANDS.map((cmd, i) => (
          <button
            key={i}
            onClick={() => handleExampleClick(cmd)}
            className="text-xs px-2 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
          >
            {cmd}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入指令，例如：画一个红色圆形在左上角"
          className="flex-1 px-3 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none h-20"
          disabled={disabled}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
