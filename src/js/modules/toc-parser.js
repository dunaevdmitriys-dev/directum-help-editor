/**
 * Help Editor - TOC Parser
 *
 * Парсер и генератор оглавления (hmcontent.htm).
 * Работает с форматом Help & Manual WebHelp.
 *
 * @module modules/toc-parser
 */

const TocParser = {
  /**
   * Парсит HTML оглавления в структуру данных
   * @param {string} htmlContent - HTML содержимое hmcontent.htm
   * @returns {{elements: Array}} Структура оглавления
   */
  parseHtml(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const tocRoot = doc.getElementById('toc');

    if (!tocRoot) {
      console.error('TOC root element not found');
      return { elements: [] };
    }

    /**
     * Парсит один элемент списка
     * @param {HTMLLIElement} li - Элемент списка
     * @param {number} index - Индекс элемента
     * @returns {Object} Узел структуры
     */
    const parseLi = (li, index) => {
      const id = li.id || `item_${index}`;
      const link = li.querySelector(':scope > a');
      const span = li.querySelector(':scope > a > span');
      const childUl = li.querySelector(':scope > ul');

      return {
        id: id.replace(/^i/, ''),
        url: link ? link.getAttribute('href') : '',
        text: span ? span.textContent : (link ? link.textContent : ''),
        children: childUl ? parseList(childUl) : []
      };
    };

    /**
     * Парсит список элементов
     * @param {HTMLUListElement} ul - Список
     * @returns {Array} Массив узлов
     */
    const parseList = (ul) => {
      const items = [];
      const children = ul.children;

      for (let i = 0; i < children.length; i++) {
        const li = children[i];
        if (li.tagName !== 'LI') continue;
        items.push(parseLi(li, i));
      }

      return items;
    };

    const results = parseList(tocRoot);

    // Также ищем <li> элементы, которые оказались вне <ul id="toc">
    // из-за ошибок разметки
    const body = doc.body;
    if (body) {
      body.querySelectorAll('li[id^="i"]').forEach((li, idx) => {
        if (!tocRoot.contains(li)) {
          if (li.classList.contains('heading1')) {
            results.push(parseLi(li, results.length + idx));
          }
        }
      });
    }

    return { elements: results };
  },

  /**
   * Генерирует HTML оглавления из структуры
   * @param {Object} tocData - Структура оглавления
   * @param {string} originalHtml - Исходный HTML для сохранения обрамления
   * @returns {string} HTML оглавления
   */
  generateHtml(tocData, originalHtml) {
    /**
     * Генерирует HTML списка
     * @param {Array} items - Элементы списка
     * @param {number} level - Уровень вложенности
     * @returns {string} HTML
     */
    const generateList = (items, level = 1) => {
      if (!items || items.length === 0) return '';

      let html = level === 1
        ? '<ul id="toc" style="list-style-type:none;display:block;padding-left:0">\n'
        : '<ul style="list-style-type:none">\n';

      items.forEach(item => {
        const hasChildren = item.children && item.children.length > 0;
        const headingClass = `heading${level}`;
        const tocClass = hasChildren ? 'toc-folder' : 'toc-page';
        const dblClick = hasChildren ? ' ondblclick="return dblclicked(this)"' : '';

        html += `<li class="${headingClass} ${tocClass}" id="i${item.id}" onclick="return clicked(this,event)">`;
        html += `<a class="${headingClass}" id="a${item.id}" href="${item.url}" target="hmcontent">`;
        html += `<span class="${headingClass}" id="s${item.id}"${dblClick}>${item.text}</span></a>\n`;

        if (hasChildren) {
          html += generateList(item.children, Math.min(level + 1, 6));
        }

        html += '</li>\n';
      });

      html += '</ul>\n';
      return html;
    };

    // Извлекаем title из оригинала
    const titleMatch = originalHtml.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : 'Справка';

    // Генерируем чистый <head> без старых H&M скриптов (frame-based, expandall и пр.)
    const cleanHead = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <link type="text/css" href="default.css" rel="stylesheet" />
  <link type="text/css" href="scrollbars.css" rel="stylesheet" />

  <style type="text/css">
    body {
      font-size: 13px;
      font-family: 'Segoe UI', '-apple-system', BlinkMacSystemFont, Roboto, 'Helvetica Neue', Helvetica, Ubuntu, Arial, sans-serif;
      margin: 0;
      padding: 8px 0 8px 12px;
      color: #002669;
    }
    .heading1, .heading2, .heading3,
    .heading4, .heading5, .heading6 { color: #002669; text-decoration: none; }
    .hilight1, .hilight2, .hilight3,
    .hilight4, .hilight5, .hilight6 { color: #002669; background: #e0f0fc; text-decoration: none; }

    #toc, #toc ul { list-style: none; margin: 0; padding: 0; }
    #toc li { margin: 0; padding: 0; }

    #toc a {
      display: block;
      padding: 4px 8px 4px 4px;
      border-radius: 6px;
      color: #002669;
      text-decoration: none;
      font-size: 13px;
      line-height: 1.4;
      transition: background 0.15s ease;
    }
    #toc a:hover { background: #ecf4fb; }

    #toc .toc-folder > a::before {
      content: '';
      display: inline-block;
      width: 0; height: 0;
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
      border-left: 5px solid #93a3b8;
      margin-right: 6px;
      vertical-align: middle;
      transition: transform 0.2s ease;
      position: relative;
      top: -1px;
    }
    #toc .toc-folder.expanded > a::before {
      transform: rotate(90deg);
      border-left-color: #0054a0;
    }

    #toc .toc-page > a::before {
      content: '';
      display: inline-block;
      width: 4px; height: 4px;
      border-radius: 50%;
      background: #93a3b8;
      margin-right: 8px;
      vertical-align: middle;
      position: relative;
      top: -1px;
    }

    #toc .toc-folder > ul {
      margin-left: 9px;
      padding-left: 12px !important;
      border-left: 1px solid #e0f0fc;
    }

    #toc > li > a {
      font-weight: 500;
      font-size: 13.5px;
      padding: 5px 8px 5px 4px;
    }
    #toc .toc-folder > ul a {
      font-size: 13px;
      padding: 3px 8px 3px 4px;
    }

    #toc .toc-active > a {
      background: #e0f0fc;
      font-weight: 600;
    }
  </style>
  <link type="text/css" href="custom.css" rel="stylesheet" />
  <script type="text/javascript" src="helpman_settings.js"></script>
  <script type="text/javascript">
    function toggleNode(li, expand) {
      var ul = li.querySelector(':scope > ul');
      if (!ul) return;
      if (expand) {
        ul.style.display = 'block';
        li.classList.add('expanded');
      } else {
        ul.style.display = 'none';
        li.classList.remove('expanded');
      }
    }

    function collapseAll() {
      var folders = document.querySelectorAll('#toc .toc-folder');
      for (var i = 0; i < folders.length; i++) {
        toggleNode(folders[i], false);
      }
    }

    function expandAll() {
      var folders = document.querySelectorAll('#toc .toc-folder');
      for (var i = 0; i < folders.length; i++) {
        toggleNode(folders[i], true);
      }
    }

    function clicked(node, event) {
      event.stopPropagation();
      var li = node;
      var ul = li.querySelector(':scope > ul');
      document.querySelectorAll('#toc .toc-active').forEach(function(el) { el.classList.remove('toc-active'); });
      li.classList.add('toc-active');
      if (ul) {
        toggleNode(li, ul.style.display === 'none');
      }
      return true;
    }

    function dblclicked(node) {
      var li = node.closest('li');
      var ul = li.querySelector(':scope > ul');
      if (ul) {
        toggleNode(li, ul.style.display === 'none');
      }
      return false;
    }

    document.addEventListener('DOMContentLoaded', function() {
      var state = (typeof initialtocstate !== 'undefined') ? initialtocstate : 'collapseall';

      collapseAll();

      if (state === 'expandall') {
        expandAll();
      }

      try {
        var firstLink = document.querySelector('#toc a[href]');
        if (firstLink && window.parent && window.parent !== window) {
          window.parent.postMessage({type: 'tocFirstLink', href: firstLink.getAttribute('href')}, '*');
        }
      } catch(e) {}
    });
  </script>
</head>
<body>
`;

    return cleanHead + generateList(tocData.elements) + '\n</body>\n</html>';
  },

  /**
   * Поиск узла по ID
   * @param {Array} elements - Массив элементов для поиска
   * @param {string} targetId - ID искомого узла
   * @returns {Object|null} Найденный узел или null
   */
  findNode(elements, targetId) {
    if (!elements || !Array.isArray(elements)) return null;

    for (const node of elements) {
      if (node.id === targetId) return node;
      if (node.children) {
        const found = this.findNode(node.children, targetId);
        if (found) return found;
      }
    }
    return null;
  },

  /**
   * Поиск родителя и позиции узла
   * @param {Array} elements - Массив элементов для поиска
   * @param {string} targetId - ID искомого узла
   * @param {Object|null} parent - Родительский узел (для рекурсии)
   * @returns {{parent: Object|null, elements: Array, index: number}|null}
   */
  findParentAndIndex(elements, targetId, parent = null) {
    if (!elements || !Array.isArray(elements)) return null;

    for (let i = 0; i < elements.length; i++) {
      if (elements[i].id === targetId) {
        return { parent, elements, index: i };
      }
      if (elements[i].children) {
        const found = this.findParentAndIndex(elements[i].children, targetId, elements[i]);
        if (found) return found;
      }
    }
    return null;
  },

  /**
   * Генерирует уникальный ID для нового узла
   * @param {Object} tocData - Структура оглавления
   * @returns {string} Новый уникальный ID
   */
  generateNewId(tocData) {
    let maxNum = 0;

    const findMax = (elements) => {
      if (!elements) return;
      elements.forEach(node => {
        const num = parseInt(node.id.split('.')[0], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
        if (node.children) findMax(node.children);
      });
    };

    findMax(tocData.elements);
    return String(maxNum + 1);
  },

  /**
   * Добавляет новый узел в структуру
   * @param {Object} tocData - Структура оглавления
   * @param {string|null} parentId - ID родительского узла (null для корня)
   * @param {Object} newNode - Новый узел {url, text}
   * @returns {string} ID добавленного узла
   */
  addNode(tocData, parentId, newNode) {
    const newId = this.generateNewId(tocData);
    newNode.id = newId;
    newNode.children = [];

    if (!parentId) {
      tocData.elements.push(newNode);
    } else {
      const parent = this.findNode(tocData.elements, parentId);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(newNode);
      }
    }
    return newId;
  },

  /**
   * Удаляет узел из структуры
   * @param {Object} tocData - Структура оглавления
   * @param {string} nodeId - ID удаляемого узла
   * @returns {boolean} Успешность операции
   */
  removeNode(tocData, nodeId) {
    const info = this.findParentAndIndex(tocData.elements, nodeId);
    if (info) {
      info.elements.splice(info.index, 1);
      return true;
    }
    return false;
  },

  /**
   * Перемещает узел к новому родителю
   * @param {Object} tocData - Структура оглавления
   * @param {string} nodeId - ID перемещаемого узла
   * @param {string|null} newParentId - ID нового родителя (null для корня)
   * @returns {boolean} Успешность операции
   */
  moveNode(tocData, nodeId, newParentId) {
    const info = this.findParentAndIndex(tocData.elements, nodeId);
    if (!info) return false;

    const node = info.elements[info.index];
    info.elements.splice(info.index, 1);

    if (!newParentId) {
      tocData.elements.push(node);
    } else {
      const newParent = this.findNode(tocData.elements, newParentId);
      if (newParent) {
        if (!newParent.children) newParent.children = [];
        newParent.children.push(node);
      }
    }
    return true;
  },

  /**
   * Обходит все узлы дерева
   * @param {Array} elements - Элементы для обхода
   * @param {Function} callback - Функция обратного вызова (node, parent, index)
   * @param {Object|null} parent - Родительский узел
   */
  traverse(elements, callback, parent = null) {
    if (!elements || !Array.isArray(elements)) return;

    elements.forEach((node, index) => {
      callback(node, parent, index);
      if (node.children) {
        this.traverse(node.children, callback, node);
      }
    });
  },

  /**
   * Собирает все URL из структуры
   * @param {Object} tocData - Структура оглавления
   * @returns {Set<string>} Множество URL
   */
  collectUrls(tocData) {
    const urls = new Set();
    this.traverse(tocData.elements, (node) => {
      if (node.url) {
        urls.add(node.url.toLowerCase().split('#')[0].split('?')[0]);
      }
    });
    return urls;
  }
};

// Экспорт для браузера
window.TocParser = TocParser;
