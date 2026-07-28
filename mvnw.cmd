@ECHO OFF
SETLOCAL
SET "WRAPPER_SCRIPT=%~dp0scripts\invoke-maven-wrapper.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%WRAPPER_SCRIPT%" %*
SET "WRAPPER_EXIT=%ERRORLEVEL%"
ENDLOCAL & EXIT /B %WRAPPER_EXIT%
