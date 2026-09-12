# `test/` — тесты (vitest)

- `rules.test.ts` — 23 теста на все правила через фабрику «идеального» документа.
- `docx.e2e.test.ts` — 6 сквозных тестов парсера на реальных `.docx` из `public/samples/`.
- `xml.test.ts`, `units.test.ts`, `text.test.ts` — unit-тесты парсинга XML, конверсии единиц, текста.

Запуск: `npm test`, watch-режим: `npm run test:watch`.
