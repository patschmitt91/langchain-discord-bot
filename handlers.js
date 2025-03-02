const { vectorStore, chromaClient } = require('./chroma');
const prompt = require('./prompts');
const llm = require('./openai');
const db = require('./database'); // TODO - Refactor


// TODO - Refactor / refine query
async function getConversationHistory() {
  const query = 'What happened in the last session?';
  const results = await vectorStore.similaritySearch(query, 5);
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

async function handleMessage(message) {
  if (message.author.bot) return;
    
  if (message.channel.id !== process.env.ALLOWED_CHANNEL_ID) return;

  if (message.content.startsWith("!begin")) {
    await deleteCampaignMemory();
    message.reply("Welcome, adventurers! Your journey begins in a dark tavern. What would you like to do?");
    return;
  }

  try {
    const pastMessages = await getConversationHistory();
    const formattedPrompt = await prompt.format({
      input: `${message.author.username}: ${message.content}\n\nMemory: ${pastMessages}`,
    });
    const response = await llm.invoke(formattedPrompt);
    await vectorStore.addDocuments([
      { pageContent: `${message.author.username}: ${message.content}`, metadata: { user: message.author.id } },
      { pageContent: `DM: ${response}`, metadata: { user: "DM" } },
    ]);
    message.reply(response);
  } catch (error) {
    console.error(error);
    message.reply("The Dungeon Master is momentarily lost in thought. Try again.");
  }
}

module.exports = { handleMessage };