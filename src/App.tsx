import { useState, useCallback, useEffect } from 'react';
import { Canvas } from '@/components/Canvas';
import { CommandInput } from '@/components/CommandInput';
import { HistoryList } from '@/components/HistoryList';
import { Toolbar } from '@/components/Toolbar';
import { parseCommand } from '@/ruleEngine';
import { generateShapes, createCommand, collectAllPoints } from '@/shapeGenerator';
import type { Command, Shape } from '@/types';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

function App() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);

  const activeCommands = currentIndex >= 0 ? commands.slice(0, currentIndex + 1) : [];
  const allShapes: Shape[] = activeCommands.flatMap((cmd) => cmd.shapes);
  const canUndo = currentIndex >= 0;
  const canRedo = currentIndex < commands.length - 1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo]);

  const handleSend = useCallback(async (rawText: string) => {
    setIsProcessing(true);

    await new Promise((resolve) => setTimeout(resolve, 300));

    const parsed = parseCommand(rawText);
    const existingPoints = collectAllPoints(activeCommands);

    const { shapes } = generateShapes(parsed, {
      canvasDimensions: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      existingPoints,
    });

    if (shapes.length > 0) {
      const newCommand = createCommand(rawText, parsed, shapes);
      const newCommands = activeCommands.concat(newCommand);

      setCommands(newCommands);
      setCurrentIndex(newCommands.length - 1);
    }

    setIsProcessing(false);
  }, [activeCommands]);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [canUndo]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [canRedo]);

  const handleClear = useCallback(() => {
    setCommands([]);
    setCurrentIndex(-1);
  }, []);

  const handleRollback = useCallback((index: number) => {
    if (index >= -1 && index < commands.length) {
      setCurrentIndex(index);
    }
  }, [commands.length]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <Toolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        commandCount={activeCommands.length}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-border flex flex-col bg-card">
          <HistoryList
            commands={commands}
            currentIndex={currentIndex}
            onRollback={handleRollback}
          />
          <CommandInput onSend={handleSend} disabled={isProcessing} />
        </div>
        <div className="flex-1 bg-muted/30 flex items-center justify-center">
          <Canvas
            shapes={allShapes}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
