/**
 * Help Editor - View Switcher
 *
 * Переключение между режимами просмотра:
 * - editor: WYSIWYG редактор (TinyMCE)
 * - code: HTML-код
 * - preview: Предпросмотр
 *
 * @module modules/view-switcher
 */

const ViewSwitcher = {
  /**
   * Инициализация обработчиков кнопок переключения
   */
  init() {
    document.getElementById('btn-view-editor')?.addEventListener('click', () => this.switchTo('editor'));
    document.getElementById('btn-view-code')?.addEventListener('click', () => this.switchTo('code'));
    document.getElementById('btn-view-preview')?.addEventListener('click', () => this.switchTo('preview'));
  },

  /**
   * Переключение на указанный режим
   * @param {'editor'|'code'|'preview'} view - Режим просмотра
   */
  switchTo(view) {
    // Сохраняем текущий контент перед переключением
    if (AppState.currentView === 'editor' && AppState.editor) {
      AppState.currentContent = Editor.getContent();
    } else if (AppState.currentView === 'code') {
      AppState.currentContent = CodeEditor.getContent();
    }

    // Обновляем активные кнопки
    document.getElementById('btn-view-editor')?.classList.toggle('active', view === 'editor');
    document.getElementById('btn-view-code')?.classList.toggle('active', view === 'code');
    document.getElementById('btn-view-preview')?.classList.toggle('active', view === 'preview');

    // Скрываем placeholder если выбран раздел
    if (AppState.selectedNode) {
      document.getElementById('editor-placeholder')?.classList.add('hidden');
    }

    // Показываем/скрываем контейнеры
    const showEditor = view === 'editor' && AppState.selectedNode;
    document.getElementById('editor-wrapper')?.classList.toggle('hidden', !showEditor);
    document.getElementById('code-editor')?.classList.toggle('hidden', view !== 'code');
    document.getElementById('preview-container')?.classList.toggle('hidden', view !== 'preview');

    // Загружаем контент в активный вид
    if (view === 'editor' && AppState.editor) {
      Editor.setContent(AppState.currentContent);
    } else if (view === 'code') {
      CodeEditor.setContent(AppState.currentContent);
    } else if (view === 'preview') {
      const node = AppState.selectedNode
        ? TocParser.findNode(AppState.tocData?.elements, AppState.selectedNode)
        : null;
      if (node && node.url) {
        Preview.loadFile(node.url);
      } else {
        Preview.setContent(AppState.currentContent);
      }
    }

    AppState.currentView = view;

    // Отправляем событие
    if (typeof EventBus !== 'undefined') {
      EventBus.emit(Events.VIEW_CHANGED, view);
    }
  },

  /**
   * Получить текущий режим
   * @returns {'editor'|'code'|'preview'}
   */
  getCurrentView() {
    return AppState.currentView;
  }
};

// Экспорт для браузера
window.ViewSwitcher = ViewSwitcher;
