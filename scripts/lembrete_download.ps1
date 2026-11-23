# Lembrete visual (popup) para baixar e salvar os PDFs do Power BI
# em RelatoriosBI, antes da importação automática rodar às 13h.
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.MessageBox]::Show(
    "Hora de baixar os 6 relatorios do Power BI (email) e salvar em:`n`nC:\Users\daniel.marques\Downloads\RelatoriosBI`n`nA importacao automatica roda as 13h.",
    "R9 Hub - Lembrete de relatorios BI",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
) | Out-Null
