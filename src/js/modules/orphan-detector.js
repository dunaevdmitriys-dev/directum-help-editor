/**
 * Help Editor - Orphan & Unused Resource Detector
 *
 * Обнаружение неиспользуемых файлов в проекте:
 * - Страницы (.htm), не включённые в оглавление
 * - Изображения, на которые нет ссылок
 *
 * @module modules/orphan-detector
 */

const OrphanDetector = {
  /**
   * Системные файлы Help & Manual, которые не считаются сиротами
   * @type {Set<string>}
   */
  SYSTEM_FILES: new Set([
    'hmcontent.htm', 'hmindex.htm', 'hmtopic.htm', 'hmsearch.htm',
    'hmresult.htm', 'hmquery.htm', 'hmnavigation.htm',
    'default.htm', 'index.htm', 'toc.htm'
  ]),

  /**
   * Расширения файлов изображений
   * @type {string[]}
   */
  IMAGE_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.bmp', '.webp'],

  /**
   * Нормализует URL для сравнения
   * @param {string} url - Исходный URL
   * @returns {string} Нормализованный URL
   */
  normalizeUrl(url) {
    let u = url.toLowerCase().split('#')[0].split('?')[0];
    try {
      u = decodeURIComponent(u);
    } catch (e) {
      // Игнорируем ошибки декодирования
    }
    u = u.replace(/^\.\//, '').replace(/\\/g, '/');
    return u;
  },

  /**
   * Собирает все URL из структуры оглавления
   * @param {Object} tocData - Структура оглавления
   * @returns {Set<string>} Множество нормализованных URL
   */
  collectTocUrls(tocData) {
    const urls = new Set();
    const walk = (elements) => {
      if (!elements) return;
      elements.forEach(node => {
        if (node.url) {
          urls.add(this.normalizeUrl(node.url));
        }
        if (node.children) walk(node.children);
      });
    };
    walk(tocData.elements);
    return urls;
  },

  /**
   * Обнаруживает страницы-сироты (не в оглавлении)
   * @param {Object} tocData - Структура оглавления
   * @returns {Promise<Array<{filename: string, title: string, images: string[], styles: string[]}>>}
   */
  async detectOrphanPages(tocData) {
    if (!AppState.projectPath) return [];

    const tocUrls = this.collectTocUrls(tocData);
    const allHtmFiles = await window.api.listFilesRecursive(null, ['.htm']);

    const orphans = [];

    for (const filename of allHtmFiles) {
      const normalized = this.normalizeUrl(filename);
      const baseName = normalized.includes('/') ? normalized.split('/').pop() : normalized;

      // Пропускаем системные файлы
      if (this.SYSTEM_FILES.has(normalized) || this.SYSTEM_FILES.has(baseName)) continue;

      // Пропускаем файлы, которые есть в оглавлении
      if (tocUrls.has(normalized) || tocUrls.has(baseName)) continue;

      const { title, images, styles } = await this.extractPageInfo(filename);
      orphans.push({ filename, title, images, styles });
    }

    return orphans;
  },

  /**
   * Извлекает информацию о странице
   * @param {string} filename - Путь к файлу
   * @returns {Promise<{title: string, images: string[], styles: string[]}>}
   */
  async extractPageInfo(filename) {
    const info = {
      title: filename.replace(/\.htm$/i, ''),
      images: [],
      styles: []
    };

    try {
      const result = await window.api.readFile(filename);
      if (!result.success) return info;

      const parser = new DOMParser();
      const doc = parser.parseFromString(result.content, 'text/html');

      // Извлекаем заголовок
      const titleEl = doc.querySelector('title');
      if (titleEl && titleEl.textContent.trim()) {
        info.title = titleEl.textContent.trim();
      } else {
        const h1 = doc.querySelector('h1');
        if (h1 && h1.textContent.trim()) {
          info.title = h1.textContent.trim();
        }
      }

      // Собираем изображения
      const imgSet = new Set();

      // <img src="...">
      doc.querySelectorAll('img[src]').forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('data:') && !src.startsWith('http')) {
          imgSet.add(src);
        }
      });

      // background="..."
      doc.querySelectorAll('[background]').forEach(el => {
        const bg = el.getAttribute('background');
        if (bg && !bg.startsWith('data:') && !bg.startsWith('http')) {
          imgSet.add(bg);
        }
      });

      // url() в style атрибутах
      doc.querySelectorAll('[style]').forEach(el => {
        const style = el.getAttribute('style');
        const urlMatch = style.match(/url\(\s*["']?([^"')]+)["']?\s*\)/gi);
        if (urlMatch) {
          urlMatch.forEach(m => {
            const inner = m.match(/url\(\s*["']?([^"')]+)["']?\s*\)/i);
            if (inner && inner[1] && !inner[1].startsWith('data:') && !inner[1].startsWith('http')) {
              imgSet.add(inner[1]);
            }
          });
        }
      });

      info.images = [...imgSet];

      // Собираем CSS файлы
      doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const href = link.getAttribute('href');
        if (href) info.styles.push(href);
      });

    } catch (e) {
      console.error('Error extracting page info:', filename, e);
    }

    return info;
  },

  /**
   * Извлекает только заголовок страницы
   * @param {string} filename - Путь к файлу
   * @returns {Promise<string>} Заголовок
   */
  async extractTitle(filename) {
    try {
      const result = await window.api.readFile(filename);
      if (!result.success) return filename.replace(/\.htm$/i, '');

      const parser = new DOMParser();
      const doc = parser.parseFromString(result.content, 'text/html');

      const titleEl = doc.querySelector('title');
      if (titleEl && titleEl.textContent.trim()) {
        return titleEl.textContent.trim();
      }

      const h1 = doc.querySelector('h1');
      if (h1 && h1.textContent.trim()) {
        return h1.textContent.trim();
      }
    } catch (e) {
      console.error('Error extracting title from', filename, e);
    }

    return filename.replace(/\.htm$/i, '');
  },

  /**
   * Обнаруживает неиспользуемые изображения
   * @param {Object} tocData - Структура оглавления (не используется, сканируются все файлы)
   * @returns {Promise<string[]>} Массив путей к неиспользуемым изображениям
   */
  async detectUnusedImages(tocData) {
    if (!AppState.projectPath) return [];

    const allImages = await window.api.listFilesRecursive(null, this.IMAGE_EXTENSIONS);
    if (allImages.length === 0) return [];

    // Собираем все ссылки на изображения из всех .htm файлов
    const referencedImages = new Set();
    const allHtmFiles = await window.api.listFilesRecursive(null, ['.htm']);

    for (const htmFile of allHtmFiles) {
      try {
        const result = await window.api.readFile(htmFile);
        if (!result.success) continue;

        // src="..." и background="..."
        const srcPattern = /(?:src|background)\s*=\s*["']([^"']+)["']/gi;
        let match;
        while ((match = srcPattern.exec(result.content)) !== null) {
          const ref = match[1].replace(/\\/g, '/').toLowerCase();
          if (ref.startsWith('http://') || ref.startsWith('https://') ||
              ref.startsWith('data:') || ref.startsWith('file://')) continue;
          referencedImages.add(ref);
        }

        // url(...)
        const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
        while ((match = urlPattern.exec(result.content)) !== null) {
          const ref = match[1].replace(/\\/g, '/').toLowerCase();
          if (ref.startsWith('http://') || ref.startsWith('https://') ||
              ref.startsWith('data:')) continue;
          referencedImages.add(ref);
        }
      } catch (e) {
        console.error('Error scanning', htmFile, e);
      }
    }

    // Также проверяем CSS файлы
    const allCssFiles = await window.api.listFiles(null, '.css');
    for (const cssFile of allCssFiles) {
      try {
        const result = await window.api.readFile(cssFile);
        if (!result.success) continue;

        const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
        let match;
        while ((match = urlPattern.exec(result.content)) !== null) {
          const ref = match[1].replace(/\\/g, '/').toLowerCase();
          if (ref.startsWith('http://') || ref.startsWith('https://') ||
              ref.startsWith('data:')) continue;
          referencedImages.add(ref);
        }
      } catch (e) {
        console.error('Error scanning CSS', cssFile, e);
      }
    }

    // Фильтруем изображения, на которые нет ссылок
    return allImages.filter(imgPath => {
      const normalized = imgPath.replace(/\\/g, '/').toLowerCase();
      const justFilename = normalized.split('/').pop();
      return !referencedImages.has(normalized) && !referencedImages.has(justFilename);
    });
  },

  /**
   * Выполняет полное сканирование проекта
   * Обновляет AppState.orphanPages и AppState.unusedImages
   * @returns {Promise<void>}
   */
  async scan() {
    if (!AppState.tocData || !AppState.projectPath) return;

    let orphanPages = [];
    let unusedImages = [];

    try {
      orphanPages = await this.detectOrphanPages(AppState.tocData);
    } catch (e) {
      console.error('Error detecting orphan pages:', e);
    }

    try {
      unusedImages = await this.detectUnusedImages(AppState.tocData);
    } catch (e) {
      console.error('Error detecting unused images:', e);
    }

    AppState.orphanPages = orphanPages;
    AppState.unusedImages = unusedImages;

    // Отправляем событие о завершении сканирования
    if (typeof EventBus !== 'undefined') {
      EventBus.emit(Events.ORPHANS_SCANNED, { orphanPages, unusedImages });
    }

    // Перерисовываем дерево если TreeView доступен
    if (typeof TreeView !== 'undefined') {
      TreeView.render(AppState.tocData);
    }
  }
};

// Экспорт для браузера
window.OrphanDetector = OrphanDetector;
