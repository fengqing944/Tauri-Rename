import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

export function useTauriDragDrop(onDrop: (paths: string[]) => void) {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    getCurrentWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          onDrop(event.payload.paths);
        }
      })
      .then((dispose) => {
        unlisten = dispose;
      })
      .catch(() => undefined);

    return () => {
      unlisten?.();
    };
  }, [onDrop]);
}
