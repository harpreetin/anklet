const { Client, MessageMedia, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const Canvas = require("canvas");
const fs = require("fs");
const sharp = require("sharp");

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./session_data",
  }),
  puppeteer: {
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", // Windows path
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--disable-features=site-per-process",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  },
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ WhatsApp Bot is ready!");
});

client.on("message", async (message) => {
  if (message.body.startsWith("!quote")) {
    if (!message.hasQuotedMsg) {
      message.reply("❌ *Please reply to a message with !quote*");
      return;
    }

    const quotedMsg = await message.getQuotedMessage();
    const text = quotedMsg.body;

    // Get sender details
    const contact = await quotedMsg.getContact();
    const chat = await message.getChat(); // Get chat metadata
    let senderName = contact.pushname || contact.name;

    // Try fetching real name from group metadata (for unsaved contacts)
    if (!senderName && chat.isGroup) {
      const participant = chat.participants.find(p => p.id._serialized === quotedMsg.author);
      if (participant && participant.id.user) {
        senderName = participant.id.user; 
      }
    }

    // Get profile picture
    const profilePicUrl = await contact.getProfilePicUrl() || null;

    // Generate sticker
    let imagePath = await generateQuoteImage(senderName, text, profilePicUrl);
    let stickerPath = await convertToSticker(imagePath);
    const media = MessageMedia.fromFilePath(stickerPath);

    // Send the sticker
    client.sendMessage(message.from, media, { sendMediaAsSticker: true });
  }
});

client.initialize();

// Function to generate the quote image
async function generateQuoteImage(senderName, text, profilePicUrl) {
  const canvas = Canvas.createCanvas(512, 512);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height); // Transparent background

  // Load and draw the profile picture if available
  if (profilePicUrl) {
    try {
      const img = await Canvas.loadImage(profilePicUrl);
      ctx.drawImage(img, 20, 120, 80, 80); // Draw profile picture
    } catch (error) {
      console.log("⚠️ Error loading profile picture:", error);
    }
  }

  // Rounded rectangle for text bubble
  ctx.fillStyle = "#f0f0f0"; // Light gray background
  ctx.lineJoin = "round";
  ctx.lineWidth = 20;
  ctx.strokeStyle = "#f0f0f0";
  ctx.strokeRect(120, 100, 360, 250);
  ctx.fillRect(120, 100, 360, 250);

  // Sender's name (bold, blue)
  ctx.fillStyle = "#007bff"; 
  ctx.font = "bold 40px Arial"; 
  ctx.fillText(senderName, 140, 150); 

  // Message text (black)
  ctx.fillStyle = "#000000";
  ctx.font = "35px Arial"; 
  let lines = wrapText(ctx, text, 320);
  lines.forEach((line, i) => {
    ctx.fillText(line, 140, 200 + i * 45);
  });

  // Save image
  const imagePath = "./quote.png";
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(imagePath, buffer);

  return imagePath;
}

// Function to convert the image into a sticker
async function convertToSticker(imagePath) {
  const stickerPath = "./quote.webp";

  await sharp(imagePath)
    .resize(512, 512)
    .toFormat("webp")
    .toFile(stickerPath, { lossless: true });

  return stickerPath;
}

// Function to wrap long text into multiple lines
function wrapText(ctx, text, maxWidth) {
  let words = text.split(" ");
  let lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    let width = ctx.measureText(currentLine + " " + words[i]).width;
    if (width < maxWidth) {
      currentLine += " " + words[i];
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}
