
import dotenv from 'dotenv'
dotenv.config()

import { StaticAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import postgres from 'postgres'
import Fastify from 'fastify'

if (typeof process.env.TWITCH_CLIENT_ID === 'undefined') throw new Error('TWITCH_CLIENT_ID undef');
if (typeof process.env.TWITCH_ACCESS_TOKEN === 'undefined') throw new Error('TWITCH_ACCESS_TOKEN undef');
if (typeof process.env.POSTGRES_USERNAME === 'undefined') throw new Error('POSTGRES_USERNAME undef');
if (typeof process.env.POSTGRES_PASSWORD === 'undefined') throw new Error('POSTGRES_PASSWORD undef');
if (typeof process.env.POSTGRES_HOST === 'undefined') throw new Error('POSTGRES_HOST undef');
if (typeof process.env.POSTGRES_PORT === 'undefined') throw new Error('POSTGRES_PORT undef');
if (typeof process.env.SCRANCLAN_KEY === 'undefined') throw new Error('SCRANCLAN_KEY undef');


const sql = postgres({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: 'scranclan',
  username: process.env.POSTGRES_USERNAME,
  password: process.env.POSTGRES_PASSWORD
})

const fastify = Fastify({})



fastify.get('/api/colors.json', async (request, reply) => {
  reply.type('application/json')
  console.log(request.query)
  if (request.query.key !== process.env.SCRANCLAN_KEY) {
    reply.status(403).send({error: 'unauthorized'})
  } else {
    const data = await sql`SELECT * FROM chatters WHERE date >= current_date - interval '90 days'`;
    console.log(data)
    reply.send(JSON.stringify({ colors: data }))
  }
})




const authProvider = new StaticAuthProvider(
  process.env.TWITCH_CLIENT_ID,
  process.env.TWITCH_ACCESS_TOKEN
);


async function logChatter(user) {
  await sql`
    INSERT INTO chatters ${sql(user, 'username', 'color', 'last_seen')}
    ON CONFLICT (username)
        DO UPDATE SET
          ${sql(user, 'username', 'color', 'last_seen')}`
}

const chatClient = new ChatClient({
  authProvider, 
  channels: [
    // 'bebthebarbariengineer'
    'cj_clippy'
  ]
});

async function main() {
  console.log(`  connecting to chat...`)
  await chatClient.connect()
  console.log(`  connected.`)

  chatClient.onMessage((channel, user, text, msg) => {
    console.log(`name:${msg.userInfo.userName}, color:${msg.userInfo.color}`)
    logChatter({username: msg.userInfo.userName, color: msg.userInfo.color, last_seen: new Date()})
  })

  fastify.listen(process.env.PORT || 5000)
}

main()
