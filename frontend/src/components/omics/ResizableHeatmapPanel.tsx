'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';

interface ResizableHeatmapPanelProps {
  children: ReactNode;
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  className?: string;
}

export default function ResizableHeatmapPanel({
  children,
  initialWidth,
  minWidth,
  maxWidth,
  className = ''
}: ResizableHeatmapPanelProps) {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      
      // Constrain width within bounds
      const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, minWidth, maxWidth]);

  return (
    <div
      ref={containerRef}
      className={`flex-shrink-0 relative ${className}`}
      style={{ width: `${width}px` }}
    >
      {children}
      
      {/* Resize handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full bg-transparent hover:bg-blue-300 cursor-col-resize transition-colors"
        onMouseDown={handleMouseDown}
        style={{
          zIndex: 10,
          background: isResizing ? '#3b82f6' : 'transparent'
        }}
      />
    </div>
  );
}
