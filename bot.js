require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const { ChatOpenAI } = require("@langchain/openai");
const { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } = require("@langchain/core/prompts");
const { BufferMemory } = require("langchain/memory");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4-turbo",
  maxTokens: 1000,
  temperature: 0.2,
});

const ALLOWED_CHANNEL_ID = "1345015106957869110"; // Replace with your desired channel ID

// Global shared memory for all players in the same campaign
const memory = new BufferMemory({
  returnMessages: true, // Ensures past messages are available
  memoryKey: "history", // The key under which the memory is stored
});

const systemMessage = SystemMessagePromptTemplate.fromTemplate(`
  You are a Dungeon Master for a multiplayer text-based Dungeons & Dragons campaign.
  - Guide the players through an immersive shared adventure.
  - Keep track of past events and actions.
  - Address multiple players individually when needed.
  - Describe settings vividly and roleplay NPCs.
  - Always ask for player choices and drive the story forward.
  - Never respond for another player's character.
  - Keep responses engaging but concise to encourage interaction.
`);

const prompt = ChatPromptTemplate.fromMessages([
  systemMessage, 
  HumanMessagePromptTemplate.fromTemplate("{input}")
]);

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.channel.id !== ALLOWED_CHANNEL_ID) return;

  if (message.content.startsWith("!begin")) {
    await memory.clear(); // Clear memory to reset the session
    message.reply("Welcome, adventurers! Your journey begins in a dark tavern. What would you like to do?");
    return;
  }

  try {
    // Retrieve past messages
    const pastMessages = await memory.loadMemoryVariables({});

    // Format prompt with memory and current user input
    const formattedPrompt = await prompt.format({
      input: `${message.author.username}: ${message.content}\n\nMemory: ${JSON.stringify(pastMessages.history)}`,
    });

    // Get AI response
    const response = await llm.invoke(formattedPrompt);

    // Save new interaction to memory
    await memory.saveContext({ input: message.content }, { output: response });

    message.reply(response);
  } catch (error) {
    console.error(error);
    message.reply("The Dungeon Master is momentarily lost in thought. Try again.");
  }
});

client.login(process.env.DISCORD_TOKEN);
