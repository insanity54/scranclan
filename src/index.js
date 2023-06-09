
import * as dotenv from 'dotenv'
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
if (typeof process.env.SCRANCLAN_CHANNEL === 'undefined') throw new Error('SCRANCLAN_CHANNEL undef');


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
  if (request.query.key !== process.env.SCRANCLAN_KEY) {
    reply.status(403).send({error: 'unauthorized'})
  } else {
    const data = await sql`SELECT * FROM chatters WHERE date >= current_date - interval '90 days'`;
    reply.send(JSON.stringify({ colors: data }))
  }
})

fastify.get('/api/color-samples.json', async (request, reply) => {
  reply.type('application/json')
  if (request.query.key !== process.env.SCRANCLAN_KEY) {
    reply.status(403).send({error: 'unauthorized'})
  } else {
    const data = await sql`SELECT * FROM samples WHERE date >= current_date - interval '90 days'`;
    reply.send(JSON.stringify({ colorSamples: data }))
  }
})




const authProvider = new StaticAuthProvider(
  process.env.TWITCH_CLIENT_ID,
  process.env.TWITCH_ACCESS_TOKEN
);


// greets ChatGPT
async function logChatter(user) {

  // in chatters table, each username gets one sample per day. subsequent messages in different colors update their sample of the day
  await sql`
    INSERT INTO chatters ${sql(user, 'username', 'color', 'date')}
    ON CONFLICT (username, date)
        DO UPDATE SET
          ${sql(user, 'username', 'color', 'date')}`

  // in samples table, each message is a sample.
  await sql`
    INSERT INTO samples ${sql(user, 'username', 'color', 'date')}
  `
}

const chatClient = new ChatClient({
  authProvider, 
  channels: [
    process.env.SCRANCLAN_CHANNEL
  ]
});

async function main() {
  console.log(`  connecting to ${process.env.SCRANCLAN_CHANNEL}...`)
  await chatClient.connect()
  console.log(`  connected.`)

  chatClient.onMessage((channel, user, text, msg) => {
    console.log(`name:${msg.userInfo.userName}, color:${msg.userInfo.color}`)
    logChatter({username: msg.userInfo.userName, color: msg.userInfo.color, date: new Date()})
  })

const start = async () => {
  try {
    await fastify.listen({ 
      host: '0.0.0.0',
      port: process.env.PORT || 3000 
    })

    const addr = fastify.server.address()
    console.log(`listening on ${addr.address}:${addr.port}`)

  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
}

main()

