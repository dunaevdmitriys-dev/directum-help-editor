// Topic initialization script — Directum RX style
document.addEventListener('DOMContentLoaded', function() {
  // Initialize syntax highlighting if available
  if (typeof hljs !== 'undefined') {
    hljs.highlightAll();
  }

  // Оборачиваем таблицы для горизонтального скролла
  document.querySelectorAll('table').forEach(function(table) {
    if (table.closest('#idheader') || table.closest('#idnav') || table.id === 'footer') return;
    if (table.parentElement.classList.contains('table-wrapper')) return;
    var wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });

  // SVG-иконки для замены PNG
  var svgIcons = {
    'icon_search.png': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    'icon_permalink.png': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    'icon_feedback.png': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
    'icon_toggles.png': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'
  };

  // Заменяем старую форму поиска H&M на рабочую
  var oldForm = document.getElementById('hmsearchform');
  if (oldForm) {
    var newForm = document.createElement('form');
    newForm.style.cssText = 'display:inline-block; vertical-align:middle;';
    newForm.innerHTML =
      '<div style="position:relative; display:inline-block;">' +
        '<input type="text" id="he-search-input" placeholder="Искать в справке..." autocomplete="off" ' +
          'style="width:200px; height:28px; padding:4px 32px 4px 10px; border:1px solid #bfbfbf; border-radius:4px; font-size:13px; font-family:inherit; box-sizing:border-box; transition:border-color 0.2s;">' +
        '<button type="submit" style="position:absolute; right:4px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; padding:2px; color:#5a6a7a; transition:color 0.2s;" title="Поиск">' +
          svgIcons['icon_search.png'] +
        '</button>' +
      '</div>';
    newForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var q = document.getElementById('he-search-input').value.trim();
      if (q) window.location.href = 'hmftsearch.htm?q=' + encodeURIComponent(q);
    });
    oldForm.parentNode.replaceChild(newForm, oldForm);

    // Стиль фокуса для нового поля
    var searchInput = document.getElementById('he-search-input');
    if (searchInput) {
      searchInput.addEventListener('focus', function() { this.style.borderColor = '#ff9900'; this.style.outline = 'none'; });
      searchInput.addEventListener('blur', function() { this.style.borderColor = '#bfbfbf'; });
    }
  }

  // Заменяем PNG-иконки на SVG в навигации шапки (кроме поиска — уже заменён)
  document.querySelectorAll('#idnav img').forEach(function(img) {
    var src = img.getAttribute('src');
    if (!svgIcons[src]) return;

    var span = document.createElement('span');
    span.innerHTML = svgIcons[src];
    span.className = 'hm-icon';
    span.title = img.title || img.alt || '';
    if (img.id) span.id = img.id;
    // Сохраняем оригинальные inline-стили размеров
    span.style.cssText = 'display:inline-block; width:20px; height:20px; vertical-align:middle;';
    img.parentNode.replaceChild(span, img);
  });

  // Инжектируем стили Directum RX — только цвета, без изменения layout
  var style = document.createElement('style');
  style.textContent = [
    // Цвета ссылок Directum RX
    '#idcontent a.topiclink { color: #0054a0; }',
    '#idcontent a.topiclink:hover { color: #ff9900; }',
    '#idcontent a.weblink { color: #0054a0; }',
    '#idcontent a.weblink:hover { color: #ff9900; }',

    // Заголовок h1
    '#idheader h1 { color: #13406d; }',
    '#idheader { border-bottom-color: #13406d !important; }',

    // Хлебные крошки
    '.crumbs a { color: #0054a0 !important; }',
    '.crumbs a:hover { color: #ff9900 !important; }',

    // SVG-иконки в шапке — только цвета
    '.hm-icon { color: #5a6a7a; transition: color 0.2s; }',
    '.hm-icon:hover, a:hover .hm-icon { color: #ff9900; }',

    // Zoom-картинки: лупа-оверлей поверх изображения
    'a.imagetogglelink { position: relative; display: inline-block; }',
    'svg.image-toggle-magnifier { position: absolute; bottom: 8px; right: 8px; width: 24px; height: 24px; opacity: 0.6; fill: #fff; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); pointer-events: none; transition: opacity 0.2s; }',
    'a.imagetogglelink:hover svg.image-toggle-magnifier { opacity: 1; }',

    // Footer
    'table#footer { border-color: #13406d; }',
  ].join('\n');
  document.head.appendChild(style);
});
