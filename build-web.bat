@echo off
echo Building POS Web Application...

echo Cleaning previous builds...
if exist dist rmdir /s /q dist
if exist dist-electron rmdir /s /q dist-electron

echo Installing dependencies...
call npm install

echo Building web application...
call npx vite build --config vite.config.web.ts

echo Preparing deployment files...
copy package.web.json dist\package.json
copy server-fly-fixed.js dist\server.js

echo.
echo Web build complete! Output in dist/ directory
echo To run locally: cd dist ^&^& npm install ^&^& npm start
pause