/**
 * Help Editor - Dialogs
 *
 * Управление всеми модальными окнами приложения:
 * - Добавление раздела
 * - Переименование
 * - Вставка изображения, ссылки, таблицы, видео
 * - Управление CSS
 * - Карточка раздела
 * - Создание проекта
 *
 * @module modules/dialogs
 */

const Dialogs = {
  /**
   * Текущее открытое модальное окно
   * @type {HTMLElement|null}
   */
  currentModal: null,

  // Временные данные для диалогов
  selectedLinkUrl: null,
  addSectionParentId: null,
  importedFileData: null,
  cssNodeId: null,
  cssFiles: [],
  cardNodeId: null,
  cardCssFiles: [],
  cardImages: [],
  cardIsReadonly: false,
  projectFolderPath: null,

  /**
   * Показать модальное окно
   * @param {string} id - ID модального окна
   */
  showModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    this.currentModal = modal;

    modal.querySelector('.modal-close')?.addEventListener('click', () => this.hideModal());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.hideModal();
    });
  },

  /**
   * Скрыть текущее модальное окно
   */
  hideModal() {
    if (this.currentModal) {
      this.currentModal.classList.add('hidden');
      this.currentModal = null;
    }
  },

  /**
   * Диалог добавления раздела
   * @param {string|null} parentId - ID родительского раздела
   * @param {string|null} afterId - ID раздела, после которого добавить
   */
  showAddSection(parentId = null, afterId = null) {
    this.showModal('modal-add-section');
    this.addSectionParentId = parentId;
    this.importedFileData = null;

    // Сброс полей формы
    const titleInput = document.getElementById('new-section-title');
    const filenameInput = document.getElementById('new-section-filename');
    const filePathInput = document.getElementById('section-file-path');
    const fileTitleInput = document.getElementById('section-file-title');
    const asChildCheckbox = document.getElementById('add-as-child');

    if (titleInput) titleInput.value = '';
    if (filenameInput) filenameInput.value = '';
    if (filePathInput) filePathInput.value = '';
    if (fileTitleInput) fileTitleInput.value = '';
    if (asChildCheckbox) asChildCheckbox.checked = !!parentId;

    // Сброс табов на первый
    const modal = document.getElementById('modal-add-section');
    modal?.querySelectorAll('.tab-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === 0);
    });
    modal?.querySelectorAll('.tab-content').forEach((content, i) => {
      content.classList.toggle('active', i === 0);
      content.classList.toggle('hidden', i !== 0);
    });

    // Кнопка выбора файла
    const browseBtn = document.getElementById('btn-browse-html');
    if (browseBtn) {
      browseBtn.onclick = async () => {
        const result = await window.api.selectHtmlFile();
        if (result.success) {
          this.importedFileData = result;
          if (filePathInput) filePathInput.value = result.path;
          if (fileTitleInput) fileTitleInput.value = result.title;
        }
      };
    }

    // Кнопка OK
    const okBtn = document.getElementById('btn-add-section-ok');
    if (okBtn) {
      okBtn.onclick = async () => {
        const activeTab = modal?.querySelector('.tab-btn.active');
        const isFromFile = activeTab?.dataset.tab === 'section-from-file';
        const asChild = asChildCheckbox?.checked;
        const effectiveParentId = asChild ? this.addSectionParentId : null;

        if (isFromFile) {
          if (!this.importedFileData) {
            await window.api.showMessage('Выберите HTML файл', 'warning', 'Внимание');
            return;
          }
          const title = fileTitleInput?.value.trim() || this.importedFileData.title;
          await App.addSectionFromFile(title, this.importedFileData.path, effectiveParentId);
        } else {
          const title = titleInput?.value.trim();
          let filename = filenameInput?.value.trim();

          if (!title) {
            await window.api.showMessage('Введите название раздела', 'warning', 'Внимание');
            return;
          }

          if (!filename) {
            filename = this.transliterate(title) + '.htm';
          } else if (!filename.endsWith('.htm')) {
            filename += '.htm';
          }

          await App.addSection(title, filename, effectiveParentId);
        }

        this.hideModal();
      };
    }
  },

  /**
   * Транслитерация текста для имени файла
   * @param {string} text - Исходный текст
   * @returns {string} Транслитерированный текст
   */
  transliterate(text) {
    const map = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
      'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', ' ': '_'
    };
    return text.toLowerCase().split('').map(c => map[c] || c).join('')
      .replace(/[^a-z0-9_]/g, '').substring(0, 30);
  },

  /**
   * Диалог переименования раздела
   * @param {string} nodeId - ID раздела
   */
  showRename(nodeId) {
    const node = TocParser.findNode(AppState.tocData.elements, nodeId);
    if (!node) return;

    this.showModal('modal-rename');
    const titleInput = document.getElementById('rename-title');
    if (titleInput) titleInput.value = node.text;

    const okBtn = document.getElementById('btn-rename-ok');
    if (okBtn) {
      okBtn.onclick = () => {
        const newTitle = titleInput?.value.trim();
        if (!newTitle) {
          window.api.showMessage('Введите название', 'warning', 'Внимание');
          return;
        }
        App.renameSection(nodeId, newTitle);
        this.hideModal();
      };
    }
  },

  /**
   * Диалог вставки изображения
   */
  async showImageDialog() {
    this.showModal('modal-image');
    const pathInput = document.getElementById('image-path');
    const widthInput = document.getElementById('image-width');
    const heightInput = document.getElementById('image-height');
    const altInput = document.getElementById('image-alt');

    if (pathInput) pathInput.value = '';
    if (widthInput) widthInput.value = '';
    if (heightInput) heightInput.value = '';
    if (altInput) altInput.value = '';

    const selectBtn = document.getElementById('btn-select-image');
    if (selectBtn) {
      selectBtn.onclick = async () => {
        const result = await window.api.selectImage();
        if (result.success && pathInput) {
          pathInput.value = result.path;
        }
      };
    }

    const okBtn = document.getElementById('btn-image-ok');
    if (okBtn) {
      okBtn.onclick = () => {
        const path = pathInput?.value.trim();
        const width = widthInput?.value;
        const height = heightInput?.value;
        const alt = altInput?.value;

        if (!path) {
          window.api.showMessage('Выберите изображение', 'warning', 'Внимание');
          return;
        }

        let attrs = `src="${path}" alt="${alt || ''}"`;
        if (width) attrs += ` width="${width}"`;
        if (height) attrs += ` height="${height}"`;

        Editor.insertContent(`<img ${attrs} />`);
        this.hideModal();
      };
    }
  },

  /**
   * Диалог вставки ссылки
   */
  showLinkDialog() {
    this.showModal('modal-link');
    this.populateLinkSections();
  },

  /**
   * Заполняет дерево разделов для выбора ссылки
   */
  populateLinkSections() {
    const container = document.getElementById('link-tree-container');
    if (!container || !AppState.tocData) return;

    this.selectedLinkUrl = null;

    const renderTree = (elements, level = 0) => {
      return elements.map(node => {
        const hasChildren = node.children && node.children.length > 0;
        const icon = hasChildren ? '📁' : '📄';
        const padding = level * 16;

        let html = `<div class="link-tree-node" data-url="${node.url || ''}" data-text="${node.text}">
          <div class="link-tree-item" style="padding-left: ${padding + 8}px">
            <span class="link-tree-toggle">${hasChildren ? '▶' : ''}</span>
            <span class="link-tree-icon">${icon}</span>
            <span class="link-tree-text">${this.escapeHtml(node.text)}</span>
          </div>`;

        if (hasChildren) {
          html += `<div class="link-tree-children collapsed">${renderTree(node.children, level + 1)}</div>`;
        }
        html += '</div>';
        return html;
      }).join('');
    };

    container.innerHTML = renderTree(AppState.tocData.elements);

    // Обработчики кликов
    container.querySelectorAll('.link-tree-node').forEach(nodeEl => {
      const item = nodeEl.querySelector('.link-tree-item');
      const toggle = item.querySelector('.link-tree-toggle');
      const children = nodeEl.querySelector('.link-tree-children');

      item.addEventListener('click', (e) => {
        if (e.target === toggle && children) {
          children.classList.toggle('collapsed');
          toggle.textContent = children.classList.contains('collapsed') ? '▶' : '▼';
          return;
        }

        container.querySelectorAll('.link-tree-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        this.selectedLinkUrl = nodeEl.dataset.url;
        const linkText = document.getElementById('link-text');
        if (linkText && !linkText.value) {
          linkText.value = nodeEl.dataset.text;
        }
      });
    });

    // Поиск
    const searchInput = document.getElementById('link-search');
    if (searchInput) {
      searchInput.value = '';
      searchInput.oninput = () => {
        const query = searchInput.value.toLowerCase();
        container.querySelectorAll('.link-tree-node').forEach(node => {
          const text = node.dataset.text.toLowerCase();
          const matches = text.includes(query);
          node.querySelector('.link-tree-item').classList.toggle('hidden', !matches && query);
        });
      };
    }

    const okBtn = document.getElementById('btn-link-ok');
    if (okBtn) {
      okBtn.onclick = () => {
        const linkText = document.getElementById('link-text');
        const linkUrl = document.getElementById('link-url');
        const linkNewWindow = document.getElementById('link-new-window');

        const text = linkText?.value || 'Ссылка';
        const newWindow = linkNewWindow?.checked;
        const activeTab = document.querySelector('#modal-link .tab-btn.active');
        const isInternal = activeTab?.dataset.tab === 'link-internal';

        let url = isInternal ? this.selectedLinkUrl : linkUrl?.value;
        if (!url) {
          window.api.showMessage('Укажите URL или выберите раздел', 'warning', 'Внимание');
          return;
        }

        const target = newWindow ? ' target="_blank"' : '';
        Editor.insertContent(`<a href="${url}"${target}>${text}</a>`);
        this.hideModal();
      };
    }
  },

  /**
   * Экранирование HTML
   * @param {string} text - Текст
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Диалог вставки таблицы
   */
  showTableDialog() {
    this.showModal('modal-table');

    const okBtn = document.getElementById('btn-table-ok');
    if (okBtn) {
      okBtn.onclick = () => {
        const rows = parseInt(document.getElementById('table-rows')?.value) || 3;
        const cols = parseInt(document.getElementById('table-cols')?.value) || 3;
        const hasHeader = document.getElementById('table-header')?.checked;

        let html = '<table><tbody>';
        for (let r = 0; r < rows; r++) {
          html += '<tr>';
          for (let c = 0; c < cols; c++) {
            html += (r === 0 && hasHeader) ? '<th>Заголовок</th>' : '<td></td>';
          }
          html += '</tr>';
        }
        html += '</tbody></table>';

        Editor.insertContent(html);
        this.hideModal();
      };
    }
  },

  /**
   * Диалог вставки видео
   */
  async showVideoDialog() {
    this.showModal('modal-video');
    const pathInput = document.getElementById('video-path');
    const urlInput = document.getElementById('video-url');

    if (pathInput) pathInput.value = '';
    if (urlInput) urlInput.value = '';

    const selectBtn = document.getElementById('btn-select-video');
    if (selectBtn) {
      selectBtn.onclick = async () => {
        const result = await window.api.selectVideo();
        if (result.success && pathInput) {
          pathInput.value = result.path;
        }
      };
    }

    const okBtn = document.getElementById('btn-video-ok');
    if (okBtn) {
      okBtn.onclick = () => {
        const width = document.getElementById('video-width')?.value || 640;
        const height = document.getElementById('video-height')?.value || 360;
        const activeTab = document.querySelector('#modal-video .tab-btn.active');
        const isFileTab = activeTab?.dataset.tab === 'video-file';

        let html = '';

        if (isFileTab) {
          const path = pathInput?.value.trim();
          if (!path) {
            window.api.showMessage('Выберите видеофайл', 'warning', 'Внимание');
            return;
          }
          html = `<video width="${width}" height="${height}" controls>
            <source src="${path}" type="video/mp4">
          </video>`;
        } else {
          let url = urlInput?.value.trim();
          if (!url) {
            window.api.showMessage('Введите URL видео', 'warning', 'Внимание');
            return;
          }

          // Преобразование YouTube/Vimeo URL
          if (url.includes('youtube.com/watch')) {
            const videoId = url.split('v=')[1]?.split('&')[0];
            url = `https://www.youtube.com/embed/${videoId}`;
          } else if (url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1]?.split('?')[0];
            url = `https://www.youtube.com/embed/${videoId}`;
          } else if (url.includes('vimeo.com/')) {
            const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
            url = `https://player.vimeo.com/video/${videoId}`;
          }

          html = `<iframe width="${width}" height="${height}" src="${url}" frameborder="0" allowfullscreen></iframe>`;
        }

        Editor.insertContent(html);
        this.hideModal();

        // Обновляем панель редактора видео если добавлено локальное видео
        if (isFileTab) {
          setTimeout(() => {
            VideoEditor.refreshFromEditor();
          }, 100);
        }
      };
    }
  },

  /**
   * Диалог управления CSS файлами раздела
   * @param {string} nodeId - ID раздела
   */
  async showCssManager(nodeId) {
    const node = TocParser.findNode(AppState.tocData.elements, nodeId);
    if (!node || !node.url) {
      await window.api.showMessage('Сначала выберите раздел с файлом', 'warning', 'Внимание');
      return;
    }

    this.showModal('modal-css');
    this.cssNodeId = nodeId;
    this.cssFiles = [];

    // Загрузить текущий HTML файл и извлечь CSS ссылки
    const result = await window.api.readFile(node.url);
    if (result.success) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(result.content, 'text/html');
      doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const href = link.getAttribute('href');
        if (href && !this.cssFiles.includes(href)) {
          this.cssFiles.push(href);
        }
      });
    }

    this.renderCssFilesList();

    // Заполнить select CSS файлами из проекта
    const cssSelect = document.getElementById('css-file-select');
    if (cssSelect) {
      const projectCss = await window.api.getCssFiles();
      cssSelect.innerHTML = '<option value="">Выберите файл из проекта...</option>';
      projectCss.forEach(file => {
        if (!this.cssFiles.includes(file)) {
          const option = document.createElement('option');
          option.value = file;
          option.textContent = file;
          cssSelect.appendChild(option);
        }
      });
    }

    // Добавление из проекта
    const addFromProjectBtn = document.getElementById('btn-add-css-from-project');
    if (addFromProjectBtn) {
      addFromProjectBtn.onclick = () => {
        const selected = cssSelect?.value;
        if (selected && !this.cssFiles.includes(selected)) {
          this.cssFiles.push(selected);
          this.renderCssFilesList();
          const option = cssSelect.querySelector(`option[value="${selected}"]`);
          if (option) option.remove();
          cssSelect.value = '';
        }
      };
    }

    // Выбор внешнего CSS файла
    const selectCssBtn = document.getElementById('btn-select-css-file');
    const newFileInput = document.getElementById('css-new-file');
    if (selectCssBtn) {
      selectCssBtn.onclick = async () => {
        const result = await window.api.selectCssFiles();
        if (result.success && result.files.length > 0) {
          result.files.forEach(file => {
            if (!this.cssFiles.includes(file)) {
              this.cssFiles.push(file);
            }
          });
          this.renderCssFilesList();
          if (newFileInput) newFileInput.value = result.files.join(', ');
        }
      };
    }

    // Сохранение
    const okBtn = document.getElementById('btn-css-ok');
    if (okBtn) {
      okBtn.onclick = async () => {
        await App.updateSectionCss(nodeId, this.cssFiles);
        this.hideModal();
      };
    }
  },

  /**
   * Отрисовка списка CSS файлов
   */
  renderCssFilesList() {
    const container = document.getElementById('css-files-list');
    if (!container) return;

    if (this.cssFiles.length === 0) {
      container.innerHTML = '<div class="css-file-empty">Нет подключённых CSS файлов</div>';
      return;
    }

    container.innerHTML = this.cssFiles.map((file, index) => `
      <div class="css-file-item">
        <span class="css-file-name">${this.escapeHtml(file)}</span>
        <button class="btn btn-small btn-danger css-file-remove" data-index="${index}">&times;</button>
      </div>
    `).join('');

    container.querySelectorAll('.css-file-remove').forEach(btn => {
      btn.onclick = () => {
        const index = parseInt(btn.dataset.index);
        this.cssFiles.splice(index, 1);
        this.renderCssFilesList();
      };
    });
  },

  /**
   * Диалог добавления изображений к разделу
   * @param {string} nodeId - ID раздела
   */
  async showAddImagesToSection(nodeId) {
    const node = TocParser.findNode(AppState.tocData.elements, nodeId);
    if (!node) {
      await window.api.showMessage('Сначала выберите раздел', 'warning', 'Внимание');
      return;
    }

    const result = await window.api.selectImages();
    if (result.success && result.files.length > 0) {
      const imageList = result.files.join('\n');
      await window.api.showMessage(
        `Добавлено ${result.files.length} изображений в папку проекта:\n${imageList}`,
        'info',
        'Изображения добавлены'
      );
    }
  },

  /**
   * Диалог карточки раздела
   * @param {string} nodeId - ID раздела
   */
  async showSectionCard(nodeId) {
    const node = TocParser.findNode(AppState.tocData.elements, nodeId);
    if (!node) return;

    this.showModal('modal-section-card');
    const header = document.getElementById('section-card-header');
    const titleInput = document.getElementById('section-card-title');
    const filenameEl = document.getElementById('section-card-filename');

    if (header) header.textContent = 'Карточка раздела';
    if (titleInput) { titleInput.value = node.text; titleInput.readOnly = false; }
    if (filenameEl) filenameEl.textContent = node.url || '(нет файла)';

    // Контекстный код справки
    const contextCodeEl = document.getElementById('section-card-context-code');
    const copyCodeBtn = document.getElementById('btn-copy-context-code');
    const contextCode = node.url ? node.url.replace(/\.htm$/i, '') : '';

    if (contextCodeEl) {
      contextCodeEl.textContent = contextCode || '(нет кода)';
    }
    if (copyCodeBtn) {
      copyCodeBtn.onclick = () => {
        if (contextCode) {
          navigator.clipboard.writeText(contextCode).then(() => {
            const originalText = copyCodeBtn.textContent;
            copyCodeBtn.textContent = 'Скопировано!';
            setTimeout(() => { copyCodeBtn.textContent = originalText; }, 1500);
          });
        }
      };
    }

    // Извлечь информацию о ресурсах
    this.cardNodeId = nodeId;
    this.cardCssFiles = [];
    this.cardImages = [];
    this.cardIsReadonly = false;

    if (node.url) {
      const pageInfo = await OrphanDetector.extractPageInfo(node.url);
      this.cardImages = pageInfo.images || [];
      this.cardCssFiles = pageInfo.styles || [];
    }

    this.renderCardImagesList(document.getElementById('section-card-images'), this.cardImages);
    this.renderCardCssList(document.getElementById('section-card-css'), this.cardCssFiles);

    this.setupCardCssControls();

    // Кнопка добавления изображений
    const addImgBtn = document.getElementById('btn-card-add-images');
    if (addImgBtn) {
      addImgBtn.classList.remove('hidden');
      addImgBtn.onclick = async () => {
        const result = await window.api.selectImages();
        if (result.success && result.files.length > 0) {
          result.files.forEach(f => {
            if (!this.cardImages.includes(f)) this.cardImages.push(f);
          });
          this.renderCardImagesList(document.getElementById('section-card-images'), this.cardImages);
        }
      };
    }

    // Сохранение
    const okBtn = document.getElementById('btn-card-ok');
    if (okBtn) {
      okBtn.classList.remove('hidden');
      okBtn.onclick = async () => {
        const newTitle = titleInput?.value.trim();
        if (newTitle && newTitle !== node.text) {
          App.renameSection(nodeId, newTitle);
        }
        await App.updateSectionCss(nodeId, this.cardCssFiles);
        this.hideModal();
      };
    }

    const cancelBtn = document.getElementById('btn-card-cancel');
    if (cancelBtn) cancelBtn.onclick = () => this.hideModal();
  },

  /**
   * Диалог карточки неиспользуемой страницы (readonly)
   * @param {string} filename - Имя файла
   */
  async showOrphanCard(filename) {
    const orphan = AppState.orphanPages.find(p => p.filename === filename);
    if (!orphan) return;

    this.showModal('modal-section-card');
    const header = document.getElementById('section-card-header');
    const titleInput = document.getElementById('section-card-title');
    const filenameEl = document.getElementById('section-card-filename');

    if (header) header.textContent = 'Карточка страницы';
    if (titleInput) { titleInput.value = orphan.title; titleInput.readOnly = true; }
    if (filenameEl) filenameEl.textContent = orphan.filename;

    this.cardIsReadonly = true;
    this.cardImages = orphan.images || [];
    this.cardCssFiles = orphan.styles || [];

    this.renderCardImagesList(document.getElementById('section-card-images'), this.cardImages, true);
    this.renderCardCssList(document.getElementById('section-card-css'), this.cardCssFiles, true);

    // Скрыть controls
    const addImgBtn = document.getElementById('btn-card-add-images');
    if (addImgBtn) addImgBtn.classList.add('hidden');

    const cssSelect = document.getElementById('card-css-select');
    const externalInput = document.getElementById('card-css-external');
    if (cssSelect) cssSelect.parentElement.style.display = 'none';
    if (externalInput) externalInput.parentElement.style.display = 'none';

    const okBtn = document.getElementById('btn-card-ok');
    if (okBtn) okBtn.classList.add('hidden');

    const cancelBtn = document.getElementById('btn-card-cancel');
    if (cancelBtn) {
      cancelBtn.textContent = 'Закрыть';
      cancelBtn.onclick = () => {
        if (cssSelect) cssSelect.parentElement.style.display = '';
        if (externalInput) externalInput.parentElement.style.display = '';
        cancelBtn.textContent = 'Отмена';
        this.hideModal();
      };
    }
  },

  /**
   * Отрисовка списка изображений в карточке
   */
  renderCardImagesList(container, images, readonly = false) {
    if (!container) return;
    if (!images || images.length === 0) {
      container.innerHTML = '<div class="css-file-empty">Нет изображений</div>';
      return;
    }
    container.innerHTML = images.map((img, i) => `
      <div class="resource-item">
        <span class="resource-icon">🖼️</span>
        <span class="resource-name" title="${this.escapeHtml(img)}">${this.escapeHtml(img)}</span>
        ${readonly ? '' : `<button class="btn btn-small btn-danger css-file-remove" data-index="${i}">&times;</button>`}
      </div>
    `).join('');

    if (!readonly) {
      container.querySelectorAll('.css-file-remove').forEach(btn => {
        btn.onclick = () => {
          const index = parseInt(btn.dataset.index);
          this.cardImages.splice(index, 1);
          this.renderCardImagesList(container, this.cardImages);
        };
      });
    }
  },

  /**
   * Отрисовка списка CSS в карточке
   */
  renderCardCssList(container, cssFiles, readonly = false) {
    if (!container) return;
    if (!cssFiles || cssFiles.length === 0) {
      container.innerHTML = '<div class="css-file-empty">Нет подключённых CSS файлов</div>';
      return;
    }
    container.innerHTML = cssFiles.map((file, i) => `
      <div class="resource-item">
        <span class="resource-icon">🎨</span>
        <span class="resource-name" title="${this.escapeHtml(file)}">${this.escapeHtml(file)}</span>
        ${readonly ? '' : `<button class="btn btn-small btn-danger css-file-remove" data-index="${i}">&times;</button>`}
      </div>
    `).join('');

    if (!readonly) {
      container.querySelectorAll('.css-file-remove').forEach(btn => {
        btn.onclick = () => {
          const index = parseInt(btn.dataset.index);
          this.cardCssFiles.splice(index, 1);
          this.renderCardCssList(container, this.cardCssFiles);
        };
      });
    }
  },

  /**
   * Настройка контролов CSS в карточке раздела
   */
  async setupCardCssControls() {
    const cssSelect = document.getElementById('card-css-select');
    if (cssSelect) {
      const projectCss = await window.api.getCssFiles();
      cssSelect.innerHTML = '<option value="">Из проекта...</option>';
      projectCss.forEach(file => {
        if (!this.cardCssFiles.includes(file)) {
          const option = document.createElement('option');
          option.value = file;
          option.textContent = file;
          cssSelect.appendChild(option);
        }
      });
      cssSelect.parentElement.style.display = '';
    }

    const addCssBtn = document.getElementById('btn-card-add-css');
    if (addCssBtn) {
      addCssBtn.onclick = () => {
        const selected = cssSelect?.value;
        if (selected && !this.cardCssFiles.includes(selected)) {
          this.cardCssFiles.push(selected);
          this.renderCardCssList(document.getElementById('section-card-css'), this.cardCssFiles);
          const option = cssSelect.querySelector(`option[value="${selected}"]`);
          if (option) option.remove();
          cssSelect.value = '';
        }
      };
    }

    const browseCssBtn = document.getElementById('btn-card-browse-css');
    const externalInput = document.getElementById('card-css-external');
    if (browseCssBtn) {
      externalInput.parentElement.style.display = '';
      browseCssBtn.onclick = async () => {
        const result = await window.api.selectCssFiles();
        if (result.success && result.files.length > 0) {
          result.files.forEach(file => {
            if (!this.cardCssFiles.includes(file)) {
              this.cardCssFiles.push(file);
            }
          });
          this.renderCardCssList(document.getElementById('section-card-css'), this.cardCssFiles);
          if (externalInput) externalInput.value = result.files.join(', ');
        }
      };
    }
  },

  /**
   * Диалог создания нового проекта
   */
  showCreateProjectDialog() {
    this.showModal('modal-create-project');
    this.projectFolderPath = null;

    const titleInput = document.getElementById('project-title');
    const versionInput = document.getElementById('project-version');
    const firstSectionInput = document.getElementById('first-section-title');
    const folderPathInput = document.getElementById('project-folder-path');
    const templateSelect = document.getElementById('project-template');
    const templateHint = document.getElementById('project-template-hint');

    if (titleInput) titleInput.value = '';
    if (versionInput) versionInput.value = '';
    if (firstSectionInput) firstSectionInput.value = 'Введение';
    if (folderPathInput) folderPathInput.value = '';
    if (templateSelect) templateSelect.value = 'modern';

    // Описания шаблонов
    const templateDescriptions = {
      modern: 'Новая оболочка с боковой панелью, современный поиск (MiniSearch), стили Directum RX',
      legacy: 'Совместимость с Help & Manual — оболочка, стили и поиск остаются от H&M'
    };

    const updateHint = () => {
      if (templateHint && templateSelect) {
        templateHint.textContent = templateDescriptions[templateSelect.value] || '';
      }
    };
    if (templateSelect) {
      templateSelect.onchange = updateHint;
      updateHint();
    }

    const selectFolderBtn = document.getElementById('btn-select-project-folder');
    if (selectFolderBtn) {
      selectFolderBtn.onclick = async () => {
        const result = await window.api.selectProjectFolder();
        if (result.success) {
          this.projectFolderPath = result.path;
          if (folderPathInput) folderPathInput.value = result.path;
        } else if (result.error) {
          await window.api.showMessage(result.error, 'warning', 'Внимание');
        }
      };
    }

    const okBtn = document.getElementById('btn-create-project-ok');
    if (okBtn) {
      okBtn.onclick = async () => {
        const title = titleInput?.value.trim();
        const version = versionInput?.value.trim();
        const firstSectionTitle = firstSectionInput?.value.trim() || 'Введение';
        const template = templateSelect?.value || 'modern';

        if (!title) {
          await window.api.showMessage('Введите название справки', 'warning', 'Внимание');
          return;
        }

        if (!this.projectFolderPath) {
          await window.api.showMessage('Выберите папку для проекта', 'warning', 'Внимание');
          return;
        }

        const result = await window.api.createProject({
          title,
          version,
          folderPath: this.projectFolderPath,
          firstSectionTitle,
          template
        });

        if (result.success) {
          this.hideModal();
        } else {
          await window.api.showMessage(result.error || 'Ошибка создания проекта', 'error', 'Ошибка');
        }
      };
    }

    const cancelBtn = document.getElementById('btn-create-project-cancel');
    if (cancelBtn) {
      cancelBtn.onclick = () => this.hideModal();
    }
  },

  /**
   * Диалог смены шаблона для открытого проекта
   */
  async showChangeTemplateDialog() {
    const projectPath = AppState.projectPath;
    if (!projectPath) {
      await window.api.showMessage('Проект не открыт', 'warning', 'Внимание');
      return;
    }

    // Загружаем текущий конфиг и список шаблонов
    let currentTemplate = 'modern';
    let templates = [];
    try {
      const [cfgResp, tplResp] = await Promise.all([
        FileService._fetch('/api/project/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectPath })
        }),
        FileService._fetch('/api/project/templates')
      ]);
      const cfgData = await cfgResp.json();
      const tplData = await tplResp.json();
      if (cfgData.success && cfgData.config.template) currentTemplate = cfgData.config.template;
      if (tplData.success) templates = tplData.templates;
    } catch (e) {
      console.error('Failed to load template info:', e);
    }

    if (templates.length === 0) {
      templates = [
        { id: 'modern', name: 'Современный', description: '' },
        { id: 'legacy', name: 'Help & Manual (Legacy)', description: '' }
      ];
    }

    // Создаём модальное окно
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.style.zIndex = '9000';

    let optionsHtml = templates.map(t =>
      `<option value="${t.id}" ${t.id === currentTemplate ? 'selected' : ''}>${t.name}</option>`
    ).join('');

    let descsHtml = templates.map(t =>
      `<div class="tpl-desc" data-tpl="${t.id}" style="display:${t.id === currentTemplate ? 'block' : 'none'}; color:#666; font-size:13px; margin-top:6px;">${t.description}</div>`
    ).join('');

    overlay.innerHTML = `
      <div class="modal-content modal-small" style="max-width:440px">
        <div class="modal-header">
          <h3>Шаблон проекта</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Текущий шаблон:</label>
            <select id="change-template-select" class="form-input">${optionsHtml}</select>
            ${descsHtml}
          </div>
          <p style="font-size:13px; color:#888; margin-top:12px;">Изменения применятся при следующей сборке проекта.</p>
        </div>
        <div class="modal-footer">
          <button class="btn" id="change-tpl-cancel">Отмена</button>
          <button class="btn btn-primary" id="change-tpl-ok">Сохранить</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const select = overlay.querySelector('#change-template-select');
    const descs = overlay.querySelectorAll('.tpl-desc');
    select.onchange = () => {
      descs.forEach(d => d.style.display = d.dataset.tpl === select.value ? 'block' : 'none');
    };

    overlay.querySelector('.modal-close').onclick = () => document.body.removeChild(overlay);
    overlay.querySelector('#change-tpl-cancel').onclick = () => document.body.removeChild(overlay);
    overlay.querySelector('#change-tpl-ok').onclick = async () => {
      const newTemplate = select.value;
      try {
        const resp = await FileService._fetch('/api/project/config/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectPath, template: newTemplate })
        });
        const result = await resp.json();
        if (result.success) {
          document.body.removeChild(overlay);
          await window.api.showMessage(
            `Шаблон изменён на \"${templates.find(t => t.id === newTemplate)?.name || newTemplate}\". Пересоберите проект, чтобы применить.`,
            'info', 'Шаблон'
          );
        } else {
          await window.api.showMessage(result.error || 'Ошибка', 'error', 'Ошибка');
        }
      } catch (e) {
        await window.api.showMessage(e.message, 'error', 'Ошибка');
      }
    };
  },

  /**
   * Диалог публикации справки
   */
  async showPublishDialog() {
    const projectPath = AppState.projectPath;
    if (!projectPath) {
      await window.api.showMessage('Проект не открыт', 'warning', 'Внимание');
      return;
    }

    // Загружаем конфиг проекта
    let projectCfg = {};
    try {
      const resp = await FileService._fetch('/api/project/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath })
      });
      const data = await resp.json();
      if (data.success) projectCfg = data.config;
    } catch (e) {
      console.error('Failed to load project config:', e);
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.style.zIndex = '9000';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width:500px">
        <div class="modal-header">
          <h3>Публикация справки</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Папка сборки (откуда копировать):</label>
            <div class="input-with-button">
              <input type="text" id="publish-source" class="form-input" value="${projectCfg.outputFolder || ''}" placeholder="По умолчанию — папка проекта">
              <button class="btn" id="publish-browse-source">Обзор...</button>
            </div>
            <small class="form-hint">Папка, куда выполнялась сборка. Если пусто — берётся папка проекта.</small>
          </div>
          <div class="form-group">
            <label>Папка публикации (куда копировать):</label>
            <div class="input-with-button">
              <input type="text" id="publish-target" class="form-input" value="${projectCfg.publishPath || ''}" placeholder="Главная папка справки">
              <button class="btn" id="publish-browse-target">Обзор...</button>
            </div>
            <small class="form-hint">Папка, откуда система берёт справку для конечных пользователей.</small>
          </div>
          <label style="display:flex; align-items:center; gap:6px; margin-top:8px; cursor:pointer;">
            <input type="checkbox" id="publish-save-paths" checked>
            <span style="font-size:13px;">Запомнить пути в настройках проекта</span>
          </label>
        </div>
        <div class="modal-footer">
          <button class="btn" id="publish-cancel">Отмена</button>
          <button class="btn btn-primary" id="publish-ok">Опубликовать</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const sourceInput = overlay.querySelector('#publish-source');
    const targetInput = overlay.querySelector('#publish-target');
    const saveCheckbox = overlay.querySelector('#publish-save-paths');

    // Обзор папки сборки
    overlay.querySelector('#publish-browse-source').onclick = () => {
      WebDialogs.showFolderDialog('Папка сборки:', (path) => {
        if (path) sourceInput.value = path;
      });
    };

    // Обзор папки публикации
    overlay.querySelector('#publish-browse-target').onclick = () => {
      WebDialogs.showFolderDialog('Папка публикации:', (path) => {
        if (path) targetInput.value = path;
      });
    };

    const close = () => document.body.removeChild(overlay);
    overlay.querySelector('.modal-close').onclick = close;
    overlay.querySelector('#publish-cancel').onclick = close;

    overlay.querySelector('#publish-ok').onclick = async () => {
      const publishPath = targetInput.value.trim();
      const outputFolder = sourceInput.value.trim();

      if (!publishPath) {
        await window.api.showMessage('Укажите папку публикации', 'warning', 'Внимание');
        return;
      }

      // Сохраняем пути если отмечено
      if (saveCheckbox.checked) {
        try {
          await FileService._fetch('/api/project/config/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectPath,
              publishPath,
              outputFolder: outputFolder || undefined
            })
          });
        } catch (e) {
          console.error('Failed to save paths:', e);
        }
      }

      // Отключаем кнопку
      const okBtn = overlay.querySelector('#publish-ok');
      okBtn.disabled = true;
      okBtn.textContent = 'Публикация...';

      try {
        const resp = await FileService._fetch('/api/project/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectPath,
            publishPath,
            outputFolder: outputFolder || undefined
          })
        });
        const result = await resp.json();

        if (result.success) {
          close();
          let msg = `Опубликовано ${result.copiedCount} файлов в:\n${result.path}`;
          if (result.skippedFiles && result.skippedFiles.length > 0) {
            msg += `\n\nПропущено (заблокированы): ${result.skippedFiles.join(', ')}`;
          }
          await window.api.showMessage(msg, 'info', 'Публикация');
        } else {
          okBtn.disabled = false;
          okBtn.textContent = 'Опубликовать';
          await window.api.showMessage(result.error || 'Ошибка публикации', 'error', 'Ошибка');
        }
      } catch (e) {
        okBtn.disabled = false;
        okBtn.textContent = 'Опубликовать';
        await window.api.showMessage(e.message, 'error', 'Ошибка');
      }
    };
  }
};

// Экспорт для браузера
window.Dialogs = Dialogs;
