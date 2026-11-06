; NSIS include — electron-builder runs these macros inside its own installer
; (nsis.include in electron-builder.yml). UTF-8 with BOM: NSIS reads a file
; without one in the system code page, and the shortcut name is Korean.
;
; Desktop shortcut "키오스크 지점 설정": starts the app with --setup, which opens
; the 지점 설정 screen (shared/config/kioskSetup.ts) — over the running kiosk if
; it is already up. It sits on the Windows desktop, behind the fullscreen kiosk
; window, so staff at a keyboard or on TeamViewer use it and visitors cannot.
;
; Auto-updates run this installer silently, so existing kiosks get the shortcut
; on their next update; the old version's uninstall (which runs first) removes
; it and the install puts it back.

!if "${PRODUCT_NAME}" == "witworldwide-beta"
  !define KIOSK_SETUP_LNK "$DESKTOP\키오스크 지점 설정 (베타).lnk"
!else
  !define KIOSK_SETUP_LNK "$DESKTOP\키오스크 지점 설정.lnk"
!endif

!macro customInstall
  CreateShortCut "${KIOSK_SETUP_LNK}" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--setup" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
!macroend

!macro customUnInstall
  Delete "${KIOSK_SETUP_LNK}"
!macroend
