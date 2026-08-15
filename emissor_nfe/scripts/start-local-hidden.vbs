' Inicia o emissor Laravel sem janela de console.
' Usado pelo autostart e pelo protocolo agro-emissor:// (admin web).
' Define AGRO_EMISSOR_HIDDEN=1 para o .bat nao bloquear em pause
' e gravar erros em %LOCALAPPDATA%\Agro Rural Zortea\emissor\logs\
Option Explicit
Dim sh, fso, scriptDir, bat, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
bat = scriptDir & "\start-local.bat"
If fso.FileExists(bat) Then
  cmd = "cmd.exe /c set AGRO_EMISSOR_HIDDEN=1&& """ & bat & """"
  sh.Run cmd, 0, False
End If
