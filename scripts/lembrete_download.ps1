# Lembrete visual (popup) para baixar e salvar os PDFs do Power BI
# na pasta da importação, antes da importação automática rodar às 13h.
# A pasta vem de RELATORIOS_BI_PASTA no scripts\.env (mesma do run_daily_import.py).
$pasta = Join-Path $env:USERPROFILE 'Downloads\RelatoriosBI'
$envFile = Join-Path $PSScriptRoot '.env'
if (Test-Path $envFile) {
    $linha = Get-Content $envFile | Where-Object { $_ -match '^\s*RELATORIOS_BI_PASTA\s*=' } | Select-Object -First 1
    if ($linha -match '=\s*(.+?)\s*$') { $pasta = $Matches[1] }
}
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.MessageBox]::Show(
    "Hora de baixar os 6 relatorios do Power BI (email) e salvar em:`n`n$pasta`n`nA importacao automatica roda as 13h.",
    "R9 Hub - Lembrete de relatorios BI",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
) | Out-Null
