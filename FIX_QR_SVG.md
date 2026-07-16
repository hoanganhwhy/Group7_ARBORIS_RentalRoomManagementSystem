# VietQR SVG fix

The tenant payment page now renders the VietQR code locally as an SVG data URL.
It no longer depends on the qrcode-generator GIF encoder to display the local QR.
External VietQR image URLs remain fallback sources only.

Validation performed:
- npm run typecheck: passed
- npm run build: passed
