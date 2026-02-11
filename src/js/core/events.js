/**
 * Help Editor - Event Bus
 *
 * Реализация паттерна Pub/Sub для связи между модулями.
 * Позволяет модулям общаться без прямых зависимостей.
 *
 * @module core/events
 *
 * @example
 * // Подписка на событие
 * EventBus.on('section:selected', (nodeId) => {
 *   console.log('Выбран раздел:', nodeId);
 * });
 *
 * // Публикация события
 * EventBus.emit('section:selected', '123');
 *
 * // Отписка
 * EventBus.off('section:selected', myHandler);
 */

const EventBus = {
  /**
   * Хранилище подписчиков
   * @type {Map<string, Set<Function>>}
   */
  _listeners: new Map(),

  /**
   * Подписаться на событие
   * @param {string} event - Название события
   * @param {Function} callback - Функция-обработчик
   * @returns {Function} Функция для отписки
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);

    // Возвращаем функцию для удобной отписки
    return () => this.off(event, callback);
  },

  /**
   * Подписаться на событие один раз
   * @param {string} event - Название события
   * @param {Function} callback - Функция-обработчик
   */
  once(event, callback) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };
    this.on(event, wrapper);
  },

  /**
   * Отписаться от события
   * @param {string} event - Название события
   * @param {Function} callback - Функция-обработчик
   */
  off(event, callback) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this._listeners.delete(event);
      }
    }
  },

  /**
   * Опубликовать событие
   * @param {string} event - Название события
   * @param {...any} args - Аргументы для передачи обработчикам
   */
  emit(event, ...args) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event handler for "${event}":`, error);
        }
      });
    }
  },

  /**
   * Удалить все обработчики события
   * @param {string} event - Название события
   */
  removeAllListeners(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  },

  /**
   * Получить количество подписчиков события
   * @param {string} event - Название события
   * @returns {number}
   */
  listenerCount(event) {
    const listeners = this._listeners.get(event);
    return listeners ? listeners.size : 0;
  }
};

/**
 * Список стандартных событий приложения
 *
 * @constant {Object} Events
 * @property {string} PROJECT_OPENED - Проект открыт
 * @property {string} PROJECT_SAVED - Проект сохранён
 * @property {string} PROJECT_CLOSED - Проект закрыт
 * @property {string} SECTION_SELECTED - Раздел выбран
 * @property {string} SECTION_ADDED - Раздел добавлен
 * @property {string} SECTION_DELETED - Раздел удалён
 * @property {string} SECTION_RENAMED - Раздел переименован
 * @property {string} SECTION_MOVED - Раздел перемещён
 * @property {string} CONTENT_CHANGED - Контент изменён
 * @property {string} CONTENT_SAVED - Контент сохранён
 * @property {string} VIEW_CHANGED - Режим просмотра изменён
 * @property {string} BUILD_STARTED - Сборка начата
 * @property {string} BUILD_COMPLETED - Сборка завершена
 * @property {string} BUILD_FAILED - Сборка провалена
 * @property {string} ORPHANS_SCANNED - Сканирование сирот завершено
 */
const Events = {
  // Проект
  PROJECT_OPENED: 'project:opened',
  PROJECT_SAVED: 'project:saved',
  PROJECT_CLOSED: 'project:closed',

  // Разделы
  SECTION_SELECTED: 'section:selected',
  SECTION_ADDED: 'section:added',
  SECTION_DELETED: 'section:deleted',
  SECTION_RENAMED: 'section:renamed',
  SECTION_MOVED: 'section:moved',

  // Контент
  CONTENT_CHANGED: 'content:changed',
  CONTENT_SAVED: 'content:saved',

  // Вид
  VIEW_CHANGED: 'view:changed',

  // Сборка
  BUILD_STARTED: 'build:started',
  BUILD_COMPLETED: 'build:completed',
  BUILD_FAILED: 'build:failed',

  // Сканирование
  ORPHANS_SCANNED: 'orphans:scanned',

  // Поиск
  SEARCH_INDEX_READY: 'search:index-ready',
  SEARCH_COMPLETED: 'search:completed'
};

// Экспорт для браузера
window.EventBus = EventBus;
window.Events = Events;
