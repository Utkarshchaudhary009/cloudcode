
const postgres = require('postgres');

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error('POSTGRES_URL is required');
    process.exit(1);
  }

  const sql = postgres(url);
  
  try {
    const tasks = await sql`
      SELECT id, logs 
      FROM tasks 
      WHERE id = 'M0VvKfuyAPWKGma0P1QIp'
    `;

    if (tasks.length === 0) {
      console.log('Task not found');
      return;
    }

    const task = tasks[0];
    if (task.logs) {
      const logs = Array.isArray(task.logs) ? task.logs : JSON.parse(task.logs);
      logs.forEach((log, index) => {
         console.log(`Log ${index}: [${log.type}] ${log.message}`);
      });
    }
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await sql.end();
  }
}

main();
