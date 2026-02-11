/**
 * Help Editor - Path Sandbox Middleware
 *
 * Защита от path traversal.
 * Все файловые пути проверяются на принадлежность к папке проекта.
 */

const path = require('path');

/**
 * Проверяет, что путь находится внутри разрешённой директории
 * @param {string} filePath - Проверяемый путь
 * @param {string} allowedDir - Разрешённая директория
 * @returns {boolean}
 */
function isPathInside(filePath, allowedDir) {
  if (!filePath || !allowedDir) return false;
  const resolved = path.resolve(filePath);
  const allowed = path.resolve(allowedDir);
  return resolved === allowed || resolved.startsWith(allowed + path.sep);
}

/**
 * Строит полный путь и проверяет sandbox
 * @param {string} filePath - Относительный или абсолютный путь файла
 * @param {string} projectPath - Путь к проекту (sandbox root)
 * @returns {{fullPath: string}|{error: string}} Полный путь или ошибка
 */
function resolveSafe(filePath, projectPath) {
  if (!projectPath) {
    return { error: 'Проект не открыт' };
  }

  let fullPath;
  if (!filePath) {
    fullPath = projectPath;
  } else if (path.isAbsolute(filePath)) {
    fullPath = filePath;
  } else {
    fullPath = path.join(projectPath, filePath);
  }

  fullPath = path.resolve(fullPath);

  if (!isPathInside(fullPath, projectPath)) {
    return { error: 'Доступ запрещён: путь выходит за пределы проекта' };
  }

  return { fullPath };
}

module.exports = { isPathInside, resolveSafe };
