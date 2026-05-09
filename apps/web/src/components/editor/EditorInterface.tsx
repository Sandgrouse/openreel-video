import React, { useEffect, useState } from "react";

import { Toolbar } from "./Toolbar";
import { AssetsPanel } from "./AssetsPanel";
import { Preview } from "./Preview";
import { InspectorPanel } from "./InspectorPanel";
import { Timeline } from "./Timeline";
import { KeyframeEditorPanel } from "./KeyframeEditorPanel";
import { AudioMixer } from "../audio-mixer";
import { KeyboardShortcutsOverlay } from "./KeyboardShortcutsOverlay";
import { PanelErrorBoundary } from "../ErrorBoundary";
import { ResizableHandle } from "./ResizableHandle";
import { SpotlightTour, MoGraphTour } from "./tour";
import { useProjectStore } from "../../stores/project-store";
import { useUIStore } from "../../stores/ui-store";
import { useEngineStore } from "../../stores/engine-store";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import {
  initializePlaybackBridge,
  disposePlaybackBridge,
} from "../../bridges/playback-bridge";
import {
  initializeMediaBridge,
  disposeMediaBridge,
} from "../../bridges/media-bridge";
import {
  initializeRenderBridge,
  disposeRenderBridge,
} from "../../bridges/render-bridge";
import {
  initializeEffectsBridge,
  disposeEffectsBridge,
} from "../../bridges/effects-bridge";
import {
  initializeTransitionBridge,
  disposeTransitionBridge,
} from "../../bridges/transition-bridge";
import { PanelLeftOpen, PanelRightOpen } from "lucide-react";

/**
 * Auto-save initialization hook
 */
const useAutoSave = () => {
  const { initializeAutoSave } = useProjectStore();

  useEffect(() => {
    initializeAutoSave().catch(console.error);
  }, [initializeAutoSave]);
};

/**
 * Engine and bridge initialization hook
 * Ensures all engines and bridges are fully initialized before rendering editor
 */
const useEngineInitialization = () => {
  const { initialize, initialized, initializing, initError } = useEngineStore();
  const [bridgesReady, setBridgesReady] = useState(false);
  const [initStatus, setInitStatus] = useState("Starting...");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initAll = async () => {
      try {
        const currentState = useEngineStore.getState();
        if (!currentState.initialized && !currentState.initializing) {
          setInitStatus("Initializing video engine...");
          await initialize();
        } else if (currentState.initializing) {
          await new Promise<void>((resolve) => {
            const unsubscribe = useEngineStore.subscribe((state) => {
              if (state.initialized || state.initError) {
                unsubscribe();
                resolve();
              }
            });
          });
        }

        if (!isMounted) return;

        const engineState = useEngineStore.getState();
        if (!engineState.initialized) {
          throw new Error(
            engineState.initError || "Engine initialization failed",
          );
        }

        setInitStatus("Initializing media bridge...");
        await initializeMediaBridge();
        if (!isMounted) return;

        setInitStatus("Initializing playback bridge...");
        await initializePlaybackBridge();
        if (!isMounted) return;

        setInitStatus("Initializing render bridge...");
        await initializeRenderBridge();
        if (!isMounted) return;

        setInitStatus("Initializing effects bridge...");
        const projectState = useProjectStore.getState();
        const { width, height } = projectState.project.settings;
        try {
          await initializeEffectsBridge(width, height);
        } catch (effectsError) {
          console.error(
            "[EditorInterface] EffectsBridge initialization failed:",
            effectsError,
          );
        }
        if (!isMounted) return;

        setInitStatus("Initializing transition bridge...");
        try {
          initializeTransitionBridge(width, height);
        } catch (transitionError) {
          console.error(
            "[EditorInterface] TransitionBridge initialization failed:",
            transitionError,
          );
        }
        if (!isMounted) return;

        setBridgesReady(true);
      } catch (error) {
        console.error("Failed to initialize engines/bridges:", error);
        if (isMounted) {
          setLocalError(
            error instanceof Error ? error.message : "Unknown error",
          );
          setInitStatus(
            `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }
    };

    initAll();

    return () => {
      isMounted = false;
      disposePlaybackBridge();
      disposeMediaBridge();
      disposeRenderBridge();
      disposeEffectsBridge();
      disposeTransitionBridge();
    };
  }, [initialize, initialized, initializing]);

  return {
    initialized: initialized && bridgesReady,
    initializing: initializing || (!bridgesReady && initialized),
    initError: initError || localError,
    initStatus,
  };
};

/**
 * Main Editor Interface Component
 */
export const EditorInterface: React.FC = () => {
  const { initialized, initializing, initError, initStatus } =
    useEngineInitialization();

  const { showShortcutsOverlay, setShowShortcutsOverlay } =
    useKeyboardShortcuts();
  useAutoSave();

  const {
    keyframeEditorOpen,
    setKeyframeEditorOpen,
    getSelectedClipIds,
    panels,
    setPanelVisible,
    setPanelWidth,
    setPanelHeight,
  } = useUIStore();
  const { project, updateClipKeyframes } = useProjectStore();
  const tracks = project.timeline.tracks;

  const [selectedKeyframeIds, setSelectedKeyframeIds] = React.useState<string[]>([]);
  const [copiedKeyframes, setCopiedKeyframes] = React.useState<import("@openreel/core").Keyframe[]>([]);

  const selectedClip = React.useMemo(() => {
    const selectedIds = getSelectedClipIds();
    if (selectedIds.length === 0) return null;
    const clipId = selectedIds[0];
    for (const track of tracks) {
      const clip = track.clips.find((c) => c.id === clipId);
      if (clip) return clip;
    }
    return null;
  }, [getSelectedClipIds, tracks]);

  const handleUpdateKeyframe = React.useCallback(
    (keyframeId: string, updates: Partial<import("@openreel/core").Keyframe>) => {
      if (!selectedClip?.keyframes) return;
      const keyframes = selectedClip.keyframes.map((kf) =>
        kf.id === keyframeId ? { ...kf, ...updates } : kf
      );
      updateClipKeyframes(selectedClip.id, keyframes);
    },
    [selectedClip, updateClipKeyframes]
  );

  const handleDeleteKeyframe = React.useCallback(
    (keyframeId: string) => {
      if (!selectedClip?.keyframes) return;
      const keyframes = selectedClip.keyframes.filter((kf) => kf.id !== keyframeId);
      updateClipKeyframes(selectedClip.id, keyframes);
      setSelectedKeyframeIds((prev) => prev.filter((id) => id !== keyframeId));
    },
    [selectedClip, updateClipKeyframes]
  );

  const handleCopyKeyframes = React.useCallback(
    (keyframeIds: string[]) => {
      if (!selectedClip?.keyframes) return;
      const toCopy = selectedClip.keyframes.filter((kf) => keyframeIds.includes(kf.id));
      setCopiedKeyframes(toCopy);
    },
    [selectedClip]
  );

  const handlePasteKeyframes = React.useCallback(
    (clipId: string, time: number) => {
      const targetClip = tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
      if (!targetClip) return;
      const newKeyframes = copiedKeyframes.map((kf) => ({
        ...kf,
        id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        time: kf.time + time,
      }));
      updateClipKeyframes(clipId, [...(targetClip.keyframes || []), ...newKeyframes]);
    },
    [copiedKeyframes, tracks, updateClipKeyframes]
  );

  const handleSelectKeyframe = React.useCallback(
    (keyframeId: string, addToSelection: boolean) => {
      if (addToSelection) {
        setSelectedKeyframeIds((prev) =>
          prev.includes(keyframeId)
            ? prev.filter((id) => id !== keyframeId)
            : [...prev, keyframeId]
        );
      } else {
        setSelectedKeyframeIds([keyframeId]);
      }
    },
    []
  );

  const mediaPanel = panels.mediaLibrary;
  const inspectorPanel = panels.inspector;
  const timelinePanel = panels.timeline;
  const timelineMaximized = timelinePanel?.maximized ?? false;
  const mediaVisible =
    Boolean(mediaPanel?.visible) &&
    !timelineMaximized &&
    !inspectorPanel?.maximized;
  const inspectorVisible =
    Boolean(inspectorPanel?.visible) &&
    !timelineMaximized &&
    !mediaPanel?.maximized;
  const workspaceVisible = !timelineMaximized;
  const timelineHeight = timelinePanel?.height ?? 320;
  const mediaWidth = mediaPanel?.maximized ? 560 : mediaPanel?.width ?? 300;
  const inspectorWidth = inspectorPanel?.maximized
    ? 560
    : inspectorPanel?.width ?? 300;

  if (initializing || !initialized) {
    return (
      <div className="w-full h-full bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary text-sm">Initializing editor...</p>
          <p className="text-text-muted text-xs mt-2">{initStatus}</p>
          {initError && (
            <p className="text-red-500 text-xs mt-2">{initError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden font-sans select-none relative z-20 text-xs text-text-secondary">
      {/* Main App Toolbar */}
      <Toolbar />

      {/* Workspace Area */}
      {workspaceVisible && (
        <div className="flex-1 flex overflow-hidden relative">
          {!mediaVisible && (
            <button
              className="absolute left-3 top-3 z-30 flex items-center gap-1.5 rounded-lg border border-border bg-background-secondary px-2.5 py-1.5 text-[11px] font-medium text-text-secondary shadow-lg transition-colors hover:bg-background-elevated hover:text-text-primary"
              onClick={() => setPanelVisible("mediaLibrary", true)}
              type="button"
            >
              <PanelLeftOpen size={14} />
              Assets
            </button>
          )}

          {mediaVisible && (
            <>
              <div
                className="shrink-0 min-w-0"
                style={{ width: mediaWidth }}
              >
                <PanelErrorBoundary name="Assets Panel">
                  <AssetsPanel />
                </PanelErrorBoundary>
              </div>
              <ResizableHandle
                ariaLabel="Resize assets panel"
                axis="horizontal"
                onResize={(delta) =>
                  setPanelWidth("mediaLibrary", mediaWidth + delta)
                }
              />
            </>
          )}

          <PanelErrorBoundary name="Preview">
            <Preview />
          </PanelErrorBoundary>

          {inspectorVisible && (
            <>
              <ResizableHandle
                ariaLabel="Resize inspector panel"
                axis="horizontal"
                onResize={(delta) =>
                  setPanelWidth("inspector", inspectorWidth - delta)
                }
              />
              <div
                className="shrink-0 min-w-0"
                style={{ width: inspectorWidth }}
              >
                <PanelErrorBoundary name="Inspector">
                  <InspectorPanel />
                </PanelErrorBoundary>
              </div>
            </>
          )}

          {!inspectorVisible && (
            <button
              className="absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-lg border border-border bg-background-secondary px-2.5 py-1.5 text-[11px] font-medium text-text-secondary shadow-lg transition-colors hover:bg-background-elevated hover:text-text-primary"
              onClick={() => setPanelVisible("inspector", true)}
              type="button"
            >
              Inspector
              <PanelRightOpen size={14} />
            </button>
          )}

          {keyframeEditorOpen && (
            <PanelErrorBoundary name="Keyframe Editor">
              <KeyframeEditorPanel
                clip={selectedClip}
                onClose={() => setKeyframeEditorOpen(false)}
                onUpdateKeyframe={handleUpdateKeyframe}
                onDeleteKeyframe={handleDeleteKeyframe}
                onCopyKeyframes={handleCopyKeyframes}
                onPasteKeyframes={handlePasteKeyframes}
                selectedKeyframeIds={selectedKeyframeIds}
                onSelectKeyframe={handleSelectKeyframe}
                copiedKeyframes={copiedKeyframes}
              />
            </PanelErrorBoundary>
          )}
        </div>
      )}

      {!timelineMaximized && (
        <ResizableHandle
          ariaLabel="Resize timeline"
          axis="vertical"
          onResize={(delta) => setPanelHeight("timeline", timelineHeight - delta)}
        />
      )}

      {/* Audio Mixer (when open) */}
      {panels.audioMixer?.visible && (
        <PanelErrorBoundary name="Audio Mixer">
          <AudioMixer
            visible
            onClose={() => setPanelVisible("audioMixer", false)}
          />
        </PanelErrorBoundary>
      )}

      {/* BOTTOM PANEL: Timeline */}
      <div
        style={timelineMaximized ? undefined : { height: timelineHeight }}
        className={`${timelineMaximized ? "flex-1" : "shrink-0"} flex flex-col`}
      >
        <PanelErrorBoundary name="Timeline">
          <Timeline />
        </PanelErrorBoundary>
      </div>

      <KeyboardShortcutsOverlay
        isOpen={showShortcutsOverlay}
        onClose={() => setShowShortcutsOverlay(false)}
      />

      <SpotlightTour />
      <MoGraphTour />
    </div>
  );
};

export default EditorInterface;
