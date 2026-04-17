/**
 * Budget Model
 * Budget goals per category with period tracking
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Budget = sequelize.define('Budget', {
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
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: { min: 0.01 },
    },
    period: {
      type: DataTypes.ENUM('weekly', 'monthly', 'yearly'),
      defaultValue: 'monthly',
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    alert_threshold: {
      type: DataTypes.INTEGER,
      defaultValue: 80,
      comment: 'Percentage at which to trigger alert (e.g., 80 = alert at 80% spent)',
    },
  }, {
    tableName: 'budgets',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['user_id', 'category_id', 'period'] },
    ],
  });

  return Budget;
};
