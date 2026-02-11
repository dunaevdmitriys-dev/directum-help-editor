/**
 * Help Editor - Preview
 *
 * Предпросмотр HTML контента в iframe.
 *
 * @module modules/preview
 */

const Preview = {
  /**
   * @type {HTMLIFrameElement|null}
   */
  iframe: null,

  /**
   * Инициализация модуля
   */
  init() {
    this.iframe = document.getElementById('preview-frame');
  },

  /**
   * Загружает файл для предпросмотра
   * @param {string} url - Путь к файлу
   */
  async loadFile(url) {
    if (!url) {
      this.setContent('');
      return;
    }

    try {
      const result = await window.api.readFile(url);
      if (result.success) {
        this.displayFullHtml(result.content);
      } else {
        this.setContent('<p>Ошибка загрузки файла</p>');
      }
    } catch (e) {
      console.error('Ошибка загрузки Preview:', e);
      this.setContent('<p>Ошибка загрузки</p>');
    }
  },

  /**
   * Отображает полный HTML документ
   * @param {string} htmlContent - HTML содержимое
   */
  displayFullHtml(htmlContent) {
    let content = htmlContent;

    // Добавляем base тег для корректной работы относительных путей
    if (AppState.projectPath) {
      // Определяем режим работы: Electron (file://) или Web (API)
      const isElectron = typeof window.api !== 'undefined' && typeof window.api._callbacks === 'undefined';

      let basePath;
      if (isElectron) {
        basePath = 'file:///' + AppState.projectPath.replace(/\\/g, '/') + '/';
      } else {
        // В веб-версии заменяем относительные пути на API пути
        basePath = '/api/files/serve/?project=' + encodeURIComponent(AppState.projectPath) + '&_=';
        // Преобразуем все src и href
        content = content.replace(/(src|href)="(?!http|data:|\/|#)([^"]+)"/g, (match, attr, path) => {
          return `${attr}="/api/files/serve/${path}?project=${encodeURIComponent(AppState.projectPath)}"`;
        });
      }

      if (isElectron) {
        if (content.includes('<head>')) {
          content = content.replace('<head>', `<head>\n<base href="${basePath}">`);
        } else if (content.includes('<head ')) {
          content = content.replace(/<head([^>]*)>/, `<head$1>\n<base href="${basePath}">`);
        } else {
          content = `<!DOCTYPE html><html><head><base href="${basePath}"></head><body>${content}</body></html>`;
        }
      }
    }

    const doc = this.iframe.contentDocument;
    doc.open();
    doc.write(content);
    doc.close();
  },

  /**
   * Устанавливает HTML контент в iframe
   * @param {string} html - HTML для отображения
   */
  setContent(html) {
    const doc = this.iframe.contentDocument;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            padding: 20px;
            max-width: 900px;
            margin: 0 auto;
          }
          img { max-width: 100%; height: auto; }
          video { max-width: 100%; height: auto; }
          table { border-collapse: collapse; width: 100%; }
          table td, table th { border: 1px solid #ddd; padding: 8px; }
        </style>
      </head>
      <body>${html || ''}</body>
      </html>
    `);
    doc.close();
  },

  /**
   * Обновляет предпросмотр текущего контента
   */
  refresh() {
    if (AppState.currentView === 'preview') {
      const node = AppState.selectedNode
        ? TocParser.findNode(AppState.tocData?.elements, AppState.selectedNode)
        : null;
      if (node && node.url) {
        this.loadFile(node.url);
      } else {
        this.setContent(AppState.currentContent);
      }
    }
  }
};

// Экспорт для браузера
window.Preview = Preview;
