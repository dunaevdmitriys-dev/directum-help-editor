/**
 * Help Editor - Status Bar
 *
 * Управление статусной строкой приложения.
 * Отображает текущий файл и состояние сохранения.
 *
 * @module modules/status-bar
 */

const StatusBar = {
  /**
   * Обновляет статусную строку
   */
  update() {
    const node = AppState.selectedNode
      ? TocParser.findNode(AppState.tocData?.elements, AppState.selectedNode)
      : null;

    const statusFile = document.getElementById('status-file');
    const statusText = document.getElementById('status-text');

    if (statusFile) {
      statusFile.textContent = node ? node.url || '' : '';
    }

    if (statusText) {
      const modified = AppState.hasUnsavedChanges ? '● Изменено' : '✓ Сохранено';
      statusText.textContent = modified;
    }
  },

  /**
   * Показывает временное сообщение в статусной строке
   * @param {string} message - Текст сообщения
   * @param {number} duration - Длительность показа в мс (по умолчанию 3000)
   */
  showMessage(message, duration = 3000) {
    const statusText = document.getElementById('status-text');
    if (!statusText) return;

    const originalText = statusText.textContent;
    statusText.textContent = message;

    setTimeout(() => {
      this.update();
    }, duration);
  },

  /**
   * Показывает индикатор загрузки
   * @param {string} message - Текст (например, "Загрузка...")
   */
  showLoading(message = 'Загрузка...') {
    const statusText = document.getElementById('status-text');
    if (statusText) {
      statusText.textContent = '⟳ ' + message;
    }
  },

  /**
   * Устанавливает текст статуса
   * @param {string} message - Текст статуса
   */
  setStatus(message) {
    const statusText = document.getElementById('status-text');
    if (statusText) {
      statusText.textContent = message;
    }
  }
};

// Экспорт для браузера
window.StatusBar = StatusBar;
