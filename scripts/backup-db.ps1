# backup-db.ps1 — backup mingguan database RanahMerenah dari container Docker

$pgDumpPath = "D:\Vani\Program Files\PostgreSQL\18\bin\pg_dump.exe"
$backupDir  = "D:\Vani\Project\_bak\db"
$logFile    = Join-Path $backupDir "backup.log"
$dateStr    = Get-Date -Format "yyyy-MM-dd"
$timeStr    = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$backupFile = Join-Path $backupDir "ranahmerenah_weekly_$dateStr.dump"

function Write-Log($message) {
    Add-Content -Path $logFile -Value "[$timeStr] $message"
}

$envContent = Get-Content "D:\Vani\Project\RanahMerenah\.env" -Raw
if ($envContent -match "POSTGRES_PASSWORD=(.+)") {
    $env:PGPASSWORD = $matches[1].Trim()
} else {
    Write-Log "GAGAL - POSTGRES_PASSWORD tidak ditemukan di .env"
    exit 1
}

& $pgDumpPath -U postgres -h localhost -p 5433 -F c -f $backupFile ranahmerenah
$exitCode = $LASTEXITCODE

Remove-Item Env:\PGPASSWORD

if ($exitCode -eq 0 -and (Test-Path $backupFile)) {
    $sizeKB = [math]::Round((Get-Item $backupFile).Length / 1KB, 1)
    Write-Log "SUKSES - $backupFile ($sizeKB KB)"
} else {
    Write-Log "GAGAL - pg_dump exit code: $exitCode - cek koneksi ke db container (localhost:5433)"
}

# Rotasi: hapus backup mingguan yang lebih tua dari 90 hari (~13 minggu)
Get-ChildItem -Path $backupDir -Filter "ranahmerenah_weekly_*.dump" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-90) } |
    Remove-Item -Force