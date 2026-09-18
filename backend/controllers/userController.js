const User = require('../models/user');
const Delivery = require('../models/delivery');
const { searchRegex, paginate, sortSpec, pageMeta, sortLink } = require('../utils/query');

const MIN_PASSWORD_LENGTH = 8;

/* --------------------------------------------------------------------------
 * Admin: user management
 * ------------------------------------------------------------------------ */
exports.getAllUsers = async (req, res, next) => {
    try {
        const regex = searchRegex(req.query.search);
        // The paginated table lists approved accounts; anyone still waiting is
        // shown above it in full, so a pending request is never buried on page 3.
        const filter = { status: { $ne: 'pending' } };
        if (regex) filter.$or = [{ name: regex }, { email: regex }];
        if (User.ROLES.includes(req.query.role)) filter.role = req.query.role;

        const page = paginate(req.query);
        const sort = sortSpec(req.query, ['name', 'email', 'role', 'createdAt'], 'createdAt');

        const [users, total, pendingUsers] = await Promise.all([
            User.find(filter).sort(sort.spec).skip(page.skip).limit(page.limit),
            User.countDocuments(filter),
            User.find({ status: 'pending' }).sort({ createdAt: 1 })
        ]);

        res.render('user-management', {
            title: 'User management',
            users,
            pendingUsers,
            filters: { search: req.query.search || '', role: req.query.role || '' },
            roles: User.ROLES,
            pagination: pageMeta(page, total, req.query),
            sort,
            sortHref: (field) => sortLink(req.query, field, sort.field, sort.dir)
        });
    } catch (error) {
        next(error);
    }
};

exports.approveUser = async (req, res, next) => {
    try {
        const target = await User.findById(req.params.id);
        if (!target) {
            req.flash('error', 'That account no longer exists.');
            return res.redirect('/users/manage');
        }
        if (target.status === 'approved') {
            req.flash('info', `${target.name} is already approved.`);
            return res.redirect('/users/manage');
        }

        target.status = 'approved';
        await target.save();

        req.flash('success', `${target.name} can now sign in as ${target.role === 'DeliveryStaff' ? 'delivery staff' : target.role}.`);
        res.redirect('/users/manage');
    } catch (error) {
        next(error);
    }
};

exports.rejectUser = async (req, res, next) => {
    try {
        const target = await User.findById(req.params.id);
        if (!target) {
            req.flash('error', 'That account no longer exists.');
            return res.redirect('/users/manage');
        }
        if (target.status === 'approved') {
            req.flash('error', 'That account is already approved — delete it instead if you want it gone.');
            return res.redirect('/users/manage');
        }

        // A rejected request is deleted outright: it has no deliveries or
        // history attached, because it was never able to sign in.
        await User.findByIdAndDelete(target._id);

        req.flash('success', `${target.name}'s request was rejected.`);
        res.redirect('/users/manage');
    } catch (error) {
        next(error);
    }
};

exports.renderEditForm = async (req, res, next) => {
    try {
        const userToEdit = await User.findById(req.params.id);
        if (!userToEdit) {
            req.flash('error', 'That user no longer exists.');
            return res.redirect('/users/manage');
        }
        res.render('edit-user', {
            title: `Edit ${userToEdit.name}`,
            userToEdit,
            roles: User.ROLES,
            errors: []
        });
    } catch (error) {
        next(error);
    }
};

exports.updateUser = async (req, res, next) => {
    try {
        const target = await User.findById(req.params.id);
        if (!target) {
            req.flash('error', 'That user no longer exists.');
            return res.redirect('/users/manage');
        }

        const isSelf = target._id.equals(req.user._id);
        const { name, email, phone, role } = req.body;

        if (!User.ROLES.includes(role)) {
            req.flash('error', 'Please choose a valid role.');
            return res.redirect(`/users/edit/${target._id}`);
        }

        // An admin removing their own admin rights would lock themselves out
        // of the page they are standing on.
        if (isSelf && role !== 'Admin') {
            req.flash('error', 'You cannot change your own role. Ask another admin to do it.');
            return res.redirect(`/users/edit/${target._id}`);
        }

        if (target.role === 'Admin' && role !== 'Admin') {
            const adminCount = await User.countDocuments({ role: 'Admin', status: 'approved' });
            if (adminCount <= 1) {
                req.flash('error', 'This is the only admin account — promote someone else first.');
                return res.redirect(`/users/edit/${target._id}`);
            }
        }

        const previousName = target.name;

        // Assign only the fields this form owns. Passing req.body straight to
        // findByIdAndUpdate would let a crafted request set `password` (stored
        // unhashed, because update queries skip the pre-save hook) or googleId.
        target.name = name;
        target.email = String(email).toLowerCase().trim();
        target.phone = phone;
        target.role = role;
        await target.save();

        // Deliveries denormalise the staff name for display; keep it in step.
        if (previousName !== target.name) {
            await Delivery.updateMany(
                { $or: [{ assignedToId: target._id }, { assignedTo: previousName }] },
                { $set: { assignedTo: target.name, assignedToId: target._id } }
            );
        }

        req.flash('success', `${target.name}'s account was updated.`);
        res.redirect('/users/manage');
    } catch (error) {
        if (error.code === 11000) {
            req.flash('error', 'Another account already uses that email address.');
            return res.redirect(`/users/edit/${req.params.id}`);
        }
        next(error);
    }
};

exports.deleteUser = async (req, res, next) => {
    try {
        const target = await User.findById(req.params.id);
        if (!target) {
            req.flash('error', 'That user no longer exists.');
            return res.redirect('/users/manage');
        }

        if (target._id.equals(req.user._id)) {
            req.flash('error', 'You cannot delete your own account.');
            return res.redirect('/users/manage');
        }

        if (target.role === 'Admin') {
            const adminCount = await User.countDocuments({ role: 'Admin', status: 'approved' });
            if (adminCount <= 1) {
                req.flash('error', 'You cannot delete the last admin account.');
                return res.redirect('/users/manage');
            }
        }

        // Deliveries are operational records: unassign them rather than
        // deleting the history along with the account.
        const unassigned = await Delivery.updateMany(
            { $or: [{ assignedToId: target._id }, { assignedTo: target.name }] },
            { $set: { assignedTo: 'Unassigned' }, $unset: { assignedToId: '' } }
        );

        await User.findByIdAndDelete(target._id);

        req.flash(
            'success',
            `${target.name} was removed. ${unassigned.modifiedCount || 0} delivery record(s) are now unassigned.`
        );
        res.redirect('/users/manage');
    } catch (error) {
        next(error);
    }
};

/* --------------------------------------------------------------------------
 * Self-service profile
 * ------------------------------------------------------------------------ */
exports.renderEditProfileForm = (req, res) =>
    res.render('edit-profile', { title: 'Edit profile', errors: [] });

exports.handleUpdateProfile = async (req, res, next) => {
    try {
        const { name, phone, socialLink } = req.body;

        if (!name || !String(name).trim()) {
            return res.status(400).render('edit-profile', {
                title: 'Edit profile',
                errors: [{ msg: 'Your name cannot be empty.' }]
            });
        }

        // Authentication is handled by Passport, so the signed-in user is on
        // req.user. (This used to read req.session.user, which Passport never
        // sets, so saving a profile always threw.)
        const previousName = req.user.name;
        const updated = await User.findByIdAndUpdate(
            req.user._id,
            { name: String(name).trim(), phone, socialLink },
            { new: true, runValidators: true }
        );

        if (previousName !== updated.name) {
            await Delivery.updateMany(
                { $or: [{ assignedToId: updated._id }, { assignedTo: previousName }] },
                { $set: { assignedTo: updated.name, assignedToId: updated._id } }
            );
        }

        req.flash('success', 'Your profile has been updated.');
        res.redirect('/profile');
    } catch (error) {
        next(error);
    }
};

exports.renderChangePasswordForm = (req, res) =>
    res.render('change-password', { title: 'Change password', errors: [] });

exports.handleChangePassword = async (req, res, next) => {
    const fail = (msg) => res.status(400).render('change-password', {
        title: 'Change password',
        errors: [{ msg }]
    });

    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const user = await User.findById(req.user._id);

        if (!user.password) {
            return fail('This account signs in with Google and has no password to change.');
        }
        if (newPassword !== confirmPassword) {
            return fail('The new passwords do not match.');
        }
        if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
            return fail(`Your new password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
        }
        if (newPassword === currentPassword) {
            return fail('Your new password must be different from the current one.');
        }

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) return fail('Your current password is not correct.');

        // Assigning and saving runs the hashing hook; a direct update would not.
        user.password = newPassword;
        await user.save();

        req.flash('success', 'Your password has been changed.');
        res.redirect('/profile');
    } catch (error) {
        next(error);
    }
};
