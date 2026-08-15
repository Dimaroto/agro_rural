' Inicia o emissor Laravel sem janela de console.
' Usado pelo autostart do Windows e pelo app Mecânica Bedendo.
' Define MECANICA_EMISSOR_HIDDEN=1 para o .bat nao bloquear em pause
' e gravar erros em %LOCALAPPDATA%\Edem Software\Mecanica Bedendo\logs\
Option Explicit
Dim sh, fso, scriptDir, bat, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
bat = scriptDir & "\start-local.bat"
If fso.FileExists(bat) Then
  cmd = "cmd.exe /c set MECANICA_EMISSOR_HIDDEN=1&& """ & bat & """"
  sh.Run cmd, 0, False
End If
