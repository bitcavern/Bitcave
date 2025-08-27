import React, { useRef, useEffect, useState, useCallback } from "react";
import type { CanvasState } from "@/shared/types";
import { APP_CONFIG } from "@/shared/constants";

interface CanvasProps {
  state: CanvasState;
  onViewportChange: (viewport: CanvasState["viewport"]) => void;
  children: React.ReactNode;
}

export const Canvas: React.FC<CanvasProps> = ({
  state,
  onViewportChange,
  children,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastViewport, setLastViewport] = useState(state.viewport);

  // Handle mouse wheel for zooming (only with cmd/ctrl pressed, slower speed)
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      // Only zoom when cmd/ctrl is pressed
      if (!event.ctrlKey && !event.metaKey) {
        return; // Allow normal scrolling
      }

      event.preventDefault();

      // Slower zoom factor for more precise control
      const zoomFactor = event.deltaY > 0 ? 0.95 : 1.05;
      const newZoom = Math.max(
        APP_CONFIG.canvasDefaults.minZoom,
        Math.min(
          APP_CONFIG.canvasDefaults.maxZoom,
          state.viewport.zoom * zoomFactor
        )
      );

      if (newZoom !== state.viewport.zoom) {
        // Zoom towards mouse position
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const mouseX = event.clientX - rect.left;
          const mouseY = event.clientY - rect.top;

          // Calculate the world position of the mouse
          const worldX = (mouseX - state.viewport.x) / state.viewport.zoom;
          const worldY = (mouseY - state.viewport.y) / state.viewport.zoom;

          // Calculate new viewport position to keep mouse position fixed
          const newX = mouseX - worldX * newZoom;
          const newY = mouseY - worldY * newZoom;

          onViewportChange({
            x: newX,
            y: newY,
            zoom: newZoom,
          });
        }
      }
    },
    [state.viewport, onViewportChange]
  );

  // Handle mouse down for panning
  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Only start dragging if clicking directly on the canvas background
      // Check if target is the canvas itself or has 'canvas' class
      const isCanvas = target === canvasRef.current || target.classList.contains("canvas");
      const isCanvasChild = target.closest('[data-canvas-background]') === canvasRef.current;
      const onCanvasBackground = isCanvas || isCanvasChild;
      
      // Don't interfere with window interactions - only pan on background clicks
      const isWindowElement = target.closest('.window') !== null;
      
      if (onCanvasBackground && !isWindowElement && event.button === 0) {
        event.preventDefault();
        setIsDragging(true);
        setDragStart({ x: event.clientX, y: event.clientY });
        setLastViewport(state.viewport);
      }
    },
    [state.viewport]
  );

  // Handle mouse move for panning
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (isDragging) {
        const deltaX = event.clientX - dragStart.x;
        const deltaY = event.clientY - dragStart.y;

        onViewportChange({
          x: lastViewport.x + deltaX,
          y: lastViewport.y + deltaY,
          zoom: state.viewport.zoom,
        });
      }
    },
    [isDragging, dragStart, lastViewport, onViewportChange, state.viewport.zoom]
  );

  // Handle mouse up to stop panning
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Spacebar panning removed to avoid interfering with typing in the Bit sidebar

  // Set up event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleWheel, handleMouseMove, handleMouseUp]);

  // Canvas grid pattern
  const gridSize = 50 * state.viewport.zoom;
  const gridOffsetX = state.viewport.x % gridSize;
  const gridOffsetY = state.viewport.y % gridSize;

  return (
    <div
      ref={canvasRef}
      className="canvas"
      data-canvas-background
      onMouseDown={handleMouseDown}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        cursor: isDragging ? "grabbing" : "grab",
        backgroundColor: "#1f2937",
        backgroundImage: `
          linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
        `,
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
      }}
    >
      {/* Canvas content container */}
      <div
        style={{
          position: "absolute",
          transform: `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.zoom})`,
          transformOrigin: "0 0",
          width: "100%",
          height: "100%",
        }}
      >
        {children}
      </div>

      {/* Canvas info overlay */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "12px",
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          color: "white",
          padding: "5px 10px",
          borderRadius: "4px",
          fontSize: "12px",
          fontFamily: "monospace",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span>Zoom:</span>
        <button
          onClick={() => {
            onViewportChange({
              ...state.viewport,
              zoom: 1.0,
            });
          }}
          style={{
            background: "none",
            border: "none",
            color: "white",
            cursor: "pointer",
            fontSize: "12px",
            fontFamily: "monospace",
            textDecoration: state.viewport.zoom !== 1.0 ? "underline" : "none",
            padding: 0,
          }}
          title="Click to reset zoom to 100%"
        >
          {Math.round(state.viewport.zoom * 100)}%
        </button>
        <span>| X: {Math.round(state.viewport.x)} | Y: {Math.round(state.viewport.y)}</span>
      </div>
    </div>
  );
};
