/**
 * Help Editor - WYSIWYG Editor (TinyMCE)
 *
 * Обёртка над TinyMCE для интеграции с приложением.
 *
 * @module modules/editor
 */

const Editor = {
  /**
   * Флаг инициализации
   * @type {boolean}
   */
  initialized: false,

  /**
   * Возвращает конфигурацию TinyMCE
   * @param {string} baseUrl - Базовый URL для относительных путей
   * @returns {Object} Конфигурация TinyMCE
   */
  getConfig(baseUrl = '') {
    return {
      selector: '#editor-content',
      height: '100%',
      resize: false,
      menubar: false,
      language: 'ru',
      plugins: 'lists link table code preview searchreplace',
      toolbar: 'undo redo | fontfamily fontsize | bold italic underline strikethrough | ' +
               'forecolor backcolor | blocks | bullist numlist indent outdent | ' +
               'customlink customimage customvideo table | ' +
               'alignleft aligncenter alignright | removeformat code',
      document_base_url: baseUrl,
      relative_urls: false,
      remove_script_host: false,
      convert_urls: false,
      content_style: `
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          padding: 16px;
          margin: 0;
        }
        img { max-width: 100%; height: auto; }
        table { border-collapse: collapse; width: 100%; }
        table td, table th { border: 1px solid #ddd; padding: 8px; }
        table th { background: #f5f5f5; }
        video { max-width: 100%; height: auto; }
      `,
      font_family_formats: 'Arial=arial,helvetica,sans-serif; ' +
                           'Times New Roman=times new roman,times,serif; ' +
                           'Courier New=courier new,courier,monospace; ' +
                           'Georgia=georgia,serif; ' +
                           'Verdana=verdana,geneva,sans-serif; ' +
                           'Tahoma=tahoma,arial,helvetica,sans-serif',
      font_size_formats: '8pt 10pt 12pt 14pt 16pt 18pt 20pt 24pt 28pt 36pt',
      setup: (editor) => {
        AppState.editor = editor;

        // Кастомные кнопки
        editor.ui.registry.addButton('customlink', {
          icon: 'link',
          tooltip: 'Вставить ссылку',
          onAction: () => Dialogs.showLinkDialog()
        });

        editor.ui.registry.addButton('customimage', {
          icon: 'image',
          tooltip: 'Вставить изображение',
          onAction: () => Dialogs.showImageDialog()
        });

        editor.ui.registry.addButton('customvideo', {
          icon: 'embed',
          tooltip: 'Вставить видео',
          onAction: () => Dialogs.showVideoDialog()
        });

        // Отслеживание изменений
        editor.on('change keyup', () => {
          AppState.hasUnsavedChanges = true;
          if (AppState.selectedNode) {
            AppState.modifiedFiles.add(AppState.selectedNode);
          }
          StatusBar.update();

          // Отправляем событие
          if (typeof EventBus !== 'undefined') {
            EventBus.emit(Events.CONTENT_CHANGED, {
              source: 'editor',
              nodeId: AppState.selectedNode
            });
          }
        });
      }
    };
  },

  /**
   * Первичная инициализация редактора
   * @returns {Promise<void>}
   */
  init() {
    return new Promise((resolve) => {
      if (typeof tinymce === 'undefined') {
        console.error('TinyMCE not loaded');
        resolve();
        return;
      }

      const config = this.getConfig();
      config.setup = (editor) => {
        this.getConfig().setup(editor);
        editor.on('init', () => {
          this.initialized = true;
          resolve();
        });
      };

      tinymce.init(config);
    });
  },

  /**
   * Переинициализация редактора с новым базовым URL
   * @param {string} projectPath - Путь к проекту
   * @returns {Promise<void>}
   */
  async reinit(projectPath) {
    if (AppState.editor) {
      tinymce.remove('#editor-content');
      AppState.editor = null;
    }

    // В Electron используем file://, в веб-версии - относительные пути через API
    const isElectron = typeof window.api !== 'undefined' && typeof window.api._callbacks === 'undefined';
    const baseUrl = isElectron && projectPath
      ? 'file:///' + projectPath.replace(/\\/g, '/') + '/'
      : '/api/files/serve/';

    return new Promise((resolve) => {
      const config = this.getConfig(baseUrl);
      config.setup = (editor) => {
        this.getConfig(baseUrl).setup(editor);
        editor.on('init', () => {
          this.initialized = true;
          resolve();
        });
      };

      tinymce.init(config);
    });
  },

  /**
   * Устанавливает содержимое редактора
   * @param {string} html - HTML содержимое
   */
  setContent(html) {
    if (AppState.editor) {
      AppState.editor.setContent(html || '');
      AppState.hasUnsavedChanges = false;
    }
  },

  /**
   * Получает содержимое редактора
   * @returns {string} HTML содержимое
   */
  getContent() {
    if (!AppState.editor) return '';
    return AppState.editor.getContent();
  },

  /**
   * Вставляет HTML в позицию курсора
   * @param {string} html - HTML для вставки
   */
  insertContent(html) {
    if (AppState.editor) {
      AppState.editor.insertContent(html);
    }
  },

  /**
   * Устанавливает фокус на редактор
   */
  focus() {
    if (AppState.editor) {
      AppState.editor.focus();
    }
  },

  /**
   * Проверяет, инициализирован ли редактор
   * @returns {boolean}
   */
  isReady() {
    return this.initialized && AppState.editor !== null;
  }
};

// Экспорт для браузера
window.Editor = Editor;
