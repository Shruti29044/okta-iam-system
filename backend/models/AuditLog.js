const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'USER_CREATED',
        'USER_DISABLED',
        'USER_ENABLED',
        'GROUP_ASSIGNED',
        'GROUP_REMOVED',
        'GROUP_CREATED',
        'GROUP_DELETED',
        'USER_DELETED',
        'USER_LOGIN',
      ],
    },
    performedBy: { type: String, default: 'system' }, // admin's email
    targetUser:  { type: String, default: null },      // affected user's email
    targetGroup: { type: String, default: null },      // group name / id if applicable
    status:      { type: String, enum: ['SUCCESS', 'FAILURE'], required: true },
    details:     { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp:   { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// Index for fast descending-time queries in the admin dashboard
auditLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
