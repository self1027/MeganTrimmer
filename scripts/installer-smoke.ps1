$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') {
  throw 'Installer validation is restricted to disposable GitHub-hosted Windows runners.'
}
$identity = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $identity.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'The disposable runner must allow machine-wide installation tests.' }
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$work = Join-Path $root '.cache/native-validation'
New-Item -ItemType Directory -Path $work -Force | Out-Null
$version = (Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$next = (Get-Content -LiteralPath (Join-Path $root '.cache/native-next/latest.yml') -Raw | Select-String -Pattern 'version: ([\d.]+)').Matches.Groups[1].Value
$setup = Join-Path $root "release/MeganTrimmer-$version-Setup.exe"
$portable = Join-Path $root "release/MeganTrimmer-$version-Portable.exe"
$guid = '1655dfa4-8b90-5b88-9286-f758bf3fd6ef'
$userKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$guid"
$machineKey = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$guid"
$settings = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'megantrimmer/settings.json'
$clips = Join-Path $work 'clips'
$results = [Collections.Generic.List[string]]::new()
$feedProcess = $null

function Pass([string]$Name) { $results.Add($Name); Write-Output "PASS $Name" }
function Require([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Run([string]$File, [string[]]$Arguments, [int[]]$Accepted = @(0)) {
  $process = Start-Process -FilePath $File -ArgumentList $Arguments -WindowStyle Hidden -PassThru
  if (-not $process.WaitForExit(120000)) { $process.Kill(); throw "Timed out: $File" }
  $process.Refresh()
  Require ($process.ExitCode -in $Accepted) "$File exited $($process.ExitCode), expected $Accepted"
}
function Invoke-NodeCheck([string[]]$Arguments) {
  & (Get-Command node.exe).Source @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Node validation failed: $Arguments" }
}
function Entry([string]$Scope) {
  $key = if ($Scope -eq 'user') { $userKey } else { $machineKey }
  return Get-ItemProperty -LiteralPath $key -ErrorAction Stop
}
function AssertInstall([string]$Scope, [string]$ExpectedVersion, [string]$Folder) {
  $entry = Entry $Scope
  Require ($entry.DisplayVersion -eq $ExpectedVersion) 'Uninstall registry has the wrong version.'
  $opposite = if ($Scope -eq 'user') { $machineKey } else { $userKey }
  Require (-not (Test-Path -LiteralPath $opposite)) 'Upgrade created a second installation scope.'
  $installed = Get-ItemProperty -LiteralPath ("HK" + $(if ($Scope -eq 'user') { 'CU' } else { 'LM' }) + ":\Software\$guid")
  Require ($installed.InstallLocation.TrimEnd('\') -eq $Folder.TrimEnd('\')) 'Upgrade changed the installation directory.'
  $exe = Join-Path $Folder 'MeganTrimmer.exe'
  Require ((Get-Item -LiteralPath $exe).VersionInfo.ProductVersion -eq $ExpectedVersion) 'Installed executable has the wrong version.'
  $entries = @(foreach ($registry in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall')) {
    Get-ChildItem -LiteralPath $registry | Get-ItemProperty | Where-Object DisplayName -EQ 'MeganTrimmer'
  })
  Require ($entries.Count -eq 1) 'There must be exactly one installed-product entry.'
  $hive = if ($Scope -eq 'user') { 'HKCU' } else { 'HKLM' }
  $command = (Get-ItemProperty -LiteralPath "${hive}:\Software\Classes\MeganTrimmer.mp4\shell\open\command").'(default)'
  Require ($command -like "*$exe*") 'Open-with association points to the wrong executable.'
  $shell = New-Object -ComObject WScript.Shell
  foreach ($locations in @(@('DesktopDirectory','CommonDesktopDirectory'), @('Programs','CommonPrograms'))) {
    $links = @(foreach ($location in $locations) {
      $link = Join-Path ([Environment]::GetFolderPath($location)) 'MeganTrimmer.lnk'
      if (Test-Path -LiteralPath $link) { $link }
    })
    Require ($links.Count -eq 1) 'Desktop or Start Menu contains missing/duplicate shortcuts.'
    Require ($shell.CreateShortcut($links[0]).TargetPath -eq $exe) 'Shortcut targets the wrong executable.'
  }
  Require ((Get-Content -LiteralPath $settings -Raw | ConvertFrom-Json).outputFolder -eq $clips) 'Upgrade lost the output-folder preference.'
  Require ((Get-Content -LiteralPath (Join-Path $clips 'keep.mp4') -Raw).Trim() -eq 'preserve this clip') 'Upgrade changed a saved clip.'
}
function Uninstall([string]$Scope) {
  $command = (Entry $Scope).UninstallString
  Require ($command -match '^"([^"]+\.exe)"') 'Unexpected uninstaller command.'
  $uninstaller = $Matches[1]
  $mode = if ($Scope -eq 'user') { '/currentuser' } else { '/allusers' }
  Run $uninstaller @('/S', $mode)
  for ($attempt = 0; $attempt -lt 100 -and ((Test-Path -LiteralPath $userKey) -or (Test-Path -LiteralPath $machineKey)); $attempt++) { Start-Sleep -Milliseconds 100 }
  Require (-not ((Test-Path -LiteralPath $userKey) -or (Test-Path -LiteralPath $machineKey))) 'Uninstall did not remove the application registration.'
}
function StartApp([string]$File) {
  return Start-Process -FilePath $File -ArgumentList @('--remote-debugging-port=9333', '--inspect=9334') -WindowStyle Hidden -PassThru
}
function StopApps {
  foreach ($process in @(Get-Process -Name MeganTrimmer -ErrorAction SilentlyContinue)) {
    $null = $process.CloseMainWindow()
  }
  for ($attempt = 0; $attempt -lt 200 -and @(Get-Process -Name MeganTrimmer -ErrorAction SilentlyContinue).Count -gt 0; $attempt++) { Start-Sleep -Milliseconds 100 }
  Require (@(Get-Process -Name MeganTrimmer -ErrorAction SilentlyContinue).Count -eq 0) 'The test app did not exit gracefully.'
}

Require (-not ((Test-Path -LiteralPath $userKey) -or (Test-Path -LiteralPath $machineKey))) 'Disposable runner unexpectedly contains MeganTrimmer.'
Remove-Item -LiteralPath Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $clips, (Split-Path -Parent $settings) -Force | Out-Null
Set-Content -LiteralPath (Join-Path $clips 'keep.mp4') -Value 'preserve this clip' -Encoding utf8NoBOM
@{ outputFolder = $clips } | ConvertTo-Json | Set-Content -LiteralPath $settings -Encoding utf8NoBOM

try {
  Run $setup @('/S')
  $userFolder = (Get-ItemProperty -LiteralPath "HKCU:\Software\$guid").InstallLocation
  AssertInstall 'user' $version $userFolder
  Run $setup @('/S')
  AssertInstall 'user' $version $userFolder
  Pass 'new per-user installation and same-version reinstall preserve data, registration and file associations'

  $feedProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('scripts/native-feed.cjs', '.cache/native-next') -WorkingDirectory $root -WindowStyle Hidden -PassThru
  $appProcess = StartApp (Join-Path $userFolder 'MeganTrimmer.exe')
  Invoke-NodeCheck @('scripts/native-ui.cjs', 'decline', $version)
  Run $setup @('/S') @(2)
  Require (-not $appProcess.HasExited) 'Installer terminated the running app.'
  Invoke-NodeCheck @('scripts/native-ui.cjs', 'quit', $version)
  StopApps
  AssertInstall 'user' $version $userFolder
  Pass 'declining the update permits normal exit without installing; running-app upgrade is refused without termination'

  $appProcess = StartApp (Join-Path $userFolder 'MeganTrimmer.exe')
  $updateStarted = Get-Date
  Invoke-NodeCheck @('scripts/native-ui.cjs', 'update', $version)
  for ($attempt = 0; $attempt -lt 600; $attempt++) {
    $installedVersion = (Get-Item -LiteralPath (Join-Path $userFolder 'MeganTrimmer.exe') -ErrorAction SilentlyContinue).VersionInfo.ProductVersion
    $registeredVersion = (Get-ItemProperty -LiteralPath $userKey -ErrorAction SilentlyContinue).DisplayVersion
    $reopened = @(Get-Process -Name MeganTrimmer -ErrorAction SilentlyContinue | Where-Object {
      $_.MainWindowHandle -ne 0 -and $_.Path -eq (Join-Path $userFolder 'MeganTrimmer.exe') -and $_.StartTime -gt $updateStarted
    })
    if ($installedVersion -eq $next -and $registeredVersion -eq $next -and $appProcess.HasExited -and $reopened.Count -gt 0) { break }
    Start-Sleep -Milliseconds 200
  }
  AssertInstall 'user' $next $userFolder
  Require ($appProcess.HasExited) 'The original app did not exit for installation.'
  Require ($reopened.Count -gt 0) 'Update did not open a new main window from the replaced executable.'
  StopApps
  Run $setup @('/S') @(2)
  AssertInstall 'user' $next $userFolder
  Pass 'real downloaded update replaces the installed app and relaunches it; downgrade is rejected'
  Uninstall 'user'

  $legacyMsi = Join-Path $work 'legacy.msi'
  Invoke-WebRequest -Uri 'https://github.com/self1027/megan-trimmer/releases/download/v1.2.0/MeganTrimmer-Setup.msi' -OutFile $legacyMsi
  Require ((Get-FileHash -LiteralPath $legacyMsi -Algorithm SHA256).Hash -eq '4EA2A6B0118C2D9EF06805AD02120AEC46F1538757AA03D560CF582818DAC34C') 'Published legacy MSI checksum mismatch.'
  . (Join-Path $PSScriptRoot 'msi-wizard.ps1')
  Invoke-LegacyMsi $legacyMsi (Join-Path $work 'published MSI custom path') (Join-Path $work 'legacy-msi.log')
  $machineFolder = (Get-ItemProperty -LiteralPath "HKLM:\Software\$guid").InstallLocation
  Require ($machineFolder -eq (Join-Path $work 'published MSI custom path')) 'The MSI wizard did not retain its chosen custom directory.'
  AssertInstall 'machine' '1.2.0' $machineFolder
  Run $setup @('/S')
  AssertInstall 'machine' $version $machineFolder
  Pass 'the actual published MSI upgrades in place without duplicate entries or data loss'
  Uninstall 'machine'

  $legacySetup = Join-Path $work 'legacy-setup.exe'
  & (Join-Path $PSScriptRoot 'extract-msi.ps1') -Msi $legacyMsi -Output $legacySetup
  $customFolder = Join-Path $work 'custom machine installation'
  Run $legacySetup @('/S', "/D=$customFolder")
  AssertInstall 'machine' '1.2.0' $customFolder
  Run $setup @('/S')
  AssertInstall 'machine' $version $customFolder
  Pass 'legacy machine-wide installation in a custom path is preserved by the new installer'

  $ffmpeg = Join-Path $root 'release/win-unpacked/resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg.exe'
  $source = Join-Path $work 'source.mp4'
  Run $ffmpeg @('-v','error','-f','lavfi','-i','color=c=blue:size=1920x1080:rate=60','-t','60','-c:v','libx264','-preset','ultrafast',$source)
  $appProcess = StartApp (Join-Path $customFolder 'MeganTrimmer.exe')
  Invoke-NodeCheck @('scripts/native-ui.cjs', 'export', $version, $source)
  Run $setup @('/S') @(2)
  Require (-not $appProcess.HasExited) 'Installer terminated an export.'
  Invoke-NodeCheck @('scripts/native-ui.cjs', 'assert-export', $version)
  Invoke-NodeCheck @('scripts/native-ui.cjs', 'finish-export', $version)
  Invoke-NodeCheck @('scripts/native-ui.cjs', 'quit', $version)
  StopApps
  AssertInstall 'machine' $version $customFolder
  Pass 'machine-wide installer refuses replacement during a real video export without terminating the app'
  Uninstall 'machine'

  $appProcess = StartApp $portable
  Invoke-NodeCheck @('scripts/native-ui.cjs', 'portable', $version)
  Invoke-NodeCheck @('scripts/native-ui.cjs', 'quit', $version)
  StopApps
  Require (-not ((Test-Path -LiteralPath $userKey) -or (Test-Path -LiteralPath $machineKey))) 'Portable created an installation entry.'
  Pass 'portable remains portable and does not enable the NSIS updater'
} finally {
  if ($feedProcess -and -not $feedProcess.HasExited) { $feedProcess.Kill() }
  $results | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $work 'results.json') -Encoding utf8NoBOM
  if ($env:GITHUB_STEP_SUMMARY) {
    @('# Native Windows installer validation', '') + @($results | ForEach-Object { "- PASS: $_" }) | Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY
  }
}
