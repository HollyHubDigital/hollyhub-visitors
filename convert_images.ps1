$ErrorActionPreference = "Stop"

# Convert images to base64
$img1Path = "c:\Users\holly\New folder (2)\public\assets\hollyhub.jpg"
$img2Path = "c:\Users\holly\New folder (2)\public\assets\hollyhubhero.jpg"

$img1 = [convert]::ToBase64String((Get-Content $img1Path -Raw -Encoding Byte))
$img2 = [convert]::ToBase64String((Get-Content $img2Path -Raw -Encoding Byte))

Write-Host "hollyhub.jpg base64 (first 100 chars): $($img1.Substring(0, 100))"
Write-Host "hollyhub.jpg total length: $($img1.Length)"
Write-Host "`nhollyhubhero.jpg base64 (first 100 chars): $($img2.Substring(0, 100))"
Write-Host "hollyhubhero.jpg total length: $($img2.Length)"

# Save to file for easy reference
$dataUri1 = "data:image/jpeg;base64,$img1"
$dataUri2 = "data:image/jpeg;base64,$img2"

Set-Content -Path "c:\Users\holly\New folder (2)\base64_images.txt" -Value @"
DATA_URI_HOLLYHUB=$dataUri1

DATA_URI_HOLLYHUBHERO=$dataUri2
"@

Write-Host "`nBase64 URIs saved to base64_images.txt"
