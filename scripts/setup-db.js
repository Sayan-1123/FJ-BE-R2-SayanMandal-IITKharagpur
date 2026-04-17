/**
 * Database Setup Script
 * Run this after installing PostgreSQL to create the database
 * Usage: node scripts/setup-db.js
 */
const { Client } = require('pg');
require('dotenv').config();

async function setup() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres', // Connect to default DB first
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // Check if database exists
    const res = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [process.env.DB_NAME || 'finance_tracker']
    );

    if (res.rows.length === 0) {
      await client.query(`CREATE DATABASE ${process.env.DB_NAME || 'finance_tracker'}`);
      console.log(`✅ Database '${process.env.DB_NAME || 'finance_tracker'}' created`);
    } else {
      console.log(`ℹ️  Database '${process.env.DB_NAME || 'finance_tracker'}' already exists`);
    }

    console.log('\n🚀 Setup complete! Run "npm run dev" to start the server.');
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    console.log('\nMake sure PostgreSQL is installed and running.');
    console.log('Download: https://www.postgresql.org/download/windows/');
  } finally {
    await client.end();
  }
}

setup();
