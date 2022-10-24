@echo off
REM Running the batch file is regarded as you agreed to the Terms of Use.
REM Terms of Use: https://github.com/apdn7/AnalysisPlatform/about/terms_of_use_en.md

REM =========================================
REM PROXY SETTING (remove 'REM' and specify address of your proxy server)
REM set HTTP_PROXY=123.456.7.89:8080
REM set HTTPS_PROXY=123.456.7.89:8080
REM =========================================

REM check exist
:CHECK_EXIST
IF NOT EXIST "..\python_embedded" GOTO PYTHON_EMBEDDED
IF NOT EXIST "..\get-pip.py" GOTO PIP_DOWNLOAD
IF NOT EXIST "..\Oracle-Portable" GOTO ORACLE_INSTANCE

REM check changed (folder + version updated)
:CHECK_STATUS
IF NOT EXIST "__STATUS__" echo > __STATUS__
cd > __TEMP__
for %%a in (VERSION) do echo %%~ta >> __TEMP__
fc __TEMP__ __STATUS__ 1> nul
if %ErrorLevel% equ 0 (GOTO START_APP)

REM install packages
:UPGRADE_PIP
..\python_embedded\python.exe ..\get-pip.py "pip < 22.3"
REM ..\python_embedded\python.exe -m pip install --upgrade pip
..\python_embedded\Scripts\pip install --no-cache-dir --no-warn-script-location -r requirements\oss_prod.txt


if [%1]==[SKIP_RUN_MAIN] GOTO FINISH

:START_APP
REM log application status
IF EXIST "__TEMP__" DEL __TEMP__
cd > __STATUS__
for %%a in (VERSION) do echo %%~ta >> __STATUS__

REM run application
ECHO Starting Up Analysis Platform ...
set ANALYSIS_INTERFACE_ENV=prod
set FLASK_DEBUG=false
set UPDATE_R=0
set UNLOCK_DB=0
..\python_embedded\python.exe main.py

:FINISH
EXIT /b 0

:PYTHON_EMBEDDED
REM download
curl "https://www.python.org/ftp/python/3.7.3/python-3.7.3-embed-amd64.zip" --output ..\python_embedded.zip
REM unzip python_embedded
powershell -Command "Expand-Archive -Path ..\python_embedded.zip -DestinationPath ..\python_embedded"
rename ..\python_embedded\python37._pth python37._pth.renamed
GOTO CHECK_EXIST

:PIP_DOWNLOAD
REM download pip
curl "https://bootstrap.pypa.io/get-pip.py" --output ..\get-pip.py
echo > __STATUS__
GOTO CHECK_EXIST

:ORACLE_INSTANCE
REM download oracle instance
curl "https://download.oracle.com/otn_software/nt/instantclient/213000/instantclient-basic-windows.x64-21.3.0.0.0.zip" --output ..\Oracle-Portable.zip
REM unzip oracle instance
powershell -Command "Expand-Archive -Path ..\Oracle-Portable.zip -DestinationPath ..\Oracle-Portable"
GOTO CHECK_EXIST
