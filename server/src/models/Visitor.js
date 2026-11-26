import mongoose from 'mongoose';

export const ID_TYPES = ['national_id', 'passport', 'driving_license', 'employee_id', 'other'];

const visitorSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    fullName: {
      type: String,
      required: [true, 'Visitor full name is required'],
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, 'Visitor email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      required: [true, 'Visitor phone number is required'],
      trim: true,
    },
    company: {
      type: String,
      trim: true,
      default: 'Independent',
    },
    idType: {
      type: String,
      enum: ID_TYPES,
      default: 'national_id',
    },
    idNumber: {
      type: String,
      trim: true,
      default: '',
    },
    photoUrl: {
      type: String,
      default: '',
    },
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    isWatchlisted: {
      type: Boolean,
      default: false,
    },
    watchlistReason: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'visitors',
  }
);

visitorSchema.index({ organizationId: 1, email: 1 }, { unique: true });
visitorSchema.index({ organizationId: 1, fullName: 1 });

export const Visitor = mongoose.model('Visitor', visitorSchema);
