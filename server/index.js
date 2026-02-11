/**
 * Help Editor - Express Server
 *
 * Веб-сервер для Help Editor.
 * Заменяет Electron main process для кроссплатформенной работы.
 *
 * Две зоны:
 * - /help/* — публичная раздача собранной справки (без авторизации)
 * - /api/*  — редактор (защищён паролем, если задан HELP_EDITOR_PASSWORD)
 */

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const config = require('./config');

// Routes
const filesRouter = require('./routes/files');
const projectRouter = require('./routes/project');
const { authRequired, login, logout, checkAuth } = require('./middleware/auth');

const app = express();
const PORT = config.port;

// Middleware
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==================== Публичная зона ====================

// Раздача собранной справки (доступно всем без авторизации)
if (config.outputPath) {
  app.use('/help', express.static(config.outputPath));
  console.log(`Справка доступна по /help/ из ${config.outputPath}`);
}

// ==================== Авторизация ====================

// Auth endpoints (не требуют авторизации)
app.post('/api/auth/login', login);
app.post('/api/auth/logout', logout);
app.get('/api/auth/check', checkAuth);

// Все остальные /api/* требуют авторизации
app.use('/api', authRequired);

// ==================== Защищённая зона (редактор) ====================

// API routes
app.use('/api/files', filesRouter);
app.use('/api/project', projectRouter);

// Статические файлы (UI редактора)
app.use(express.static(path.join(__dirname, '../src')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// Fallback на index.html для SPA
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../src/index.html'));
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: err.message });
});

// Запуск сервера
function start(port = PORT) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`\n🚀 Help Editor запущен: http://localhost:${port}`);
      if (config.editorPassword) {
        console.log('🔒 Авторизация включена (HELP_EDITOR_PASSWORD задан)');
      } else {
        console.log('⚠️  Авторизация отключена (dev-режим). Задайте HELP_EDITOR_PASSWORD для production.');
      }
      if (config.projectPath) {
        console.log(`📁 Проект: ${config.projectPath}`);
      }
      if (config.outputPath) {
        console.log(`📖 Справка: http://localhost:${port}/help/`);
      }
      console.log('');
      resolve(server);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Порт ${port} занят, пробуем ${port + 1}...`);
        start(port + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

module.exports = { app, start };

// Запуск если вызван напрямую
if (require.main === module) {
  start();
}
