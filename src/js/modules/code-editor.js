/**
 * Help Editor - Code Editor
 *
 * Простой HTML редактор на основе textarea.
 * Используется для режима редактирования исходного кода.
 *
 * @module modules/code-editor
 */

const CodeEditor = {
  /**
   * @type {HTMLTextAreaElement|null}
   */
  textarea: null,

  /**
   * Инициализация редактора
   */
  init() {
    this.textarea = document.getElementById('code-content');
    if (this.textarea) {
      this.textarea.addEventListener('input', () => {
        AppState.hasUnsavedChanges = true;
        if (AppState.selectedNode) {
          AppState.modifiedFiles.add(AppState.selectedNode);
        }
        StatusBar.update();

        // Отправляем событие
        if (typeof EventBus !== 'undefined') {
          EventBus.emit(Events.CONTENT_CHANGED, {
            source: 'code-editor',
            nodeId: AppState.selectedNode
          });
        }
      });
    }
  },

  /**
   * Устанавливает содержимое редактора
   * @param {string} html - HTML содержимое
   */
  setContent(html) {
    if (this.textarea) {
      this.textarea.value = html || '';
    }
  },

  /**
   * Получает содержимое редактора
   * @returns {string} HTML содержимое
   */
  getContent() {
    return this.textarea ? this.textarea.value : '';
  },

  /**
   * Устанавливает фокус на редактор
   */
  focus() {
    if (this.textarea) {
      this.textarea.focus();
    }
  },

  /**
   * Вставляет текст в позицию курсора
   * @param {string} text - Текст для вставки
   */
  insertAtCursor(text) {
    if (!this.textarea) return;

    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const value = this.textarea.value;

    this.textarea.value = value.substring(0, start) + text + value.substring(end);
    this.textarea.selectionStart = this.textarea.selectionEnd = start + text.length;
    this.textarea.focus();

    // Триггерим событие input
    this.textarea.dispatchEvent(new Event('input'));
  }
};

// Экспорт для браузера
window.CodeEditor = CodeEditor;
