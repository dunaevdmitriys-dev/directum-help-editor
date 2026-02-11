/**
 * Help Editor - Server Configuration
 *
 * Конфигурация сервера из переменных окружения.
 * Все пути и параметры безопасности задаются здесь.
 */

const path = require('path');

const config = {
  // Порт сервера
  port: parseInt(process.env.HELP_EDITOR_PORT, 10) || 3000,

  // Пароль для доступа к редактору (обязателен в production)
  editorPassword: process.env.HELP_EDITOR_PASSWORD || null,

  // Путь к проекту справки (папка с hmcontent.htm)
  projectPath: process.env.HELP_EDITOR_PROJECT_PATH || null,

  // Путь для публикации собранной справки
  outputPath: process.env.HELP_EDITOR_OUTPUT_PATH || null,

  // Секрет для подписи сессий/JWT
  sessionSecret: process.env.HELP_EDITOR_SESSION_SECRET || 'help-editor-dev-secret-change-me',

  // Время жизни сессии (24 часа по умолчанию)
  sessionMaxAge: parseInt(process.env.HELP_EDITOR_SESSION_MAX_AGE, 10) || 24 * 60 * 60 * 1000,
};

module.exports = config;
