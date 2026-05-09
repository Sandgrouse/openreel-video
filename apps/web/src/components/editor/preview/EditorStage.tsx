import React, { useEffect, useRef, useCallback } from "react";
import { Stage, Layer, Rect, Transformer } from "react-konva";
import type Konva from "konva";
import type { Clip } from "@openreel/core";

export interface VisibleClip extends Clip {
  trackId: string;
  /** Source media width (pixels) — used to compute natural contain-fit draw size */
  mediaWidth: number;
  /** Source media height (pixels) */
  mediaHeight: number;
}

interface EditorStageProps {
  /** Display width of the stage (px) — matches the canvas element's CSS width */
  stageWidth: number;
  /** Display height of the stage (px) */
  stageHeight: number;
  /** Project canvas width (px) — e.g. 1080 for 9:16 */
  canvasWidth: number;
  /** Project canvas height (px) — e.g. 1920 for 9:16 */
  canvasHeight: number;
  /** All video/image clips visible at the current playhead */
  visibleClips: VisibleClip[];
  /** ID of the currently selected clip */
  selectedClipId: string | null;
  onSelectClip: (clipId: string) => void;
  onDeselectAll: () => void;
  /** Live drag update (project coords, px offset from canvas center) */
  onClipDragMove: (clipId: string, x: number, y: number) => void;
  onClipDragEnd: (clipId: string, x: number, y: number) => void;
  /** Live transform update (new project scale + rotation + position) */
  onClipTransform: (
    clipId: string,
    scaleX: number,
    scaleY: number,
    rotation: number,
    x: number,
    y: number,
  ) => void;
  onClipTransformEnd: (
    clipId: string,
    scaleX: number,
    scaleY: number,
    rotation: number,
    x: number,
    y: number,
  ) => void;
  /** When true, the Transformer preserves the clip's aspect ratio */
  keepRatio: boolean;
}

/**
 * Compute the "natural" draw size (at scale=1.0) matching drawFrameWithTransform's
 * contain-fit logic. At scale=1.0, the video frame fits entirely inside the canvas
 * while preserving its aspect ratio (letterbox or pillarbox).
 *
 * drawFrameWithTransform does:
 *   ctx.scale(t.scale.x, t.scale.y);
 *   ctx.drawImage(frame, -natW/2, -natH/2, natW, natH);
 *
 * So the actual rendered frame at scaleX=sx occupies natW*sx × natH*sy on the canvas.
 * Knowing natW/natH lets the overlay place handles exactly on the video frame.
 */
function naturalDrawSize(
  mediaWidth: number,
  mediaHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): { w: number; h: number } {
  if (!mediaWidth || !mediaHeight) {
    return { w: canvasWidth, h: canvasHeight };
  }
  const srcAspect = mediaWidth / mediaHeight;
  const cvAspect = canvasWidth / canvasHeight;
  if (srcAspect > cvAspect) {
    // Landscape source on portrait (or narrower) canvas — letterbox top/bottom
    return { w: canvasWidth, h: canvasWidth / srcAspect };
  } else {
    // Portrait (or equal) source — pillarbox left/right
    return { w: canvasHeight * srcAspect, h: canvasHeight };
  }
}

/**
 * Transparent Konva overlay placed on top of the video canvas.
 * Provides click-to-select and Konva.Transformer handles (resize + rotate)
 * for the selected clip. All actual rendering is done by the underlying <canvas>;
 * this overlay is purely for interaction.
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

  // Scale factor: project canvas pixels → stage display pixels
  const displayScale = stageWidth / canvasWidth;
  const stageCenterX = (canvasWidth * displayScale) / 2;
  const stageCenterY = (canvasHeight * displayScale) / 2;

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

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    transformer.keepRatio(keepRatio);
    transformer.getLayer()?.batchDraw();
  }, [keepRatio]);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === e.target.getStage()) onDeselectAll();
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
          const t = clip.transform;
          const { w: natW, h: natH } = naturalDrawSize(
            clip.mediaWidth,
            clip.mediaHeight,
            canvasWidth,
            canvasHeight,
          );

          /*
           * Layout strategy: x/y = visual center of the clip.
           *
           * With offsetX = dispW/2, offsetY = dispH/2:
           *   visual center = (x, y) regardless of scaleX/scaleY/rotation.
           * This means:
           *   - node.x() always returns the clip's visual center X in stage coords.
           *   - node.scaleX() directly equals the project's scale.x value.
           *   - The Transformer's resize/rotate anchors work correctly around center.
           *
           * Project ↔ stage coordinate conversions:
           *   project_x = (node.x() - stageCenterX) / displayScale
           *   project_scale_x = node.scaleX()   (because width = natW * displayScale at scale=1)
           */
          const dispW = natW * displayScale;
          const dispH = natH * displayScale;
          const cx = stageCenterX + t.position.x * displayScale;
          const cy = stageCenterY + t.position.y * displayScale;
          const isSelected = clip.id === selectedClipId;

          return (
            <Rect
              key={clip.id}
              ref={(node) => {
                if (node) shapeRefs.current.set(clip.id, node);
                else shapeRefs.current.delete(clip.id);
              }}
              id={clip.id}
              x={cx}
              y={cy}
              offsetX={dispW / 2}
              offsetY={dispH / 2}
              width={dispW}
              height={dispH}
              scaleX={t.scale.x}
              scaleY={t.scale.y}
              rotation={t.rotation ?? 0}
              opacity={0}
              fill="transparent"
              /* Intentionally invisible — only for hit-testing + Transformer.
                 Actual video rendering is on the underlying <canvas> element. */
              draggable={isSelected}
              onClick={(e) => {
                e.evt.stopPropagation();
                onSelectClip(clip.id);
              }}
              onDragMove={(e) => {
                const node = e.target as Konva.Rect;
                onClipDragMove(
                  clip.id,
                  (node.x() - stageCenterX) / displayScale,
                  (node.y() - stageCenterY) / displayScale,
                );
              }}
              onDragEnd={(e) => {
                const node = e.target as Konva.Rect;
                onClipDragEnd(
                  clip.id,
                  (node.x() - stageCenterX) / displayScale,
                  (node.y() - stageCenterY) / displayScale,
                );
              }}
              onTransform={(e) => {
                const node = e.target as Konva.Rect;
                onClipTransform(
                  clip.id,
                  node.scaleX(),
                  node.scaleY(),
                  node.rotation(),
                  (node.x() - stageCenterX) / displayScale,
                  (node.y() - stageCenterY) / displayScale,
                );
              }}
              onTransformEnd={(e) => {
                const node = e.target as Konva.Rect;
                onClipTransformEnd(
                  clip.id,
                  node.scaleX(),
                  node.scaleY(),
                  node.rotation(),
                  (node.x() - stageCenterX) / displayScale,
                  (node.y() - stageCenterY) / displayScale,
                );
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
            if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5)
              return oldBox;
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
