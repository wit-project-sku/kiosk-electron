@echo off

:: 현재 bat 파일이 있는 폴더 경로 추출
set SCRIPT_DIR=%~dp0

:: 1. 매일 새벽 2시 자동 재부팅 예약
schtasks /create /tn "AutoRestartAt2AM" /tr "shutdown /r /f /t 0" /sc daily /st 02:00 /f

:: 2. 재부팅 후 insa.exe 자동 실행 등록
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" ^
 /v "AutoRunHwaseong" ^
 /t REG_SZ ^
 /d "\"%SCRIPT_DIR%Hwaseong.exe\"" ^
 /f

:: 3. 재부팅 후 payment_agent_v1.exe 자동 실행 등록
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" ^
 /v "AutoRunPaymentAgent" ^
 /t REG_SZ ^
 /d "\"%SCRIPT_DIR%payment_agent.exe\"" ^
 /f

echo [완료] 매일 새벽 2시 재부팅 및 Hwaseong.exe, payment_agent_v1.exe 자동 실행 등록 완료.
pause
