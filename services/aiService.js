/**
 * AI Service
 * OpenAI integration for financial insights, categorisation, and chat
 */

let OpenAI;
try {
  OpenAI = require('openai');
} catch {
  OpenAI = null;
}

let openai = null;

const getClient = () => {
  if (!openai && OpenAI && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key') {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
};

/**
 * Generate financial insights from transaction data
 */
const generateInsights = async (transactions, userCurrency = 'USD') => {
  const client = getClient();
  if (!client) {
    return generateFallbackInsights(transactions, userCurrency);
  }

  try {
    const summary = summarizeTransactions(transactions, userCurrency);
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a financial advisor. Analyze the user\'s financial data and provide actionable insights. Be specific with numbers. Format as JSON with keys: insights (array of {title, description, type: "positive"|"negative"|"neutral"}), recommendations (array of strings), health_score (0-100).',
        },
        {
          role: 'user',
          content: `Analyze my finances for this period:\n${JSON.stringify(summary, null, 2)}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    console.error('AI insights error:', err.message);
    return generateFallbackInsights(transactions, userCurrency);
  }
};

/**
 * Auto-categorize a transaction description
 */
const categorizeTransaction = async (description, categories) => {
  const client = getClient();
  if (!client) return null;

  try {
    const categoryList = categories.map((c) => `${c.id}: ${c.name} (${c.type})`).join('\n');
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Categorize this transaction. Available categories:\n${categoryList}\nRespond with JSON: {"category_id": "uuid", "type": "income"|"expense", "confidence": 0.0-1.0}`,
        },
        { role: 'user', content: description },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 100,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    console.error('AI categorization error:', err.message);
    return null;
  }
};

/**
 * Financial chatbot
 */
const chat = async (message, financialContext) => {
  const client = getClient();
  if (!client) {
    return {
      response: 'AI service is not configured. Please set your OPENAI_API_KEY in the environment variables to enable the financial chatbot.',
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful financial assistant. The user's financial summary:\n${JSON.stringify(financialContext, null, 2)}\nProvide concise, helpful advice.`,
        },
        { role: 'user', content: message },
      ],
      max_tokens: 500,
    });

    return { response: response.choices[0].message.content };
  } catch (err) {
    console.error('AI chat error:', err.message);
    return { response: 'Sorry, I encountered an error. Please try again.' };
  }
};

// ==================== HELPERS ====================

function summarizeTransactions(transactions, currency) {
  let totalIncome = 0, totalExpenses = 0;
  const categoryBreakdown = {};

  transactions.forEach((t) => {
    const amount = parseFloat(t.converted_amount || t.amount);
    if (t.type === 'income') totalIncome += amount;
    else totalExpenses += amount;

    const catName = t.category?.name || 'Uncategorized';
    if (!categoryBreakdown[catName]) categoryBreakdown[catName] = { income: 0, expense: 0 };
    categoryBreakdown[catName][t.type] += amount;
  });

  return {
    currency,
    totalIncome: totalIncome.toFixed(2),
    totalExpenses: totalExpenses.toFixed(2),
    netSavings: (totalIncome - totalExpenses).toFixed(2),
    savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : '0',
    transactionCount: transactions.length,
    categoryBreakdown,
  };
}

function generateFallbackInsights(transactions, currency) {
  const summary = summarizeTransactions(transactions, currency);
  const savingsRate = parseFloat(summary.savingsRate);
  const insights = [];

  if (savingsRate > 20) {
    insights.push({ title: 'Great Savings Rate', description: `You're saving ${savingsRate}% of your income. Well done!`, type: 'positive' });
  } else if (savingsRate > 0) {
    insights.push({ title: 'Room for Improvement', description: `Your savings rate is ${savingsRate}%. Aim for at least 20%.`, type: 'neutral' });
  } else {
    insights.push({ title: 'Spending Exceeds Income', description: `You're spending more than you earn. Review your expenses.`, type: 'negative' });
  }

  return {
    insights,
    recommendations: [
      'Track all daily expenses to identify spending leaks',
      'Set up automatic transfers to a savings account',
      'Review and cancel unused subscriptions',
    ],
    health_score: Math.min(100, Math.max(0, Math.round(50 + savingsRate))),
  };
}

module.exports = { generateInsights, categorizeTransaction, chat };
