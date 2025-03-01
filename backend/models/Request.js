const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the Request schema
const RequestSchema = new Schema({
  // User details
  user: {
    name: {
      type: String,
      required: [true, 'Name is required']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required']
    }
  },
  
  // Location information
  location: {
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true,
        index: '2dsphere'
      }
    },
    address: {
      type: String,
      required: [true, 'Address is required']
    }
  },
  
  // Request status
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  
  // Additional information
  notes: {
    type: String,
    trim: true
  },
  
  // Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true // This will use createdAt and updatedAt automatically
});

// Create index for location search
RequestSchema.index({ 'location.coordinates': '2dsphere' });

module.exports = mongoose.model('Request', RequestSchema);

