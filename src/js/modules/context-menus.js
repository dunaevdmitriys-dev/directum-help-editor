/**
 * Help Editor - Context Menus
 *
 * Контекстные меню для:
 * - Разделов в дереве
 * - Неиспользуемых страниц (сирот)
 * - Неиспользуемых изображений
 *
 * @module modules/context-menus
 */

/**
 * Контекстное меню для разделов
 */
const ContextMenu = {
  /**
   * @type {HTMLElement|null}
   */
  menu: null,

  /**
   * Инициализация
   */
  init() {
    this.menu = document.getElementById('context-menu');
    document.addEventListener('click', () => this.hide());

    this.menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        switch (action) {
          case 'section-card':
            Dialogs.showSectionCard(AppState.selectedNode);
            break;
          case 'add-child':
            Dialogs.showAddSection(AppState.selectedNode);
            break;
          case 'add-after':
            Dialogs.showAddSection(null, AppState.selectedNode);
            break;
          case 'add-from-file':
            Dialogs.showAddSection(AppState.selectedNode);
            break;
          case 'rename':
            Dialogs.showRename(AppState.selectedNode);
            break;
          case 'add-images':
            Dialogs.showAddImagesToSection(AppState.selectedNode);
            break;
          case 'manage-css':
            Dialogs.showCssManager(AppState.selectedNode);
            break;
          case 'delete':
            App.deleteSection(AppState.selectedNode);
            break;
        }
        this.hide();
      });
    });
  },

  /**
   * Показать меню
   * @param {number} x - Координата X
   * @param {number} y - Координата Y
   * @param {string} nodeId - ID узла
   */
  show(x, y, nodeId) {
    this.menu.style.visibility = 'hidden';
    this.menu.classList.remove('hidden');

    const menuRect = this.menu.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    let finalX = x;
    let finalY = y;

    if (x + menuRect.width > windowWidth) {
      finalX = windowWidth - menuRect.width - 10;
    }

    if (y + menuRect.height > windowHeight) {
      finalY = y - menuRect.height;
      if (finalY < 0) finalY = 10;
    }

    this.menu.style.left = `${finalX}px`;
    this.menu.style.top = `${finalY}px`;
    this.menu.style.visibility = 'visible';
  },

  /**
   * Скрыть меню
   */
  hide() {
    this.menu.classList.add('hidden');
  }
};

/**
 * Контекстное меню для неиспользуемых страниц
 */
const OrphanContextMenu = {
  /**
   * @type {HTMLElement|null}
   */
  menu: null,

  /**
   * Текущий файл
   * @type {string|null}
   */
  currentFilename: null,

  /**
   * Инициализация
   */
  init() {
    this.menu = document.getElementById('orphan-context-menu');
    if (!this.menu) return;
    document.addEventListener('click', () => this.hide());

    this.menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        if (action === 'orphan-card' && this.currentFilename) {
          Dialogs.showOrphanCard(this.currentFilename);
        } else if (action === 'add-to-root' && this.currentFilename) {
          App.adoptOrphanPage(this.currentFilename, null);
        } else if (action === 'delete-file' && this.currentFilename) {
          App.deleteOrphanFile(this.currentFilename);
        }
        this.hide();
      });
    });
  },

  /**
   * Показать меню
   * @param {number} x - Координата X
   * @param {number} y - Координата Y
   * @param {string} filename - Имя файла
   */
  show(x, y, filename) {
    this.currentFilename = filename;
    this.menu.style.visibility = 'hidden';
    this.menu.classList.remove('hidden');

    const menuRect = this.menu.getBoundingClientRect();
    let finalX = Math.min(x, window.innerWidth - menuRect.width - 10);
    let finalY = y;
    if (y + menuRect.height > window.innerHeight) {
      finalY = y - menuRect.height;
      if (finalY < 0) finalY = 10;
    }

    this.menu.style.left = `${finalX}px`;
    this.menu.style.top = `${finalY}px`;
    this.menu.style.visibility = 'visible';
  },

  /**
   * Скрыть меню
   */
  hide() {
    if (this.menu) this.menu.classList.add('hidden');
  }
};

/**
 * Контекстное меню для неиспользуемых изображений
 */
const ImageContextMenu = {
  /**
   * @type {HTMLElement|null}
   */
  menu: null,

  /**
   * Текущий путь к изображению
   * @type {string|null}
   */
  currentImagePath: null,

  /**
   * Инициализация
   */
  init() {
    this.menu = document.getElementById('image-context-menu');
    if (!this.menu) return;
    document.addEventListener('click', () => this.hide());

    this.menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        if (action === 'delete-image' && this.currentImagePath) {
          App.deleteUnusedImage(this.currentImagePath);
        }
        this.hide();
      });
    });
  },

  /**
   * Показать меню
   * @param {number} x - Координата X
   * @param {number} y - Координата Y
   * @param {string} imagePath - Путь к изображению
   */
  show(x, y, imagePath) {
    this.currentImagePath = imagePath;
    this.menu.style.visibility = 'hidden';
    this.menu.classList.remove('hidden');

    const menuRect = this.menu.getBoundingClientRect();
    let finalX = Math.min(x, window.innerWidth - menuRect.width - 10);
    let finalY = y;
    if (y + menuRect.height > window.innerHeight) {
      finalY = y - menuRect.height;
      if (finalY < 0) finalY = 10;
    }

    this.menu.style.left = `${finalX}px`;
    this.menu.style.top = `${finalY}px`;
    this.menu.style.visibility = 'visible';
  },

  /**
   * Скрыть меню
   */
  hide() {
    if (this.menu) this.menu.classList.add('hidden');
  }
};

// Экспорт для браузера
window.ContextMenu = ContextMenu;
window.OrphanContextMenu = OrphanContextMenu;
window.ImageContextMenu = ImageContextMenu;
