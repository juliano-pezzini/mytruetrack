@echo off
REM Start Chrome with remote debugging for chrome-devtools-mcp.
REM Close ALL Chrome windows first, then run this script.
REM Sign into Google once in this window, then reload the MCP in Cursor.

set "PROFILE=%USERPROFILE%\.cache\chrome-devtools-mcp\chrome-profile-debug"
set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

if not exist "%CHROME%" set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"

echo Starting Chrome with remote debugging on port 9222...
echo Profile: %PROFILE%
start "" "%CHROME%" --remote-debugging-port=9222 --user-data-dir="%PROFILE%" "http://localhost:5173/"
