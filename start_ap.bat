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

: get user settings
echo Read User Settings
for /f "tokens=1,* delims== eol=;" %%a in (startup.ini) do (
  if "%%b" == "" (echo Section: %%a) else set "%%a=%%b"
)
if %prxs% == http set prxs=%prxy%
echo:

if %only_install% == 1 (
  mode con: cols=120 lines=60
  powershell -command "&{$h=Get-Host;$w=$h.UI.RawUI;$s=$w.BufferSize;$s.height=5000;$w.BufferSize=$s;}"
)
if %startup_mode% == 0 (
  mode con: cols=120 lines=60
  powershell -command "&{$h=Get-Host;$w=$h.UI.RawUI;$s=$w.BufferSize;$s.height=5000;$w.BufferSize=$s;}"
)

echo ________________________________________________________________
echo:
echo  Analysis Platform + DN7
echo ________________________________________________________________
echo:

: get status install or run AP (should be link in AnalysisPlatform.bat)
set status_install=0
set status_run_app=1
set file_status=__STATUS__
set file_temp=__TEMP__
set file_ver=VERSION
if not exist %file_status% echo:> %file_status%
cd> %file_temp%
for %%a in (%file_ver%) do echo %%~ta>> %file_temp%
fc %file_temp% %file_status% > nul
if errorlevel 1 (
  set status=%status_install%
  echo Install...
) else (
  set status=%status_run_app%
  echo StartUp...
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


echo Launch Browser
: start with Chrome
if not %launch_chrome% == 0 start chrome.exe http://localhost:%port% --start-maximized
:: For PC without chrome
if errorlevel 1 start http://localhost:%port%
: start with Edge
if not %launch_edge% == 0 start microsoft-edge:http://localhost:%port%


echo Create Shortcut
: make shortcut on DeskTop
set shortcut_icon="ap\static\common\icons\AP+DN7.ico"
if not exist %shortcut_icon% set shortcut_icon="histview2\static\common\icons\AP+DN7.ico"
rem echo %shortcut_icon%
if %subt% == null (
  set fname="%USERPROFILE%\Desktop\Analysis Platform AP+DN7 %port%|.url"
) else (
  set fname="%USERPROFILE%\Desktop\Analysis Platform AP+DN7 %port%| [%subt%].url"
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
  powershell "$s=(New-Object -COM WScript.Shell).CreateShortcut('%fpath%');$s.TargetPath='%~f0';$s.WorkingDirectory='%~dp0';$s.IconLocation='%~dp0%shortcut_icon:"=%';$s.Save()"
)

::: for web by ip addr
for /f "tokens=4 delims= " %%i in ('route print ^| find " 0.0.0.0"') do set ip=%%i
echo ip: %ip%
set fpath=skip
if not %shortcut_web_ip% == 0 set fpath=%fname:|=ip%
if %shortcut_web_ip% == 1 if %status% == %status_run_app% if %only_install% == 0 set fpath=skip
if not %fpath% == skip if not exist %fpath% (
  powershell "$s=(New-Object -COM WScript.Shell).CreateShortcut('%fpath%');$s.TargetPath='http://%ip%:%port%/';$s.Save()"
)
::: for web by pc name
for /f %%i in ('hostname') do set pc=%%i
echo pc: %pc%
set fpath=skip
if not %shortcut_web_pc% == 0 set fpath=%fname:|=pc%
if %shortcut_web_pc% == 1 if %status% == %status_run_app% if %only_install% == 0 set fpath=skip
if not %fpath% == skip if not exist %fpath% (
  powershell "$s=(New-Object -COM WScript.Shell).CreateShortcut('%fpath%');$s.TargetPath='http://%pc%:%port%/';$s.Save()"
)