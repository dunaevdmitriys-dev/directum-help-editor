/**
 * Help Editor - Global State Management
 *
 * Централизованное хранилище состояния приложения.
 * Все модули должны использовать AppState для доступа к глобальным данным.
 *
 * @module core/state
 */

/**
 * Глобальное состояние приложения
 * @typedef {Object} AppState
 * @property {string|null} projectPath - Путь к открытому проекту
 * @property {Object|null} tocData - Структура оглавления {elements: Array}
 * @property {string|null} originalHmContent - Исходный HTML hmcontent.htm
 * @property {string|null} selectedNode - ID выбранного узла в дереве
 * @property {string} currentContent - HTML контент текущего раздела
 * @property {string|null} currentFileHtml - Оригинальный HTML файла
 * @property {boolean} hasUnsavedChanges - Есть несохранённые изменения
 * @property {Set<string>} modifiedFiles - Набор изменённых файлов
 * @property {Object|null} clipboard - Буфер обмена для копирования разделов
 * @property {string} currentView - Текущий режим: 'editor' | 'code' | 'preview'
 * @property {Object|null} editor - Ссылка на TinyMCE instance
 * @property {Array} orphanPages - Неиспользуемые страницы
 * @property {Array} unusedImages - Неиспользуемые изображения
 * @property {Object} orphanSectionsExpanded - Состояние развёрнутости секций сирот
 */
const AppState = {
  // Проект
  projectPath: null,
  tocData: null,
  originalHmContent: null,

  // Выбранный раздел
  selectedNode: null,
  currentContent: '',
  currentFileHtml: null,

  // Изменения
  hasUnsavedChanges: false,
  modifiedFiles: new Set(),

  // Буфер обмена
  clipboard: null,

  // Редактор
  currentView: 'editor',
  editor: null,

  // Неиспользуемые ресурсы
  orphanPages: [],
  unusedImages: [],
  orphanSectionsExpanded: { pages: false, images: false },

  // Поиск
  searchMode: 'title',         // 'title' | 'content'
  searchQuery: '',
  searchResults: [],
  isSearchResultsVisible: false
};

/**
 * Сбросить состояние к начальным значениям
 */
function resetState() {
  AppState.projectPath = null;
  AppState.tocData = null;
  AppState.originalHmContent = null;
  AppState.selectedNode = null;
  AppState.currentContent = '';
  AppState.currentFileHtml = null;
  AppState.hasUnsavedChanges = false;
  AppState.modifiedFiles = new Set();
  AppState.clipboard = null;
  AppState.currentView = 'editor';
  AppState.editor = null;
  AppState.orphanPages = [];
  AppState.unusedImages = [];
  AppState.orphanSectionsExpanded = { pages: false, images: false };
  AppState.searchMode = 'title';
  AppState.searchQuery = '';
  AppState.searchResults = [];
  AppState.isSearchResultsVisible = false;
}

/**
 * Пометить файл как изменённый
 * @param {string} fileId - ID файла или 'toc' для оглавления
 */
function markFileModified(fileId) {
  AppState.modifiedFiles.add(fileId);
  AppState.hasUnsavedChanges = true;
}

/**
 * Снять пометку об изменении файла
 * @param {string} fileId - ID файла
 */
function unmarkFileModified(fileId) {
  AppState.modifiedFiles.delete(fileId);
  if (AppState.modifiedFiles.size === 0) {
    AppState.hasUnsavedChanges = false;
  }
}

/**
 * Очистить все пометки об изменениях
 */
function clearModifications() {
  AppState.modifiedFiles.clear();
  AppState.hasUnsavedChanges = false;
}

// Экспорт для браузера (глобальная область видимости)
window.AppState = AppState;
window.StateUtils = {
  resetState,
  markFileModified,
  unmarkFileModified,
  clearModifications
};
