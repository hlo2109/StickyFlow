' StickyFlow Launcher Silencioso e Instantaneo
Set FSO = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
strPath = FSO.GetParentFolderName(WScript.ScriptFullName)

exePath = strPath & "\release\win-unpacked\StickyFlow.exe"

If FSO.FileExists(exePath) Then
    WshShell.Run """" & exePath & """", 1, False
Else
    WshShell.Run "cmd /c npm start", 0, False
End If

Set WshShell = Nothing
Set FSO = Nothing
