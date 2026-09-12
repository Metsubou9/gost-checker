# Как помочь проекту

Спасибо за интерес к GOST Checker! Проект проверяет `.docx` на соответствие ГОСТ 2.105-95 прямо в браузере.

## Быстрый старт

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest, должно быть 41 passed
npm run build    # typecheck + production build
```

## Что можно сделать

- Новое правило в `src/rules/` (пример: `src/rules/font.ts`)
- Новый профиль ГОСТ в `src/profiles/` (пример: `src/profiles/gost-2-105-95.ts`)
- Новый формат-адаптер `parseXxx(): Promise<ParsedDocument>` по образцу `src/parser/docx.ts`
- Тесты в `test/` для каждого нового правила

Подробнее — раздел «Архитектура» в `README.md`.

## Правила коммитов

- Один коммит = одно изменение, сообщение на русском или в стиле `feat:`, `fix:`, `docs:`, `chore:`.
- Не коммитьте `node_modules/`, `dist/`, `*.log`, `.freebuff/` — они уже в `.gitignore`.
- Перед PR запустите `npm test` и `npm run typecheck`.

## Roadmap для первого вклада

- Адаптер `.xlsx`
- Профиль ГОСТ 7.32-2017
- Поддержка `.odt`
- Экспорт отчёта в PDF
