!macro customInstall
  ${IfNot} ${Silent}
    MessageBox MB_YESNO|MB_ICONQUESTION "¿Deseas que StickyFlow se inicie automáticamente al encender Windows?" IDNO skipAutoStart
      WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "StickyFlow" '"$appExe"'
    skipAutoStart:
  ${EndIf}
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "StickyFlow"
!macroend
