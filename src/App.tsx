import { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas } from '@/components/Canvas';
import { CommandInput } from '@/components/CommandInput';
import { HistoryList } from '@/components/HistoryList';
import { Toolbar } from '@/components/Toolbar';
import { parseCommand } from '@/ruleEngine';
import { generateShapes, createCommand, collectAllPoints } from '@/shapeGenerator';
import { CollaborationManager } from '@/collaboration';
import type { Command, Shape, ConnectionStatus, PeerInfo } from '@/types';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

function App() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [syncLatency, setSyncLatency] = useState(0);
  const [syncVersion, setSyncVersion] = useState(0);
  const [syncTransport, setSyncTransport] = useState<'broadcast' | 'storage' | 'none'>('none');
  const [syncOrigin, setSyncOrigin] = useState('');

  const collabManagerRef = useRef<CollaborationManager | null>(null);
  const commandsRef = useRef<Command[]>([]);
  const currentIndexRef = useRef(-1);

  commandsRef.current = commands;
  currentIndexRef.current = currentIndex;

  const activeCommands = currentIndex >= 0 ? commands.slice(0, currentIndex + 1) : [];
  const allShapes: Shape[] = activeCommands.flatMap((cmd) => cmd.shapes);
  const canUndo = currentIndex >= 0;
  const canRedo = currentIndex < commands.length - 1;

  useEffect(() => {
    const manager = new CollaborationManager({
      onCommandAdd: (command: Command, newCurrentIndex: number, remote: boolean) => {
        if (remote) {
          setCommands((prev) => {
            const active = currentIndexRef.current >= 0 ? prev.slice(0, currentIndexRef.current + 1) : [];
            const newCommands = active.concat(command);
            commandsRef.current = newCommands;
            return newCommands;
          });
          setCurrentIndex(newCurrentIndex);
          currentIndexRef.current = newCurrentIndex;
        }
      },
      onUndo: (newCurrentIndex: number, remote: boolean) => {
        if (remote) {
          setCurrentIndex(newCurrentIndex);
          currentIndexRef.current = newCurrentIndex;
        }
      },
      onRedo: (newCurrentIndex: number, remote: boolean) => {
        if (remote) {
          setCurrentIndex(newCurrentIndex);
          currentIndexRef.current = newCurrentIndex;
        }
      },
      onClear: (remote: boolean) => {
        if (remote) {
          setCommands([]);
          setCurrentIndex(-1);
          commandsRef.current = [];
          currentIndexRef.current = -1;
        }
      },
      onRollback: (newCurrentIndex: number, remote: boolean) => {
        if (remote) {
          setCurrentIndex(newCurrentIndex);
          currentIndexRef.current = newCurrentIndex;
        }
      },
      onStateSync: (syncedCommands: Command[], syncedCurrentIndex: number) => {
        setCommands(syncedCommands);
        setCurrentIndex(syncedCurrentIndex);
        commandsRef.current = syncedCommands;
        currentIndexRef.current = syncedCurrentIndex;
      },
      onStateChange: (state) => {
        setConnectionStatus(state.connectionStatus);
        setPeers(state.peers);
        setSyncLatency(state.syncLatency);
        setSyncVersion(state.version);
        setSyncTransport(state.transport);
        setSyncOrigin(state.origin);
      },
      getState: () => ({
        commands: commandsRef.current,
        currentIndex: currentIndexRef.current,
      }),
    });

    collabManagerRef.current = manager;
    manager.connect();

    return () => {
      manager.disconnect();
      collabManagerRef.current = null;
    };
  }, []);

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

    const activeCmds = currentIndexRef.current >= 0
      ? commandsRef.current.slice(0, currentIndexRef.current + 1)
      : [];

    const parsed = parseCommand(rawText);
    const existingPoints = collectAllPoints(activeCmds);

    const { shapes } = generateShapes(parsed, {
      canvasDimensions: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      existingPoints,
    });

    if (shapes.length > 0) {
      const newCommand = createCommand(rawText, parsed, shapes);
      const newCommands = activeCmds.concat(newCommand);
      const newIndex = newCommands.length - 1;

      setCommands(newCommands);
      setCurrentIndex(newIndex);
      commandsRef.current = newCommands;
      currentIndexRef.current = newIndex;

      collabManagerRef.current?.sendCommandAdd(newCommand, newIndex);
    }

    setIsProcessing(false);
  }, []);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      const newIndex = currentIndexRef.current - 1;
      setCurrentIndex(newIndex);
      currentIndexRef.current = newIndex;
      collabManagerRef.current?.sendUndo(newIndex);
    }
  }, [canUndo]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
      const newIndex = currentIndexRef.current + 1;
      setCurrentIndex(newIndex);
      currentIndexRef.current = newIndex;
      collabManagerRef.current?.sendRedo(newIndex);
    }
  }, [canRedo]);

  const handleClear = useCallback(() => {
    setCommands([]);
    setCurrentIndex(-1);
    commandsRef.current = [];
    currentIndexRef.current = -1;
    collabManagerRef.current?.sendClear();
  }, []);

  const handleRollback = useCallback((index: number) => {
    if (index >= -1 && index < commandsRef.current.length) {
      setCurrentIndex(index);
      currentIndexRef.current = index;
      collabManagerRef.current?.sendRollback(index);
    }
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background">
      <Toolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        commandCount={activeCommands.length}
        connectionStatus={connectionStatus}
        peers={peers}
        syncLatency={syncLatency}
        syncVersion={syncVersion}
        syncTransport={syncTransport}
        syncOrigin={syncOrigin}
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
            logicalWidth={CANVAS_WIDTH}
            logicalHeight={CANVAS_HEIGHT}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
