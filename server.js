const express = require("express");
const multer = require("multer");
const path = require("path");

const app = express();
const upload = multer(); // Rasmlarni xotirada vaqtincha ushlab turish uchun

app.use(express.json());
app.use(express.static(path.join(__dirname))); // Frontend fayllarini o'qishi uchun

// Telegramga rasm va matn yuborish endpointi
app.post("/api/telegram-photos", upload.array("photos", 10), async (req, res) => {
    try {
        const files = req.files;
        const caption = req.body.caption || "";
        // O'z bot tokeningizni shu yerga yozasiz yoki .env dan o'qiysiz
        const botToken = "8663230324:AAHdaSKIpPkb-3-XzfVTrWyDmdvQq84TOcQ";
        const chatId = "@matbuot_2026";

        if (!files || files.length === 0) {
            // Faqat matn bo'lsa
            const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text: caption })
            });
            const result = await response.json();
            return res.status(response.ok ? 200 : 400).json(result);
        }

        if (files.length === 1) {
            // 1 ta rasm va matn
            const form = new FormData();
            form.append("chat_id", chatId);
            form.append("caption", caption);
            form.append("photo", new Blob([files[0].buffer], { type: files[0].mimetype }), files[0].originalname);

            const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                method: "POST",
                body: form
            });
            const result = await response.json();
            return res.status(response.ok ? 200 : 400).json(result);
        } else {
            // Bir nechta rasm (Albom shaklida - MediaGroup)
            const form = new FormData();
            form.append("chat_id", chatId);

            const mediaArray = files.map((file, index) => {
                const fieldName = `attach_${index}`;
                form.append(fieldName, new Blob([file.buffer], { type: file.mimetype }), file.originalname);
                return {
                    type: "photo",
                    media: `attach://${fieldName}`,
                    caption: index === 0 ? caption : "" // Sarlavha faqat birinchi rasmga yoziladi
                };
            });

            form.append("media", JSON.stringify(mediaArray));

            const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
                method: "POST",
                body: form
            });
            const result = await response.json();
            return res.status(response.ok ? 200 : 400).json(result);
        }
    } catch (xato) {
        res.status(500).json({ error: xato.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ishga tushdi: http://localhost:${PORT}`);
});
