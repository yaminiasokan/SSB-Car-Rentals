const { defineModel } = require('../db/model');

// Snapshot of the agreement at booking time so later edits never change what the customer agreed to.
module.exports = defineModel({
  table: 'rental_agreements',
  fields: [
    ['agreementNo', 'agreement_no'], ['booking', 'booking_id'], ['user', 'user_id'],
    ['snapshot', 'snapshot', 'json'], ['terms', 'terms'], ['cancellationPolicy', 'cancellation_policy'],
    ['acknowledgedAt', 'acknowledged_at'], ['acknowledgedBy', 'acknowledged_by'],
  ],
});
