import { db } from '../lib/db/client'
import * as schema from '../lib/db/schema'

async function dump() {
  const tables = [
    { name: 'users', table: schema.users },
    { name: 'tasks', table: schema.tasks },
    { name: 'connectors', table: schema.connectors },
    { name: 'accounts', table: schema.accounts },
    { name: 'keys', table: schema.keys },
    { name: 'task_messages', table: schema.task_messages },
    { name: 'settings', table: schema.settings },
    { name: 'scheduled_tasks', table: schema.scheduled_tasks },
    { name: 'reviews', table: schema.reviews },
    { name: 'review_rules', table: schema.review_rules },
    { name: 'github_installations', table: schema.github_installations },
    { name: 'vercel_subscriptions', table: schema.vercel_subscriptions },
    { name: 'build_fixes', table: schema.build_fixes },
  ]

  for (const { name, table } of tables) {
    console.log(`--- Table: ${name} ---`)
    try {
      const data = await db.select().from(table as any)
      console.log(JSON.stringify(data, null, 2))
    } catch (error: any) {
      console.error(`Error fetching data from ${name}:`, error.message)
    }
    console.log('\n')
  }
}

dump()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
