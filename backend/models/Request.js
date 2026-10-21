const mongoose = require('mongoose');
const { EMAIL_PATTERN } = require('../utils/http');
const Schema = mongoose.Schema;

const RequestSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    user: {
      name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name must be at most 100 characters'],
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [EMAIL_PATTERN, 'Please add a valid email'],
      },
      phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true,
        maxlength: [40, 'Phone must be at most 40 characters'],
      },
    },

    location: {
      // GeoJSON point. Left unset (no `type` default) when the requester gives
      // no coordinates, otherwise the 2dsphere index rejects the document.
      coordinates: {
        type: {
          type: String,
          enum: ['Point'],
        },
        coordinates: {
          type: [Number],
          default: undefined,
          validate: {
            validator: function (coords) {
              if (!coords) return true;
              const [lng, lat] = coords;
              return (
                coords.length === 2 &&
                Number.isFinite(lng) &&
                Number.isFinite(lat) &&
                Math.abs(lng) <= 180 &&
                Math.abs(lat) <= 90
              );
            },
            message: 'Coordinates must be [longitude, latitude]',
          },
        },
      },
      address: {
        type: String,
        required: [true, 'Address is required'],
        trim: true,
        maxlength: [300, 'Address must be at most 300 characters'],
      },
    },

    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'cancelled'],
      default: 'pending',
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes must be at most 1000 characters'],
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    completedAt: {
      type: Date,
    },

    // Set when the retention policy removed the requester's personal details.
    redactedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

RequestSchema.index({ 'location.coordinates': '2dsphere' }, { sparse: true });
RequestSchema.index({ assignedTo: 1, createdAt: -1 });
RequestSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Request', RequestSchema);
