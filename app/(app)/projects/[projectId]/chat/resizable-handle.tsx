"use client";

import { useCallback, useRef } from "react";

interface ResizableHandleProps {
  onResize: (deltaX: number) => void;
}

export function ResizableHandle({ onResize }: ResizableHandleProps) {
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      lastXRef.current = e.clientX;

      const onMouseMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        const delta = ev.clientX - lastXRef.current;
        lastXRef.current = ev.clientX;
        onResize(delta);
      };

      const onMouseUp = () => {
        draggingRef.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [onResize]
  );

  return (
    <div
      onMouseDown={onMouseDown}
      className="flex-shrink-0 w-1 cursor-col-resize bg-beige/50 hover:bg-navy/20 active:bg-navy/30 transition-colors"
    />
  );
}
