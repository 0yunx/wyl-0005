import { useEffect, useRef } from 'react';
import type { Shape, Point } from '@/types';

interface CanvasProps {
  shapes: Shape[];
  width?: number;
  height?: number;
}

export function Canvas({ shapes, width = 800, height = 600 }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#e5e5e5';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#d4d4d4';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);

    for (const shape of shapes) {
      drawShape(ctx, shape);
    }
  }, [shapes, width, height]);

  return (
    <div ref={containerRef} className="flex items-center justify-center p-4 h-full">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-lg shadow-xl bg-white"
        style={{ maxWidth: '100%', maxHeight: '100%' }}
      />
    </div>
  );
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.save();
  ctx.fillStyle = shape.color;
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = shape.strokeWidth || 2;

  switch (shape.type) {
    case 'circle':
      if (shape.points && shape.points.length > 0) {
        const p = shape.points[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, shape.radius || 25, 0, Math.PI * 2);
        if (shape.fill) {
          ctx.fill();
        } else {
          ctx.stroke();
        }
        drawPointLabel(ctx, p);
      }
      break;

    case 'rectangle':
      if (shape.points && shape.points.length > 0) {
        const p = shape.points[0];
        if (shape.fill) {
          ctx.fillRect(p.x, p.y, shape.width || 50, shape.height || 50);
        } else {
          ctx.strokeRect(p.x, p.y, shape.width || 50, shape.height || 50);
        }
        drawPointLabel(ctx, p);
      }
      break;

    case 'triangle':
      if (shape.points && shape.points.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        ctx.lineTo(shape.points[1].x, shape.points[1].y);
        ctx.lineTo(shape.points[2].x, shape.points[2].y);
        ctx.closePath();
        if (shape.fill) {
          ctx.fill();
        } else {
          ctx.stroke();
        }
      }
      break;

    case 'line':
      if (shape.startPoint && shape.endPoint) {
        ctx.beginPath();
        ctx.moveTo(shape.startPoint.x, shape.startPoint.y);
        ctx.lineTo(shape.endPoint.x, shape.endPoint.y);
        ctx.stroke();
        drawArrowHead(ctx, shape.startPoint, shape.endPoint);
      }
      break;

    case 'polyline':
      if (shape.points && shape.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        ctx.stroke();
        for (let i = 1; i < shape.points.length; i++) {
          drawArrowHead(ctx, shape.points[i - 1], shape.points[i]);
        }
      }
      break;

    case 'text':
      if (shape.points && shape.points.length > 0 && shape.text) {
        const p = shape.points[0];
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = shape.color;
        ctx.fillText(shape.text, p.x, p.y);
      }
      break;

    case 'point':
      if (shape.points && shape.points.length > 0) {
        const p = shape.points[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, shape.radius || 6, 0, Math.PI * 2);
        if (shape.fill) {
          ctx.fill();
        } else {
          ctx.stroke();
        }
        drawPointLabel(ctx, p);
      }
      break;
  }

  ctx.restore();
}

function drawPointLabel(ctx: CanvasRenderingContext2D, p: Point) {
  if (p.label) {
    ctx.save();
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelX = p.x;
    const labelY = p.y - 25;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    const metrics = ctx.measureText(p.label);
    ctx.fillRect(labelX - metrics.width / 2 - 4, labelY - 8, metrics.width + 8, 18);
    ctx.fillStyle = '#000';
    ctx.fillText(p.label, labelX, labelY);
    ctx.restore();
  }
}

function drawArrowHead(ctx: CanvasRenderingContext2D, from: Point, to: Point) {
  const headLength = 12;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - headLength * Math.cos(angle - Math.PI / 6),
    to.y - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - headLength * Math.cos(angle + Math.PI / 6),
    to.y - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}
