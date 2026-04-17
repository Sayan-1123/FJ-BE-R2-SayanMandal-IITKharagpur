/**
 * Category Model
 * Supports both income and expense categories per user
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Category = sequelize.define('Category', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('income', 'expense'),
      allowNull: false,
    },
    icon: {
      type: DataTypes.STRING(50),
      defaultValue: '📁',
    },
    color: {
      type: DataTypes.STRING(7),
      defaultValue: '#6366f1',
    },
  }, {
    tableName: 'categories',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id', 'type'] },
      { unique: true, fields: ['user_id', 'name', 'type'] },
    ],
  });

  return Category;
};
