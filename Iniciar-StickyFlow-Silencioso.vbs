' Inicia StickyFlow sin ventana de consola (usa el Electron oficial de esta carpeta).
' Si falta algo (dependencias o interfaz compilada), abre Iniciar-StickyFlow.bat, que lo prepara.
Set FSO = CreateObject("Scripting.FileSystemObject")
Set Sh = CreateObject("WScript.Shell")
base = FSO.GetParentFolderName(WScript.ScriptFullName)
electron = base & "\node_modules\electron\dist\electron.exe"
Sh.CurrentDirectory = base
If FSO.FileExists(electron) And FSO.FileExists(base & "\dist\index.html") Then
  Sh.Run """" & electron & """ .", 1, False
Else
  Sh.Run """" & base & "\Iniciar-StickyFlow.bat""", 1, False
End If
