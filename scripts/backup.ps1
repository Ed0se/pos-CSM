# Ejemplo de respaldo Windows; requiere MySQL CLI en PATH.
# Configurar antes un login-path con mysql_config_editor, sin contraseña en script:
# mysql_config_editor set --login-path=colegio_local --host=127.0.0.1 --user=USUARIO_RESPALDOS --password
param(
  [string]$Database = 'colegio_san_miguel_pos',
  [string]$LoginPath = 'colegio_local'
)
$ErrorActionPreference = 'Stop'
$backupDir = Join-Path $PSScriptRoot '..\backups'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$file = Join-Path $backupDir "$Database-$stamp.sql"
& mysqldump "--login-path=$LoginPath" --single-transaction --routines --triggers --default-character-set=utf8mb4 "--result-file=$file" "$Database"
if ($LASTEXITCODE -ne 0) { throw 'mysqldump falló: revisar permisos, cliente y login-path.' }
if (-not (Test-Path $file) -or (Get-Item $file).Length -eq 0) { throw 'Backup ausente o vacío.' }
Write-Output "Respaldo guardado: $file"
Write-Output 'Validar periódicamente restauración en base separada antes del uso real.'
