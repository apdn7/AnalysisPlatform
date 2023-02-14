@echo off

set log_folder=log
set app_location=%~dp0
set log_location=%app_location%%log_folder%
forfiles /p %log_location%

@REM remove old log file > 30 days
forfiles /p %log_location% /S /M *.zip /D -30 /C "cmd /c del /q @file"

@REM find and remove empty folder
for /f "delims=" %%d in ('dir %log_folder% /s /b /ad ^| sort /r') do rd "%%d"

exit