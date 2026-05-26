@echo off
chcp 65001 > nul
: _____________________________________________________________________________
:
:  Analysis Platform StartUp
: _____________________________________________________________________________
:  Important notice:
:    Running the batch file is regarded as you agreed to the Terms of Use.
:  Terms of Use:
:    https://github.com/apdn7/AnalysisPlatform/about/terms_of_use_en.md
: _____________________________________________________________________________

: _____________________________________________________________________________
: Initialize
:: Set powershell common option
set "pshell=powershell -NoLogo -NoProfile -ExecutionPolicy Bypass"
:: Get Escape $e 0x1b 27 and Tab
for /f "delims=" %%i in ('%pshell% -Command [char]27') do set "esc=%%i"
for /f "delims=" %%i in ('%pshell% -Command [char]09') do set "tab=%%i"
:: Definition
call :defSetting
:: Log
if not defined startTime call :getDateTime startTime
call :clearLog "%log_startap%"
>"%log_stageStatus%" echo.
if exist "%log_stageTime%" del "%log_stageTime%"
:: Alias
doskey ap="AnalysisPlatform.bat" $*
set "arg1=%~1"
if /i "%arg1%"==":downloadOracleInstance" goto downloadOracleInstance


call :logStartap startTime "===== Startup ====="
set "app_title=Analysis Platform    Port: %port%  Lang: %lang%  %subtitle%  py: %ver_pyt%  Path: %CD%"
title %app_title%
call :saveStartTimeOfStage MAIN
call :mode_cmd_init
cls
echo.
echo %clTitle%Start Analysis Platform%cl_Base%
echo.

: Read AP+DN7 User Settings: Version and Product (DN, OSS)
for /f "tokens=1,* delims=:" %%a in ('findstr /n /r "^" "%file_vers%"') do (
    if "%%a"=="1" set "ver_str=%%b"
    if "%%a"=="2" set "app_yml=%%b"
    if "%%a"=="3" set "app_prd=%%b"
)
for /f "tokens=1-3 delims=.v" %%a in ("%ver_str%") do set "app_ver=%%a%%b%%c"
set /a app_ver=%app_ver% >nul 2>&1 || set /a app_ver=9999
echo   Version: %esc%[36m%app_ver%%esc%[0m  Product: %esc%[36m%app_prd%%esc%[0m
call :logStartap lapTime "VERSION ver:%app_ver% [%ver_str%]  yml:%app_yml%  Type:%app_prd%"

: Get PID
for /f "tokens=2 delims=," %%a in ('
  tasklist /v /fo csv /fi "imagename eq cmd.exe" ^| findstr /c:"Port: %port%"
') do ( set "cmd_pid=%%~a" )
call :logStartap startTime "PID=%cmd_pid%: %app_title%"
rem prompt AP:%port%$g
echo.

: Check Product Type
rem Since there is a delay when updating the text color, directly enter the color code at the top after the change.
echo %esc%[30;107m%cl_Base%Check Product
if exist "%file_prod_dn%" (
  set "prod=%product_dn%"
  echo   Detected Product Type: dn7
  set "requirements=%file_prod_dn%"
) else (
  set "prod=%product_oss%"
  echo   Detected Product Type: oss
  set "requirements=%file_prod_oss%"
)
call :logStartap startTime "Product Type: %prod%"
if "prod"=="app_prd" (
  call :logStartap startTime "Product Type: Match %prod%" app:
)
echo.

: Check Port
call :checkPort %port% || goto FINISH

: Run start program
: Close old start_ap.exe before run
call :stopLoadingApp
start "" "%start_file%" %port%
rem start with Chrome (App window)
set "url_ap=http://localhost:%port%"
if not "%launch_chrome%"=="0" (
  where chrome.exe >nul 2>&1 && start "" chrome.exe --app="%url_ap%" || start "" "%url_ap%"
)
rem start with Edge (App window)
if not "%launch_edge%"=="0" (
  where msedge.exe >nul 2>&1 && start "" msedge.exe --app="%url_ap%" || start "" "%url_ap%"
)
echo.
call :logStartap lapTime "Call start_ap.exe to open welcome page"

: _____________________________________________________________________________
: Check version for reinstallation
:CHECK_STATUS
echo %clTitle%Status Check Sequence%cl_Base%
call :readIniSettings "%stat_ini%"
%pshell% -Command if($env:install_vers -match '^\d{3,4}$') {} else {exit 1} || (
  set /a install_vers=0
  call :logStartap lapTime "Missing Vaild Version Info: use ver=0"
)
if %app_ver% neq %install_vers% (
  set /a status=%status_install%
  set /a wait_netcheck=%wait_netcheck_inst%
  call :logStartap lapTime "[mode] Status File is INSTALL"
) else (
  set /a status=%status_run_app%
  set /a wait_netcheck=%wait_netcheck_appl%
  call :logStartap lapTime "[mode] Status File is RUN APP"
)
echo.

: _____________________________________________________________________________
: Check Component Status
echo Check Component Existence
set /a noComp=0
if exist "%main_python%" ( echo   Detect python ) else set /a noComp^|=1
if exist "%main_pip%"    ( echo   Detect pip    ) else set /a noComp^|=2
if exist "%main_env%"    ( echo   Detect venv   ) else set /a noComp^|=4
if exist "%main_oracle%" ( echo   Detect oracle ) else set /a noComp^|=8
call :checkPythonLib_rough || set /a noComp^|=16
if %noComp% equ 0 call :checkPythonLib_full || set /a noComp^|=32
if %noComp% equ 0 (
  call :logStartap lapTime "[mode] All component detected  Code:%noComp%"
) else (
  if %noComp% equ 31 (
    call :logStartap lapTime "[mode] First Installation  Code:%noComp%"
  ) else (
    echo.
    echo %clWarng% Installation is corrupted. Forcing component reinstallation... %cl_Base%
    call :logStartap lapTime "[mode] Retry (Component loss)  Code:%noComp%"
    timeout /t 3
  )
  set /a status=%status_install%
)

: Mode Setting
if %status% equ %status_run_app% (
  rem cls
  call :logStartap lapTime "[mode] Start AP+DN7"
) else (
  call :mode_cmd_install
  echo %clTitle%Installation%cl_Base%
  echo %clNotic%[Need Network or Proxy Settings and Connection]%esc%[30;107m %cl_Base%
  echo %esc%[30;107m %cl_Base%
  call :logStartap lapTime "[mode] Install (Path or Ver changed)"
)
echo.

: _____________________________________________________________________________
: Remove Oracle, python_embedded if size not enough
call :checkZip "%path_oc_zip%" %limitkB_oracle% "Oracle"
call :checkZip "%path_pi_pyz%" %limitkB_pippyz% "pippyz"
call :checkZip "%path_py_zip%" %limitkB_python% "python"

: _____________________________________________________________________________
: Check Disk Space before Installation and Start AP
call :checkDiskSpace || goto FINISH
echo.

: Direct Startup Mode
if "%startup_mode%"=="8" (
  echo %clTitle%Direct Startup Mode%cl_Base% === Force to bypass Installation ===
  set "network_nck=True"
  rem call :saveStartUpSetting
  goto Start_AP
)

echo Check Network and Proxy
: _____________________________________________________________________________
: Check Network and Proxy
call :getDefaultProxy
set /a active_com=0
call :checkProxy %prxy% "http"
call :checkProxy %prxs% "https"
if %active_com% equ 0 (
  if %status% equ %status_install% (
    echo %clAlarm% Alarm: Unable to communicate network %cl_Base%
    echo Check the network connection
    echo In an environment with proxy, write proxy settings to startup.ini
    echo Delete proxy settings in startup.ini when no proxy is used.
    call :logStartap lapTime "Network offline  Proxy=%Connectivity_proxy% Direct=%Connectivity_direct%"
    call :logStageStatus 102 "Unable to use network"
  ) else (
    call :logStageStatus 102 "Unable to communicate network" "NoCount"
  )
) else (
  call :logStartap lapTime "Network is connected"
)
echo.

:: Check Proxy Status
set "proxy=Not Active"
if defined target_prxy (
  set "HTTP_PROXY=%target_prxy%"
) else (
  echo   HTTP_PROXY   : No Proxy
)
if defined target_prxs (
  set "HTTPS_PROXY=%target_prxs%"
  set "proxy=Use Proxy"
) else (
  echo   HTTPS_PROXY  : No Proxy
  set "proxy=No Proxy"
)
echo Proxy: %proxy%
echo   HTTP_PROXY   : %HTTP_PROXY%
echo   HTTPS_PROXY  : %HTTPS_PROXY%
call :logStartap lapTime "Set HTTP_PROXY%tab%[%HTTP_PROXY%]"
call :logStartap lapTime "Set HTTPS_PROXY%tab%[%HTTPS_PROXY%]"

: Check Network Connection
%pshell% -Command ^
  $ErrorActionPreference='Stop'; $url=$env:url_testhp; ^
  try { ^
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12; ^
    $res = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing; ^
    Write-Host ('Network is available.'); ^
    Write-Host ('StatusCode: ' + $res.StatusCode) ^
  } catch { exit 1 } && (
    set "network_nck=False"
  ) || (
    set "network_nck=True"
    echo %clAlarm% Warning: Check Network Connection %cl_Base%
    timeout %wait_netcheck%
)
call :logStartap lapTime "Check Network after set PROXY  network_nck = %network_nck%"
echo.

: Branching point between installation and normal startup
if %status% equ %status_run_app% (
  echo %clTitle%Start AP+DN7...%cl_Base%
  goto Start_AP
)

: _____________________________________________________________________________
: Installing Analysis Platform
: _____________________________________________________________________________
:Install_AP
echo %clTitle%Start Installation...%cl_Base%
call :logStartap startTime "[Install] Install process initiated"
echo.

: _____________________________________________________________________________
: Download Components and Libraries
echo %clNotic% First boot may take 5-30 minutes depending on network ^& CPU speed. %cl_Base%
rem timeout /t 2
echo.
rem Move to Installer
@REM :: Ensure the user has full control over the folder.
@REM for %%a in ("..\..") do set "abs=%%~fa"
@REM call :logStartap lapTime "Change User Folder Permissions on %abs%"
@REM icacls "%abs%" /grant "BUILTIN\Users":(OI)(CI)F
@REM if errorlevel 1 (
@REM   call :logStartap lapTime "Change User Folder Permissions: Denied"
@REM ) else (
@REM   call :logStartap lapTime "Change User Folder Permissions: Done"
@REM )
@REM echo.

: Check R Existence
if not exist "%path_R%" (
  if "%prod%"=="%product_dn%" (
    echo %clAlarm% Make sure you have R-Portable folder before running this application. %cl_Base%
    echo Or prepare R-Portable folder and reboot AP before using R function
    rem call :logStageStatus 999 "R is not installed"
    echo %esc%[32mYou can continue if you do not use R components.%cl_Base%
    call :logStartap lapTime "Check R: R is missing"
    echo.
    choice /c YN /m "Press Y to continue or N to cancel:" /t 60 /d Y
    if errorlevel 2 (
      echo   Process canceled.
      call :logStartap lapTime "Check R: Canceled by user"
      goto FINISH
    )
    call :logStartap lapTime "Check R: Forced execution by user"
  )
  call :logStartap lapTime "Check R: No R (OSS)"
) else (
  call :logStartap lapTime "Check R: R is available"
)

echo %clTitle%Download Components...%cl_Base%
: Download Python
if exist "%main_python%" (
  echo Detect python
  call :logStartap startTime "Detect %main_python%"
) else (
  call :downloadPythonEmbedded || goto FINISH
  call :logStartap startTime "Fetched %path_py_zip%"
)
:: python isolation - Lib and DLLs
set "PYTHONHOME=%path_python%"
call :checkPythonIsolation "%main_python%"
: Download pip
if exist "%main_pip%" (
  echo Detect pip
  call :logStartap startTime "Detect %main_pip%"
)
call :preparepip && call :logStartap startTime "PreFetched pip" || goto FINISH
: Download Python libraries (Rapid Mode: pre-download without installation)
call :checkPythonLib_full && (
  echo Detect python libraries
  call :logStartap startTime "Detect python libraries"
) || (
  call :logStartap startTime "Missing Python libraries"
  if "%rapid_useCache%"=="True" call :getpylib ^
    && call :logStartap startTime "PreFetched pyLib - wheel"
)
: Download Oracle
if exist "%main_oracle%" (
  echo Detect Oracle
  call :logStartap startTime "Detect %main_oracle%"
) else (
  if "%rapid_async_DL%"=="True" (
    start "" cmd /c call "%~f0" :downloadOracleInstance
  ) else (
    call :downloadOracleInstance ^
      && call :logStartap startTime "Fetched %path_oc_zip%" ^
      || goto FINISH
  )
)

: _____________________________________________________________________________
: install packages
:: Get pip
echo %clTitle%Setup python... %clNotic% Components Install. %cl_Base%
call :logStartap lapTime "[Install] Setup python"
call :get_version_pip
if "%cur_pip%"=="Invalid" call :setpyIsoMode
if not exist "%main_pip%" (
  call :logStartap lapTime "Check pip: Not found. Installing"
  call :downloadPipByPipPyz
  call :get_version_pip
)
if not "%cur_pip%"=="%ver_pip%" (
  call :logStartap lapTime "Check pip: Ver mismatch. Updating"
  call :downloadPipByPipPyz
  call :get_version_pip
)
if not "%cur_pip%"=="%ver_pip%" (
  echo %clAlarm% Failed to install pip %cl_Base%
  echo - Check if the network is up and running.
  echo - Verify that the proxy settings are correct if a proxy is in use.
  echo - Ensure that access to Python libraries such as pypi.org is not blocked
  echo Terminating startup process...
  rem :::::: Make New Error Code and Page
  call :logStageStatus 201 "Failed to install pip"
  goto FINISH
) else (
  call :logStartap lapTime "Check pip: pip is available"
)

: -----------------------------------------------------------------------------
: Install virtual environment
call :logStartap lapTime "Install virtualenv"
echo %clTitle%Creating Virtualenv...%cl_Base%

set "com_venv=""%main_python%"" -I -m pip install virtualenv --find-links ""%rapid_dirCache%"""
set "com_venv=%com_venv% --no-warn-script-location -q"
call :pyGetComp "%com_venv%" "Download venv" "venv"

ECHO Creating Virtual Environment at "%path_env%"
"%main_python%" -I -m virtualenv "%path_env%" --python "%main_python%" ^
  --no-download --extra-search-dir "%rapid_dirCache%" && (
  call :logStartap lapTime "Create  virtualenv: Done"
) || (
  call :logStartap lapTime "Create  virtualenv: Failed"
  echo %clAlarm% Failed to create Virtual Env %cl_Base%
  goto FINISH
)

:: copy complied sqlite3.dll to env Scripts folder
if exist "%path_sqlite_dll%" copy /y "%path_sqlite_dll%" "%path_env%\Scripts\"

:: copy complied sqlite3.dll to python embedded Scripts folder
::powershell -ExecutionPolicy Bypass -Command if (Test-Path -Path \"$env:path_sqlite_dll\") { Copy-Item \"$env:path_sqlite_dll\" -Destination \"$env:path_python\" }

: -----------------------------------------------------------------------------
: Activate Virtual Environment 1st time before pip/venv
echo Activate Virtual Environment
CALL "%path_env%\Scripts\activate.bat"
if errorlevel 1 (
  call :logStartap startTime "virtualenv activated: Failed"
) else (
  call :logStartap startTime "virtualenv activated: %VIRTUAL_ENV%"
)
:: python isolation - Lib and DLLs for virtualenv in installation
set "PYTHONHOME=%path_python%"
call :checkPythonIsolation "%main_venvpy%"

:: Install pip to venv
call :logStartap lapTime "Install pip   to virtualenv"
"%main_venvpy%" -I "%path_pi_pyz%" install pip==%ver_pip% --find-links "%rapid_dirCache%" ^
  --exists-action=i --no-warn-script-location --retries 2
call :logStartap lapTime "Install venv pip by pyz"
set "cmd_dlp=""%main_venvpy%"" -I -m pip install %pkg_com% --no-index --retries 1"
set "cmd_dlp=%cmd_dlp% --find-links ""%rapid_dirCache%"" --only-binary=:all:"
call :pyGetComp "%cmd_dlp%" "Install venv pip " "pip.whl" && set /a err=0 || set /a err=1
call :get_version_pip_env
if %err% neq 0 (
  set "cmd_dlp=""%main_venvpy%"" -I -m pip install %pkg_com% --no-index --retries 2"
  set "cmd_dlp=%cmd_dlp% --find-links ""%rapid_dirCache%"" --no-build-isolation"
  call :pyGetComp "%cmd_dlp%" "Install venv pip+" "pip.whl+" && (
    set /a err=0
    call :get_version_pip_env
  ) || set /a err=1
)
if %err% neq 0 (
  set "cmd_dlp=""%main_venvpy%"" -I -m pip install %pkg_com% --retries 2 "
  call :pyGetComp "%cmd_dlp%" "Install venv pip#" "pip.whl#" && call :get_version_pip_env
)

echo %clTitle%Installing python libraries...%cl_Base%
:: Install Library with pip
call :logStartap startTime "Install pylib to virtualenv"
rem Rapid pylib Install
set "cmd_libR=""%main_venvpy%"" -I -m pip install -r ""%requirements%"" --retries 3"
set "cmd_libR=%cmd_libR% --find-links ""%rapid_dirCache%"" --no-warn-script-location"
rem Normal pylib Install
set "cmd_libN=""%main_venvpy%"" -I -m pip install -r ""%requirements%"" --retries 3"
set "cmd_libN=%cmd_libN% --no-warn-script-location"
if "rapid_useCache"=="True" (
  rem Rapid pylib Install
  call :getpylib
  call :pyGetComp "%cmd_libR%" "Install venv lib" "py.lib" && set /a err=0 || set /a err=1
) else (
  rem Normal pylib Install
  call :pyGetComp "%cmd_libN%" "Install venv lib" "py.lib" && set /a err=0 || set /a err=1
)
call :checkPythonLib_full && set /a err=0 || set /a err=1
if %err% neq 0 (
  echo %clAlarm% Failed to install python libraries %cl_Base%
    echo - Check if the network is up and running.
    echo - Verify that the proxy settings are correct if a proxy is in use.
    echo - Ensure that access to Python libraries such as pypi.org is not blocked
    echo Terminating startup process...
    rem rem rem rem rem Make New Error Code and Page
    call :logStageStatus 202 "Failed to install python libraries"
    timeout /t 5
    goto FINISH
) else (
  call :logStartap lapTime "Download pylib: Completed"
)

if exist "%path_R%" (
  if "%prod%"=="%product_dn%" "%path_R%\bin\R" CMD BATCH "r_install_packages.r"
)
call :logStartap lapTime "Install pylib: Completed"

: log application status : Installation Completed
rem call :readIniSettings "%stat_ini%"
call :getDateTime current
call :getTimeDiff "%startTime%" "%current%" diff
if not defined initial_date set "initial_date=%current%"
if not defined install_path (
  set "log="
) else (
  set "log=%install_date%, %install_span%, %install_vers%, %install_prod%, %install_path%"
)
>"%stat_ini%" (
  echo(;; This INI file is controlled by AnalysisPlatform.bat installer
  echo(; Application Status
  echo(install_vers=%app_ver%
  echo(install_prod=%app_prd%
  echo(install_path=%~dp0
  echo(install_date=%current%
  echo(install_from=%startTime%
  echo(install_span=%diff%
  echo(initial_date=%initial_date%
  echo(install_log1=%log%
  echo(install_log2=%install_log1%
  echo(install_log3=%install_log2%
)

call :logStartap lapTime "Install Completed"
echo.
echo Download components, libraries and installation is completed.
echo.

: _____________________________________________________________________________
: Run App: Analysis Platform
: _____________________________________________________________________________
:Start_AP
call :mode_cmd_run_ap "Keep"
call :logStartap startTime "[Start AP] Startup process initiated"

@REM :REMOVE_ZIPPED_FILES
@REM rem ::::::Blocking this from running
@REM if "%status%"=="" (
@REM   IF exist "%path_oc_zip%" (
@REM     del "%path_oc_zip%"
@REM     echo Removed Oracle zipped files.
@REM     call :logStartap lapTime "Delete zip Oracle"
@REM   )
@REM   IF exist "%path_py_zip%" (
@REM     del "%path_py_zip%"
@REM     echo Removed Python embedded zipped files.
@REM     call :logStartap lapTime "Delete zip python"
@REM   )
@REM   echo.
@REM )

: -----------------------------------------------------------------------------
:: Activate python in virtual environment (2nd for instllation 1st for RUN APP)
echo Activate Virtual Environment
call "%path_env%\Scripts\activate.bat" ^
  && call :logStartap startTime "virtualenv activated: %VIRTUAL_ENV%" ^
  || call :logStartap startTime "virtualenv activated: Failed"
:: python isolation - Lib and DLLs for virtualenv in RUN APP
set "PYTHONHOME=%path_python%"
call :checkPythonIsolation "%main_venvpy%"
:: Set Proxy to venv
if "%proxy%"=="Use Proxy" (
  if defined target_prxy (set "HTTP_PROXY=%target_prxy%")
  if defined target_prxs (set "HTTP_PROXY=%target_prxs%")
)
call :logStartap lapTime "Set HTTP_PROXY%tab%[%HTTP_PROXY%]"
call :logStartap lapTime "Set HTTPS_PROXY%tab%[%HTTPS_PROXY%]"
: ensure to assign the app title
title %app_title%
call :saveStartUpSetting
call :logStartap lapTime "Activate and set proxy to venv python"
echo.

: Skip main.py
if "%only_install%"=="1" (
  echo Skip AP startup and end sequences. "only_install" option is enabled.
  rem Keep CMD stay when install check (control by %/a %)
  goto FINISH
)
if /i "%arg1%"=="skip_main" goto FINISH

:::::::Temporarily stopped. Modify Python side and remove this.
call :stopLoadingApp
: Minimize com.exe window
call :mode_cmd_run_ap

REM run application
echo Starting Up Analysis Platform...    %clTitle% port:%port%  %cd% %cl_Base%
echo.
call :logStartap startTime "Run main.py"
"%main_venvpy%" -I "%cd%\main.py"
rem "%main_venvpy%" -I -c "import sys, runpy; sys.path.insert(0, r'%CD%'); runpy.run_path(r'%CD%\main.py', run_name='__main__')"
echo.
echo.

: Close CMD.exe if no error
:FINISH
call :logStartap startTime "[Closing] Closing process initiated  errCount:%errCount%"
echo.
echo.
echo ===== Closing AP+DN7 =====
echo.
call :stopLoadingApp
for /f "usebackq tokens=1" %%a in ("%log_stageStatus%") do ( set "errCode=%%a" )
if %errCount% neq 0 (
  rem In case error occur, terminal window is not closed and show error to user know that.
  echo %clAlarm% Abnormal Termination %cl_Base%
  echo  Error Count : %errCount%
  echo  Error Code  : %errCode%
  call :logStartap startTime "===== Error End Code:%errCode% Count: %errCount%"
  exit /b 0
)
if "%only_install%"=="1" (
  echo Installation Completed ...
  exit /b 0
)
rem call :stopBrowser
rem In case of NO ERROR, terminal window will be closed automatically in 5 seconds.
echo Normal End
timeout /t 5
:: find current running cmd and stop it through title
::title STOPPING...
::powershell -ExecutionPolicy Bypass -Command Get-Process ^| Where-Object { $_.Path -like \"*cmd.exe\" -and $_.MainWindowTitle -like \"STOPPING...*\" } ^| ForEach-Object { Stop-Process -Id $_.Id -Force }
if /I "%arg1%"=="skip_main" (
  echo skip end
  exit /b 0
)
exit

: _____________________________________________________________________________
: Sub Program
: _____________________________________________________________________________


: _____________________________________________________________________________
: Subroutine: function DownloadViaBITS
:      In/Out - | In  %1: Source URL
:               | In  %2: Destination file path
:               | Out %ERRORLEVEL: 0=Success / non-zero=Failure
:downloadViaBITS
  set "url=%~1"
  set "dst=%~2"
  %pshell% -Command ^
    $ErrorActionPreference='Stop'; $url=$env:url; $dst=$env:dst; $ok=$false; ^
    try { ^
      $job = Start-BitsTransfer -Source $url -Destination $dst ^
        -DisplayName 'BITS Download' -Description 'BITS normal' ^
        -ProxyUsage PreConfig -ErrorAction Stop; ^
      Complete-BitsTransfer -BitsJob $job; exit 1 ^
    } catch { } ^
    try { ^
      $job = Start-BitsTransfer -Source $url -Destination $dst ^
        -DisplayName 'BITS Download' -Description 'BITS normal' ^
        -ProxyUsage Override -ProxyList $env:HTTPS_PROXY -ErrorAction Stop; ^
      Complete-BitsTransfer -BitsJob $job; exit 2 ^
    } catch { } ^
    try { ^
      $job = Start-BitsTransfer -Source $url -Destination $dst ^
        -DisplayName 'BITS Download' -Description 'BITS normal' ^
        -ProxyUsage NoProxy -ErrorAction Stop; ^
      Complete-BitsTransfer -BitsJob $job; exit 3 ^
    } catch { } ^
    exit 4
  set "err=%errorlevel%"
  exit /b %err%
:end

: _____________________________________________________________________________
: Subroutine: function DownloadFile
:      In/Out - | In  %1: Source URL
:               | In  %2: Destination file path
:               | Out %ERRORLEVEL: 0=Success / non-zero=Failure
:downloadFile
  set "url=%~1"
  set "dst=%~2"
  set "stage=%~3"
  set "tgt=%~nx2"
  if "%url%"=="" exit /b 2
  if "%dst%"=="" exit /b 2
  for %%D in ("%dst%") do if not exist "%%~dpD" mkdir "%%~dpD"
  :: Invoke-WebRequest by 1:UseProxy 2:NoProxy 3:WinHTTP 4:WinINET
  call :logStartap startTime "Download by Invk%tab%%tgt%"
  %pshell% -Command ^
    $ErrorActionPreference='Stop'; $url=$env:url; $dst=$env:dst; ^
    try { ^
      $st = Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'; ^
      $base = Split-Path -Path $dst -Leaf; $tab = [char]9; ^
      $self_pid = (Get-Process -Id $PID).Parent.Id; ^
      $log = $st, $st, 'zip', '00:00', 'PID:'+$PID, 'PS Invoke-WebReq', $base, $self_pid -join $tab; ^
      Add-Content -LiteralPath $env:log_startap -Value $log; ^
      if(-not [string]::IsNullOrWhiteSpace($env:stage)) { ^
        Add-Content -LiteralPath $env:log_stageTime -Value ('{0}-{1}-{2}' -f $PID, $env:stage, $st) }; ^
    } catch { } ^
    $proxy = if (-not [string]::IsNullOrWhiteSpace($env:HTTPS_PROXY)) { $env:HTTPS_PROXY } ^
      elseif (-not [string]::IsNullOrWhiteSpace($env:HTTP_PROXY)) { $env:HTTP_PROXY } ^
      else { $null } ^
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12; ^
    try { ^
      if (-not [string]::IsNullOrWhiteSpace($proxy)) { ^
        Invoke-WebRequest -Uri $url -OutFile $dst -UseBasicParsing ^
          -Proxy $proxy -ProxyUseDefaultCredentials ^
      } else { ^
        Invoke-WebRequest -Uri $url -OutFile $dst -UseBasicParsing ^
      }; exit 1 ^
    } catch { } ^
    try { ^
      [System.Net.WebRequest]::DefaultWebProxy = $null; ^
      Invoke-WebRequest -Uri $url -OutFile $dst -UseBasicParsing; exit 2 ^
    } catch { } ^
    try { ^
      $winhttp = netsh winhttp show proxy; ^
      $proxy = ($winhttp ^| Select-String -Pattern 'Proxy Server.*:\s*(.+)$').Matches.Groups[1].Value.Trim(); ^
      Invoke-WebRequest -Uri $url -OutFile $dst -UseBasicParsing ^
        -Proxy $proxy -ProxyUseDefaultCredentials; exit 3 ^
    } catch { } ^
    try { ^
      $p=[System.Net.WebRequest]::GetSystemWebProxy(); ^
      $p.Credentials=[System.Net.CredentialCache]::DefaultNetworkCredentials; ^
      [System.Net.WebRequest]::DefaultWebProxy=$p; ^
      Invoke-WebRequest -Uri $url -OutFile $dst -UseBasicParsing ^
        -Proxy $proxy -ProxyUseDefaultCredentials; exit 4 ^
    } catch { } ^
    exit 5
  if not errorlevel 5 (
    if          errorlevel 4 ( call :logStartap lapTime "Get File by Invk%tab%%tgt%%tab%via WinINET"
    ) else ( if errorlevel 3 ( call :logStartap lapTime "Get File by Invk%tab%%tgt%%tab%via WinHTTP"
    ) else ( if errorlevel 2 ( call :logStartap lapTime "Get File by Invk%tab%%tgt%%tab%via NoProxy"
    ) else ( if errorlevel 1 ( call :logStartap lapTime "Get File by Invk%tab%%tgt%%tab%via Proxy" ))))
    exit /b 0
  ) else (
    call :logStartap lapTime "Download by BITS%tab%%tgt%"
    echo ---- Try BITS
    call :downloadViaBITS "%url%" "%dst%"
  )
  if not errorlevel 4 (
    if          errorlevel 3 ( call :logStartap lapTime "Get File by BITS%tab%%tgt%%tab%via NoProxy"
    ) else ( if errorlevel 2 ( call :logStartap lapTime "Get File by BITS%tab%%tgt%%tab%via Proxy"
    ) else ( if errorlevel 1 ( call :logStartap lapTime "Get File by BITS%tab%%tgt%%tab%via PreConfig" )))
    exit /b 0
  ) else (
    call :logStartap lapTime "Download by CAUt%tab%%tgt%"
    echo ---- Try Certutil
    certutil -urlcache -split -f "%url%" "%dst%"
  )
  if not errorlevel 1 (
    call :logStartap lapTime "Get File by CAUt%tab%%tgt%"
    exit /b 0
  ) else (  
    call :logStartap lapTime "Download by Curl%tab%%tgt%"
    echo ---- Try Curl
    curl.exe -v %HTTPS_PROXY%
    curl.exe --fail --silent --show-error --location "%url%" -o "%dst%"
    rem Error on Curl: Check network connection or use latest Win10 ^>1803
  )
  if not exist "%dst%" exit /b 1
  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: Check Python library
:      In/Out - |In -
:checkPythonLib_rough
  echo   Check python libraries
  rem Packages=Flask numpy scikit-learn chardet SQLAlchemy cutlet networkx
  rem set "lib_python=flask numpy sklearn chardet sqlalchemy cutlet networkx" :: Take Time
  set "lib_python=flask chardet sqlalchemy networkx"

  set "pycode=import %lib_python: =; import %"
  "%main_venvpy%" -I -c "%pycode%" 1>nul 2>&1
  if errorlevel 1 (
    echo   [Judge] One or more imports failed.
    call :logStartap lapTime "Check pylib rouph: Missing"
    exit /b 1
  ) else (
    echo   Detect python libraries: Pass
    call :logStartap lapTime "Check pylib rough: Exist"
  )
  exit /b 0
:end

:checkPythonLib_full
  set "file_com=%path_req%\common.txt"
  set "file_req=%path_req%\reqall.txt"
  set "file_frz=%path_req%\freeze.txt"
  set "file_dif=%path_req%\reqdif.txt"
  set "exceptlb=(Babel|pyper)"
  if not exist "%main_pip%" (
    echo python libraries missing
    call :logStartap lapTime "Check pylib full: Missing pip"
    rem exit /b 2
  )
  rem Generate list of libraries that are not installed in file_dif, but keep only Flask-Babel if it differs by case.
  if exist "%main_venvpy%" (
    "%main_venvpy%" -I -m pip freeze | sort > %file_frz% ^
      && call :logStartap lapTime "Freeze (Installed lib)  List: %file_frz%"
  ) else (
    call :logStartap lapTime "Check pylib full: Missing python in virtualenv"
    type nul > "%file_frz%"
  )
  rem Join two requirements files into file_req
  %pshell% -Command ^
    $req_com=$env:file_com; $req_prd=$env:requirements; $req_all=$env:file_req; ^
    Get-Content $req_com, $req_prd ^| Select-String -NotMatch 'common.txt' ^
      ^| Sort-Object ^| Set-Content -LiteralPath $req_all -Encoding UTF8 ^
    && call :logStartap lapTime "Create All Requirements List: %file_req%"
  rem Output the differences between the two files to file_dif
  %pshell% -Command ^
    $ErrorActionPreference='Stop'; ^
    $req_all=$env:file_req; $lib_frz=$env:file_frz; $lib_dif=$env:file_dif; $exc_lib=$env:exceptlb; ^
    $req = Get-Content -LiteralPath $req_all ^| Where-Object { $_.Trim() -ne '' } ^
      ^| ForEach-Object { $line = $_ -replace '\[.*?\]', ''; $line = $line -replace '~', '='; $line.Trim() }; ^
    $frz = Get-Content -LiteralPath $lib_frz ^| Where-Object { $_.Trim() -ne '' }; ^
    $dif = $req ^| Where-Object { $_ -cnotin $frz }; ^
    $dif ^| Set-Content -LiteralPath $lib_dif -Encoding UTF8; ^
    $dif = $dif ^| Where-Object { $_ -notmatch $exc_lib } ^| Where-Object { $_ -notmatch '^\s*#' }; ^
    if (@($dif).Count -eq 0) { exit 0 } else { exit 1 } && (
    call :logStartap lapTime "Create Dif Requirements List: %file_dif% - Missing library except keyword in exceptlb"
    echo python libraries exist
    call :logStartap lapTime "Check pylib full: Exist"
    exit /b 0
  ) || (
    call :logStartap lapTime "Create Dif Requirements List: %file_dif% - Missing library except keyword in exceptlb"
    echo python libraries missing
    call :logStartap lapTime "Check pylib full: Missing"
    exit /b 1
  )
  exit /b 0

:end

: _____________________________________________________________________________
: Subroutine: Download Python Embedded
:      In/Out - |In -
:downloadPythonEmbedded
  echo Download python
  if not exist "%path_py_zip%" (
    call :downloadFile "%url_python%" "%path_py_zip%" "PYTHON_EMBEDDED" && (
      call :logStartap lapTime "Download Completed%tab%%path_py_zip%"
    ) || (
      echo %clAlarm% Error on CA Check network connection or network security %cl_Base%
      echo Fail to download Python Embedded
      call :logStageStatus 200
      exit /b 1
    )
  )

  echo Unzip python
  if exist "%path_py_zip%" (
    echo Unzip python_embedded
    %pshell% -Command ^
      $ErrorActionPreference='Stop'; $zip=$env:path_py_zip; $dst=$env:path_python; ^
      Expand-Archive -Path $zip -DestinationPath $dst -Force && (
        call :logStartap lapTime "Unzip    Completed%tab%python.zip"
      ) || (
        call :logStartap lapTime "Unzip    Failed%tab%python.zip"
      )
  )
  call :setpyIsoMode

  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: Download Oracle Instance
:      In/Out - |In -
:downloadOracleInstance
setlocal EnableExtensions EnableDelayedExpansion
  if /i "%arg1%"==":downloadOracleInstance" (
    call :logStartap lapTime "Background Download%tab%%path_oc_zip%"
  )
  echo Download oracle instance
  if not exist "%path_oc_zip%" (
    call :downloadFile "%url_oracle%" "%path_oc_zip%" "ORACLE_INSTANCE" || (
      echo %clAlarm% Error on CA Check network connection or network security %cl_Base%
      echo Fail to download Oracle instance
      call :logStageStatus 210
      pause
      endlocal & exit /b 1
    )
    call :logStartap lapTime "Download Completed%tab%%path_oc_zip%"
  )

  echo Unzip oracle instance
  if exist "%path_oc_zip%" (
    %pshell% -Command ^
      $ErrorActionPreference='Stop'; $zip=$env:path_oc_zip; $dst=$env:path_oracle; ^
      Expand-Archive -Force -Path $zip -DestinationPath $dst && (
      call :logStartap lapTime "Unzip    Completed%tab%Oracle.zip"
    ) || (
      echo %clAlarm% Error on Unzip File %cl_Base%
      echo Fail to unzip Oracle instance
      call :logStartap lapTime "Unzip    Failed%tab%%Oracle.zip"
      call :logStageStatus 210
      pause
      endlocal & exit /b 1
    )

    if /i "%arg1%"==":downloadOracleInstance" (
      echo Install Completed%tab%%path_oc_zip%
      call :logStartap startTime "Background Install Completed: Oracle.lib"
    )
  )
  if /i "%arg1%"==":downloadOracleInstance" (
    timeout /t 30
  )
  timeout /t 30
endlocal & exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: Check python Isolation
:      In/Out - |In -
:checkPythonIsolation
  set "py_exe=%~1"
  if %py_exe% == %main_python% set "py=py_embd"
  if %py_exe% == %main_venvpy% set "py=py_venv"
  call :logStartap lapTime "%py% PYTHONHOME=%PYTHONHOME%  PYTHONNOUSERSITE=%PYTHONNOUSERSITE%"
  :: Check python settings and sys path of virtual environment
  for /f "delims=" %%a in ('%py_exe% -c "import sys; print(sys.prefix)"') do set "sys_pref=%%a"
  for /f "delims=" %%a in ('%py_exe% -c "import site; print(getattr(site,'getusersitepackages',lambda:'N/A')())"') do set "site_usr=%%a"
  call :logStartap startTime "%py% sys.prefix: %sys_pref%  usersite: %site_usr%"
  rem for /f "delims=" %%a in ('%py_exe% -c "import sys; print(sys.path)"') do set "sys_path=%%a"
  for /f "delims=" %%a in ('
    %py_exe% -c "import sys; print('\n'.join(sys.path))"
  ') do (
    call :logStartap lapTime "%py% sys.path: %%a"
  )
  for /f "delims=" %%a in ('%py_exe% -c "import sys,os,os.path as P; base=P.normcase(P.normpath(os.path.expandvars(r'%LocalAppData%\Programs\Python'))); print(any(P.normcase(P.normpath(p or '')) .startswith(base) for p in sys.path))"') do set "sys_appd=%%a"
  call :logStartap lapTime "%py% AppData Lib/DLL in sys.path: %sys_appd%  (Should be False in isolation)"
  for /f "delims=" %%a in ('%py_exe% -c "import sys,site; print(any(p and p.lower()==site.getusersitepackages().lower() for p in sys.path))"') do set "sys_site=%%a"
  call :logStartap lapTime "%py% site:user.local in sys.path: %sys_site%  (Should be False in isolation)"
  for /f "delims=" %%a in ('%py_exe% -c "import site; print(site.ENABLE_USER_SITE)"') do set "site_ena=%%a"
  call :logStartap lapTime "%py% site.ENABLE_USER_SITE:       %site_ena%  (Should be False in isolation)"
  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: Download pip.pyz, pip.whl and Install pip.exe
:      In/Out - |In -
:downloadPipByPipPyz
  call :logStartap startTime "Try to install pip with pip.pyz"
  if exist "%path_pi_pyz%" (
    call :logStartap startTime "Detect pip.pyz"
  ) else (
    call :downloadFile "%url_pippyz%" "%path_pi_pyz%" "PIP_DOWNLOAD" ^
      && call :logStartap lapTime "Fetched pip.pyz"
  )

  set "cmd_pyz=""%main_python%"" -I ""%path_pi_pyz%"" download pip==%ver_pip% -d ""%rapid_dirCache%"""
  set "cmd_pyz=%cmd_pyz% --exists-action=i --retries 2 --disable-pip-version-check --only-binary=:all: --no-deps"
  call :pyGetComp "%cmd_pyz%" "Download pip.pyz" "pip.pyz"

  set "cmd_pyz=""%main_python%"" -I ""%path_pi_pyz%"" install pip==%ver_pip% --find-links ""%rapid_dirCache%"""
  set "cmd_pyz=%cmd_pyz% --exists-action=i --retries 2 --disable-pip-version-check --no-warn-script-location"
  call :pyGetComp "%cmd_pyz%" "Download pip by pyz" "pip/pip.pyz"

  call :get_version_pip
  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: function Get pip Version
:      In/Out - |In -
:get_version_pip
  set "cur_pip=Invalid"
  for /f "tokens=2 delims= " %%a in ('"%main_python%" -I -m pip --version') do set "cur_pip=%%~a"
  echo   Current pip version: %cl_Note%%cur_pip%%cl_Base%  target: %ver_pip%
  call :logStartap lapTime "pip version: %cur_pip%  target: %ver_pip%"
  exit /b 0
:end

:get_version_pip_env
  set "env_pip=Invalid"
  for /f "tokens=2 delims= " %%a in ('"%main_venvpy%" -I -m pip --version') do set "env_pip=%%~a"
  for /f "delims=" %%a in ('
    %main_venvpy% -c "import sys; sys.dont_write_bytecode=True; import pip; print(getattr(pip,'__version__',''))"
  ') do set "epy_var=%%a"
  echo   Current venv pip version: %cl_Note%%env_pip%%cl_Base%  byPy: %epy_var%  target: %ver_pip%
  call :logStartap lapTime "venv pip version: %env_pip%  byPy: %epy_var%  target: %ver_pip%"
  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: function Get pip Version
:      In/Out - |In -
:setpyIsoMode
  if not exist "%path_py_pth%.bak" copy "%path_py_pth%" "%path_py_pth%.bak"
  : Activate python isolated mode
  for %%a in ("Lib" "Lib\site-packages" "import site") do (
    findstr /x /c:%%a "%path_py_pth%" >nul || echo %%~a>>"%path_py_pth%"
  )
  call :logStartap startTime "Set python Isolated mode"
  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: function Get pip.pyz and install pip
:      In/Out - |In -
:preparepip
  rem Remove incomplete installation folder like ~ip
  for /d %%d in ("%path_python%\Lib\site-packages\~*") do ( rmdir /s /q "%%d" )

  call :get_version_pip
  if "%cur_pip%"=="%ver_pip%" (
    echo   pip is available
    goto preparation_pip
  ) else (
    echo   pip is missing or old
  )
  if "%cur_pip%"=="Invalid" call :setpyIsoMode

  call :downloadPip
  if not "%rapid_useCache%"=="True" exit /b 0

  echo Install pip.pyz and pip
  if not exist "%rapid_dirCache%" mkdir "%rapid_dirCache%"
  call :downloadPipByPipPyz

  :preparation_pip
  :: virtualenv is downloaded here
  set "pkg=%pkg_com% %pkg_env%"
  set "cmd_dlp=""%main_python%"" -I -m pip download %pkg% -d ""%rapid_dirCache%"""
  set "cmd_dlp=%cmd_dlp% --exists-action=i --only-binary=:all: --retries 2"
  call :pyGetComp "%cmd_dlp%" "DownloadPre seed" "seed.whl" && set /a err=0 || set /a err=1
  if %err% neq 0 (
    set "cmd_dlp=""%main_python%"" -I -m pip download %pkg% -d ""%rapid_dirCache%"""
    set "cmd_dlp=%cmd_dlp% --exists-action=i --retries 2"
    call :pyGetComp "%cmd_dlp%" "DownloadPre seed#" "seed.whl"
  )

  :: pip install
  set "cmd_pip=""%main_python%"" -I -m pip install %pkg% --find-links ""%rapid_dirCache%"""
  set "cmd_pip=%cmd_pip% --no-index --only-binary=:all: --no-warn-script-location --retries 2"
  call :pyGetComp "%cmd_pip%" "InstallPre  seed" "seed.exe"

  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: function Get wheel
:      In/Out - |In -
:getpylib
  :: wheel dowonload
  set "cmd_wheel=""%main_python%"" -I -m pip wheel -w ""%rapid_dirCache%"" --exists-action=i"
  set "cmd_wheel=%cmd_wheel% -r ""%requirements%"" --no-build-isolation --retries 2"
  call :pyGetComp "%cmd_wheel%" "Download libraries" "py.lib" && set /a err=0 || set /a err=1
  if %err% neq 0 (
    set "cmd_wheel=""%main_python%"" -I -m pip wheel -w ""%rapid_dirCache%"" --exists-action=i"
    set "cmd_wheel=%cmd_wheel% -r ""%requirements%"" --retries 2"
    call :pyGetComp "%cmd_wheel%" "Download libraries#" "py.lib" && set /a err=0 || set /a err=1
  )
  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: function Check Zip File
:      In/Out |In %1: File Path  %2: Limit Size [kB]  %3: Label
:checkZip
  set "zipPath=%~1"
  set /a limitkB=%~2
  set "label=%~3"

  if exist "%zipPath%" (
    for %%f in ("%zipPath%") do ( set /a fileSizekB=%%~zf/1024 )
  ) else (
      set /a fileSizekB=-1
  )

  if %fileSizekB% equ -1 (
    call :logStartap lapTime "Missing zip %label%: File.zip not found  %zipPath%"
  ) else if %fileSizekB% leq %limitkB% (
    del /f /q "%zipPath%"
    echo Removed %label% zipped files. %fileSizekB%[kB] ^< Limit: %limitkB%[kB]
    call :logStartap lapTime "Broken  del %label%: %fileSizekB%[kB] ^< Limit: %limitkB%[kB]"
  ) else (
    call :logStartap lapTime "Keep    zip %label%: %fileSizekB%[kB] Limit: %limitkB%[kB]"
  )

  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: function Get python component via proxy or Direct
:      In/Out |In %1: python Command  %2: Title  %3: Component Label for Log
:pyGetComp
  set "cmd=%~1"
  set "msg=%~2"
  set "cmp=%~3"
  rem set "cmd=%cmd:'="%"
  if /i "%arg1%"=="debug" echo [Debug] pyGetComp Try: %cmd%

  echo %clTitle%%msg%%cl_Base% with Proxy
  %cmd% && (
    set /a err=0
    call :logStartap lapTime "Fetched  %cmp% with Proxy: Done"
    exit /b 0
  ) || (
    call :logStartap lapTime "Download %cmp% with Proxy: Failed"
    echo %msg% without Proxy
    setlocal EnableExtensions
      for %%a in (HTTP_PROXY HTTPS_PROXY ALL_PROXY NO_PROXY) do (set "%%a=")
      %cmd% && (
        call :logStartap lapTime "Fetched  %cmp% w/o  Proxy: Done"
        exit /b 0
      ) || (
        call :logStartap lapTime "Download %cmp% w/o  Proxy: Failed"
        exit /b 1
      )
    endlocal
  )
  exit /b 1
:end

: _____________________________________________________________________________
: Subroutine: function com.exe config
:      In/Out |In
:mode_cmd_init
  rem Foreground 30-37   90-97 Bright
  rem Background 40-47 100-107 Bright
  rem 30:Black  31:Red  32:Green  33:Yellow  34:Blue  35:Magenta  36:Cyan  37:White
  set "cl_Base=%esc%[0m"
  set "clTitle=%esc%[94m"
  set "cl_Note=%esc%[33m"
  set "clAlert=%esc%[31m"
  set "clNotic=%esc%[97;104m"
  set "clAlarm=%esc%[97;101m"
  set "clWarng=%esc%[97;43m"

  :: Setting com.exe
  color 0F
  set "cl_Base=%esc%[0m"
  echo %cl_Base%
  exit /b 0
:end

:mode_cmd_install
  :: Restore com window and Set window position
  %pshell% -Command ^
    Add-Type -MemberDefinition ' ^
    [System.Runtime.InteropServices.DllImport(\"kernel32.dll\")] ^
      public static extern System.IntPtr GetConsoleWindow(); ^
    [System.Runtime.InteropServices.DllImport(\"user32.dll\")] ^
      public static extern bool ShowWindowAsync(System.IntPtr hWnd,int nCmdShow); ^
    [System.Runtime.InteropServices.DllImport(\"user32.dll\", SetLastError=true)] ^
      public static extern bool SetWindowPos(System.IntPtr hWnd, System.IntPtr hWndInsertAfter,int X,int Y,int cx,int cy,uint uFlags); ^
      public static readonly System.IntPtr HWND_TOP = System.IntPtr.Zero; ^
      public const uint SWP_NOSIZE=0x0001; ^
      public const uint SWP_NOZORDER=0x0004;' -Name Win -Namespace X; ^
    $hWnd=[X.Win]::GetConsoleWindow(); ^
    [X.Win]::ShowWindowAsync($hWnd, 9); ^
    Start-Sleep -Milliseconds 100; ^
    $x=940; $y=40; ^
    [X.Win]::SetWindowPos($hWnd, [X.Win]::HWND_TOP, $x, $y, 0, 0, [X.Win]::SWP_NOSIZE -bor [X.Win]::SWP_NOZORDER) ^| Out-Null

  :: Setting com.exe
  @REM color 70
  @REM set "cl_Base=%esc%[30;47m"
  color F0
  set "cl_Base=%esc%[30;107m"
  echo %esc%[30;107m Change Color %esc%[0m Black %esc%[30;107m White %cl_Base%
  mode con: cols=120 lines=60
  %pshell% -Command ^
    $rw=$Host.UI.RawUI; ^
    $rw.BufferSize = New-Object System.Management.Automation.Host.Size(120,1000); ^
    $rw.WindowSize = New-Object System.Management.Automation.Host.Size(120,60)
  echo %esc%[30;107m Change Color %esc%[30;107m%cl_Base%
  cls
  echo.
  exit /b 0
:end

:mode_cmd_run_ap
  set "cmd=%~1"
  if %status% equ %status_run_app% exit /b 0

  :: Setting com.exe
  color 0F
  set "cl_Base=%esc%[0m"

  if "cmd"=="Keep" exit /b 0
  
  :: Minimize com window
  %pshell% -Command ^
    Add-Type -MemberDefinition ' ^
      [System.Runtime.InteropServices.DllImport(\"kernel32.dll\")] ^
        public static extern System.IntPtr GetConsoleWindow(); ^
      [System.Runtime.InteropServices.DllImport(\"user32.dll\")] ^
        public static extern bool ShowWindowAsync(System.IntPtr hWnd,int nCmdShow);' -Name Win -Namespace X; ^
    [X.Win]::ShowWindowAsync([X.Win]::GetConsoleWindow(), 6)
  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: function removeChar
:      In/Out var|In  %*: Array of Replacement Char
:removeChar
  for %%i in (%*) do call set var=%%var:%%i=%%
  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: function convertCaseLower
:      In/Out var
:convertCaseLower
  for %%i in (%chr_alphab%) do call set var=%%var:%%i=%%i%%
  exit /b 0
:end


: _____________________________________________________________________________
: Subroutine: Definition, Setting and Cleaning
:      In/Out - |In -
:defSetting
  :: AP Folder
  for %%D in (..) do set "path_main=%%~fD"
  : Setting
  set "file_vers=VERSION"
  set "stat_ini=%path_main%\apdn7.ini"
  :: Product Requirements File dn or oss
  set "path_req=requirements"
  set "file_prod_dn=%path_req%\prod.txt"
  set "file_prod_oss=%path_req%\oss_prod.txt"
  :: Startup File
  set "start_file=%cd%\start_ap.exe"
  set "start_info=startup.yaml"
  set "path_log=log"
  set "log_startap=start_ap.log"
  set "log_stageStatus=stage_status.log"
  set "log_stageTime=stage_start_time.log"
  ::: python
  if %app_ver% geq 482 (
    set "ver_pyt=312"
  ) else (
    set "ver_pyt=39"
  )
  set "path_py_zip=%path_main%\python_embedded_%ver_pyt%.zip"
  set "path_python=%path_main%\python_embedded_%ver_pyt%"
  set "main_python=%path_python%\python.exe"
  set "path_py_pth=%path_python%\python%ver_pyt%._pth"
  rem Override PYTHONPATH with empty for cmd session only
  set "PYTHONPATH="
  ::: Set No User Site (Isolation of user site-packages)
  set "PYTHONNOUSERSITE=1"
  ::: virtualenv
  if "%ver_pyt%"=="39" (
    set "path_env=%path_main%\env"
  ) else (
    set "path_env=%path_main%\env%ver_pyt%"
  )
  set "main_venvpy=%path_env%\Scripts\python.exe"
  set "main_env=%path_env%\Scripts\pip.exe"
  ::: pip
  set "main_pip=%path_python%\Scripts\pip.exe"
  set "path_pi_pyz=%path_python%\pip.pyz"
  set "ver_pip=26.0.1"
  set "pkg_com=pip==%ver_pip% setuptools==82.0.0 wheel==0.46.3"
  set "pkg_env=virtualenv==20.36.1"
  ::: Oracle
  set "path_oc_zip=%path_main%\Oracle-Portable.zip"
  set "path_oracle=%path_main%\Oracle-Portable"
  set "main_oracle=%path_oracle%\instantclient_21_3\BASIC_LICENSE"
  :: Others
  set "path_R=%path_main%\R-Portable"
  set "path_sqlite_dll=init\sqlite3.dll"
  :: path
  set "PATH=%path_oracle%\instantclient_21_3;%SystemRoot%\System32;%SystemRoot%\System32\WindowsPowerShell\v1.0\"
  rem set "PATH=%SystemRoot%\System32;%SystemRoot%\System32\WindowsPowerShell\v1.0\"

  :: Disk space required [%] to run AP
  set /a diskspace_pct_required=10
  :: Delete threshold file size [kB] -- update size when component changes
  set /a limitkB_oracle=83000
  set /a limitkB_pippyz=1600
  set /a limitkB_python=10000
  if "%ver_pyt%"=="39" set /a limitkB_python=8000
  : links
  set "url_testhp=https://bootstrap.pypa.io/"
  set "url_pippyz=https://bootstrap.pypa.io/pip/pip.pyz"
  set "url_oracle=https://download.oracle.com/otn_software/nt/instantclient/213000/instantclient-basic-windows.x64-21.3.0.0.0.zip"
  set "url_python=https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip"
  if "%ver_pyt%"=="39" set "url_python=https://www.python.org/ftp/python/3.9.13/python-3.9.13-embed-amd64.zip"

  :: Rapid Install
  set "rapid_async_DL=True"
  set "rapid_useCache=True"
  set "rapid_dirCache=%path_python%\cacheWheel"

  : Definition
  set /a errCount=0
  set /a status_install=0
  set /a status_run_app=1
  set "product_dn=prod"
  set "product_oss=oss"
  set "chr_number=0 1 2 3 4 5 6 7 8 9"
  set "chr_alphab=a b c d e f g h i j k l m n o p q r s t u v w x y z"

  : Wait Setting for Network Check in [sec]
  set /a wait_netcheck_inst=10
  set /a wait_netcheck_appl=1
  set /a wait_netcheck=%wait_netcheck_appl%

  : Settings from start batch
  :: Remove all '"'
  set "port=%port:"=%"
  set "lang=%lang:"=%"
  set "prxy=%prxy:"=%"
  set "prxs=%prxs:"=%"
  set "subt=%subt:"=%"
  :: Remove all ' '
  set "port=%port: =%"
  set "lang=%lang: =%"
  set "prxy=%prxy: =%"
  set "prxs=%prxs: =%"
  set "subt=%subt: =_%"

  ::: Get Current Directory Name: AnalysisPlatform000_7770
  for %%d in ("%CD%") do set "path_cur=%%~nxd"
  ::: Get path sub title XXX    : AnalysisPlatform000_7770_XXX
  for /f "tokens=3 delims=_" %%a in ("%path_cur%") do set "path_sub=%%a"

  if "%subt%"=="null" (
    set "subtitle=-"
  ) else (
    set "subtitle=%subt%"
  )
  if "%subt%"=="DX_QC7Tools" (
    if defined path_sub set "subtitle=%path_sub%"
  )

  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: Read ini File Settings
:      In/Out - |In -
:readIniSettings
  set "ini=%~1"
  set "idx=%~nx1"
  if not exist "%ini%" (
    echo %esc%[32m  Detect no ini file. Using default settings...%esc%[0m
    call :logStartap lapTime "%idx%: Detect no ini file. Using default settings"
    exit /b 1
  )
  set "ini_acc="
  for /f "tokens=1,* delims==" %%a in ('findstr /r /c:"^[^;].*=" "%ini%"') do (
    set "%%a=%%b"
    if  not defined ini_acc (
      set "ini_acc=%idx% %%a%tab%[%%b]"
    ) else (
      call set "ini_acc=%%ini_acc%%;%%idx%% %%a%%tab%%[%%b]"
    )
  )
  call :logStartap lapTime "%ini_acc%"
  if not defined ini_acc (
    call :logStartap lapTime "%idx%: [Error] %idx%: Fail to read ini file."
    exit /b 2
  )
  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: Check Port Setting
:      In/Out valid_port|In %1: port
:checkPort
  set /a valid_port=0
  echo Check Port: [%~1] (Only Integers 6000-7069, 7071-8000 Available)
  : check Integer
  set /a var=%~1 2>nul
  if %errorlevel% neq 0 (
    echo %clAlarm% Warning: Bad Port Number %cl_Base%
    echo Only integers are allowed for port number
    echo Current Value: %1
    call :logStageStatus 101 "Bad Port: Not Integer"
    exit /b 1
  ) else (
    set /a valid_port=1
  )

  : check Range
  if %var% geq 6000 (
    if %var% lss 8000 (
      if %var% neq 7070 set /a valid_port=2
    )
  )
  if %valid_port% neq 2 (
    echo %clAlarm% Warning Bad Port Number %cl_Base%
    echo Change Port Number from 6000 to 7999
    echo Current Value: %1
    call :logStageStatus 101 "Bad Port: Out of Range"
    exit /b 1
  )

  : Check Port Available
  %pshell% -Command ^
    $ErrorActionPreference='Stop'; $p=$env:var; ^
    $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; ^
    if ($c) { Write-Host (' '*2 + 'NG: Port ' + $p + ' is in use (LISTENING).');        exit 1 } ^
    else    { Write-Host (' '*2 + 'OK: Port ' + $p + ' is available (Not LISTENING).'); exit 0 } ^
    && (
      call :logStartap lapTime "Check Port: Port %var% is available (TCP Connection)"
      exit /b 0
    ) || (
      echo %clAlarm% Alarm: Port %var% is already in use. %cl_Base%
      echo Another application is already running.
      echo To start multiple AP+DN7, edit startup.ini and change the port number.
      echo You can only continue if this port is not being used by another application.
      echo.
      netstat -ano | findstr /r /c:"PID" /c:"%var%.*LISTENING"
      tasklist /v /fo csv /fi "IMAGENAME eq start_ap.exe" ^
        | %pshell% -command "$input -replace '\"','' -replace ',',\"`t\""
      tasklist /v /fo csv /fi "IMAGENAME eq python.exe" ^
        | %pshell% -command "$input -replace '\"','' -replace ',',\"`t\""
      if %status% equ %status_install% (
        tasklist /v /fo csv /fi "IMAGENAME eq cmd.exe" ^
          | %pshell% -command "$input -replace '\"','' -replace ',',\"`t\""
      )
      echo %clAlert%If the required application is running, you must select 'N'.%cl_Base%
      call :logStartap lapTime "Check Port: Detected port %var% in use"
      choice /c YN /m "Press Y to continue or N to cancel:" /t 60 /d Y
      if errorlevel 2 (
        echo   Process canceled.
        call :logStartap lapTime "Check Port: Canceled by user"
        exit /b 1
      )
      echo   Forcing process to continue...
      call :logStartap lapTime "Check Port: Forced execution by user"
    )

  rem call :stopLoadingApp
  : Kill process using port and python
  %pshell% -Command ^
    $ErrorActionPreference='Stop'; $p=$env:var; ^
    $pids = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue ^
      ^| Select-Object -ExpandProperty OwningProcess -Unique ^
      ^| Where-Object { $_ -ne 0 }; ^
    if (-not $pids -or $pids.Count -eq 0) { Write-Host 'No PID' -ForegroundColor Yellow; exit 0 }; ^
    foreach ($id in $pids) { ^
      try { ^
        try { Start-Process taskkill -ArgumentList ('/T','/F','/PID', $id) -NoNewWindow -Wait } catch { }; ^
        Write-Host ('Killed Tree PID={0}' -f $id) -ForegroundColor Green ^
      } catch { ^
        Write-Host ('taskkill Fail PID={0} =^> {1}' -f $id, $_.Exception.Message) -ForegroundColor Red ^
      } ^
    }
  timeout /t 1
  echo   Port:%var% available
  call :logStartap lapTime "Forced closing of Port %var%"
  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: get Default Proxy Setting
:      In/Out - |In -
:getDefaultProxy
  : Setting from start_ap.ini
  call :logStartap lapTime "start_ap.ini Proxy http  prxy : %prxy%"
  call :logStartap lapTime "start_ap.ini Proxy https prxs : %prxs%"
  : get Default Proxy Setting
  set "basic_ver=null"
  set "basic_port=null"
  set "basic_proxy=null"
  set "basic_config=ap\config\basic_config.yml"
  if not exist %basic_config% set "basic_config=ap\config\basic_config.yml"
  for /F "tokens=2,3,4 delims=: " %%i in (%basic_config%) do (
    if "%%i"=="version" set "basic_ver=%%j"
    if "%%i"=="port-no" set "basic_port=%%j"
    if "%%i"=="proxy"   set "basic_proxy=%%j:%%k"
    rem It gets more complicated dealing with nesting arrays, so leave the for loop at the next level or after reading the variable.
    if "%%i"=="proxy" goto break_for_ini
  )
  :break_for_ini

  echo Basic Config
  echo   Ver  : %basic_ver%
  echo   Port : %basic_port%
  echo   Proxy: %basic_proxy%
  call :logStartap lapTime "Basic Config ver  : %basic_ver%"
  call :logStartap lapTime "Basic Config port : %basic_port%"
  call :logStartap lapTime "Basic Config proxy: %basic_proxy%"

  if not "%basic_proxy%"=="null" (
    if not "%basic_proxy%"==":" (
      if "%prxy%"=="null" (
        echo Use Default Proxy of %basic_proxy%
        call :logStartap lapTime "Use BasicCfg proxy: %basic_proxy%"
        set "prxy=%basic_proxy%"
        set "prxs=%basic_proxy%"
      )
    )
  )

  echo Target Proxy
  echo   Proxy http : %prxy%
  echo   Proxy https: %prxs%
  echo.
  if %prxs% == http set prxs=%prxy%
  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: Check Proxy Setting
:      In/Out valid_proxy|In %1: Proxy Info  %2: Type http(s)
:             valid_proxy 0x00: Bad proxy  0x01: No Setting  0x04:ip  0x08:dns
:checkProxy
  set "var=%~1"
  set "typ=%~2"
  set /a valid_proxy=0x00
  if "%typ%"=="http" (
    set "target_type=http"
    set "target_proxy=http://%var%"
  ) else (
    set "target_type=https"
    set "target_proxy=http://%var%"
  )
  echo Proxy Setting Check: %typ% %var%
  : Check Format
  :: no or null: Do nothing
  if "%var%"=="no"   set /a valid_proxy=0x01
  if "%var%"=="null" set /a valid_proxy=0x01
  if %valid_proxy% equ 0x01 (
    set "target_proxy="
    goto set_env_proxy
  )
  :: check format ip
  call :removeChar %chr_number%
  if "%var%"=="...:" set /a valid_proxy=0x04
  :: check format domain name
  call :convertCaseLower
  call :removeChar %chr_alphab%
  call :removeChar . -
  if "%var%"==":" set /a valid_proxy=0x08
  :: judge
  if %valid_proxy% equ 0 (
    echo %clAlarm% Warning Proxy Address/Domain Name %cl_Base%
    echo Modify %target_type% Proxy Address/Domain Name
    echo Current Value: [%var%]  valid_proxy=%valid_proxy%
    if %status% equ %status_install% (
      call :logStageStatus 102 "Bad Proxy Setting"
      call :logStartap lapTime "Proxy Invalid %target_type%:%tab%%target_proxy%"
      exit /b 1
    ) else (
      call :logStageStatus 102 "Bad Proxy Setting" "NoCount"
    )
    exit /b 0
  )

  :set_env_proxy
  rem Proxy : Set Environment Variable
  set /a valid_proxy+=0x02
  if "%target_type%"=="http" (
    set "target_prxy=%target_proxy%"
  ) else (
    set "target_prxs=%target_proxy%"
  )
  if %valid_proxy% equ 0x03 set "provy_type=NoProxy"
  if %valid_proxy% equ 0x06 set "provy_type=ipAddress"
  if %valid_proxy% equ 0x0A set "provy_type=DomainName"
  if %valid_proxy% equ 0x03 (
    call :logStartap lapTime "Proxy Valid %target_type%:%tab%%provy_type%"
  ) else (
    call :logStartap lapTime "Proxy Valid %target_type%:%tab%%provy_type%%tab%%target_proxy%"
  )

  rem Skip the TCP Connection Check when no proxy is configured.
  if %valid_proxy% equ 0x03 goto Get_WinHTTP_Setting
  : Check Proxy Reachable
  %pshell% -Command ^
    $ErrorActionPreference='SilentlyContinue'; $h=[Uri]$env:target_proxy; ^
    $res = Test-NetConnection -ComputerName $h.Host -Port $h.Port; ^
    if(-not $res.TcpTestSucceeded){ ^
      Write-Host (' '*2 + 'Proxy Connection Test [TCP] : NG (Unreachable Proxy)'); exit 1 ^
    } else { Write-Host (' '*2 + 'Proxy Connection Test [TCP] : Pass') } && (
      call :logStartap lapTime "Proxy TCP connection: Pass%tab%%target_type%"
    ) || (
      call :logStartap lapTime "Proxy TCP connection: Failed%tab%%target_type%"
    )

  : Check Proxy HTTPS Connectivity with Proxy
  %pshell% -Command ^
    $ErrorActionPreference='SilentlyContinue'; $proxy=$env:target_proxy; $url=$env:url_testhp; ^
    Write-Host (' '*2 + 'Connectivity check: Via proxy: ' + $proxy); ^
    try { ^
      [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12; ^
      $res = Invoke-WebRequest -Uri $url -Proxy $proxy -Method Head ^
        -UseBasicParsing -MaximumRedirection 5 -ErrorAction Stop; ^
      Write-Host (' '*4 + 'HTTP StatusCode: ' + [int]$res.StatusCode) ^
    } catch { Write-Host (' '*4 + 'Fail to connect via proxy'); exit 1 } && (
      set /a active_com+=1
      set /a Connectivity_proxy=1
      call :logStartap lapTime "Proxy OK_CommViaProxy %target_type%: %target_proxy%"
    ) || (
      set /a Connectivity_proxy=0
      call :logStartap lapTime "Proxy NG_CommViaProxy %target_type%: %target_proxy%"
    )
    if %Connectivity_proxy% equ 0 (
      echo %clAlarm% Alarm: Unable to communicate via proxy %cl_Base%
      echo Current Value: %target_proxy%  provy_type: %provy_type%
      if %status% equ %status_install% (
        call :logStageStatus 102 "Unable to communicate via proxy" "NoCount"
      ) else (
        call :logStageStatus 102 "Unable to communicate via proxy" "NoCount"
      )
    )

  : Get WinHTTP Setting
   :Get_WinHTTP_Setting
  set "winhttp_proxy="
  for /f "tokens=1,* delims=:" %%a in ('
    netsh winhttp show proxy ^| findstr /i /c:"Proxy Server" /c:"プロキシ サーバー"
  ') do (
    for /f "tokens=* delims= " %%x in ("%%b") do set "winhttp_proxy=%%x"
  )
  if not defined Connectivity_proxy set /a Connectivity_proxy=0
  if %Connectivity_proxy% equ 0 (
    if defined winhttp_proxy (
      if "%target_type%"=="http" (
        set "target_prxy=%winhttp_proxy%"
      ) else (
        set "target_prxs=%winhttp_proxy%"
      )
      call :logStartap lapTime "Proxy Replace_WinHTTP %target_type%: %winhttp_proxy% - WinHTTP"
    )
  )

  rem Skip the Direct Connectivity Check when Proxy Connectivity is OK.
  if %Connectivity_proxy% equ 1 exit /b 0

  :Check_Conn_Direct
  : Check Proxy HTTPS Connectivity without Proxy
  %pshell% -Command ^
    $ErrorActionPreference='SilentlyContinue'; $url=$env:url_testhp; ^
    Write-Host (' '*2 + 'Connectivity check: No proxy'); ^
    try { ^
      [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12; ^
      $res = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing ^
        -MaximumRedirection 5 -ErrorAction Stop; ^
    } catch { exit 1 }; ^
    if ($null -ne $res) { ^
      Write-Host ('HTTP StatusCode: ' + [int]$res.StatusCode) ^
    } else { ^
      Write-Host ('HTTP StatusCode: N/A  (No Response)'); exit 1 ^
    } && (
      set /a active_com+=1
      set /a Connectivity_direct=1
      call :logStartap lapTime "Proxy OK_Comm_NoProxy %target_type%: (No Proxy or WinHTTP Setting)"
    ) || (
      set /a Connectivity_direct=0
      call :logStartap lapTime "Proxy NG_Comm_NoProxy %target_type%: (No Proxy or WinHTTP Setting)"
    )
    if %Connectivity_direct% equ 0 (
      echo %clWarng% Alarm: Unable to communicate with no proxy %cl_Base%
      if %status% equ %status_install% (
        rem error stop if direct NG and proxy NG (Connectivity_proxy==0)
        call :logStageStatus 102 "Unable to communicate without proxy"
      ) else (
        call :logStageStatus 102 "Unable to communicate without proxy" "NoCount"
      )
    )

  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: Save Settings (Share Start Info to python)
:      In/Out - |In -
:saveStartUpSetting
  set "var=%network_nck%"
  call :convertCaseLower

  : Make yaml file
  (
    echo !!omap
    echo # Analysis Platform StartUp Batch File Setting
    echo - version_yaml: 1.0
    echo - setting_startup: !!omap
    echo   - port: %port%
    echo   - language: %lang%
    echo   - subtitle: %subt%
    echo   - proxy_http: %prxy%
    echo   - proxy_https: %prxs%
    echo   - network_nck: %var%
    echo   - env_ap: %prod%
    echo   - flask_debug: %flask_debug%
    echo   - update_R: %update_R%
    echo   - enable_file_log: %enable_file_log%
    echo   - enable_ga_tracking: %enable_ga_tracking%
    echo   - enable_dump_trace_log: %enable_dump_trace_log%
    echo   - disable_config_from_external: %disable_config_from_external%
  ) > "%start_info%"

  call :logStartap lapTime "Update %start_info% to share settings to python"
  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: Check disk space
:      In/Out |In %1: Stage code
:checkDiskSpace
  :: Get the drive letter of the current directory
  set "CurrentDrive=%CD:~0,1%"
  ::Get the free and total disk space for the current drive
  echo Check Available Disk Space  --- Current Drive: %CurrentDrive%:
  for /f "tokens=1,* delims==" %%a in ('
    %pshell% -Command ^
      "$ErrorActionPreference='Stop';" ^
      "$d=$env:CurrentDrive; $threshold=[double]$env:diskspace_pct_required;" ^
      "$psd = Get-PSDrive -Name $d;" ^
      "$freeGB = [math]::Round(($psd.Free / 1GB), 2);" ^
      "$freeRt = [math]::Round(($psd.Free / ($psd.Free + $psd.Used) * 100), 1);" ^
      "$needGB = [math]::Round((($psd.Free + $psd.Used) / 1GB * $threshold / 100.0), 2) + 1;" ^
      "$stopAP = $freeRt -lt $threshold;" ^
      "Write-Output ('freeGB=' + $freeGB);" ^
      "Write-Output ('needGB=' + $needGB);" ^
      "Write-Output ('stopAP=' + $stopAP)"
  ') do (
    if /I "%%a"=="freeGB" set "freeGB=%%b"
    if /I "%%a"=="needGB" set "needGB=%%b"
    if /I "%%a"=="stopAP" set "stopAP=%%b"
  )
  if errorlevel 1 (
    rem If we could not get disk space somehow, still allow the user to run the program
    echo Could not obtain the amount of remaining and total disk space. Skipping disk check...
  )
  call :logStartap lapTime "Check Disk Space  NG:%stopAP% Free:%freeGB%[GB] Limit:%needGB%[GB] (%diskspace_pct_required%[%%%%])"
  set "msg=Please free up at least %needGB%[GB] before installation. Current: %freeGB%[GB]"
  if "%stopAP%"=="True" (
    if %status% equ %status_install% (
      call :logStageStatus 100
      echo %clAlarm% Alarm: Free disk space is insufficient %cl_Base%
      echo Please ensure that there is at least %diskspace_pct_required%[%%] + 1GB of disk space available
      echo %msg%
      rem echo Terminating install process...
      echo Disk space is low. Do you want to continue the process?
      call :logStartap lapTime "Check DiskSpace: Low disk space detected"
      echo.
      choice /c YN /m "Press Y to continue or N to cancel:" /t 60 /d Y
      if errorlevel 2 (
        echo   Process canceled.
        call :logStartap lapTime "Check DiskSpace: Canceled by user"
        exit /b 1
      ) else (
        echo   Forcing process to continue...
        echo   Even after installation, the data is still not loading.
        echo   Please free up space before using AP+DN7.
        call :logStartap lapTime "Check DiskSpace: Forced execution by user"
      )
    ) else (
      call :logStartap startTime "Detect Error 100 Low Disk Space"
      echo %clWarng% Warning: Free disk space is insufficient %cl_Base%
      echo Since the available disk space is below %diskspace_pct_required% [%%],
      echo The data import process will be stopped.
      echo %msg%
      call :logStartap lapTime "Check Port: Forced execution (Installation completed)"
      rem timeout /t 3
    )
  ) else (
    echo   Check Disk Space: Done
    echo   The available disk space is sufficient ^(Current: %freeGB%[GB] ^> Limit: %needGB%[GB]^)
  )
  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: Stop Loading App
:      In/Out - |In -
:stopLoadingApp
  call :logStartap startTime "Stop start_ap.exe"
  %pshell% -Command Get-Process -ErrorAction SilentlyContinue ^| Where-Object { $_.Path -eq \"$env:start_file\" } ^| ForEach-Object { Stop-Process -Id $_.Id -Force }
  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: Stop Browser
:      In/Out - |In -
:stopBrowser
  %pshell% -Command ^
    $url1='http://localhost:%port%'; $url2='https://localhost:%port%'; ^
    $k=@(); ^
    $procs = Get-CimInstance Win32_Process ^| Where-Object { $_.Name -in @('msedge.exe','chrome.exe') }; ^
    $targets = $procs ^| Where-Object { ($_.CommandLine -like '*'+$url1+'*') -or ($_.CommandLine -like '*'+$url2+'*') }; ^
    foreach($p in $targets){ try{ ^
      Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; $k += $p.ProcessId; ^
      Write-Host ('Kill by URL cmdline: '+$p.Name+' PID='+$p.ProcessId) } catch {} }; ^
    if($k.Count -eq 0){ Write-Host 'No process found' }
  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: Save start time of
:      In/Out |In %1: Stage code
:saveStartTimeOfStage
  set stage_name=%1
  for /f "usebackq tokens=2" %%a in (`tasklist /FO list /FI "WINDOWTITLE eq %app_title%*" ^| find /i "PID:"`) do (
    set self_pid=%%a
  )
  call :getDateTime stageStartTime
  echo %self_pid%-%stage_name%-%stageStartTime% >> %log_stageTime%
  exit /b 0
:end

: _____________________________________________________________________________
: Calculate Time difference
:      In/Out |In %1: startTime, %2 logMsg
:getTimeDiff
  set "fr=%~1"
  set "to=%~2"
  set "_ret_diff=%~3"
  set "_ret_roll=%~4"
  for /f "tokens=2 delims=_" %%a in ("%fr%") do set "frT=%%a"
  for /f "tokens=2 delims=_" %%a in ("%to%") do set "toT=%%a"
  for /f "tokens=1-4 delims=:." %%a in ("%frT%") do ( set "fH=%%a" & set "fM=%%b" & set "fS=%%c" & set "fF=%%d" )
  for /f "tokens=1-4 delims=:." %%a in ("%toT%") do ( set "tH=%%a" & set "tM=%%b" & set "tS=%%c" & set "tF=%%d" )
  set /a fH = 1%fH% - 100, fM = 1%fM% - 100, fS = 1%fS% - 100, fF = 1%fF% - 1000
  set /a tH = 1%tH% - 100, tM = 1%tM% - 100, tS = 1%tS% - 100, tF = 1%tF% - 1000
  set /a fr_ms = ((fH*60 + fM)*60 + fS)*1000 + fF
  set /a to_ms = ((tH*60 + tM)*60 + tS)*1000 + tF
  set /a delta = to_ms - fr_ms
  set "rolled=0"
  if %delta% lss 0 (
    set /a delta += 86400000
    set "rolled=1"
  )
  : sec.msec
  set /a sec = delta / 1000
  if %delta% lss 1000 set "delta=000%delta%"
  set "msc=%delta:~-3%"
  set "tim=%sec%.%msc%"
  : min:sec
  set /a min = sec / 60
  set /a sec = sec %% 60
  set "sec=00%sec%"
  set "sec=%sec:~-2%"
  set "msc=%msc:~0,1%"
  if %min% gtr 0 set "tim=%min%:%sec%.%msc%"
  if defined _ret_diff set "%_ret_diff%=%tim%"
  if defined _ret_roll set "%_ret_roll%=%rolled%"
  exit /b 0
:end

: _____________________________________________________________________________
: Calculate Get DateTime
:      In/Out |In %1: startTime, %2 logMsg
:getDateTime
  set "_ret=%~1"
  if not defined startDate (
    for /f %%t in ('%pshell% "Get-Date -Format yyyy-MM-dd"') do set "startDate=%%t"
  )
setlocal EnableDelayedExpansion
  set str=%TIME%
  rem Since %TIME% uses a 24‑hour format, AM/PM processing is unnecessary and does not depend on locale settings.
  rem echo(!str! | findstr /i "P 後" >nul && set "h_offset=12" || set "h_offset=0"
  rem for %%a in (A a P p M m 午前 午後) do set "str=!str:%%a=!"
  for /f "tokens=* delims=" %%a in ("%str%") do set "str=%%a"
  for /f "tokens=1-4 delims=:., " %%a in ("%str%") do (
    rem set /a H = %%a + !h_offset! & set "H=0!H!" & set "H=!H:~-2!"
    set "H=0%%a" & set "H=!H:~-2!"
    set "M=0%%b" & set "M=!M:~-2!"
    set "S=0%%c" & set "S=!S:~-2!"
    set "F=%%d00" & set "F=!F:~0,3!"
  )
  set "now=%H%:%M%:%S%.%F%"
endlocal & set "now=%now%"
  if not defined preval set "preval=%startDate%_%now%"
  call :getTimeDiff "%preval%" "%startDate%_%now%" diff roll
  if "%roll%"=="1" for /f %%t in ('%pshell% "Get-Date -Format yyyy-MM-dd"') do set "startDate=%%t"
  if defined _ret set "%_ret%=%startDate%_%now%"
  set "preval=%startDate%_%now%"
  exit /b 0
:end

: _____________________________________________________________________________
: log Stage Status
:      In/Out |In %1: Error Code  %2: Message  %3: Log Option
:logStageStatus
  set /a errorCode=0
  set /a errorCode=%~1 >nul 2>&1
  set "msg=%~2"
  set "opt=%~3"
  if not defined msg (
    set "msg=Unknown Error"
    if %errorCode% equ 100 set "msg=Low Disk Space"
    rem errorCode% equ 101    About port
    rem errorCode% equ 102    About proxy
    if %errorCode% equ 200 set "msg=Fail to DL python"
    if %errorCode% equ 201 set "msg=Fail to DL pip.pyz"
    if %errorCode% equ 210 set "msg=Fail to DL oracle"
    rem errorCode% equ 999
  )
  call :logStartap startTime "Detect Error %errorCode% %msg%"
  rem If errCount neq 0 Error Diplay at FINISH
  if not "%opt%"=="NoCount" (
    set /a errCount+=1
    if %errorCode% neq 0 (>"%log_stageStatus%" echo %errorCode%)
  )
  if "%opt%"=="Reset" set /a errCount=0
  exit /b 0
:end

: _____________________________________________________________________________
: Subroutine: Clear Log
:      In/Out |In %1: Stage code
:clearLog
  set "log=%~1"
  set /a maxlines=500
  set /a cutlines=maxlines*4/5
  if not exist "%log%" exit /b 0
  rem Count Lines
  for /f %%a in ('type "%log%" ^| find /v /c ""') do set "lines=%%a"
  if %lines% gtr %maxlines% (
    set "cmd=Clear"
    echo [Info] Logfile: %log% === Clear Log
    %pshell% -Command ^
      $ErrorActionPreference='Stop'; $p=$env:log; $keep=[int]$env:cutlines; ^
      $tmp = $p + '.tmp'; ^
      Get-Content -LiteralPath $p ^| Select-Object -Last $keep ^| Set-Content -LiteralPath $tmp -Encoding UTF8; ^
      Move-Item -Force -LiteralPath $tmp -Destination $p
  ) else (
    set "cmd=Keep"
    echo [Info] Logfile: "%log%" %lines% lines
  )
  call :logStartap startTime "Clear Log %cmd% %log% %lines% lines"
  exit /b 0
:end

: _____________________________________________________________________________
: Calculate elapsed time and log into file
:      In/Out |In %1: startTime, %2 logMsg
:logStartap
  if not exist "%path_main%" exit /b 0
  set "_st=%~1"
  set "msg=%~2"
  call :getDateTime current
  call set "st=%%%_st%%%"
  if not defined st set "st=%current%"
  set "type=---"
  if "%_st%"=="startTime" set "type=et"
  if "%_st%"=="lapTime"   set "type=lap"
  if "%_st%"=="dlTime"    set "type=dl"
  if not defined msg set "msg=Error Log Func Call: Missing time or msg - %st%"
  call :getTimeDiff "%st%" "%current%" diff
  set "rst=%msg%"
  :__msg_split_loop
  for /f "tokens=1,* delims=;" %%a in ("%rst%") do (
    set "seg=%%~a"
    set "rst=%%~b"
  )
  if not defined seg goto __msg_split_loop
  set "m=%current%%tab%%st%%tab%%type%%tab%%diff%%tab%%seg%"
  >> "%log_startap%" ( <nul set /p ="%m%" & echo( )
  if defined rst goto __msg_split_loop

  set "lapTime=%current%"
  exit /b 0
:end