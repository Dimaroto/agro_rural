; Instalador Windows — Agro Rural (Edem Software)
; Compilar: ISCC.exe installer\agro_rural.iss
; (apos installer\build-windows.ps1 preparar stage)
; Com segredos: ISCC /DIncludeSecrets=1 ... (via build-windows.ps1 -IncludeSecrets)

#define MyAppName "Agro Rural"
#define MyAppNameUI "Agro Rural"
#define MyAppPublisher "Edem Software"
#define MyAppVersion "1.1.6"
#define MyAppExeName "AgroRural.exe"
#define MyAppURL "https://agroruralzortea.com.br"

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
; Pasta por usuario (LocalAppData) — mesmo padrao Mecanica Bedendo
DefaultDirName={localappdata}\Agro Rural Zortea\{#MyAppName}
DefaultGroupName={#MyAppPublisher}\{#MyAppNameUI}
AllowNoIcons=yes
LicenseFile=
OutputDir=output
OutputBaseFilename=AgroRural-Setup-{#MyAppVersion}
SetupIconFile=assets\logo.ico
WizardImageFile=assets\wizard.bmp
WizardSmallImageFile=assets\wizard-small.bmp
UninstallDisplayIcon={app}\{#MyAppExeName}
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
VersionInfoDescription={#MyAppNameUI} Setup
VersionInfoProductName={#MyAppNameUI}
VersionInfoCopyright=Copyright (C) 2026 {#MyAppPublisher}

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "emissorshortcut"; Description: "Criar atalho para Iniciar emissor NF-e"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "installphp"; Description: "Instalar PHP do sistema via WinGet (opcional — o Setup ja traz PHP portatil)"; GroupDescription: "Emissor NF-e:"; Flags: unchecked
#if IncludeSecrets
Name: "bootstrapdb"; Description: "Configurar .env/Neon e testar banco do emissor"; GroupDescription: "Emissor NF-e (obrigatorio no PC):"; Flags: checkedonce
#else
Name: "bootstrapdb"; Description: "Configurar PHP + testar banco (requer .env ja presente)"; GroupDescription: "Emissor NF-e (obrigatorio no PC):"; Flags: checkedonce
#endif

[Files]
Source: "stage\app\AgroRural.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "stage\app\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "stage\emissor_nfe\*"; DestDir: "{app}\emissor_nfe"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "README-INSTALACAO.txt"; DestDir: "{app}"; Flags: ignoreversion isreadme

[Icons]
Name: "{group}\{#MyAppNameUI}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{group}\Desinstalar {#MyAppNameUI}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppNameUI}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon; IconFilename: "{app}\{#MyAppExeName}"
Name: "{group}\Iniciar emissor NF-e"; Filename: "{app}\emissor_nfe\scripts\start-local.bat"; WorkingDir: "{app}\emissor_nfe"; Tasks: emissorshortcut; IconFilename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\Iniciar emissor NF-e"; Filename: "{app}\emissor_nfe\scripts\start-local.bat"; WorkingDir: "{app}\emissor_nfe"; Tasks: emissorshortcut; IconFilename: "{app}\{#MyAppExeName}"

[Registry]
Root: HKCU; Subkey: "Software\Classes\agro-emissor"; ValueType: string; ValueData: "URL:Agro Emissor Protocol"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\agro-emissor"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\agro-emissor\DefaultIcon"; ValueType: string; ValueData: "{app}\{#MyAppExeName}"
Root: HKCU; Subkey: "Software\Classes\agro-emissor\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"""

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\emissor_nfe\scripts\ensure-php.ps1"""; StatusMsg: "Instalando/configurando PHP e extensoes..."; Tasks: installphp; Flags: waituntilterminated
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\emissor_nfe\scripts\post-install-bootstrap.ps1"" -EmissorRoot ""{app}\emissor_nfe"" -PassphraseFile ""{src}\DESBLOQUEIO.txt"""; StatusMsg: "Configurando .env/Neon do emissor (nao feche)..."; Tasks: bootstrapdb; Flags: waituntilterminated
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir {#MyAppNameUI}"; Flags: nowait postinstall skipifsilent skipifdoesntexist; WorkingDir: "{app}"

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  ExePath: String;
begin
  Result := True;
  if CurPageID = wpFinished then
  begin
    ExePath := ExpandConstant('{app}\{#MyAppExeName}');
    if not FileExists(ExePath) then
      MsgBox('AVISO: o arquivo do app nao foi encontrado em:'#13#10 + ExePath + #13#10#13#10 +
        'Reinstale sem "Executar como administrador". Pasta esperada: AppData\Local.',
        mbError, MB_OK);
  end;
end;







