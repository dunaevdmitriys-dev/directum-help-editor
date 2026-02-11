/**
 * Help Editor - Video Editor
 *
 * Редактор таймкодов видео.
 * Поддерживает два режима:
 * 1. "playlist" - для страниц с videos_*.js (плейлист видео)
 * 2. "inline" - для обычных страниц с video тегами (таймкоды в data-атрибутах)
 *
 * @module modules/video-editor
 */

const VideoEditor = {
  /**
   * Режим работы: 'playlist' | 'inline' | null
   * @type {string|null}
   */
  mode: null,

  /**
   * Данные видео (для режима playlist)
   * @type {Object|null}
   */
  videoData: null,

  /**
   * Путь к файлу данных (для режима playlist)
   * @type {string|null}
   */
  currentVideoFile: null,

  /**
   * Текущий индекс видео
   * @type {{groupIndex: number, videoIndex: number}|null}
   */
  currentVideoIndex: null,

  /**
   * Список видео на странице (для режима inline)
   * @type {Array}
   */
  inlineVideos: [],

  /**
   * Индекс текущего inline видео
   * @type {number}
   */
  currentInlineIndex: 0,

  /**
   * Флаг изменений
   * @type {boolean}
   */
  hasChanges: false,

  /**
   * Контейнер панели
   * @type {HTMLElement|null}
   */
  panel: null,

  /**
   * Флаг свёрнутости
   * @type {boolean}
   */
  isCollapsed: false,

  /**
   * Инициализация модуля
   */
  init() {
    this.panel = document.getElementById('video-editor-panel');
    this.attachEventListeners();
  },

  /**
   * Привязка обработчиков событий
   */
  attachEventListeners() {
    document.getElementById('btn-toggle-video-panel')?.addEventListener('click', () => {
      this.toggleCollapse();
    });

    document.getElementById('btn-add-timestamp')?.addEventListener('click', () => {
      this.addTimestamp();
    });

    document.getElementById('btn-save-video-data')?.addEventListener('click', () => {
      this.save();
    });

    document.getElementById('video-selector')?.addEventListener('change', (e) => {
      if (this.mode === 'playlist') {
        const [groupIndex, videoIndex] = e.target.value.split('-').map(Number);
        this.selectVideo(groupIndex, videoIndex);
      } else if (this.mode === 'inline') {
        this.currentInlineIndex = parseInt(e.target.value);
        this.renderInlineVideoInfo();
        this.renderTimestamps();
      }
    });

    document.getElementById('timestamps-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const item = btn.closest('.timestamp-item');
      const index = parseInt(item?.dataset.index);

      if (btn.classList.contains('btn-delete-timestamp')) {
        this.deleteTimestamp(index);
      } else if (btn.classList.contains('btn-move-up')) {
        this.moveTimestamp(index, -1);
      } else if (btn.classList.contains('btn-move-down')) {
        this.moveTimestamp(index, 1);
      }
    });

    document.getElementById('timestamps-list')?.addEventListener('input', (e) => {
      if (e.target.matches('input')) {
        this.hasChanges = true;
        this.updateTimestampFromInput(e.target);
        this.updateSaveButton();
      }
    });
  },

  /**
   * Переключает свёрнутость панели
   */
  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    const content = document.getElementById('video-editor-content');
    const toggleBtn = document.getElementById('btn-toggle-video-panel');

    if (this.isCollapsed) {
      content?.classList.add('collapsed');
      if (toggleBtn) toggleBtn.textContent = '▼';
    } else {
      content?.classList.remove('collapsed');
      if (toggleBtn) toggleBtn.textContent = '▲';
    }
  },

  /**
   * Определяет тип видео на странице
   * @param {string} htmlContent - HTML контент
   * @returns {{type: string, data: any}|null}
   */
  detectVideoContent(htmlContent) {
    // Сначала проверяем playlist режим (videos_*.js)
    const playlistMatch = htmlContent.match(/src=["'](videos_[^"']+\.js)["']/);
    if (playlistMatch) {
      return { type: 'playlist', data: playlistMatch[1] };
    }

    // Проверяем наличие video тегов
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const videos = doc.querySelectorAll('video');

    if (videos.length > 0) {
      const videoList = Array.from(videos).map((video, index) => {
        const source = video.querySelector('source');
        const src = source?.getAttribute('src') || video.getAttribute('src') || '';
        const timestampsAttr = video.getAttribute('data-timestamps');
        let timestamps = [];

        if (timestampsAttr) {
          try {
            timestamps = JSON.parse(timestampsAttr);
          } catch (e) {
            console.warn('Ошибка парсинга таймкодов:', e);
          }
        }

        return {
          index,
          src,
          filename: src.split('/').pop() || `Видео ${index + 1}`,
          duration: video.getAttribute('data-duration') || '',
          timestamps
        };
      });

      return { type: 'inline', data: videoList };
    }

    return null;
  },

  /**
   * Загружает редактор для контента
   * @param {string} htmlContent - HTML контент страницы
   */
  async loadForContent(htmlContent) {
    const detected = this.detectVideoContent(htmlContent);

    if (!detected) {
      this.hide();
      return;
    }

    if (detected.type === 'playlist') {
      await this.loadPlaylist(detected.data);
    } else if (detected.type === 'inline') {
      this.loadInline(detected.data);
    }
  },

  /**
   * Загружает режим playlist
   * @param {string} videoFileName - Имя файла videos_*.js
   */
  async loadPlaylist(videoFileName) {
    if (!AppState.projectPath) return;

    this.mode = 'playlist';
    const filePath = AppState.projectPath + '/' + videoFileName;

    try {
      const result = await window.api.readFile(filePath);
      if (!result.success) {
        console.error('Не удалось загрузить файл видео данных:', filePath);
        this.hide();
        return;
      }

      this.videoData = JSON.parse(result.content);
      this.currentVideoFile = filePath;
      this.hasChanges = false;

      this.show();
      this.renderPlaylistSelector();

      if (this.videoData.playlist?.length > 0) {
        const firstGroup = this.videoData.playlist[0].group;
        if (firstGroup.videos?.length > 0) {
          this.selectVideo(0, 0);
        }
      }

      this.updateSaveButton();
    } catch (e) {
      console.error('Ошибка парсинга видео данных:', e);
      this.hide();
    }
  },

  /**
   * Загружает режим inline
   * @param {Array} videos - Список видео
   */
  loadInline(videos) {
    this.mode = 'inline';
    this.inlineVideos = videos;
    this.currentInlineIndex = 0;
    this.hasChanges = false;

    this.show();
    this.renderInlineSelector();
    this.renderInlineVideoInfo();
    this.renderTimestamps();
    this.updateSaveButton();
  },

  /**
   * Показывает панель
   */
  show() {
    this.panel?.classList.remove('hidden');
    this.isCollapsed = false;
    document.getElementById('video-editor-content')?.classList.remove('collapsed');
    const toggleBtn = document.getElementById('btn-toggle-video-panel');
    if (toggleBtn) toggleBtn.textContent = '▲';
  },

  /**
   * Скрывает панель
   */
  hide() {
    this.panel?.classList.add('hidden');
    this.mode = null;
    this.videoData = null;
    this.currentVideoFile = null;
    this.currentVideoIndex = null;
    this.inlineVideos = [];
    this.currentInlineIndex = 0;
  },

  // ========== Playlist Mode ==========

  /**
   * Рендерит селектор для playlist режима
   */
  renderPlaylistSelector() {
    const selector = document.getElementById('video-selector');
    if (!selector || !this.videoData) return;

    let html = '';
    this.videoData.playlist.forEach((item, groupIndex) => {
      const group = item.group;
      html += `<optgroup label="${this.escapeHtml(group.title)}">`;
      group.videos.forEach((videoItem, videoIndex) => {
        const video = videoItem.video;
        const count = video.timestamps?.length || 0;
        html += `<option value="${groupIndex}-${videoIndex}">${this.escapeHtml(video.title)} (${count} меток)</option>`;
      });
      html += '</optgroup>';
    });

    selector.innerHTML = html;
  },

  /**
   * Выбирает видео в playlist режиме
   */
  selectVideo(groupIndex, videoIndex) {
    this.currentVideoIndex = { groupIndex, videoIndex };

    const selector = document.getElementById('video-selector');
    if (selector) {
      selector.value = `${groupIndex}-${videoIndex}`;
    }

    this.renderPlaylistVideoInfo();
    this.renderTimestamps();
  },

  /**
   * Получает текущее видео (playlist режим)
   */
  getCurrentPlaylistVideo() {
    if (!this.videoData || !this.currentVideoIndex) return null;
    const { groupIndex, videoIndex } = this.currentVideoIndex;
    return this.videoData.playlist[groupIndex]?.group?.videos[videoIndex]?.video;
  },

  /**
   * Рендерит информацию о видео (playlist режим)
   */
  renderPlaylistVideoInfo() {
    const video = this.getCurrentPlaylistVideo();
    const infoEl = document.getElementById('video-info');
    if (!infoEl || !video) return;

    infoEl.innerHTML = `
      <div class="video-info-grid">
        <div class="video-info-item">
          <span class="video-info-label">Файл:</span>
          <span class="video-info-value">${this.escapeHtml(video.file)}</span>
        </div>
        <div class="video-info-item">
          <span class="video-info-label">Длительность:</span>
          <input type="text" class="video-duration-input" value="${this.escapeHtml(video.duration || '')}"
                 onchange="VideoEditor.updateVideoField('duration', this.value)">
        </div>
      </div>
    `;
  },

  // ========== Inline Mode ==========

  /**
   * Рендерит селектор для inline режима
   */
  renderInlineSelector() {
    const selector = document.getElementById('video-selector');
    if (!selector) return;

    if (this.inlineVideos.length === 1) {
      selector.innerHTML = `<option value="0">${this.escapeHtml(this.inlineVideos[0].filename)}</option>`;
      selector.disabled = true;
    } else {
      let html = '';
      this.inlineVideos.forEach((video, index) => {
        const count = video.timestamps?.length || 0;
        html += `<option value="${index}">${this.escapeHtml(video.filename)} (${count} меток)</option>`;
      });
      selector.innerHTML = html;
      selector.disabled = false;
    }
  },

  /**
   * Получает текущее inline видео
   */
  getCurrentInlineVideo() {
    return this.inlineVideos[this.currentInlineIndex] || null;
  },

  /**
   * Рендерит информацию о видео (inline режим)
   */
  renderInlineVideoInfo() {
    const video = this.getCurrentInlineVideo();
    const infoEl = document.getElementById('video-info');
    if (!infoEl || !video) return;

    infoEl.innerHTML = `
      <div class="video-info-grid">
        <div class="video-info-item">
          <span class="video-info-label">Файл:</span>
          <span class="video-info-value">${this.escapeHtml(video.filename)}</span>
        </div>
        <div class="video-info-item">
          <span class="video-info-label">Длительность:</span>
          <input type="text" class="video-duration-input" value="${this.escapeHtml(video.duration || '')}"
                 placeholder="00:00" onchange="VideoEditor.updateInlineDuration(this.value)">
        </div>
      </div>
    `;
  },

  /**
   * Обновляет длительность inline видео
   */
  updateInlineDuration(value) {
    const video = this.getCurrentInlineVideo();
    if (video) {
      video.duration = value;
      this.hasChanges = true;
      this.updateSaveButton();
    }
  },

  // ========== Common Methods ==========

  /**
   * Получает текущие таймкоды
   */
  getCurrentTimestamps() {
    if (this.mode === 'playlist') {
      const video = this.getCurrentPlaylistVideo();
      return video?.timestamps || [];
    } else if (this.mode === 'inline') {
      const video = this.getCurrentInlineVideo();
      return video?.timestamps || [];
    }
    return [];
  },

  /**
   * Устанавливает таймкоды
   */
  setCurrentTimestamps(timestamps) {
    if (this.mode === 'playlist') {
      const video = this.getCurrentPlaylistVideo();
      if (video) video.timestamps = timestamps;
    } else if (this.mode === 'inline') {
      const video = this.getCurrentInlineVideo();
      if (video) video.timestamps = timestamps;
    }
  },

  /**
   * Обновляет поле видео
   */
  updateVideoField(field, value) {
    if (this.mode === 'playlist') {
      const video = this.getCurrentPlaylistVideo();
      if (video) {
        video[field] = value;
        this.hasChanges = true;
        this.updateSaveButton();
      }
    }
  },

  /**
   * Обновляет кнопку сохранения
   */
  updateSaveButton() {
    const btn = document.getElementById('btn-save-video-data');
    if (btn) {
      if (this.hasChanges) {
        btn.classList.add('has-changes');
        btn.textContent = '💾 Сохранить *';
      } else {
        btn.classList.remove('has-changes');
        btn.textContent = '💾 Сохранить';
      }
    }
  },

  /**
   * Рендерит список таймкодов
   */
  renderTimestamps() {
    const listEl = document.getElementById('timestamps-list');
    if (!listEl) return;

    const timestamps = this.getCurrentTimestamps();

    if (!timestamps || timestamps.length === 0) {
      listEl.innerHTML = '<p class="no-timestamps">Нет таймкодов. Нажмите "+ Добавить" для создания.</p>';
      return;
    }

    let html = '';
    timestamps.forEach((item, index) => {
      // Поддержка обоих форматов: {timestamp: {...}} и просто {...}
      const ts = item.timestamp || item;
      html += `
        <div class="timestamp-item" data-index="${index}">
          <span class="timestamp-number">${index + 1}</span>
          <input type="text" class="timestamp-label" value="${this.escapeHtml(ts.time_label || ts.timeLabel || '')}"
                 data-field="time_label" placeholder="00:00" title="Время (MM:SS)">
          <input type="text" class="timestamp-title-input" value="${this.escapeHtml(ts.title || '')}"
                 data-field="title" placeholder="Описание метки">
          <div class="timestamp-actions">
            <button class="btn-move-up" title="Вверх">▲</button>
            <button class="btn-move-down" title="Вниз">▼</button>
            <button class="btn-delete-timestamp" title="Удалить">✕</button>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;
  },

  /**
   * Обновляет таймкод из поля ввода
   */
  updateTimestampFromInput(input) {
    const item = input.closest('.timestamp-item');
    const index = parseInt(item?.dataset.index);
    const field = input.dataset.field;
    const timestamps = this.getCurrentTimestamps();

    if (timestamps && timestamps[index]) {
      const ts = timestamps[index].timestamp || timestamps[index];
      ts[field] = input.value;

      if (field === 'time_label') {
        ts.time = String(this.timeLabelToSeconds(input.value));
      }
    }
  },

  /**
   * Конвертирует time_label в секунды
   */
  timeLabelToSeconds(label) {
    if (!label) return 0;
    const parts = label.split(':').map(Number);
    if (parts.length === 2) {
      return (parts[0] || 0) * 60 + (parts[1] || 0);
    } else if (parts.length === 3) {
      return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    }
    return 0;
  },

  /**
   * Конвертирует секунды в time_label
   */
  secondsToTimeLabel(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },

  /**
   * Добавляет новый таймкод
   */
  addTimestamp() {
    let timestamps = this.getCurrentTimestamps();

    if (!timestamps) {
      timestamps = [];
      this.setCurrentTimestamps(timestamps);
    }

    let newTime = 0;
    if (timestamps.length > 0) {
      const lastTs = timestamps[timestamps.length - 1].timestamp || timestamps[timestamps.length - 1];
      newTime = parseInt(lastTs.time || 0) + 30;
    }

    // Используем формат в зависимости от режима
    if (this.mode === 'playlist') {
      timestamps.push({
        timestamp: {
          title: '',
          time_label: this.secondsToTimeLabel(newTime),
          time: String(newTime)
        }
      });
    } else {
      timestamps.push({
        title: '',
        time_label: this.secondsToTimeLabel(newTime),
        time: String(newTime)
      });
    }

    this.hasChanges = true;
    this.renderTimestamps();
    this.updateSaveButton();
    this.updateSelectorCounts();

    setTimeout(() => {
      const items = document.querySelectorAll('.timestamp-item');
      const lastItem = items[items.length - 1];
      lastItem?.querySelector('.timestamp-title-input')?.focus();
    }, 50);
  },

  /**
   * Удаляет таймкод
   */
  deleteTimestamp(index) {
    const timestamps = this.getCurrentTimestamps();
    if (!timestamps) return;

    timestamps.splice(index, 1);
    this.hasChanges = true;
    this.renderTimestamps();
    this.updateSaveButton();
    this.updateSelectorCounts();
  },

  /**
   * Перемещает таймкод
   */
  moveTimestamp(index, direction) {
    const timestamps = this.getCurrentTimestamps();
    if (!timestamps) return;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= timestamps.length) return;

    const temp = timestamps[index];
    timestamps[index] = timestamps[newIndex];
    timestamps[newIndex] = temp;

    this.hasChanges = true;
    this.renderTimestamps();
    this.updateSaveButton();
  },

  /**
   * Обновляет счётчики в селекторе
   */
  updateSelectorCounts() {
    if (this.mode === 'playlist') {
      this.renderPlaylistSelector();
      if (this.currentVideoIndex) {
        const selector = document.getElementById('video-selector');
        if (selector) {
          selector.value = `${this.currentVideoIndex.groupIndex}-${this.currentVideoIndex.videoIndex}`;
        }
      }
    } else if (this.mode === 'inline') {
      this.renderInlineSelector();
      const selector = document.getElementById('video-selector');
      if (selector) {
        selector.value = String(this.currentInlineIndex);
      }
    }
  },

  /**
   * Сохраняет данные
   */
  async save() {
    if (this.mode === 'playlist') {
      await this.savePlaylist();
    } else if (this.mode === 'inline') {
      this.saveInline();
    }
  },

  /**
   * Сохраняет playlist данные
   */
  async savePlaylist() {
    if (!this.currentVideoFile || !this.videoData) return;

    try {
      const json = JSON.stringify(this.videoData, null, 4);
      const result = await window.api.writeFile(this.currentVideoFile, json);

      if (result.success) {
        this.hasChanges = false;
        this.updateSaveButton();
        StatusBar.showMessage('Таймкоды сохранены', 2000);
      } else {
        await window.api.showMessage('Ошибка сохранения: ' + result.error, 'error', 'Ошибка');
      }
    } catch (e) {
      console.error('Ошибка сохранения:', e);
      await window.api.showMessage('Ошибка сохранения', 'error', 'Ошибка');
    }
  },

  /**
   * Сохраняет inline данные (обновляет HTML контент)
   */
  saveInline() {
    // Обновляем data-timestamps атрибуты в текущем контенте редактора
    const editorContent = AppState.currentView === 'code'
      ? CodeEditor.getContent()
      : Editor.getContent();

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editorContent;

    const videos = tempDiv.querySelectorAll('video');

    this.inlineVideos.forEach((videoData, index) => {
      const videoEl = videos[index];
      if (videoEl && videoData.timestamps && videoData.timestamps.length > 0) {
        videoEl.setAttribute('data-timestamps', JSON.stringify(videoData.timestamps));
        if (videoData.duration) {
          videoEl.setAttribute('data-duration', videoData.duration);
        }
      } else if (videoEl) {
        videoEl.removeAttribute('data-timestamps');
      }
    });

    const newContent = tempDiv.innerHTML;

    if (AppState.currentView === 'code') {
      CodeEditor.setContent(newContent);
    } else {
      Editor.setContent(newContent);
    }

    AppState.currentContent = newContent;
    AppState.hasUnsavedChanges = true;
    AppState.modifiedFiles.add(AppState.selectedNode);

    this.hasChanges = false;
    this.updateSaveButton();
    StatusBar.showMessage('Таймкоды добавлены в контент. Сохраните страницу.', 3000);
  },

  /**
   * Получает таймкоды для генерации (используется при сборке)
   */
  getTimestampsForBuild() {
    return this.inlineVideos;
  },

  /**
   * Обновляет панель на основе текущего контента редактора
   * Вызывается после добавления видео
   */
  refreshFromEditor() {
    const editorContent = Editor.getContent();
    if (!editorContent) return;

    // Создаём полный HTML для проверки
    const fullHtml = `<!DOCTYPE html><html><body>${editorContent}</body></html>`;

    const detected = this.detectVideoContent(fullHtml);

    if (detected && detected.type === 'inline') {
      this.loadInline(detected.data);
    } else if (!detected && this.mode === 'inline') {
      // Если видео было удалено - скрываем панель
      this.hide();
    }
  },

  /**
   * Экранирование HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Экспорт для браузера
window.VideoEditor = VideoEditor;
