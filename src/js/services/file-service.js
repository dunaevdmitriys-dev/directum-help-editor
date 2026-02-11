/**
 * Help Editor - File Service Abstraction
 *
 * Абстракция для файловых операций.
 * В веб-версии использует REST API, в Electron — window.api.
 *
 * @module services/file-service
 */

const FileService = {
  /**
   * Базовый URL для REST API
   * @type {string}
   */
  baseUrl: '/api',

  /**
   * Текущий путь проекта
   * @type {string|null}
   */
  projectPath: null,

  /**
   * Путь для сборки
   * @type {string|null}
   */
  outputPath: null,

  /**
   * Callbacks для событий (эмуляция Electron IPC)
   * @type {Object}
   */
  _callbacks: {
    projectOpened: [],
    menuSave: [],
    menuSaveAll: [],
    menuBuild: [],
    menuAddSection: [],
    menuDeleteSection: [],
    menuRenameSection: [],
    menuInsertImage: [],
    menuInsertLink: [],
    menuInsertTable: [],
    menuInsertVideo: [],
    menuView: [],
    menuFormat: [],
    menuCreateProject: [],
    appClosing: []
  },

  // ==================== HTTP ====================

  /**
   * Обёртка над fetch с обработкой 401 и ошибок
   * @param {string} url - URL
   * @param {Object} options - Опции fetch
   * @returns {Promise<Response>}
   */
  async _fetch(url, options = {}) {
    const response = await fetch(url, options);

    // Если сессия истекла — показываем логин
    if (response.status === 401 && typeof AuthService !== 'undefined') {
      await AuthService.ensureAuthenticated();
      // Повторяем запрос после логина
      return fetch(url, options);
    }

    return response;
  },

  // ==================== Файловые операции ====================

  /**
   * Прочитать файл
   * @param {string} filePath - Путь к файлу
   * @returns {Promise<{success: boolean, content?: string, error?: string}>}
   */
  async readFile(filePath) {
    try {
      const response = await this._fetch(`${this.baseUrl}/files/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, projectPath: this.projectPath })
      });
      if (!response.ok && response.status !== 403) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Записать файл
   * @param {string} filePath - Путь к файлу
   * @param {string} content - Содержимое
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async writeFile(filePath, content) {
    try {
      const response = await this._fetch(`${this.baseUrl}/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content, projectPath: this.projectPath })
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Проверить существование файла
   * @param {string} filePath - Путь к файлу
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    try {
      const response = await this._fetch(`${this.baseUrl}/files/exists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, projectPath: this.projectPath })
      });
      const result = await response.json();
      return result.exists;
    } catch (error) {
      return false;
    }
  },

  /**
   * Список файлов в директории
   * @param {string|null} dirPath - Путь к директории
   * @param {string} extension - Расширение для фильтрации
   * @returns {Promise<string[]>}
   */
  async listFiles(dirPath, extension) {
    try {
      const response = await this._fetch(`${this.baseUrl}/files/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dirPath, extension, projectPath: this.projectPath })
      });
      const result = await response.json();
      return result.files || [];
    } catch (error) {
      return [];
    }
  },

  /**
   * Рекурсивный список файлов
   * @param {string|null} dirPath - Путь к директории
   * @param {string[]} extensions - Расширения для фильтрации
   * @returns {Promise<string[]>}
   */
  async listFilesRecursive(dirPath, extensions) {
    try {
      const response = await this._fetch(`${this.baseUrl}/files/list-recursive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dirPath, extensions, projectPath: this.projectPath })
      });
      const result = await response.json();
      return result.files || [];
    } catch (error) {
      return [];
    }
  },

  /**
   * Удалить файл
   * @param {string} filePath - Путь к файлу
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteFile(filePath) {
    try {
      const response = await this._fetch(`${this.baseUrl}/files/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, projectPath: this.projectPath })
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // ==================== Проект ====================

  /**
   * Открыть диалог выбора папки проекта
   * @returns {Promise<string|null>}
   */
  async openFolderDialog() {
    // В веб-версии открываем модальное окно с браузером папок
    return new Promise((resolve) => {
      WebDialogs.showFolderDialog('Путь к папке справки:', async (path) => {
        if (!path) {
          resolve(null);
          return;
        }

        // Валидируем папку — должен быть hmcontent.htm
        try {
          const response = await this._fetch(`${this.baseUrl}/project/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
          });
          const result = await response.json();

          if (!result.valid) {
            WebDialogs.showMessage(
              result.error || 'В выбранной папке нет файла hmcontent.htm',
              'error',
              'Ошибка открытия'
            );
            resolve(null);
            return;
          }

          // Папка валидна — открываем проект
          this.setProjectPath(path);
          this._emit('projectOpened', path);
          resolve(path);
        } catch (error) {
          WebDialogs.showMessage('Ошибка проверки папки: ' + error.message, 'error', 'Ошибка');
          resolve(null);
        }
      });
    });
  },

  /**
   * Получить путь к проекту
   * @returns {Promise<string|null>}
   */
  async getProjectPath() {
    return this.projectPath;
  },

  /**
   * Установить путь к проекту
   * @param {string} path - Путь
   */
  setProjectPath(path) {
    this.projectPath = path;
  },

  /**
   * Создать проект
   * @param {Object} options - Параметры проекта
   * @returns {Promise<{success: boolean, path?: string, error?: string}>}
   */
  async createProject(options) {
    try {
      const response = await this._fetch(`${this.baseUrl}/project/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      const result = await response.json();
      if (result.success) {
        this.projectPath = result.path;
        this._emit('projectOpened', result.path);
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Выбрать папку для нового проекта
   * @returns {Promise<{success: boolean, path?: string, error?: string}>}
   */
  async selectProjectFolder() {
    return new Promise((resolve) => {
      WebDialogs.showFolderDialog('Папка для нового проекта:', async (path) => {
        if (!path) {
          resolve({ success: false, canceled: true });
          return;
        }
        // Проверяем на сервере, что папка не содержит hmcontent.htm
        const response = await FileService._fetch(`${FileService.baseUrl}/project/check-folder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path })
        });
        const result = await response.json();
        if (!result.valid) {
          resolve({ success: false, error: result.error });
        } else {
          resolve({ success: true, path });
        }
      });
    });
  },

  // ==================== Диалоги ====================

  /**
   * Показать диалог подтверждения
   * @param {string} message - Сообщение
   * @param {string} title - Заголовок
   * @returns {Promise<boolean>}
   */
  async showConfirm(message, title) {
    return WebDialogs.showConfirm(message, title);
  },

  /**
   * Показать сообщение
   * @param {string} message - Сообщение
   * @param {string} type - Тип: info, warning, error
   * @param {string} title - Заголовок
   */
  async showMessage(message, type, title) {
    WebDialogs.showMessage(message, type, title);
  },

  /**
   * Выбрать изображение
   * @returns {Promise<{success: boolean, path?: string}>}
   */
  async selectImage() {
    return WebDialogs.showFileUpload({
      accept: 'image/*',
      title: 'Выберите изображение',
      projectPath: this.projectPath
    });
  },

  /**
   * Выбрать несколько изображений
   * @returns {Promise<{success: boolean, files?: string[]}>}
   */
  async selectImages() {
    return WebDialogs.showFileUpload({
      accept: 'image/*',
      multiple: true,
      title: 'Выберите изображения',
      projectPath: this.projectPath
    });
  },

  /**
   * Выбрать видео
   * @returns {Promise<{success: boolean, path?: string}>}
   */
  async selectVideo() {
    return WebDialogs.showFileUpload({
      accept: 'video/*',
      title: 'Выберите видео',
      projectPath: this.projectPath
    });
  },

  /**
   * Выбрать HTML файл
   * @returns {Promise<{success: boolean, path?: string, title?: string, content?: string}>}
   */
  async selectHtmlFile() {
    return WebDialogs.showFileUpload({
      accept: '.htm,.html',
      title: 'Выберите HTML файл',
      projectPath: this.projectPath,
      readContent: true
    });
  },

  /**
   * Выбрать CSS файлы
   * @returns {Promise<{success: boolean, files?: string[]}>}
   */
  async selectCssFiles() {
    return WebDialogs.showFileUpload({
      accept: '.css',
      multiple: true,
      title: 'Выберите CSS файлы',
      projectPath: this.projectPath
    });
  },

  /**
   * Получить список CSS файлов в проекте
   * @returns {Promise<string[]>}
   */
  async getCssFiles() {
    return this.listFiles(null, '.css');
  },

  // ==================== Сборка ====================

  /**
   * Выбрать папку для сборки
   * @returns {Promise<{success: boolean, path?: string}>}
   */
  async selectOutputFolder() {
    return new Promise((resolve) => {
      WebDialogs.showFolderDialog('Папка для сборки:', (path) => {
        if (path) {
          this.outputPath = path;
          resolve({ success: true, path });
        } else {
          resolve({ success: false, canceled: true });
        }
      });
    });
  },

  /**
   * Получить путь сборки
   * @returns {Promise<string|null>}
   */
  async getOutputPath() {
    return this.outputPath;
  },

  /**
   * Установить путь сборки
   * @param {string} path - Путь
   * @returns {Promise<{success: boolean}>}
   */
  async setOutputPath(path) {
    this.outputPath = path;
    return { success: true };
  },

  /**
   * Сборка проекта
   * @param {Object} options - Опции сборки
   * @returns {Promise<{success: boolean, path?: string, error?: string}>}
   */
  async buildProject(options) {
    try {
      const response = await this._fetch(`${this.baseUrl}/project/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...options,
          projectPath: this.projectPath
        })
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // ==================== События ====================

  /**
   * Подписка на открытие проекта
   * @param {Function} callback
   */
  onProjectOpened(callback) {
    this._callbacks.projectOpened.push(callback);
  },

  onMenuSave(callback) {
    this._callbacks.menuSave.push(callback);
  },

  onMenuSaveAll(callback) {
    this._callbacks.menuSaveAll.push(callback);
  },

  onMenuBuild(callback) {
    this._callbacks.menuBuild.push(callback);
  },

  onMenuAddSection(callback) {
    this._callbacks.menuAddSection.push(callback);
  },

  onMenuDeleteSection(callback) {
    this._callbacks.menuDeleteSection.push(callback);
  },

  onMenuRenameSection(callback) {
    this._callbacks.menuRenameSection.push(callback);
  },

  onMenuInsertImage(callback) {
    this._callbacks.menuInsertImage.push(callback);
  },

  onMenuInsertLink(callback) {
    this._callbacks.menuInsertLink.push(callback);
  },

  onMenuInsertTable(callback) {
    this._callbacks.menuInsertTable.push(callback);
  },

  onMenuInsertVideo(callback) {
    this._callbacks.menuInsertVideo.push(callback);
  },

  onMenuFormat(callback) {
    this._callbacks.menuFormat.push(callback);
  },

  onMenuView(callback) {
    this._callbacks.menuView.push(callback);
  },

  onMenuCreateProject(callback) {
    this._callbacks.menuCreateProject.push(callback);
  },

  onAppClosing(callback) {
    this._callbacks.appClosing.push(callback);
  },

  /**
   * Emit event
   * @private
   */
  _emit(event, data) {
    const callbacks = this._callbacks[event] || [];
    callbacks.forEach(cb => cb(data));
  },

  /**
   * Эмуляция меню (горячие клавиши и кнопки toolbar)
   */
  triggerMenuSave() {
    this._emit('menuSave');
  },

  triggerMenuSaveAll() {
    this._emit('menuSaveAll');
  },

  triggerMenuBuild() {
    this._emit('menuBuild');
  },

  triggerMenuAddSection() {
    this._emit('menuAddSection');
  }
};

/**
 * Web Dialogs - HTML-диалоги для веб-версии
 */
const WebDialogs = {
  /**
   * Показать диалог выбора папки с браузером файлов
   * @param {string} label - Метка
   * @param {Function} callback - Callback с результатом
   */
  showFolderDialog(label, callback) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="width: 600px; max-width: 90vw;">
        <div class="modal-header">
          <h3>Выбор папки</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>${label}</label>
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
              <input type="text" class="form-input" id="folder-path-input" placeholder="/путь/к/папке" style="flex: 1;">
              <button class="btn" id="folder-go">Перейти</button>
            </div>
          </div>
          <div id="folder-drives" style="display: none; margin-bottom: 8px;"></div>
          <div id="folder-browser" style="border: 1px solid var(--border-color); border-radius: 4px; height: 300px; overflow-y: auto; background: var(--bg-primary);"></div>
          <div id="folder-project-hint" style="margin-top: 8px; padding: 8px; background: #e8f5e9; border-radius: 4px; display: none;">
            В этой папке найден проект справки (hmcontent.htm)
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" id="folder-cancel">Отмена</button>
          <button class="btn btn-primary" id="folder-ok">Выбрать эту папку</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector('#folder-path-input');
    const goBtn = modal.querySelector('#folder-go');
    const browser = modal.querySelector('#folder-browser');
    const drivesEl = modal.querySelector('#folder-drives');
    const projectHint = modal.querySelector('#folder-project-hint');
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('#folder-cancel');
    const okBtn = modal.querySelector('#folder-ok');

    let currentPath = '';

    const close = (result) => {
      document.body.removeChild(modal);
      callback(result);
    };

    const loadFolder = async (folderPath) => {
      browser.innerHTML = '<div style="padding: 16px; color: var(--text-secondary);">Загрузка...</div>';

      try {
        const response = await FileService._fetch('/api/files/browse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: folderPath })
        });
        const result = await response.json();

        if (!result.success) {
          browser.innerHTML = `<div style="padding: 16px; color: var(--error-color);">${result.error}</div>`;
          return;
        }

        currentPath = result.currentPath;
        input.value = currentPath;

        // Показываем диски Windows
        if (result.drives && result.drives.length > 0) {
          drivesEl.style.display = 'flex';
          drivesEl.style.gap = '4px';
          drivesEl.style.flexWrap = 'wrap';
          drivesEl.innerHTML = result.drives.map(d =>
            `<button class="btn btn-small folder-drive" data-path="${d}" style="padding: 4px 8px; font-size: 12px;">${d}</button>`
          ).join('');
          drivesEl.querySelectorAll('.folder-drive').forEach(btn => {
            btn.onclick = () => loadFolder(btn.dataset.path);
          });
        }

        // Показываем подсказку о проекте
        projectHint.style.display = result.hasProject ? 'block' : 'none';

        // Рендерим папки
        if (result.entries.length === 0) {
          browser.innerHTML = '<div style="padding: 16px; color: var(--text-secondary);">Папка пуста</div>';
          return;
        }

        browser.innerHTML = result.entries.map(entry => `
          <div class="folder-entry" data-path="${entry.path}" style="padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--border-color);">
            <span style="font-size: 16px;">${entry.isParent ? '⬆️' : '📁'}</span>
            <span>${entry.name}</span>
          </div>
        `).join('');

        browser.querySelectorAll('.folder-entry').forEach(entry => {
          entry.onclick = () => loadFolder(entry.dataset.path);
          entry.onmouseenter = () => entry.style.background = 'var(--bg-hover)';
          entry.onmouseleave = () => entry.style.background = '';
        });

      } catch (error) {
        browser.innerHTML = `<div style="padding: 16px; color: var(--error-color);">Ошибка: ${error.message}</div>`;
      }
    };

    closeBtn.onclick = () => close(null);
    cancelBtn.onclick = () => close(null);
    modal.onclick = (e) => { if (e.target === modal) close(null); };
    okBtn.onclick = () => close(currentPath || input.value.trim() || null);
    goBtn.onclick = () => loadFolder(input.value.trim());
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        loadFolder(input.value.trim());
      }
    };

    // Загружаем начальную папку
    loadFolder('');
  },

  /**
   * Показать диалог подтверждения
   * @param {string} message - Сообщение
   * @param {string} title - Заголовок
   * @returns {Promise<boolean>}
   */
  showConfirm(message, title) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content modal-small">
          <div class="modal-header">
            <h3>${title || 'Подтверждение'}</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button class="btn" id="confirm-no">Нет</button>
            <button class="btn btn-primary" id="confirm-yes">Да</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const closeBtn = modal.querySelector('.modal-close');
      const noBtn = modal.querySelector('#confirm-no');
      const yesBtn = modal.querySelector('#confirm-yes');

      const close = (result) => {
        document.body.removeChild(modal);
        resolve(result);
      };

      closeBtn.onclick = () => close(false);
      noBtn.onclick = () => close(false);
      yesBtn.onclick = () => close(true);
      modal.onclick = (e) => { if (e.target === modal) close(false); };
    });
  },

  /**
   * Показать сообщение
   * @param {string} message - Сообщение
   * @param {string} type - Тип
   * @param {string} title - Заголовок
   */
  showMessage(message, type, title) {
    const iconMap = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌'
    };

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content modal-small">
        <div class="modal-header">
          <h3>${iconMap[type] || ''} ${title || 'Сообщение'}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" id="msg-ok">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.modal-close');
    const okBtn = modal.querySelector('#msg-ok');

    const close = () => document.body.removeChild(modal);

    closeBtn.onclick = close;
    okBtn.onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };
  },

  /**
   * Показать диалог загрузки файла
   * @param {Object} options - Опции
   * @returns {Promise<{success: boolean, path?: string, files?: string[], title?: string, content?: string}>}
   */
  showFileUpload(options) {
    return new Promise((resolve) => {
      const { accept, multiple, title, projectPath, readContent } = options;

      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>${title || 'Выберите файл'}</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Выберите файл${multiple ? 'ы' : ''}:</label>
              <input type="file" id="file-upload-input" class="form-input"
                     accept="${accept || '*/*'}" ${multiple ? 'multiple' : ''}>
            </div>
            <div class="file-upload-zone" id="file-drop-zone">
              <p>Перетащите файл${multiple ? 'ы' : ''} сюда или нажмите для выбора</p>
            </div>
            <div id="file-upload-preview" class="file-upload-preview"></div>
          </div>
          <div class="modal-footer">
            <button class="btn" id="upload-cancel">Отмена</button>
            <button class="btn btn-primary" id="upload-ok" disabled>Загрузить</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const fileInput = modal.querySelector('#file-upload-input');
      const dropZone = modal.querySelector('#file-drop-zone');
      const preview = modal.querySelector('#file-upload-preview');
      const closeBtn = modal.querySelector('.modal-close');
      const cancelBtn = modal.querySelector('#upload-cancel');
      const okBtn = modal.querySelector('#upload-ok');

      let selectedFiles = [];

      const updatePreview = () => {
        if (selectedFiles.length === 0) {
          preview.innerHTML = '';
          okBtn.disabled = true;
          return;
        }
        preview.innerHTML = selectedFiles.map(f => `<div class="file-item">📄 ${f.name}</div>`).join('');
        okBtn.disabled = false;
      };

      fileInput.onchange = () => {
        selectedFiles = Array.from(fileInput.files);
        updatePreview();
      };

      dropZone.onclick = () => fileInput.click();

      dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      };

      dropZone.ondragleave = () => {
        dropZone.classList.remove('dragover');
      };

      dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        selectedFiles = Array.from(e.dataTransfer.files);
        updatePreview();
      };

      const close = (result) => {
        document.body.removeChild(modal);
        resolve(result);
      };

      closeBtn.onclick = () => close({ success: false });
      cancelBtn.onclick = () => close({ success: false });
      modal.onclick = (e) => { if (e.target === modal) close({ success: false }); };

      okBtn.onclick = async () => {
        if (selectedFiles.length === 0) {
          close({ success: false });
          return;
        }

        // Загружаем файлы на сервер
        const formData = new FormData();
        selectedFiles.forEach(file => formData.append('files', file));
        formData.append('projectPath', projectPath || '');

        try {
          const response = await FileService._fetch('/api/files/upload', {
            method: 'POST',
            body: formData
          });
          const result = await response.json();

          if (result.success) {
            if (multiple) {
              close({ success: true, files: result.files });
            } else {
              // Для одного файла
              const file = result.files[0];
              if (readContent) {
                // Читаем содержимое для HTML файлов
                const contentResp = await FileService.readFile(file);
                let fileTitle = file.replace(/\.htm[l]?$/i, '');
                if (contentResp.success) {
                  const match = contentResp.content.match(/<title[^>]*>([^<]+)<\/title>/i);
                  if (match) fileTitle = match[1].trim();
                }
                close({ success: true, path: file, title: fileTitle, content: contentResp.content });
              } else {
                close({ success: true, path: file });
              }
            }
          } else {
            close({ success: false, error: result.error });
          }
        } catch (error) {
          close({ success: false, error: error.message });
        }
      };
    });
  }
};

/**
 * Утилиты для работы с путями
 */
const PathUtils = {
  /**
   * Проверяет, работает ли приложение в режиме Electron
   * @returns {boolean}
   */
  isElectron() {
    // В Electron window.api определён через preload.js и не имеет _callbacks
    return typeof window.api !== 'undefined' && typeof window.api._callbacks === 'undefined';
  },

  /**
   * Получает базовый URL для ресурсов
   * @param {string} projectPath - Путь к проекту
   * @returns {string}
   */
  getBaseUrl(projectPath) {
    if (!projectPath) return '';
    if (this.isElectron()) {
      return 'file:///' + projectPath.replace(/\\/g, '/') + '/';
    }
    return '/api/files/serve/';
  },

  /**
   * Преобразует относительный путь в абсолютный URL
   * @param {string} relativePath - Относительный путь
   * @param {string} projectPath - Путь к проекту
   * @returns {string}
   */
  toAbsoluteUrl(relativePath, projectPath) {
    if (!relativePath || !projectPath) return relativePath;
    if (relativePath.startsWith('http') || relativePath.startsWith('data:') ||
        relativePath.startsWith('file://') || relativePath.startsWith('/api/')) {
      return relativePath;
    }
    if (this.isElectron()) {
      return 'file:///' + projectPath.replace(/\\/g, '/') + '/' + relativePath;
    }
    return '/api/files/serve/' + relativePath + '?project=' + encodeURIComponent(projectPath);
  },

  /**
   * Преобразует абсолютный URL обратно в относительный путь
   * @param {string} absoluteUrl - Абсолютный URL
   * @param {string} projectPath - Путь к проекту
   * @returns {string}
   */
  toRelativePath(absoluteUrl, projectPath) {
    if (!absoluteUrl || !projectPath) return absoluteUrl;

    // file:// URLs (Electron)
    const fileBase = 'file:///' + projectPath.replace(/\\/g, '/') + '/';
    if (absoluteUrl.startsWith(fileBase)) {
      return absoluteUrl.substring(fileBase.length);
    }

    // API URLs (Web)
    const apiMatch = absoluteUrl.match(/\/api\/files\/serve\/([^?]+)/);
    if (apiMatch) {
      return apiMatch[1];
    }

    return absoluteUrl;
  }
};

/**
 * Сервис авторизации
 */
const AuthService = {
  /**
   * Проверить статус авторизации
   * @returns {Promise<{authenticated: boolean, required: boolean}>}
   */
  async check() {
    try {
      const response = await fetch('/api/auth/check');
      return await response.json();
    } catch (e) {
      return { authenticated: false, required: false };
    }
  },

  /**
   * Войти по паролю
   * @param {string} password
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async login(password) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      return await response.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Выйти
   */
  async logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
  },

  /**
   * Показать экран входа если требуется авторизация
   * @returns {Promise<boolean>} true если авторизован
   */
  async ensureAuthenticated() {
    const status = await this.check();
    if (!status.required || status.authenticated) return true;

    return new Promise((resolve) => {
      this._showLoginDialog(resolve);
    });
  },

  /**
   * Показать диалог входа
   * @private
   */
  _showLoginDialog(resolve) {
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.style.zIndex = '10000';
    overlay.innerHTML = `
      <div class="modal-content modal-small" style="max-width: 400px;">
        <div class="modal-header">
          <h3>🔒 Вход в редактор</h3>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Пароль:</label>
            <input type="password" class="form-input" id="auth-password" placeholder="Введите пароль" autofocus>
          </div>
          <div id="auth-error" style="color: var(--error-color, red); margin-top: 8px; display: none;"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" id="auth-submit">Войти</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const passwordInput = overlay.querySelector('#auth-password');
    const submitBtn = overlay.querySelector('#auth-submit');
    const errorEl = overlay.querySelector('#auth-error');

    const doLogin = async () => {
      const password = passwordInput.value;
      if (!password) return;

      submitBtn.disabled = true;
      submitBtn.textContent = '...';

      const result = await this.login(password);
      if (result.success) {
        document.body.removeChild(overlay);
        resolve(true);
      } else {
        errorEl.textContent = result.error || 'Неверный пароль';
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Войти';
        passwordInput.value = '';
        passwordInput.focus();
      }
    };

    submitBtn.onclick = doLogin;
    passwordInput.onkeydown = (e) => {
      if (e.key === 'Enter') doLogin();
    };

    setTimeout(() => passwordInput.focus(), 100);
  }
};

// Экспорт
window.FileService = FileService;
window.WebDialogs = WebDialogs;
window.PathUtils = PathUtils;
window.AuthService = AuthService;

// Совместимость: если window.api не определён, используем FileService
if (typeof window.api === 'undefined') {
  window.api = FileService;
}
