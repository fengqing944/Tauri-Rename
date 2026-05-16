import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

export function useWindowStatePersistence() {
  useEffect(() => {
    const appWindow = getCurrentWindow();
    let lastSnapshot = "";
    let disposed = false;
    let unlistenMove: (() => void) | undefined;
    let unlistenResize: (() => void) | undefined;
    let unlistenClose: (() => void) | undefined;
    let saveTimer: number | undefined;

    const saveIfChanged = async () => {
      try {
        const [position, size, maximized] = await Promise.all([
          appWindow.outerPosition(),
          appWindow.outerSize(),
          appWindow.isMaximized(),
        ]);
        const nextSnapshot = `${position.x}:${position.y}:${size.width}:${size.height}:${maximized}`;

        if (nextSnapshot === lastSnapshot) {
          return;
        }

        lastSnapshot = nextSnapshot;
        await invoke("save_main_window_state");
      } catch {
        // Window state is best-effort; the app should still work if saving fails.
      }
    };

    const scheduleSave = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(saveIfChanged, 250);
    };

    saveIfChanged();
    const interval = window.setInterval(saveIfChanged, 1500);

    appWindow.onMoved(scheduleSave).then((dispose) => {
      if (disposed) {
        dispose();
      } else {
        unlistenMove = dispose;
      }
    });

    appWindow.onResized(scheduleSave).then((dispose) => {
      if (disposed) {
        dispose();
      } else {
        unlistenResize = dispose;
      }
    });

    appWindow
      .onCloseRequested(async () => {
        await invoke("save_main_window_state").catch(() => undefined);
      })
      .then((dispose) => {
        if (disposed) {
          dispose();
        } else {
          unlistenClose = dispose;
        }
      });

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.clearTimeout(saveTimer);
      unlistenMove?.();
      unlistenResize?.();
      unlistenClose?.();
    };
  }, []);
}
