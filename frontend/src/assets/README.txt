Branding assets (optional)
--------------------------
Drop your official files here and the site picks them up automatically — no code changes:

  logo.png  (or logo.svg / logo.jpg / logo.webp)   -> replaces the built-in SSB logo mark in the header/footer/admin
  hero.jpg  (or hero.png / hero.webp)              -> used as the homepage hero background photo
  payment-qr.jpg (or .png / .jpeg / .webp)         -> the real payment QR shown in "PAYMENT SCANNER" at checkout

If these files are absent, a built-in black-and-gold SVG logo/car illustration is used, and the
payment scanner shows a placeholder until payment-qr.* is added.

payment-qr.jpg is already included — it is SSB CAR RENTALS' real Paytm/UPI collection QR
(UPI ID 7305786562@ptaxis, also set as COMPANY_UPI_ID in src/utils/constants.js). Replace it if the
UPI ID or QR ever changes, and update COMPANY_UPI_ID to match.
