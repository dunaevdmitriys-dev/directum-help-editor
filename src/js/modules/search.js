/**
 * Help Editor - Full-text Search Module
 *
 * Полнотекстовый поиск с:
 * - Инвертированным индексом (быстрый поиск)
 * - Стеммингом для русского языка
 * - Нечётким поиском (опечатки)
 * - Wildcard (* и ?)
 * - Кэшированием индекса
 */

const Search = {
  // Кэш документов {id: {title, url, content}}
  documents: new Map(),

  // Инвертированный индекс {stem: Set<docId>}
  invertedIndex: new Map(),

  // Состояние
  isIndexReady: false,
  isIndexing: false,
  mode: 'title',

  // Русские окончания для стемминга
  _ruEndings: [
    'ами', 'ями', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ать', 'ять',
    'ить', 'ение', 'ания', 'ство', 'ость', 'ной', 'ный', 'ная', 'ное',
    'ых', 'их', 'ой', 'ий', 'ый', 'ая', 'яя', 'ое', 'ее', 'ие',
    'ам', 'ям', 'ом', 'ем', 'ов', 'ев', 'ей', 'ах', 'ях',
    'ть', 'ся', 'ут', 'ют', 'ат', 'ят', 'ет', 'ит',
    'а', 'я', 'о', 'е', 'и', 'ы', 'у', 'ю'
  ],

  init() {
    this.mode = 'title';
    this.isIndexReady = false;
    this.isIndexing = false;
    this.documents = new Map();
    this.invertedIndex = new Map();

    if (typeof EventBus !== 'undefined') {
      EventBus.on(Events.PROJECT_OPENED, () => this.loadOrBuildIndex());
      EventBus.on(Events.CONTENT_SAVED, ({ nodeId }) => this.updateDocument(nodeId));
      EventBus.on(Events.SECTION_ADDED, ({ id }) => this.updateDocument(id));
      EventBus.on(Events.SECTION_DELETED, (nodeId) => this.removeDocument(nodeId));
    }
  },

  /**
   * Загрузить кэш или построить индекс
   */
  async loadOrBuildIndex() {
    if (!AppState.tocData || !AppState.projectPath) return;
    if (this.isIndexing) return;

    // Пробуем загрузить кэш
    const cacheLoaded = await this._loadCache();
    if (cacheLoaded) {
      console.log('Search: loaded from cache');
      StatusBar.setStatus(`Индекс загружен: ${this.documents.size} док.`);
      setTimeout(() => StatusBar.update(), 2000);
      return;
    }

    // Строим новый индекс
    await this.buildIndex();
  },

  /**
   * Загрузить кэш из файла
   */
  async _loadCache() {
    try {
      const result = await window.api.readFile('.helpeditor_cache.json');
      if (!result.success) return false;

      const cache = JSON.parse(result.content);

      // Проверяем версию кэша
      if (cache.version !== 2) return false;

      // Восстанавливаем данные
      this.documents = new Map(cache.documents);
      this.invertedIndex = new Map();

      // Восстанавливаем инвертированный индекс
      for (const [stem, docIds] of cache.invertedIndex) {
        this.invertedIndex.set(stem, new Set(docIds));
      }

      this.isIndexReady = true;
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Сохранить кэш в файл
   */
  async _saveCache() {
    try {
      const cache = {
        version: 2,
        documents: Array.from(this.documents.entries()),
        invertedIndex: Array.from(this.invertedIndex.entries()).map(
          ([stem, docIds]) => [stem, Array.from(docIds)]
        )
      };
      // Кеш хранится только в памяти, не пишем в папку проекта
    } catch (e) {
      console.warn('Failed to save search cache:', e);
    }
  },

  /**
   * Построение индекса
   */
  async buildIndex() {
    if (!AppState.tocData) return;
    if (this.isIndexing) return;

    this.isIndexing = true;
    this.isIndexReady = false;
    this.documents.clear();
    this.invertedIndex.clear();

    StatusBar.setStatus('Индексация...');

    try {
      const nodes = this._collectAllNodes(AppState.tocData.elements);
      const total = nodes.length;
      let indexed = 0;

      for (const node of nodes) {
        if (node.url) {
          try {
            const result = await window.api.readFile(node.url);
            if (result.success) {
              const content = this._extractText(result.content);

              // Сохраняем документ
              this.documents.set(node.id, {
                id: node.id,
                title: node.text,
                url: node.url,
                content: content
              });

              // Добавляем в инвертированный индекс
              this._indexDocument(node.id, node.text + ' ' + content);

              indexed++;
              if (indexed % 20 === 0) {
                StatusBar.setStatus(`Индексация ${indexed}/${total}`);
              }
            }
          } catch (e) { /* skip */ }
        }
      }

      this.isIndexReady = true;
      this.isIndexing = false;

      // Сохраняем кэш
      await this._saveCache();

      console.log('Search: indexed', indexed, 'documents');
      StatusBar.setStatus(`Индекс: ${indexed} док.`);
      setTimeout(() => StatusBar.update(), 2000);

    } catch (e) {
      console.error('Search index error:', e);
      this.isIndexing = false;
    }
  },

  /**
   * Добавить документ в инвертированный индекс
   */
  _indexDocument(docId, text) {
    const words = this._tokenize(text);
    for (const word of words) {
      const stem = this._stem(word);
      if (stem.length < 2) continue;

      if (!this.invertedIndex.has(stem)) {
        this.invertedIndex.set(stem, new Set());
      }
      this.invertedIndex.get(stem).add(docId);
    }
  },

  /**
   * Токенизация текста
   */
  _tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2);
  },

  /**
   * Простой стемминг для русского языка
   */
  _stem(word) {
    if (word.length < 4) return word;

    for (const ending of this._ruEndings) {
      if (word.endsWith(ending) && word.length - ending.length >= 2) {
        return word.slice(0, -ending.length);
      }
    }
    return word;
  },

  /**
   * Расстояние Левенштейна (для fuzzy search)
   */
  _levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  },

  /**
   * Найти похожие стемы в индексе (fuzzy)
   */
  _findSimilarStems(stem, maxDistance = 2) {
    const similar = [];
    for (const indexedStem of this.invertedIndex.keys()) {
      if (Math.abs(indexedStem.length - stem.length) > maxDistance) continue;
      const dist = this._levenshtein(stem, indexedStem);
      if (dist <= maxDistance) {
        similar.push(indexedStem);
      }
    }
    return similar;
  },

  /**
   * Паттерн с * и ? в RegExp
   */
  _patternToRegex(pattern) {
    let escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    escaped = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(escaped, 'i');
  },

  /**
   * Основной поиск
   */
  search(query, options = {}) {
    if (!query || !this.isIndexReady) return [];

    const hasWildcard = query.includes('*') || query.includes('?');
    const queryLower = query.toLowerCase();

    // Wildcard поиск
    if (hasWildcard) {
      return this._wildcardSearch(query);
    }

    // Простой поиск по подстроке в контенте (без fuzzy для скорости)
    const results = [];

    for (const [docId, doc] of this.documents) {
      const contentLower = doc.content.toLowerCase();
      const titleLower = doc.title.toLowerCase();

      // Проверяем вхождение запроса
      const inContent = contentLower.includes(queryLower);
      const inTitle = titleLower.includes(queryLower);

      if (inContent || inTitle) {
        // Определяем релевантность
        let priority = 3;
        if (titleLower.startsWith(queryLower)) priority = 0;
        else if (inTitle) priority = 1;
        else if (inContent) priority = 2;

        results.push({
          id: docId,
          title: doc.title,
          url: doc.url,
          snippet: this._getSnippet(doc.content, query),
          priority,
          inContent,
          inTitle
        });
      }
    }

    // Сортируем по релевантности
    results.sort((a, b) => a.priority - b.priority);

    return results.slice(0, 50);
  },

  /**
   * Wildcard поиск
   */
  _wildcardSearch(query) {
    const regex = this._patternToRegex(query);
    const results = [];

    for (const [id, doc] of this.documents) {
      const titleMatch = regex.test(doc.title);
      const contentMatch = regex.test(doc.content);

      if (titleMatch || contentMatch) {
        results.push({
          id,
          title: doc.title,
          url: doc.url,
          snippet: this._getSnippet(doc.content, query.replace(/[*?]/g, '')),
          priority: titleMatch ? 0 : 1
        });
      }
    }

    results.sort((a, b) => a.priority - b.priority);
    return results.slice(0, 50);
  },

  /**
   * Обновить документ
   */
  async updateDocument(nodeId) {
    if (!AppState.tocData) return;

    const node = TocParser.findNode(AppState.tocData.elements, nodeId);
    if (!node || !node.url) return;

    try {
      const result = await window.api.readFile(node.url);
      if (result.success) {
        const content = this._extractText(result.content);

        // Удаляем старые записи из инвертированного индекса
        this._removeFromIndex(nodeId);

        // Добавляем новые
        this.documents.set(nodeId, {
          id: nodeId,
          title: node.text,
          url: node.url,
          content
        });
        this._indexDocument(nodeId, node.text + ' ' + content);

        // Обновляем кэш
        await this._saveCache();
      }
    } catch (e) { /* skip */ }
  },

  /**
   * Удалить документ
   */
  removeDocument(nodeId) {
    this._removeFromIndex(nodeId);
    this.documents.delete(nodeId);
    this._saveCache();
  },

  /**
   * Удалить документ из инвертированного индекса
   */
  _removeFromIndex(docId) {
    for (const docIds of this.invertedIndex.values()) {
      docIds.delete(docId);
    }
  },

  /**
   * Выполнить поиск и показать результаты
   */
  performSearch(query) {
    if (!query || query.length < 2) {
      this.hideResults();
      return;
    }

    AppState.searchQuery = query;
    let results = this.search(query);

    // В режиме "Содержимое" показываем только результаты с найденным текстом в контенте
    if (this.mode === 'content') {
      results = results.filter(r => r.inContent);
    }

    AppState.searchResults = results;

    this.renderResults(results);
    this.showResults();
  },

  /**
   * Отрисовка результатов
   */
  renderResults(results) {
    const countEl = document.getElementById('search-results-count');
    const listEl = document.getElementById('search-results-list');

    if (!listEl) return;

    if (countEl) {
      countEl.textContent = `Найдено: ${results.length}`;
    }

    if (results.length === 0) {
      listEl.innerHTML = '<div class="search-no-results">Ничего не найдено</div>';
      return;
    }

    listEl.innerHTML = results.map(r => `
      <div class="search-result-item" data-node-id="${r.id}">
        <div class="search-result-title">${this._escapeHtml(r.title)}</div>
        <div class="search-result-snippet">${r.snippet}</div>
      </div>
    `).join('');

    listEl.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const nodeId = item.dataset.nodeId;
        listEl.querySelectorAll('.search-result-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        TreeView.expandToNode(nodeId);
        TreeView.selectNode(nodeId);
      });
    });
  },

  showResults() {
    const panel = document.getElementById('search-results-panel');
    if (panel) {
      panel.classList.remove('hidden');
      AppState.isSearchResultsVisible = true;
    }
  },

  hideResults() {
    const panel = document.getElementById('search-results-panel');
    if (panel) {
      panel.classList.add('hidden');
      AppState.isSearchResultsVisible = false;
    }
  },

  setMode(mode) {
    this.mode = mode;
    AppState.searchMode = mode;
  },

  /**
   * Данные для генерации search_index.json
   * Возвращает полный контент для качественного поиска на клиенте
   */
  getIndexData() {
    const entries = [];
    for (const [id, doc] of this.documents) {
      entries.push({
        id,
        title: doc.title,
        url: doc.url,
        // Полный контент для MiniSearch (до 15000 символов на документ)
        content: doc.content.substring(0, 15000)
      });
    }
    return { entries };
  },

  // === Утилиты ===

  _extractText(html) {
    const div = document.createElement('div');
    div.innerHTML = html;

    // Удаляем служебные элементы и навигацию
    div.querySelectorAll('script, style, noscript, nav, header, footer').forEach(el => el.remove());

    // Удаляем элементы Help & Manual (навигация, хлебные крошки)
    div.querySelectorAll('#idheader, #printheader, #idnav, .breadcrumb, .navigation').forEach(el => el.remove());

    // Удаляем ссылки "Click to Display Table of Contents"
    div.querySelectorAll('a').forEach(a => {
      if (a.textContent.includes('Click to Display') || a.textContent.includes('Table of Contents')) {
        const parent = a.closest('p') || a.closest('div') || a;
        parent.remove();
      }
    });

    // Берём только основной контент если есть
    const content = div.querySelector('#innerdiv, #idcontent, .content, main, article');
    const textSource = content || div;

    return (textSource.textContent || '').replace(/\s+/g, ' ').trim();
  },

  _getSnippet(text, query) {
    if (!text || !query) return '';

    const maxLength = 150;
    const queryClean = query.replace(/[*?]/g, '').toLowerCase();
    const lowerText = text.toLowerCase();
    const pos = lowerText.indexOf(queryClean);

    if (pos === -1) {
      return this._escapeHtml(text.substring(0, maxLength)) + (text.length > maxLength ? '...' : '');
    }

    let start = Math.max(0, pos - 50);
    let end = Math.min(text.length, pos + queryClean.length + 100);

    if (start > 0) {
      const spacePos = text.indexOf(' ', start);
      if (spacePos !== -1 && spacePos < pos) start = spacePos + 1;
    }

    let snippet = text.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    const escapedQuery = queryClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    snippet = this._escapeHtml(snippet);
    snippet = snippet.replace(new RegExp(`(${escapedQuery})`, 'gi'), '<mark>$1</mark>');

    return snippet;
  },

  _collectAllNodes(elements) {
    const nodes = [];
    const collect = (items) => {
      if (!items) return;
      for (const item of items) {
        nodes.push(item);
        if (item.children) collect(item.children);
      }
    };
    collect(elements);
    return nodes;
  },

  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

window.Search = Search;
