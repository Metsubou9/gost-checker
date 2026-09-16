# 📄 GOST Checker — Валидатор документов Word по ГОСТ 2.105-95

<p align="center">
  <b>Клиентский валидатор и анализатор оформления документов .docx прямо в браузере</b><br>
  Без отправки на сервер • 100% приватность • Интерактивная настройка правил • Экспорт отчёта
</p>

<p align="center">
  <a href="https://metsubou9.github.io/gost-checker/"><img src="https://img.shields.io/badge/Demo-Online%20App-2f6fed?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Online Demo"></a>
</p>

<p align="center">
  <a href="https://github.com/Metsubou9/gost-checker/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Metsubou9/gost-checker/ci.yml?branch=main&label=CI&logo=github" alt="CI"></a>
  <a href="https://github.com/Metsubou9/gost-checker/actions/workflows/deploy.yml"><img src="https://img.shields.io/github/actions/workflow/status/Metsubou9/gost-checker/deploy.yml?branch=main&label=Pages%20Deploy&logo=github" alt="Pages Deploy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-brightgreen.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React 18">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" alt="Vite 5">
  <img src="https://img.shields.io/badge/Tests-41%20passed-success" alt="Vitest">
</p>

---

Проверка оформления документов **Word (.docx)** на соответствие стандарту **ГОСТ 2.105-95** «ЕСКД. Общие требования к текстовым документам» — прямо в браузере, без загрузки файлов на сервер.

> 🌐 **Онлайн-версия:** [metsubou9.github.io/gost-checker](https://metsubou9.github.io/gost-checker/)

---

## 📸 Галерея скриншотов

| Стартовый экран | Отчёт о проверке | Настройки правил |
| :---: | :---: | :---: |
| ![Стартовый экран с dropzone](docs/screenshots/01-dropzone.png) | ![Отчёт с найденными нарушениями](docs/screenshots/02-report.png) | ![Настройки правил](docs/screenshots/03-settings.png) |
| *Перетащите .docx — парсинг и валидация на клиенте* | *Нарушения с фрагментом, пунктом ГОСТ и советом* | *Каждое правило можно настроить под методичку* |

---

## 📋 Что проверяется

| Группа | Правила | Пункт ГОСТ |
|---|---|---|
| **Страница** | Формат A4 (210×297 мм), поля (30/15/20/20 мм), номер страницы в колонтитуле | ГОСТ 2.301-68, п. 4.1.13 |
| **Шрифт** | Гарнитура (Times New Roman), кегль 14 пт | п. 3.3 |
| **Абзацы** | Полуторный интервал, отступ первой строки 15–17 мм, выравнивание по ширине, чёрный цвет | п. 3.6 |
| **Заголовки** | С прописной буквы, без точки в конце, без подчёркивания, без переносов; последовательная нумерация разделов/подразделов | п. 4.1.2–4.1.3, 4.1.9 |
| **Структура** | «Содержание» в больших документах, раздел с нового листа | п. 4.1.10–4.1.11 |
| **Таблицы** | Подпись «Таблица N — Название» над таблицей, последовательная нумерация | разд. 4.2 |
| **Рисунки** | Подпись «Рисунок N — Название» под рисунком по центру, последовательная нумерация | разд. 4.2 |
| **Литература** | Наличие списка, последовательная нумерация, элементы библиографического описания | п. 4.1.12, ГОСТ 7.32 |

*Все числовые параметры (шрифт, кегль, поля, отступы) **гибко настраиваются** в боковой панели под методические указания конкретного вуза или организации.*

---

## 🌟 Возможности

- 🔒 **100% Приватность**: файл разбирается полностью локально в браузере (JSZip + DOMParser), конфиденциальные данные никуда не передаются.
- ⚙️ **Гибкая настройка правил**: включение, отключение и редактирование пороговых значений каждого правила.
- 📄 **Наглядный отчёт**: точные цитаты из документа с ошибками, ссылки на пункты ГОСТ и конкретные рекомендации по исправлению.
- ⬇️ **Экспорт отчёта**: скачивание сводки найденных замечаний в формате Markdown.
- 🧩 **Модульная расширяемость**: возможность легко добавлять новые стандарты (профили) и форматы документов.

---

## 🚀 Быстрый старт

### Запуск в режиме разработки:

```bash
# 1. Установка зависимостей
npm install

# 2. Запуск локального dev-сервера (http://localhost:5173)
npm run dev

# 3. Запуск модульных и E2E тестов
npm test

# 4. Проверка типов и сборка production-версии
npm run build
```

---

## 🌐 Публикация на GitHub Pages

1. Репозиторий настроен на автоматический деплой через GitHub Actions (`.github/workflows/deploy.yml`).
2. В репозитории на GitHub: `Settings` → `Pages` → `Source: GitHub Actions`.
3. При каждом коммите в ветку `main` сайт автоматически собирается и публикуется на [metsubou9.github.io/gost-checker](https://metsubou9.github.io/gost-checker/).

---

## 🏗️ Архитектура

```
src/
  core/       модель документа (формат-независимая), единицы, текст
  parser/     xml.ts, styles.ts, headings.ts, docx.ts  ← .docx адаптер
  rules/      движок + по файлу на правило (22 правила)
  profiles/   gost-2-105-95.ts ← профиль = набор правил + дефолты
  ui/         React-интерфейс (dropzone, настройки, отчёт, экспорт)
```

### Добавление нового правила:

```ts
// src/rules/my-rule.ts
export const myRule: Rule = {
  id: "my-rule",
  title: "Моё правило",
  gostClause: "ГОСТ 2.105-95, п. …",
  severity: "warning",
  description: "…",
  defaultConfig: {},
  check: (doc, cfg) => [ /* Violation[] */ ],
};
```
Зарегистрируйте правило в `src/rules/index.ts` и включите в профиль.

---

## 🗺️ Планы развития (Roadmap)

- [ ] Адаптер для **.xlsx** — проверка оформления табличных данных
- [ ] Профиль **ГОСТ 7.32-2017** (отчёты о научно-исследовательских работах)
- [ ] Поддержка **.odt** (OpenDocument)
- [ ] Экспорт отчёта о проверке в **PDF**

---

## 📄 Лицензия

Проект распространяется под свободной лицензией **MIT** (см. [LICENSE](LICENSE)).
