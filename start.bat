pushd %~dp0
call npm install --no-audit
node clewd.js
pause
popd
