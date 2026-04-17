/**
 * Receipt Routes
 * Upload and manage transaction receipts
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { Transaction } = require('../models');
const { authenticate } = require('../middleware/auth');
const { uploadReceipt } = require('../config/multer');

/** POST /api/receipts/:transactionId — Upload receipt */
router.post('/:transactionId', authenticate, uploadReceipt.single('receipt'), async (req, res, next) => {
  try {
    const tx = await Transaction.findOne({
      where: { id: req.params.transactionId, user_id: req.user.id },
    });
    if (!tx) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Delete old receipt if exists
    if (tx.receipt_path) {
      const oldPath = path.join(__dirname, '..', tx.receipt_path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    tx.receipt_path = req.file.path.replace(/\\/g, '/');
    await tx.save();

    res.json({ message: 'Receipt uploaded', receipt_path: tx.receipt_path });
  } catch (err) { next(err); }
});

/** DELETE /api/receipts/:transactionId — Remove receipt */
router.delete('/:transactionId', authenticate, async (req, res, next) => {
  try {
    const tx = await Transaction.findOne({
      where: { id: req.params.transactionId, user_id: req.user.id },
    });
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (!tx.receipt_path) return res.status(404).json({ error: 'No receipt found' });

    const filePath = path.join(__dirname, '..', tx.receipt_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    tx.receipt_path = null;
    await tx.save();
    res.json({ message: 'Receipt removed' });
  } catch (err) { next(err); }
});

/** GET /api/receipts/:transactionId — Serve receipt file */
router.get('/:transactionId', authenticate, async (req, res, next) => {
  try {
    const tx = await Transaction.findOne({
      where: { id: req.params.transactionId, user_id: req.user.id },
    });
    if (!tx || !tx.receipt_path) return res.status(404).json({ error: 'Receipt not found' });

    const filePath = path.join(__dirname, '..', tx.receipt_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Receipt file missing' });

    res.sendFile(path.resolve(filePath));
  } catch (err) { next(err); }
});

module.exports = router;
