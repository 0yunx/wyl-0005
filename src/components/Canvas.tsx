import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import type { Shape, Point } from '@/types';

interface CanvasProps {
  shapes: Shape[];
  logicalWidth?: number;
  logicalHeight?: number;
}

export interface CanvasRef {
  getLogicalDimensions: () => { width: number; height: number };
  getScale: () => { scaleX: number; scaleY: number };
}

function getLineScale(ctx: CanvasRenderingContext2D): number {
  return Math.max(ctx.getTransform().a, 1);
}

export const Canvas = forwardRef<CanvasRef, CanvasProps>(function Canvas(
  { shapes, logicalWidth = 800, logicalHeight = 600 },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedShapeIdsRef = useRef<Set<string>>(new Set());
  const cssSizeRef = useRef({ width: 0, height: 0 });
  const dprRef = useRef(1);

  useImperativeHandle(ref, () => ({
    getLogicalDimensions: () => ({ width: logicalWidth, height: logicalHeight }),
    getScale: () => {
      const { width, height } = cssSizeRef.current;
      return {
        scaleX: width > 0 ? width / logicalWidth : 1,
        scaleY: height > 0 ? height / logicalHeight : 1,
      };
    },
  }));

  const setupContext = useCallback((ctx: CanvasRenderingContext2D) => {
    const dpr = dprRef.current;
    const { width: cssW, height: cssH } = cssSizeRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scaleX = cssW > 0 ? cssW / logicalWidth : 1;
    const scaleY = cssH > 0 ? cssH / logicalHeight : 1;
    ctx.scale(scaleX, scaleY);
  }, [logicalWidth, logicalHeight]);

  const drawBackground = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    const lineScale = getLineScale(ctx);
    ctx.strokeStyle = '#e5e5e5';
    ctx.lineWidth = 1 / lineScale;
    const gridSize = 40;
    for (let x = 0; x <= logicalWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, logicalHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= logicalHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(logicalWidth, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#d4d4d4';
    ctx.lineWidth = 2 / lineScale;
    ctx.strokeRect(0, 0, logicalWidth, logicalHeight);
  }, [logicalWidth, logicalHeight]);

  const fullRedraw = useCallback((ctx: CanvasRenderingContext2D, currentShapes: Shape[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    setupContext(ctx);
    drawBackground(ctx);

    for (const shape of currentShapes) {
      drawShape(ctx, shape);
    }

    renderedShapeIdsRef.current = new Set(currentShapes.map((s) => s.id));
  }, [setupContext, drawBackground]);

  const drawIncremental = useCallback((ctx: CanvasRenderingContext2D, newShapes: Shape[]) => {
    setupContext(ctx);
    for (const shape of newShapes) {
      drawShape(ctx, shape);
      renderedShapeIdsRef.current.add(shape.id);
    }
  }, [setupContext]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      const containerRect = container.getBoundingClientRect();
      const padding = 16;
      const availW = containerRect.width - padding * 2;
      const availH = containerRect.height - padding * 2;
      const aspect = logicalWidth / logicalHeight;

      let cssW = availW;
      let cssH = cssW / aspect;
      if (cssH > availH) {
        cssH = availH;
        cssW = cssH * aspect;
      }

      cssW = Math.max(1, Math.floor(cssW));
      cssH = Math.max(1, Math.floor(cssH));

      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      cssSizeRef.current = { width: cssW, height: cssH };

      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;

      renderedShapeIdsRef.current.clear();
      fullRedraw(ctx, shapes);
    };

    handleResize();

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [logicalWidth, logicalHeight, fullRedraw, shapes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentIds = new Set(shapes.map((s) => s.id));
    const rendered = renderedShapeIdsRef.current;

    const allExistingRendered = shapes.every((s) => rendered.has(s.id));
    const noRemoved = [...rendered].every((id) => currentIds.has(id));
    const isIncremental = allExistingRendered && noRemoved && shapes.length > rendered.size;

    if (isIncremental) {
      const newShapes = shapes.filter((s) => !rendered.has(s.id));
      drawIncremental(ctx, newShapes);
    } else if (
      shapes.length !== rendered.size ||
      ![...rendered].every((id) => currentIds.has(id))
    ) {
      fullRedraw(ctx, shapes);
    }
  }, [shapes, drawIncremental, fullRedraw]);

  return (
    <div ref={containerRef} className="flex items-center justify-center p-4 h-full w-full">
      <canvas
        ref={canvasRef}
        className="rounded-lg shadow-xl bg-white"
      />
    </div>
  );
});

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.save();
  ctx.fillStyle = shape.color;
  ctx.strokeStyle = shape.color;
  const lineScale = getLineScale(ctx);
  ctx.lineWidth = (shape.strokeWidth || 2) / lineScale;

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
        const fontSize = 24 / lineScale;
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
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
    const lineScale = getLineScale(ctx);
    const fontSize = 14 / lineScale;
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelX = p.x;
    const labelY = p.y - 25;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    const metrics = ctx.measureText(p.label);
    const padding = 4 / lineScale;
    const boxW = metrics.width + padding * 2;
    const boxH = 18 / lineScale;
    ctx.fillRect(labelX - boxW / 2, labelY - boxH / 2, boxW, boxH);
    ctx.fillStyle = '#000';
    ctx.fillText(p.label, labelX, labelY);
    ctx.restore();
  }
}

function drawArrowHead(ctx: CanvasRenderingContext2D, from: Point, to: Point) {
  const lineScale = getLineScale(ctx);
  const headLength = 12 / lineScale;
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
