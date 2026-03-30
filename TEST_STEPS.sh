#!/bin/bash
# Reset overlay config to defaults for fresh testing
echo "Preparing for fresh overlay modal testing..."

cat > /tmp/reset-overlay.json << 'EOF'
{
  "enabled": { ... existing apps config ... },
  "disabled": [],
  "headline": { ... existing headline config ... },
  "overlay": {
    "masterEnabled": false,
    "modal1": {
      "type": "contactForm",
      "enabled": false,
      "image": "",
      "description": "",
      "buttonText": "Get Special Offer",
      "web3formsKey": "4eab8d69-b661-4f80-92b2-a99786eddbf9"
    },
    "modal2": {
      "type": "mediaDisplay",
      "enabled": false,
      "media": "",
      "mediaType": "image",
      "description": ""
    }
  }
}
EOF

echo "✓ Reset template prepared"
echo ""
echo "Steps to test:"
echo "1. Go to admin-hollyhub.vercel.app"
echo "2. Login: HollyHubDigital / Adedigba1"
echo "3. Go to Overlay tab"
echo "4. Click Edit on Modal 1"
echo "5. Upload Internet.webp image"
echo "6. In description field, paste: Get 10% OFF <a href=\"contact.html\">Click here</a>"
echo "7. Click Save"
echo "8. Reload admin page"
echo "9. Verify:"
echo "   - Image URL field shows the file path (not undefined)"
echo "   - Description shows formatted HTML (link should be clickable)"
echo ""
echo "Expected Result:"
echo "✓ Image URL persists in field"
echo "✓ HTML description saved with tags intact"
echo "✓ Modal displays correctly on visitor page"
