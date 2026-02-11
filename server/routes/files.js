/**
 * Help Editor - Files API Routes
 *
 * REST endpoints для файловых операций.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config');
const { resolveSafe, isPathInside } = require('../middleware/sandbox');

/**
 * Получить projectPath из запроса или конфига
 */
function getProjectPath(req) {
  return config.projectPath || req.body.projectPath || req.query.projectPath || req.query.project;
}

/**
 * POST /api/files/read
 * Чтение файла
 */
router.post('/read', (req, res) => {
  try {
    const { path: filePath } = req.body;
    const projectPath = getProjectPath(req);
    const result = resolveSafe(filePath, projectPath);
    if (result.error) return res.status(403).json({ success: false, error: result.error });

    if (!fs.existsSync(result.fullPath)) {
      return res.json({ success: false, error: 'Файл не найден' });
    }

    const content = fs.readFileSync(result.fullPath, 'utf-8');
    res.json({ success: true, content });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

/**
 * POST /api/files/write
 * Запись файла
 */
router.post('/write', (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    const projectPath = getProjectPath(req);
    const result = resolveSafe(filePath, projectPath);
    if (result.error) return res.status(403).json({ success: false, error: result.error });

    // Создаём директорию если не существует
    const dir = path.dirname(result.fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(result.fullPath, content, 'utf-8');
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

/**
 * POST /api/files/exists
 * Проверка существования файла
 */
router.post('/exists', (req, res) => {
  try {
    const { path: filePath } = req.body;
    const projectPath = getProjectPath(req);
    const result = resolveSafe(filePath, projectPath);
    if (result.error) return res.json({ exists: false });

    const exists = fs.existsSync(result.fullPath);
    res.json({ exists });
  } catch (error) {
    res.json({ exists: false });
  }
});

/**
 * POST /api/files/list
 * Список файлов в директории
 */
router.post('/list', (req, res) => {
  try {
    const { path: dirPath, extension } = req.body;
    const projectPath = getProjectPath(req);
    const result = resolveSafe(dirPath, projectPath);
    if (result.error) return res.json({ files: [] });
    const fullPath = result.fullPath;

    if (!fs.existsSync(fullPath)) {
      return res.json({ files: [] });
    }

    let files = fs.readdirSync(fullPath);

    if (extension) {
      files = files.filter(f => f.toLowerCase().endsWith(extension.toLowerCase()));
    }

    res.json({ files });
  } catch (error) {
    res.json({ files: [] });
  }
});

/**
 * POST /api/files/list-recursive
 * Рекурсивный список файлов
 */
router.post('/list-recursive', (req, res) => {
  try {
    const { path: dirPath, extensions } = req.body;
    const projectPath = getProjectPath(req);
    const result = resolveSafe(dirPath, projectPath);
    if (result.error) return res.json({ files: [] });
    const fullPath = result.fullPath;

    if (!fs.existsSync(fullPath)) {
      return res.json({ files: [] });
    }

    const results = [];

    const walk = (dir, prefix) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Пропускаем скрытые файлы и node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

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
    res.json({ files: results });
  } catch (error) {
    res.json({ files: [] });
  }
});

/**
 * POST /api/files/delete
 * Удаление файла
 */
router.post('/delete', (req, res) => {
  try {
    const { path: filePath } = req.body;
    const projectPath = getProjectPath(req);
    const result = resolveSafe(filePath, projectPath);
    if (result.error) return res.status(403).json({ success: false, error: result.error });

    if (!fs.existsSync(result.fullPath)) {
      return res.json({ success: false, error: 'Файл не найден' });
    }

    fs.unlinkSync(result.fullPath);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

/**
 * POST /api/files/upload
 * Загрузка файлов
 */
router.post('/upload', (req, res) => {
  const uploadHandler = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const projectPath = getProjectPath(req);
        if (!projectPath || !fs.existsSync(projectPath)) {
          return cb(new Error('Проект не открыт'));
        }
        cb(null, projectPath);
      },
      filename: (req, file, cb) => {
        // Декодируем имя файла
        let originalName;
        try {
          originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        } catch (e) {
          originalName = file.originalname;
        }

        // Sandbox: имя файла не должно содержать path traversal
        originalName = path.basename(originalName);

        // Проверяем на конфликт имён
        const projectPath = getProjectPath(req);
        if (projectPath) {
          let destPath = path.join(projectPath, originalName);
          let counter = 1;
          while (fs.existsSync(destPath)) {
            const ext = path.extname(originalName);
            const base = path.basename(originalName, ext);
            originalName = `${base}_${counter}${ext}`;
            destPath = path.join(projectPath, originalName);
            counter++;
          }
        }

        cb(null, originalName);
      }
    })
  }).array('files', 20);

  uploadHandler(req, res, (err) => {
    if (err) {
      return res.json({ success: false, error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.json({ success: false, error: 'Файлы не получены' });
    }

    const files = req.files.map(f => f.filename);
    res.json({ success: true, files });
  });
});

/**
 * POST /api/files/copy
 * Копирование файла
 */
router.post('/copy', (req, res) => {
  try {
    const { source, destination } = req.body;
    const projectPath = getProjectPath(req);
    const srcResult = resolveSafe(source, projectPath);
    if (srcResult.error) return res.status(403).json({ success: false, error: srcResult.error });
    const destResult = resolveSafe(destination, projectPath);
    if (destResult.error) return res.status(403).json({ success: false, error: destResult.error });

    if (!fs.existsSync(srcResult.fullPath)) {
      return res.json({ success: false, error: 'Исходный файл не найден' });
    }

    fs.copyFileSync(srcResult.fullPath, destResult.fullPath);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

/**
 * GET /api/files/serve/*
 * Отдача файлов из проекта (для TinyMCE и предпросмотра)
 * URL: /api/files/serve/image.png?project=/path/to/project
 */
router.get('/serve/*', (req, res) => {
  try {
    const filePath = req.params[0];
    const projectPath = getProjectPath(req);

    if (!projectPath) {
      return res.status(400).send('Missing project parameter');
    }

    if (!filePath) {
      return res.status(400).send('Missing file path');
    }

    // Sandbox: проверяем через resolveSafe
    const result = resolveSafe(filePath, projectPath);
    if (result.error) {
      return res.status(403).send('Access denied');
    }

    if (!fs.existsSync(result.fullPath)) {
      return res.status(404).send('File not found: ' + filePath);
    }

    // Определяем MIME тип
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'video/ogg',
      '.htm': 'text/html',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript'
    };

    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }

    res.sendFile(result.fullPath);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

/**
 * POST /api/files/browse
 * Обзор директории (для выбора папки)
 */
router.post('/browse', (req, res) => {
  try {
    const { path: dirPath } = req.body;

    // Определяем начальный путь
    let targetPath = dirPath;
    if (!targetPath) {
      // Начинаем с домашней директории или корня
      targetPath = process.platform === 'win32' ? 'C:\\' : process.env.HOME || '/';
    }

    // Нормализуем путь
    targetPath = path.resolve(targetPath);

    if (!fs.existsSync(targetPath)) {
      return res.json({ success: false, error: 'Путь не существует' });
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      targetPath = path.dirname(targetPath);
    }

    const entries = [];

    // Добавляем возможность перейти на уровень вверх
    const parentPath = path.dirname(targetPath);
    if (parentPath !== targetPath) {
      entries.push({
        name: '..',
        path: parentPath,
        isDirectory: true,
        isParent: true
      });
    }

    // Читаем содержимое директории
    const items = fs.readdirSync(targetPath, { withFileTypes: true });

    for (const item of items) {
      // Пропускаем скрытые файлы и системные папки
      if (item.name.startsWith('.') || item.name === 'node_modules' ||
          item.name === '$RECYCLE.BIN' || item.name === 'System Volume Information') {
        continue;
      }

      if (item.isDirectory()) {
        entries.push({
          name: item.name,
          path: path.join(targetPath, item.name),
          isDirectory: true
        });
      }
    }

    // Сортируем: папки по алфавиту
    entries.sort((a, b) => {
      if (a.isParent) return -1;
      if (b.isParent) return 1;
      return a.name.localeCompare(b.name);
    });

    // Проверяем наличие hmcontent.htm (признак проекта справки)
    const hasProject = fs.existsSync(path.join(targetPath, 'hmcontent.htm'));

    res.json({
      success: true,
      currentPath: targetPath,
      entries,
      hasProject,
      // Для Windows: список дисков
      drives: process.platform === 'win32' ? getWindowsDrives() : null
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

/**
 * Получить список дисков Windows
 */
function getWindowsDrives() {
  if (process.platform !== 'win32') return null;

  const drives = [];
  // Проверяем диски от A до Z
  for (let i = 65; i <= 90; i++) {
    const drive = String.fromCharCode(i) + ':\\';
    try {
      if (fs.existsSync(drive)) {
        drives.push(drive);
      }
    } catch (e) {
      // Диск недоступен
    }
  }
  return drives;
}

module.exports = router;
