@echo off

echo =================== format front-end files ===================
call npm run lint
call npm run format

echo:
echo =================== format python files ===================
ruff check --fix --unsafe-fixes
ruff format
