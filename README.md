# Словарь незнакомых слов

Личное PWA-приложение: сохраняйте незнакомые слова с переводом и группируйте по
источникам (книга, статья, видео). Работает на iPhone как обычное приложение,
без App Store и без Xcode.

- **Перевод** — бесплатный [MyMemory API](https://mymemory.translated.net/) (без ключа).
- **Хранение** — `localStorage` прямо в браузере телефона. Сервера и аккаунтов нет,
  данные никуда не уходят.
- **Зависимостей нет** — чистый HTML/CSS/JS, без сборки.

## Локальный запуск (для разработки)

Service worker требует http, поэтому открывать `index.html` напрямую (`file://`)
нельзя — нужен локальный сервер:

```bash
cd /путь/к/Dictionary
python3 -m http.server 8000
```

Откройте http://localhost:8000

## Публикация на GitHub Pages

1. Создайте репозиторий на GitHub и запушьте проект:
   ```bash
   git add -A
   git commit -m "Dictionary PWA"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
2. На GitHub: **Settings → Pages → Source** = ветка `main`, папка `/ (root)`.
3. Через минуту появится адрес вида `https://<user>.github.io/<repo>/`.

## Установка на iPhone

1. Откройте адрес GitHub Pages **в Safari** (именно Safari, не Chrome).
2. Кнопка «Поделиться» → **«На экран Домой»**.
3. Запускайте с иконки на домашнем экране — полноэкранный режим, работает офлайн,
   слова хранятся на телефоне.

## Резервная копия данных

Слова лежат в `localStorage` Safari. Если очистить данные сайта в настройках iOS,
они пропадут. Экспорт/импорт JSON пока не реализован (см. план развития).

## Лимит переводов

Анонимно MyMemory даёт ~5000 слов в день. Чтобы поднять до ~50000, впишите свой
email в константу `EMAIL` в `js/translate.js`.

## Структура

```
index.html              оболочка (одна страница)
css/styles.css          стили
js/storage.js           работа с localStorage
js/translate.js         запросы к MyMemory
js/app.js               UI и логика
manifest.webmanifest    манифест PWA
sw.js                   service worker (офлайн)
icons/                  иконки приложения
```
