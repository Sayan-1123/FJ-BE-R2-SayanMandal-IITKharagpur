/**
 * Anomaly Detection Service
 * Statistical methods to identify unusual spending patterns
 */
const { Op } = require('sequelize');

const detectTransactionAnomaly = async (transaction, Transaction) => {
  const reasons = [];
  const history = await Transaction.findAll({
    where: {
      user_id: transaction.user_id,
      type: transaction.type,
      ...(transaction.category_id ? { category_id: transaction.category_id } : {}),
      id: { [Op.ne]: transaction.id || 'none' },
      date: { [Op.gte]: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
    order: [['date', 'DESC']],
    limit: 100,
  });

  if (history.length < 5) return { isAnomaly: false, reasons: [] };

  const amounts = history.map((t) => Math.abs(parseFloat(t.converted_amount || t.amount)));
  const currentAmount = Math.abs(parseFloat(transaction.converted_amount || transaction.amount));

  // Z-Score
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev > 0) {
    const zScore = (currentAmount - mean) / stdDev;
    if (Math.abs(zScore) > 2.5) {
      reasons.push(`Amount is ${zScore.toFixed(1)} std devs from average (${mean.toFixed(2)})`);
    }
  }

  // IQR
  const sorted = [...amounts].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const upperFence = q3 + 1.5 * (q3 - q1);
  if (currentAmount > upperFence && upperFence > 0) {
    reasons.push(`Amount exceeds IQR upper fence of ${upperFence.toFixed(2)}`);
  }

  // Spike: 3x recent average
  const recentAvg = amounts.slice(0, 10).reduce((a, b) => a + b, 0) / Math.min(10, amounts.length);
  if (currentAmount > recentAvg * 3 && recentAvg > 0) {
    reasons.push(`Amount is ${(currentAmount / recentAvg).toFixed(1)}x recent average`);
  }

  return { isAnomaly: reasons.length > 0, reasons, score: Math.min(100, reasons.length * 35) };
};

const scanForAnomalies = async (userId, Transaction, days = 30) => {
  const transactions = await Transaction.findAll({
    where: {
      user_id: userId,
      date: { [Op.gte]: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
    },
    order: [['date', 'DESC']],
  });
  const anomalies = [];
  for (const tx of transactions) {
    const result = await detectTransactionAnomaly(tx, Transaction);
    if (result.isAnomaly) anomalies.push({ transaction: tx, reasons: result.reasons, score: result.score });
  }
  return anomalies;
};

module.exports = { detectTransactionAnomaly, scanForAnomalies };
