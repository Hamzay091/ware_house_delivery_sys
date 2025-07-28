const User = require('../models/user');       // Corrected Path
const Delivery = require('../models/delivery'); // Corrected Path
const bcrypt = require('bcryptjs');

// ... rest of the file is the same
exports.getAllUsers = async (req, res) => { const users = await User.find(); res.render('user-management', { users }); };
exports.renderEditForm = async (req, res) => { const userToEdit = await User.findById(req.params.id); res.render('edit-user', { userToEdit }); };
exports.updateUser = async (req, res) => { await User.findByIdAndUpdate(req.params.id, req.body); res.redirect('/users/manage'); };
exports.deleteUser = async (req, res) => { const user = await User.findById(req.params.id); if (user) { await Delivery.deleteMany({ assignedTo: user.name }); await User.findByIdAndDelete(req.params.id); } res.redirect('/users/manage'); };
exports.renderEditProfileForm = (req, res) => res.render('edit-profile', { error: null, success: null });
exports.handleUpdateProfile = async (req, res) => {
    try { const { name, phone, socialLink } = req.body; const updatedUser = await User.findByIdAndUpdate(req.session.user._id, { name, phone, socialLink }, { new: true }); req.session.user = updatedUser; res.render('edit-profile', { error: null, success: 'Your profile has been updated successfully!' }); }
    catch (error) { res.render('edit-profile', { error: 'An error occurred while updating your profile.', success: null }); }
};
exports.renderChangePasswordForm = (req, res) => res.render('change-password', { error: null, success: null });
exports.handleChangePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const user = await User.findById(req.session.user._id);
        if (newPassword !== confirmPassword) { return res.render('change-password', { error: 'New passwords do not match.', success: null }); }
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) { return res.render('change-password', { error: 'Incorrect current password.', success: null }); }
        user.password = newPassword;
        await user.save();
        res.render('change-password', { error: null, success: 'Password changed successfully!' });
    } catch (error) { res.render('change-password', { error: 'An error occurred while changing your password.', success: null }); }
};