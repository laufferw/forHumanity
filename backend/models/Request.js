const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RequestSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  user: {
    name: {
      type: String,
      required: [true, 'Name is required']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/, 'Please add a valid email']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required']
    }
  },

  location: {
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: function (coords) {
            if (!coords) return true;
            return Array.isArray(coords) && coords.length === 2;
          },
          message: 'Coordinates must be [longitude, latitude]'
        }
      }
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
    }
  },

  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },

  notes: {
    type: String,
    trim: true
  },

  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

RequestSchema.index({ 'location.coordinates': '2dsphere' }, { sparse: true });

module.exports = mongoose.model('Request', RequestSchema);
