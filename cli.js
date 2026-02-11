#!/usr/bin/env node

/**
 * Help Editor CLI
 *
 * Запуск веб-сервера и автоматическое открытие браузера.
 *
 * Использование:
 *   npx help-editor
 *   npx help-editor --port 8080
 */

const { start } = require('./server');
const open = require('open');

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = portIndex !== -1 ? parseInt(args[portIndex + 1]) : 3000;

console.log('═══════════════════════════════════════════');
const pkg = require('./package.json');
console.log(`        Help Editor v${pkg.version} (Web)           `);
console.log('═══════════════════════════════════════════');

start(port).then((server) => {
  const address = server.address();
  const url = `http://localhost:${address.port}`;

  console.log(`Сервер: ${url}`);
  console.log('Нажмите Ctrl+C для остановки\n');

  // Открываем браузер
  open(url).catch(() => {
    console.log(`Откройте браузер: ${url}`);
  });
}).catch((err) => {
  console.error('Ошибка запуска:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nЗавершение работы...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});
