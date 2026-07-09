@echo off
:: ════════════════════════════════════════════════════════════════════════
::  오색시장(W004) 키오스크 전원 스케줄 제거 (SetAutoShutdown_Osaek.bat 되돌리기)
:: ════════════════════════════════════════════════════════════════════════

:: 1. 종료(22:00) / 시작(08:00) 예약 작업 제거
schtasks /delete /tn "KioskShutdownAt10PM" /f 2>nul
schtasks /delete /tn "KioskStartAt8AM" /f 2>nul

:: 2. Osaek.exe 자동 실행 제거
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" ^
 /v "AutoRunOsaek" ^
 /f 2>nul

:: 3. payment_agent 자동 실행 제거
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" ^
 /v "AutoRunPaymentAgent" ^
 /f 2>nul

echo [완료] 오색시장 전원 스케줄 제거 완료.
pause
