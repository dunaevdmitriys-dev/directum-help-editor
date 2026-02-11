/**
 * Help Editor - Authentication Middleware
 *
 * Простая авторизация по паролю с сессиями.
 * Защищает /api/* маршруты от неавторизованного доступа.
 */

const crypto = require('crypto');
const config = require('../config');

// Хранилище сессий (in-memory)
const sessions = new Map();

/**
 * Генерирует токен сессии
 * @returns {string}
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Очистка просроченных сессий
 */
function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now > session.expiresAt) {
      sessions.delete(token);
    }
  }
}

// Периодическая очистка каждые 10 минут
setInterval(cleanupSessions, 10 * 60 * 1000);

/**
 * Middleware: требует авторизацию для доступа к API
 * Если пароль не задан в конфиге — пропускает (dev-режим)
 */
function authRequired(req, res, next) {
  // Если пароль не задан — dev-режим, пропускаем
  if (!config.editorPassword) {
    return next();
  }

  // Проверяем токен из cookie или заголовка
  const token = req.cookies?.helpEditorToken || req.headers['x-auth-token'];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Требуется авторизация' });
  }

  const session = sessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    sessions.delete(token);
    return res.status(401).json({ success: false, error: 'Сессия истекла' });
  }

  // Продлеваем сессию при активности
  session.expiresAt = Date.now() + config.sessionMaxAge;
  next();
}

/**
 * Обработчик логина
 * POST /api/auth/login { password: "..." }
 */
function login(req, res) {
  const { password } = req.body;

  if (!config.editorPassword) {
    return res.json({ success: true, message: 'Авторизация не требуется (dev-режим)' });
  }

  if (!password || password !== config.editorPassword) {
    return res.status(403).json({ success: false, error: 'Неверный пароль' });
  }

  const token = generateToken();
  sessions.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + config.sessionMaxAge
  });

  // Устанавливаем cookie
  res.cookie('helpEditorToken', token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: config.sessionMaxAge
  });

  res.json({ success: true, token });
}

/**
 * Обработчик выхода
 * POST /api/auth/logout
 */
function logout(req, res) {
  const token = req.cookies?.helpEditorToken || req.headers['x-auth-token'];
  if (token) {
    sessions.delete(token);
  }
  res.clearCookie('helpEditorToken');
  res.json({ success: true });
}

/**
 * Проверка статуса авторизации
 * GET /api/auth/check
 */
function checkAuth(req, res) {
  if (!config.editorPassword) {
    return res.json({ authenticated: true, required: false });
  }

  const token = req.cookies?.helpEditorToken || req.headers['x-auth-token'];
  if (!token) {
    return res.json({ authenticated: false, required: true });
  }

  const session = sessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    sessions.delete(token);
    return res.json({ authenticated: false, required: true });
  }

  res.json({ authenticated: true, required: true });
}

module.exports = { authRequired, login, logout, checkAuth };
