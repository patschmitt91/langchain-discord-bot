require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const { ChatOpenAI } = require("@langchain/openai");
const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { ChromaClient } = require("chromadb");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } = require("@langchain/core/prompts");
const sqlite3 = require('sqlite3').verbose();

// Initialize SQLite database
const db = new sqlite3.Database('./dnd_campaign.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT,
      content TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

const chromaClient = new ChromaClient({ path: "http://localhost:8000" }); // If running locally

// Initialize OpenAI Embeddings (FIXES THE ERROR)
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY, // Make sure this is set in .env
});

// Connect Chroma vector store with embeddings
const vectorStore = new Chroma(embeddings, {
  collectionName: "dnd_campaign_memory",
  client: chromaClient,
});

// Example query function
async function searchMemory(query) {
  const results = await vectorStore.similaritySearch(query, 3);
  console.log(results);
}
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4-turbo",
  maxTokens: 1000,
  temperature: 0.0,
});

const ALLOWED_CHANNEL_ID = process.env.ALLOWED_CHANNEL_ID; 
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

// Function to fetch past messages from ChromaDB
async function getConversationHistory() {
  const query = 'What happened in the last session?';
  const results = await vectorStore.similaritySearch(query, 5); // Get last 5 messages
  return results.map((doc) => doc.pageContent).join("\n");
}

async function deleteCampaignMemory() {
  try {
    await chromaClient.deleteCollection({ name: "dnd_campaign" });
    console.log("Deleted collection: dnd_campaign");
  } catch (error) {
    console.error("Error deleting collection:", error);
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.channel.id !== ALLOWED_CHANNEL_ID) return;

  if (message.content.startsWith("!begin")) {
    await deleteCampaignMemory();
    message.reply("Welcome, adventurers! Your journey begins in a dark tavern. What would you like to do?");
    return;
  }

  try {
    // Fetch previous conversation history
    const pastMessages = await getConversationHistory();

    // Format prompt with history and user input
    const formattedPrompt = await prompt.format({
      input: `${message.author.username}: ${message.content}\n\nMemory: ${pastMessages}`,
    });

    // Get AI response
    const response = await llm.invoke(formattedPrompt);

    // Save the conversation in ChromaDB
    await vectorStore.addDocuments([
      { pageContent: `${message.author.username}: ${message.content}`, metadata: { user: message.author.id } },
      { pageContent: `DM: ${response}`, metadata: { user: "DM" } },
    ]);

    message.reply(response);
  } catch (error) {
    console.error(error);
    message.reply("The Dungeon Master is momentarily lost in thought. Try again.");
  }
});

client.login(process.env.DISCORD_TOKEN);
