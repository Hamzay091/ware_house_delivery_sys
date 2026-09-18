const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['Admin', 'Manager', 'DeliveryStaff'];
const STATUSES = ['pending', 'approved', 'rejected'];

const userSchema = new mongoose.Schema({
    googleId: { type: String, index: true, sparse: true },
    name: { type: String, required: true, trim: true },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    // Absent for accounts created through Google sign-in.
    password: { type: String, select: true },
    role: { type: String, enum: ROLES, required: true, index: true },

    // New accounts wait for an admin to approve them before they can sign in.
    status: { type: String, enum: STATUSES, default: 'pending', index: true },

    phone: { type: String, trim: true },
    socialLink: { type: String, trim: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

userSchema.methods.comparePassword = function (candidate) {
    if (!this.password) return Promise.resolve(false);
    return bcrypt.compare(candidate, this.password);
};

userSchema.statics.ROLES = ROLES;
userSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('User', userSchema);
