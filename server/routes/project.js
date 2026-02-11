/**
 * Help Editor - Project API Routes
 *
 * REST endpoints для операций с проектом.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { isPathInside } = require('../middleware/sandbox');

// Путь к шаблонам
const TEMPLATE_PATH = path.join(__dirname, '../../assets/help-template');
const TEMPLATES_DIR = path.join(__dirname, '../../assets/templates');
const DEFAULT_TEMPLATE = 'modern';

/**
 * Прочитать манифест шаблона
 */
function readTemplateManifest(templateId) {
  const manifestPath = path.join(TEMPLATES_DIR, templateId, 'template.json');
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
}

/**
 * Прочитать конфиг проекта (.helpeditor.json)
 */
function readProjectConfig(projectPath) {
  const configPath = path.join(projectPath, '.helpeditor.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    return {};
  }
}

/**
 * Записать конфиг проекта (.helpeditor.json)
 */
function writeProjectConfig(projectPath, cfg) {
  const configPath = path.join(projectPath, '.helpeditor.json');
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
}

/**
 * GET /api/project/templates
 * Список доступных шаблонов
 */
router.get('/templates', (req, res) => {
  try {
    const dirs = fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory());

    const templates = [];
    for (const dir of dirs) {
      const manifest = readTemplateManifest(dir.name);
      if (manifest) {
        templates.push({
          id: manifest.id,
          name: manifest.name,
          description: manifest.description
        });
      }
    }

    res.json({ success: true, templates });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

/**
 * GET /api/project/config
 * Прочитать конфиг текущего проекта
 */
router.post('/config', (req, res) => {
  try {
    const projectPath = config.projectPath || req.body.projectPath;
    if (!projectPath) return res.json({ success: false, error: 'Проект не открыт' });

    const cfg = readProjectConfig(projectPath);
    res.json({ success: true, config: cfg });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

/**
 * POST /api/project/config/update
 * Обновить конфиг проекта (например, сменить шаблон)
 */
router.post('/config/update', (req, res) => {
  try {
    const projectPath = config.projectPath || req.body.projectPath;
    if (!projectPath) return res.json({ success: false, error: 'Проект не открыт' });

    const { template, publishPath, outputFolder } = req.body;
    const cfg = readProjectConfig(projectPath);

    if (template) {
      const manifest = readTemplateManifest(template);
      if (!manifest) {
        return res.json({ success: false, error: `Шаблон "${template}" не найден` });
      }
      cfg.template = template;
    }

    if (typeof publishPath === 'string') {
      cfg.publishPath = publishPath;
    }

    if (typeof outputFolder === 'string') {
      cfg.outputFolder = outputFolder;
    }

    writeProjectConfig(projectPath, cfg);
    res.json({ success: true, config: cfg });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

/**
 * POST /api/project/check-folder
 * Проверка папки для нового проекта
 */
router.post('/check-folder', (req, res) => {
  try {
    const { path: folderPath } = req.body;

    if (!folderPath) {
      return res.json({ valid: false, error: 'Путь не указан' });
    }

    if (!fs.existsSync(folderPath)) {
      return res.json({ valid: true }); // Папка будет создана
    }

    const tocPath = path.join(folderPath, 'hmcontent.htm');
    if (fs.existsSync(tocPath)) {
      return res.json({ valid: false, error: 'В этой папке уже существует проект справки' });
    }

    res.json({ valid: true });
  } catch (error) {
    res.json({ valid: false, error: error.message });
  }
});

/**
 * POST /api/project/create
 * Создание нового проекта
 */
router.post('/create', (req, res) => {
  try {
    const { title, version, folderPath, firstSectionTitle, template: templateId } = req.body;

    if (!folderPath) {
      return res.json({ success: false, error: 'Не указана папка проекта' });
    }

    if (!title) {
      return res.json({ success: false, error: 'Не указано название справки' });
    }

    // Создаём папку если не существует
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Проверяем что папка пуста или не содержит hmcontent.htm
    const tocPath = path.join(folderPath, 'hmcontent.htm');
    if (fs.existsSync(tocPath)) {
      return res.json({ success: false, error: 'В этой папке уже существует проект справки' });
    }

    // Определяем шаблон
    const selectedTemplate = templateId || DEFAULT_TEMPLATE;
    const templateDir = path.join(TEMPLATES_DIR, selectedTemplate);
    const manifest = readTemplateManifest(selectedTemplate);

    // Копируем шаблонные файлы из выбранного шаблона
    const templateFiles = [
      'custom.css',
      ...(manifest ? [...manifest.styles, ...manifest.scripts] : [
        'default.css',
        'scrollbars.css',
        'helpman_settings.js',
        'helpman_topicinit.js',
        'helpeditor_init.js'
      ])
    ];

    for (const file of templateFiles) {
      // Сначала ищем в папке шаблона, потом в help-template (fallback)
      const srcInTemplate = path.join(templateDir, file);
      const srcFallback = path.join(TEMPLATE_PATH, file);
      const srcPath = fs.existsSync(srcInTemplate) ? srcInTemplate : srcFallback;
      const destPath = path.join(folderPath, file);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }

    // Сохраняем конфиг проекта
    writeProjectConfig(folderPath, { template: selectedTemplate });

    // Генерируем hmcontent.htm
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

    // Создаём helpCodes
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

    res.json({ success: true, path: folderPath });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

/**
 * POST /api/project/validate
 * Проверка валидности папки проекта (содержит hmcontent.htm)
 */
router.post('/validate', (req, res) => {
  try {
    const { path: folderPath } = req.body;

    if (!folderPath || !fs.existsSync(folderPath)) {
      return res.json({ valid: false, error: 'Папка не существует' });
    }

    const tocPath = path.join(folderPath, 'hmcontent.htm');
    if (!fs.existsSync(tocPath)) {
      return res.json({ valid: false, error: 'Не найден файл hmcontent.htm' });
    }

    res.json({ valid: true });
  } catch (error) {
    res.json({ valid: false, error: error.message });
  }
});

/**
 * POST /api/project/build
 * Сборка проекта
 */
router.post('/build', (req, res) => {
  try {
    const { outputFolder, generatedFiles } = req.body;
    const projectPath = config.projectPath || req.body.projectPath;

    if (!projectPath) {
      return res.json({ success: false, error: 'Проект не открыт' });
    }

    if (!outputFolder) {
      return res.json({ success: false, error: 'Не указана папка для сборки' });
    }

    // Sandbox: проверяем что сгенерированные файлы пишутся только в outputFolder
    // (outputFolder может быть за пределами проекта — это нормально для сборки)

    // Нормализуем пути для сравнения
    const normalizedProject = path.normalize(projectPath).toLowerCase();
    const normalizedOutput = path.normalize(outputFolder).toLowerCase();
    const isSameFolder = normalizedProject === normalizedOutput;

    // Создаём папку вывода если не существует
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    const skippedFiles = [];

    // Копируем файлы только если папки разные
    if (!isSameFolder) {
      const copyRecursive = (src, dest) => {
        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);

          // Пропускаем служебные файлы
          if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue;
          }

          if (entry.isDirectory()) {
            if (!fs.existsSync(destPath)) {
              fs.mkdirSync(destPath, { recursive: true });
            }
            copyRecursive(srcPath, destPath);
          } else {
            try {
              fs.copyFileSync(srcPath, destPath);
            } catch (e) {
              if (e.code === 'EPERM' || e.code === 'EBUSY') {
                skippedFiles.push(entry.name);
              } else {
                throw e;
              }
            }
          }
        }
      };

      copyRecursive(projectPath, outputFolder);
    }

    // Записываем сгенерированные файлы
    if (generatedFiles) {
      for (const [fileName, content] of Object.entries(generatedFiles)) {
        const filePath = path.join(outputFolder, fileName);
        try {
          fs.writeFileSync(filePath, content, 'utf-8');
        } catch (e) {
          if (e.code === 'EPERM' || e.code === 'EBUSY') {
            skippedFiles.push(fileName);
          } else {
            throw e;
          }
        }
      }
    }

    // Определяем шаблон проекта
    const projectCfg = readProjectConfig(projectPath);
    const templateId = projectCfg.template || DEFAULT_TEMPLATE;
    const manifest = readTemplateManifest(templateId);
    const templateDir = path.join(TEMPLATES_DIR, templateId);

    // Копируем файлы оболочки шаблона (shell)
    const shellFiles = manifest ? manifest.shell : ['scrollbars.css', 'index.html'];
    for (const fileName of shellFiles) {
      const srcInTemplate = path.join(templateDir, fileName);
      const srcFallback = path.join(TEMPLATE_PATH, fileName);
      const srcPath = fs.existsSync(srcInTemplate) ? srcInTemplate : srcFallback;
      const destPath = path.join(outputFolder, fileName);
      if (fs.existsSync(srcPath)) {
        try {
          fs.copyFileSync(srcPath, destPath);
        } catch (e) {
          if (e.code === 'EPERM' || e.code === 'EBUSY') {
            skippedFiles.push(fileName);
          }
        }
      }
    }

    // Копируем скрипты шаблона
    const scriptFiles = manifest ? manifest.scripts : ['helpeditor_init.js'];
    for (const fileName of scriptFiles) {
      const srcInTemplate = path.join(templateDir, fileName);
      const srcFallback = path.join(TEMPLATE_PATH, fileName);
      const srcPath = fs.existsSync(srcInTemplate) ? srcInTemplate : srcFallback;
      const destPath = path.join(outputFolder, fileName);
      if (fs.existsSync(srcPath)) {
        try {
          fs.copyFileSync(srcPath, destPath);
        } catch (e) {
          if (e.code === 'EPERM' || e.code === 'EBUSY') {
            skippedFiles.push(fileName);
          }
        }
      }
    }

    // Копируем файлы поиска (только для modern-шаблона)
    if (manifest && manifest.search && manifest.search.engine === 'minisearch') {
      const searchFiles = ['search-client.js', 'hmftsearch.htm'];
      for (const fileName of searchFiles) {
        const srcInTemplate = path.join(templateDir, fileName);
        const srcFallback = path.join(TEMPLATE_PATH, fileName);
        const srcPath = fs.existsSync(srcInTemplate) ? srcInTemplate : srcFallback;
        const destPath = path.join(outputFolder, fileName);
        if (fs.existsSync(srcPath)) {
          try {
            fs.copyFileSync(srcPath, destPath);
          } catch (e) {
            if (e.code === 'EPERM' || e.code === 'EBUSY') {
              skippedFiles.push(fileName);
            }
          }
        }
      }
    }

    // Инжектируем скрипт инициализации в контентные .htm файлы
    const initScript = manifest && manifest.search ? manifest.search.pageInitScript : 'helpeditor_init.js';
    if (initScript) {
      const scriptTag = `<script src="${initScript}"></script>`;
      const htmFiles = fs.readdirSync(outputFolder).filter(f => f.endsWith('.htm'));
      for (const htmFile of htmFiles) {
        if (htmFile === 'hmcontent.htm' || htmFile === 'hmftsearch.htm') continue;

        const htmPath = path.join(outputFolder, htmFile);
        try {
          let content = fs.readFileSync(htmPath, 'utf-8');
          if (content.includes(initScript)) continue;
          if (content.includes('</head>')) {
            content = content.replace('</head>', scriptTag + '\n</head>');
          } else if (content.includes('</body>')) {
            content = content.replace('</body>', scriptTag + '\n</body>');
          }
          fs.writeFileSync(htmPath, content, 'utf-8');
        } catch (e) {
          if (e.code === 'EPERM' || e.code === 'EBUSY') {
            skippedFiles.push(htmFile);
          }
        }
      }
    }

    const result = { success: true, path: outputFolder };

    if (skippedFiles.length > 0) {
      result.skippedFiles = skippedFiles;
    }

    res.json(result);
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

/**
 * POST /api/project/publish
 * Публикация: копирование собранных файлов в главную папку
 */
router.post('/publish', (req, res) => {
  try {
    const projectPath = config.projectPath || req.body.projectPath;
    if (!projectPath) {
      return res.json({ success: false, error: 'Проект не открыт' });
    }

    const projectCfg = readProjectConfig(projectPath);
    const sourceFolder = req.body.outputFolder || projectCfg.outputFolder || projectPath;
    const publishPath = req.body.publishPath || projectCfg.publishPath;

    if (!publishPath) {
      return res.json({ success: false, error: 'Не указана папка публикации. Укажите её в настройках проекта.' });
    }

    if (!fs.existsSync(sourceFolder)) {
      return res.json({ success: false, error: `Папка сборки не найдена: ${sourceFolder}. Сначала выполните сборку.` });
    }

    // Создаём папку публикации если нет
    if (!fs.existsSync(publishPath)) {
      fs.mkdirSync(publishPath, { recursive: true });
    }

    const skippedFiles = [];
    let copiedCount = 0;

    const copyRecursive = (src, dest) => {
      const entries = fs.readdirSync(src, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        // Пропускаем служебные файлы редактора
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        if (entry.isDirectory()) {
          if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
          }
          copyRecursive(srcPath, destPath);
        } else {
          try {
            fs.copyFileSync(srcPath, destPath);
            copiedCount++;
          } catch (e) {
            if (e.code === 'EPERM' || e.code === 'EBUSY') {
              skippedFiles.push(entry.name);
            } else {
              throw e;
            }
          }
        }
      }
    };

    copyRecursive(sourceFolder, publishPath);

    const result = {
      success: true,
      path: publishPath,
      copiedCount
    };

    if (skippedFiles.length > 0) {
      result.skippedFiles = skippedFiles;
    }

    res.json(result);
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

module.exports = router;
