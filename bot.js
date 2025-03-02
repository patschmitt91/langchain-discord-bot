require("dotenv").config();
const client = require('./config');
const { handleMessage } = require('./handlers');

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("messageCreate", handleMessage);

client.login(process.env.DISCORD_TOKEN);