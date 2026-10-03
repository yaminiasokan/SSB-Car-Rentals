const { defineModel } = require('../db/model');

module.exports = defineModel({
  table: 'inspections',
  fields: [
    ['booking', 'booking_id'], ['vehicle', 'vehicle_id'], ['type', 'type'],
    ['performedBy', 'performed_by_id'], ['performerRole', 'performer_role'],
    ['images', 'images', 'json'],       // [{ slot, url, note, uploadedAt }]
    ['checklist', 'checklist', 'json'], // [{ group, item, status, note }]
    ['notes', 'notes'],
  ],
});
