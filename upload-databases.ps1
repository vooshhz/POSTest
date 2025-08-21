# PowerShell script to upload databases to Fly.io

Write-Host "Uploading databases to Fly.io..." -ForegroundColor Green

# Check if databases exist
$databases = @("LiquorDatabase.db", "LiquorInventory.db", "StoreInformation.db")
$allExist = $true

foreach ($db in $databases) {
    if (!(Test-Path $db)) {
        Write-Host "Error: $db not found!" -ForegroundColor Red
        $allExist = $false
    }
}

if (!$allExist) {
    exit 1
}

Write-Host "All database files found." -ForegroundColor Green

# Method 1: Try using fly ssh console to copy files
Write-Host "`nMethod 1: Direct copy via SSH..." -ForegroundColor Yellow

# First, let's check the current state
Write-Host "Checking current /data directory contents..." -ForegroundColor Cyan
flyctl ssh console -a your-pos-app -C "ls -la /data"

# Copy each database file
foreach ($db in $databases) {
    Write-Host "Uploading $db..." -ForegroundColor Cyan
    
    # Convert file to base64 and transfer
    $fileContent = [Convert]::ToBase64String([IO.File]::ReadAllBytes($db))
    $chunks = [Math]::Ceiling($fileContent.Length / 50000)
    
    Write-Host "File size: $([Math]::Round((Get-Item $db).Length / 1MB, 2)) MB - Splitting into $chunks chunks" -ForegroundColor Gray
    
    # Remove old file if exists
    flyctl ssh console -a your-pos-app -C "rm -f /data/$db"
    
    # Transfer in chunks
    for ($i = 0; $i -lt $chunks; $i++) {
        $start = $i * 50000
        $length = [Math]::Min(50000, $fileContent.Length - $start)
        $chunk = $fileContent.Substring($start, $length)
        
        if ($i -eq 0) {
            flyctl ssh console -a your-pos-app -C "echo '$chunk' > /data/$db.b64"
        } else {
            flyctl ssh console -a your-pos-app -C "echo '$chunk' >> /data/$db.b64"
        }
        
        Write-Progress -Activity "Uploading $db" -Status "Chunk $($i+1) of $chunks" -PercentComplete (($i+1)/$chunks*100)
    }
    
    # Decode the base64 file
    flyctl ssh console -a your-pos-app -C "base64 -d /data/$db.b64 > /data/$db && rm /data/$db.b64"
    Write-Host "$db uploaded successfully!" -ForegroundColor Green
}

Write-Host "`nVerifying uploaded files..." -ForegroundColor Cyan
flyctl ssh console -a your-pos-app -C "ls -la /data/*.db"

Write-Host "`nRestarting app to apply changes..." -ForegroundColor Yellow
flyctl apps restart your-pos-app

Write-Host "`nDatabase upload complete!" -ForegroundColor Green
Write-Host "Your app should now have access to all databases." -ForegroundColor Green