import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, remove, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
let socialLinks = { telegram: 'https://t.me/matbuot_2026', instagram: 'https://instagram.com/samvet_uz', facebook: 'https://facebook.com/samvet' };

let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let currentReviewPost = null;
let currentUploadedImages = [];
let windowModalAvatar = "";

document.addEventListener('DOMContentLoaded', () => {
    initFirebaseSync();

    document.getElementById('login-form').addEventListener('submit', (e) => {
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

    document.getElementById('post-images-input').addEventListener('change', handleImageUpload);
    document.getElementById('create-post-form').addEventListener('submit', handlePostSubmit);
    document.getElementById('profile-form').addEventListener('submit', handleProfileUpdate);
    document.getElementById('profile-photo-input').addEventListener('change', handleAvatarUpload);
    document.getElementById('modal-dept-photo').addEventListener('change', handleModalAvatarUpload);
    document.getElementById('add-user-form').addEventListener('submit', handleAddNewUser);
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
    const activeBtn = document.getElementById(`tab-btn-${tabName}`);
    if (activeBtn) activeBtn.classList.add('bg-blue-600', 'text-white');
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

function handleModalAvatarUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('modal-dept-avatar').src = ev.target.result;
            windowModalAvatar = ev.target.result;
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
    const badge = document.getElementById('pending-badge');
    if (badge) badge.textContent = pendingPosts.length;

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
    
    // Siz talab qilgan dizayn va tartibdagi tayyor shablon
    const defaultHashtag = post.hashtag || "#Tajriba_Xoʻjaligi";
    document.getElementById('modal-final-text').value = `${defaultHashtag}

📖 AMALIY CHIQISH DARSI

🌱 Universitetning Veterinariya profilaktikasi va davolash fakulteti "${post.dept}" tomonidan talabalar uchun universitet tajriba xo'jaligida navbatdagi amaliy chiqish darsi tashkil etildi.

✍️ ${post.rawText}

🚀 Bunday amaliy mashg'ulotlar bo'lajak veterinariya mutaxassislarining kasbiy bilim va ko'nikmalarini rivojlantirishda muhim ahamiyat kasb etadi.

🏛️ Veterinariya profilaktikasi va davolash fakulteti Axborot xizmati

🌐 | Telegram | Instagram | Facebook |`;

    document.getElementById('reject-reason-input').value = "";
    document.getElementById('ai-review-modal').classList.remove('hidden');

    document.getElementById('approve-publish-btn').onclick = async () => {
        const finalText = document.getElementById('modal-final-text').value;
        const postImages = currentReviewPost.images || [];
        const now = new Date();
        const timeStr = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;

        const approveButton = document.getElementById('approve-publish-btn');
        approveButton.disabled = true;
        approveButton.textContent = "Kanalga yuborilmoqda...";

        try {
            await telegramgaRasmlarVaMatnYubor(postImages, finalText);
            
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
            alert("Xatolik yuz berdi: " + error.message);
        } finally {
            approveButton.disabled = false;
            approveButton.textContent = "Tasdiqlash va Kanalga Chiqarish";
        }
    };
}

// Base64 rasmni faylga o'tkazuvchi yordamchi funksiya
function dataURLtoFile(dataurl, filename) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

// Server orqali Telegram kanalga rasmlar va matnni yuboruvchi asosiy funksiya
async function telegramgaRasmlarVaMatnYubor(rasmlarMassivi = [], matn = "") {
    const formData = new FormData();
    formData.append("chat_id", "@matbuot_2026");
    if (matn) {
        formData.append("caption", matn);
    }

    rasmlarMassivi.forEach((imgBase64, index) => {
        if (imgBase64.startsWith("data:")) {
            const file = dataURLtoFile(imgBase64, `image_${index}.jpg`);
            formData.append("photos", file);
        }
    });

    const javob = await fetch("/api/telegram-photos", {
        method: "POST",
        body: formData
    });

    const natija = await javob.json();
    if (!javob.ok) {
        throw new Error(natija.description || natija.error || "Rasm va xabarlar yuborilmadi");
    }
    return natija;
}

function renderReviewModalImages() {
    const galleryContainer = document.getElementById('modal-images-gallery');
    if (!galleryContainer) return;
    galleryContainer.innerHTML = "";

    if (!currentReviewPost.images || currentReviewPost.images.length === 0) {
        galleryContainer.innerHTML = `<span class="text-xs text-slate-500 col-span-5">Rasmlar mavjud emas</span>`;
        return;
    }

    currentReviewPost.images.forEach((img, index) => {
        galleryContainer.innerHTML += `
            <div class="relative group">
                <img src="${img}" class="gallery-thumb">
                <button type="button" onclick="removePostImage(${index})" class="absolute -top-2 -right-2 bg-rose-600 hover:bg-rose-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-xl transition border-2 border-slate-900 cursor-pointer" title="Rasmni o'chirish">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>`;
    });
}

window.removePostImage = function(index) {
    if (currentReviewPost && currentReviewPost.images) {
        currentReviewPost.images.splice(index, 1);
        renderReviewModalImages();
    }
}

window.rejectPostAction = function() {
    const reason = document.getElementById('reject-reason-input').value.trim();
    if (!reason) { alert("Rad etish sababini kiriting!"); return; }
    if (!currentReviewPost) return;

    currentReviewPost.status = 'rejected';
    currentReviewPost.rejectReason = reason;
    pendingPosts = pendingPosts.filter(p => p.id !== currentReviewPost.id);
    rejectedPosts.unshift(currentReviewPost);

    set(ref(db, 'pendingPosts'), pendingPosts);
    set(ref(db, 'rejectedPosts'), rejectedPosts);
    alert("Post rad etildi.");
    closeReviewModal();
}

window.closeReviewModal = function() { document.getElementById('ai-review-modal').classList.add('hidden'); }

function renderPublishedPosts() {
    const container = document.getElementById('published-posts-container');
    if (!container) return;
    container.innerHTML = "";
    if (publishedPosts.length === 0) {
        container.innerHTML = `<div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center text-slate-400 text-sm">Hozircha kanalga chiqarilgan xabarlar yo'q.</div>`;
        return;
    }

    publishedPosts.forEach(p => {
        let imgsHtml = (p.images || []).map(img => `<img src="${img}" class="w-full h-40 object-cover rounded-xl border border-slate-700 shadow cursor-pointer" onclick="openLightbox('${img}')">`).join('');
        container.innerHTML += `
            <div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
                <div class="flex justify-between items-center">
                    <span class="px-3 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${p.dept}</span>
                    <span class="text-[11px] text-slate-500"><i class="fa-regular fa-clock mr-1"></i>${p.publishedAt}</span>
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
    // Qo'shimcha render funksiyalari...
}

function renderUsers() {
    // Foydalanuvchilar ro'yxati...
}
