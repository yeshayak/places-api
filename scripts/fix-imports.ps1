Write-Host "Starting import path fix process..."

# Get the absolute path to the dist directory
$distPath = Join-Path $PSScriptRoot "..\dist"
$distPath = Resolve-Path $distPath

Write-Host "Scanning directory: $distPath"

# Get all JS files recursively
$files = Get-ChildItem -Path $distPath -Recurse -Filter "*.js"
  Write-Host "Found $($files.Count) JavaScript files"

foreach ($file in $files) {
    Write-Host "Processing: $($file.Name)"
    $content = Get-Content -Path $file.FullName -Raw
    
    # Add .js to relative imports
    $patterns = @(
        'from "(\.\.?/[^"]+)"',  # double quotes
        "from '(\.\.?/[^']+)'"   # single quotes
    )
    
    $updatedContent = $content
    foreach ($pattern in $patterns) {
        $updatedContent = $updatedContent -replace $pattern, 'from "$1.js"'
    }

    # Avoid double .js extensions
    $updatedContent = $updatedContent -replace '\.js\.js"', '.js"'
    $updatedContent = $updatedContent -replace "\.js\.js'", ".js'"

    if ($content -ne $updatedContent) {
        Set-Content -Path $file.FullName -Value $updatedContent -NoNewline
        Write-Host "✓ Updated imports in $($file.Name)" -ForegroundColor Green
    }
    else {
        Write-Host "- No changes needed in $($file.Name)" -ForegroundColor Yellow
    }

    if ($content -ne $updatedContent) {
        $backup = "$($file.FullName).bak"
        Copy-Item -Path $file.FullName -Destination $backup
        
        try {
            Set-Content -Path $file.FullName -Value $updatedContent -NoNewline
            Write-Host "✓ Updated imports in $($file.Name)" -ForegroundColor Green
            Remove-Item -Path $backup
        }
        catch {
            Write-Host "✗ Failed to update $($file.Name). Restoring backup..." -ForegroundColor Red
            Copy-Item -Path $backup -Destination $file.FullName
            Remove-Item -Path $backup
            throw $_
        }
    }
    else {
        Write-Host "- No changes needed in $($file.Name)" -ForegroundColor Yellow
    }
}

Write-Host "`nImport path fix process completed!" -ForegroundColor Green
