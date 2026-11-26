import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    gates: {
      type: [String],
      default: ['Main Reception'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: [true, 'Organization slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'],
    },
    industry: {
      type: String,
      trim: true,
      default: 'Corporate',
    },
    locations: {
      type: [locationSchema],
      default: [
        {
          name: 'Main Campus',
          code: 'MAIN',
          address: '',
          gates: ['Main Reception'],
          isActive: true,
        },
      ],
    },
    settings: {
      requireHostApproval: {
        type: Boolean,
        default: true,
      },
      requireOtpAtGate: {
        type: Boolean,
        default: false,
      },
      defaultPassDurationHours: {
        type: Number,
        default: 8,
        min: 1,
        max: 72,
      },
      primaryColor: {
        type: String,
        default: '#2563eb',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'organizations',
  }
);

export const Organization = mongoose.model('Organization', organizationSchema);
