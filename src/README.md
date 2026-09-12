# `src/` — исходники GOST Checker

- `core/` — формат-независимая модель документа (`model.ts`), единицы (`units.ts`), текст (`text.ts`).
- `parser/` — адаптер `.docx`: `docx.ts` (точка входа `parseDocx`), `styles.ts` (наследование стилей), `headings.ts` (эвристика заголовков), `xml.ts`.
- `rules/` — движок (`engine.ts`) + по файлу на правило: `page.ts`, `font.ts`, `paragraph-format.ts`, `structure.ts`, `tables-figures.ts`, `references.ts`. Реестр — `index.ts`.
- `profiles/` — наборы правил под конкретный ГОСТ. Сейчас: `gost-2-105-95.ts`.
- `ui/` — React: `App.tsx`, `Dropzone.tsx`, `ConfigPanel.tsx`, `Report.tsx`, экспорт в Markdown.

Как добавить правило / профиль / формат — см. раздел «Архитектура» в корневой `README.md`.
