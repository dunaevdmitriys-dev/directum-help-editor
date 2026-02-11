# Help Editor

Редактор справочной документации WebHelp для Directum RX.

## Возможности

- **WYSIWYG-редактор** — TinyMCE 6 с поддержкой таблиц, изображений, видео, кода
- **Дерево разделов** — создание, переименование, перемещение, удаление разделов
- **Полнотекстовый поиск** — инвертированный индекс с русским стеммингом (MiniSearch)
- **Генерация служебных файлов** — helpCodes.xml/js, toc.js, hmcontent.htm, search_index.js
- **Система шаблонов** — выбор между современным и legacy (Help & Manual) шаблоном
- **Публикация** — копирование собранного проекта в целевую папку (IIS/Directum RX)
- **Два режима работы** — Electron (десктоп) и Web (Express-сервер в браузере)
- **Интеграция с Directum RX** — helpCodes для вызова справки по F1

## Быстрый старт (Windows)

### 1. Установить Node.js

Скачайте **LTS-версию** с [nodejs.org](https://nodejs.org/) → запустите установщик → Next → Next → Finish.

### 2. Запустить Help Editor

Дважды кликните файл **`start.bat`** в папке `help-editor`.

Всё. При первом запуске автоматически установятся зависимости (1-2 минуты, нужен интернет). Браузер откроется сам.

> Для остановки — закройте окно консоли или нажмите `Ctrl+C`.

### Альтернативный запуск (командная строка)

```bash
cd help-editor
npm install
npm start
```

Другой порт:
```bash
node cli.js --port 8080
```

### Запуск (Electron)

```bash
npm run start:electron
```

## Структура проекта

```
help-editor/
├── cli.js                  # CLI точка входа (веб-режим)
├── main.js                 # Electron main process
├── preload.js              # Electron preload
├── package.json
│
├── server/                 # Express backend
│   ├── index.js            # Инициализация сервера
│   ├── config.js           # Конфигурация (порт, пути)
│   ├── middleware/
│   │   ├── auth.js         # Авторизация (cookie-based)
│   │   └── sandbox.js      # Защита от path traversal
│   └── routes/
│       ├── files.js        # CRUD для файлов/разделов
│       └── project.js      # Проект, шаблоны, сборка, публикация
│
├── src/                    # Frontend SPA
│   ├── index.html          # Главная страница редактора
│   ├── styles/
│   │   └── main.css        # Стили редактора
│   └── js/
│       ├── core/           # EventBus, AppState
│       ├── modules/        # TreeView, Editor, Search, Dialogs и др.
│       └── services/       # FileService (API-клиент)
│
├── assets/
│   ├── help-template/      # Файлы современного шаблона (рабочая копия)
│   ├── templates/          # Реестр шаблонов
│   │   ├── modern/         # Современный шаблон + template.json
│   │   └── legacy/         # Legacy (H&M) шаблон + template.json
│   ├── icons/              # Иконки приложения
│   └── tinymce/            # TinyMCE (скачивается автоматически)
│
└── scripts/
    └── download-tinymce.js # Скрипт загрузки TinyMCE
```

## Рабочий процесс

### 1. Создание / открытие проекта

- **Создать новый проект** — выбирается папка и шаблон (Современный / Legacy)
- **Открыть существующий** — указывается папка с `.htm` файлами

При создании проекта сохраняется файл `.helpeditor.json` с настройками.

### 2. Редактирование

- Навигация по разделам через дерево слева
- Редактирование содержимого в WYSIWYG-редакторе
- Автосохранение при переключении разделов

### 3. Сборка

Кнопка **Сборка** генерирует служебные файлы:

| Файл | Назначение |
|------|-----------|
| `helpCodes.xml` | Коды разделов для Directum RX (F1) |
| `helpCodes.js` | JavaScript-версия кодов |
| `toc.js` | Оглавление для шаблона |
| `hmcontent.htm` | HTML-дерево разделов |
| `search_index.js` | Поисковый индекс |

Также копируются файлы выбранного шаблона (оболочка, CSS, поиск).

### 4. Публикация

Кнопка **Публикация** копирует собранный проект в целевую папку, откуда справка доступна пользователям системы.

## Шаблоны

### Современный (`modern`)

- Оболочка `index.html` — top header с логотипом и поиском, боковая панель с деревом
- Стили `default.css` — CSS variables, Directum RX палитра, адаптивный дизайн
- Поиск `hmftsearch.htm` + `search-client.js` — клиентский MiniSearch
- Мобильная версия — гамбургер-меню, slide-in sidebar
- Клавиатура — `Ctrl+K` для быстрого поиска

### Legacy (Help & Manual)

- Оболочка, стили и поиск остаются от Help & Manual
- Инжектируется только `helpeditor_init.js` для совместимости
- Подходит для проектов, где нельзя менять внешний вид

## Конфигурация проекта (.helpeditor.json)

```json
{
  "template": "modern",
  "outputFolder": "./output",
  "publishPath": "\\\\server\\share\\help\\ru-RU"
}
```

| Поле | Описание |
|------|----------|
| `template` | Выбранный шаблон: `modern` или `legacy` |
| `outputFolder` | Папка сборки (по умолчанию `./output`) |
| `publishPath` | Целевая папка публикации |

## Безопасность

- **Авторизация** — задайте переменную `HELP_EDITOR_PASSWORD` для production
- **Path traversal** — middleware `sandbox.js` блокирует выход за пределы проекта
- **CORS** — настроен для локальной работы

## API

### Проект

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/project/open` | Открыть проект |
| POST | `/api/project/create` | Создать проект |
| POST | `/api/project/build` | Собрать проект |
| POST | `/api/project/publish` | Опубликовать |
| GET | `/api/project/templates` | Список шаблонов |
| POST | `/api/project/config` | Получить конфиг |
| POST | `/api/project/config/update` | Обновить конфиг |

### Файлы

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/files/list` | Список файлов |
| GET | `/api/files/read` | Чтение файла |
| POST | `/api/files/save` | Сохранение файла |
| POST | `/api/files/create` | Создание раздела |
| POST | `/api/files/rename` | Переименование |
| POST | `/api/files/delete` | Удаление |
| POST | `/api/files/upload` | Загрузка изображений |

## Сборка Electron

```bash
npm run build:win    # Windows portable
npm run build:mac    # macOS dmg
```

## Лицензия

MIT
