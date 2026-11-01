!include WordFunc.nsh
!include nsProcess.nsh

; Check outer and elevated installer instances without terminating the user's app.
!macro checkMeganTrimmerClosed
  StrCpy $R2 0
  ${Do}
    nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
    Pop $R0
    ${If} $R0 == 603
      ${Break}
    ${EndIf}
    ${If} ${isUpdated}
    ${AndIf} $R0 == 0
    ${AndIf} $R2 < 20
      Sleep 500
      IntOp $R2 $R2 + 1
    ${Else}
      IfSilent +2
      MessageBox MB_OK|MB_ICONEXCLAMATION "Feche o MeganTrimmer antes de instalar ou atualizar."
      SetErrorLevel 2
      Quit
    ${EndIf}
  ${Loop}
!macroend

!macro customCheckAppRunning
  !insertmacro checkMeganTrimmerClosed
!macroend

!macro customInit
  !insertmacro checkMeganTrimmerClosed
  ReadRegStr $R3 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ReadRegStr $R4 HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ${If} $R3 != ""
  ${AndIf} $R4 != ""
    IfSilent +2
    MessageBox MB_OK|MB_ICONEXCLAMATION "Existem duas instalações do MeganTrimmer. Remova uma em Aplicativos do Windows e tente novamente."
    SetErrorLevel 2
    Quit
  ${EndIf}
  ReadRegStr $R0 HKCU "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
  ReadRegStr $R1 HKLM "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
  ${VersionCompare} $R0 "${VERSION}" $R2
  ${If} $R2 == 1
    Goto meganDowngrade
  ${EndIf}
  ${VersionCompare} $R1 "${VERSION}" $R2
  ${If} $R2 == 1
    meganDowngrade:
    IfSilent +2
    MessageBox MB_OK|MB_ICONEXCLAMATION "Uma versão mais recente do MeganTrimmer já está instalada."
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend

!macro customInstallMode
  ReadRegStr $R0 HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ${If} $R0 != ""
    StrCpy $isForceMachineInstall 1
  ${Else}
    StrCpy $isForceCurrentInstall 1
  ${EndIf}
!macroend

!macro customInstall
  ; Menu de contexto: "Abrir com MeganTrimmer" para .mp4, .mkv, .mov
  ; SHELL_CONTEXT escreve em HKLM (perMachine) ou HKCU automaticamente.

  ; --- .mp4 ---
  WriteRegStr SHELL_CONTEXT "Software\Classes\.mp4\OpenWithProgids" "MeganTrimmer.mp4" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\MeganTrimmer.mp4" "" "MP4 Video"
  WriteRegStr SHELL_CONTEXT "Software\Classes\MeganTrimmer.mp4\DefaultIcon" "" "$INSTDIR\MeganTrimmer.exe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\MeganTrimmer.mp4\shell\open" "" "Abrir com MeganTrimmer"
  WriteRegStr SHELL_CONTEXT "Software\Classes\MeganTrimmer.mp4\shell\open\command" "" '"$INSTDIR\MeganTrimmer.exe" "%1"'

  ; --- .mkv ---
  WriteRegStr SHELL_CONTEXT "Software\Classes\.mkv\OpenWithProgids" "MeganTrimmer.mkv" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\MeganTrimmer.mkv" "" "MKV Video"
  WriteRegStr SHELL_CONTEXT "Software\Classes\MeganTrimmer.mkv\DefaultIcon" "" "$INSTDIR\MeganTrimmer.exe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\MeganTrimmer.mkv\shell\open" "" "Abrir com MeganTrimmer"
  WriteRegStr SHELL_CONTEXT "Software\Classes\MeganTrimmer.mkv\shell\open\command" "" '"$INSTDIR\MeganTrimmer.exe" "%1"'

  ; --- .mov ---
  WriteRegStr SHELL_CONTEXT "Software\Classes\.mov\OpenWithProgids" "MeganTrimmer.mov" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\MeganTrimmer.mov" "" "QuickTime Movie"
  WriteRegStr SHELL_CONTEXT "Software\Classes\MeganTrimmer.mov\DefaultIcon" "" "$INSTDIR\MeganTrimmer.exe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\MeganTrimmer.mov\shell\open" "" "Abrir com MeganTrimmer"
  WriteRegStr SHELL_CONTEXT "Software\Classes\MeganTrimmer.mov\shell\open\command" "" '"$INSTDIR\MeganTrimmer.exe" "%1"'
!macroend

!macro customUnInstall
  ; Remove os valores do "Abrir com" antes de deletar as chaves ProgId
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.mp4\OpenWithProgids" "MeganTrimmer.mp4"
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.mkv\OpenWithProgids" "MeganTrimmer.mkv"
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.mov\OpenWithProgids" "MeganTrimmer.mov"

  DeleteRegKey SHELL_CONTEXT "Software\Classes\MeganTrimmer.mp4"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\MeganTrimmer.mkv"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\MeganTrimmer.mov"
!macroend
