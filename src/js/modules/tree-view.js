/**
 * Help Editor - Tree View
 *
 * Отображение и управление деревом разделов.
 * Поддерживает развёртывание/свёртывание, выбор, поиск,
 * а также отображение секций сирот (неиспользуемые страницы и изображения).
 *
 * @module modules/tree-view
 */

const TreeView = {
  /**
   * @type {HTMLElement|null}
   */
  container: null,

  /**
   * Развёрнутые узлы
   * @type {Set<string>}
   */
  expandedNodes: new Set(),

  /**
   * Развёрнутые секции сирот
   * @type {Set<string>}
   */
  expandedOrphans: new Set(),

  /**
   * Флаг первого сканирования (для автопрокрутки)
   * @type {boolean}
   */
  _firstScanDone: false,

  /**
   * Инициализация
   * @param {string} containerId - ID контейнера дерева
   */
  init(containerId) {
    this.container = document.getElementById(containerId);
    this.expandedNodes = new Set();
    this.expandedOrphans = new Set();
    this._firstScanDone = false;
  },

  /**
   * Отрисовка дерева
   * @param {Object} tocData - Структура оглавления
   */
  render(tocData) {
    if (!this.container || !tocData || !tocData.elements) return;

    const savedScroll = this.container.scrollTop;

    let html = this.renderNodes(tocData.elements);

    // Секция неиспользуемых страниц
    if (AppState.orphanPages && AppState.orphanPages.length > 0) {
      html += this.renderOrphanPagesSection(AppState.orphanPages, AppState.orphanSectionsExpanded.pages);
    }

    // Секция неиспользуемых изображений
    if (AppState.unusedImages && AppState.unusedImages.length > 0) {
      html += this.renderOrphanSection(
        'unused-images',
        `Неиспользуемые изображения (${AppState.unusedImages.length})`,
        AppState.unusedImages.map(img => ({
          id: 'unused-img:' + img,
          text: img.split('/').pop(),
          subtitle: img,
          icon: '🖼️',
          draggable: false
        })),
        AppState.orphanSectionsExpanded.images
      );
    }

    this.container.innerHTML = html;
    this.container.scrollTop = savedScroll;
    this.attachEventListeners();
    this.attachOrphanEventListeners();

    // После первого сканирования — прокрутить к секции сирот
    if (!this._firstScanDone && AppState.orphanPages && AppState.orphanPages.length > 0) {
      this._firstScanDone = true;
      const orphanSection = this.container.querySelector('.orphan-section');
      if (orphanSection) {
        setTimeout(() => orphanSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    }
  },

  /**
   * Рендерит узлы дерева
   * @param {Array} elements - Массив элементов
   * @param {number} level - Уровень вложенности
   * @returns {string} HTML
   */
  renderNodes(elements, level = 0) {
    if (!elements || !Array.isArray(elements)) return '';

    return elements.map(node => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = this.expandedNodes.has(node.id);
      const isSelected = AppState.selectedNode === node.id;

      const icon = hasChildren ? '📁' : '📄';
      const toggle = hasChildren
        ? `<span class="tree-toggle">${isExpanded ? '▼' : '▶'}</span>`
        : '<span class="tree-toggle"></span>';

      const arrows = isSelected ? `<span class="tree-arrows">
              <button class="arrow-btn" data-dir="up" title="Вверх">▲</button>
              <button class="arrow-btn" data-dir="down" title="Вниз">▼</button>
              <button class="arrow-btn" data-dir="left" title="Уменьшить вложенность">◀</button>
              <button class="arrow-btn" data-dir="right" title="Увеличить вложенность">▶</button>
            </span>` : '';

      let html = `
        <div class="tree-node" data-id="${node.id}">
          <div class="tree-node-content ${isSelected ? 'selected' : ''}"
               style="padding-left: ${level * 20 + 12}px">
            ${toggle}
            <span class="tree-icon">${icon}</span>
            <span class="tree-text">${this.escapeHtml(node.text)}</span>
            ${arrows}
          </div>
      `;

      if (hasChildren) {
        html += `<div class="tree-children ${isExpanded ? '' : 'collapsed'}">
          ${this.renderNodes(node.children, level + 1)}
        </div>`;
      }

      html += '</div>';
      return html;
    }).join('');
  },

  /**
   * Экранирование HTML
   * @param {string} text - Текст
   * @returns {string} Экранированный текст
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Привязка обработчиков событий
   */
  attachEventListeners() {
    this.container.querySelectorAll('.tree-node-content:not(.orphan-item):not(.orphan-resource-item)').forEach(el => {
      el.addEventListener('click', (e) => {
        // Игнорируем клики на стрелках перемещения
        if (e.target.closest('.arrow-btn')) return;

        const nodeId = el.parentElement.dataset.id;
        const toggle = el.querySelector('.tree-toggle');

        if (e.target === toggle || e.target.closest('.tree-toggle')) {
          this.toggleNode(nodeId);
        } else {
          this.selectNode(nodeId);
        }
      });

      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const nodeId = el.parentElement.dataset.id;
        this.selectNode(nodeId);
        ContextMenu.show(e.clientX, e.clientY, nodeId);
      });
    });

    // Обработчики стрелок перемещения
    this.container.querySelectorAll('.arrow-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nodeId = btn.closest('.tree-node').dataset.id;
        const dir = btn.dataset.dir;
        switch (dir) {
          case 'up': App.moveSectionUp(nodeId); break;
          case 'down': App.moveSectionDown(nodeId); break;
          case 'right': App.indentSection(nodeId); break;
          case 'left': App.outdentSection(nodeId); break;
        }
      });
    });
  },

  /**
   * Переключение развёрнутости узла
   * @param {string} nodeId - ID узла
   */
  toggleNode(nodeId) {
    if (this.expandedNodes.has(nodeId)) {
      this.expandedNodes.delete(nodeId);
    } else {
      this.expandedNodes.add(nodeId);
    }
    this.render(AppState.tocData);
  },

  /**
   * Выбор узла
   * @param {string} nodeId - ID узла
   */
  selectNode(nodeId) {
    if (AppState.hasUnsavedChanges) {
      App.saveCurrentContent();
    }

    AppState.selectedNode = nodeId;
    this.render(AppState.tocData);
    App.loadNodeContent(nodeId);

    // Отправляем событие
    if (typeof EventBus !== 'undefined') {
      EventBus.emit(Events.SECTION_SELECTED, nodeId);
    }
  },

  /**
   * Развернуть путь к узлу
   * @param {string} nodeId - ID узла
   */
  expandToNode(nodeId) {
    const expandParents = (elements, targetId, path = []) => {
      if (!elements || !Array.isArray(elements)) return null;
      for (const node of elements) {
        if (node.id === targetId) return path;
        if (node.children) {
          const result = expandParents(node.children, targetId, [...path, node.id]);
          if (result) return result;
        }
      }
      return null;
    };

    const path = expandParents(AppState.tocData.elements, nodeId);
    if (path) {
      path.forEach(id => this.expandedNodes.add(id));
    }
  },

  /**
   * Рендер секции неиспользуемых ресурсов
   * @param {string} sectionId - ID секции
   * @param {string} title - Заголовок
   * @param {Array} items - Элементы
   * @param {boolean} isExpanded - Развёрнута ли секция
   * @returns {string} HTML
   */
  renderOrphanSection(sectionId, title, items, isExpanded) {
    const toggleIcon = isExpanded ? '▼' : '▶';
    const collapsedClass = isExpanded ? '' : 'collapsed';

    let html = `
      <div class="orphan-section" data-section="${sectionId}">
        <div class="orphan-section-header">
          <span class="orphan-section-toggle">${toggleIcon}</span>
          <span class="orphan-section-title">${this.escapeHtml(title)}</span>
        </div>
        <div class="orphan-section-items ${collapsedClass}">
    `;

    items.forEach(item => {
      html += `
        <div class="tree-node orphan-node" data-id="${item.id}">
          <div class="tree-node-content orphan-item"
               style="padding-left: 24px"
               ${item.draggable ? 'draggable="true"' : ''}
               title="${this.escapeHtml(item.subtitle || '')}">
            <span class="tree-toggle"></span>
            <span class="tree-icon">${item.icon}</span>
            <span class="tree-text orphan-text">${this.escapeHtml(item.text)}</span>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    return html;
  },

  /**
   * Рендер секции неиспользуемых страниц
   * @param {Array} orphanPages - Страницы-сироты
   * @param {boolean} isExpanded - Развёрнута ли секция
   * @returns {string} HTML
   */
  renderOrphanPagesSection(orphanPages, isExpanded) {
    const toggleIcon = isExpanded ? '▼' : '▶';
    const collapsedClass = isExpanded ? '' : 'collapsed';

    let html = `
      <div class="orphan-section" data-section="orphan-pages">
        <div class="orphan-section-header">
          <span class="orphan-section-toggle">${toggleIcon}</span>
          <span class="orphan-section-title">${this.escapeHtml(`Неиспользуемые страницы (${orphanPages.length})`)}</span>
        </div>
        <div class="orphan-section-items ${collapsedClass}">
    `;

    orphanPages.forEach(p => {
      html += `
        <div class="tree-node orphan-node" data-id="orphan:${p.filename}">
          <div class="tree-node-content orphan-item"
               style="padding-left: 24px"
               title="${this.escapeHtml(p.filename)}">
            <span class="tree-toggle"></span>
            <span class="tree-icon">📄</span>
            <span class="tree-text orphan-text">${this.escapeHtml(p.title)}</span>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    return html;
  },

  /**
   * Привязка обработчиков для секций сирот
   */
  attachOrphanEventListeners() {
    // Разворачивание / сворачивание секций
    this.container.querySelectorAll('.orphan-section-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.orphan-section');
        const sectionId = section.dataset.section;
        const items = section.querySelector('.orphan-section-items');
        const toggle = header.querySelector('.orphan-section-toggle');

        const isCollapsed = items.classList.contains('collapsed');
        items.classList.toggle('collapsed');
        toggle.textContent = isCollapsed ? '▼' : '▶';

        if (sectionId === 'orphan-pages') {
          AppState.orphanSectionsExpanded.pages = isCollapsed;
        } else if (sectionId === 'unused-images') {
          AppState.orphanSectionsExpanded.images = isCollapsed;
        }
      });
    });

    // Обработчики для элементов-сирот
    this.container.querySelectorAll('.orphan-node').forEach(nodeEl => {
      const content = nodeEl.querySelector(':scope > .tree-node-content');
      const nodeId = nodeEl.dataset.id;

      // Клик — превью файла
      content.addEventListener('click', () => {
        if (nodeId.startsWith('orphan:')) {
          const filename = nodeId.substring('orphan:'.length);
          App.previewOrphanFile(filename);
        }
      });

      // Правый клик — контекстное меню
      content.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (nodeId.startsWith('orphan:')) {
          const filename = nodeId.substring('orphan:'.length);
          OrphanContextMenu.show(e.clientX, e.clientY, filename);
        } else if (nodeId.startsWith('unused-img:')) {
          const imagePath = nodeId.substring('unused-img:'.length);
          ImageContextMenu.show(e.clientX, e.clientY, imagePath);
        }
      });
    });
  },

  /**
   * Сохранённое состояние expandedNodes до фильтрации
   * @type {Set<string>|null}
   */
  _savedExpandedNodes: null,

  /**
   * Фильтрация дерева по тексту
   * @param {string} searchText - Текст поиска
   */
  filter(searchText) {
    if (!searchText) {
      // Восстанавливаем сохранённое состояние при очистке фильтра
      if (this._savedExpandedNodes) {
        this.expandedNodes = this._savedExpandedNodes;
        this._savedExpandedNodes = null;
      }
      this.render(AppState.tocData);
      return;
    }

    // Сохраняем текущее состояние перед первой фильтрацией
    if (!this._savedExpandedNodes) {
      this._savedExpandedNodes = new Set(this.expandedNodes);
    }

    const matches = new Set();
    const searchLower = searchText.toLowerCase();

    const findMatches = (elements, path = []) => {
      if (!elements || !Array.isArray(elements)) return;
      elements.forEach(node => {
        if (node.text.toLowerCase().includes(searchLower)) {
          matches.add(node.id);
          path.forEach(p => this.expandedNodes.add(p));
        }
        if (node.children) {
          findMatches(node.children, [...path, node.id]);
        }
      });
    };

    findMatches(AppState.tocData.elements);
    this.render(AppState.tocData);

    // Скрываем узлы которые не совпадают и не содержат совпадающих детей
    const visibleNodes = new Set(matches);
    // Добавляем всех родителей совпавших узлов
    const addParents = (elements, path = []) => {
      if (!elements) return;
      elements.forEach(node => {
        if (matches.has(node.id)) {
          path.forEach(p => visibleNodes.add(p));
        }
        if (node.children) {
          addParents(node.children, [...path, node.id]);
        }
      });
    };
    addParents(AppState.tocData.elements);

    this.container.querySelectorAll('.tree-node:not(.orphan-node)').forEach(el => {
      const nodeId = el.dataset.id;
      if (!visibleNodes.has(nodeId)) {
        el.style.display = 'none';
      } else {
        el.style.display = '';
        if (matches.has(nodeId)) {
          el.querySelector('.tree-node-content').style.backgroundColor = '#fff3cd';
        }
      }
    });

    // Фильтрация в секциях сирот
    this.container.querySelectorAll('.orphan-node').forEach(el => {
      const id = el.dataset.id;
      let text = '';
      if (id.startsWith('orphan:')) {
        const filename = id.substring('orphan:'.length);
        const orphan = AppState.orphanPages.find(p => p.filename === filename);
        text = orphan ? (orphan.title + ' ' + filename).toLowerCase() : '';
      } else if (id.startsWith('unused-img:')) {
        text = id.substring('unused-img:'.length).toLowerCase();
      }

      if (!text.includes(searchLower)) {
        el.style.display = 'none';
      } else {
        el.style.display = '';
        el.querySelector('.tree-node-content').style.backgroundColor = '#fff3cd';
      }
    });
  }
};

// Экспорт для браузера
window.TreeView = TreeView;
