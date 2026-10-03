@echo off
cd /d "%~dp0"
py -m pip install -r backend\requirements.txt
py -m uvicorn backend.api.main:app --reload --host 127.0.0.1 --port 8000
