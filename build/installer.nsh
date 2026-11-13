; NSIS include — electron-builder runs these macros inside its own installer
; (nsis.include in electron-builder.yml). UTF-8 with BOM: NSIS reads a file
; without one in the system code page, and the shortcut name is Korean.
;
; ONE desktop shortcut, "WITH 키오스크 앱" (2026-11-12 — it replaced the app's own
; shortcut and the separate "키오스크 지점 설정" one). It starts the app with
; --setup, which opens the 지점 설정 window (shared/config/kioskSetup.ts): with the
; app off its 앱 실행 button starts the kiosk; over a running kiosk it opens on
; top. It sits on the Windows desktop, behind the fullscreen kiosk window, so
; staff at a keyboard or on TeamViewer use it and visitors cannot. Booting does
; not use it — the login auto-start launches the kiosk without --setup.
;
; electron-builder's own desktop shortcut is off (createDesktopShortcut: false).
; Auto-updates run this installer silently; an update does not delete the
; shortcuts an older version made, so both old names are removed here.

!if "${PRODUCT_NAME}" == "witworldwide-beta"
  !define KIOSK_APP_LNK "$DESKTOP\WITH 키오스크 앱 (베타).lnk"
  !define OLD_SETUP_LNK "$DESKTOP\키오스크 지점 설정 (베타).lnk"
!else
  !define KIOSK_APP_LNK "$DESKTOP\WITH 키오스크 앱.lnk"
  !define OLD_SETUP_LNK "$DESKTOP\키오스크 지점 설정.lnk"
!endif

!macro customInstall
  Delete "${OLD_SETUP_LNK}"
  Delete "$DESKTOP\${SHORTCUT_NAME}.lnk"
  CreateShortCut "${KIOSK_APP_LNK}" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--setup" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
!macroend

!macro customUnInstall
  Delete "${KIOSK_APP_LNK}"
!macroend
