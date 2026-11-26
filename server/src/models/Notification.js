import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    recipient: {
      type: String,
      required: true,
      trim: true,
    },
    channel: {
      type: String,
      enum: ['email', 'sms'],
      required: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      default: '',
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['sent', 'simulated', 'failed'],
      default: 'simulated',
    },
    providerInfo: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'notifications',
  }
);

notificationSchema.index({ organizationId: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
