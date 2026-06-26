@echo off

:: 1. 예약된 재시작 작업 제거
schtasks /delete /tn "AutoRestartAt2AM" /f

:: 2. insa.exe 자동 실행 제거
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" ^
 /v "AutoRunHwaseong" ^
 /f

:: 3. payment_agent_v1.exe 자동 실행 제거
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" ^
 /v "AutoRunPaymentAgent" ^
 /f

echo [완료] 모든 설정 제거 완료.
pause
