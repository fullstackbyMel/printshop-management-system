@echo off
cd /d D:\Coding\project\printshop-tracker\backend
call venv\Scripts\activate
waitress-serve --listen=0.0.0.0:8000 config.wsgi:application