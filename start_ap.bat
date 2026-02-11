@echo off
chcp 65001 >nul
: _____________________________________________________________________________
:
:  Analysis Platform Launcher
: _____________________________________________________________________________
:  Important notice:
:    Running the batch file is regarded as you agreed to the Terms of Use.
:  Terms of Use:
:    https://github.com/apdn7/AnalysisPlatform/about/terms_of_use_en.md
: _____________________________________________________________________________

:: Set powershell common option
set "pshell=powershell -NoLogo -NoProfile -ExecutionPolicy Bypass"
: set variables
set "file_stat=..\apdn7.ini"
set "file_vers=VERSION"
set "start_up_ini_file=startup.ini"
set "start_ap_file=AnalysisPlatform.bat"

title start_ap
mode con: cols=120 lines=60
%pshell% -Command ^
  $rw=$Host.UI.RawUI; ^
  $rw.BufferSize = New-Object System.Management.Automation.Host.Size(120,1000); ^
  $rw.WindowSize = New-Object System.Management.Automation.Host.Size(120,25)
echo ________________________________________________________________
echo.
echo  Analysis Platform + DN7
echo ________________________________________________________________
echo.

: get user settings
echo Read User Settings
for /f "tokens=1,* delims== eol=;" %%a in (%start_up_ini_file%) do (
  rem if "%%b"=="" (echo Section: %%a) else set "%%a=%%b"
  if not "%%b"=="" set "%%a=%%b"
)

: Read AN+DN7 User Settings: Version and Product (DN, OSS)
for /f "tokens=1,* delims=:" %%a in ('findstr /n /r "^" "%file_vers%"') do (
    if "%%a"=="1" set "ver_str=%%b"
    if "%%a"=="2" set "app_yml=%%b"
    if "%%a"=="3" set "app_prd=%%b"
)
for /f "tokens=1-3 delims=.v" %%a in ("%ver_str%") do set "app_ver=%%a%%b%%c"
set /a app_ver=%app_ver% >nul 2>&1 || set /a app_ver=9999
echo Version: %app_ver%  Group: %app_prd%
: get status install or run AP (should be link in AnalysisPlatform.bat)
set /a status_install=0
set /a status_run_app=1
if exist "%file_stat%" (
  for /f "tokens=1,* delims==" %%a in ('findstr /r /c:"^[^;].*=" "%file_stat%"') do (
    set "%%a=%%b"
  )  
)
%pshell% -Command if($env:install_vers -match '^\d{3,4}$'){} else {exit 1} || set /a install_vers=0
if %app_ver% gtr %install_vers% (
  set /a status=%status_install%
  echo Install...
) else (
  set /a status=%status_run_app%
  echo Start up AP+DN7...
)

if %status% equ %status_run_app% if %startup_mode% equ 9 set /a startup_mode=0
if %only_install% equ 1 (
  set /a startup_mode=0
  set /a launch_chrome=0
  set /a launch_edge%=0
)

: launch AP Batch
echo Launch Analysis Platform
if %startup_mode% equ 1 (
  start /min "%start_ap_file%" "%start_ap_file%"
) else if %startup_mode% equ 9 (
  start /b   "%start_ap_file%" "%start_ap_file%" ^> cmd.log ^2^>^&^1
) else (
  start /b   "%start_ap_file%" "%start_ap_file%"
)
echo.

echo Launch Browser
echo   Move to AnalysisPlatform
echo.

echo Create Shortcut
: make shortcut on DeskTop
set "shortcut_icon=ap\static\common\icons\AP+DN7.ico"
if not exist %shortcut_icon% set "shortcut_icon=ap\static\common\icons\AP+DN7.ico"
rem echo %shortcut_icon%
: get desktop path in case of OneDrive
for /f "delims=" %%i in ('%pshell% -Command "[Environment]::GetFolderPath('Desktop')"') do set "desktopPath=%%i"
if "%subt%"=="null" (
  set "fname=%desktopPath%\Analysis Platform AP+DN7 %port%|.url"
) else (
  set "fname=%desktopPath%\Analysis Platform AP+DN7 %port%| [%subt%].url"
)

:: for web
set "fpath=skip"
if not %shortcut_web% equ 0 set "fpath=%fname:|=%"
if %shortcut_web% equ 1 if %status% equ %status_run_app% if %only_install% equ 0 set "fpath=skip"
if not "%fpath%"=="skip" if not exist %fpath% (
  echo [InternetShortcut]>%fpath%
  echo URL=http://localhost:%port%/>> %fpath%
)

:: for app
set "fpath=skip"
if not %shortcut_app% equ 0 set "fpath=%fname:|=%"
if %shortcut_app% equ 1 if %status% equ %status_run_app% if %only_install% equ 0 set "fpath=skip"
set "fpath=%fpath:.url=.lnk%"
if not "%fpath%"=="skip" if not exist "%fpath%" (
  %pshell% -Command "$p=$env:fpath;$s=(New-Object -COM WScript.Shell).CreateShortcut($p);$s.TargetPath='%~f0';$s.WorkingDirectory='%~dp0';$s.IconLocation='%~dp0%shortcut_icon:"=%';$s.Save()"
)

::: for web by ip addr
for /f "tokens=4 delims= " %%i in ('route print ^| find " 0.0.0.0"') do set ip=%%i
echo   ip: %ip%
set "fpath=skip"
if not %shortcut_web_ip% equ 0 set "fpath=%fname:|=ip%"
if %shortcut_web_ip% equ 1 if %status% equ %status_run_app% if %only_install% equ 0 set "fpath=skip"
if not "%fpath%"=="skip" if not exist "%fpath%" (
  %pshell% -Command "$p=$env:fpath;$s=(New-Object -COM WScript.Shell).CreateShortcut($p);$s.TargetPath='http://%ip%:%port%/';$s.Save()"
)
::: for web by pc name
for /f %%i in ('hostname') do set pc=%%i
echo   pc: %pc%
set "fpath=skip"
if not %shortcut_web_pc% equ 0 set "fpath=%fname:|=pc%"
if %shortcut_web_pc% equ 1 if %status% equ %status_run_app% if %only_install% equ 0 set "fpath=skip"
if not "%fpath%"=="skip" if not exist "%fpath%" (
  %pshell% -Command "$p=$env:fpath;$s=(New-Object -COM WScript.Shell).CreateShortcut($p);$s.TargetPath='http://%pc%:%port%/';$s.Save()"
)
echo.

:Finish
echo The main sequence has started.
echo This window will close automatically after a while.
timeout /t 30
exit
