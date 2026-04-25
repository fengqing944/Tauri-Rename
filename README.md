# Tauri Rename / Rename Studio

## 中文

Rename Studio 是一个基于 Tauri 2 的桌面批量整理工具，用于文件夹自动分类、目录映射、文件移动、复制补充文件和安全重命名。

### 功能

- 支持拖拽文件夹到窗口中。
- 支持单文件夹模式和多文件夹模式。
- 自动按文件类型创建分类目录，例如图包、视频、GIF、文本。
- 支持目录映射，例如将 `Pic`、`Images` 等目录映射为 `图包`。
- 支持特殊目录，这些目录只做重命名，不移动到分类目录中。
- 支持复制补充文件，图片、GIF、TXT 会复制到处理根目录。
- 补充文件、命名模板、目录映射、特殊目录、勾选项等设置会自动保存。
- 支持倒序重命名，适合最后一张才是开头的图包。
- 支持预览模式，执行前查看将要发生的操作。
- 应用内显示简洁日志，并将日志文件写入应用日志目录。
- 自动恢复上次窗口大小和位置。

### 日志位置

处理完成后，日志页会显示本次日志文件的完整路径。日志写入 Tauri 的应用日志目录，不会放到你正在处理的文件夹中。

### 开发

```bash
npm install
npm run tauri dev
```

### 构建

```bash
npm run tauri build
```

## English

Rename Studio is a Tauri 2 desktop batch organization tool for automatic file classification, directory mapping, file moving, supplemental file copying, and safe renaming.

### Features

- Drag folders into the app window.
- Switch between single-folder and multi-folder processing.
- Automatically create category folders for images, videos, GIFs, and text files.
- Map existing folders, for example `Pic` or `Images` to `图包`.
- Mark special folders so their files are renamed in place without being moved.
- Copy selected supplemental image, GIF, or TXT files into the processed root folder.
- Persist supplemental files, rename templates, directory mappings, special folders, toggles, and numbering settings.
- Reverse rename order for packs where the last file should become the first numbered file.
- Preview operations before applying them.
- Show concise logs in the app and write log files to the app log directory.
- Restore the previous window size and position on launch.

### Log Files

After processing, the log tab shows the full path of the generated log file. Logs are written to Tauri's app log directory and are not stored inside the folder being processed.

### Development

```bash
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```
