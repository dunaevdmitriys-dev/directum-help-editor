const { contextBridge, ipcRenderer } = require('electron');

// Безопасный API для renderer процесса
contextBridge.exposeInMainWorld('api', {
  // Файловые операции
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  listFiles: (dirPath, extension) => ipcRenderer.invoke('list-files', dirPath, extension),
  listFilesRecursive: (dirPath, extensions) => ipcRenderer.invoke('list-files-recursive', dirPath, extensions),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),

  // Проект
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  getProjectPath: () => ipcRenderer.invoke('get-project-path'),
  createProject: (options) => ipcRenderer.invoke('create-project', options),
  selectProjectFolder: () => ipcRenderer.invoke('select-project-folder'),

  // Диалоги
  showConfirm: (message, title) => ipcRenderer.invoke('show-confirm', message, title),
  showMessage: (message, type, title) => ipcRenderer.invoke('show-message', message, type, title),
  selectImage: () => ipcRenderer.invoke('select-image'),
  selectVideo: () => ipcRenderer.invoke('select-video'),
  selectHtmlFile: () => ipcRenderer.invoke('select-html-file'),
  selectCssFiles: () => ipcRenderer.invoke('select-css-files'),
  selectImages: () => ipcRenderer.invoke('select-images'),
  getCssFiles: () => ipcRenderer.invoke('get-css-files'),

  // Сборка
  selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),
  getOutputPath: () => ipcRenderer.invoke('get-output-path'),
  setOutputPath: (path) => ipcRenderer.invoke('set-output-path', path),
  buildProject: (options) => ipcRenderer.invoke('build-project', options),

  // События от main процесса
  onProjectOpened: (callback) => {
    ipcRenderer.on('project-opened', (event, path) => callback(path));
  },
  onMenuSave: (callback) => {
    ipcRenderer.on('menu-save', () => callback());
  },
  onMenuSaveAll: (callback) => {
    ipcRenderer.on('menu-save-all', () => callback());
  },
  onMenuBuild: (callback) => {
    ipcRenderer.on('menu-build', () => callback());
  },
  onMenuAddSection: (callback) => {
    ipcRenderer.on('menu-add-section', () => callback());
  },
  onMenuDeleteSection: (callback) => {
    ipcRenderer.on('menu-delete-section', () => callback());
  },
  onMenuRenameSection: (callback) => {
    ipcRenderer.on('menu-rename-section', () => callback());
  },
  onMenuInsertImage: (callback) => {
    ipcRenderer.on('menu-insert-image', () => callback());
  },
  onMenuInsertLink: (callback) => {
    ipcRenderer.on('menu-insert-link', () => callback());
  },
  onMenuInsertTable: (callback) => {
    ipcRenderer.on('menu-insert-table', () => callback());
  },
  onMenuInsertVideo: (callback) => {
    ipcRenderer.on('menu-insert-video', () => callback());
  },
  onMenuFormat: (callback) => {
    ipcRenderer.on('menu-format', (event, format) => callback(format));
  },
  onMenuView: (callback) => {
    ipcRenderer.on('menu-view', (event, view) => callback(view));
  },
  onAppClosing: (callback) => {
    ipcRenderer.on('app-closing', () => callback());
  },
  onMenuCreateProject: (callback) => {
    ipcRenderer.on('menu-create-project', () => callback());
  }
});
