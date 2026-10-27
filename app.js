import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    onValue
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

/* =========================================================
   1. FIREBASE SOZLAMALARI
========================================================= */

const firebaseConfig = {
    apiKey: "FIREBASE_API_KEY",
    authDomain: "fakultet-hujjatlari.firebaseapp.com",
    databaseURL: "https://fakultet-hujjatlari-default-rtdb.firebaseio.com",
    projectId: "fakultet-hujjatlari",
    storageBucket: "fakultet-hujjatlari.firebasestorage.app",
    messagingSenderId: "459968500801",
    appId: "1:459968500801:web:0463f1607375e67ff4a2c0"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* =========================================================
   2. TELEGRAM VA RASM SOZLAMALARI
========================================================= */

// XAVFSIZLIK UCHUN YANGI BOT TOKENINI KIRITING.
// Haqiqiy saytda tokenni server tomonida saqlash tavsiya etiladi.

const TELEGRAM_BOT_TOKEN = "YANGI_BOT_TOKENINGIZ";
const TELEGRAM_CHANNEL_ID = "@matbuot_2026";
const IMGBB_API_KEY = "IMGBB_API_KALITINGIZ";

/* =========================================================
   3. DASTUR MA'LUMOTLARI
========================================================= */

const defaultUsers = [
    {
        username: "admin",
        password: "admin123",
        name: "Bosh Admin",
        role: "admin",
        dept: "Matbuot Xizmati Markazi",
        hashtag: "#VetMatbuot",
        avatar: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
    },
    {
        username: "anatomiya",
        password: "pass1",
        name: "Prof. Karimov T.",
        role: "user",
        dept: "Hayvonlar anatomiyasi, gistologiyasi va patologik anatomiya kafedrasi",
        hashtag: "#VetAnatomiya",
        avatar: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
    },
    {
        username: "yuqumsiz",
        password: "pass2",
        name: "Dr. Toshmatov B.",
        role: "user",
        dept: "Ichki yuqumsiz kasalliklar kafedrasi",
        hashtag: "#VetYuqumsiz",
        avatar: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
    },
    {
        username: "jarrohlik",
        password: "pass3",
        name: "Prof. Alimov S.",
        role: "user",
        dept: "Veterinariya jarrohligi va akusherlik kafedrasi",
        hashtag: "#VetJarrohlik",
        avatar: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
    },
    {
        username: "epizootologiya",
        password: "pass4",
        name: "Dr. Rahmonov D.",
        role: "user",
        dept: "Epizootologiya va infeksion kasalliklar kafedrasi",
        hashtag: "#VetEpizootologiya",
        avatar: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
    },
    {
        username: "parazitologiya",
        password: "pass5",
        name: "Prof. Umarov M.",
        role: "user",
        dept: "Parazitologiya kafedrasi",
        hashtag: "#VetParazitologiya",
        avatar: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
    }
];

let usersDB = [];
let pendingPosts = [];
let publishedPosts = [];
let rejectedPosts = [];

let socialLinks = {
    telegram: "https://t.me/matbuot_2026",
    instagram: "https://instagram.com/samvet_uz",
    facebook: "https://facebook.com/samvet"
};

let currentUser = JSON.parse(localStorage.getItem("currentUser")) || null;
let currentReviewPost = null;
let editingPublishedId = null;
let currentUploadedImages = [];
let windowModalAvatar = "";

const quizData = [
    {
        q: "Qaysi hayvon asosiy qoramol vabosi qo'zg'atuvchisiga chidamliroq?",
        options: ["Ot", "Qo'y", "Tuyalar", "Cho'chqa"],
        answer: 2
    },
    {
        q: "Veterinariya amaliyotida eng ko'p ishlatiladigan antiseptik eritma?",
        options: ["Yod", "Furasilin", "Margansovka", "Hammasi"],
        answer: 3
    },
    {
        q: "Katta yoshdagi qoramollarning normal tana harorati qanday?",
        options: [
            "37.5 - 39.0 °C",
            "38.0 - 39.5 °C",
            "39.0 - 40.5 °C",
            "36.0 - 37.5 °C"
        ],
        answer: 1
    }
];

let currentQuizIndex = 0;

/* =========================================================
   4. TELEGRAM API
========================================================= */

async function telegramApi(method, payload) {
    if (
        !TELEGRAM_BOT_TOKEN ||
        TELEGRAM_BOT_TOKEN === "YANGI_BOT_TOKENINGIZ"
    ) {
        throw new Error("Telegram bot tokeni kiritilmagan.");
    }

    const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        }
    );

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("Telegram serveridan javobni o'qib bo'lmadi.");
    }

    if (!response.ok || !result.ok) {
        throw new Error(
            result.description || `Telegram API xatosi: ${response.status}`
        );
    }

    return result;
}

/* =========================================================
   5. RASMNI IMGBB GA YUKLASH
========================================================= */

async function uploadImageToImgBB(imageData, index) {
    if (
        !IMGBB_API_KEY ||
        IMGBB_API_KEY === "IMGBB_API_KALITINGIZ"
    ) {
        throw new Error("ImgBB API kaliti kiritilmagan.");
    }

    // Agar rasm allaqachon internetdagi havola bo'lsa,
    // uni qaytadan yuklash shart emas.
    if (
        typeof imageData === "string" &&
        /^https?:\/\//i.test(imageData)
    ) {
        return imageData;
    }

    if (
        typeof imageData !== "string" ||
        !imageData.includes(",")
    ) {
        throw new Error(`${index + 1}-rasm ma'lumoti noto'g'ri.`);
    }

    const base64Data = imageData.split(",")[1];

    if (!base64Data) {
        throw new Error(`${index + 1}-rasm bo'sh.`);
    }

    const formData = new FormData();
    formData.append("image", base64Data);

    const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${encodeURIComponent(IMGBB_API_KEY)}`,
        {
            method: "POST",
            body: formData
        }
    );

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("ImgBB serveridan javob olinmadi.");
    }

    if (
        !response.ok ||
        !result.success ||
        !result.data ||
        !result.data.url
    ) {
        throw new Error(
            `Rasmni yuklash amalga oshmadi: ${
                result?.error?.message || "ImgBB xatosi"
            }`
        );
    }

    return result.data.url;
}

/* =========================================================
   6. SAYTDAN RASM TANLASH VA KO'RSATISH
========================================================= */

async function handleImageUpload(event) {
    const files = Array.from(event.target.files || []);

    const container = document.getElementById(
        "image-preview-container"
    );

    currentUploadedImages = [];

    if (container) {
        container.innerHTML = "";
    }

    if (files.length > 10) {
        event.target.value = "";
        alert("Bir vaqtda ko'pi bilan 10 ta rasm tanlang.");
        return;
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
            event.target.value = "";
            alert("Faqat JPG, PNG yoki WEBP rasmlarini tanlang.");
            return;
        }

        if (file.size > 8 * 1024 * 1024) {
            event.target.value = "";
            alert(
                `${file.name} rasmi 8 MB dan katta. Kichikroq rasm tanlang.`
            );
            return;
        }
    }

    try {
        currentUploadedImages = await Promise.all(
            files.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();

                    reader.onload = () => resolve(reader.result);

                    reader.onerror = () => {
                        reject(
                            new Error(`${file.name} rasmini o'qib bo'lmadi.`)
                        );
                    };

                    reader.readAsDataURL(file);
                });
            })
        );

        if (container) {
            container.innerHTML = currentUploadedImages
                .map(image => `
                    <img
                        src="${image}"
                        class="w-full h-20 object-cover rounded-xl border border-slate-700"
                        alt="Tanlangan rasm"
                    >
                `)
                .join("");
        }
    } catch (error) {
        currentUploadedImages = [];

        if (container) {
            container.innerHTML = "";
        }

        alert(error.message || "Rasmlarni o'qishda xatolik yuz berdi.");
    }
}

/* =========================================================
   7. TELEGRAM KANALIGA MATN VA RASMLARNI YUBORISH
========================================================= */

async function sendPostToTelegramChannel(text, images = []) {
    const cleanText = (text || "").trim();

    const postImages = Array.isArray(images)
        ? images.filter(Boolean)
        : [];

    if (!cleanText && postImages.length === 0) {
        throw new Error("Yuborish uchun matn yoki rasm mavjud emas.");
    }

    if (!TELEGRAM_CHANNEL_ID) {
        throw new Error("Telegram kanal manzili kiritilmagan.");
    }

    /*
       Telegramda rasm ostidagi caption 1024 belgigacha.
       Uzun matn bo'lsa, qolgan qismi alohida xabar qilinadi.
    */

    const caption = cleanText.length <= 1024
        ? cleanText
        : cleanText.slice(0, 1010) + "…";

    // Faqat matn yuborish
    if (postImages.length === 0) {
        for (let i = 0; i < cleanText.length; i += 4000) {
            await telegramApi("sendMessage", {
                chat_id: TELEGRAM_CHANNEL_ID,
                text: cleanText.slice(i, i + 4000)
            });
        }

        return true;
    }

    // Barcha rasmlarni avval ImgBB ga yuklaymiz.
    const imageUrls = await Promise.all(
        postImages.map((image, index) =>
            uploadImageToImgBB(image, index)
        )
    );

    // Bitta rasm va matn
    if (imageUrls.length === 1) {
        await telegramApi("sendPhoto", {
            chat_id: TELEGRAM_CHANNEL_ID,
            photo: imageUrls[0],
            caption
        });
    } else {
        /*
           Telegram albomida 2–10 ta rasm bo'lishi mumkin.
           10 tadan ko'p rasm bo'lsa, alohida albomlarga ajratiladi.
        */

        for (let start = 0; start < imageUrls.length; start += 10) {
            const chunk = imageUrls.slice(start, start + 10);

            if (chunk.length === 1) {
                await telegramApi("sendPhoto", {
                    chat_id: TELEGRAM_CHANNEL_ID,
                    photo: chunk[0],
                    caption: start === 0 ? caption : ""
                });

                continue;
            }

            const media = chunk.map((url, index) => {
                const item = {
                    type: "photo",
                    media: url
                };

                if (start === 0 && index === 0 && caption) {
                    item.caption = caption;
                }

                return item;
            });

            await telegramApi("sendMediaGroup", {
                chat_id: TELEGRAM_CHANNEL_ID,
                media
            });
        }
    }

    // Matn uzun bo'lsa, captionga sig'magan qismi yuboriladi.
    if (cleanText.length > 1024) {
        for (let i = 1024; i < cleanText.length; i += 4000) {
            await telegramApi("sendMessage", {
                chat_id: TELEGRAM_CHANNEL_ID,
                text: cleanText.slice(i, i + 4000)
            });
        }
    }

    return true;
}

/* =========================================================
   8. SAYTGA POST YUBORISH
========================================================= */

function handlePostSubmit(event) {
    event.preventDefault();

    if (!currentUser) {
        alert("Avval tizimga kiring.");
        return;
    }

    const rawText = document
        .getElementById("post-raw-text")
        .value.trim();

    if (!rawText && currentUploadedImages.length === 0) {
        alert("Matn yozing yoki rasm tanlang.");
        return;
    }

    const newPost = {
        id: Date.now(),
        author: currentUser.name,
        dept: currentUser.dept,
        username: currentUser.username,
        hashtag: currentUser.hashtag || "#VetFakultet",
        rawText,
        images: [...currentUploadedImages],
        status: "pending"
    };

    pendingPosts.unshift(newPost);

    set(ref(db, "pendingPosts"), pendingPosts)
        .then(() => {
            alert("Post adminga yuborildi.");

            document.getElementById("create-post-form").reset();

            const preview = document.getElementById(
                "image-preview-container"
            );

            if (preview) {
                preview.innerHTML = "";
            }

            currentUploadedImages = [];

            switchTab("my-posts");
        })
        .catch(error => {
            console.error("Firebase xatosi:", error);
            alert("Post saqlanmadi. Firebase sozlamalarini tekshiring.");
        });
}

/* =========================================================
   9. FIREBASE MA'LUMOTLARINI SINXRONLASH
========================================================= */

function initFirebaseSync() {
    onValue(ref(db, "usersDB"), snapshot => {
        const data = snapshot.val();

        if (data) {
            usersDB = Array.isArray(data)
                ? data
                : Object.values(data);
        } else {
            usersDB = defaultUsers;

            set(ref(db, "usersDB"), defaultUsers);
        }

        if (currentUser) {
            const latest = usersDB.find(
                user => user.username === currentUser.username
            );

            if (latest) {
                currentUser = latest;

                localStorage.setItem(
                    "currentUser",
                    JSON.stringify(currentUser)
                );
            }
        }

        renderUsers();
    });

    onValue(ref(db, "pendingPosts"), snapshot => {
        const data = snapshot.val();

        pendingPosts = data
            ? Object.values(data)
            : [];

        renderPendingPosts();
        renderMyPosts();
    });

    onValue(ref(db, "publishedPosts"), snapshot => {
        const data = snapshot.val();

        publishedPosts = data
            ? Object.values(data)
            : [];

        renderPublishedPosts();
        renderMyPosts();
    });

    onValue(ref(db, "rejectedPosts"), snapshot => {
        const data = snapshot.val();

        rejectedPosts = data
            ? Object.values(data)
            : [];

        renderMyPosts();
    });

    onValue(ref(db, "socialLinks"), snapshot => {
        const data = snapshot.val();

        if (data) {
            socialLinks = data;

            const telegram = document.getElementById(
                "setting-telegram"
            );

            const instagram = document.getElementById(
                "setting-instagram"
            );

            const facebook = document.getElementById(
                "setting-facebook"
            );

            if (telegram) telegram.value = socialLinks.telegram || "";
            if (instagram) instagram.value = socialLinks.instagram || "";
            if (facebook) facebook.value = socialLinks.facebook || "";
        }
    });

    if (currentUser) {
        showApp();
    } else {
        document.getElementById("login-screen").classList.remove("hidden");
        document.getElementById("app-content").classList.add("hidden");
    }
}

/* =========================================================
   10. ADMIN POSTNI TASDIQLASH
========================================================= */

window.openReviewModal = function(id) {
    const post = pendingPosts.find(item => item.id === id);

    if (!post) {
        alert("Post topilmadi.");
        return;
    }

    currentReviewPost = post;

    document.getElementById("modal-dept-badge").textContent =
        `Yuboruvchi kafedra: ${post.dept}`;

    renderReviewModalImages();

    const defaultHashtag = post.hashtag || "#VetFakultet";

    document.getElementById("modal-final-text").value =
`${defaultHashtag}

📖 AMALIY CHIQISH DARSI

🌱 Universitetning Veterinariya profilaktikasi va davolash fakulteti "${post.dept}" tomonidan talabalar uchun navbatdagi amaliy mashg'ulot tashkil etildi.

✍️ ${post.rawText || ""}

🚀 Bunday mashg'ulotlar bo'lajak veterinariya mutaxassislarining bilim va ko'nikmalarini rivojlantirishda muhim ahamiyat kasb etadi.

🏛️ Veterinariya profilaktikasi va davolash fakulteti Axborot xizmati`;

    document.getElementById("reject-reason-input").value = "";
    document.getElementById("ai-review-modal").classList.remove("hidden");

    document.getElementById("approve-publish-btn").onclick =
        async function() {
            if (!currentReviewPost) {
                alert("Tasdiqlanadigan post topilmadi.");
                return;
            }

            const button = this;
            const finalText = document
                .getElementById("modal-final-text")
                .value.trim();

            if (!finalText && !(currentReviewPost.images || []).length) {
                alert("Yuborish uchun matn yoki rasm mavjud emas.");
                return;
            }

            const oldText = button.textContent;

            button.disabled = true;
            button.textContent = "Telegramga yuborilmoqda...";

            try {
                // Birinchi navbatda Telegramga yuboriladi.
                await sendPostToTelegramChannel(
                    finalText,
                    currentReviewPost.images || []
                );

                const now = new Date();

                const publishedPost = {
                    ...currentReviewPost,
                    finalText,
                    publishedAt:
                        `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                        })}`,
                    status: "published",
                    reactions: {
                        "👍": 0,
                        "❤️": 0,
                        "🔥": 0,
                        "👏": 0,
                        "😢": 0
                    },
                    userReactions: {}
                };

                const newPublished = [
                    publishedPost,
                    ...publishedPosts.filter(
                        item => item.id !== publishedPost.id
                    )
                ];

                const newPending = pendingPosts.filter(
                    item => item.id !== currentReviewPost.id
                );

                // Ikkala ma'lumot ham saqlangandagina tasdiqlash tugaydi.
                await Promise.all([
                    set(ref(db, "publishedPosts"), newPublished),
                    set(ref(db, "pendingPosts"), newPending)
                ]);

                publishedPosts = newPublished;
                pendingPosts = newPending;

                renderPublishedPosts();
                renderPendingPosts();
                renderMyPosts();

                alert("Post Telegram kanaliga muvaffaqiyatli yuborildi.");

                closeReviewModal();
                switchTab("published-posts");
            } catch (error) {
                console.error("Post yuborish xatosi:", error);

                alert(
                    "Postni yuborishda xatolik yuz berdi:\n\n" +
                    (error.message || "Noma'lum xatolik") +
                    "\n\nBot kanalga administrator qilib qo'shilganini, " +
                    "tokenni va ImgBB API kalitini tekshiring."
                );
            } finally {
                button.disabled = false;
                button.textContent = oldText;
            }
        };
};

/* =========================================================
   11. MODERATSIYA RASMLARI
========================================================= */

function renderReviewModalImages() {
    const container = document.getElementById("modal-images-gallery");

    if (!container) return;

    container.innerHTML = "";

    const images = currentReviewPost?.images || [];

    if (!images.length) {
        container.innerHTML =
            '<span class="text-xs text-slate-500">Rasmlar mavjud emas</span>';

        return;
    }

    images.forEach((image, index) => {
        const wrapper = document.createElement("div");
        wrapper.className = "relative";

        const img = document.createElement("img");
        img.src = image;
        img.className = "gallery-thumb";
        img.alt = `Rasm ${index + 1}`;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.textContent = "×";
        removeButton.className =
            "absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-7 h-7";

        removeButton.onclick = () => {
            currentReviewPost.images.splice(index, 1);
            renderReviewModalImages();
        };

        wrapper.append(img, removeButton);
        container.appendChild(wrapper);
    });
}

window.closeReviewModal = function() {
    document.getElementById("ai-review-modal").classList.add("hidden");
};

window.rejectPostAction = function() {
    const reason = document
        .getElementById("reject-reason-input")
        .value.trim();

    if (!reason) {
        alert("Rad etish sababini kiriting.");
        return;
    }

    if (!currentReviewPost) return;

    const rejectedPost = {
        ...currentReviewPost,
        status: "rejected",
        rejectReason: reason
    };

    const newPending = pendingPosts.filter(
        item => item.id !== currentReviewPost.id
    );

    const newRejected = [
        rejectedPost,
        ...rejectedPosts.filter(
            item => item.id !== rejectedPost.id
        )
    ];

    Promise.all([
        set(ref(db, "pendingPosts"), newPending),
        set(ref(db, "rejectedPosts"), newRejected)
    ])
        .then(() => {
            pendingPosts = newPending;
            rejectedPosts = newRejected;

            renderPendingPosts();
            renderMyPosts();

            alert("Post rad etildi.");
            closeReviewModal();
        })
        .catch(error => {
            console.error(error);
            alert("Postni rad etishda xatolik yuz berdi.");
        });
};

/* =========================================================
   12. LOGIN VA DASTURNI ISHGA TUSHIRISH
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initFirebaseSync();

    const loginForm = document.getElementById("login-form");

    if (loginForm) {
        loginForm.addEventListener("submit", event => {
            event.preventDefault();

            const username = document
                .getElementById("username")
                .value.trim();

            const password = document
                .getElementById("password")
                .value.trim();

            const user = usersDB.find(
                item =>
                    item.username === username &&
                    item.password === password
            );

            if (user) {
                currentUser = user;

                localStorage.setItem(
                    "currentUser",
                    JSON.stringify(user)
                );

                document.getElementById("login-error")
                    .classList.add("hidden");

                showApp();
            } else {
                document.getElementById("login-error")
                    .classList.remove("hidden");
            }
        });
    }

    const imageInput = document.getElementById("post-images-input");

    if (imageInput) {
        imageInput.addEventListener("change", handleImageUpload);
    }

    const postForm = document.getElementById("create-post-form");

    if (postForm) {
        postForm.addEventListener("submit", handlePostSubmit);
    }

    const profileForm = document.getElementById("profile-form");

    if (profileForm) {
        profileForm.addEventListener("submit", handleProfileUpdate);
    }

    const profilePhoto = document.getElementById("profile-photo-input");

    if (profilePhoto) {
        profilePhoto.addEventListener("change", handleAvatarUpload);
    }

    const modalPhoto = document.getElementById("modal-dept-photo");

    if (modalPhoto) {
        modalPhoto.addEventListener("change", handleModalAvatarUpload);
    }

    const addUserForm = document.getElementById("add-user-form");

    if (addUserForm) {
        addUserForm.addEventListener("submit", handleAddNewUser);
    }

    const socialForm = document.getElementById("social-settings-form");

    if (socialForm) {
        socialForm.addEventListener("submit", event => {
            event.preventDefault();

            socialLinks.telegram =
                document.getElementById("setting-telegram").value;

            socialLinks.instagram =
                document.getElementById("setting-instagram").value;

            socialLinks.facebook =
                document.getElementById("setting-facebook").value;

            set(ref(db, "socialLinks"), socialLinks)
                .then(() => alert("Ijtimoiy tarmoq havolalari yangilandi!"))
                .catch(error => {
                    console.error(error);
                    alert("Havolalarni saqlashda xatolik yuz berdi.");
                });
        });
    }

    loadQuizQuestion();
});

/* =========================================================
   13. PROFIL VA AVATAR
========================================================= */

function handleAvatarUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = async event => {
        currentUser.avatar = event.target.result;

        document.getElementById("profile-avatar-preview").src =
            event.target.result;

        document.getElementById("header-user-avatar").src =
            event.target.result;

        const index = usersDB.findIndex(
            user => user.username === currentUser.username
        );

        if (index !== -1) {
            usersDB[index].avatar = event.target.result;

            try {
                await set(ref(db, `usersDB/${index}`), usersDB[index]);

                localStorage.setItem(
                    "currentUser",
                    JSON.stringify(currentUser)
                );
            } catch (error) {
                console.error(error);
                alert("Profil rasmini saqlashda xatolik yuz berdi.");
            }
        }
    };

    reader.readAsDataURL(file);
}

function handleModalAvatarUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = event => {
        document.getElementById("modal-dept-avatar").src =
            event.target.result;

        windowModalAvatar = event.target.result;
    };

    reader.readAsDataURL(file);
}

function handleProfileUpdate(event) {
    event.preventDefault();

    if (!currentUser) return;

    currentUser.name = document
        .getElementById("profile-name")
        .value.trim();

    currentUser.username = document
        .getElementById("profile-username")
        .value.trim();

    currentUser.password = document
        .getElementById("profile-password")
        .value.trim();

    const index = usersDB.findIndex(
        user => user.dept === currentUser.dept
    );

    if (index === -1) {
        alert("Foydalanuvchi topilmadi.");
        return;
    }

    usersDB[index] = currentUser;

    set(ref(db, `usersDB/${index}`), currentUser)
        .then(() => {
            localStorage.setItem(
                "currentUser",
                JSON.stringify(currentUser)
            );

            alert("Profil ma'lumotlari yangilandi!");
            showApp();
        })
        .catch(error => {
            console.error(error);
            alert("Profilni saqlashda xatolik yuz berdi.");
        });
}

/* =========================================================
   14. ASOSIY INTERFEYS
========================================================= */

function showApp() {
    if (!currentUser) return;

    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("app-content").classList.remove("hidden");

    document.getElementById("user-display-name").textContent =
        currentUser.name;

    document.getElementById("user-role-badge").textContent =
        currentUser.dept;

    document.getElementById("dash-user-name").textContent =
        currentUser.name;

    if (currentUser.avatar) {
        document.getElementById("header-user-avatar").src =
            currentUser.avatar;

        document.getElementById("profile-avatar-preview").src =
            currentUser.avatar;
    }

    document.getElementById("profile-dept").value =
        currentUser.dept || "";

    document.getElementById("profile-name").value =
        currentUser.name || "";

    document.getElementById("profile-username").value =
        currentUser.username || "";

    document.getElementById("profile-password").value =
        currentUser.password || "";

    document.querySelectorAll(".admin-only").forEach(element => {
        element.classList.toggle(
            "hidden",
            currentUser.role !== "admin"
        );
    });

    switchTab("dashboard");
}

function switchTab(tabName) {
    document.querySelectorAll(".tab-section").forEach(section => {
        section.classList.add("hidden");
    });

    document.querySelectorAll(".tab-btn").forEach(button => {
        button.classList.remove("bg-blue-600", "text-white");
    });

    const section = document.getElementById(`section-${tabName}`);

    if (section) {
        section.classList.remove("hidden");
    }

    const button = document.getElementById(`tab-btn-${tabName}`);

    if (button) {
        button.classList.add("bg-blue-600", "text-white");
    }
}

function logoutUser() {
    localStorage.removeItem("currentUser");
    currentUser = null;
    location.reload();
}

function togglePasswordVisibility(fieldId, button) {
    const field = document.getElementById(fieldId);

    if (!field) return;

    if (field.type === "password") {
        field.type = "text";
        button.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
        field.type = "password";
        button.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
}

/* =========================================================
   15. MODERATSIYADAGI POSTLAR
========================================================= */

function renderPendingPosts() {
    const container = document.getElementById("pending-posts-container");

    if (!container) return;

    container.innerHTML = "";

    const badge = document.getElementById("pending-badge");

    if (badge) {
        badge.textContent = pendingPosts.length;
    }

    if (!pendingPosts.length) {
        container.innerHTML =
            '<div class="p-6 text-center text-slate-400">Hozircha moderatsiyada xabarlar yo‘q.</div>';

        return;
    }

    pendingPosts.forEach(post => {
        const card = document.createElement("div");

        card.className =
            "bg-slate-900 border border-slate-800 p-6 rounded-2xl";

        const title = document.createElement("h4");
        title.className = "font-bold text-white";
        title.textContent = post.author || "";

        const dept = document.createElement("p");
        dept.className = "text-sm text-blue-400";
        dept.textContent = post.dept || "";

        const text = document.createElement("p");
        text.className = "text-sm text-slate-300 mt-2";
        text.textContent = (post.rawText || "").slice(0, 200);

        const images = document.createElement("div");
        images.className = "flex gap-2 mt-3 flex-wrap";

        (post.images || []).forEach(image => {
            const img = document.createElement("img");
            img.src = image;
            img.className =
                "w-16 h-16 object-cover rounded-xl border border-slate-700";
            img.alt = "Post rasmi";

            images.appendChild(img);
        });

        const button = document.createElement("button");
        button.textContent = "Ko'rib chiqish";
        button.className =
            "bg-blue-600 text-white px-5 py-2 rounded-xl mt-4";

        button.onclick = () => window.openReviewModal(post.id);

        card.append(title, dept, text, images, button);
        container.appendChild(card);
    });
}

/* =========================================================
   16. E'LON QILINGAN POSTLAR
========================================================= */

function renderPublishedPosts() {
    const container = document.getElementById("published-posts-container");

    if (!container) return;

    container.innerHTML = "";

    if (!publishedPosts.length) {
        container.innerHTML =
            '<div class="p-6 text-center text-slate-400">Hozircha e’lonlar mavjud emas.</div>';

        return;
    }

    publishedPosts.forEach(post => {
        const card = document.createElement("div");

        card.className =
            "bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-4";

        const heading = document.createElement("h4");
        heading.className = "font-bold text-white";
        heading.textContent = post.dept || "";

        const time = document.createElement("p");
        time.className = "text-xs text-slate-400 mt-1";
        time.textContent = post.publishedAt || "";

        const gallery = document.createElement("div");
        gallery.className = "grid grid-cols-2 sm:grid-cols-3 gap-3 my-4";

        (post.images || []).forEach(image => {
            const img = document.createElement("img");
            img.src = image;
            img.alt = "E'lon rasmi";
            img.className =
                "w-full h-40 object-cover rounded-xl border border-slate-700";

            gallery.appendChild(img);
        });

        const text = document.createElement("p");
        text.className =
            "bg-slate-950 p-4 rounded-xl whitespace-pre-wrap text-sm text-slate-200";

        text.textContent = post.finalText || "";

        card.append(heading, time, gallery, text);

        if (currentUser?.role === "admin") {
            const deleteButton = document.createElement("button");

            deleteButton.textContent = "Ro'yxatdan o'chirish";
            deleteButton.className =
                "text-rose-400 text-sm mt-4";

            deleteButton.onclick = () => {
                if (!confirm("Ushbu postni saytdagi ro'yxatdan o'chirasizmi?")) {
                    return;
                }

                const updated = publishedPosts.filter(
                    item => item.id !== post.id
                );

                set(ref(db, "publishedPosts"), updated)
                    .then(() => {
                        publishedPosts = updated;
                        renderPublishedPosts();
                    })
                    .catch(error => {
                        console.error(error);
                        alert("Postni o'chirishda xatolik yuz berdi.");
                    });
            };

            card.appendChild(deleteButton);
        }

        container.appendChild(card);
    });
}

/* =========================================================
   17. FOYDALANUVCHINING POSTLARI
========================================================= */

function renderMyPosts() {
    const container = document.getElementById("my-posts-container");

    if (!container || !currentUser) return;

    container.innerHTML = "";

    const mine = [
        ...pendingPosts
            .filter(post => post.username === currentUser.username)
            .map(post => ({ ...post, label: "Moderatsiyada" })),

        ...publishedPosts
            .filter(post => post.username === currentUser.username)
            .map(post => ({ ...post, label: "Kanalga chiqarilgan" })),

        ...rejectedPosts
            .filter(post => post.username === currentUser.username)
            .map(post => ({ ...post, label: "Rad etilgan" }))
    ];

    if (!mine.length) {
        container.innerHTML =
            '<div class="p-6 text-center text-slate-400">Siz hali post yubormagansiz.</div>';

        return;
    }

    mine.forEach(post => {
        const card = document.createElement("div");

        card.className =
            "bg-slate-900 border border-slate-800 p-5 rounded-xl mb-3";

        const label = document.createElement("b");
        label.textContent = post.label;

        const text = document.createElement("p");
        text.className = "text-sm text-slate-300 mt-2";
        text.textContent =
            post.finalText || post.rawText || "";

        card.append(label, text);
        container.appendChild(card);
    });
}

/* =========================================================
   18. KAFEDRALAR RO'YXATI
========================================================= */

function renderUsers() {
    const container = document.getElementById(
        "departments-list-container"
    );

    if (!container) return;

    container.innerHTML = "";

    usersDB.forEach(user => {
        if (user.role === "admin") return;

        const item = document.createElement("div");

        item.className =
            "bg-slate-950 p-4 rounded-xl border border-slate-800 mb-3";

        const title = document.createElement("h4");
        title.className = "font-bold text-white";
        title.textContent = user.dept || "";

        const name = document.createElement("p");
        name.className = "text-sm text-slate-400";
        name.textContent = `Mas'ul: ${user.name || ""}`;

        item.append(title, name);
        container.appendChild(item);
    });
}

/* =========================================================
   19. TEST SAVOLLARI
========================================================= */

function loadQuizQuestion() {
    const questionElement = document.getElementById("quiz-question");
    const optionsElement = document.getElementById("quiz-options");

    if (!questionElement || !optionsElement) return;

    if (currentQuizIndex >= quizData.length) {
        currentQuizIndex = 0;
    }

    const question = quizData[currentQuizIndex];

    questionElement.textContent =
        `${currentQuizIndex + 1}-savol: ${question.q}`;

    optionsElement.innerHTML = "";

    question.options.forEach((option, index) => {
        const button = document.createElement("button");

        button.className =
            "w-full text-left bg-slate-900 border border-slate-800 p-3 rounded-xl text-sm text-slate-200 mb-2";

        button.textContent = option;

        button.onclick = () => window.checkQuizAnswer(index);

        optionsElement.appendChild(button);
    });

    const result = document.getElementById("quiz-result");
    const nextButton = document.getElementById("next-quiz-btn");

    if (result) {
        result.classList.add("hidden");
    }

    if (nextButton) {
        nextButton.classList.add("hidden");
    }
}

window.checkQuizAnswer = function(selectedIndex) {
    const question = quizData[currentQuizIndex];
    const result = document.getElementById("quiz-result");

    if (!result) return;

    result.classList.remove("hidden");

    if (selectedIndex === question.answer) {
        result.textContent = "To'g'ri javob! Barakalla!";
    } else {
        result.textContent =
            `Noto'g'ri. To'g'ri javob: ${question.options[question.answer]}`;
    }

    const nextButton = document.getElementById("next-quiz-btn");

    if (nextButton) {
        nextButton.classList.remove("hidden");
    }
};

window.nextQuizQuestion = function() {
    currentQuizIndex++;
    loadQuizQuestion();
};

/* =========================================================
   20. GLOBAL FUNKSIYALAR
========================================================= */

window.switchTab = switchTab;
window.logoutUser = logoutUser;
window.togglePasswordVisibility = togglePasswordVisibility;
