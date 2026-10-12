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
