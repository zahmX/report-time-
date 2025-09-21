import { Telegraf } from "telegraf";
import cron from "node-cron";

// --- CONFIG ---
const BOT_TOKEN = process.env.BOT_TOKEN; // your bot token in Railway variables
const TARGET_CHAT_ID = "@oxyfinds01"; // Public channel username
const LOG_CHANNEL_ID = "-1002941317670"; // Your private channel ID

const bot = new Telegraf(BOT_TOKEN);

// In-memory counters
let counters = { total: 0, admins: {} };
let channelAdmins = [];

// --- Refresh channel admin list ---
async function refreshChannelAdmins() {
  try {
    const admins = await bot.telegram.getChatAdministrators(TARGET_CHAT_ID);
    channelAdmins = admins.map(a => ({
      id: a.user.id,
      name: a.user.username ? `@${a.user.username}` : a.user.first_name || `User${a.user.id}`
    }));
    console.log("✅ Channel admins refreshed:", channelAdmins.map(a => a.name));
  } catch (err) {
    console.error("❌ Failed to fetch channel admins:", err.message);
  }
}

// refresh admin list every hour
await refreshChannelAdmins();
setInterval(refreshChannelAdmins, 3600 * 1000);

// --- Count messages in the channel ---
bot.on("channel_post", async (ctx) => {
  const fromId = ctx.channelPost.sender_chat?.id || ctx.channelPost.from?.id;
  counters.total++;

  const admin = channelAdmins.find(a => a.id === fromId);
  if (admin) {
    if (!counters.admins[admin.id]) counters.admins[admin.id] = 0;
    counters.admins[admin.id]++;
  }

  console.log(`📥 Message counted. Total so far: ${counters.total}`);
});

// --- Send daily report at 00:00 UTC ---
cron.schedule("0 0 * * *", async () => {
  console.log("🕛 Sending daily report...");

  let report = `📊 **Daily Channel Report** (UTC)\n\n📩 Total messages: ${counters.total}\n\n`;

  if (channelAdmins.length > 0) {
    report += "👥 **Admin activity:**\n";
    for (const admin of channelAdmins) {
      const count = counters.admins[admin.id] || 0;
      report += `• ${admin.name}: ${count}\n`;
    }
  } else {
    report += "⚠️ Could not fetch admin list.\n";
  }

  try {
    await bot.telegram.sendMessage(LOG_CHANNEL_ID, report, { parse_mode: "Markdown" });
    console.log("✅ Daily report sent to private channel.");
    counters = { total: 0, admins: {} }; // reset counters
  } catch (err) {
    console.error("❌ Failed to send report:", err.message);
  }
});

bot.launch();
console.log("✅ Bot is running, counting messages & scheduling daily report at 00:00 UTC...");
