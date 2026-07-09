@echo off
:: ════════════════════════════════════════════════════════════════════════
::  오색시장(W004) 키오스크 전원 스케줄  —  08:00 시작 / 22:00 종료
::  (Hwaseong 용 SetAutoShutdown.bat 의 오색 전용 버전. 오색에만 적용.)
:: ════════════════════════════════════════════════════════════════════════

:: 현재 bat 파일이 있는 폴더 경로
set SCRIPT_DIR=%~dp0

:: 0. 기존 새벽 2시 재부팅 작업 제거 (오색은 운영시간 전원 사이클을 대신 사용)
schtasks /delete /tn "AutoRestartAt2AM" /f 2>nul

:: 1. 매일 밤 10시(22:00) 자동 종료(shutdown)
schtasks /create /tn "KioskShutdownAt10PM" /tr "shutdown /s /f /t 0" /sc daily /st 22:00 /f

:: 2. 매일 아침 8시(08:00) 자동 시작
::    - 절전/최대절전 상태면 이 작업이 컴퓨터를 깨워(WakeToRun) 앱을 실행함
::    - 완전 종료(전원 OFF/S5) 상태에서의 08:00 전원 ON 은 OS/스크립트로 불가능하므로
::      메인보드 BIOS 의 "Power On by RTC Alarm" 을 08:00 로 설정해야 함
powershell -NoProfile -ExecutionPolicy Bypass -Command "$a=New-ScheduledTaskAction -Execute '%SCRIPT_DIR%Osaek.exe'; $t=New-ScheduledTaskTrigger -Daily -At '08:00'; $s=New-ScheduledTaskSettingsSet -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable; Register-ScheduledTask -TaskName 'KioskStartAt8AM' -Action $a -Trigger $t -Settings $s -RunLevel Highest -Force"

:: 3. 절전 타이머 허용 (WakeToRun 이 동작하는 조건) — AC 전원에서 대기모드 무제한
powercfg -change -standby-timeout-ac 0

:: 4. 부팅 후 Osaek.exe 자동 실행 등록
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" ^
 /v "AutoRunOsaek" ^
 /t REG_SZ ^
 /d "\"%SCRIPT_DIR%Osaek.exe\"" ^
 /f

:: 5. 부팅 후 payment_agent 자동 실행 등록 (오색 = 카드 단말기 있음)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" ^
 /v "AutoRunPaymentAgent" ^
 /t REG_SZ ^
 /d "\"%SCRIPT_DIR%payment_agent.exe\"" ^
 /f

echo [완료] 오색시장 키오스크 08:00 시작 / 22:00 종료 스케줄 등록 완료.
echo         * 완전 종료 후 자동 전원 ON 은 BIOS RTC Alarm 08:00 설정이 필요합니다.
pause
