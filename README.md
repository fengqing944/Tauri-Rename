# Tauri Rename

Rename Studio is a Tauri 2 desktop tool for batch folder classification, file moving, and safe renaming.

## Features

- Drag folders into the app window.
- Switch between single-folder and multi-folder processing.
- Use folder naming presets for image, video, GIF, and text categories.
- Map existing directories, for example `Pic` to `图包`.
- Keep special directories in place and only rename their files.
- Copy selected image, GIF, or TXT files into each processed root folder.
- Write operation logs to the processed root folder.
- Preview operations before applying them.

## Default Flow

For a folder like `蠢沫沫 情人节`, loose images are moved into `图包`, videos into `视频`, and `.gif` files into `GIF`. Files are then renamed using the configured template, such as `{folder}_{category}_{index}`.

If the folder only contains images, only the image category directory is created.

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```
