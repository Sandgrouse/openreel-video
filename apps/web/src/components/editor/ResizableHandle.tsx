import React, { useCallback, useEffect, useRef, useState } from "react";

type ResizeAxis = "horizontal" | "vertical";

interface ResizableHandleProps {
  axis: ResizeAxis;
  ariaLabel: string;
  onResize: (delta: number) => void;
  keyboardStep?: number;
  reverse?: boolean;
  className?: string;
}

export const ResizableHandle: React.FC<ResizableHandleProps> = ({
  axis,
  ariaLabel,
  onResize,
  keyboardStep = 24,
  reverse = false,
  className = "",
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startPositionRef = useRef(0);
  const lastDeltaRef = useRef(0);

  const getPosition = useCallback(
    (event: PointerEvent | React.PointerEvent) =>
      axis === "horizontal" ? event.clientX : event.clientY,
    [axis],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      startPositionRef.current = getPosition(event);
      lastDeltaRef.current = 0;
      setIsDragging(true);
      document.body.style.cursor =
        axis === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [axis, getPosition],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const rawDelta = getPosition(event) - startPositionRef.current;
      const signedDelta = reverse ? -rawDelta : rawDelta;
      const incrementalDelta = signedDelta - lastDeltaRef.current;
      lastDeltaRef.current = signedDelta;
      onResize(incrementalDelta);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [getPosition, isDragging, onResize, reverse]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const isHorizontal = axis === "horizontal";
      let delta = 0;

      if (isHorizontal && event.key === "ArrowLeft") delta = -keyboardStep;
      if (isHorizontal && event.key === "ArrowRight") delta = keyboardStep;
      if (!isHorizontal && event.key === "ArrowUp") delta = -keyboardStep;
      if (!isHorizontal && event.key === "ArrowDown") delta = keyboardStep;

      if (delta === 0) return;
      event.preventDefault();
      onResize(reverse ? -delta : delta);
    },
    [axis, keyboardStep, onResize, reverse],
  );

  const isHorizontal = axis === "horizontal";

  return (
    <div
      aria-label={ariaLabel}
      aria-orientation={isHorizontal ? "vertical" : "horizontal"}
      className={`shrink-0 bg-border hover:bg-primary/50 focus:bg-primary focus:outline-none transition-colors z-20 ${
        isHorizontal
          ? "w-1 cursor-col-resize"
          : "h-1 cursor-row-resize"
      } ${isDragging ? "bg-primary" : ""} ${className}`}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      role="separator"
      tabIndex={0}
    >
      <div
        className={
          isHorizontal
            ? "h-full w-3 -ml-1 bg-transparent"
            : "h-3 w-full -mt-1 bg-transparent"
        }
      />
    </div>
  );
};
