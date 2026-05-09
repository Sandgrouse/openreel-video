import { beforeEach, describe, expect, it } from "vitest";
import { useTimelineStore, ZOOM_PRESETS } from "./timeline-store";

describe("useTimelineStore zoom", () => {
  beforeEach(() => {
    useTimelineStore.setState({
      pixelsPerSecond: ZOOM_PRESETS.DEFAULT,
      viewportWidth: 800,
      scrollX: 120,
    });
  });

  it("clamps manual zoom to the expanded timeline range", () => {
    useTimelineStore.getState().setZoom(0.001);
    expect(useTimelineStore.getState().pixelsPerSecond).toBe(ZOOM_PRESETS.MIN);

    useTimelineStore.getState().setZoom(99999);
    expect(useTimelineStore.getState().pixelsPerSecond).toBe(ZOOM_PRESETS.MAX);
  });

  it("zooms to fit long timelines below the old 10px/s floor", () => {
    useTimelineStore.getState().zoomToFit(10000);

    expect(useTimelineStore.getState().pixelsPerSecond).toBeCloseTo(0.07);
    expect(useTimelineStore.getState().scrollX).toBe(0);
  });

  it("keeps zoom-to-fit usable for extremely long projects", () => {
    useTimelineStore.getState().zoomToFit(1_000_000);

    expect(useTimelineStore.getState().pixelsPerSecond).toBe(ZOOM_PRESETS.MIN);
  });
});
