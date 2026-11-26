import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

export const USER_ROLES = ['admin', 'security', 'host', 'visitor'];

const userSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    locationName: {
      type: String,
      trim: true,
      default: 'Main Campus',
    },
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'visitor',
      required: true,
      index: true,
    },
    department: {
      type: String,
      trim: true,
      default: 'General',
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otpCodeHash: {
      type: String,
      select: false,
      default: null,
    },
    otpExpiresAt: {
      type: Date,
      select: false,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

userSchema.index({ organizationId: 1, role: 1 });

userSchema.methods.comparePassword = async function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

userSchema.statics.hashPassword = async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.otpCodeHash;
    delete ret.otpExpiresAt;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
