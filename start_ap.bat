@echo off
: _____________________________________________________________________________
:
:  Analysis Platform Launcher
: _____________________________________________________________________________
:  Important notice:
:    Running the batch file is regarded as you agreed to the Terms of Use.
:  Terms of Use:
:    https://github.com/apdn7/AnalysisPlatform/about/terms_of_use_en.md
: _____________________________________________________________________________

echo ________________________________________________________________
echo:
echo  Analysis Platform + DN7
echo ________________________________________________________________
echo:

: get user settings
echo Read User Settings
for /f "tokens=1,* delims== eol=;" %%a in (startup.ini) do (
  rem if "%%b" == "" (echo Section: %%a) else set "%%a=%%b"
  if not "%%b" == "" set "%%a=%%b"
)
if %prxs% == http set prxs=%prxy%
echo:

if %only_install% == 1 (
  mode con: cols=120 lines=60
  powershell -ExecutionPolicy Bypass -Command "&{$h=Get-Host;$w=$h.UI.RawUI;$s=$w.BufferSize;$s.height=5000;$w.BufferSize=$s;}"
)
if %startup_mode% == 0 (
  mode con: cols=120 lines=60
  powershell -ExecutionPolicy Bypass -Command "&{$h=Get-Host;$w=$h.UI.RawUI;$s=$w.BufferSize;$s.height=5000;$w.BufferSize=$s;}"
)

: Make path list and verify application files
:MAKE_PATH_LIST
:: Path list init
set path_file=path_list_ini.log
set original_path_file=_original_path_list.log
set path_diff_file=path_diff.log
set path_list_verifying=1

echo Path List Verifying
rem call :checkFileExist instance\app.sqlite3
call :checkFileExist startup.yaml
call :checkFileExist __STATUS__
if %path_list_verifying% equ 0 (
  echo   Failed to create path list because it is not in the initial state.
  echo   Skipped path list verifying!
) else (
  powershell -ExecutionPolicy Bypass -Command "Get-ChildItem -Recurse . -file | Resolve-Path -Relative | Where-Object { $_ -notmatch '__pycache__|.data$|.log$|cache|webassets-cache|.idea' } | Out-File -Encoding ASCII %path_file%"
  echo   Created path list Successfully.
  echo.
  powershell -ExecutionPolicy Bypass -Command "Compare-Object (Get-Content '%path_file%') (Get-Content '%original_path_file%') | Where-Object SideIndicator -eq '=>' | Out-File -Encoding ASCII .\%path_diff_file%"
  for /f %%a in ('powershell -ExecutionPolicy Bypass -Command "(Get-Content '%path_diff_file%').Count"') do (
    if %%a gtr 0 (
      echo   Some files are missing, please re-download the application and try again
      echo   Missing path count: %%a
      echo.
      pause
      exit /b 1
    )
  )
  echo Path list verified!
)
echo.

: get status install or run AP (should be link in AnalysisPlatform.bat)
set status_install=0
set status_run_app=1
set file_status=__STATUS__
set file_temp=__TEMP__
set file_ver=VERSION
if not exist %file_status% echo:> %file_status%
cd> %file_temp%
for %%a in (%file_ver%) do echo %%~ta>> %file_temp%
set last_status=%errorlevel%
fc %file_temp% %file_status% > nul
if errorlevel 1 (
  set status=%status_install%
  echo Install...
) else (
  set status=%status_run_app%
  echo Start up AP+DN7...
)
: reset errorlevel of initiating progress after compare status by fc
if %last_status% == 0 if errorlevel 1 (
    set errorlevel=0
)
echo:

if %status%==%status_run_app% if %startup_mode% ==9 set startup_mode=0
if %only_install% == 1 (
  set startup_mode=0
  set launch_chrome%=0
  set launch_edge%=0
)

: launch AP Batch
set subt=%subt: =_%
if %startup_mode% == 1 (
  start /min AnalysisPlatform.bat
) else if %startup_mode% == 9 (
  start /b AnalysisPlatform.bat ^> cmd.log ^2^>^&^1
) else (
  echo Launch Analysis Platform
  start /b AnalysisPlatform.bat
)

timeout 3

echo Launch Browser
: start with Chrome
if not %launch_chrome% == 0 start chrome.exe http://localhost:%port% --start-maximized
:: For PC without chrome
if errorlevel 1 start http://localhost:%port%
: start with Edge
if not %launch_edge% == 0 start microsoft-edge:http://localhost:%port%
:: For PC without Edge
if errorlevel 1 start http://localhost:%port%
echo.

echo Create Shortcut
: make shortcut on DeskTop
set shortcut_icon="ap\static\common\icons\AP+DN7.ico"
if not exist %shortcut_icon% set shortcut_icon="ap\static\common\icons\AP+DN7.ico"
rem echo %shortcut_icon%
: get desktop path in case of OneDrive
for /f "delims=" %%i in ('powershell -Command "[Environment]::GetFolderPath('Desktop')"') do set "desktopPath=%%i"
if %subt% == null (
  set fname="%desktopPath%\Analysis Platform AP+DN7 %port%|.url"
) else (
  set fname="%desktopPath%\Analysis Platform AP+DN7 %port%| [%subt%].url"
)

:: for web
set fpath=skip
if not %shortcut_web% == 0 set fpath=%fname:|=%
if %shortcut_web% == 1 if %status% == %status_run_app% if %only_install% == 0 set fpath=skip
if not %fpath% == skip if not exist %fpath% (
  echo [InternetShortcut]>%fpath%
  echo URL=http://localhost:%port%/>> %fpath%
)

:: for app
set fpath=skip
if not %shortcut_app% == 0 set fpath=%fname:|=%
if %shortcut_app% == 1 if %status% == %status_run_app% if %only_install% == 0 set fpath=skip
set fpath=%fpath:.url=.lnk%
if not %fpath% == skip if not exist %fpath% (
  powershell -ExecutionPolicy Bypass -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%fpath%');$s.TargetPath='%~f0';$s.WorkingDirectory='%~dp0';$s.IconLocation='%~dp0%shortcut_icon:"=%';$s.Save()"
)

::: for web by ip addr
for /f "tokens=4 delims= " %%i in ('route print ^| find " 0.0.0.0"') do set ip=%%i
echo   ip: %ip%
set fpath=skip
if not %shortcut_web_ip% == 0 set fpath=%fname:|=ip%
if %shortcut_web_ip% == 1 if %status% == %status_run_app% if %only_install% == 0 set fpath=skip
if not %fpath% == skip if not exist %fpath% (
  powershell -ExecutionPolicy Bypass -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%fpath%');$s.TargetPath='http://%ip%:%port%/';$s.Save()"
)
::: for web by pc name
for /f %%i in ('hostname') do set pc=%%i
echo   pc: %pc%
set fpath=skip
if not %shortcut_web_pc% == 0 set fpath=%fname:|=pc%
if %shortcut_web_pc% == 1 if %status% == %status_run_app% if %only_install% == 0 set fpath=skip
if not %fpath% == skip if not exist %fpath% (
  powershell -ExecutionPolicy Bypass -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%fpath%');$s.TargetPath='http://%pc%:%port%/';$s.Save()"
)

:Finish
timeout /t 30
exit

:checkFileExist
if exist %1 (
  echo     Detect %1
  set /a path_list_verifying=0
)
exit /b
:end