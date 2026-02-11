# Help Editor - Архитектура

## Обзор

Help Editor — кроссплатформенное приложение для редактирования справочной документации в формате WebHelp.

**Главная задача:** полностью отказаться от Help and Manual (устарел, поиск работает плохо). Редактирование, сборка и просмотр справки — только в Help Editor.

**Три папки проекта:**
- **Для разработки** — исходники Help Editor; здесь делаются все изменения. Есть старые/неиспользуемые файлы.
- **Для пользователей** — что передаётся пользователям: редактор, сборка, то, чем пользуются конечные пользователи справки.
- **Папка самой справки** — полное содержимое: разделы, файлы, служебные файлы (в т.ч. сгенерированные ранее из H&M).

**Приоритет пользователей:** (1) конечные пользователи справки, (2) редакторы справки.

**Два режима работы:**
- **Web-версия** — Node.js + Express (основной)
- **Electron-версия** — десктопное приложение (legacy)

## Структура проекта

```
/help-editor/
├── cli.js                  # Точка входа веб-версии
├── main.js                 # Electron main process (legacy)
├── preload.js              # Electron bridge (legacy)
├── package.json
├── README.md               # Документация проекта
├── CHANGELOG.md            # История изменений
├── TESTING.md              # Инструкция для тестировщика
├── /server/                # Express сервер
│   ├── index.js            # Сервер на порту 3000
│   ├── config.js           # Конфигурация (порт, пути)
│   ├── /middleware/
│   │   ├── auth.js         # Cookie-авторизация
│   │   └── sandbox.js      # Защита от path traversal
│   └── /routes/
│       ├── files.js        # CRUD файлов + serve медиа
│       └── project.js      # Проект, шаблоны, сборка, публикация
├── /src/
│   ├── index.html          # Главный HTML с UI
│   ├── /styles/
│   │   └── main.css        # Стили приложения
│   └── /js/
│       ├── ARCHITECTURE.md # Этот файл
│       ├── /core/          # Ядро приложения
│       │   ├── state.js    # Глобальное состояние (AppState)
│       │   └── events.js   # Event Bus
│       ├── /services/
│       │   └── file-service.js  # REST API абстракция
│       └── /modules/       # Функциональные модули
│           ├── app.js      # Главный модуль
│           ├── toc-parser.js
│           ├── tree-view.js
│           ├── editor.js
│           ├── search.js
│           ├── dialogs.js  # Модальные окна + публикация
│           ├── generators.js
│           └── ...
└── /assets/
    ├── /tinymce/           # TinyMCE (скачивается автоматически)
    ├── /help-template/     # Рабочая копия современного шаблона
    │   ├── default.css     # CSS дизайн-система (variables, типографика)
    │   ├── index.html      # Оболочка справки (header + sidebar + iframe)
    │   ├── hmcontent.htm   # Шаблон дерева разделов
    │   ├── hmftsearch.htm  # Страница поиска
    │   ├── search-client.js # Клиентский MiniSearch
    │   ├── page.htm        # Шаблон новой страницы
    │   ├── custom.css      # Кастомные стили
    │   ├── scrollbars.css  # Стили скроллбаров
    │   └── ...
    └── /templates/         # Реестр шаблонов
        ├── /modern/        # Современный (Directum RX)
        │   ├── template.json
        │   └── ... (копия help-template/)
        └── /legacy/        # Legacy (Help & Manual)
            ├── template.json
            └── helpeditor_init.js
```

## Архитектура (Web-версия)

```
┌─────────────────────────────────────────┐
│           Браузер (UI)                  │
│  index.html + модули JS                 │
│  FileService → REST вызовы              │
└────────────────┬────────────────────────┘
                 │ HTTP localhost:3000
┌────────────────▼────────────────────────┐
│         Express сервер                  │
│  /api/files/* — CRUD + serve            │
│  /api/project/* — создание/сборка       │
│  Статика: /src/, /assets/               │
└─────────────────────────────────────────┘
```

## Ключевые компоненты

### Services

#### file-service.js — Абстракция API
```javascript
// FileService — единый интерфейс для Web и Electron
FileService.readFile(path)      // REST POST /api/files/read
FileService.writeFile(path, content)
FileService.listFiles(dir, ext)
FileService.deleteFile(path)
// ... и остальные методы window.api

// WebDialogs — HTML диалоги для веб-версии
WebDialogs.showFolderDialog(label, callback)
WebDialogs.showConfirm(message, title)
WebDialogs.showFileUpload(options)

// PathUtils — утилиты для путей
PathUtils.isElectron()          // true в Electron, false в Web
PathUtils.toAbsoluteUrl(rel, project)
PathUtils.toRelativePath(abs, project)
```

### REST API (Express)

| Метод | URL | Описание |
|-------|-----|----------|
| POST | /api/files/read | Чтение файла |
| POST | /api/files/write | Запись файла |
| POST | /api/files/list | Список файлов |
| POST | /api/files/list-recursive | Рекурсивный список |
| POST | /api/files/delete | Удаление |
| POST | /api/files/upload | Загрузка (multipart) |
| GET | /api/files/serve/* | Отдача медиа (img, video) |
| POST | /api/project/create | Создание проекта |
| POST | /api/project/open | Открытие проекта |
| POST | /api/project/validate | Валидация папки |
| POST | /api/project/build | Сборка проекта |
| POST | /api/project/publish | Публикация в целевую папку |
| GET | /api/project/templates | Список шаблонов (modern/legacy) |
| POST | /api/project/config | Чтение конфига .helpeditor.json |
| POST | /api/project/config/update | Обновление конфига |

### Core

#### state.js — Глобальное состояние
```javascript
const AppState = {
  projectPath: null,
  tocData: null,
  originalHmContent: null,
  selectedNode: null,
  currentContent: '',
  hasUnsavedChanges: false,
  modifiedFiles: Set,
  currentView: 'editor',
  editor: null,
  orphanPages: [],
  unusedImages: [],
  searchMode: 'title',
  searchQuery: '',
  searchResults: []
};
```

#### events.js — Event Bus
```javascript
EventBus.on('project:opened', callback)
EventBus.emit('section:selected', nodeId)
```

### Modules (основные)

- **toc-parser.js** — парсинг hmcontent.htm
- **tree-view.js** — дерево разделов
- **editor.js** — TinyMCE интеграция
- **search.js** — полнотекстовый поиск
- **dialogs.js** — модальные окна
- **generators.js** — генерация файлов сборки
- **orphan-detector.js** — поиск неиспользуемых файлов

## Порядок загрузки

1. file-service.js (window.api = FileService если нет Electron)
2. state.js
3. events.js
4. toc-parser.js → ... → app.js

## Запуск

```bash
# Web-версия (основная)
npm start           # localhost:3000

# Electron-версия
npm run start:electron
```

## Совместимость

- **Формат WebHelp**: hmcontent.htm, .htm-страницы (исторически от Help & Manual; зависимость от H&M убираем).
- **Directum RX**: helpCodes.xml/js для F1
- **Node.js**: 16+
- **TinyMCE**: 6.x
