import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore, type PanelId, type PanelState } from "./ui-store";

const resetPanels = () => {
  const panels: Record<PanelId, PanelState> = {
    mediaLibrary: { visible: true, width: 300 },
    inspector: { visible: true, width: 300 },
    timeline: { visible: true, height: 320 },
    effects: { visible: false, width: 300 },
    audioMixer: { visible: false, width: 300 },
    colorGrading: { visible: false, width: 400 },
    subtitles: { visible: false, width: 300 },
  };

  useUIStore.setState({
    panels,
    selectedItems: [],
    lastSelectedItem: null,
  });
};

describe("useUIStore panel layout", () => {
  beforeEach(() => {
    localStorage.clear();
    resetPanels();
  });

  it("toggles panel visibility without losing stored size", () => {
    useUIStore.getState().setPanelWidth("mediaLibrary", 420);
    useUIStore.getState().setPanelVisible("mediaLibrary", false);

    expect(useUIStore.getState().panels.mediaLibrary.visible).toBe(false);
    expect(useUIStore.getState().panels.mediaLibrary.width).toBe(420);

    useUIStore.getState().setPanelVisible("mediaLibrary", true);
    expect(useUIStore.getState().panels.mediaLibrary.visible).toBe(true);
    expect(useUIStore.getState().panels.mediaLibrary.width).toBe(420);
  });

  it("clamps side panel widths to the editor bounds", () => {
    useUIStore.getState().setPanelWidth("mediaLibrary", 120);
    useUIStore.getState().setPanelWidth("inspector", 900);

    expect(useUIStore.getState().panels.mediaLibrary.width).toBe(240);
    expect(useUIStore.getState().panels.inspector.width).toBe(560);
  });

  it("clamps timeline height and preserves maximized state separately", () => {
    useUIStore.getState().setPanelHeight("timeline", 100);
    expect(useUIStore.getState().panels.timeline.height).toBe(180);

    useUIStore.getState().setPanelHeight("timeline", 360);
    useUIStore.getState().setPanelMaximized("timeline", true);

    expect(useUIStore.getState().panels.timeline.height).toBe(360);
    expect(useUIStore.getState().panels.timeline.maximized).toBe(true);

    useUIStore.getState().setPanelMaximized("timeline", false);
    expect(useUIStore.getState().panels.timeline.height).toBe(360);
    expect(useUIStore.getState().panels.timeline.maximized).toBe(false);
  });

  it("only allows one panel to be maximized at a time", () => {
    useUIStore.getState().setPanelMaximized("mediaLibrary", true);
    useUIStore.getState().setPanelMaximized("inspector", true);

    expect(useUIStore.getState().panels.mediaLibrary.maximized).toBe(false);
    expect(useUIStore.getState().panels.inspector.maximized).toBe(true);
  });
});
