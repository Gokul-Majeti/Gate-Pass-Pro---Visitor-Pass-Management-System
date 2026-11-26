import mongoose from 'mongoose';

export const APPOINTMENT_TYPES = ['pre_registered', 'host_invited', 'walk_in'];
export const APPOINTMENT_CATEGORIES = [
  'business_meeting',
  'interview',
  'delivery',
  'vendor',
  'maintenance',
  'personal',
  'other',
];
export const APPOINTMENT_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'checked_in',
  'checked_out',
  'cancelled',
  'expired',
];

const appointmentSchema = new mongoose.Schema(
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
    visitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Visitor',
      required: true,
      index: true,
    },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    purpose: {
      type: String,
      required: [true, 'Visit purpose is required'],
      trim: true,
      maxlength: 300,
    },
    category: {
      type: String,
      enum: APPOINTMENT_CATEGORIES,
      default: 'business_meeting',
    },
    type: {
      type: String,
      enum: APPOINTMENT_TYPES,
      default: 'pre_registered',
    },
    scheduledStart: {
      type: Date,
      required: true,
      index: true,
    },
    scheduledEnd: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: 'pending',
      index: true,
    },
    approvalNote: {
      type: String,
      trim: true,
      default: '',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    requireOtp: {
      type: Boolean,
      default: false,
    },
    gateOtpHash: {
      type: String,
      select: false,
      default: null,
    },
    gateOtpExpiresAt: {
      type: Date,
      select: false,
      default: null,
    },
    otpVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'appointments',
  }
);

appointmentSchema.pre('validate', function validateWindow(next) {
  if (this.scheduledStart && this.scheduledEnd && this.scheduledEnd <= this.scheduledStart) {
    this.invalidate('scheduledEnd', 'scheduledEnd must be after scheduledStart');
  }
  next();
});

appointmentSchema.index({ organizationId: 1, status: 1, scheduledStart: -1 });
appointmentSchema.index({ hostId: 1, scheduledStart: -1 });

export const Appointment = mongoose.model('Appointment', appointmentSchema);
