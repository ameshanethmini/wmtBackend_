import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getMyAccountSettings,
  updatePassword,
  updatePreferences,
  updateProfile,
} from '../controllers/accountSettingsController.js';
import {
  updateAccountPasswordSchema,
  updateAccountPreferencesSchema,
  updateAccountProfileSchema,
} from '../validators/accountSettings.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error('Profile photo must be a JPG or PNG image'));
  },
});

const uploadProfilePhoto = (req, res, next) => {
  upload.single('profilePhotoFile')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message = error?.message || 'Profile photo upload failed';
    return res.status(400).json({ error: message });
  });
};

router.use(requireAuth);

router.get('/me', getMyAccountSettings);
router.put('/profile', uploadProfilePhoto, validate(updateAccountProfileSchema), updateProfile);
router.put('/password', validate(updateAccountPasswordSchema), updatePassword);
router.put('/preferences', validate(updateAccountPreferencesSchema), updatePreferences);

export default router;
