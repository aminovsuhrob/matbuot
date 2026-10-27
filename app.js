import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBvjW1sZlK_La1iga0opVAoVF9bnWwBtLI",
    authDomain: "fakultet-hujjatlari.firebaseapp.com",
    databaseURL: "https://fakultet-hujjatlari-default-rtdb.firebaseio.com",
    projectId: "fakultet-hujjatlari",
    storageBucket: "fakultet-hujjatlari.firebasestorage.app",
    messagingSenderId: "459968500801",
    appId: "1:459968500801:web:0463f1607375e67ff4a2c0",
    measurementId: "G-D7R9Q1FL97"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// TELEGRAM VA IMGBB SOZLAMALARI
const TELEGRAM_BOT_TOKEN = "8663230324:AAHdaSKIpPkb-3-XzfVTrWyDmdvQq84TOcQ";
const TELEGRAM_CHANNEL_ID = "@matbuot_2026";
const IMGBB_API_KEY = "6d207e02194a847aa98d2a6326075b9f";

const defaultUsers = [
    { username: 'admin', password: 'admin123', name: 'Bosh Admin', role: 'admin', dept: 'Matbuot Xizmati Markazi', hashtag: '#VetMatbuot', avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' },
    { username: 'anatomiya', password: 'pass1', name: 'Prof. Karimov T.', role: 'user', dept: 'Hayvonlar anatomiyasi, gistologiyasi va patologik anatomiya kafedrasi', hashtag: '#VetAnatomiya', avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' },
    { username: 'yuqumsiz', password: 'pass2', name: 'Dr. Toshmatov B.', role: 'user', dept: 'Ichki yuqumsiz kasalliklar kafedrasi', hashtag: '#VetYuqumsiz', avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' },
    { username: 'jarrohlik', password: 'pass3', name: 'Prof. Alimov S.', role: 'user', dept: 'Veterinariya jarrohligi va akusherlik kafedrasi', hashtag: '#VetJarrohlik', avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' },
    { username: 'epizootologiya', password: 'pass4', name: 'Dr. Rahmonov D.', role: 'user', dept: 'Epizootologiya va infeksion kasalliklar kafedrasi', hashtag: '#VetEpizootologiya', avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' },
    { username: 'parazitologiya', password: 'pass5', name: 'Prof. Umarov M.', role: 'user', dept: 'Parazitologiya kafedrasi', hashtag: '#VetParazitologiya', avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }
];

let usersDB = [];
let pendingPosts = [];
let publishedPosts = [];
let rejectedPosts = [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let currentReviewPost = null;
let currentUploadedImages = [];

document.addEventListener('DOMContentLoaded', () => {
    initFirebaseSync();

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const u = document.getElementById('username').value.trim();
            const p = document.getElementById('password').value.trim();
            
            const user = usersDB.find(x => x.username === u && x.password === p);
            if (user) {
                currentUser = user;
                localStorage.setItem('currentUser', JSON.stringify(user));
                document.getElementById('login-error').classList.add('hidden');
                showApp();
            } else {
                document.getElementById('login-error').classList.remove('hidden');
            }
        });
    }

    document.getElementById('post-images-input').addEventListener('change', handleImageUpload);
    document.getElementById('create-post-form').addEventListener('submit', handlePostSubmit);
    document.getElementById('profile-form').addEventListener('submit', handleProfileUpdate);
    document.getElementById('profile-photo-input').addEventListener('change', handleAvatarUpload);
});

function initFirebaseSync() {
    onValue(ref(db, 'usersDB'), (snapshot) => {
        const data = snapshot.val();
        usersDB = data ? Object.values(data) : defaultUsers;
        if (!data) set(ref(db, 'usersDB'), defaultUsers);
        if (currentUser) {
            const latest = usersDB.find(u => u.username === currentUser.username);
            if (latest) currentUser = latest;
        }
        renderUsers();
    });

    onValue(ref(db, 'pendingPosts'), (snapshot) => {
        pendingPosts = snapshot.val() ? Object.values(snapshot.val()) : [];
        renderPendingPosts();
        renderMyPosts();
    });

    onValue(ref(db, 'publishedPosts'), (snapshot) => {
        publishedPosts = snapshot.val() ? Object.values(snapshot.val()) : [];
        renderPublishedPosts();
        renderMyPosts();
    });

    onValue(ref(db, 'rejectedPosts'), (snapshot) => {
        rejectedPosts = snapshot.val() ? Object.values(snapshot.val()) : [];
        renderMyPosts();
    });

    if (currentUser) {
        showApp();
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-content').classList.add('hidden');
    }
}

function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
    document.getElementById('user-display-name').textContent = currentUser.name;
    document.getElementById('user-role-badge').textContent = currentUser.dept;
    document.getElementById('dash-user-name').textContent = currentUser.name;
    
    if (currentUser.avatar) {
        document.getElementById('header-user-avatar').src = currentUser.avatar;
        document.getElementById('profile-avatar-preview').src = currentUser.avatar;
    }

    document.getElementById('profile-dept').value = currentUser.dept;
    document.getElementById('profile-name').value = currentUser.name;
    document.getElementById('profile-username').value = currentUser.username;
    document.getElementById('profile-password').value = currentUser.password;

    document.querySelectorAll('.admin-only').forEach(el => {
        if (currentUser.role === 'admin') el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

    switchTab('dashboard');
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('bg-blue-600', 'text-white'));
    
    document.getElementById(`section-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-btn-${tabName}`).classList.add('bg-blue-600', 'text-white');
}

function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            currentUser.avatar = ev.target.result;
            document.getElementById('profile-avatar-preview').src = ev.target.result;
            document.getElementById('header-user-avatar').src = ev.target.result;
            
            const index = usersDB.findIndex(u => u.username === currentUser.username);
            if (index !== -1) {
                usersDB[index].avatar = ev.target.result;
                set(ref(db, `usersDB/${index}`), usersDB[index]);
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            }
        };
        reader.readAsDataURL(file);
    }
}

function handleProfileUpdate(e) {
    e.preventDefault();
    currentUser.name = document.getElementById('profile-name').value.trim();
    currentUser.username = document.getElementById('profile-username').value.trim();
    currentUser.password = document.getElementById('profile-password').value.trim();

    const index = usersDB.findIndex(u => u.dept === currentUser.dept);
    if (index !== -1) {
        usersDB[index] = currentUser;
        set(ref(db, `usersDB/${index}`), currentUser);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        alert("Profil ma'lumotlari yangilandi!");
        showApp();
    }
}

async function handleImageUpload(e) {
    const files = Array.from(e.target.files || []);
    const container = document.getElementById('image-preview-container');
    currentUploadedImages = [];
    if (container) container.innerHTML = "";

    if (files.length > 10) {
        e.target.value = "";
        alert("Maksimum 10 ta rasm tanlash mumkin!");
        return;
    }

    try {
        currentUploadedImages = await Promise.all(files.map(file => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi."));
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
        alert("Rasmlarni yuklashda xatolik.");
    }
}

function handlePostSubmit(e) {
    e.preventDefault();
    const rawText = document.getElementById('post-raw-text').value.trim();
    
    const newPost = {
        id: Date.now(),
        author: currentUser.name,
        dept: currentUser.dept,
        username: currentUser.username,
        hashtag: currentUser.hashtag,
        rawText: rawText,
        images: currentUploadedImages,
        status: 'pending'
    };

    pendingPosts.unshift(newPost);
    set(ref(db, 'pendingPosts'), pendingPosts);
    
    alert("Xabar adminga yuborildi!");
    document.getElementById('create-post-form').reset();
    document.getElementById('image-preview-container').innerHTML = "";
    currentUploadedImages = [];
    switchTab('my-posts');
}

function renderPendingPosts() {
    const container = document.getElementById('pending-posts-container');
    if (!container) return;
    container.innerHTML = "";
    
    document.getElementById('pending-badge').textContent = pendingPosts.length;

    if (pendingPosts.length === 0) {
        container.innerHTML = `<div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center text-slate-400 text-sm">Hozircha moderatsiyada xabarlar yo'q.</div>`;
        return;
    }

    pendingPosts.forEach(p => {
        let imgs = (p.images || []).map(img => `<img src="${img}" class="w-16 h-16 object-cover rounded-xl border border-slate-700">`).join('');
        container.innerHTML += `
            <div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <span class="inline-block px-3 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-2">Kafedra: ${p.dept}</span>
                    <h4 class="text-base font-bold text-white">${p.author}</h4>
                    <p class="text-sm text-slate-300 mt-1">${(p.rawText || '').substring(0, 90)}...</p>
                    <div class="flex gap-2 mt-3">${imgs}</div>
                </div>
                <button onclick="openReviewModal(${p.id})" class="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl text-xs whitespace-nowrap">Ko'rib chiqish</button>
            </div>`;
    });
}

window.openReviewModal = function(id) {
    const post = pendingPosts.find(p => p.id === id);
    if (!post) return;
    currentReviewPost = post;
    
    document.getElementById('modal-dept-badge').textContent = `Yuboruvchi kafedra: ${post.dept}`;
    renderReviewModalImages();
    
    const defaultHashtag = post.hashtag || "#Tajriba_Xoʻjaligi";
    document.getElementById('modal-final-text').value = `${defaultHashtag}

📖 AMALIY CHIQISH DARSI

🌱 Universitetning Veterinariya profilaktikasi va davolash fakulteti "${post.dept}" tomonidan talabalar uchun universitet tajriba xo'jaligida navbatdagi amaliy chiqish darsi tashkil etildi.

✍️ ${post.rawText}

🚀 Bunday amaliy mashg'ulotlar bo'lajak veterinariya mutaxassislarining kasbiy bilim va ko'nikmalarini rivojlantirishda muhim ahamiyat kasb etadi.

🏛️ Veterinariya profilaktikasi va davolash fakulteti Axborot xizmati

🌐 | Telegram | Instagram | Facebook |`;

    document.getElementById('ai-review-modal').classList.remove('hidden');

    document.getElementById('approve-publish-btn').onclick = async () => {
        const finalText = document.getElementById('modal-final-text').value;
        const postImages = currentReviewPost.images || [];
        const now = new Date();
        const timeStr = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;

        const approveBtn = document.getElementById('approve-publish-btn');
        approveBtn.disabled = true;
        approveBtn.textContent = "Kanalga yuborilmoqda...";

        try {
            await sendPostDirectlyToTelegram(postImages, finalText);
            
            publishedPosts.unshift({
                ...currentReviewPost,
                finalText: finalText,
                publishedAt: timeStr,
                reactions: { '👍': 0, '❤️': 0, '🔥': 0, '👏': 0, '😢': 0 },
                userReactions: {}
            });
            
            pendingPosts = pendingPosts.filter(p => p.id !== currentReviewPost.id);
            set(ref(db, 'pendingPosts'), pendingPosts);
            set(ref(db, 'publishedPosts'), publishedPosts);
            
            alert("E'lon va rasmlar @matbuot_2026 kanaliga muvaffaqiyatli chiqarildi!");
            closeReviewModal();
            switchTab('published-posts');
        } catch (error) {
            alert("Telegramga yuborishda xatolik: " + error.message);
        } finally {
            approveBtn.disabled = false;
            approveBtn.textContent = "Tasdiqlash va Kanalga Chiqarish";
        }
    };
}

async function sendPostDirectlyToTelegram(images, text) {
    let imageUrls = [];

    for (let imgBase64 of images) {
        if (imgBase64.startsWith("http")) {
            imageUrls.push(imgBase64);
            continue;
        }
        try {
            const base64Data = imgBase64.split(",")[1];
            const formData = new FormData();
            formData.append("image", base64Data);

            let res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: "POST",
                body: formData
            });
            let data = await res.json();
            if (data && data.success) {
                imageUrls.push(data.data.url);
            }
        } catch (err) {
            console.warn("Rasm yuklanmadi", err);
        }
    }

    const caption = text.length <= 1024 ? text : text.slice(0, 1010) + "…";

    if (imageUrls.length === 0) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID, text: text })
        });
    } else if (imageUrls.length === 1) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID, photo: imageUrls[0], caption: caption })
        });
    } else {
        let mediaGroup = imageUrls.map((url, index) => ({
            type: "photo",
            media: url,
            ...(index === 0 ? { caption: caption } : {})
        }));
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID, media: mediaGroup })
        });
    }

    if (text.length > 1024) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID, text: text })
        });
    }
}

function renderReviewModalImages() {
    const galleryContainer = document.getElementById('modal-images-gallery');
    if (!galleryContainer) return;
    galleryContainer.innerHTML = "";

    (currentReviewPost.images || []).forEach((img) => {
        galleryContainer.innerHTML += `<img src="${img}" class="gallery-thumb">`;
    });
}

window.closeReviewModal = function() {
    document.getElementById('ai-review-modal').classList.add('hidden');
}

function renderPublishedPosts() {
    const container = document.getElementById('published-posts-container');
    if (!container) return;
    container.innerHTML = "";
    
    if (publishedPosts.length === 0) {
        container.innerHTML = `<div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center text-slate-400 text-sm">Hozircha kanalga chiqarilgan xabarlar yo'q.</div>`;
        return;
    }

    publishedPosts.forEach(p => {
        let imgsHtml = (p.images || []).map(img => `<img src="${img}" class="w-full h-40 object-cover rounded-xl border border-slate-700 shadow">`).join('');
        container.innerHTML += `
            <div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
                <div class="flex justify-between items-center">
                    <span class="px-3 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${p.dept}</span>
                    <span class="text-[11px] text-slate-500">${p.publishedAt}</span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">${imgsHtml}</div>
                <div class="bg-slate-950 p-4 rounded-xl whitespace-pre-wrap text-sm text-slate-200 border border-slate-800">${p.finalText}</div>
            </div>`;
    });
}

function renderMyPosts() {
    const container = document.getElementById('my-posts-container');
    if (!container) return;
    container.innerHTML = "";
}

function renderUsers() {
    const container = document.getElementById('departments-list-container');
    if (!container) return;
    container.innerHTML = "";

    usersDB.forEach(u => {
        if (u.role === 'admin') return;
        container.innerHTML += `
            <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                <div>
                    <h4 class="text-xs font-bold text-white">${u.dept}</h4>
                    <p class="text-[11px] text-slate-400">Mas'ul: ${u.name} | Login: <code class="text-blue-400">${u.username}</code></p>
                </div>
            </div>`;
    });
}

window.switchTab = switchTab;
window.logoutUser = function() {
    localStorage.removeItem('currentUser');
    location.reload();
};
window.togglePasswordVisibility = function(fieldId, btn) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.type = field.type === 'password' ? 'text' : 'password';
    }
};
