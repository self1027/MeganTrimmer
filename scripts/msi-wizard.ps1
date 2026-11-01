Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class MeganMsiWizard {
  delegate bool Visitor(IntPtr window, IntPtr state);
  [DllImport("user32.dll")] static extern bool EnumWindows(Visitor visitor, IntPtr state);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, Visitor visitor, IntPtr state);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window, StringBuilder text, int count);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window, StringBuilder text, int count);
  [DllImport("user32.dll")] static extern IntPtr GetDlgItem(IntPtr parent, int id);
  [DllImport("user32.dll")] static extern bool IsWindowEnabled(IntPtr window);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] static extern int GetDlgCtrlID(IntPtr window);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr SendMessage(IntPtr window, uint message, IntPtr wparam, string text);
  [DllImport("user32.dll", EntryPoint="SendMessageW")] static extern IntPtr SendNumber(IntPtr window, uint message, IntPtr wparam, IntPtr lparam);
  static string Text(IntPtr window, bool className=false) {
    var text=new StringBuilder(1024);
    if (className) GetClassName(window, text, text.Capacity); else GetWindowText(window, text, text.Capacity);
    return text.ToString();
  }
  public static string Advance(string directory) {
    string action=null;
    string wanted=directory.TrimEnd('\\');
    EnumWindows((window, unused) => {
      if (!IsWindowVisible(window) || Text(window, true)!="#32770" || !Text(window).Contains("MeganTrimmer")) return true;
      string note=null;
      EnumChildWindows(window, (child, state) => {
        var label=Text(child).Replace("&", "");
        if (IsWindowVisible(child) && Text(child, true)=="Edit") {
          var current=Text(child).TrimEnd('\\');
          if (!string.Equals(current, wanted, StringComparison.OrdinalIgnoreCase)) {
            SendMessage(child, 0x000C, IntPtr.Zero, directory);
            SendNumber(window, 0x0111, (IntPtr)((0x0300<<16)|GetDlgCtrlID(child)), child);
            note="set directory control "+GetDlgCtrlID(child)+" from ["+current+"]";
          }
        }
        if (Text(child, true)=="Button" && (label.StartsWith("Run ") || label.StartsWith("Executar ")) && label.Contains("MeganTrimmer")
            && SendNumber(child, 0x00F0, IntPtr.Zero, IntPtr.Zero)!=IntPtr.Zero) {
          SendNumber(child, 0x00F1, IntPtr.Zero, IntPtr.Zero);
        }
        return true;
      }, IntPtr.Zero);
      var next=GetDlgItem(window, 1);
      if (next!=IntPtr.Zero && IsWindowEnabled(next)) {
        action=(note==null?"":note+" ")+Text(next);
        SendNumber(next, 0x00F5, IntPtr.Zero, IntPtr.Zero);
      } else action=note;
      return true;
    }, IntPtr.Zero);
    return action;
  }
}
'@

function Invoke-LegacyMsi([string]$MsiPath, [string]$Directory, [string]$LogPath) {
  if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') { throw 'Wizard automation is restricted to disposable CI.' }
  $process = Start-Process -FilePath msiexec.exe -ArgumentList @('/i', $MsiPath, '/qn', '/norestart', '/L*V', $LogPath) -WindowStyle Hidden -PassThru
  $deadline = (Get-Date).AddMinutes(3)
  while (-not $process.HasExited -and (Get-Date) -lt $deadline) {
    $action = [MeganMsiWizard]::Advance($Directory)
    if ($action) { Write-Output "Legacy MSI embedded wizard: $action" }
    Start-Sleep -Milliseconds 300
  }
  if (-not $process.HasExited) { $process.Kill(); throw 'The legacy MSI wizard timed out.' }
  if ($process.ExitCode -notin @(0,3010)) { throw "Legacy MSI failed with exit code $($process.ExitCode)." }
}
