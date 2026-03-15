const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const imgurClientId = "fc9369e9aea767c";

module.exports = {
  config: {
    name: "rankup",
    version: "1.1.1",
    author: "VincentSensei",
    description: {
      vi: "Thông báo rankup cho từng nhóm",
      en: "Rankup notification for each group"
    },
    category: "system",
    usage: "rankup [on/off]",
    role: 0
  },

  langs: {
    vi: {
      on: "bật",
      off: "tắt",
      successText: "thành công thông báo rankup!",
      levelup: "★★ Chúc mừng {name} đã đạt level {level}",
      needImg: "Bạn cần cài đặt ảnh rankup trước! Dùng: setrankupimg <link>"
    },
    en: {
      on: "on",
      off: "off", 
      successText: "success notification rankup!",
      levelup: "★★ Congratulations {name} on reaching level {level}!",
      needImg: "You need to set a rankup image first! Use: setrankupimg <link>"
    }
  },

  onStart: async function({ message, event, threadsData, args, getLang, role }) {
    const { threadID } = event;
    
    // Show current status if no args
    if (!args[0]) {
      const rankupEnabled = await threadsData.get(threadID, "settings.rankupEnabled");
      const status = rankupEnabled ? "ON" : "OFF";
      return message.reply(`📊 Rankup Status: ${status}\nUse: rankup [on/off] (Admins only)`);
    }
    
    if (args[0] === "on" || args[0] === "off") {
      if (role < 1) return message.reply("❌ Only group admins can toggle the rankup settings.");
      
      const isOn = args[0] === "on";
      await threadsData.set(threadID, isOn, "settings.rankupEnabled");
      
      // Also set the message
      const defaultMsg = getLang("levelup");
      await threadsData.set(threadID, defaultMsg, "data.rankup.message");
      
      return message.reply(`${isOn ? getLang("on") : getLang("off")} ${getLang("successText")}`);
    }
    
    return message.reply(`Usage: rankup [on/off]`);
  },

  onChat: async function({ api, event, usersData, threadsData, message, getLang }) {
    const { threadID, senderID } = event;
    
    // Check if rankup is enabled for this thread (enabled by default)
    const rankupEnabled = await threadsData.get(threadID, "settings.rankupEnabled");
    if (rankupEnabled === false) {
      return;
    }

    // Get current exp and increment it
    const userData = await usersData.get(senderID);
    const exp = (userData?.exp || 0) + 1;
    
    // Update exp
    await usersData.set(senderID, { exp });
    
    // Calculate level before and after using Goatbot's standard formula
    const deltaNext = 5;
    const prevExp = Math.max(0, exp - 1);
    const prevLevel = Math.floor((1 + Math.sqrt(1 + 8 * prevExp / deltaNext)) / 2);
    const currentLevel = Math.floor((1 + Math.sqrt(1 + 8 * exp / deltaNext)) / 2);

    // Check if leveled up (current level > previous level, and not level 1)
    if (currentLevel > prevLevel && currentLevel !== 1) {
      const name = await usersData.getName(senderID) || "User";
      
      // Get custom message or default
      let rankupMessage = await threadsData.get(threadID, "data.rankup.message");
      if (!rankupMessage) {
        rankupMessage = getLang("levelup");
      }
      
      rankupMessage = rankupMessage
        .replace(/{name}/g, name)
        .replace(/{level}/g, currentLevel)
        .replace(/{userName}/g, name);

      // Use message.reply like other commands do
      let replyBody = {
        body: rankupMessage,
        mentions: [{ tag: name, id: senderID }]
      };

      try {
        const axios = require("axios");
        const fs = require("fs-extra");
        const path = require("path");
        const imgPath = path.join(__dirname, `rankup_${senderID}_${Date.now()}.png`);

        const response = await axios({
            url: `https://rankup-api-b1rv.vercel.app/api/rankup?uid=${senderID}`,
            method: 'GET',
            responseType: 'stream',
            timeout: 10000 // 10 second timeout
        });

        const writer = fs.createWriteStream(imgPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        replyBody.attachment = fs.createReadStream(imgPath);

        await message.reply(replyBody);

        // Cleanup image
        fs.unlink(imgPath).catch(console.error);

      } catch (e) {
        console.error("Error loading rankup image from API:", e.message);
        // Fallback to sending just text if the image fails to generate
        await message.reply(replyBody);
      }
    }
  }
};
