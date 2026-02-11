/**
 * Скрипт для скачивания TinyMCE с jsDelivr (без API-ключа)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const TINYMCE_VERSION = '6.8.2';
const BASE_URL = `https://cdn.jsdelivr.net/npm/tinymce@${TINYMCE_VERSION}`;
const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'tinymce');

// Необходимые файлы TinyMCE
const FILES_TO_DOWNLOAD = [
  'tinymce.min.js',
  'themes/silver/theme.min.js',
  'icons/default/icons.min.js',
  'skins/ui/oxide/skin.min.css',
  'skins/ui/oxide/content.min.css',
  'skins/content/default/content.min.css',
  'models/dom/model.min.js',
  // Плагины
  'plugins/lists/plugin.min.js',
  'plugins/link/plugin.min.js',
  'plugins/image/plugin.min.js',
  'plugins/table/plugin.min.js',
  'plugins/code/plugin.min.js',
  'plugins/preview/plugin.min.js',
  'plugins/searchreplace/plugin.min.js',
  'plugins/visualblocks/plugin.min.js',
  'plugins/fullscreen/plugin.min.js',
  'plugins/insertdatetime/plugin.min.js',
  'plugins/media/plugin.min.js',
  'plugins/help/plugin.min.js',
  'plugins/wordcount/plugin.min.js',
  'plugins/anchor/plugin.min.js',
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(dest);

    const request = (url) => {
      https.get(url, (response) => {
        // Следуем редиректам
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
          request(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          fs.unlink(dest, () => {});
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };

    request(url);
  });
}

async function main() {
  console.log('Скачивание TinyMCE с jsDelivr...\n');

  // Проверяем, не скачан ли уже
  const mainFile = path.join(ASSETS_DIR, 'tinymce.min.js');
  if (fs.existsSync(mainFile)) {
    const stats = fs.statSync(mainFile);
    if (stats.size > 100000) { // Файл больше 100KB - скорее всего валидный
      console.log('TinyMCE уже установлен.');
      return;
    }
  }

  // Создаём папку
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  let downloaded = 0;
  let failed = 0;

  for (const filePath of FILES_TO_DOWNLOAD) {
    const url = `${BASE_URL}/${filePath}`;
    const dest = path.join(ASSETS_DIR, filePath);
    process.stdout.write(`Скачивание ${filePath}... `);

    try {
      await downloadFile(url, dest);
      console.log('OK');
      downloaded++;
    } catch (error) {
      console.log(`ОШИБКА: ${error.message}`);
      failed++;
    }
  }

  console.log(`\nГотово! Скачано: ${downloaded}, ошибок: ${failed}`);

  if (failed > 0) {
    console.log('\nНекоторые файлы не удалось скачать.');
    console.log('TinyMCE будет загружен с CDN при запуске приложения.');
  }
}

main().catch(console.error);
