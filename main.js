const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

let mainWindow;
let currentProjectPath = null;
let outputPath = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'assets/icons/icon.png'),
    title: 'Help Editor'
  });

  mainWindow.loadFile('src/index.html');

  // Открыть DevTools в режиме разработки
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('close', (e) => {
    mainWindow.webContents.send('app-closing');
  });
}

// Создание меню приложения
function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Создать проект справки...',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => mainWindow.webContents.send('menu-create-project')
        },
        {
          label: 'Открыть папку со справкой...',
          accelerator: 'CmdOrCtrl+O',
          click: () => openProjectFolder()
        },
        { type: 'separator' },
        {
          label: 'Сохранить',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-save')
        },
        {
          label: 'Сохранить всё',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('menu-save-all')
        },
        { type: 'separator' },
        {
          label: 'Сборка',
          accelerator: 'CmdOrCtrl+B',
          click: () => mainWindow.webContents.send('menu-build')
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'Закрыть' } : { role: 'quit', label: 'Выход' }
      ]
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { type: 'separator' },
        {
          label: 'Добавить раздел',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu-add-section')
        },
        {
          label: 'Удалить раздел',
          accelerator: 'Delete',
          click: () => mainWindow.webContents.send('menu-delete-section')
        },
        {
          label: 'Переименовать раздел',
          accelerator: 'F2',
          click: () => mainWindow.webContents.send('menu-rename-section')
        }
      ]
    },
    {
      label: 'Вставка',
      submenu: [
        {
          label: 'Изображение...',
          click: () => mainWindow.webContents.send('menu-insert-image')
        },
        {
          label: 'Ссылка...',
          accelerator: 'CmdOrCtrl+K',
          click: () => mainWindow.webContents.send('menu-insert-link')
        },
        {
          label: 'Таблица...',
          click: () => mainWindow.webContents.send('menu-insert-table')
        },
        {
          label: 'Видео...',
          click: () => mainWindow.webContents.send('menu-insert-video')
        }
      ]
    },
    {
      label: 'Формат',
      submenu: [
        {
          label: 'Жирный',
          accelerator: 'CmdOrCtrl+B',
          click: () => mainWindow.webContents.send('menu-format', 'bold')
        },
        {
          label: 'Курсив',
          accelerator: 'CmdOrCtrl+I',
          click: () => mainWindow.webContents.send('menu-format', 'italic')
        },
        {
          label: 'Подчёркнутый',
          accelerator: 'CmdOrCtrl+U',
          click: () => mainWindow.webContents.send('menu-format', 'underline')
        },
        { type: 'separator' },
        {
          label: 'Заголовок 1',
          click: () => mainWindow.webContents.send('menu-format', 'h1')
        },
        {
          label: 'Заголовок 2',
          click: () => mainWindow.webContents.send('menu-format', 'h2')
        },
        {
          label: 'Заголовок 3',
          click: () => mainWindow.webContents.send('menu-format', 'h3')
        },
        { type: 'separator' },
        {
          label: 'Маркированный список',
          click: () => mainWindow.webContents.send('menu-format', 'bullist')
        },
        {
          label: 'Нумерованный список',
          click: () => mainWindow.webContents.send('menu-format', 'numlist')
        }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        {
          label: 'Редактор',
          type: 'radio',
          checked: true,
          click: () => mainWindow.webContents.send('menu-view', 'editor')
        },
        {
          label: 'HTML-код',
          type: 'radio',
          click: () => mainWindow.webContents.send('menu-view', 'code')
        },
        {
          label: 'Предпросмотр',
          type: 'radio',
          click: () => mainWindow.webContents.send('menu-view', 'preview')
        },
        { type: 'separator' },
        { role: 'reload', label: 'Перезагрузить' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полноэкранный режим' }
      ]
    },
    {
      label: 'Справка',
      submenu: [
        {
          label: 'О программе',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'О программе',
              message: 'Help Editor',
              detail: 'Редактор справочной документации\nВерсия 1.0.0'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Открыть папку со справкой
async function openProjectFolder() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите папку со справкой',
    properties: ['openDirectory'],
    buttonLabel: 'Открыть'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0];

    const tocPath = path.join(folderPath, 'hmcontent.htm');
    if (!fs.existsSync(tocPath)) {
      dialog.showErrorBox('Ошибка', 'В выбранной папке не найден файл hmcontent.htm.\n\nВыберите папку, содержащую справку WebHelp.');
      return;
    }

    currentProjectPath = folderPath;
    mainWindow.webContents.send('project-opened', folderPath);
    mainWindow.setTitle(`Help Editor - ${path.basename(folderPath)}`);
  }
}

// Путь к папке с шаблонами
const TEMPLATE_PATH = path.join(__dirname, 'assets', 'help-template');

// Путь к FlexSearch
const FLEXSEARCH_PATH = path.join(__dirname, 'assets', 'flexsearch');

/**
 * Записывает файл с поддержкой retry и фонового копирования
 * @param {string} filePath - путь к целевому файлу
 * @param {string|Buffer} content - содержимое для записи
 * @param {string} encoding - кодировка (по умолчанию 'utf-8')
 * @returns {{success: boolean, pending?: boolean, error?: string}}
 */
function writeFileWithReplace(filePath, content, encoding = 'utf-8') {
  const tempPath = filePath + '.tmp';
  const pendingPath = filePath + '.pending';

  try {
    // 1. Записываем во временный файл
    fs.writeFileSync(tempPath, content, encoding);

    // 2. Если целевой файл не существует — просто переименовываем
    if (!fs.existsSync(filePath)) {
      fs.renameSync(tempPath, filePath);
      return { success: true };
    }

    // 3. Пробуем обычную перезапись с retry
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        fs.writeFileSync(filePath, content, encoding);
        fs.unlinkSync(tempPath);
        return { success: true };
      } catch (e) {
        if (e.code !== 'EPERM' && e.code !== 'EBUSY') {
          fs.unlinkSync(tempPath);
          throw e;
        }
        // Ждём перед повторной попыткой
        if (attempt < 2) {
          const { execSync } = require('child_process');
          try {
            execSync('ping -n 2 127.0.0.1 > nul', { windowsHide: true, shell: true });
          } catch (e) { /* ignore */ }
        }
      }
    }

    // 4. Файл заблокирован — сохраняем как .pending и запускаем фоновое копирование
    fs.renameSync(tempPath, pendingPath);

    if (process.platform === 'win32') {
      // Запускаем фоновый PowerShell скрипт для копирования
      startBackgroundCopy(pendingPath, filePath);
    }

    return { success: true, pending: true };

  } catch (error) {
    try { fs.unlinkSync(tempPath); } catch (e) { /* ignore */ }
    return { success: false, error: error.message };
  }
}

/**
 * Запускает фоновый процесс для копирования файла когда он освободится
 */
function startBackgroundCopy(sourcePath, targetPath) {
  const { spawn } = require('child_process');

  // PowerShell скрипт который ждёт и копирует файл
  const psScript = `
$source = '${sourcePath.replace(/'/g, "''")}'
$target = '${targetPath.replace(/'/g, "''")}'
$maxAttempts = 60
$attempt = 0

while ($attempt -lt $maxAttempts) {
    Start-Sleep -Seconds 5
    try {
        Copy-Item -Path $source -Destination $target -Force -ErrorAction Stop
        Remove-Item -Path $source -Force -ErrorAction SilentlyContinue
        exit 0
    } catch {
        $attempt++
    }
}
`;

  // Запускаем PowerShell в фоне (detached)
  const child = spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', psScript], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });

  child.unref(); // Отсоединяем от родительского процесса
}

// Создать новый проект справки
async function createProject(options) {
  const { title, version, folderPath, firstSectionTitle } = options;

  // Проверяем что папка существует или создаём её
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  // Проверяем что папка не содержит hmcontent.htm (уже существующий проект)
  const tocPath = path.join(folderPath, 'hmcontent.htm');
  if (fs.existsSync(tocPath)) {
    throw new Error('В этой папке уже существует проект справки (hmcontent.htm)');
  }

  // Копируем шаблонные файлы
  const templateFiles = [
    'default.css',
    'scrollbars.css',
    'custom.css',
    'helpman_settings.js',
    'helpman_topicinit.js'
  ];

  for (const file of templateFiles) {
    const srcPath = path.join(TEMPLATE_PATH, file);
    const destPath = path.join(folderPath, file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  // Читаем шаблон hmcontent.htm и заменяем плейсхолдеры
  const hmcontentTemplate = fs.readFileSync(path.join(TEMPLATE_PATH, 'hmcontent.htm'), 'utf-8');
  const helpTitle = version ? `${title} ${version}` : title;
  const sectionTitle = firstSectionTitle || 'Введение';

  const hmcontent = hmcontentTemplate
    .replace(/\{\{HELP_TITLE\}\}/g, helpTitle)
    .replace(/\{\{FIRST_SECTION\}\}/g, sectionTitle);

  fs.writeFileSync(tocPath, hmcontent, 'utf-8');

  // Создаём первую страницу
  const pageTemplate = fs.readFileSync(path.join(TEMPLATE_PATH, 'page.htm'), 'utf-8');
  const firstPage = pageTemplate.replace(/\{\{PAGE_TITLE\}\}/g, sectionTitle);
  fs.writeFileSync(path.join(folderPath, 'index.htm'), firstPage, 'utf-8');

  // Создаём пустые файлы helpCodes
  const helpCodesJs = `window.helpCodes = { data: [\n"index"\n] };`;
  fs.writeFileSync(path.join(folderPath, 'helpCodes.js'), helpCodesJs, 'utf-8');

  const helpCodesXml = `<?xml version="1.0" encoding="utf-8"?>
<HelpCodes>
  <HelpCode code="index" topic="index.htm" />
</HelpCodes>`;
  fs.writeFileSync(path.join(folderPath, 'helpCodes.xml'), helpCodesXml, 'utf-8');

  // Создаём toc.js
  const tocJs = `window.TOC={"id":"toc","elements":{"1":{"level":1,"url":"index.htm","text":"${sectionTitle}","child":null}}};`;
  fs.writeFileSync(path.join(folderPath, 'toc.js'), tocJs, 'utf-8');

  return folderPath;
}

// Регистрация IPC обработчиков
function setupIpcHandlers() {
  ipcMain.handle('open-folder-dialog', async () => {
    await openProjectFolder();
    return currentProjectPath;
  });

  // Создание нового проекта
  ipcMain.handle('create-project', async (event, options) => {
    try {
      const projectPath = await createProject(options);
      currentProjectPath = projectPath;
      mainWindow.webContents.send('project-opened', projectPath);
      mainWindow.setTitle(`Help Editor - ${path.basename(projectPath)}`);
      return { success: true, path: projectPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Диалог выбора папки для нового проекта
  ipcMain.handle('select-project-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите папку для нового проекта',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Выбрать'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const folderPath = result.filePaths[0];

      // Проверяем не содержит ли папка hmcontent.htm
      const tocPath = path.join(folderPath, 'hmcontent.htm');
      if (fs.existsSync(tocPath)) {
        return {
          success: false,
          error: 'В этой папке уже существует проект справки. Выберите пустую папку или создайте новую.'
        };
      }

      return { success: true, path: folderPath };
    }

    return { success: false, canceled: true };
  });

  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(currentProjectPath, filePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(currentProjectPath, filePath);
      fs.writeFileSync(fullPath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('file-exists', async (event, filePath) => {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(currentProjectPath, filePath);
      return fs.existsSync(fullPath);
    } catch (error) {
      return false;
    }
  });

  ipcMain.handle('list-files', async (event, dirPath, extension) => {
    try {
      const fullPath = dirPath ? path.join(currentProjectPath, dirPath) : currentProjectPath;
      const files = fs.readdirSync(fullPath);
      if (extension) {
        return files.filter(f => f.toLowerCase().endsWith(extension.toLowerCase()));
      }
      return files;
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('list-files-recursive', async (event, dirPath, extensions) => {
    try {
      const fullPath = dirPath ? path.join(currentProjectPath, dirPath) : currentProjectPath;
      const results = [];

      const walk = (dir, prefix) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const relativePath = prefix ? prefix + '/' + entry.name : entry.name;
          if (entry.isDirectory()) {
            walk(path.join(dir, entry.name), relativePath);
          } else if (entry.isFile()) {
            if (!extensions || extensions.some(ext => entry.name.toLowerCase().endsWith(ext))) {
              results.push(relativePath);
            }
          }
        }
      };

      walk(fullPath, '');
      return results;
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('delete-file', async (event, filePath) => {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(currentProjectPath, filePath);
      fs.unlinkSync(fullPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-project-path', () => {
    return currentProjectPath;
  });

  ipcMain.handle('show-confirm', async (event, message, title) => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Да', 'Нет'],
      defaultId: 1,
      title: title || 'Подтверждение',
      message: message
    });
    return result.response === 0;
  });

  ipcMain.handle('show-message', async (event, message, type, title) => {
    await dialog.showMessageBox(mainWindow, {
      type: type || 'info',
      title: title || 'Сообщение',
      message: message
    });
  });

  ipcMain.handle('select-image', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите изображение',
      filters: [
        { name: 'Изображения', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const imagePath = result.filePaths[0];
      const fileName = path.basename(imagePath);

      if (currentProjectPath && !imagePath.startsWith(currentProjectPath)) {
        const destPath = path.join(currentProjectPath, fileName);
        fs.copyFileSync(imagePath, destPath);
        return { success: true, path: fileName };
      }

      const relativePath = currentProjectPath ? path.relative(currentProjectPath, imagePath) : fileName;
      return { success: true, path: relativePath };
    }

    return { success: false };
  });

  ipcMain.handle('select-video', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите видео',
      filters: [
        { name: 'Видео', extensions: ['mp4', 'webm', 'ogg', 'avi', 'mov'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const videoPath = result.filePaths[0];
      const fileName = path.basename(videoPath);

      if (currentProjectPath && !videoPath.startsWith(currentProjectPath)) {
        const destPath = path.join(currentProjectPath, fileName);
        fs.copyFileSync(videoPath, destPath);
        return { success: true, path: fileName };
      }

      const relativePath = currentProjectPath ? path.relative(currentProjectPath, videoPath) : fileName;
      return { success: true, path: relativePath };
    }

    return { success: false };
  });

  // Выбор HTML файла для импорта раздела
  ipcMain.handle('select-html-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите HTML файл',
      filters: [
        { name: 'HTML файлы', extensions: ['htm', 'html'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const htmlPath = result.filePaths[0];
      const fileName = path.basename(htmlPath);

      // Читаем содержимое файла
      const content = fs.readFileSync(htmlPath, 'utf-8');

      // Извлекаем заголовок из файла
      let title = fileName.replace(/\.(htm|html)$/i, '');
      const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      } else {
        const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (h1Match) {
          title = h1Match[1].trim();
        }
      }

      // Копируем файл в проект если он вне проекта
      let destFileName = fileName;
      if (currentProjectPath && !htmlPath.startsWith(currentProjectPath)) {
        // Проверяем существует ли файл с таким именем
        let destPath = path.join(currentProjectPath, fileName);
        let counter = 1;
        while (fs.existsSync(destPath)) {
          const ext = path.extname(fileName);
          const base = path.basename(fileName, ext);
          destFileName = `${base}_${counter}${ext}`;
          destPath = path.join(currentProjectPath, destFileName);
          counter++;
        }
        fs.copyFileSync(htmlPath, destPath);
      } else if (currentProjectPath) {
        destFileName = path.relative(currentProjectPath, htmlPath);
      }

      return { success: true, path: destFileName, title: title, content: content };
    }

    return { success: false };
  });

  // Выбор CSS файлов
  ipcMain.handle('select-css-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите CSS файлы',
      filters: [
        { name: 'CSS файлы', extensions: ['css'] }
      ],
      properties: ['openFile', 'multiSelections']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const files = [];

      for (const cssPath of result.filePaths) {
        const fileName = path.basename(cssPath);

        // Копируем файл в проект если он вне проекта
        let destFileName = fileName;
        if (currentProjectPath && !cssPath.startsWith(currentProjectPath)) {
          let destPath = path.join(currentProjectPath, fileName);
          let counter = 1;
          while (fs.existsSync(destPath)) {
            const ext = path.extname(fileName);
            const base = path.basename(fileName, ext);
            destFileName = `${base}_${counter}${ext}`;
            destPath = path.join(currentProjectPath, destFileName);
            counter++;
          }
          fs.copyFileSync(cssPath, destPath);
        } else if (currentProjectPath) {
          destFileName = path.relative(currentProjectPath, cssPath);
        }

        files.push(destFileName);
      }

      return { success: true, files: files };
    }

    return { success: false };
  });

  // Получить список CSS файлов в проекте
  ipcMain.handle('get-css-files', async () => {
    if (!currentProjectPath) return [];
    try {
      const files = fs.readdirSync(currentProjectPath);
      return files.filter(f => f.endsWith('.css'));
    } catch (error) {
      return [];
    }
  });

  // Выбор папки для сборки
  ipcMain.handle('select-output-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите папку для сборки',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Выбрать'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      outputPath = result.filePaths[0];
      return { success: true, path: outputPath };
    }

    return { success: false, canceled: true };
  });

  // Получить путь к папке сборки
  ipcMain.handle('get-output-path', () => {
    return outputPath;
  });

  // Установить путь к папке сборки
  ipcMain.handle('set-output-path', (event, path) => {
    outputPath = path;
    return { success: true };
  });

  // Сборка проекта - копирование всех файлов в папку вывода
  ipcMain.handle('build-project', async (event, options) => {
    const { outputFolder, generatedFiles } = options;

    if (!currentProjectPath) {
      return { success: false, error: 'Проект не открыт' };
    }

    if (!outputFolder) {
      return { success: false, error: 'Не указана папка для сборки' };
    }

    try {
      // Нормализуем пути для сравнения
      const normalizedProject = path.normalize(currentProjectPath).toLowerCase();
      const normalizedOutput = path.normalize(outputFolder).toLowerCase();
      const isSameFolder = normalizedProject === normalizedOutput;

      // Создаём папку вывода если не существует
      if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
      }

      // Копируем файлы только если папки разные
      if (!isSameFolder) {
        // Рекурсивное копирование файлов
        const copyRecursive = (src, dest) => {
          const entries = fs.readdirSync(src, { withFileTypes: true });

          for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            // Пропускаем служебные файлы и папки
            if (entry.name.startsWith('.') || entry.name === 'node_modules') {
              continue;
            }

            if (entry.isDirectory()) {
              if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath, { recursive: true });
              }
              copyRecursive(srcPath, destPath);
            } else {
              fs.copyFileSync(srcPath, destPath);
            }
          }
        };

        // Копируем все файлы из проекта
        copyRecursive(currentProjectPath, outputFolder);
      }

      // Записываем сгенерированные файлы с поддержкой замены заблокированных
      const skippedFiles = []; // Файлы которые не удалось записать
      const pendingFiles = []; // Файлы которые будут скопированы в фоне

      if (generatedFiles) {
        for (const [fileName, content] of Object.entries(generatedFiles)) {
          const filePath = path.join(outputFolder, fileName);
          const result = writeFileWithReplace(filePath, content);
          if (!result.success) {
            skippedFiles.push(fileName);
          } else if (result.pending) {
            pendingFiles.push(fileName);
          }
        }
      }

      // Копируем шаблонные файлы оболочки (не трогаем default.css и custom.css — они проектные)
      const templateDesignFiles = [
        'scrollbars.css',
        'index.html', 'helpman_topicinit.js', 'helpman_settings.js'
      ];
      for (const fileName of templateDesignFiles) {
        const srcPath = path.join(TEMPLATE_PATH, fileName);
        const destPath = path.join(outputFolder, fileName);
        if (fs.existsSync(srcPath)) {
          const content = fs.readFileSync(srcPath);
          const result = writeFileWithReplace(destPath, content);
          if (!result.success) {
            skippedFiles.push(fileName);
          } else if (result.pending) {
            pendingFiles.push(fileName);
          }
        }
      }

      // Копируем файлы поиска
      const templateFiles = ['search-client.js', 'hmftsearch.htm'];
      for (const fileName of templateFiles) {
        const srcPath = path.join(TEMPLATE_PATH, fileName);
        const destPath = path.join(outputFolder, fileName);
        if (fs.existsSync(srcPath)) {
          const content = fs.readFileSync(srcPath);
          const result = writeFileWithReplace(destPath, content);
          if (!result.success) {
            skippedFiles.push(fileName);
          } else if (result.pending) {
            pendingFiles.push(fileName);
          }
        }
      }

      outputPath = outputFolder;

      // Формируем результат
      const result = { success: true, path: outputFolder };

      if (pendingFiles.length > 0) {
        result.pendingFiles = pendingFiles;
      }

      if (skippedFiles.length > 0) {
        result.skippedFiles = skippedFiles;
      }

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Выбор нескольких изображений для добавления в проект
  ipcMain.handle('select-images', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите изображения',
      filters: [
        { name: 'Изображения', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] }
      ],
      properties: ['openFile', 'multiSelections']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const files = [];

      for (const imagePath of result.filePaths) {
        const fileName = path.basename(imagePath);

        // Копируем файл в проект если он вне проекта
        let destFileName = fileName;
        if (currentProjectPath && !imagePath.startsWith(currentProjectPath)) {
          let destPath = path.join(currentProjectPath, fileName);
          let counter = 1;
          while (fs.existsSync(destPath)) {
            const ext = path.extname(fileName);
            const base = path.basename(fileName, ext);
            destFileName = `${base}_${counter}${ext}`;
            destPath = path.join(currentProjectPath, destFileName);
            counter++;
          }
          fs.copyFileSync(imagePath, destPath);
        } else if (currentProjectPath) {
          destFileName = path.relative(currentProjectPath, imagePath);
        }

        files.push(destFileName);
      }

      return { success: true, files: files };
    }

    return { success: false };
  });
}

// Запуск приложения
app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
