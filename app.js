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

// TELEGRAM BOT SOZLAMALARI
const TELEGRAM_BOT_TOKEN = "8663230324:AAHdaSKIpPkb-3-XzfVTrWyDmdvQq84TOcQ";
const TELEGRAM_CHANNEL_ID = "@matbuot_2026";

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
let editingPublishedId = null;
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

    document.getElementById('social-settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        socialLinks.telegram = document.getElementById('setting-telegram').value;
        socialLinks.instagram = document.getElementById('setting-instagram').value;
        socialLinks.facebook = document.getElementById('setting-facebook').value;
        set(ref(db, 'socialLinks'), socialLinks);
        alert("Ijtimoiy tarmoq havolalari yangilandi!");
    });
});

function initFirebaseSync() {
    onValue(ref(db, 'usersDB'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            usersDB = Object.values(data);
        } else {
            set(ref(db, 'usersDB'), defaultUsers);
            usersDB = defaultUsers;
        }
        if (currentUser) {
            const latest = usersDB.find(u => u.username === currentUser.username);
            if (latest) currentUser = latest;
        }
        renderUsers();
        renderDepartmentStats();
    });

    onValue(ref(db, 'pendingPosts'), (snapshot) => {
        const data = snapshot.val();
        pendingPosts = data ? Object.values(data) : [];
        renderPendingPosts();
        renderMyPosts();
    });

    onValue(ref(db, 'publishedPosts'), (snapshot) => {
        const data = snapshot.val();
        publishedPosts = data ? Object.values(data) : [];
        renderPublishedPosts();
        renderMyPosts();
        renderDepartmentStats();
    });

    onValue(ref(db, 'rejectedPosts'), (snapshot) => {
        const data = snapshot.val();
        rejectedPosts = data ? Object.values(data) : [];
        renderMyPosts();
    });

    onValue(ref(db, 'socialLinks'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            socialLinks = data;
            if (document.getElementById('setting-telegram')) {
                document.getElementById('setting-telegram').value = socialLinks.telegram || '';
                document.getElementById('setting-instagram').value = socialLinks.instagram || '';
                document.getElementById('setting-facebook').value = socialLinks.facebook || '';
            }
        }
    });

    if (currentUser) {
        showApp();
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-content').classList.add('hidden');
    }
}

function togglePasswordVisibility(fieldId, btn) {
    const field = document.getElementById(fieldId);
    if (field.type === 'password') {
        field.type = 'text';
        btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
        field.type = 'password';
        btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
}

function logoutUser() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    location.reload();
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

    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
        if (currentUser.role === 'admin') el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

    switchTab('dashboard');
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active', 'bg-blue-600', 'text-white'));
    
    const targetSec = document.getElementById(`section-${tabName}`);
    if (targetSec) targetSec.classList.remove('hidden');
    
    const activeBtn = document.getElementById(`tab-btn-${tabName}`);
    if (activeBtn) activeBtn.classList.add('active', 'bg-blue-600', 'text-white');

    if (tabName === 'dashboard') {
        renderDepartmentStats();
    }
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

function handleImageUpload(e) {
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

// OYLAR KESIMIDA KAFEDRALAR STATISTIKASI JADVALI
function renderDepartmentStats() {
    const dashSection = document.getElementById('section-dashboard');
    if (!dashSection) return;

    let statsCard = document.getElementById('department-stats-card');
    if (!statsCard) {
        statsCard = document.createElement('div');
        statsCard.id = 'department-stats-card';
        statsCard.className = 'bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4 mt-6';
        statsCard.innerHTML = `
            <div class="flex items-center justify-between">
                <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <i class="fa-solid fa-chart-column text-blue-500"></i> Oylar kesimida kafedralar faolligi (Statistika)
                </h3>
                <span class="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-semibold">Real vaqt</span>
            </div>
            <div id="department-stats-container" class="overflow-x-auto"></div>
        `;
        dashSection.appendChild(statsCard);
    }

    const container = document.getElementById('department-stats-container');
    if (!container) return;

    const departments = usersDB.filter(u => u.role !== 'admin').map(u => u.dept);
    const statsMap = {}; 
    const monthsSet = new Set();

    publishedPosts.forEach(post => {
        const dept = post.dept;
        const postDate = new Date(post.id || Date.now());
        const monthName = postDate.toLocaleString('uz-UZ', { month: 'long', year: 'numeric' });
        
        monthsSet.add(monthName);

        if (!statsMap[dept]) {
            statsMap[dept] = {};
        }
        statsMap[dept][monthName] = (statsMap[dept][monthName] || 0) + 1;
    });

    const months = Array.from(monthsSet);

    if (publishedPosts.length === 0 || departments.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Hozircha kanalga chiqarilgan e'lonlar mavjud emas.</p>`;
        return;
    }

    let tableHtml = `
        <table class="w-full text-left border-collapse text-xs">
            <thead>
                <tr class="border-b border-slate-800 text-slate-400">
                    <th class="py-3 px-4 font-semibold">Kafedra / Bo'lim</th>`;
    
    months.forEach(m => {
        tableHtml += `<th class="py-3 px-4 font-semibold text-center">${m}</th>`;
    });
    tableHtml += `<th class="py-3 px-4 font-semibold text-center">Jami</th>`;
    tableHtml += `</tr></thead><tbody class="divide-y divide-slate-800/60">`;

    departments.forEach(dept => {
        let deptTotal = 0;
        tableHtml += `<tr class="hover:bg-slate-950/50"><td class="py-3 px-4 text-slate-200 font-medium">${dept}</td>`;
        
        months.forEach(m => {
            const count = statsMap[dept]?.[m] || 0;
            deptTotal += count;
            tableHtml += `<td class="py-3 px-4 text-center text-slate-300">${count > 0 ? `<span class="px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-lg font-bold">${count}</span>` : '-'}</td>`;
        });
        
        tableHtml += `<td class="py-3 px-4 text-center font-bold text-emerald-400">${deptTotal}</td></tr>`;
    });

    tableHtml += `</tbody></table>`;
    container.innerHTML = tableHtml;
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
    document.getElementById('modal-final-text').value = `📌 ${post.dept.toUpperCase()}\n\n${post.rawText}\n\nManba: ${post.dept}\n${post.hashtag} #VetFakultet #SamVET`;
    document.getElementById('reject-reason-input').value = "";
    document.getElementById('ai-review-modal').classList.remove('hidden');

    document.getElementById('approve-publish-btn').onclick = async () => {
        const finalText = document.getElementById('modal-final-text').value;
        const now = new Date();
        const timeStr = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;

        await sendPostToTelegramChannel(finalText, currentReviewPost.images || []);

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
        
        closeReviewModal();
        switchTab('published-posts');
    };
}

async function sendPostToTelegramChannel(text, images) {
    try {
        if (!images || images.length === 0) {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID, text: text })
            });
        } else if (images.length === 1) {
            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHANNEL_ID);
            formData.append('caption', text);
            
            const blob = dataURItoBlob(images[0]);
            formData.append('photo', blob, 'image.jpg');

            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: formData
            });
        } else {
            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHANNEL_ID);
            
            const mediaArray = images.map((img, index) => {
                const fieldName = `attach_${index}`;
                const blob = dataURItoBlob(img);
                formData.append(fieldName, blob, `image_${index}.jpg`);
                return {
                    type: 'photo',
                    media: `attach://${fieldName}`,
                    caption: index === 0 ? text : ''
                };
            });

            formData.append('media', JSON.stringify(mediaArray));

            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`, {
                method: 'POST',
                body: formData
            });
        }
        alert("E'lon kanalga va portalga muvaffaqiyatli chiqarildi!");
    } catch (err) {
        console.error("Telegramga yuborishda xatolik:", err);
        alert("Portalga saqlandi, lekin Telegramga yuborishda xatolik yuz berdi. Bot kanalda Admin ekanligini va ruxsatlari borligini tekshiring.");
    }
}

function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
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

        let reactionsHtml = '';
        for (let [emoji, count] of Object.entries(p.reactions || {})) {
            let isVoted = p.userReactions && p.userReactions[currentUser.username] === emoji;
            reactionsHtml += `<button onclick="reactPost(${p.id}, '${emoji}')" class="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition ${isVoted ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'}">${emoji} <span>${count}</span></button>`;
        }

        let adminActionsHtml = '';
        if (currentUser.role === 'admin') {
            adminActionsHtml = `
                <div class="flex items-center gap-2">
                    <button onclick="openAdminEdit(${p.id})" class="text-xs text-purple-400 hover:underline flex items-center gap-1"><i class="fa-solid fa-pen-to-square"></i> Tahrirlash</button>
                    <span class="text-slate-700">|</span>
                    <button onclick="deletePublishedPost(${p.id})" class="text-xs text-rose-400 hover:underline flex items-center gap-1"><i class="fa-solid fa-trash"></i> O'chirish</button>
                </div>`;
        }

        container.innerHTML += `
            <div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
                <div class="flex justify-between items-center">
                    <span class="px-3 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${p.dept}</span>
                    <div class="flex items-center gap-3">
                        <span class="text-[11px] text-slate-500"><i class="fa-regular fa-clock mr-1"></i>${p.publishedAt}</span>
                        ${adminActionsHtml}
                    </div>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">${imgsHtml}</div>
                <div class="bg-slate-950 p-4 rounded-xl whitespace-pre-wrap text-sm text-slate-200 border border-slate-800">${p.finalText}</div>
                <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">${reactionsHtml}</div>
            </div>`;
    });
}

window.deletePublishedPost = function(id) {
    if (confirm("Haqiqatan ham ushbu e'lonni portal arxividan o'chirmoqchimisiz?")) {
        publishedPosts = publishedPosts.filter(p => p.id !== id);
        set(ref(db, 'publishedPosts'), publishedPosts);
        alert("E'lon o'chirildi!");
    }
}

function renderMyPosts() {
    const container = document.getElementById('my-posts-container');
    if (!container) return;
    container.innerHTML = "";

    const myPub = publishedPosts.filter(p => p.username === currentUser.username);
    const myPend = pendingPosts.filter(p => p.username === currentUser.username);
    const myRej = rejectedPosts.filter(p => p.username === currentUser.username);

    if (myPub.length === 0 && myPend.length === 0 && myRej.length === 0) {
        container.innerHTML = `<div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center text-slate-400 text-sm">Siz hali hech qanday post yubormagansiz.</div>`;
        return;
    }

    myRej.forEach(p => {
        container.innerHTML += `
            <div class="bg-slate-900 border border-rose-500/30 p-6 rounded-2xl space-y-2">
                <span class="px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded text-[10px] font-bold">Rad etildi</span>
                <p class="text-sm text-slate-300">${p.rawText}</p>
                <p class="text-xs text-rose-400 font-medium bg-rose-950/40 p-2 rounded-lg border border-rose-900/50"><b>Sabab:</b> ${p.rejectReason}</p>
            </div>`;
    });

    myPend.forEach(p => {
        container.innerHTML += `
            <div class="bg-slate-900 border border-amber-500/30 p-6 rounded-2xl space-y-2">
                <span class="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold">Moderatsiyada</span>
                <p class="text-sm text-slate-300">${p.rawText}</p>
            </div>`;
    });

    myPub.forEach(p => {
        container.innerHTML += `
            <div class="bg-slate-900 border border-emerald-500/30 p-6 rounded-2xl space-y-2">
                <span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold">Kanalga Chiqqan (${p.publishedAt})</span>
                <p class="text-sm text-slate-200 whitespace-pre-wrap">${p.finalText}</p>
            </div>`;
    });
}

window.reactPost = function(postId, emoji) {
    const post = publishedPosts.find(x => x.id === postId);
    if (!post) return;
    if (!post.userReactions) post.userReactions = {};

    let prevEmoji = post.userReactions[currentUser.username];
    if (prevEmoji === emoji) {
        post.reactions[emoji]--;
        delete post.userReactions[currentUser.username];
    } else {
        if (prevEmoji) post.reactions[prevEmoji]--;
        post.reactions[emoji]++;
        post.userReactions[currentUser.username] = emoji;
    }
    set(ref(db, 'publishedPosts'), publishedPosts);
}

window.openAdminEdit = function(id) {
    const post = publishedPosts.find(p => p.id === id);
    if (!post) return;
    editingPublishedId = id;
    document.getElementById('admin-edit-text').value = post.finalText;
    document.getElementById('admin-edit-modal').classList.remove('hidden');

    document.getElementById('save-admin-edit-btn').onclick = () => {
        post.finalText = document.getElementById('admin-edit-text').value;
        set(ref(db, 'publishedPosts'), publishedPosts);
        closeAdminEditModal();
    };
}
window.closeAdminEditModal = function() { document.getElementById('admin-edit-modal').classList.add('hidden'); }

window.openLightbox = function(imgSrc) {
    document.getElementById('lightbox-img').src = imgSrc;
    document.getElementById('lightbox-download-btn').href = imgSrc;
    document.getElementById('lightbox-modal').classList.remove('hidden');
}
window.closeLightbox = function() { document.getElementById('lightbox-modal').classList.add('hidden'); }

function renderUsers() {
    const container = document.getElementById('departments-list-container');
    if (!container) return;
    container.innerHTML = "";

    usersDB.forEach((u, index) => {
        if (u.role === 'admin') return;
        container.innerHTML += `
            <div onclick="openDeptModal(${index})" class="bg-slate-950 hover:bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4 cursor-pointer transition">
                <div class="flex items-center gap-3">
                    <img src="${u.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}" class="w-12 h-12 rounded-xl object-cover border border-purple-500/50">
                    <div>
                        <h4 class="text-xs sm:text-sm font-bold text-white">${u.dept}</h4>
                        <p class="text-[11px] text-slate-400 mt-0.5">Mas'ul: <b>${u.name}</b> | Login: <code class="text-blue-400">${u.username}</code> | Parol: <code class="text-amber-400">${u.password}</code></p>
                    </div>
                </div>
                <button class="bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition">
                    <i class="fa-solid fa-pen-to-square mr-1"></i> Tahrirlash
                </button>
            </div>`;
    });
}

window.openDeptModal = function(index) {
    const u = usersDB[index];
    if (!u) return;
    document.getElementById('modal-dept-index').value = index;
    document.getElementById('modal-dept-avatar').src = u.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    document.getElementById('modal-dept-title').value = u.dept;
    document.getElementById('modal-dept-name').value = u.name;
    document.getElementById('modal-dept-user').value = u.username;
    document.getElementById('modal-dept-pass').value = u.password;
    document.getElementById('modal-dept-hash').value = u.hashtag;
    windowModalAvatar = u.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    document.getElementById('dept-edit-modal').classList.remove('hidden');
}

window.closeDeptModal = function() { document.getElementById('dept-edit-modal').classList.add('hidden'); }

window.saveDeptModalData = function() {
    const index = parseInt(document.getElementById('modal-dept-index').value);
    usersDB[index].dept = document.getElementById('modal-dept-title').value.trim();
    usersDB[index].name = document.getElementById('modal-dept-name').value.trim();
    usersDB[index].username = document.getElementById('modal-dept-user').value.trim();
    usersDB[index].password = document.getElementById('modal-dept-pass').value.trim();
    usersDB[index].hashtag = document.getElementById('modal-dept-hash').value.trim();
    if (windowModalAvatar) usersDB[index].avatar = windowModalAvatar;

    set(ref(db, 'usersDB'), usersDB);
    alert("Kafedra ma'lumotlari yangilandi!");
    closeDeptModal();
}

window.deleteDeptUser = function() {
    const index = parseInt(document.getElementById('modal-dept-index').value);
    if (confirm("Haqiqatan ham ushbu kafedrani o'chirmoqchimisiz?")) {
        usersDB.splice(index, 1);
        set(ref(db, 'usersDB'), usersDB);
        alert("Kafedra o'chirildi!");
        closeDeptModal();
    }
}

window.openAddUserModal = function() {
    document.getElementById('add-user-form').reset();
    document.getElementById('add-user-modal').classList.remove('hidden');
}

window.closeAddUserModal = function() { document.getElementById('add-user-modal').classList.add('hidden'); }

function handleAddNewUser(e) {
    e.preventDefault();
    const dept = document.getElementById('new-dept-title').value.trim();
    const name = document.getElementById('new-dept-name').value.trim();
    const username = document.getElementById('new-dept-user').value.trim();
    const password = document.getElementById('new-dept-pass').value.trim();
    const hashtag = document.getElementById('new-dept-hash').value.trim();

    if (usersDB.some(u => u.username === username)) {
        alert("Bu login allaqachon band!");
        return;
    }

    usersDB.push({
        username: username,
        password: password,
        name: name,
        role: 'user',
        dept: dept,
        hashtag: hashtag,
        avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
    });

    set(ref(db, 'usersDB'), usersDB);
    alert("Yangi kafedra qo'shildi!");
    closeAddUserModal();
}

window.switchTab = switchTab;
window.logoutUser = logoutUser;
window.togglePasswordVisibility = togglePasswordVisibility;
