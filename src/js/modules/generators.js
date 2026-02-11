/**
 * Help Editor - File Generators
 *
 * Генерация служебных файлов для сборки справки:
 * - helpCodes.xml — для интеграции с Directum RX (контекстная справка F1)
 * - helpCodes.js — JavaScript версия кодов справки
 * - toc.js — JSON-структура оглавления
 *
 * @module modules/generators
 */

const Generators = {
  /**
   * Генерирует helpCodes.xml для Directum RX
   *
   * Формат:
   * ```xml
   * <?xml version="1.0" encoding="utf-8"?>
   * <HelpCodes>
   *   <HelpCode code="installation" topic="installation.htm" />
   * </HelpCodes>
   * ```
   *
   * @param {Object} tocData - Структура оглавления
   * @returns {string} XML содержимое
   */
  generateHelpCodesXml(tocData) {
    const codes = [];

    const collectCodes = (elements) => {
      if (!elements || !Array.isArray(elements)) return;
      elements.forEach(node => {
        if (node.url) {
          // Код = имя файла без расширения, безопасное для XML
          const codeName = node.url
            .replace(/\.htm$/i, '')
            .replace(/[^a-zA-Z0-9_]/g, '_');
          codes.push({ code: codeName, topic: node.url });
        }
        if (node.children) collectCodes(node.children);
      });
    };

    collectCodes(tocData.elements);

    let xml = '<?xml version="1.0" encoding="utf-8"?>\n<HelpCodes>\n';
    codes.forEach(c => {
      xml += `  <HelpCode code="${this._escapeXml(c.code)}" topic="${this._escapeXml(c.topic)}" />\n`;
    });
    xml += '</HelpCodes>';

    return xml;
  },

  /**
   * Генерирует helpCodes.js
   *
   * Формат:
   * ```javascript
   * window.helpCodes = { data: ["installation", "getting_started"] };
   * ```
   *
   * @param {Object} tocData - Структура оглавления
   * @returns {string} JavaScript содержимое
   */
  generateHelpCodesJs(tocData) {
    const codes = [];

    const collectCodes = (elements) => {
      if (!elements || !Array.isArray(elements)) return;
      elements.forEach(node => {
        if (node.url) {
          const codeName = node.url.replace(/\.htm$/i, '');
          codes.push(codeName);
        }
        if (node.children) collectCodes(node.children);
      });
    };

    collectCodes(tocData.elements);

    return `window.helpCodes = { data: [\n${codes.map(c => `"${c}"`).join(',\n')}\n] };`;
  },

  /**
   * Генерирует toc.js с JSON-структурой оглавления
   *
   * Формат:
   * ```javascript
   * window.TOC = {
   *   id: "toc",
   *   elements: {
   *     "1": { level: 1, url: "intro.htm", text: "Введение", child: null },
   *     "2": { level: 1, url: "chapter1.htm", text: "Глава 1", child: { id: "ul2", elements: {...} } }
   *   }
   * };
   * ```
   *
   * @param {Object} tocData - Структура оглавления
   * @returns {string} JavaScript содержимое
   */
  generateTocJs(tocData) {
    /**
     * Рекурсивно строит структуру элементов
     * @param {Array} elements - Массив элементов
     * @param {string} prefix - Префикс для ключей
     * @returns {Object|null}
     */
    const buildElements = (elements, prefix = '') => {
      if (!elements || !Array.isArray(elements)) return null;

      const result = {};
      elements.forEach((node, index) => {
        const key = prefix ? `${prefix}.${index + 1}` : String(index + 1);
        result[key] = {
          level: (prefix.split('.').filter(Boolean).length) + 1,
          url: node.url || '',
          text: node.text || '',
          child: node.children && node.children.length > 0
            ? { id: `ul${key}`, elements: buildElements(node.children, key) }
            : null
        };
      });
      return result;
    };

    const tocStructure = {
      id: 'toc',
      elements: buildElements(tocData.elements)
    };

    return `window.TOC=${JSON.stringify(tocStructure)};`;
  },

  /**
   * Экранирует спецсимволы для XML
   * @param {string} str - Исходная строка
   * @returns {string} Экранированная строка
   * @private
   */
  _escapeXml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  },

  /**
   * Генерирует search_index.json для клиентского поиска на базе MiniSearch
   * Включает TOC для breadcrumbs и полный контент для качественного поиска
   *
   * @param {Object} tocData - Структура оглавления
   * @returns {string} JSON содержимое
   */
  generateSearchIndex(tocData) {
    // Получаем данные из модуля Search
    let entries = [];
    if (typeof window.Search !== 'undefined' && window.Search.isIndexReady) {
      const data = window.Search.getIndexData();
      entries = data.entries || [];
      console.log('Search index entries:', entries.length);
    } else {
      console.warn('Search not ready, entries will be empty');
    }

    // Строим TOC в формате для клиентского поиска (для breadcrumbs)
    const buildTocForSearch = (elements, prefix = '') => {
      if (!elements || !Array.isArray(elements)) return null;

      const result = {};
      elements.forEach((node, index) => {
        const key = prefix ? `${prefix}.${index + 1}` : String(index + 1);
        result[key] = {
          level: (prefix.split('.').filter(Boolean).length) + 1,
          url: node.url || '',
          text: node.text || '',
          child: node.children && node.children.length > 0
            ? { id: `ul${key}`, elements: buildTocForSearch(node.children, key) }
            : null
        };
      });
      return result;
    };

    const toc = tocData ? {
      id: 'toc',
      elements: buildTocForSearch(tocData.elements)
    } : null;

    // Карта URL -> title для быстрого доступа
    const titles = {};
    entries.forEach(e => {
      if (e.url && e.title) {
        titles[e.url.toLowerCase()] = e.title;
      }
    });

    // MiniSearch индекс создаётся на клиенте для корректной работы стемминга
    // Формат: JS-файл (window.__SEARCH_DATA__), чтобы работал через file:// без CORS
    const data = JSON.stringify({ entries, toc, titles });
    return `window.__SEARCH_DATA__=${data};`;
  },

  /**
   * Генерирует все файлы сборки
   * @param {Object} tocData - Структура оглавления
   * @param {string} originalHmContent - Исходный HTML hmcontent.htm
   * @returns {Object} Объект с файлами {filename: content}
   */
  generateAll(tocData, originalHmContent) {
    return {
      'helpCodes.xml': this.generateHelpCodesXml(tocData),
      'helpCodes.js': this.generateHelpCodesJs(tocData),
      'toc.js': this.generateTocJs(tocData),
      'hmcontent.htm': TocParser.generateHtml(tocData, originalHmContent),
      'search_index.js': this.generateSearchIndex(tocData)
    };
  }
};

// Экспорт для браузера
window.Generators = Generators;
