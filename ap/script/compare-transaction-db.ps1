$sqldiff_input = Read-Host "Please enter path or folder to sqldiff.exe"

$sqldiff_executable = Get-ChildItem -Path $sqldiff_input -Recurse -File -Filter sqldiff.exe `
        | Select-Object -First 1 `
        | % { $_.FullName }

if (($null -eq $sqldiff_executable) -or !(Test-Path $sqldiff_executable))
{
    Write-Warning "sqldiff.exe does not exist, please download it from https://www.sqlite.org/download.html"
    exit 1
}
else
{
    Write-Information "found sqldiff.exe at: ``$sqldiff_executable``" -InformationAction Continue
}

function find_transaction_folder
{
    param ($app_folder)

    $transaction_folder = Get-ChildItem -Path "$app_folder" -Filter transaction -Recurse -Force `
        | Where-Object { $_.FullName -notmatch "\\tests\\e2e\\" } `
        | Select-Object -First 1 `
		| % { $_.FullName }

    if (($null -eq $transaction_folder) -or !(Test-Path $transaction_folder))
    {
        Write-Warning "Cannot find transaction folder for ``$app_folder``"
        exit 1
    }
    else
    {
        Write-Information "Found transaction folder for ``$app_folder`` at: ``$transaction_folder``" -InformationAction Continue
    }
    return $transaction_folder
}

$app_folder_1 = Read-Host "Please enter path to app 1"
$transaction_folder_1 = find_transaction_folder $app_folder_1

$app_folder_2 = Read-Host "Please enter path to app 2"
$transaction_folder_2 = find_transaction_folder $app_folder_2

Write-Information "Start to run sqldiff" -InformationAction Continue

for($process_id = 0; $process_id -lt 50; $process_id++)
{
    $table = "t_process_$process_id"
    $db_file = "$table.sqlite3"

    $db1 = Join-Path $transaction_folder_1 $db_file
    $db2 = Join-Path $transaction_folder_2 $db_file

    if (!(Test-Path $db1) -or !(Test-Path $db2))
    {
        continue
    }

    & $sqldiff_executable --summary --table $table $db1 $db2
}
