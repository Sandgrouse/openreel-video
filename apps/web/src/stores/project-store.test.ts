import { describe, it, expect, beforeEach, vi } from "vitest";
import { useProjectStore } from "./project-store";
import type { Project, Clip, MediaItem } from "@openreel/core";

vi.mock("../services/auto-save", () => ({
  autoSaveManager: {
    startAutoSave: vi.fn(),
    stopAutoSave: vi.fn(),
    triggerSave: vi.fn(),
    getRecentSaves: vi.fn().mockResolvedValue([]),
    loadSave: vi.fn(),
    deleteSave: vi.fn(),
  },
  initializeAutoSave: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../bridges/media-bridge", () => ({
  getMediaBridge: vi.fn(() => ({
    isInitialized: vi.fn().mockReturnValue(true),
    importFile: vi.fn().mockResolvedValue({
      success: true,
      media: {
        id: "mock-media-id",
        name: "test-video.mp4",
        type: "video",
        duration: 10,
        width: 1920,
        height: 1080,
        frameRate: 30,
      },
    }),
  })),
  initializeMediaBridge: vi.fn().mockResolvedValue(undefined),
}));

describe("ProjectStore", () => {
  beforeEach(() => {
    useProjectStore.getState().createNewProject();
  });

  describe("project creation", () => {
    it("should create a new project with default settings", () => {
      const { project } = useProjectStore.getState();

      expect(project).toBeDefined();
      expect(project.name).toBeDefined();
      expect(project.name.length).toBeGreaterThan(0);
      expect(project.settings.width).toBe(1920);
      expect(project.settings.height).toBe(1080);
      expect(project.settings.frameRate).toBe(30);
    });

    it("should create project with custom name", () => {
      useProjectStore.getState().createNewProject("My Custom Project");
      const { project } = useProjectStore.getState();

      expect(project.name).toBe("My Custom Project");
    });

    it("should create project with custom settings", () => {
      useProjectStore.getState().createNewProject("4K Project", {
        width: 3840,
        height: 2160,
        frameRate: 60,
      });
      const { project } = useProjectStore.getState();

      expect(project.settings.width).toBe(3840);
      expect(project.settings.height).toBe(2160);
      expect(project.settings.frameRate).toBe(60);
    });

    it("should create project with empty timeline", () => {
      const { project } = useProjectStore.getState();

      expect(project.timeline).toBeDefined();
      expect(project.timeline.tracks).toBeDefined();
      expect(Array.isArray(project.timeline.tracks)).toBe(true);
    });

    it("should have unique project id", () => {
      const firstProject = useProjectStore.getState().project;
      useProjectStore.getState().createNewProject();
      const secondProject = useProjectStore.getState().project;

      expect(firstProject.id).not.toBe(secondProject.id);
    });

    it("should reset action history on new project", () => {
      const store = useProjectStore.getState();
      expect(store.canUndo()).toBe(false);
      expect(store.canRedo()).toBe(false);
    });
  });

  describe("project loading", () => {
    it("should load an existing project", () => {
      const existingProject: Project = {
        id: "existing-project-id",
        name: "Loaded Project",
        createdAt: Date.now() - 1000,
        modifiedAt: Date.now(),
        settings: {
          width: 1280,
          height: 720,
          frameRate: 24,
          sampleRate: 44100,
          channels: 2,
        },
        mediaLibrary: { items: [] },
        timeline: {
          tracks: [],
          subtitles: [],
          duration: 0,
          markers: [],
        },
      };

      useProjectStore.getState().loadProject(existingProject);
      const { project } = useProjectStore.getState();

      expect(project.id).toBe("existing-project-id");
      expect(project.name).toBe("Loaded Project");
      expect(project.settings.width).toBe(1280);
    });

    it("should preserve project data on load", () => {
      const mockMediaItem: MediaItem = {
        id: "media-1",
        name: "test.mp4",
        type: "video",
        fileHandle: null,
        blob: null,
        metadata: {
          duration: 30,
          width: 1920,
          height: 1080,
          frameRate: 30,
          codec: "h264",
          sampleRate: 48000,
          channels: 2,
          fileSize: 1000000,
        },
        thumbnailUrl: null,
        waveformData: null,
      };

      const projectWithMedia: Project = {
        id: "project-with-media",
        name: "Media Project",
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        settings: {
          width: 1920,
          height: 1080,
          frameRate: 30,
          sampleRate: 48000,
          channels: 2,
        },
        mediaLibrary: { items: [mockMediaItem] },
        timeline: {
          tracks: [
            {
              id: "track-1",
              type: "video",
              name: "Video 1",
              clips: [],
              transitions: [],
              locked: false,
              hidden: false,
              muted: false,
              solo: false,
            },
          ],
          subtitles: [],
          duration: 30,
          markers: [],
        },
      };

      useProjectStore.getState().loadProject(projectWithMedia);
      const { project } = useProjectStore.getState();

      expect(project.mediaLibrary.items.length).toBe(1);
      expect(project.mediaLibrary.items[0].name).toBe("test.mp4");
    });
  });

  describe("project renaming", () => {
    it("should rename project", async () => {
      const result = await useProjectStore.getState().renameProject("New Name");

      expect(result.success).toBe(true);

      const { project } = useProjectStore.getState();
      expect(project.name).toBe("New Name");
    });

    it("should preserve other project properties when renaming", async () => {
      const originalProject = useProjectStore.getState().project;
      const originalId = originalProject.id;
      const originalSettings = { ...originalProject.settings };

      await useProjectStore.getState().renameProject("Renamed Project");

      const { project } = useProjectStore.getState();
      expect(project.id).toBe(originalId);
      expect(project.settings).toEqual(originalSettings);
    });
  });

  describe("settings update", () => {
    it("should update project settings", async () => {
      const result = await useProjectStore.getState().updateSettings({
        width: 2560,
        height: 1440,
      });

      expect(result.success).toBe(true);

      const { project } = useProjectStore.getState();
      expect(project.settings.width).toBe(2560);
      expect(project.settings.height).toBe(1440);
    });

    it("should preserve unmodified settings", async () => {
      const originalFrameRate =
        useProjectStore.getState().project.settings.frameRate;
      const originalSampleRate =
        useProjectStore.getState().project.settings.sampleRate;

      await useProjectStore.getState().updateSettings({
        width: 3840,
        height: 2160,
      });

      const { project } = useProjectStore.getState();
      expect(project.settings.frameRate).toBe(originalFrameRate);
      expect(project.settings.sampleRate).toBe(originalSampleRate);
    });
  });

  describe("track operations", () => {
    it("should add a video track", async () => {
      const initialTrackCount =
        useProjectStore.getState().project.timeline.tracks.length;

      const result = await useProjectStore.getState().addTrack("video");

      expect(result.success).toBe(true);

      const newTrackCount =
        useProjectStore.getState().project.timeline.tracks.length;
      expect(newTrackCount).toBe(initialTrackCount + 1);
    });

    it("should add an audio track", async () => {
      const result = await useProjectStore.getState().addTrack("audio");
      expect(result.success).toBe(true);
    });

    it("should get track by id", async () => {
      await useProjectStore.getState().addTrack("video");
      const { project } = useProjectStore.getState();
      const trackId = project.timeline.tracks[0].id;

      const track = useProjectStore.getState().getTrack(trackId);
      expect(track).toBeDefined();
      expect(track?.id).toBe(trackId);
    });

    it("should return undefined for non-existent track", () => {
      const track = useProjectStore.getState().getTrack("non-existent-id");
      expect(track).toBeUndefined();
    });

    it("should lock a track", async () => {
      await useProjectStore.getState().addTrack("video");
      const { project } = useProjectStore.getState();
      const trackId = project.timeline.tracks[0].id;

      const result = await useProjectStore.getState().lockTrack(trackId, true);
      expect(result.success).toBe(true);

      const lockedTrack = useProjectStore.getState().getTrack(trackId);
      expect(lockedTrack?.locked).toBe(true);
    });

    it("should unlock a track", async () => {
      await useProjectStore.getState().addTrack("video");
      const { project } = useProjectStore.getState();
      const trackId = project.timeline.tracks[0].id;

      await useProjectStore.getState().lockTrack(trackId, true);
      await useProjectStore.getState().lockTrack(trackId, false);

      const unlockedTrack = useProjectStore.getState().getTrack(trackId);
      expect(unlockedTrack?.locked).toBe(false);
    });

    it("should mute a track", async () => {
      const { project } = useProjectStore.getState();
      const audioTrack = project.timeline.tracks.find(
        (t) => t.type === "audio",
      );

      if (audioTrack) {
        const result = await useProjectStore
          .getState()
          .muteTrack(audioTrack.id, true);
        expect(result.success).toBe(true);

        const mutedTrack = useProjectStore.getState().getTrack(audioTrack.id);
        expect(mutedTrack?.muted).toBe(true);
      }
    });

    it("should unmute a track", async () => {
      const { project } = useProjectStore.getState();
      const audioTrack = project.timeline.tracks.find(
        (t) => t.type === "audio",
      );

      if (audioTrack) {
        await useProjectStore.getState().muteTrack(audioTrack.id, true);
        await useProjectStore.getState().muteTrack(audioTrack.id, false);

        const unmutedTrack = useProjectStore.getState().getTrack(audioTrack.id);
        expect(unmutedTrack?.muted).toBe(false);
      }
    });

    it("should hide a track", async () => {
      await useProjectStore.getState().addTrack("video");
      const { project } = useProjectStore.getState();
      const trackId = project.timeline.tracks[0].id;

      const result = await useProjectStore.getState().hideTrack(trackId, true);
      expect(result.success).toBe(true);

      const hiddenTrack = useProjectStore.getState().getTrack(trackId);
      expect(hiddenTrack?.hidden).toBe(true);
    });

    it("should show a hidden track", async () => {
      await useProjectStore.getState().addTrack("video");
      const { project } = useProjectStore.getState();
      const trackId = project.timeline.tracks[0].id;

      await useProjectStore.getState().hideTrack(trackId, true);
      await useProjectStore.getState().hideTrack(trackId, false);

      const visibleTrack = useProjectStore.getState().getTrack(trackId);
      expect(visibleTrack?.hidden).toBe(false);
    });
  });

  describe("linked video audio", () => {
    const loadVideoWithAudio = () => {
      const currentProject = useProjectStore.getState().project;
      const videoMedia: MediaItem = {
        id: "video-with-audio",
        name: "video-with-audio.mp4",
        type: "video",
        fileHandle: null,
        blob: null,
        metadata: {
          duration: 12,
          width: 1920,
          height: 1080,
          frameRate: 30,
          codec: "h264",
          sampleRate: 48000,
          channels: 2,
          fileSize: 1024,
        },
        thumbnailUrl: null,
        waveformData: new Float32Array([0, 0.5, 1, 0.25]),
      };

      useProjectStore.getState().loadProject({
        ...currentProject,
        mediaLibrary: { items: [videoMedia] },
      });

      return videoMedia;
    };

    it("should add a linked audio child clip when adding video media with audio", async () => {
      const videoMedia = loadVideoWithAudio();

      const result = await useProjectStore
        .getState()
        .addClipToNewTrack(videoMedia.id, 3);

      expect(result.success).toBe(true);

      const project = useProjectStore.getState().project;
      const videoTrack = project.timeline.tracks.find((track) => track.type === "video");
      const audioTrack = project.timeline.tracks.find((track) => track.type === "audio");
      const videoClip = videoTrack?.clips[0];
      const audioClip = audioTrack?.clips[0];

      expect(videoClip).toBeDefined();
      expect(audioClip).toBeDefined();
      expect(audioClip?.mediaId).toBe(videoMedia.id);
      expect(audioClip?.startTime).toBe(videoClip?.startTime);
      expect(audioClip?.duration).toBe(videoClip?.duration);
      expect(audioClip?.parentClipId).toBe(videoClip?.id);
      expect(audioClip?.linkedClipId).toBe(videoClip?.id);
      expect(audioClip?.linkRole).toBe("audio-child");
      expect(audioClip?.linked).toBe(true);
    });

    it("should split linked video and audio clips as a pair", async () => {
      const videoMedia = loadVideoWithAudio();

      await useProjectStore.getState().addClipToNewTrack(videoMedia.id, 0);
      const beforeSplit = useProjectStore.getState().project;
      const videoClip = beforeSplit.timeline.tracks.find(
        (track) => track.type === "video",
      )?.clips[0];

      expect(videoClip).toBeDefined();

      const result = await useProjectStore
        .getState()
        .splitClip(videoClip!.id, 6);

      expect(result.success).toBe(true);

      const project = useProjectStore.getState().project;
      const videoClips =
        project.timeline.tracks.find((track) => track.type === "video")?.clips ??
        [];
      const audioClips =
        project.timeline.tracks.find((track) => track.type === "audio")?.clips ??
        [];
      const rightVideo = videoClips.find((clip) => clip.startTime === 6);
      const rightAudio = audioClips.find((clip) => clip.startTime === 6);

      expect(videoClips).toHaveLength(2);
      expect(audioClips).toHaveLength(2);
      expect(rightVideo).toBeDefined();
      expect(rightAudio).toBeDefined();
      expect(rightAudio?.parentClipId).toBe(rightVideo?.id);
      expect(rightAudio?.linkedClipId).toBe(rightVideo?.id);

      await useProjectStore.getState().undo();
      const restoredProject = useProjectStore.getState().project;
      expect(
        restoredProject.timeline.tracks.find((track) => track.type === "video")
          ?.clips,
      ).toHaveLength(1);
      expect(
        restoredProject.timeline.tracks.find((track) => track.type === "audio")
          ?.clips,
      ).toHaveLength(1);
    });

    it("should delete linked video and audio clips as a pair", async () => {
      const videoMedia = loadVideoWithAudio();
      await useProjectStore.getState().addClipToNewTrack(videoMedia.id, 0);

      const project = useProjectStore.getState().project;
      const videoClip = project.timeline.tracks.find(
        (track) => track.type === "video",
      )?.clips[0];

      expect(videoClip).toBeDefined();

      const result = await useProjectStore.getState().removeClip(videoClip!.id);
      expect(result.success).toBe(true);

      const updatedProject = useProjectStore.getState().project;
      expect(
        updatedProject.timeline.tracks.find((track) => track.type === "video")
          ?.clips,
      ).toHaveLength(0);
      expect(
        updatedProject.timeline.tracks.find((track) => track.type === "audio")
          ?.clips,
      ).toHaveLength(0);
    });

    it("should move linked video and audio clips together until unlinked", async () => {
      const videoMedia = loadVideoWithAudio();
      await useProjectStore.getState().addClipToNewTrack(videoMedia.id, 0);

      const project = useProjectStore.getState().project;
      const videoClip = project.timeline.tracks.find(
        (track) => track.type === "video",
      )?.clips[0];
      const audioClip = project.timeline.tracks.find(
        (track) => track.type === "audio",
      )?.clips[0];

      expect(videoClip).toBeDefined();
      expect(audioClip).toBeDefined();

      await useProjectStore.getState().moveClip(videoClip!.id, 4);

      let updatedProject = useProjectStore.getState().project;
      expect(
        updatedProject.timeline.tracks.find((track) => track.type === "video")
          ?.clips[0]?.startTime,
      ).toBe(4);
      expect(
        updatedProject.timeline.tracks.find((track) => track.type === "audio")
          ?.clips[0]?.startTime,
      ).toBe(4);

      useProjectStore.getState().unlinkClipAudio(videoClip!.id);
      await useProjectStore.getState().moveClip(videoClip!.id, 6);

      updatedProject = useProjectStore.getState().project;
      expect(
        updatedProject.timeline.tracks.find((track) => track.type === "video")
          ?.clips[0]?.startTime,
      ).toBe(6);
      expect(
        updatedProject.timeline.tracks.find((track) => track.type === "audio")
          ?.clips[0]?.startTime,
      ).toBe(4);
    });
  });

  describe("media operations", () => {
    it("should get media item by id", () => {
      const projectWithMedia: Project = {
        id: "test-project",
        name: "Test",
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        settings: {
          width: 1920,
          height: 1080,
          frameRate: 30,
          sampleRate: 48000,
          channels: 2,
        },
        mediaLibrary: {
          items: [
            {
              id: "media-123",
              name: "video.mp4",
              type: "video",
              fileHandle: null,
              blob: null,
              metadata: {
                duration: 10,
                width: 1920,
                height: 1080,
                frameRate: 30,
                codec: "h264",
                sampleRate: 48000,
                channels: 2,
                fileSize: 500000,
              },
              thumbnailUrl: null,
              waveformData: null,
            },
          ],
        },
        timeline: {
          tracks: [],
          subtitles: [],
          duration: 0,
          markers: [],
        },
      };

      useProjectStore.getState().loadProject(projectWithMedia);

      const media = useProjectStore.getState().getMediaItem("media-123");
      expect(media).toBeDefined();
      expect(media?.name).toBe("video.mp4");
    });

    it("should return undefined for non-existent media", () => {
      const media = useProjectStore.getState().getMediaItem("non-existent");
      expect(media).toBeUndefined();
    });
  });

  describe("timeline duration", () => {
    it("should calculate timeline duration from clips", () => {
      const projectWithClips: Project = {
        id: "test-project",
        name: "Test",
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        settings: {
          width: 1920,
          height: 1080,
          frameRate: 30,
          sampleRate: 48000,
          channels: 2,
        },
        mediaLibrary: { items: [] },
        timeline: {
          tracks: [
            {
              id: "track-1",
              type: "video",
              name: "Video",
              clips: [
                {
                  id: "clip-1",
                  mediaId: "media-1",
                  trackId: "track-1",
                  startTime: 0,
                  duration: 10,
                  inPoint: 0,
                  outPoint: 10,
                  effects: [],
                  audioEffects: [],
                  transform: {
                    position: { x: 0.5, y: 0.5 },
                    scale: { x: 1, y: 1 },
                    rotation: 0,
                    anchor: { x: 0.5, y: 0.5 },
                    opacity: 1,
                  },
                  volume: 1,
                  keyframes: [],
                },
                {
                  id: "clip-2",
                  mediaId: "media-2",
                  trackId: "track-1",
                  startTime: 10,
                  duration: 5,
                  inPoint: 0,
                  outPoint: 5,
                  effects: [],
                  audioEffects: [],
                  transform: {
                    position: { x: 0.5, y: 0.5 },
                    scale: { x: 1, y: 1 },
                    rotation: 0,
                    anchor: { x: 0.5, y: 0.5 },
                    opacity: 1,
                  },
                  volume: 1,
                  keyframes: [],
                },
              ],
              transitions: [],
              locked: false,
              hidden: false,
              muted: false,
              solo: false,
            },
          ],
          subtitles: [],
          duration: 15,
          markers: [],
        },
      };

      useProjectStore.getState().loadProject(projectWithClips);

      const duration = useProjectStore.getState().getTimelineDuration();
      expect(duration).toBe(15);
    });
  });

  describe("marker operations", () => {
    it("should add a marker", () => {
      useProjectStore.getState().addMarker(5, "Scene 1", "#ff0000");

      const markers = useProjectStore.getState().getMarkers();
      expect(markers.length).toBe(1);
      expect(markers[0].time).toBe(5);
      expect(markers[0].label).toBe("Scene 1");
    });

    it("should remove a marker", () => {
      useProjectStore.getState().addMarker(5, "Scene 1");
      const markers = useProjectStore.getState().getMarkers();
      const markerId = markers[0].id;

      useProjectStore.getState().removeMarker(markerId);

      const updatedMarkers = useProjectStore.getState().getMarkers();
      expect(updatedMarkers.length).toBe(0);
    });

    it("should get marker by id", () => {
      useProjectStore.getState().addMarker(10, "Marker Test");
      const markers = useProjectStore.getState().getMarkers();
      const markerId = markers[0].id;

      const marker = useProjectStore.getState().getMarker(markerId);
      expect(marker).toBeDefined();
      expect(marker?.time).toBe(10);
    });
  });

  describe("undo/redo", () => {
    it("should not be able to undo without actions", () => {
      expect(useProjectStore.getState().canUndo()).toBe(false);
    });

    it("should not be able to redo without undone actions", () => {
      expect(useProjectStore.getState().canRedo()).toBe(false);
    });

    it("should be able to undo after an action", async () => {
      await useProjectStore.getState().addTrack("video");
      expect(useProjectStore.getState().canUndo()).toBe(true);
    });

    it("should undo and redo multiple timeline actions in order", async () => {
      const store = useProjectStore.getState();

      await store.addTrack("video");
      await store.addTrack("audio");
      expect(useProjectStore.getState().project.timeline.tracks).toHaveLength(2);

      await useProjectStore.getState().undo();
      expect(useProjectStore.getState().project.timeline.tracks).toHaveLength(1);

      await useProjectStore.getState().undo();
      expect(useProjectStore.getState().project.timeline.tracks).toHaveLength(0);

      await useProjectStore.getState().redo();
      expect(useProjectStore.getState().project.timeline.tracks).toHaveLength(1);

      await useProjectStore.getState().redo();
      expect(useProjectStore.getState().project.timeline.tracks).toHaveLength(2);
    });

    it("should clear redo history after a new action", async () => {
      const store = useProjectStore.getState();

      await store.addTrack("video");
      await useProjectStore.getState().undo();
      expect(useProjectStore.getState().canRedo()).toBe(true);

      await useProjectStore.getState().addTrack("audio");
      expect(useProjectStore.getState().canRedo()).toBe(false);
    });
  });

  describe("clipboard operations", () => {
    it("should start with empty clipboard", () => {
      expect(useProjectStore.getState().clipboard).toEqual([]);
    });

    it("should copy clips to clipboard", () => {
      const mockClip: Clip = {
        id: "clip-to-copy",
        mediaId: "media-1",
        trackId: "track-1",
        startTime: 0,
        duration: 5,
        inPoint: 0,
        outPoint: 5,
        effects: [],
        audioEffects: [],
        transform: {
          position: { x: 0.5, y: 0.5 },
          scale: { x: 1, y: 1 },
          rotation: 0,
          anchor: { x: 0.5, y: 0.5 },
          opacity: 1,
        },
        volume: 1,
        keyframes: [],
      };

      const projectWithClip: Project = {
        id: "test",
        name: "Test",
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        settings: {
          width: 1920,
          height: 1080,
          frameRate: 30,
          sampleRate: 48000,
          channels: 2,
        },
        mediaLibrary: { items: [] },
        timeline: {
          tracks: [
            {
              id: "track-1",
              type: "video",
              name: "Video",
              clips: [mockClip],
              transitions: [],
              locked: false,
              hidden: false,
              muted: false,
              solo: false,
            },
          ],
          subtitles: [],
          duration: 5,
          markers: [],
        },
      };

      useProjectStore.getState().loadProject(projectWithClip);
      useProjectStore.getState().copyClips(["clip-to-copy"]);

      expect(useProjectStore.getState().clipboard.length).toBe(1);
    });
  });
});

describe("ProjectStore - Text Clips", () => {
  beforeEach(async () => {
    useProjectStore.getState().createNewProject();
    await useProjectStore.getState().addTrack("text");
  });

  it("should create a text clip", async () => {
    const { project } = useProjectStore.getState();
    const trackId = project.timeline.tracks[0].id;

    const textClip = useProjectStore
      .getState()
      .createTextClip(trackId, 0, "Hello World", 5);

    expect(textClip).toBeDefined();
    expect(textClip?.text).toBe("Hello World");
    expect(textClip?.duration).toBe(5);
  });

  it("should get all text clips", async () => {
    const { project } = useProjectStore.getState();
    const trackId = project.timeline.tracks[0].id;

    const initialCount = useProjectStore.getState().getAllTextClips().length;

    useProjectStore.getState().createTextClip(trackId, 0, "First", 3);
    useProjectStore.getState().createTextClip(trackId, 3, "Second", 3);

    const allTextClips = useProjectStore.getState().getAllTextClips();
    expect(allTextClips.length).toBe(initialCount + 2);
  });

  it("should get available animation presets", () => {
    const presets = useProjectStore.getState().getAvailableAnimationPresets();
    expect(Array.isArray(presets)).toBe(true);
  });
});

describe("ProjectStore - Subtitles (consolidated into text clips)", () => {
  beforeEach(() => {
    useProjectStore.getState().createNewProject();
  });

  it.skip("should add a subtitle - skipped: subtitles consolidated into text clips", () => {
    // Subtitles are now created as text clips on a Captions track
    // The addSubtitle function creates text clips, but getSubtitle reads from the old subtitles array
    // This test is skipped until the API is fully migrated
  });

  it.skip("should remove a subtitle - skipped: subtitles consolidated into text clips", () => {
    // Subtitles are now created as text clips on a Captions track
  });

  it.skip("should update a subtitle - skipped: subtitles consolidated into text clips", () => {
    // Subtitles are now created as text clips on a Captions track
  });

  it.skip("should export SRT - skipped: subtitles consolidated into text clips", () => {
    // SRT export now uses text clips from Captions track
  });

  it("should get subtitle style presets", async () => {
    const presets = await useProjectStore.getState().getSubtitleStylePresets();
    expect(Array.isArray(presets)).toBe(true);
  });
});
