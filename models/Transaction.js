/**
 * Transaction Model
 * Core financial transaction with multi-currency support and decimal precision
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    category_id: {
      type: DataTypes.UUID,
      allowNull: true, // null when category is deleted
    },
    type: {
      type: DataTypes.ENUM('income', 'expense'),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Amount in original currency. Can be negative for refunds.',
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD',
    },
    exchange_rate: {
      type: DataTypes.DECIMAL(15, 6),
      defaultValue: 1.0,
      comment: 'Rate to convert to user default currency',
    },
    converted_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Amount in user default currency',
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    receipt_path: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    is_recurring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    import_hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: 'SHA-256 hash for deduplication of imported transactions',
    },
    is_anomaly: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    anomaly_reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  }, {
    tableName: 'transactions',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id', 'date'] },
      { fields: ['user_id', 'type'] },
      { fields: ['user_id', 'category_id'] },
      { fields: ['import_hash'], unique: true },
    ],
  });

  return Transaction;
};
