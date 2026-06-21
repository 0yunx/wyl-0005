import type { ParsedCommand, Shape, Point, Command } from './types';
import { generateId, resolvePosition } from './ruleEngine';

export interface CanvasDimensions {
  width: number;
  height: number;
}

export interface ShapeGeneratorContext {
  canvasDimensions: CanvasDimensions;
  existingPoints: Map<string, Point>;
}

export function generateShapes(
  parsed: ParsedCommand,
  ctx: ShapeGeneratorContext
): { shapes: Shape[]; newPoints: Map<string, Point> } {
  const shapes: Shape[] = [];
  const newPoints = new Map<string, Point>();
  const { canvasDimensions, existingPoints } = ctx;
  const size = parsed.size || 50;

  if (parsed.action === 'connect' && parsed.points && parsed.points.length >= 2) {
    const points: Point[] = parsed.points.map(p => {
      if (p.label && existingPoints.has(p.label)) {
        return existingPoints.get(p.label)!;
      }
      return p;
    });

    if (parsed.shape === 'polyline') {
      shapes.push({
        id: generateId(),
        type: 'polyline',
        color: parsed.color || '#3b82f6',
        strokeWidth: 3,
        points: points,
      });
    } else {
      for (let i = 0; i < points.length - 1; i++) {
        shapes.push({
          id: generateId(),
          type: 'line',
          color: parsed.color || '#3b82f6',
          strokeWidth: 3,
          startPoint: points[i],
          endPoint: points[i + 1],
        });
      }
    }
  } else if (parsed.action === 'connect' && parsed.startLabel && parsed.endLabel) {
    const startPoint = existingPoints.get(parsed.startLabel);
    const endPoint = existingPoints.get(parsed.endLabel);

    if (startPoint && endPoint) {
      shapes.push({
        id: generateId(),
        type: parsed.shape || 'line',
        color: parsed.color || '#3b82f6',
        strokeWidth: 3,
        startPoint,
        endPoint,
      });
    }
  } else if (parsed.action === 'write' && parsed.text) {
    const pos = resolvePosition(
      parsed.position || 'center',
      canvasDimensions.width,
      canvasDimensions.height,
      size
    );
    shapes.push({
      id: generateId(),
      type: 'text',
      color: parsed.color || '#000000',
      text: parsed.text,
      position: parsed.position,
      points: [{ ...pos }],
    });
  } else if (parsed.shape && parsed.position) {
    const pos = resolvePosition(
      parsed.position,
      canvasDimensions.width,
      canvasDimensions.height,
      size
    );

    let label: string | undefined;
    if (parsed.points && parsed.points.length > 0 && parsed.points[0].label) {
      label = parsed.points[0].label;
      newPoints.set(label, { ...pos, label });
    }

    switch (parsed.shape) {
      case 'circle':
        shapes.push({
          id: generateId(),
          type: 'circle',
          color: parsed.color || '#3b82f6',
          fill: true,
          radius: size / 2,
          points: [{ ...pos, label }],
          position: parsed.position,
        });
        break;
      case 'rectangle':
        shapes.push({
          id: generateId(),
          type: 'rectangle',
          color: parsed.color || '#3b82f6',
          fill: true,
          width: size,
          height: size * 0.75,
          points: [{ x: pos.x - size / 2, y: pos.y - (size * 0.75) / 2, label }],
          position: parsed.position,
        });
        break;
      case 'triangle':
        shapes.push({
          id: generateId(),
          type: 'triangle',
          color: parsed.color || '#3b82f6',
          fill: true,
          points: [
            { x: pos.x, y: pos.y - size / 2 },
            { x: pos.x - size / 2, y: pos.y + size / 2 },
            { x: pos.x + size / 2, y: pos.y + size / 2 },
          ],
          position: parsed.position,
        });
        break;
      case 'point':
        shapes.push({
          id: generateId(),
          type: 'point',
          color: parsed.color || '#000000',
          radius: 6,
          fill: true,
          points: [{ ...pos, label }],
          position: parsed.position,
        });
        break;
      case 'line':
        shapes.push({
          id: generateId(),
          type: 'line',
          color: parsed.color || '#3b82f6',
          strokeWidth: 3,
          startPoint: { x: pos.x - size / 2, y: pos.y },
          endPoint: { x: pos.x + size / 2, y: pos.y },
          position: parsed.position,
        });
        break;
    }
  }

  return { shapes, newPoints };
}

export function createCommand(
  rawText: string,
  parsedResult: ParsedCommand,
  shapes: Shape[]
): Command {
  return {
    id: generateId(),
    rawText,
    parsedResult,
    shapes,
    timestamp: Date.now(),
  };
}

export function collectAllPoints(commands: Command[]): Map<string, Point> {
  const points = new Map<string, Point>();
  for (const cmd of commands) {
    for (const shape of cmd.shapes) {
      if (shape.points) {
        for (const p of shape.points) {
          if (p.label) {
            points.set(p.label, p);
          }
        }
      }
    }
  }
  return points;
}
