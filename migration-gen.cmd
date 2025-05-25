@echo off
npx typeorm-ts-node-commonjs migration:generate src/infrastructure/database/migrations/%1 -d src/infrastructure/database/data-source.ts
