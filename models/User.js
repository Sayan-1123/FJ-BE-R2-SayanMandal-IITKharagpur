/**
 * User Model
 * Core user entity with authentication, profile, and preferences
 */
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { len: [1, 100] },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true, // null for OAuth-only users
    },
    google_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    default_currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD',
      validate: { len: [3, 3] },
    },
    notification_preferences: {
      type: DataTypes.JSONB,
      defaultValue: {
        email_budget_alerts: true,
        email_anomaly_alerts: true,
        in_app_notifications: true,
      },
    },
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
  });

  // Hash password before save
  User.beforeCreate(async (user) => {
    if (user.password_hash) {
      user.password_hash = await bcrypt.hash(user.password_hash, 12);
    }
  });

  User.beforeUpdate(async (user) => {
    if (user.changed('password_hash') && user.password_hash) {
      user.password_hash = await bcrypt.hash(user.password_hash, 12);
    }
  });

  // Instance method to check password
  User.prototype.validatePassword = async function (password) {
    if (!this.password_hash) return false;
    return bcrypt.compare(password, this.password_hash);
  };

  // Remove sensitive data from JSON output
  User.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.password_hash;
    return values;
  };

  return User;
};
