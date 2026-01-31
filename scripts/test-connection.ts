/**
 * Supabase接続テストスクリプト
 *
 * 使い方:
 *   npx tsx scripts/test-connection.ts
 *
 * 必要な環境変数:
 *   DB_URL - PostgreSQL接続文字列
 */

import { Client } from "pg";

async function testConnection() {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    console.error("❌ DB_URL 環境変数が設定されていません");
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl.trim() });

  try {
    await client.connect();
    console.log("✅ Supabaseに接続成功");

    const res = await client.query("SELECT current_database(), current_user, version()");
    const row = res.rows[0];
    console.log(`  DB: ${row.current_database}`);
    console.log(`  User: ${row.current_user}`);
    console.log(`  Version: ${row.version}`);

    // テーブル一覧を確認
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log(`\n📋 publicスキーマのテーブル (${tables.rows.length}件):`);
    for (const t of tables.rows) {
      console.log(`  - ${t.table_name}`);
    }
  } catch (err) {
    console.error("❌ 接続エラー:", (err as Error).message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testConnection();
