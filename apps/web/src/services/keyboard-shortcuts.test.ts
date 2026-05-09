import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { keyboardShortcuts } from "./keyboard-shortcuts";

const dispatchKey = (
  target: EventTarget,
  key: string,
  options: {
    code?: string;
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  } = {},
) => {
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      code: options.code ?? key,
      bubbles: true,
      cancelable: true,
      ...options,
    }),
  );
};

describe("keyboardShortcuts", () => {
  beforeEach(() => {
    localStorage.clear();
    keyboardShortcuts.resetAllShortcuts();
    keyboardShortcuts.stopListening();
  });

  afterEach(() => {
    keyboardShortcuts.stopListening();
  });

  it("fires the delete action for Delete and Backspace", () => {
    const handler = vi.fn();
    const unsubscribe = keyboardShortcuts.registerHandler(
      "editing.delete",
      handler,
    );
    keyboardShortcuts.startListening();

    dispatchKey(window, "Delete", { code: "Delete" });
    dispatchKey(window, "Backspace", { code: "Backspace" });

    expect(handler).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("does not fire shortcuts while typing in form controls", () => {
    const handler = vi.fn();
    const unsubscribe = keyboardShortcuts.registerHandler(
      "editing.split",
      handler,
    );
    const input = document.createElement("input");
    document.body.appendChild(input);
    keyboardShortcuts.startListening();

    dispatchKey(input, "s", { code: "KeyS" });

    expect(handler).not.toHaveBeenCalled();
    input.remove();
    unsubscribe();
  });

  it("does not fire shortcuts inside dialogs", () => {
    const handler = vi.fn();
    const unsubscribe = keyboardShortcuts.registerHandler(
      "playback.playPause",
      handler,
    );
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    keyboardShortcuts.startListening();

    dispatchKey(dialog, " ", { code: "Space" });

    expect(handler).not.toHaveBeenCalled();
    dialog.remove();
    unsubscribe();
  });
});
