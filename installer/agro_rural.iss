; Instalador Windows — Agro Rural (emissor NF-e local)
; Compilar: ISCC.exe installer\agro_rural.iss
; (apos installer\build-windows.ps1 preparar stage)
; Com segredos: ISCC /DIncludeSecrets=1 ... (via build-windows.ps1 -IncludeSecrets)

#define MyAppName "Agro Rural"
#define MyAppNameUI "Agro Rural"
#define MyAppPublisher "Agro Rural Zortea"
#define MyAppVersion "1.0.0"
#define MyAppURL "https://agroruralzortea.com.br"
#define MyAdminURL "https://agroruralzortea.com.br/admin"

#ifndef IncludeSecrets
  #define IncludeSecrets 0
#endif

[Setup]
AppId={{B7E4D3F2-8A56-4E7B-9F32-6D1E2C0B8A44}
AppName={#MyAppNameUI}
AppVersion={#MyAppVersion}
AppVerName={#MyAppNameUI} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={localappdata}\{#MyAppPublisher}\{#MyAppName}
DefaultGroupName={#MyAppPublisher}\{#MyAppNameUI}
AllowNoIcons=yes
LicenseFile=
OutputDir=output
OutputBaseFilename=AgroRural-Setup-{#MyAppVersion}
Compression=lzma2/ultra
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=no
InfoBeforeFile=README-INSTALACAO.txt
UsePreviousAppDir=no
VersionInfoVersion={#MyAppVersion}.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppNameUI} Setup — emissor NF-e
VersionInfoProductName={#MyAppNameUI}
VersionInfoCopyright=Copyright (C) 2026 {#MyAppPublisher}

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Area de Trabalho para o Admin web"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "emissorshortcut"; Description: "Criar atalho para Iniciar emissor NF-e"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "installphp"; Description: "Instalar PHP do sistema via WinGet (opcional — o Setup ja traz PHP portatil)"; GroupDescription: "Emissor NF-e:"; Flags: unchecked
#if IncludeSecrets
Name: "bootstrapdb"; Description: "Configurar .env/Neon e testar banco do emissor"; GroupDescription: "Emissor NF-e (obrigatorio no PC):"; Flags: checkedonce
#else
Name: "bootstrapdb"; Description: "Configurar PHP + testar banco (requer .env ja presente)"; GroupDescription: "Emissor NF-e (obrigatorio no PC):"; Flags: checkedonce
#endif

[Files]
Source: "stage\emissor_nfe\*"; DestDir: "{app}\emissor_nfe"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "README-INSTALACAO.txt"; DestDir: "{app}"; Flags: ignoreversion isreadme

[Icons]
Name: "{group}\{#MyAppNameUI} — Admin"; Filename: "{#MyAdminURL}"
Name: "{group}\Iniciar emissor NF-e"; Filename: "{app}\emissor_nfe\scripts\start-local.bat"; WorkingDir: "{app}\emissor_nfe"
Name: "{group}\Abrir painel do emissor"; Filename: "{app}\emissor_nfe\scripts\open-painel.bat"; WorkingDir: "{app}\emissor_nfe"
Name: "{group}\Desinstalar {#MyAppNameUI}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppNameUI} — Admin"; Filename: "{#MyAdminURL}"; Tasks: desktopicon
Name: "{autodesktop}\Iniciar emissor NF-e"; Filename: "{app}\emissor_nfe\scripts\start-local.bat"; WorkingDir: "{app}\emissor_nfe"; Tasks: emissorshortcut

[Registry]
; Protocolo agro-emissor:// para o botao Iniciar/Configurar no admin web
Root: HKCU; Subkey: "Software\Classes\agro-emissor"; ValueType: string; ValueData: "URL:Agro Emissor Protocol"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\agro-emissor"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\agro-emissor\DefaultIcon"; ValueType: string; ValueData: "shell32.dll,13"
Root: HKCU; Subkey: "Software\Classes\agro-emissor\shell\open\command"; ValueType: string; ValueData: """{app}\emissor_nfe\scripts\protocol-handler.bat"" ""%1"""

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\emissor_nfe\scripts\ensure-php.ps1"""; StatusMsg: "Instalando/configurando PHP e extensoes..."; Tasks: installphp; Flags: waituntilterminated
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\emissor_nfe\scripts\post-install-bootstrap.ps1"" -EmissorRoot ""{app}\emissor_nfe"" -PassphraseFile ""{src}\DESBLOQUEIO.txt"""; StatusMsg: "Configurando .env/Neon do emissor (nao feche)..."; Tasks: bootstrapdb; Flags: waituntilterminated
Filename: "{#MyAdminURL}"; Description: "Abrir Admin Agro Rural"; Flags: nowait postinstall skipifsilent shellexec

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;
