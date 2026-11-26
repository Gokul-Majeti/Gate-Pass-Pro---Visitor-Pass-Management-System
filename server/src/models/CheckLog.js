import mongoose from 'mongoose';

export const CHECK_ACTIONS = ['check_in', 'check_out', 'denied'];
export const CHECK_METHODS = ['qr_scan', 'manual_code', 'otp_fallback'];

const checkLogSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    locationName: {
      type: String,
      required: true,
      trim: true,
      default: 'Main Campus',
    },
    passId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pass',
      required: true,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      index: true,
    },
    visitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Visitor',
      required: true,
      index: true,
    },
    scannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: CHECK_ACTIONS,
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: CHECK_METHODS,
      default: 'qr_scan',
    },
    gateName: {
      type: String,
      trim: true,
      default: 'Main Reception',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'checklogs',
  }
);

checkLogSchema.index({ organizationId: 1, timestamp: -1 });

export const CheckLog = mongoose.model('CheckLog', checkLogSchema);
