/**
 * Help Editor - Main Application Module
 *
 * Главный модуль приложения.
 * Инициализация, обработка событий, основные операции с проектом.
 *
 * @module modules/app
 */

const App = {
  /**
   * Инициализация приложения
   */
  async init() {
    // Инициализация модулей
    TreeView.init('tree-container');
    ContextMenu.init();
    OrphanContextMenu.init();
    ImageContextMenu.init();
    CodeEditor.init();
    Preview.init();
    ViewSwitcher.init();
    VideoEditor.init();
    Search.init();

    await Editor.init();

    // Обработчики кнопок UI
    document.getElementById('btn-create-project')?.addEventListener('click', () => {
      Dialogs.showCreateProjectDialog();
    });

    document.getElementById('btn-open-folder')?.addEventListener('click', async () => {
      await window.api.openFolderDialog();
    });

    document.getElementById('btn-publish')?.addEventListener('click', () => {
      Dialogs.showPublishDialog();
    });

    document.getElementById('btn-change-template')?.addEventListener('click', () => {
      Dialogs.showChangeTemplateDialog();
    });

    // Поиск с debounce и переключением режимов
    const searchInput = document.getElementById('search-input');
    let searchTimeout;

    searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();

      if (Search.mode === 'title') {
        // Режим поиска по названиям (мгновенно)
        TreeView.filter(query);
        Search.hideResults();
      } else {
        // Режим полнотекстового поиска (с debounce)
        searchTimeout = setTimeout(() => {
          if (query.length >= 2) {
            Search.performSearch(query);
          } else {
            Search.hideResults();
          }
        }, 500);
      }
    });

    // Переключатели режима поиска
    document.getElementById('btn-search-title')?.addEventListener('click', () => {
      Search.setMode('title');
      document.getElementById('btn-search-title').classList.add('active');
      document.getElementById('btn-search-content').classList.remove('active');
      Search.hideResults();
      const query = searchInput?.value.trim();
      if (query) TreeView.filter(query);
    });

    document.getElementById('btn-search-content')?.addEventListener('click', () => {
      Search.setMode('content');
      document.getElementById('btn-search-content').classList.add('active');
      document.getElementById('btn-search-title').classList.remove('active');
      // Восстанавливаем дерево без раскрытых от фильтра узлов
      TreeView.filter('');
      const query = searchInput?.value.trim();
      if (query && query.length >= 2) {
        Search.performSearch(query);
      }
    });

    // Закрытие панели результатов
    document.getElementById('btn-close-search-results')?.addEventListener('click', () => {
      Search.hideResults();
    });

    document.getElementById('btn-add-section')?.addEventListener('click', () => {
      Dialogs.showAddSection(AppState.selectedNode);
    });

    document.getElementById('btn-save')?.addEventListener('click', () => this.saveAll());
    document.getElementById('btn-save-all')?.addEventListener('click', () => this.saveAll());
    document.getElementById('btn-build')?.addEventListener('click', () => this.build());

    // Кнопки отмены в модальных окнах
    document.querySelectorAll('[id$="-cancel"]').forEach(btn => {
      btn.addEventListener('click', () => Dialogs.hideModal());
    });

    // Переключение табов
    document.querySelectorAll('.tabs').forEach(tabContainer => {
      tabContainer.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.dataset.tab;
          tabContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const modal = tabContainer.closest('.modal');
          if (modal) {
            modal.querySelectorAll('.tab-content').forEach(content => {
              content.classList.toggle('active', content.id === tab);
              content.classList.toggle('hidden', content.id !== tab);
            });
          }
        });
      });
    });

    // Горячие клавиши
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault();
          this.saveAll();
        } else if (e.key === 'n') {
          e.preventDefault();
          Dialogs.showAddSection(AppState.selectedNode);
        }
      }
      if (e.key === 'F2' && AppState.selectedNode) {
        e.preventDefault();
        Dialogs.showRename(AppState.selectedNode);
      }
      if (e.key === 'Delete' && AppState.selectedNode && !e.target.matches('input, textarea')) {
        e.preventDefault();
        this.deleteSection(AppState.selectedNode);
      }
      if (e.key === 'Escape') {
        Dialogs.hideModal();
      }
    });

    // Обработчики событий от Electron меню
    window.api.onProjectOpened((path) => this.openProject(path));
    window.api.onMenuSave(() => this.saveCurrentContent());
    window.api.onMenuSaveAll(() => this.saveAll());
    window.api.onMenuBuild(() => this.build());
    window.api.onMenuAddSection(() => Dialogs.showAddSection(AppState.selectedNode));
    window.api.onMenuDeleteSection(() => this.deleteSection(AppState.selectedNode));
    window.api.onMenuRenameSection(() => Dialogs.showRename(AppState.selectedNode));
    window.api.onMenuInsertImage(() => Dialogs.showImageDialog());
    window.api.onMenuInsertLink(() => Dialogs.showLinkDialog());
    window.api.onMenuInsertTable(() => Dialogs.showTableDialog());
    window.api.onMenuInsertVideo(() => Dialogs.showVideoDialog());
    window.api.onMenuView((view) => ViewSwitcher.switchTo(view));
    window.api.onMenuCreateProject(() => Dialogs.showCreateProjectDialog());

    StatusBar.update();
  },

  /**
   * Открыть проект
   * @param {string} path - Путь к папке проекта
   */
  async openProject(path) {
    try {
      AppState.projectPath = path;

      // Переинициализация TinyMCE с правильным base URL
      await Editor.reinit(path);

      const tocResult = await window.api.readFile('hmcontent.htm');
      if (tocResult.success) {
        // Автобэкап оригинального hmcontent.htm
        try {
          await window.api.writeFile('hmcontent.htm.backup', tocResult.content);
        } catch (e) {
          console.warn('Could not create hmcontent.htm backup:', e);
        }

        AppState.originalHmContent = tocResult.content;
        AppState.tocData = TocParser.parseHtml(tocResult.content);
        TreeView.render(AppState.tocData);
      } else {
        await window.api.showMessage('Не удалось загрузить hmcontent.htm', 'error', 'Ошибка');
        return;
      }

      document.getElementById('welcome-screen')?.classList.add('hidden');
      document.getElementById('editor-screen')?.classList.remove('hidden');

      const projectName = path.split(/[/\\]/).pop();
      const projectNameEl = document.getElementById('project-name');
      if (projectNameEl) projectNameEl.textContent = projectName;

      StatusBar.update();

      // Отправляем событие (запускает индексацию через EventBus)
      if (typeof EventBus !== 'undefined') {
        EventBus.emit(Events.PROJECT_OPENED, path);
      }

      // Сканирование неиспользуемых файлов
      await OrphanDetector.scan();
    } catch (e) {
      console.error('Error opening project:', e);
      await window.api.showMessage('Ошибка при открытии проекта', 'error', 'Ошибка');
    }
  },

  /**
   * Загрузить содержимое раздела
   * @param {string} nodeId - ID раздела
   */
  async loadNodeContent(nodeId) {
    const node = TocParser.findNode(AppState.tocData.elements, nodeId);
    if (!node || !node.url) {
      Editor.setContent('');
      AppState.currentFileHtml = null;
      const titleEl = document.getElementById('current-section-title');
      if (titleEl) titleEl.textContent = 'Выберите раздел';
      return;
    }

    const titleEl = document.getElementById('current-section-title');
    if (titleEl) titleEl.textContent = node.text;
    document.getElementById('editor-placeholder')?.classList.add('hidden');

    if (AppState.currentView === 'editor') {
      document.getElementById('editor-wrapper')?.classList.remove('hidden');
    }

    if (AppState.currentView === 'preview') {
      Preview.loadFile(node.url);
    }

    try {
      const result = await window.api.readFile(node.url);
      if (result.success) {
        AppState.currentFileHtml = result.content;

        const parser = new DOMParser();
        const doc = parser.parseFromString(result.content, 'text/html');

        // Ищем основной контейнер контента (структура Help & Manual)
        let contentEl = doc.querySelector('#innerdiv') ||
                        doc.querySelector('#idcontent') ||
                        doc.body;

        let content = contentEl ? contentEl.innerHTML : result.content;

        // Очистка специфичных элементов Help & Manual
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;

        tempDiv.querySelectorAll('a').forEach(a => {
          if (a.textContent.includes('Click to Display Table of Contents')) {
            const parent = a.closest('p') || a.closest('div') || a.parentElement;
            if (parent && parent !== tempDiv) parent.remove();
          }
        });

        // Удаляем первый h1 чтобы избежать дублирования с заголовком раздела
        const firstH1 = tempDiv.querySelector('h1');
        if (firstH1) {
          firstH1.remove();
        }

        // Удаляем элементы кастомного видеоплеера (они требуют JS/CSS для работы)
        const videoPlayerElements = [
          '#video-controls',      // Панель управления плеером
          '#final_background',    // Кнопки при завершении видео
          '#BigPlayButton',       // Большая кнопка паузы
          '#sidebar',             // Плейлист
          '#timestamps_target',   // Метки времени
          '#playlist_target',     // Контейнер плейлиста
          '#hide_playlist',       // Кнопка скрытия плейлиста
          '.controls',            // Элементы управления
          '#cleared',             // Пустые разделители
          '#wrapper > div:not(#content)', // Элементы обёртки кроме контента
          'script[type="x-tmpl-mustache"]' // Mustache шаблоны
        ];
        videoPlayerElements.forEach(selector => {
          tempDiv.querySelectorAll(selector).forEach(el => el.remove());
        });

        // Упрощаем структуру видеоплеера: извлекаем video из обёрток
        const videoWrapper = tempDiv.querySelector('#wrapper');
        if (videoWrapper) {
          const video = videoWrapper.querySelector('video');
          if (video) {
            // Удаляем fallback контент внутри video (текст "Ваш браузер не поддерживает...")
            video.querySelectorAll('p, a:not([href])', 'track').forEach(el => el.remove());
            // Удаляем текстовые ноды внутри video
            Array.from(video.childNodes).forEach(node => {
              if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                node.remove();
              }
            });
            // Заменяем всю обёртку на просто video
            videoWrapper.replaceWith(video);
          }
        }

        // Удаляем fallback текст из всех video тегов
        tempDiv.querySelectorAll('video').forEach(video => {
          video.querySelectorAll('p').forEach(p => p.remove());
          Array.from(video.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
              node.remove();
            }
          });
        });

        // Удаляем script и link теги внутри контента (они не работают в редакторе)
        tempDiv.querySelectorAll('script, link[rel="stylesheet"]').forEach(el => el.remove());

        // Преобразование относительных путей в абсолютные URL
        if (AppState.projectPath) {
          // Определяем режим работы: Electron (file://) или Web (API)
          const isElectron = PathUtils.isElectron();

          const toAbsUrl = (relativePath) => {
            if (isElectron) {
              return 'file:///' + AppState.projectPath.replace(/\\/g, '/') + '/' + relativePath;
            } else {
              return '/api/files/serve/' + relativePath + '?project=' + encodeURIComponent(AppState.projectPath);
            }
          };

          tempDiv.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('file://') && !src.startsWith('http://') &&
                !src.startsWith('https://') && !src.startsWith('data:') &&
                !src.startsWith('/api/')) {
              img.setAttribute('src', toAbsUrl(src));
            }
          });
          tempDiv.querySelectorAll('video source').forEach(source => {
            const src = source.getAttribute('src');
            if (src && !src.startsWith('file://') && !src.startsWith('http://') &&
                !src.startsWith('https://') && !src.startsWith('/api/')) {
              source.setAttribute('src', toAbsUrl(src));
            }
          });
          // Обработка poster атрибута video
          tempDiv.querySelectorAll('video[poster]').forEach(video => {
            const poster = video.getAttribute('poster');
            if (poster && !poster.startsWith('file://') && !poster.startsWith('http://') &&
                !poster.startsWith('https://') && !poster.startsWith('data:') &&
                !poster.startsWith('/api/')) {
              video.setAttribute('poster', toAbsUrl(poster));
            }
          });
        }

        content = tempDiv.innerHTML;
        AppState.currentContent = content;

        if (AppState.currentView === 'editor') {
          Editor.setContent(content);
        } else if (AppState.currentView === 'code') {
          CodeEditor.setContent(content);
        }

        AppState.hasUnsavedChanges = false;

        // Загружаем редактор таймкодов если есть видео на странице
        await VideoEditor.loadForContent(result.content);
      } else {
        Editor.setContent('<p>Не удалось загрузить содержимое</p>');
        VideoEditor.hide();
      }
    } catch (e) {
      console.error('Error loading content:', e);
      Editor.setContent('<p>Ошибка загрузки</p>');
      VideoEditor.hide();
    }

    StatusBar.update();
  },

  /**
   * Сохранить текущее содержимое
   */
  async saveCurrentContent() {
    if (!AppState.selectedNode || !AppState.hasUnsavedChanges) return;

    const node = TocParser.findNode(AppState.tocData.elements, AppState.selectedNode);
    if (!node || !node.url) return;

    let content = AppState.currentView === 'code'
      ? CodeEditor.getContent()
      : Editor.getContent();

    // Преобразование абсолютных URL обратно в относительные пути
    if (AppState.projectPath) {
      // Electron file:// URLs
      const fileBasePath = 'file:///' + AppState.projectPath.replace(/\\/g, '/') + '/';
      content = content.replace(new RegExp(fileBasePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');

      // Web API URLs
      const apiBasePath = '/api/files/serve/' + '?project=' + encodeURIComponent(AppState.projectPath) + '&file=';
      content = content.replace(new RegExp(apiBasePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('&file=', ''), 'g'), '');
      // Также убираем простые /api/files/serve/ пути
      content = content.replace(/\/api\/files\/serve\/[^"'\s]*/g, (match) => {
        // Извлекаем имя файла из URL
        const fileMatch = match.match(/\/api\/files\/serve\/(.+?)(?:\?|$)/);
        return fileMatch ? fileMatch[1] : match;
      });
    }

    let html;

    if (AppState.currentFileHtml) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(AppState.currentFileHtml, 'text/html');

      // Обновляем title
      const titleEl = doc.querySelector('title');
      if (titleEl) {
        titleEl.textContent = node.text;
      }

      // Обновляем H1 в header (структура Help & Manual)
      const h1InHeader = doc.querySelector('#idheader h1, #printheader h1');
      if (h1InHeader) {
        h1InHeader.innerHTML = `<span class="f_Heading1">${node.text}</span>`;
      }

      // Ищем контейнер контента
      const contentEl = doc.querySelector('#innerdiv') ||
                        doc.querySelector('#idcontent');

      if (contentEl) {
        contentEl.innerHTML = `<h1>${node.text}</h1>\n${content}`;
      } else {
        const body = doc.body;
        if (body) {
          body.innerHTML = `<h1>${node.text}</h1>\n${content}`;
        }
      }

      html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    } else {
      // Fallback для простых файлов
      html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${node.text}</title>
<link rel="stylesheet" href="default.css">
</head>
<body>
<h1>${node.text}</h1>
${content}
</body>
</html>`;
    }

    try {
      await window.api.writeFile(node.url, html);
      AppState.currentFileHtml = html;
      AppState.hasUnsavedChanges = false;
      AppState.modifiedFiles.delete(AppState.selectedNode);
      StatusBar.update();

      if (typeof EventBus !== 'undefined') {
        EventBus.emit(Events.CONTENT_SAVED, { nodeId: AppState.selectedNode });
      }
    } catch (e) {
      console.error('Error saving:', e);
      await window.api.showMessage('Ошибка сохранения файла', 'error', 'Ошибка');
    }
  },

  /**
   * Сохранить всё
   */
  async saveAll() {
    await this.saveCurrentContent();

    if (AppState.tocData && AppState.originalHmContent) {
      const hmContent = TocParser.generateHtml(AppState.tocData, AppState.originalHmContent);
      await window.api.writeFile('hmcontent.htm', hmContent);
      AppState.originalHmContent = hmContent;
    }

    AppState.modifiedFiles.clear();
    AppState.hasUnsavedChanges = false;
    StatusBar.update();

    if (typeof EventBus !== 'undefined') {
      EventBus.emit(Events.PROJECT_SAVED);
    }
  },

  /**
   * Сборка проекта
   */
  async build() {
    await this.saveAll();

    if (!AppState.tocData) {
      await window.api.showMessage('Нет данных для сборки. Откройте проект.', 'warning', 'Сборка');
      return;
    }

    let outputFolder = await window.api.getOutputPath();

    if (!outputFolder) {
      const result = await window.api.selectOutputFolder();
      if (!result.success) {
        return;
      }
      outputFolder = result.path;
    }

    const progressModal = document.getElementById('modal-build-progress');
    const statusEl = document.getElementById('build-status');
    progressModal?.classList.remove('hidden');

    const updateStatus = (text) => {
      if (statusEl) statusEl.textContent = text;
    };

    if (typeof EventBus !== 'undefined') {
      EventBus.emit(Events.BUILD_STARTED);
    }

    try {
      // Ждём завершения индексации (нужна для поискового индекса)
      if (typeof Search !== 'undefined' && Search.isIndexing) {
        updateStatus('Ожидание завершения индексации...');
        let waitAttempts = 0;
        while (Search.isIndexing && waitAttempts < 300) { // макс ~30 сек
          await new Promise(r => setTimeout(r, 100));
          waitAttempts++;
        }
      }
      // Если индексация ещё не запускалась — запускаем и ждём
      if (typeof Search !== 'undefined' && !Search.isIndexReady && !Search.isIndexing) {
        updateStatus('Индексация для поиска...');
        await Search.buildIndex();
      }

      updateStatus('Генерация служебных файлов...');

      const generatedFiles = Generators.generateAll(AppState.tocData, AppState.originalHmContent);

      updateStatus('Копирование файлов...');

      const result = await window.api.buildProject({
        outputFolder: outputFolder,
        generatedFiles: generatedFiles
      });

      progressModal?.classList.add('hidden');

      if (result.success) {
        if (result.skippedFiles && result.skippedFiles.length > 0) {
          // Сборка прошла, но некоторые файлы не удалось обновить
          const filesList = result.skippedFiles.join('\n• ');
          await window.api.showMessage(
            `Сборка завершена, но не удалось обновить файлы:\n\n• ${filesList}\n\nЭти файлы заблокированы. Закройте справку и повторите сборку.`,
            'warning',
            'Сборка завершена с предупреждениями'
          );
        } else {
          await window.api.showMessage(`Сборка завершена успешно!\n\nПапка: ${result.path}`, 'info', 'Сборка');
        }
        if (typeof EventBus !== 'undefined') {
          EventBus.emit(Events.BUILD_COMPLETED, result.path);
        }
      } else {
        await window.api.showMessage('Ошибка при сборке: ' + result.error, 'error', 'Ошибка сборки');
        if (typeof EventBus !== 'undefined') {
          EventBus.emit(Events.BUILD_FAILED, result.error);
        }
      }

      await OrphanDetector.scan();
    } catch (e) {
      progressModal?.classList.add('hidden');
      console.error('Build error:', e);
      await window.api.showMessage('Ошибка при сборке: ' + e.message, 'error', 'Ошибка сборки');
      if (typeof EventBus !== 'undefined') {
        EventBus.emit(Events.BUILD_FAILED, e.message);
      }
    }
  },

  /**
   * Добавить раздел
   * @param {string} title - Название
   * @param {string} filename - Имя файла
   * @param {string|null} parentId - ID родителя
   */
  async addSection(title, filename, parentId) {
    const newNode = {
      level: 1,
      url: filename,
      text: title
    };

    const newId = TocParser.addNode(AppState.tocData, parentId, newNode);

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<link rel="stylesheet" href="default.css">
</head>
<body>
<h1>${title}</h1>
<p>Содержимое раздела</p>
</body>
</html>`;

    await window.api.writeFile(filename, html);

    if (parentId) {
      TreeView.expandedNodes.add(parentId);
    }
    TreeView.render(AppState.tocData);
    TreeView.selectNode(newId);

    AppState.modifiedFiles.add('toc');

    if (typeof EventBus !== 'undefined') {
      EventBus.emit(Events.SECTION_ADDED, { id: newId, title, filename, parentId });
    }
  },

  /**
   * Удалить раздел
   * @param {string} nodeId - ID раздела
   */
  async deleteSection(nodeId) {
    const node = TocParser.findNode(AppState.tocData.elements, nodeId);
    if (!node) return;

    const confirmed = await window.api.showConfirm(`Удалить раздел "${node.text}"?`, 'Подтверждение');
    if (!confirmed) return;

    TocParser.removeNode(AppState.tocData, nodeId);
    AppState.selectedNode = null;
    TreeView.render(AppState.tocData);
    Editor.setContent('');

    const titleEl = document.getElementById('current-section-title');
    if (titleEl) titleEl.textContent = 'Выберите раздел';

    AppState.modifiedFiles.add('toc');
    StatusBar.update();

    if (typeof EventBus !== 'undefined') {
      EventBus.emit(Events.SECTION_DELETED, nodeId);
    }

    await OrphanDetector.scan();
  },

  /**
   * Переименовать раздел
   * @param {string} nodeId - ID раздела
   * @param {string} newTitle - Новое название
   */
  renameSection(nodeId, newTitle) {
    const node = TocParser.findNode(AppState.tocData.elements, nodeId);
    if (node) {
      node.text = newTitle;
      TreeView.render(AppState.tocData);
      const titleEl = document.getElementById('current-section-title');
      if (titleEl) titleEl.textContent = newTitle;
      AppState.modifiedFiles.add('toc');

      if (typeof EventBus !== 'undefined') {
        EventBus.emit(Events.SECTION_RENAMED, { id: nodeId, title: newTitle });
      }
    }
  },

  /**
   * Переместить раздел к новому родителю
   * @param {string} nodeId - ID раздела
   * @param {string|null} targetId - ID нового родителя
   */
  moveSection(nodeId, targetId) {
    if (TocParser.moveNode(AppState.tocData, nodeId, targetId)) {
      TreeView.expandedNodes.add(targetId);
      TreeView.render(AppState.tocData);
      AppState.modifiedFiles.add('toc');

      if (typeof EventBus !== 'undefined') {
        EventBus.emit(Events.SECTION_MOVED, { id: nodeId, targetId });
      }
    }
  },

  /**
   * Переместить раздел вверх
   * @param {string} nodeId - ID раздела
   */
  moveSectionUp(nodeId) {
    const info = TocParser.findParentAndIndex(AppState.tocData.elements, nodeId);
    if (info && info.index > 0) {
      const temp = info.elements[info.index];
      info.elements[info.index] = info.elements[info.index - 1];
      info.elements[info.index - 1] = temp;
      TreeView.render(AppState.tocData);
      AppState.modifiedFiles.add('toc');
    }
  },

  /**
   * Переместить раздел вниз
   * @param {string} nodeId - ID раздела
   */
  moveSectionDown(nodeId) {
    const info = TocParser.findParentAndIndex(AppState.tocData.elements, nodeId);
    if (info && info.index < info.elements.length - 1) {
      const temp = info.elements[info.index];
      info.elements[info.index] = info.elements[info.index + 1];
      info.elements[info.index + 1] = temp;
      TreeView.render(AppState.tocData);
      AppState.modifiedFiles.add('toc');
    }
  },

  /**
   * Увеличить вложенность раздела (сделать дочерним предыдущего)
   * @param {string} nodeId - ID раздела
   */
  indentSection(nodeId) {
    const info = TocParser.findParentAndIndex(AppState.tocData.elements, nodeId);
    if (!info || info.index === 0) return;

    const prevSibling = info.elements[info.index - 1];
    const node = info.elements.splice(info.index, 1)[0];

    if (!prevSibling.children) prevSibling.children = [];
    prevSibling.children.push(node);

    TreeView.expandedNodes.add(prevSibling.id);
    TreeView.render(AppState.tocData);
    AppState.modifiedFiles.add('toc');
  },

  /**
   * Уменьшить вложенность раздела (сделать соседом родителя)
   * @param {string} nodeId - ID раздела
   */
  outdentSection(nodeId) {
    const info = TocParser.findParentAndIndex(AppState.tocData.elements, nodeId);
    if (!info || !info.parent) return;

    const node = info.elements.splice(info.index, 1)[0];

    const parentInfo = TocParser.findParentAndIndex(AppState.tocData.elements, info.parent.id);
    if (!parentInfo) return;

    parentInfo.elements.splice(parentInfo.index + 1, 0, node);
    TreeView.render(AppState.tocData);
    AppState.modifiedFiles.add('toc');
  },

  /**
   * Добавить раздел из существующего файла
   * @param {string} title - Название
   * @param {string} filename - Путь к файлу
   * @param {string|null} parentId - ID родителя
   */
  async addSectionFromFile(title, filename, parentId) {
    const newNode = {
      level: 1,
      url: filename,
      text: title
    };

    const newId = TocParser.addNode(AppState.tocData, parentId, newNode);

    if (parentId) {
      TreeView.expandedNodes.add(parentId);
    }
    TreeView.render(AppState.tocData);
    TreeView.selectNode(newId);

    AppState.modifiedFiles.add('toc');

    if (typeof EventBus !== 'undefined') {
      EventBus.emit(Events.SECTION_ADDED, { id: newId, title, filename, parentId });
    }
  },

  /**
   * Обновить CSS файлы раздела
   * @param {string} nodeId - ID раздела
   * @param {string[]} cssFiles - Список CSS файлов
   */
  async updateSectionCss(nodeId, cssFiles) {
    const node = TocParser.findNode(AppState.tocData.elements, nodeId);
    if (!node || !node.url) return;

    try {
      const result = await window.api.readFile(node.url);
      if (!result.success) {
        await window.api.showMessage('Не удалось прочитать файл раздела', 'error', 'Ошибка');
        return;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(result.content, 'text/html');

      // Удалить старые CSS ссылки
      doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => link.remove());

      // Добавить новые
      const head = doc.querySelector('head');
      if (head) {
        cssFiles.forEach(file => {
          const link = doc.createElement('link');
          link.rel = 'stylesheet';
          link.href = file;
          head.appendChild(link);
        });
      }

      const serializer = new XMLSerializer();
      let html = '<!DOCTYPE html>\n' + serializer.serializeToString(doc);
      html = html.replace(/ xmlns="[^"]*"/g, '');

      await window.api.writeFile(node.url, html);

      if (AppState.selectedNode === nodeId) {
        await this.loadNodeContent(nodeId);
      }

    } catch (e) {
      console.error('Error updating CSS:', e);
      await window.api.showMessage('Ошибка обновления CSS', 'error', 'Ошибка');
    }
  },

  /**
   * Добавить страницу-сироту в дерево
   * @param {string} filename - Имя файла
   * @param {string|null} parentId - ID родителя
   */
  async adoptOrphanPage(filename, parentId) {
    const title = await OrphanDetector.extractTitle(filename);

    const newNode = {
      level: 1,
      url: filename,
      text: title
    };

    const newId = TocParser.addNode(AppState.tocData, parentId, newNode);

    if (parentId) {
      TreeView.expandedNodes.add(parentId);
    }

    AppState.modifiedFiles.add('toc');
    await OrphanDetector.scan();
    TreeView.selectNode(newId);
  },

  /**
   * Предпросмотр файла-сироты
   * @param {string} filename - Имя файла
   */
  async previewOrphanFile(filename) {
    AppState.selectedNode = null;
    document.querySelectorAll('#tree-container .tree-node-content.selected').forEach(el => {
      el.classList.remove('selected');
    });

    const orphanNodeEl = document.querySelector(`.orphan-node[data-id="orphan:${filename}"] > .tree-node-content`);
    if (orphanNodeEl) {
      orphanNodeEl.classList.add('selected');
    }

    const titleEl = document.getElementById('current-section-title');
    if (titleEl) titleEl.textContent = `[Неиспользуемая] ${filename}`;

    document.getElementById('editor-placeholder')?.classList.add('hidden');
    if (AppState.currentView === 'editor') {
      document.getElementById('editor-wrapper')?.classList.remove('hidden');
    }

    try {
      const result = await window.api.readFile(filename);
      if (result.success) {
        let content = result.content;
        const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        if (bodyMatch) content = bodyMatch[1];

        if (AppState.projectPath) {
          const isElectron = PathUtils.isElectron();

          const toAbsUrl = (relativePath) => {
            if (isElectron) {
              return 'file:///' + AppState.projectPath.replace(/\\/g, '/') + '/' + relativePath;
            } else {
              return '/api/files/serve/' + relativePath + '?project=' + encodeURIComponent(AppState.projectPath);
            }
          };

          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = content;
          tempDiv.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('file://') && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('/api/')) {
              img.setAttribute('src', toAbsUrl(src));
            }
          });
          content = tempDiv.innerHTML;
        }

        AppState.currentContent = content;

        if (AppState.currentView === 'preview') {
          Preview.setContent(content);
        } else if (AppState.currentView === 'code') {
          CodeEditor.setContent(content);
        } else if (AppState.editor) {
          Editor.setContent(content);
        }
      }
    } catch (e) {
      console.error('Error previewing orphan:', e);
    }
  },

  /**
   * Удалить файл-сироту
   * @param {string} filename - Имя файла
   */
  async deleteOrphanFile(filename) {
    const confirmed = await window.api.showConfirm(
      `Удалить файл "${filename}" с диска?`,
      'Удаление файла'
    );
    if (!confirmed) return;

    await window.api.deleteFile(filename);
    await OrphanDetector.scan();
  },

  /**
   * Удалить неиспользуемое изображение
   * @param {string} imagePath - Путь к изображению
   */
  async deleteUnusedImage(imagePath) {
    const confirmed = await window.api.showConfirm(
      `Удалить изображение "${imagePath}" с диска?`,
      'Удаление изображения'
    );
    if (!confirmed) return;

    await window.api.deleteFile(imagePath);
    await OrphanDetector.scan();
  }
};

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', async () => {
  // Проверяем авторизацию перед запуском приложения
  if (typeof AuthService !== 'undefined') {
    await AuthService.ensureAuthenticated();
  }
  App.init();
});

// Экспорт для браузера
window.App = App;
