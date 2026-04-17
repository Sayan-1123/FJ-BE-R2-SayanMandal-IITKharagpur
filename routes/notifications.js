/**
 * Notification Routes
 */
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Notification } = require('../models');
const { authenticate } = require('../middleware/auth');

/** GET /api/notifications */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { unread_only } = req.query;
    const where = { user_id: req.user.id };
    if (unread_only === 'true') where.is_read = false;

    const notifications = await Notification.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    const unreadCount = await Notification.count({ where: { user_id: req.user.id, is_read: false } });

    res.json({ notifications, unread_count: unreadCount });
  } catch (err) { next(err); }
});

/** PUT /api/notifications/:id/read */
router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    const notif = await Notification.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    notif.is_read = true;
    await notif.save();
    res.json({ notification: notif });
  } catch (err) { next(err); }
});

/** PUT /api/notifications/read-all */
router.put('/read-all', authenticate, async (req, res, next) => {
  try {
    await Notification.update(
      { is_read: true },
      { where: { user_id: req.user.id, is_read: false } }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) { next(err); }
});

module.exports = router;
