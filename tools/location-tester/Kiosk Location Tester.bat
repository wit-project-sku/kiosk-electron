@echo off
rem Double-click launcher for the Kiosk Location Tester GUI.
rem Testers: just double-click this file and pick a location.
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0KioskLocationTester.ps1"
