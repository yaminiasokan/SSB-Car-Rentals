const PDFDocument = require('pdfkit');
const RentalAgreement = require('../models/RentalAgreement');
const Vehicle = require('../models/Vehicle');
const { CANCELLATION_TIERS, COMPANY } = require('../config/constants');
const { newAgreementNo } = require('../utils/sequence');
const { idOf } = require('../utils/helpers');

const TERMS = [
  'The renter must be at least 21 years old and hold a valid Indian driving licence, which must be shown at pickup.',
  'Only the renter and any registered additional driver may drive the vehicle. Sub-letting, commercial hire, racing and off-road use are not permitted.',
  'The vehicle must be returned at the agreed location, date and time with the same fuel level. Late returns are charged at the hourly rate, up to one day rate per 24 hours.',
  'Traffic fines, tolls and challans incurred during the rental are the renter\'s responsibility.',
  'In case of an accident, breakdown or theft, contact SSB CAR RENTALS immediately on ' + COMPANY.phone + ' (24x7) and file a police report where required.',
  'The vehicle is inspected with photographs before and after the rental. AI-assisted findings are always reviewed by SSB staff; you will be notified of any proposed charge and may dispute it before it is final.',
  'No security deposit is charged on any booking. Confirmed damage, fines or unpaid charges raised after the post-rental inspection are billed separately.',
  'Smoking, carrying illegal goods and exceeding the seating capacity are prohibited.',
];

const cancellationPolicy = () => CANCELLATION_TIERS.map((t) => t.label);

/** Returns the booking's agreement, creating the snapshot on first use. Safe to call concurrently. */
async function ensureAgreement(booking, db) {
  const existing = await RentalAgreement.findOne({ booking: booking._id }, {}, db);
  if (existing) return existing;
  const vehicle = await Vehicle.findById(idOf(booking.vehicle), db);
  const created = await RentalAgreement.insert({
    agreementNo: await newAgreementNo(new Date(), db),
    booking: booking._id,
    user: idOf(booking.user),
    snapshot: {
      bookingId: booking.bookingId, customerName: booking.customer.name, phone: booking.customer.phone, email: booking.customer.email,
      licenseNumber: booking.customer.licenseNumber, vehicle: vehicle ? vehicle.name + (vehicle.fuelDisplay ? ` (${vehicle.fuelDisplay})` : '') : '',
      registrationYear: vehicle?.registrationYear, pickupLocation: booking.pickupLocation, returnLocation: booking.returnLocation,
      pickupAt: booking.pickupAt, returnAt: booking.returnAt, rentalAmount: booking.pricing.rentalTotal, deposit: booking.pricing.deposit, total: booking.pricing.total,
    },
    terms: TERMS,
    cancellationPolicy: cancellationPolicy(),
  }, db, { onConflict: 'booking_id' });
  // null means another request created it a moment ago (unique booking_id) — just load that one.
  return created || RentalAgreement.findOne({ booking: booking._id }, {}, db);
}

// PDFKit's built-in fonts have no ₹ glyph, so the PDF uses "Rs.".
const rs = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
const dt = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

function streamAgreementPdf(res, agreement) {
  const s = agreement.snapshot;
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${s.bookingId}-rental-agreement.pdf"`);
  doc.pipe(res);

  doc.rect(0, 0, doc.page.width, 90).fill('#000000');
  doc.fillColor('#d4af37').fontSize(22).font('Helvetica-Bold').text(COMPANY.name, 50, 28);
  doc.fontSize(9).fillColor('#ffffff').font('Helvetica').text(COMPANY.tagline, 50, 56);
  doc.text(`${COMPANY.phone}  |  ${COMPANY.email}  |  ${COMPANY.locations.join(' & ')}`, 50, 70);

  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(15).text('Vehicle Rental Agreement', 50, 115);
  doc.font('Helvetica').fontSize(9).fillColor('#555555').text(`Agreement no. ${agreement.agreementNo}`, 50, 136);

  const rows = [
    ['Customer name', s.customerName], ['Phone', s.phone], ['Email', s.email], ['Driving licence', s.licenseNumber || '-'],
    ['Booking ID', s.bookingId], ['Vehicle', s.vehicle], ['Pickup', `${dt(s.pickupAt)} - ${s.pickupLocation}`],
    ['Return', `${dt(s.returnAt)} - ${s.returnLocation}`], ['Rental amount (incl. tax)', rs(s.rentalAmount)],
    // Omitted when there's no deposit (every booking made under the no-deposit policy); kept for
    // older agreements whose snapshot still carries a nonzero value from before this change.
    ...(s.deposit > 0 ? [['Refundable security deposit', rs(s.deposit)]] : []),
    ['Total payable', rs(s.total)],
  ];
  let y = 160;
  rows.forEach(([k, v]) => {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text(k, 50, y, { width: 170 });
    doc.font('Helvetica').text(String(v), 225, y, { width: 320 });
    y += 18;
  });

  doc.moveDown(2);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#000').text('Terms & Conditions', 50, y + 14);
  doc.font('Helvetica').fontSize(9.5).fillColor('#222');
  agreement.terms.forEach((t, i) => doc.text(`${i + 1}. ${t}`, { width: 495, paragraphGap: 3 }));
  doc.moveDown(0.6).font('Helvetica-Bold').fontSize(12).fillColor('#000').text('Cancellation Policy');
  doc.font('Helvetica').fontSize(9.5).fillColor('#222');
  agreement.cancellationPolicy.forEach((t) => doc.text(`- ${t}`, { width: 495, paragraphGap: 2 }));

  doc.moveDown(1).font('Helvetica-Bold').fontSize(11).fillColor('#000').text('Customer acknowledgement');
  doc.font('Helvetica').fontSize(9.5).text(agreement.acknowledgedAt
    ? `Acknowledged electronically by ${agreement.acknowledgedBy} on ${dt(agreement.acknowledgedAt)}.`
    : 'Not yet acknowledged. The customer confirms they have read and accept these terms.');
  doc.end();
}

module.exports = { ensureAgreement, streamAgreementPdf, TERMS, cancellationPolicy };
