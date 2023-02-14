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

: Wait Setting for Network Check in [sec]
set wait_netcheck_inst=10
set wait_netcheck_appl=1

call :defSetting
title Analysis Platform    Port: %port%  Lang: %lang%  %subtitle%  Path: %CD%
rem prompt AP:%port%$g

: _____________________________________________________________________________
: Check changed (folder + version updated)
:CHECK_STATUS
if not exist %file_status% echo: > %file_status%
call :getAppStatus %file_temp%
fc %file_temp% %file_status% > nul
if errorlevel 1 (
  set status=%status_install%
  set wait_netcheck=%wait_netcheck_inst%
  del %path_getpip%
  mode con: cols=120 lines=60
  powershell -command "&{$h=Get-Host;$w=$h.UI.RawUI;$s=$w.BufferSize;$s.height=5000;$w.BufferSize=$s;}"
  echo Start Installation [Need Network or Proxy Connection]
) else (
  set status=%status_run_app%
  set wait_netcheck=%wait_netcheck_appl%
  echo Start Analysis Platform
)
echo:

: Check Product Type
if exist %file_prod% (
  set prod=%product_dn%
  echo Detected Product Type: dn7
) else (
  set prod=%product_oss%
  echo Detected Product Type: oss
)
echo:

: _____________________________________________________________________________
: Check Network & Proxy
call :checkPort %port%
if %valid_port% == 0 exit /b

call :getDefaultProxy

call :checkProxy %prxy% http
if %valid_proxy% == 0 (
  exit /b
) else if %valid_proxy% == 2 (
  echo HTTP_PROXY   : %HTTP_PROXY%
)
set /a proxy=%valid_proxy%

call :checkProxy %prxs% https
if %valid_proxy% == 0 (
  exit /b
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
if %valid_proxy% == 1 Ping www.python.org -n 1 -w 1000 > nul
if errorlevel 1 (
  set network_nck=True
  set /a error=%error%+%ErrorLevel%
  echo %esc%[41m Warning: Check Network Connection %esc%[0m
  timeout %wait_netcheck%
) else (
  set network_nck=False
)

call :saveStartUpSetting
title Analysis Platform    Port: %port% [%proxy%]  Lang: %lang%  %subtitle%  Path: %CD%

rem for Debug
:exit /b
:set error=0
:goto FINISH
if %status% == %status_run_app% ^
if exist %path_python% if exist %path_getpip% if exist %path_oracle% (
  echo Installation seems to be completed.
  echo If you have some trouble launching AP, delete auto downloaded folders and try again.
  echo:
  goto START_APP
)

: _____________________________________________________________________________
: Download Components & Libraries
echo Download Components...
echo %esc%[44m First boot may take 5-30 minutes depending on network ^& CPU speed. %esc%[0m
timeout 5
echo:
:CHECK_EXIST
if not exist %path_R% if %prod% == %product_dn% (
  echo %esc%[41m Make sure you have R-Portable folder before running this application. %esc%[0m
  echo Or prepare R-Portable folder and reboot AP before using R function
  timeout 10
)
if exist %path_python% (echo Detect python) else goto PYTHON_EMBEDDED
if exist %path_getpip% (echo Detect getpip) else goto PIP_DOWNLOAD
if exist %path_oracle% (echo Detect oracle) else goto ORACLE_INSTANCE

: install packages
:: Get pip
..\python_embedded\python.exe ..\get-pip.py "pip < 22.3"
:: Upgrade pip
: ..\python_embedded\python.exe -m pip install --upgrade pip
if %prod% == %product_dn% (
  ..\python_embedded\Scripts\pip install --no-cache-dir --no-warn-script-location -r requirements\prod.txt
) else (
  ..\python_embedded\Scripts\pip install --no-cache-dir --no-warn-script-location -r requirements\oss_prod.txt
)
IF exist %path_R% (
  ..\R-Portable\bin\R CMD BATCH "r_install_packages.r"
)

echo:
echo Download components, libraries and installation is completed.
echo:

: _____________________________________________________________________________
: Run App: Analysis Platform
:START_APP
: log application status : Installation Completed
IF exist %file_temp% del %file_temp%
call :getAppStatus %file_status%

if %only_install% == 1 (
  echo Skip AP startup and end sequences. "only_install" option is enabled.
  :: Keep CMD stay when install check (control by %error%)
  set /a error=%error%+1
  GOTO FINISH
)
if [%1]==[SKIP_RUN_MAIN] GOTO FINISH

REM run application
ECHO Starting Up Analysis Platform ...
..\python_embedded\python.exe main.py
set /a error=%error%+%ErrorLevel%
echo:
echo:

rem start
: Close CMD.exe if no error
if %error% neq 0 echo Some Error Detected  %error%
:FINISH
rem echo %error%
if %error% equ 0 if not %only_install% == 1 (
  timeout 5
  exit
)
exit /b
:goto FINISH



: _____________________________________________________________________________
: Sub Program
: _____________________________________________________________________________

:PYTHON_EMBEDDED
echo Download python
curl "https://www.python.org/ftp/python/3.7.3/python-3.7.3-embed-amd64.zip" --output ..\python_embedded.zip
if errorlevel 1 (
  echo %esc%[41m Error on Curl  Check network connection or use latest Win10 ^>1803 %esc%[0m
  pause
)
echo Unzip python_embedded
powershell -Command "Expand-Archive -Path ..\python_embedded.zip -DestinationPath ..\python_embedded"
rename ..\python_embedded\python37._pth python37._pth.renamed
echo:
GOTO CHECK_EXIST

:PIP_DOWNLOAD
echo Download pip
curl "https://bootstrap.pypa.io/get-pip.py" --output ..\get-pip.py
if errorlevel 1 (
  echo %esc%[41m Error on Curl  Check network connection or use latest Win10 ^>1803 %esc%[0m
  pause
)
echo: > %file_status%
echo:
GOTO CHECK_EXIST

:ORACLE_INSTANCE
echo Download oracle instance
curl "https://download.oracle.com/otn_software/nt/instantclient/213000/instantclient-basic-windows.x64-21.3.0.0.0.zip" --output ..\Oracle-Portable.zip
if errorlevel 1 (
  echo %esc%[41m Error on Curl  Check network connection or use latest Win10 ^>1803 %esc%[0m
  pause
)
echo unzip oracle instance
powershell -Command "Expand-Archive -Path ..\Oracle-Portable.zip -DestinationPath ..\Oracle-Portable"
echo:
GOTO CHECK_EXIST


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
  cd> %filename%
  : AP Version Info (Version File Timestamp)
  for %%a in (%file_ver%) do echo %%~ta>> %filename%
  exit /b
:end
: _____________________________________________________________________________
: Subroutine: Definition, Setting and Cleaning
:      In/Out - |In -
:defSetting
  : Setting
  set file_status=__STATUS__
  set file_temp=__TEMP__
  set file_ver=VERSION
  :: Product Judge File dn or oss
  set file_prod=requirements\prod.txt
  set path_R=..\R-Portable
  set path_python=..\python_embedded
  set path_getpip=..\get-pip.py
  set path_oracle=..\Oracle-Portable

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
    exit /b
  ) else (
    set valid_port = 1
  )

  : chack Range
  if %var% geq 6000 if %var% lss 8000 if %var% neq 7070 set valid_port=2
  if %valid_port% neq 2 (
    echo %esc%[41m Warning Bad Port Number %esc%[0m
    echo Change Port Number from 6000 to 7999
    echo Current Value: %1
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
  if not exist %basic_config% set basic_config=histview2\config\basic_config.yml
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
  :: eheck format domain name
  call :convertCaseLower
  call :removeChar %chr_alphab%
  call :removeChar . -
  if %var% == : set /a valid_proxy=0x08
  :: judge
  if %valid_proxy% == 0 (
    echo %esc%[41m Warning Proxy Address/Domain Name %esc%[0m
    echo Modify %target_type% Proxy Address/Domain Name
    echo Current Value: %1  valid_proxy=%valid_proxy%
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
  echo - setting_app: !!omap>> %filename%
  echo   - env_ap: %prod%>> %filename%
  echo   - flask_debug: %flask_debug% >> %filename%
  echo   - update_R: %update_R% >> %filename%

endlocal
exit /b
:end