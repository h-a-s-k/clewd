@echo off
pushd %~dp0

echo This will only work if you cloned the repo instead of downloading
echo and will reset your clewd settings
pause

if not exist .git\ (
  GOTO:notgit
)

where /q git.exe
if %ERRORLEVEL% EQU 0 (
  GOTO:pull
)
GOTO:missgit


:pull
call git pull --rebase --autostash
if %ERRORLEVEL% neq 0 (
  echo Error updating
)
GOTO:end

:missgit
echo Install git to update
GOTO:end

:notgit
echo Only able to update if you git clone the repository
GOTO:end


:end
pause
popd
exit /B