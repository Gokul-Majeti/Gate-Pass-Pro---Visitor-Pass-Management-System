import mongoose from 'mongoose';

export const PASS_STATUSES = ['active', 'checked_in', 'used', 'revoked', 'expired'];

const passSchema = new mongoose.Schema(
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
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
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
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    passCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    qrToken: {
      type: String,
      required: true,
      unique: true,
    },
    qrDataUrl: {
      type: String,
      default: '',
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validUntil: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: PASS_STATUSES,
      default: 'active',
      index: true,
    },
    revokedReason: {
      type: String,
      trim: true,
      default: '',
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'passes',
  }
);

passSchema.pre('validate', function validateValidity(next) {
  if (this.validFrom && this.validUntil && this.validUntil <= this.validFrom) {
    this.invalidate('validUntil', 'validUntil must be after validFrom');
  }
  next();
});

// Prevent multiple active/checked-in passes for the same appointment, while allowing re-issuance after revocation
passSchema.index(
  { appointmentId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['active', 'checked_in'] } },
  }
);
passSchema.index({ organizationId: 1, status: 1, validUntil: -1 });

export const Pass = mongoose.model('Pass', passSchema);
