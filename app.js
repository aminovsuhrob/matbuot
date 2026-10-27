from pathlib import Path
import re

src = Path("/mnt/data/Pasted text.txt").read_text(encoding="utf-8")

# Do not reproduce the exposed bot token in the rewritten client-side file.
src = re.sub(
    r'const TELEGRAM_BOT_TOKEN = "[^"]*";',
    'const TELEGRAM_BOT_TOKEN = "PASTE_NEW_BOT_TOKEN_HERE";',
    src
)
src = re.sub(
    r'const IMGBB_API_KEY = "[^"]*";',
    'const IMGBB_API_KEY = "PASTE_IMGBB_API_KEY_HERE";',
    src
)

old_upload = '''function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length > 10) { alert("Maksimum 10 ta rasm!"); return; }
    currentUploadedImages = [];
    const container = document.getElementById('image-preview-container');
    container.innerHTML = "";
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            currentUploadedImages.push(ev.target.result);
            container.innerHTML += `<img src="${ev.target.result}" class="w-full h-20 object-cover rounded-xl border border-slate-700">`;
        };
        reader.readAsDataURL(file);
    });
}'''

new_upload = '''async function handleImageUpload(e) {
    const files = Array.from(e.target.files || []);
    const container = document.getElementById('image-preview-container');
    currentUploadedImages = [];
    if (container) container.innerHTML = "";

    if (files.length > 10) {
        e.target.value = "";
        alert("Maksimum 10 ta rasm tanlash mumkin!");
        return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
            e.target.value = "";
            alert("Faqat JPG, PNG yoki WEBP formatidagi rasmlarni tanlang.");
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            e.target.value = "";
            alert(`"${file.name}" rasmi 8 MB dan katta. Kichikroq rasm tanlang.`);
            return;
        }
    }

    try {
        // FileReader natijalarini tartib bilan kutamiz; shu sababli rasm yo'qolib qolmaydi.
        currentUploadedImages = await Promise.all(files.map(file => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error(`"${file.name}" rasmini o'qib bo'lmadi.`));
            reader.readAsDataURL(file);
        })));

        if (container) {
            container.innerHTML = currentUploadedImages.map(img =>
                `<img src="${img}" class="w-full h-20 object-cover rounded-xl border border-slate-700">`
            ).join("");
        }
    } catch (error) {
        currentUploadedImages = [];
        if (container) container.innerHTML = "";
        alert(error.message || "Rasmlarni o'qishda xatolik yuz berdi.");
    }
}'''

if old_upload not in src:
    raise ValueError("Image upload function not found")
src = src.replace(old_upload, new_upload)

old_send = '''// Telegramga xavfsiz yuborish funksiyasi (rasm yuklanmasa ham matnni yuboradi)
async function sendPostToTelegramChannel(text, images) {
    let uploadedImageUrls = [];

    // Rasmlarni yuklab ko'rishga harakat qilamiz
    if (images && images.length > 0) {
        for (let imgBase64 of images) {
            try {
                let base64Data = imgBase64.split(',')[1];
                let formData = new FormData();
                formData.append('image', base64Data);

                let res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                    method: 'POST',
                    body: formData
                });
                let data = await res.json();
                if (data && data.success) {
                    uploadedImageUrls.push(data.data.url);
                }
            } catch (e) {
                console.warn("Rasm yuklashda tarmoq xatosi, o'tkazib yuborildi:", e);
            }
        }
    }

    // Telegramga yuborish
    try {
        if (uploadedImageUrls.length === 0) {
            // Faqat matn
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID, text: text })
            });
        } else if (uploadedImageUrls.length === 1) {
            // 1 ta rasm + matn
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHANNEL_ID,
                    photo: uploadedImageUrls[0],
                    caption: text
                })
            });
        } else {
            // Bir nechta rasm (MediaGroup albom)
            let mediaGroup = uploadedImageUrls.map((url, index) => ({
                type: 'photo',
                media: url,
                caption: index === 0 ? text : ''
            }));

            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHANNEL_ID,
                    media: mediaGroup
                })
            });
        }
        alert("E'lon kanalga va portalga muvaffaqiyatli chiqarildi!");
    } catch (err) {
        console.error("Telegramga yuborishda xatolik:", err);
        alert("Portalga saqlandi, lekin Telegramga yuborishda xatolik yuz berdi. Bot kanalda Admin ekanligini tekshiring.");
    }
}'''

new_send = '''// Rasmlarni ImgBB ga yuklaydi va Telegram API javobini albatta tekshiradi.
async function uploadImageToImgBB(imageData, index) {
    if (!IMGBB_API_KEY || IMGBB_API_KEY === "PASTE_IMGBB_API_KEY_HERE") {
        throw new Error("ImgBB API kaliti kiritilmagan. Kod boshidagi IMGBB_API_KEY sozlamasini to'ldiring.");
    }

    // Eski postlarda rasm URL ko'rinishida saqlangan bo'lsa, uni qayta yuklamaymiz.
    if (typeof imageData === "string" && /^https?:\\/\\//i.test(imageData)) {
        return imageData;
    }

    if (typeof imageData !== "string" || !imageData.includes(",")) {
        throw new Error(`${index + 1}-rasm formati noto'g'ri yoki rasm ma'lumoti bo'sh.`);
    }

    const base64Data = imageData.split(",")[1];
    if (!base64Data) throw new Error(`${index + 1}-rasm ma'lumoti topilmadi.`);

    const formData = new FormData();
    formData.append("image", base64Data);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(IMGBB_API_KEY)}`, {
        method: "POST",
        body: formData
    });

    let result;
    try {
        result = await response.json();
    } catch {
        throw new Error(`ImgBB ${index + 1}-rasm uchun tushunarsiz javob qaytardi.`);
    }

    if (!response.ok || !result || !result.success || !result.data || !result.data.url) {
        throw new Error(`ImgBB ${index + 1}-rasmni yuklay olmadi: ${result?.error?.message || response.statusText || "noma'lum xato"}`);
    }
    return result.data.url;
}

async function telegramApi(method, payload) {
    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === "PASTE_NEW_BOT_TOKEN_HERE") {
        throw new Error("Telegram bot tokeni kiritilmagan. Kod boshidagi TELEGRAM_BOT_TOKEN sozlamasini to'ldiring.");
    }

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    let result;
    try {
        result = await response.json();
    } catch {
        throw new Error("Telegram serveridan tushunarsiz javob keldi.");
    }

    if (!response.ok || !result.ok) {
        throw new Error(result?.description || `Telegram API xatosi (${response.status}).`);
    }
    return result;
}

async function sendPostToTelegramChannel(text, images = []) {
    const cleanText = (text || "").trim();
    const postImages = Array.isArray(images) ? images.filter(Boolean) : [];

    if (!cleanText && postImages.length === 0) {
        throw new Error("Yuborish uchun matn yoki rasm mavjud emas.");
    }
    if (!TELEGRAM_CHANNEL_ID) {
        throw new Error("TELEGRAM_CHANNEL_ID sozlamasi bo'sh.");
    }

    // Telegram caption chegarasi 1024 belgi. Uzun matn bo'lsa rasm bilan qisqa sarlavha,
    // so'ng to'liq matn alohida xabar sifatida yuboriladi.
    const caption = cleanText.length <= 1024 ? cleanText : cleanText.slice(0, 1010) + "…";

    if (postImages.length === 0) {
        await telegramApi("sendMessage", {
            chat_id: TELEGRAM_CHANNEL_ID,
            text: cleanText.slice(0, 4096)
        });
        return true;
    }

    // ImgBB ga barcha rasmlar muvaffaqiyatli yuklanmaguncha kanalga yuborishni boshlamaymiz.
    const imageUrls = await Promise.all(postImages.map((img, index) => uploadImageToImgBB(img, index)));

    if (imageUrls.length === 1) {
        await telegramApi("sendPhoto", {
            chat_id: TELEGRAM_CHANNEL_ID,
            photo: imageUrls[0],
            caption
        });
    } else {
        // Telegram albomida 2–10 ta media bo'lishi kerak.
        // 10 tadan ko'p bo'lsa bir nechta albomga bo'lib yuboramiz.
        for (let start = 0; start < imageUrls.length; start += 10) {
            const chunk = imageUrls.slice(start, start + 10);
            if (chunk.length === 1) {
                await telegramApi("sendPhoto", {
                    chat_id: TELEGRAM_CHANNEL_ID,
                    photo: chunk[0],
                    caption: start === 0 ? caption : ""
                });
            } else {
                const media = chunk.map((url, index) => ({
                    type: "photo",
                    media: url,
                    ...(start === 0 && index === 0 ? { caption } : {})
                }));
                await telegramApi("sendMediaGroup", {
                    chat_id: TELEGRAM_CHANNEL_ID,
                    media
                });
            }
        }
    }

    // Caption chegarasidan uzun bo'lgan to'liq matnni alohida yuboramiz.
    if (cleanText.length > 1024) {
        for (let i = 0; i < cleanText.length; i += 4000) {
            await telegramApi("sendMessage", {
                chat_id: TELEGRAM_CHANNEL_ID,
                text: cleanText.slice(i, i + 4000)
            });
        }
    }

    return true;
}'''

if old_send not in src:
    raise ValueError("Telegram send function not found")
src = src.replace(old_send, new_send)

# Prevent post being marked published if Telegram delivery fails.
old_approve = '''        // Telegram kanalga xavfsiz tarzda yuborish (xatolik bo'lsa ham matn borsa uchun)
        await sendPostToTelegramChannel(finalText, currentReviewPost.images || []);

        publishedPosts.unshift({'''
new_approve = '''        // Telegramga yuborish muvaffaqiyatli bo'lsagina postni e'lon qilingan deb belgilaymiz.
        const approveButton = document.getElementById('approve-publish-btn');
        approveButton.disabled = true;
        const originalButtonText = approveButton.textContent;
        approveButton.textContent = "Yuborilmoqda...";

        try {
            await sendPostToTelegramChannel(finalText, currentReviewPost.images || []);
        } catch (error) {
            console.error("Telegramga yuborishda xatolik:", error);
            alert("Telegramga yuborilmadi: " + (error.message || "Noma'lum xatolik") +
                "\\n\\nBot kanalga administrator qilib qo'shilganini, token va ImgBB API kalitini tekshiring.");
            approveButton.disabled = false;
            approveButton.textContent = originalButtonText;
            return;
        }

        publishedPosts.unshift({'''
if old_approve not in src:
    raise ValueError("Approval handler not found")
src = src.replace(old_approve, new_approve)

# Clear button state after successful action before modal closes.
src = src.replace('''        closeReviewModal();
        switchTab('published-posts');''','''        approveButton.disabled = false;
        approveButton.textContent = originalButtonText;
        closeReviewModal();
        switchTab('published-posts');''', 1)

out = Path("/mnt/data/sayt_telegram_matn_rasm_birlashtirilgan.js")
out.write_text(src, encoding="utf-8")
print(f"Tayyor: {out.name} | {len(src.splitlines())} qator | {out.stat().st_size} bayt")
