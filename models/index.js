/**
 * Model Index
 * Initializes all models and sets up associations
 */
const { sequelize } = require('../config/database');

// Import model definitions
const UserDef = require('./User');
const CategoryDef = require('./Category');
const TransactionDef = require('./Transaction');
const BudgetDef = require('./Budget');
const NotificationDef = require('./Notification');

// Initialize models
const User = UserDef(sequelize);
const Category = CategoryDef(sequelize);
const Transaction = TransactionDef(sequelize);
const Budget = BudgetDef(sequelize);
const Notification = NotificationDef(sequelize);

// ==================== ASSOCIATIONS ====================

// User -> Categories (one-to-many)
User.hasMany(Category, { foreignKey: 'user_id', as: 'categories', onDelete: 'CASCADE' });
Category.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User -> Transactions (one-to-many)
User.hasMany(Transaction, { foreignKey: 'user_id', as: 'transactions', onDelete: 'CASCADE' });
Transaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Category -> Transactions (one-to-many, SET NULL on delete)
Category.hasMany(Transaction, { foreignKey: 'category_id', as: 'transactions', onDelete: 'SET NULL' });
Transaction.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

// User -> Budgets (one-to-many)
User.hasMany(Budget, { foreignKey: 'user_id', as: 'budgets', onDelete: 'CASCADE' });
Budget.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Category -> Budgets (one-to-many, SET NULL on delete)
Category.hasMany(Budget, { foreignKey: 'category_id', as: 'budgets', onDelete: 'SET NULL' });
Budget.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

// User -> Notifications (one-to-many)
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = {
  sequelize,
  User,
  Category,
  Transaction,
  Budget,
  Notification,
};
