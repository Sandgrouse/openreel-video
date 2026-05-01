import React, { useEffect, useRef, useCallback } from "react";
import { Stage, Layer, Rect, Transformer } from "react-konva";
import type Konva from "konva";
import type { Clip } from "@openreel/core";

export interface ClipBoundsInfo {
  clipId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

interface EditorStageProps {
  /** Display width of the stage (px) */
  stageWidth: number;
  /** Display height of the stage (px) */
  stageHeight: number;
  /** Project canvas width (px) */
  canvasWidth: number;
  /** Project canvas height (px) */
  canvasHeight: number;
  /** All video/image clips visible at the current time */
  visibleClips: Array<Clip & { trackId: string }>;
  /** ID of the currently selected clip (if any) */
  selectedClipId: string | null;
  /** Called when user clicks a clip on stage to select it */
  onSelectClip: (clipId: string) => void;
  /** Called when user clicks empty stage space (deselect) */
  onDeselectAll: () => void;
  /** Called live on every drag-move with new position (in project coords, pixels) */
  onClipDragMove: (clipId: string, x: number, y: number) => void;
  /** Called on drag end to commit the undo entry */
  onClipDragEnd: (clipId: string, x: number, y: number) => void;
  /** Called live on every transform change (scale & rotation) */
  onClipTransform: (
    clipId: string,
    scaleX: number,
    scaleY: number,
    rotation: number,
  ) => void;
  /** Called on transform end to commit the undo entry */
  onClipTransformEnd: (
    clipId: string,
    scaleX: number,
    scaleY: number,
    rotation: number,
  ) => void;
  /** Whether Shift is held (keep aspect ratio when false) */
  keepRatio: boolean;
}

/**
 * Convert a clip's normalized transform to pixel-space stage coordinates.
 * Position in the project store uses pixel offsets from center.
 * Scale uses fractions of the full canvas (1.0 = full canvas width/height).
 */
function clipToStageRect(
  clip: Clip,
  canvasWidth: number,
  canvasHeight: number,
  displayScale: number,
) {
  const t = clip.transform ?? {
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    opacity: 1,
    anchor: { x: 0.5, y: 0.5 },
  };

  const clipW = canvasWidth * t.scale.x * displayScale;
  const clipH = canvasHeight * t.scale.y * displayScale;

  // Center of stage in display coords
  const stageCenterX = (canvasWidth * displayScale) / 2;
  const stageCenterY = (canvasHeight * displayScale) / 2;

  // Position offset (project stores offset in project px from center)
  const cx = stageCenterX + t.position.x * displayScale;
  const cy = stageCenterY + t.position.y * displayScale;

  return {
    x: cx - clipW / 2,
    y: cy - clipH / 2,
    width: clipW,
    height: clipH,
    rotation: t.rotation ?? 0,
    opacity: t.opacity ?? 1,
  };
}

/**
 * Transparent Konva overlay placed on top of the video canvas.
 * Handles click-to-select and shows Konva.Transformer handles for the
 * selected clip. The underlying canvas still does the actual rendering.
 */
export const EditorStage: React.FC<EditorStageProps> = ({
  stageWidth,
  stageHeight,
  canvasWidth,
  canvasHeight,
  visibleClips,
  selectedClipId,
  onSelectClip,
  onDeselectAll,
  onClipDragMove,
  onClipDragEnd,
  onClipTransform,
  onClipTransformEnd,
  keepRatio,
}) => {
  const transformerRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef<Map<string, Konva.Rect>>(new Map());

  // Scale factor from project coords to display coords
  const displayScale = stageWidth / canvasWidth;

  // Attach transformer to the selected node when selection changes
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    if (selectedClipId) {
      const node = shapeRefs.current.get(selectedClipId);
      if (node) {
        transformer.nodes([node]);
        transformer.getLayer()?.batchDraw();
      }
    } else {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selectedClipId]);

  // Update keepRatio on the transformer whenever the prop changes
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    transformer.keepRatio(keepRatio);
    transformer.getLayer()?.batchDraw();
  }, [keepRatio]);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // If clicking on empty space (stage itself, not a shape)
      if (e.target === e.target.getStage()) {
        onDeselectAll();
      }
    },
    [onDeselectAll],
  );

  const handleContextMenu = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.evt.preventDefault();
    },
    [],
  );

  return (
    <Stage
      width={stageWidth}
      height={stageHeight}
      onClick={handleStageClick}
      onContextMenu={handleContextMenu}
      style={{ position: "absolute", inset: 0, pointerEvents: "all" }}
    >
      <Layer>
        {visibleClips.map((clip) => {
          const rect = clipToStageRect(
            clip,
            canvasWidth,
            canvasHeight,
            displayScale,
          );
          const isSelected = clip.id === selectedClipId;

          return (
            <Rect
              key={clip.id}
              ref={(node) => {
                if (node) {
                  shapeRefs.current.set(clip.id, node);
                } else {
                  shapeRefs.current.delete(clip.id);
                }
              }}
              id={clip.id}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rotation={rect.rotation}
              opacity={0}
              fill="transparent"
              draggable={isSelected}
              onClick={(e) => {
                e.cancelBubble = true;
                onSelectClip(clip.id);
              }}
              onDragMove={(e) => {
                const node = e.target as Konva.Rect;
                // Convert stage coords back to project coords (offset from center)
                const stageCenterX = (canvasWidth * displayScale) / 2;
                const stageCenterY = (canvasHeight * displayScale) / 2;
                const nodeCx = node.x() + node.width() / 2;
                const nodeCy = node.y() + node.height() / 2;
                const projectX = (nodeCx - stageCenterX) / displayScale;
                const projectY = (nodeCy - stageCenterY) / displayScale;
                onClipDragMove(clip.id, projectX, projectY);
              }}
              onDragEnd={(e) => {
                const node = e.target as Konva.Rect;
                const stageCenterX = (canvasWidth * displayScale) / 2;
                const stageCenterY = (canvasHeight * displayScale) / 2;
                const nodeCx = node.x() + node.width() / 2;
                const nodeCy = node.y() + node.height() / 2;
                const projectX = (nodeCx - stageCenterX) / displayScale;
                const projectY = (nodeCy - stageCenterY) / displayScale;
                onClipDragEnd(clip.id, projectX, projectY);
              }}
              onTransform={(e) => {
                const node = e.target as Konva.Rect;
                onClipTransform(
                  clip.id,
                  node.scaleX(),
                  node.scaleY(),
                  node.rotation(),
                );
              }}
              onTransformEnd={(e) => {
                const node = e.target as Konva.Rect;
                onClipTransformEnd(
                  clip.id,
                  node.scaleX(),
                  node.scaleY(),
                  node.rotation(),
                );
                // Reset node scale so Konva doesn't stack scales on subsequent transforms
                const newW = node.width() * node.scaleX();
                const newH = node.height() * node.scaleY();
                node.scaleX(1);
                node.scaleY(1);
                node.width(newW);
                node.height(newH);
              }}
            />
          );
        })}

        <Transformer
          ref={transformerRef}
          keepRatio={keepRatio}
          rotateEnabled={true}
          rotateAnchorOffset={28}
          enabledAnchors={[
            "top-left",
            "top-center",
            "top-right",
            "middle-left",
            "middle-right",
            "bottom-left",
            "bottom-center",
            "bottom-right",
          ]}
          boundBoxFunc={(oldBox, newBox) => {
            // Prevent scaling to zero or negative size
            if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
              return oldBox;
            }
            return newBox;
          }}
          anchorSize={10}
          anchorCornerRadius={2}
          anchorStroke="#22c55e"
          anchorFill="white"
          borderStroke="#22c55e"
          borderDash={[]}
          ignoreStroke={true}
          padding={0}
        />
      </Layer>
    </Stage>
  );
};

export default EditorStage;
