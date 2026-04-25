# Tauri Rename

Rename Studio is a Tauri 2 desktop tool for batch folder classification, file moving, and safe renaming.

## Features

- Drag folders into the app window.
- Switch between single-folder and multi-folder processing.
- Use folder naming presets for image, video, GIF, and text categories.
- Map existing directories, for example `Pic` to `图包`.
- Keep special directories in place and only rename their files.
- Copy selected image, GIF, or TXT files into each processed root folder.
- Show concise operation logs in the app and write log files to the app log directory.
- Preview operations before applying them.
- Restore saved presets, mappings, special directories, supplemental files, and rename settings.
- Restore the previous window size and position on launch.

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```
