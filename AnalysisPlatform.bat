@echo off
: _____________________________________________________________________________
:
:  Analysis Platform StartUp
: _____________________________________________________________________________
:  Important notice:
:    Running the batch file is regarded as you agreed to the Terms of Use.
:  Terms of Use:
:    https://github.com/apdn7/AnalysisPlatform/about/terms_of_use_en.md
: _____________________________________________________________________________

echo Start Main AP Sequence...
echo:
set startupDate=%date: =0%
set startupTime=%time: =0%
set startupTimeLogFile=startup_time_ap
: Wait Setting for Network Check in [sec]
set wait_netcheck_inst=10
set wait_netcheck_appl=1
set wait_netcheck=%wait_netcheck_appl%

call :defSetting
set app_title=Analysis Platform    Port: %port%  Lang: %lang%  %subtitle%  Path: %CD%
title %app_title%
rem prompt AP:%port%$g


: Check Product Type
if exist "%file_prod%" (
  set prod=%product_dn%
  echo Detected Product Type: dn7
) else (
  set prod=%product_oss%
  echo Detected Product Type: oss
)
echo:

set startAppTime=%time: =0%
: Run start program
: Close old start_ap.exe before run
call :stopLoadingApp
start "" "%start_file%" %port%
echo.
echo.> "%stage_status%"
IF EXIST "%stage_start_time%" (
    DEL "%stage_start_time%"
)
call :saveStartTimeOfStage MAIN


: Direct Startup Mode
if %startup_mode% == 8 (
  echo Direct Startup Mode === Force to bypass Installation ===
  set network_nck=True
  call :saveStartUpSetting
  call :logTimeDiff %startAppTime% %startupTimeLogFile% "Call start_ap.exe"
  goto :START_APP
) else (
  echo Normal Startup Mode === Check Network and Proxy ===
  call :logTimeDiff %startAppTime% %startupTimeLogFile% "Call start_ap.exe"
  set checkNetworkStartTime=%time: =0%
)

: _____________________________________________________________________________
call :checkDiskSpace
echo:
if %valid_free_space_check%==False (
    echo Free disk space is insufficient.
    echo Please ensure that there is at least %disk_space_pct_required%%% + 1GB of disk space available
    echo Terminating startup process...
    echo 100> %stage_status%
    timeout 5
    exit /b
)

: Check Network & Proxy
call :checkPort %port%
if %valid_port% == 0 (
  echo 101 > "%stage_status%"
  goto :FINISH
)

call :getDefaultProxy

call :checkProxy %prxy% http
if %valid_proxy% == 0 (
  echo 102 > "%stage_status%"
  goto :FINISH
) else if %valid_proxy% == 2 (
  echo HTTP_PROXY   : %HTTP_PROXY%
)
set /a proxy=%valid_proxy%

call :checkProxy %prxs% https
if %valid_proxy% == 0 (
  echo 102 > "%stage_status%"
  goto :FINISH
) else if %valid_proxy% == 2 (
  echo HTTPS_PROXY  : %HTTPS_PROXY%
)
echo:

:: Check Status by bit-OR of http | https
set /a "proxy = %proxy% | %valid_proxy%"
if %valid_proxy% == 1 (
  set proxy=No Proxy
) else if %valid_proxy% == 2 (
  set proxy=Use Proxy
) else (
  set proxy=Not Active
)
echo Proxy: %proxy%
echo:

: Check Network Connection at No Proxy
rem if %valid_proxy% == 1 Ping www.python.org -n 1 -w 1000 > nul
powershell -ExecutionPolicy Bypass -Command ^
    try { ^
        $response = Invoke-WebRequest -Uri https://bootstrap.pypa.io/get-pip.py -Method Head; ^
        Write-Host 'Network is available.'; ^
        Write-Host 'StatusCode:' $response.StatusCode ^
    } catch { exit 1 }
if errorlevel 1 (
  set network_nck=True
  set /a error=%error%+%ErrorLevel%
  echo %esc%[41m Warning: Check Network Connection %esc%[0m
  timeout %wait_netcheck%
) else (
  set network_nck=False
)
call :logTimeDiff %checkNetworkStartTime% %startupTimeLogFile% "Check Network"
set checkFolderStartTime=%time: =0%

: _____________________________________________________________________________
: Check changed (folder + version updated)
:CHECK_STATUS
if not exist "%file_status%" echo: > "%file_status%"
call :getAppStatus "%file_temp%"
fc "%file_temp%" "%file_status%" > nul
if errorlevel 1 (
  set status=%status_install%
  set wait_netcheck=%wait_netcheck_inst%
  if %network_nck% == False (
    del "%path_getpip%"
  )
  mode con: cols=120 lines=60
  powershell -ExecutionPolicy Bypass -Command "&{$h=Get-Host;$w=$h.UI.RawUI;$s=$w.BufferSize;$s.height=5000;$w.BufferSize=$s;}"
  echo Start Installation [Need Network or Proxy Connection]
) else (
  set status=%status_run_app%
  set wait_netcheck=%wait_netcheck_appl%
  echo Start Analysis Platform
)
echo:

call :saveStartUpSetting
title %app_title%

call :logTimeDiff %checkFolderStartTime% %startupTimeLogFile% "Check folder changes"
set checkInstallationStartTime=%time: =0%
: _____________________________________________________________________________
: Check Installation Status
if %status% == %status_run_app% ^
if exist "%path_python%" if exist "%path_getpip%" if exist "%path_oracle%" (
  echo Installation seems to be completed.
  echo If you have some trouble launching AP, delete auto downloaded folders and try again.
  echo:
  goto :REMOVE_ZIPPED_FILES
  echo:
  goto :START_APP
)
call :logTimeDiff %checkInstallationStartTime% %startupTimeLogFile% "Check installation status"

: _____________________________________________________________________________
: Download Components & Libraries
echo Download Components...
echo %esc%[44m First boot may take 5-30 minutes depending on network ^& CPU speed. %esc%[0m
timeout 5
echo:
:CHECK_EXIST
if not exist "%path_R%" if %prod% == %product_dn% (
  echo %esc%[41m Make sure you have R-Portable folder before running this application. %esc%[0m
  echo Or prepare R-Portable folder and reboot AP before using R function
  echo 999 > "%stage_status%"
  set /a error=%error%+1
  goto :FINISH
)

if exist "%path_python%" (echo Detect python) else call :downloadPythonEmbedded
if %errorlevel% neq 0 goto :FINISH
if exist "%path_getpip%" (echo Detect getpip) else call :downloadPip
if %errorlevel% neq 0 goto :FINISH
if exist "%path_oracle%" (echo Detect oracle) else call :downloadOracleInstance
if %errorlevel% neq 0 goto :FINISH

: install packages
:: Get pip
"%path_python%\python.exe" "%path_getpip%" --no-cache-dir --no-warn-script-location "pip < 22.3"

: -----------------------------------------------------------------------------
:ACTIVE_PYTHON_ENVIRONMENT
set setupEnvStartTime=%time: =0%
:: Active virtual environment
IF NOT EXIST "%env_path%" (
  ECHO Installing Virtualenv
  "%path_python%\python" -m pip install --no-cache-dir --no-warn-script-location virtualenv
)
ECHO Initializing Virtual Environment
"%path_python%\python" -m virtualenv "%env_path%"
ECHO Activate virtual environment

:: copy complied sqlite3.dll to env Scripts folder
powershell -ExecutionPolicy Bypass -Command if (Test-Path -Path \"$env:sqlite_dll\") { Copy-Item \"$env:sqlite_dll\" -Destination \"$env:env_path\Scripts\" }

:: copy complied sqlite3.dll to python embedded Scripts folder
powershell -ExecutionPolicy Bypass -Command if (Test-Path -Path \"$env:sqlite_dll\") { Copy-Item \"$env:sqlite_dll\" -Destination \"$env:path_python\" }

call :saveStartTimeOfStage PIP_INSTALL
CALL "%env_path%\Scripts\activate" & GOTO INSTALL_PYTHON_AND_R_PACKAGES
: -----------------------------------------------------------------------------

:INSTALL_PYTHON_AND_R_PACKAGES
:: Set default python & components path to PATH environment
set is_venv_activated=1
set PATH=%lib_path%
echo PATH=%PATH%
echo:
echo:

:: Upgrade pip
: %path_python%\python.exe -m pip install --upgrade pip
if %prod% == %product_dn% (
  pip install --no-cache-dir --no-warn-script-location -r "%file_prod%"
) else (
  pip install --no-cache-dir --no-warn-script-location -r "%file_oss_prod%"
)
if exist "%path_R%" if %prod% == %product_dn% "%path_R%\bin\R" CMD BATCH "r_install_packages.r"

if exist "%ca_cert%" call :removeCACert

echo:
echo Download components, libraries and installation is completed.
echo:
call :logTimeDiff %setupEnvStartTime% %startupTimeLogFile% "Installing packages"
set step6StartTime=%time: =0%

: -----------------------------------------------------------------------------
: Remove Oracle and python_embedded after install application
:REMOVE_ZIPPED_FILES
IF exist "%path_oracle_zip%" del "%path_oracle_zip%"
IF exist "%path_python_zip%" del "%path_python_zip%"
echo:
echo Removed Oracle and Python embedded zipped files.
echo:

: _____________________________________________________________________________
: Run App: Analysis Platform
:START_APP
: log application status : Installation Completed
set startPythonAppTime=%time: =0%
IF exist "%file_temp%" del "%file_temp%"
call :getAppStatus "%file_status%"

if %only_install% == 1 (
  echo Skip AP startup and end sequences. "only_install" option is enabled.
  :: Keep CMD stay when install check (control by %error%)
  set /a error=%error%+1
  goto :FINISH
)
if [%1]==[SKIP_RUN_MAIN] goto :FINISH

IF %is_venv_activated% == 0 (
  GOTO :ACTIVE_PYTHON_ENVIRONMENT
  ECHO Activate virtual environment
  CALL "%env_path%\Scripts\activate" & GOTO :SET_PATH
)
call :logTimeDiff %startPythonAppTime% %startupTimeLogFile% "Start AP"
: -----------------------------------------------------------------------------
:SET_PATH
:: Set default python & components path to PATH environment
set is_venv_activated=1
set PATH=%lib_path%
echo PATH=%PATH%
echo:
echo:

:: If the app is already installed, it can be launched without network
if %network_nck% == True (
    set /a error=%error%-1
)

if %errorlevel% neq 0 (
  : stop program if error
  goto :FINISH
) else (
  :: stop start_ap.exe before run APDN7
  call :stopLoadingApp
)

: ensure to assign the app title
title %app_title%
call :logTimeDiff %step6StartTime% %startupTimeLogFile% "Set Path"

REM run application
call :logTimeDiff %startupTime% %startupTimeLogFile% "Total"
ECHO Starting Up Analysis Platform ...
python.exe main.py
set /a error=%error%+%ErrorLevel%
echo:
echo:

: Close CMD.exe if no error
:FINISH
call :stopLoadingApp
if %error% equ 0 if not %only_install% == 1 (
  @REM In case of NO ERROR, terminal window will be closed automatically in 5 seconds.
  timeout 5
  @REM :: find current running cmd and stop it through title
  title STOPPING...
  powershell -ExecutionPolicy Bypass -Command Get-Process ^| Where-Object { $_.Path -like \"*cmd.exe\" -and $_.MainWindowTitle -like \"STOPPING...*\" } ^| ForEach-Object { Stop-Process -Id $_.Id -Force }
) else (
  @REM In case error occur, terminal window is not closed and show error to user know that.
  exit /b 0
)


: _____________________________________________________________________________
: Sub Program
: _____________________________________________________________________________

: _____________________________________________________________________________
: Subroutine: Download CA Certificate
:      In/Out - |In -
:downloadCACert
  powershell -ExecutionPolicy Bypass -Command wget %ca_cert_url% -O \"%ca_cert%\"
  echo "%ca_cert%" file is downloaded.
  exit /b
:end

: _____________________________________________________________________________
: Subroutine: Remove CA Certificate
:      In/Out - |In -
:removeCACert
  del "%ca_cert%"
  echo "%ca_cert%" file is removed.
  exit /b
:end

: _____________________________________________________________________________
: Subroutine: Download Python Embedded
:      In/Out - |In -
:downloadPythonEmbedded
  echo Download python
  for /f "delims=" %%a in ('powershell get-date -format "{yyyy/MM/dd HH:mm:ss.fff}"') do @set "python_embedded_start_time=%%a"
  powershell -ExecutionPolicy Bypass -Command ""Add-Content -Path \"%stage_start_time%\" -Value \"$pid-PYTHON_EMBEDDED-$env:python_embedded_start_time\"; wget %python39_url% -O \"%path_python_zip%\";"
  if %errorlevel% == 35 (
    REM In case CA cert in local machine is expired or disabled --- download CA cert to authenticate
    if exist "%ca_cert%" (echo Detect ca_cert) else call :downloadCACert
    powershell -ExecutionPolicy Bypass -Command wget -Certificate \"%ca_cert%\" -Uri %python39_url% -O \"%path_python_zip%\"
  )
  if %errorlevel% neq 0 (
    echo %esc%[41m Error on Wget Check network connection or use latest Win10 ^>1803 %esc%[0m
    echo 200 > "%stage_status%"
    set /a error=%error%+1
    exit /b %error%
  )

  echo Unzip python_embedded
  powershell -ExecutionPolicy Bypass -Command Expand-Archive -Path \"%path_python_zip%\" -DestinationPath \"%path_python%\"
  rename "%path_python%\python39._pth" python39._pth.renamed
  exit /b
:end

: _____________________________________________________________________________
: Subroutine: Download Python Pip Component
:      In/Out - |In -
:downloadPip
  for /f "delims=" %%a in ('powershell get-date -format "{yyyy/MM/dd HH:mm:ss.fff}"') do @set "pip_download_start_time=%%a"
  echo Download pip
  powershell -ExecutionPolicy Bypass -Command "Add-Content -Path \"%stage_start_time%\" -Value \"$pid-PIP_DOWNLOAD-$env:pip_download_start_time\"; wget %get_pip_url% -O \"%path_getpip%\";"
  if %errorlevel% == 35 (
    REM In case CA cert in local machine is expired or disabled --- download CA cert to authenticate
    if exist "%ca_cert%" (echo Detect ca_cert) else call :downloadCACert
    powershell -ExecutionPolicy Bypass -Command wget -Certificate \"%ca_cert%\" -Uri %get_pip_url% -O \"%path_getpip%\"
  )
  if %errorlevel% neq 0 (
    echo %esc%[41m Error on Curl  Check network connection or use latest Win10 ^>1803 %esc%[0m
    echo 201 > "%stage_status%"
    set /a error=%error%+1
    exit /b %error%
  )

  exit /b
:end

: _____________________________________________________________________________
: Subroutine: Download Oracle Instance
:      In/Out - |In -
:downloadOracleInstance
  echo Download oracle instance
  for /f "delims=" %%a in ('powershell get-date -format "{yyyy/MM/dd HH:mm:ss.fff}"') do @set "oracle_instance_start_time=%%a"
  powershell -ExecutionPolicy Bypass -Command "Add-Content -Path \"%stage_start_time%\" -Value \"$pid-ORACLE_INSTANCE-$env:oracle_instance_start_time\"; wget %oracle_instance_url% -O \"%path_oracle_zip%\";"
  if %errorlevel% == 35 (
    REM In case CA cert in local machine is expired or disabled --- download CA cert to authenticate
    if exist "%ca_cert%" (echo Detect ca_cert) else call :downloadCACert
    powershell -ExecutionPolicy Bypass -Command "Add-Content -Path \"%stage_start_time%\" -Value \"$pid-ORACLE_INSTANCE-$env:oracle_instance_start_time\"; wget -Certificate \"%ca_cert%\" -Uri %oracle_instance_url% -O \"%path_oracle_zip%\";"
  )
  if %errorlevel% neq 0 (
    echo %esc%[41m Error on Wget Check network connection or use latest Win10 ^>1803 %esc%[0m
    echo 210 > "%stage_status%"
    set /a error=%error%+1
    exit /b %error%
  )

  echo Unzip oracle instance
  powershell -ExecutionPolicy Bypass -Command Expand-Archive -Path \"%path_oracle_zip%\" -DestinationPath \"%path_oracle%\"
  exit /b
:end

: _____________________________________________________________________________
: Subroutine: function removeChar
:      In/Out var|In  %*: Array of Replacement Char
:removeChar
  for %%i in (%*) do call set var=%%var:%%i=%%
  exit /b
:end

: _____________________________________________________________________________
: Subroutine: function convertCaseLower
:      In/Out var
:convertCaseLower
  for %%i in (%chr_alphab%) do call set var=%%var:%%i=%%i%%
  exit /b
:end

: _____________________________________________________________________________
: Subroutine: function getAppStatus
:      In/Out - |In %1: Target File
:getAppStatus
  set filename=%1
  : Path Info
  cd> "%filename%"
  : AP Version Info (Version File Timestamp)
  for %%a in ("%file_ver%") do echo %%~ta>> "%filename%"
  exit /b
:end

: _____________________________________________________________________________
: Subroutine: Definition, Setting and Cleaning
:      In/Out - |In -
:defSetting
  : Setting
  set file_status=%cd%\__STATUS__
  set file_temp=%cd%\__TEMP__
  set file_ver=%cd%\VERSION
  :: Product Judge File dn or oss
  set file_prod=%cd%\requirements\prod.txt
  set file_oss_prod=%cd%\requirements\oss_prod.txt
  set path_R=%cd%\..\R-Portable
  set ca_cert=%cd%\..\cacert.pem
  set path_python=%cd%\..\python_embedded_39
  :: Override PYTHONPATH with empty for cmd session only
  set PYTHONPATH=
  set env_path=%cd%\..\env
  set sqlite_dll=%cd%\init\sqlite3.dll
  set path_getpip=%cd%\..\get-pip.py
  set path_oracle=%cd%\..\Oracle-Portable
  set path_python_zip=%cd%\..\python_embedded_39.zip
  set path_oracle_zip=%cd%\..\Oracle-Portable.zip
  set lib_path=%path_oracle%\instantclient_21_3;%env_path%\Scripts;%env_path%\Lib;%SystemRoot%\System32;%SystemRoot%\System32\WindowsPowerShell\v1.0\;
  :: Startup Error log file
  set stage_status=%cd%\stage_status.log
  set stage_start_time=%cd%\stage_start_time.log
  set is_venv_activated=0
  set start_file=%cd%\start_ap.exe
  :: Disk space required to run AP
  set disk_space_pct_required=10

  : links
  set ca_cert_url="https://curl.se/ca/cacert-2023-08-22.pem"
  set python39_url="https://www.python.org/ftp/python/3.9.0/python-3.9.0-embed-amd64.zip"
  set get_pip_url="https://bootstrap.pypa.io/get-pip.py"
  set oracle_instance_url="https://download.oracle.com/otn_software/nt/instantclient/213000/instantclient-basic-windows.x64-21.3.0.0.0.zip"

  : Definition
  set error=0
  set status_install=0
  set status_run_app=1
  set product_dn=prod
  set product_oss=oss
  set chr_number=0 1 2 3 4 5 6 7 8 9
  set chr_alphab=a b c d e f g h i j k l m n o p q r s t u v w x y z
  :: Get Escape $e 0x1b 27
  for /f %%i in ('cmd /k prompt $e^<nul') do set esc=%%i

  : Settings from start batch
  :: Remove all '"'
  set port=%port:"=%
  set lang=%lang:"=%
  set prxy=%prxy:"=%
  set prxs=%prxs:"=%
  set subt=%subt:"=%
  :: Remove all ' '
  set port=%port: =%
  set lang=%lang: =%
  set prxy=%prxy: =%
  set prxs=%prxs: =%
  set subt=%subt: =_%

  if %subt% == null (set subtitle=-) else (set subtitle=[%subt%])

exit /b
:end

: _____________________________________________________________________________
: Subroutine: Check Port Setting
:      In/Out valid_port|In %1: port
:checkPort
  set var=%1
  set valid_port=0
  : check Integer
  call set /a var=%var%
  if errorlevel 1 (
    echo %esc%[41m Warning: Bad Port Number %esc%[0m
    echo Only integers are allowed for port number
    echo Current Value: %1
    echo 101 > "%stage_status%"
    exit /b
  ) else (
    set valid_port = 1
  )

  : check Range
  if %var% geq 6000 if %var% lss 8000 if %var% neq 7070 set valid_port=2
  if %valid_port% neq 2 (
    echo %esc%[41m Warning Bad Port Number %esc%[0m
    echo Change Port Number from 6000 to 7999
    echo Current Value: %1
    echo 101 > "%stage_status%"
    exit /b
  )
exit /b
:end

: _____________________________________________________________________________
: Subroutine: get Default Proxy Setting
:      In/Out - |In -
:getDefaultProxy
  : get Default Proxy Setting
  set basic_ver=null
  set basic_port=null
  set basic_proxy=null
  set basic_config=ap\config\basic_config.yml
  if not exist %basic_config% set basic_config=ap\config\basic_config.yml
  for /F "tokens=2,3,4 delims=: " %%i in (%basic_config%) do (
    if %%i==version set basic_ver=%%j
    if %%i==port-no set basic_port=%%j
    if %%i==proxy   set basic_proxy=%%j:%%k
    :: It gets more complicated dealing with nesting arrays, so leave the for loop at the next level or after reading the variable.
    if %%i==proxy goto :break_for_ini
  )
  :break_for_ini

  echo Basic Config
  echo   Ver  : %basic_ver%
  echo   Port : %basic_port%
  echo   Proxy: %basic_proxy%

  if not %basic_proxy%==null if not %basic_proxy%==: if %prxy%==null (
    echo Use Default Proxy of %basic_proxy%
    set prxy=%basic_proxy%
    set prxs=%basic_proxy%
  )

  echo Target Proxy
  echo   Proxy http : %prxy%
  echo   Proxy https: %prxs%
  echo:
exit /b
:end

: _____________________________________________________________________________
: Subroutine: Check Proxy Setting
:      In/Out valid_proxy|In %1: Proxy Info  %2: Type http(s)
:checkProxy
  set var=%1
  set valid_proxy=0
  if %2 == http (
    set target_type=http
    set target_proxy=HTTP_PROXY
  ) else (
    set target_type=https
    set target_proxy=HTTPS_PROXY
  )
  rem echo var
  : Check Format
  :: no or null: Do nothing
  if %var% == no   set /a valid_proxy=0x01
  if %var% == null set /a valid_proxy=0x01
  if %valid_proxy% == 1 exit /b
  :: check format ip
  call :removeChar %chr_number%
  if %var% == ...: set /a valid_proxy=0x04
  :: check format domain name
  call :convertCaseLower
  call :removeChar %chr_alphab%
  call :removeChar . -
  if %var% == : set /a valid_proxy=0x08
  :: judge
  if %valid_proxy% == 0 (
    echo %esc%[41m Warning Proxy Address/Domain Name %esc%[0m
    echo Modify %target_type% Proxy Address/Domain Name
    echo Current Value: %1  valid_proxy=%valid_proxy%
    echo 102 > "%stage_status%"
    exit /b
  )

  : Check Proxy Existence
  for /f "tokens=1 delims=:" %%a in ("%1") do set ip=%%a
  Ping %ip% -n 1 -w 1000 > nul
  if errorlevel 1  (
    echo %esc%[41m Warning: %target_proxy% is not active %esc%[0m
    echo Current Value: %1  valid_proxy=%valid_proxy%
    timeout %wait_netcheck%
  ) else (
    rem Proxy Passed
    set %target_proxy%=%1
    set /a valid_proxy=0x02
  )
exit /b
:end

: _____________________________________________________________________________
: Subroutine: Save Settings
:      In/Out - |In -
:saveStartUpSetting
setlocal
  set var=%network_nck%
  call :convertCaseLower

   : Make yaml file
  set filename=startup.yaml
  echo !!omap> %filename%
  echo # Analysis Platform StartUp Batch File Setting>> %filename%
  echo - version_yaml: 1.0 >> %filename%
  echo - setting_startup: !!omap>> %filename%
  echo   - port: %port% >> %filename%
  echo   - language: %lang% >> %filename%
  echo   - subtitle: %subt% >> %filename%
  echo   - proxy_http: %prxy% >> %filename%
  echo   - proxy_https: %prxs% >> %filename%
  echo   - network_nck: %var% >> %filename%
  echo   - env_ap: %prod%>> %filename%
  echo   - flask_debug: %flask_debug% >> %filename%
  echo   - update_R: %update_R% >> %filename%
  echo   - enable_file_log: %enable_file_log% >> %filename%
  echo   - enable_ga_tracking: %enable_ga_tracking% >> %filename%

endlocal
exit /b
:end

: _____________________________________________________________________________
: Subroutine: Stop Loading App
:      In/Out - |In -
:stopLoadingApp
  powershell -ExecutionPolicy Bypass -Command Get-Process -ErrorAction SilentlyContinue ^| Where-Object { $_.Path -eq \"$env:start_file\" } ^| ForEach-Object { Stop-Process -Id $_.Id -Force }
  exit /b
:end

: _____________________________________________________________________________
: Calculate elapsed time and log into file
:      In/Out |In %1: startTime, %2 logFileName, %3 logMsg
:logTimeDiff
setlocal EnableDelayedExpansion
  set startTime=%1
  set logFileName=%2
  set logMsg=%3
  set "endTime=%time: =0%"
  rem Get elapsed time:
  set "end=!endTime:%time:~8,1%=%%100)*100+1!" & set "start=!startTime:%time:~8,1%=%%100)*100+1!"
  set /A "elap=((((10!end:%time:~2,1%=%%100)*60+1!%%100)-((((10!start:%time:~2,1%=%%100)*60+1!%%100), elap-=(elap>>31)*24*60*60*100"

  rem Convert elapsed time to HH:MM:SS:CC format:
  set /A "cc=elap%%100+100,elap/=100,ss=elap%%60+100,elap/=60,mm=elap%%60+100,hh=elap/60+100"

  For /f "tokens=1-3 delims=/ " %%a in ("%startupDate%") do (set startupdatelabel=%%a%%b%%c)
  rem Get the current time with hours, minutes, seconds
  for /f "tokens=1-3 delims=:. " %%a in ("%startupTime%") do (
    set hour=%%a
    set min=%%b
    set sec=%%c
  )
  set startuptimelabel=%hour%%min%%sec%
  rem Write startup time into log file
  echo %logMsg%:  %hh:~1%%time:~2,1%%mm:~1%%time:~2,1%%ss:~1%%time:~8,1%%cc:~1% >> "log/%logFileName%_%startupdatelabel%_%startuptimelabel%.log"
endlocal
exit /b
:end

: _____________________________________________________________________________
: Subroutine: Save start time of
:      In/Out |In %1: Stage code
:checkDiskSpace
@echo off
setlocal EnableDelayedExpansion
    :: Get the drive letter of the current directory
    set "CurrentDrive=%CD:~0,1%"
    :: Get the free and total disk space for the current drive
    echo === Checking free space of the current drive ===
    for /f %%F in ('powershell -command "(Get-PSDrive %CurrentDrive%).Free"') do set "FreeSpace=%Blank%%%F"
    for /f %%S in ('powershell -command "(Get-PSDrive %CurrentDrive%).Used + (Get-PSDrive %CurrentDrive%).Free"') do set "TotalSpace=%Blank%%%S"
    for /f %%F in ('powershell -Command "[math]::Floor((%FreeSpace% / 1GB))"') do set FreeSpaceGB=%%F
    for /f %%T in ('powershell -Command "[math]::Floor((%TotalSpace% / 1GB))"') do set TotalSpaceGB=%%T
    @rem Check if we have managed to obtain disk space
    set /A testFreeSpace=!FreeSpaceGB! 2>nul
    set /A testTotalSpace=!TotalSpaceGB! 2>nul
    set disk_space_obtained=True
    if "!testFreeSpace!"=="" set disk_space_obtained=False
    if "!testTotalSpace!"=="" set disk_space_obtained=False
    set sufficient_space=True
    if %disk_space_obtained%==False (
        @rem If we could not get disk space somehow, still allow the user to run the program
        echo Could not obtain the amount of remaining and total disk space. Skipping disk check...
    ) else (
        @rem If we managed to obtain disk space, continue with the check
        echo Managed to obtain disk space
        for /f %%P in ('powershell -Command "[math]::Floor(%FreeSpaceGB% * 100 / %TotalSpaceGB%)"') do set PercentFree=%%P
        for /f %%R in ('powershell -Command "[math]::Floor(%TotalSpaceGB% * %disk_space_pct_required% / 100 + 1)"') do set RequiredFreeSpaceGB=%%R
        echo Required Free Space: !RequiredFreeSpaceGB!
        echo Free Disk Space Percentage: !PercentFree!%%
        if !FreeSpaceGB! lss !RequiredFreeSpaceGB! set sufficient_space=False
    )
endlocal & set valid_free_space_check=%sufficient_space%
exit /b
:end

: _____________________________________________________________________________
: Subroutine: Save start time of
:      In/Out |In %1: Stage code
:saveStartTimeOfStage
setlocal
  set stage_name=%1
  for /f "usebackq tokens=2" %%a in (`tasklist /FO list /FI "WINDOWTITLE eq %app_title%*" ^| find /i "PID:"`) do (
      set self_pid=%%a
  )
  for /f "delims=" %%a in ('powershell get-date -format "{yyyy/MM/dd HH:mm:ss.fff}"') do @set "start_time=%%a"
  powershell -ExecutionPolicy Bypass -Command Add-Content -Path \"%stage_start_time%\" -Value \"$env:self_pid-$env:stage_name-$env:start_time\"
endlocal
exit /b
:end
