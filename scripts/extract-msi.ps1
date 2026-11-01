param([Parameter(Mandatory)][string]$Msi, [Parameter(Mandatory)][string]$Output)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.IO;
using System.Runtime.InteropServices;
public static class MeganMsiStream {
  [DllImport("msi.dll", CharSet=CharSet.Unicode)] static extern uint MsiOpenDatabase(string file, IntPtr mode, out uint db);
  [DllImport("msi.dll", CharSet=CharSet.Unicode)] static extern uint MsiDatabaseOpenView(uint db, string sql, out uint view);
  [DllImport("msi.dll")] static extern uint MsiViewExecute(uint view, uint record);
  [DllImport("msi.dll")] static extern uint MsiViewFetch(uint view, out uint record);
  [DllImport("msi.dll")] static extern uint MsiRecordReadStream(uint record, uint field, byte[] buffer, ref uint size);
  [DllImport("msi.dll")] static extern uint MsiCloseHandle(uint handle);
  static void Check(uint status) { if (status != 0) throw new Exception("MSI error " + status); }
  public static void Extract(string input, string output) {
    uint db=0, view=0, record=0;
    try {
      Check(MsiOpenDatabase(input, IntPtr.Zero, out db));
      Check(MsiDatabaseOpenView(db, "SELECT `Data` FROM `Binary` WHERE `Name`='WrappedExe'", out view));
      Check(MsiViewExecute(view, 0));
      Check(MsiViewFetch(view, out record));
      using (var stream=File.Create(output)) {
        var bytes=new byte[65536];
        while (true) {
          uint size=(uint)bytes.Length;
          Check(MsiRecordReadStream(record, 1, bytes, ref size));
          if (size==0) break;
          stream.Write(bytes, 0, (int)size);
        }
      }
    } finally {
      if (record!=0) MsiCloseHandle(record);
      if (view!=0) MsiCloseHandle(view);
      if (db!=0) MsiCloseHandle(db);
    }
  }
}
'@
[MeganMsiStream]::Extract((Resolve-Path -LiteralPath $Msi).Path, [IO.Path]::GetFullPath($Output))
if ((Get-Item -LiteralPath $Output).Length -lt 1000000) { throw 'The embedded installer is unexpectedly small.' }
Write-Output "Extracted embedded NSIS installer: $Output"
