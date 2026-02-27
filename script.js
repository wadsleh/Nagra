import { firebaseConfig } from './config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const app = initializeApp(firebaseConfig); 
const db = getFirestore(app); 
const auth = getAuth(app); 
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// 1️⃣ State Management (تمت إضافة حالة المراجعة)
const state = {
    currentUser: null,
    currentEmail: null,
    currentService: null,
    selectedNetwork: null,
    unsubscribeOrders: null,
    unsubscribeCards: null,
    realBalance: "0",        
    balanceVisible: true,
    accountNumber: null, 
    isVerified: false,
    verificationStatus: "none" 
};

function generateAccountNumber() {
    return Math.floor(1000000 + Math.random() * 9000000).toString();
}

const servicesConfig = {
    "ستارلينك": { columns: 2, options: [ { name: "فرنسا 🇫🇷", img: "images/starlink.jpg", price: 450000 }, { name: "الدومينيكان 🇩🇴", img: "images/starlink.jpg", price: 390000 }, { name: "نيجيريا 🇳🇬", img: "images/starlink.jpg", price: 250000 }, { name: "رواندا 🇷🇼", img: "images/starlink.jpg", price: 260000 } ] },
    "شحن رصيد": { columns: 3, options: [ { name: "زين", img: "images/zain.jpeg" }, { name: "سوداني", img: "images/sudani_logo.jpeg" }, { name: "MTN", img: "images/MTN_Logo.svg.png" } ] },
    "ألعاب": { columns: 2, options: [ { name: "PUBG", img: "images/pubg.jpeg" }, { name: "Free Fire", img: "images/freefire.jpeg" } ] },
    "اشتراكات": { columns: 2, options: [ { name: "Netflix", img: "images/Subscriptions.png" }, { name: "Spotify", img: "images/Subscriptions.png" } ] },
    "بطاقات دفع": { columns: 2, options: [ { name: "Visa", img: "images/cards.jpg" }, { name: "Mastercard", img: "images/cards.jpg" } ] },
    "عملات مشفرة": { columns: 2, options: [ { name: "USDT", img: "images/coins.jpg" }, { name: "Bitcoin", img: "images/coins.jpg" } ] }
};

window.showToast = (msg, isError = false) => {
    const t = document.getElementById('toast-message'); 
    t.innerText = msg;
    t.className = isError ? "toast shadcn-toast error show" : "toast shadcn-toast show"; 
    setTimeout(() => t.className = "toast shadcn-toast", 3000);
}

window.switchAuth = (type) => {
    document.getElementById('login-form').style.display = type === 'login' ? 'block' : 'none';
    document.getElementById('signup-form').style.display = type === 'signup' ? 'block' : 'none';
    document.getElementById('tab-login').className = type === 'login' ? 'active' : '';
    document.getElementById('tab-signup').className = type === 'signup' ? 'active' : '';
}

window.toggleSidebar = () => {
    const menu = document.getElementById('sidebar-menu');
    const overlay = document.getElementById('sidebar-overlay');
    if (menu.classList.contains('active')) {
        menu.classList.remove('active'); overlay.classList.remove('active');
        const homeNav = document.getElementById('nav-home');
        if(homeNav) window.switchNavTab(homeNav, 'home');
    } else {
        menu.classList.add('active'); overlay.classList.add('active');
        document.getElementById('sidebar-user-name').innerText = localStorage.getItem('nagra_user_name') || 'زبون نَقْرَة';
        document.getElementById('sidebar-user-email').innerText = localStorage.getItem('nagra_user_email') || 'جاري التحميل...';
    }
};

window.checkVerification = (actionName) => {
    if (!state.isVerified) { window.showToast(`⚠️ عذراً، يجب توثيق حسابك لتتمكن من ${actionName}`, true);
    } else { window.showToast(`نافذة ${actionName} ستفتح هنا قريباً 🚀`); }
};

window.forgotPassword = async () => {
    const email = document.getElementById('login-email').value;
    if(!email) return window.showToast("الرجاء إدخال إيميلك أولاً", true);
    try { await sendPasswordResetEmail(auth, email); window.showToast("تم إرسال رابط التغيير! ✅");
    } catch(e) { window.showToast("حدث خطأ! تأكد من صحة البريد", true); }
};

window.signInWithGoogle = async () => {
    try { window.showToast("جاري فتح جوجل... ⏳", false); await signInWithPopup(auth, googleProvider);
    } catch (error) { window.showToast("حدث خطأ أثناء الدخول", true); }
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userRef = doc(db, "users", user.uid); 
            const snap = await getDoc(userRef);
            
            if (!snap.exists()) {
                await setDoc(userRef, { name: user.displayName || user.email.split('@')[0], email: user.email, balance: 0, accountNumber: generateAccountNumber(), isVerified: false, verificationStatus: "none" });
            } else {
                const data = snap.data();
                if (!data.accountNumber) await updateDoc(userRef, { accountNumber: generateAccountNumber(), isVerified: false, verificationStatus: "none" });
            }

            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'block';

            onSnapshot(userRef, (s) => {
                if (s.exists()) {
                    const data = s.data(); 
                    if(data.isBanned === true) { window.showToast("⛔ تم إيقاف حسابك", true); signOut(auth).then(() => setTimeout(() => location.reload(), 2000)); return; }

                    state.currentUser = data.name; 
                    state.currentEmail = data.email;
                    state.accountNumber = data.accountNumber; 
                    state.isVerified = data.isVerified || false;
                    state.verificationStatus = data.verificationStatus || "none"; // 🌟 تحديث حالة المراجعة

                    localStorage.setItem('nagra_user_name', data.name); 
                    localStorage.setItem('nagra_user_email', data.email);

                    if(document.getElementById('sidebar-user-name')) document.getElementById('sidebar-user-name').innerText = data.name;
                    if(document.getElementById('sidebar-user-email')) document.getElementById('sidebar-user-email').innerText = data.email;
                    if(document.getElementById('sidebar-acc-num')) document.getElementById('sidebar-acc-num').innerText = `رقم الحساب: ${state.accountNumber}`;
                    
                    const sidebarVerification = document.getElementById('sidebar-verification');
                    if(sidebarVerification) {
                        if(state.isVerified) { sidebarVerification.innerHTML = '<span style="font-size: 11px; color: #10b981; font-weight: bold;">حساب موثق 🟢</span>'; sidebarVerification.onclick = null; 
                        } else if (state.verificationStatus === 'pending') { sidebarVerification.innerHTML = '<span style="font-size: 11px; color: #f59e0b; font-weight: bold;">قيد المراجعة ⏳</span>'; sidebarVerification.onclick = () => window.showToast('مستنداتك قيد المراجعة ⏳');
                        } else { sidebarVerification.innerHTML = '<span style="font-size: 11px; color: #ef4444; font-weight: bold;">غير موثق 🔴</span>'; sidebarVerification.onclick = () => window.openVerificationModal(); }
                    }
                    
                    state.realBalance = (Number(data.balance) || 0).toLocaleString();
                    const balanceAmountEl = document.getElementById('balance-amount');
                    if (balanceAmountEl) { balanceAmountEl.innerText = state.balanceVisible ? "••••••" : state.realBalance; }
                    loadOrders(user.uid);
                }
            });
        } catch (error) { window.showToast("حدث خطأ", true); }
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
});

document.getElementById('btn-signup-execute').onclick = async () => {
    const name = document.getElementById('reg-name').value, email = document.getElementById('reg-email').value, pass = document.getElementById('reg-pass').value;
    if(!name || !email || !pass) return window.showToast("املأ البيانات", true);
    try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", res.user.uid), { name, email, balance: 0, accountNumber: generateAccountNumber(), isVerified: false, verificationStatus: "none" });
    } catch (e) { window.showToast("فشل التسجيل", true); }
}

document.getElementById('btn-login-execute').onclick = async () => {
    try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value); 
    } catch (e) { window.showToast("كلمة المرور أو الإيميل غير صحيح", true); }
}

function loadOrders(userId) {
    if (state.unsubscribeOrders) state.unsubscribeOrders(); 
    state.unsubscribeOrders = onSnapshot(query(collection(db, "orders"), where("uid", "==", userId)), (snap) => {
        const container = document.getElementById('user-orders-list'); container.innerHTML = ""; 
        let orders = []; snap.forEach(d => orders.push({id: d.id, ...d.data()})); orders.sort((a,b) => b.date.toMillis() - a.date.toMillis());
        if(orders.length === 0) { container.innerHTML = "<p style='text-align:center; padding:20px; color:#64748b;'>لا توجد طلبات سابقة 📭</p>"; return; }
        orders.forEach(o => {
            let statusClass = o.status === 'مكتمل' ? 'status-completed' : (o.status === 'مرفوض' ? 'status-rejected' : 'status-pending');
            let adminReplyHtml = "";
            if (o.adminReply) {
                adminReplyHtml = o.service === 'بطاقات دفع' && o.status === 'مكتمل' 
                ? `<div style="margin-top: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 13px; color: #0f172a; border: 1px solid #e2e8f0; font-weight: 700; text-align: center;">💳 تم إصدار البطاقة! تجدها في قسم (بطاقاتي)</div>` 
                : `<div style="margin-top: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 13px; color: #334155; border: 1px solid #e2e8f0; font-weight: 600; text-align: right;">الرد: <span style="color: #0f172a; user-select: all;">${o.adminReply}</span></div>`;
            }
            container.innerHTML += `<div class="history-card"><div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;"><div class="history-info" style="flex: 1;"><h4>${o.service} ${o.network ? '('+o.network+')' : ''}</h4><p>${o.targetInfo}</p><span class="status-badge ${statusClass}">${o.status}</span></div><div class="history-price">${Number(o.amount).toLocaleString()} ج.س</div></div>${adminReplyHtml}</div>`;
        });
    });
}

window.openOrderModal = (service) => {
    state.currentService = service; const config = servicesConfig[service]; const grid = document.getElementById('dynamic-options-grid');
    if(!config) return window.showToast("الخدمة غير متوفرة حالياً", true);
    document.getElementById('order-modal').style.display = 'flex'; document.getElementById('step-1-options').style.display = 'block'; document.getElementById('step-2-details').style.display = 'none'; document.getElementById('modal-title').textContent = "اختر نوع " + service;
    grid.innerHTML = ""; grid.style.gridTemplateColumns = `repeat(${config.columns}, 1fr)`; grid.style.gap = "12px"; 
    config.options.forEach(opt => {
        const item = document.createElement("div"); item.className = "shadcn-card-interactive"; item.innerHTML = `${opt.img ? `<div class="cat-icon" style="width: 48px; height: 48px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: center; align-items: center; overflow: hidden;"><img src="${opt.img}" alt="${opt.name}" style="width: 100%; height: 100%; object-fit: contain; transform: scale(1.4);" onerror="this.style.display='none'"></div>` : ''}<p style="color: #0f172a; font-weight: 700; font-size: 14px; margin: 0;">${opt.name}</p>${opt.price ? `<p style="color: #10b981; font-size: 14px; margin-top: 6px; font-weight: 800; direction: ltr;">${opt.price.toLocaleString()} ج.س</p>` : ''}`;
        item.addEventListener("click", () => window.proceedToStep2(opt.name, opt.price)); grid.appendChild(item);
    });
}

document.querySelectorAll(".service-item").forEach(item => { item.addEventListener("click", () => { const serviceName = item.dataset.service; if(serviceName) openOrderModal(serviceName); }); });
document.getElementById('btn-history')?.addEventListener("click", () => { document.getElementById('history-modal').style.display = 'flex'; const historyNav = document.getElementById('nav-history'); if(historyNav) window.switchNavTab(historyNav, 'history'); });

window.proceedToStep2 = (subService, price = null) => {
    state.selectedNetwork = subService; document.getElementById('step-1-options').style.display = 'none'; document.getElementById('step-2-details').style.display = 'block'; document.getElementById('modal-title').textContent = "طلب " + subService;
    const targetInput = document.getElementById('order-target'), amountInput = document.getElementById('order-amount');
    targetInput.placeholder = state.currentService === "ستارلينك" ? "رقم الحساب (Account ID) أو الإيميل" : "البيانات المطلوبة";
    if (price) { amountInput.value = price; amountInput.disabled = true; amountInput.style.background = "#f1f5f9"; amountInput.style.color = "#0f172a"; amountInput.style.fontWeight = "bold"; } 
    else { amountInput.value = ''; amountInput.disabled = false; amountInput.style.background = ""; amountInput.style.color = ""; amountInput.style.fontWeight = ""; }
}

window.closeModal = () => document.getElementById('order-modal').style.display = 'none'; 
window.openHistoryModal = () => document.getElementById('history-modal').style.display = 'flex';
window.closeHistoryModal = () => { document.getElementById('history-modal').style.display = 'none'; const homeNav = document.getElementById('nav-home'); if(homeNav) window.switchNavTab(homeNav, 'home'); };
window.openRechargeModal = () => document.getElementById('recharge-modal').style.display = 'flex';
window.closeRechargeModal = () => document.getElementById('recharge-modal').style.display = 'none';

window.submitRecharge = async () => {
    const amt = document.getElementById('recharge-amount').value, rec = document.getElementById('recharge-receipt').value;
    if(!amt || !rec) return window.showToast("أكمل البيانات", true); if(Number(amt) <= 0) return window.showToast("المبلغ غير صحيح! 🚫", true);
    await addDoc(collection(db, "orders"), { uid: auth.currentUser.uid, user: state.currentUser, service: "تغذية المحفظة", targetInfo: "إشعار رقم: " + rec, amount: Number(amt), status: "قيد المراجعة", date: new Date() });
    window.showToast("تم الإرسال 🚀"); window.closeRechargeModal();
}

window.submitOrder = async () => {
    const tar = document.getElementById('order-target').value, amt = document.getElementById('order-amount').value, btn = document.getElementById('submitBtn');
    if(!tar || !amt) return window.showToast("أكمل البيانات", true); if(Number(amt) <= 0) return window.showToast("المبلغ غير صحيح! 🚫", true);
    if(btn) { btn.disabled = true; btn.innerText = "جاري الإرسال..."; }
    try { await addDoc(collection(db, "orders"), { uid: auth.currentUser.uid, user: state.currentUser, service: state.currentService, network: state.selectedNetwork, targetInfo: tar, amount: Number(amt), status: "قيد التنفيذ", date: new Date() }); window.showToast("تم إرسال طلبك 📦"); window.closeModal();
    } catch(e) { window.showToast("حدث خطأ", true); } finally { if(btn) { btn.disabled = false; btn.innerText = "تأكيد الطلب"; } }
}

window.openMyCards = () => {
    document.getElementById('cards-modal').style.display = 'flex'; const cardsNav = document.getElementById('nav-cards'); if(cardsNav) window.switchNavTab(cardsNav, 'cards');
    const list = document.getElementById('my-cards-list'); list.innerHTML = "<p class='loading-text' style='text-align:center;'>جاري جلب البطاقات... ⏳</p>";
    onSnapshot(query(collection(db, "orders"), where("uid", "==", auth.currentUser.uid)), (snap) => {
        list.innerHTML = ""; let cards = []; snap.forEach(d => { let o = d.data(); if(o.service === 'بطاقات دفع' && o.status === 'مكتمل') cards.push(o); }); cards.sort((a,b) => b.date.toMillis() - a.date.toMillis());
        if(cards.length === 0) { list.innerHTML = "<div style='text-align:center; padding: 20px;'><div style='font-size: 40px; margin-bottom: 10px;'>💳</div><p style='color: #64748b; font-weight: bold;'>لا توجد بطاقات محفوظة</p></div>"; return; }
        cards.forEach(c => {
            let cardBg = c.network === 'Visa' ? '#0f172a' : (c.network === 'Mastercard' ? '#020817' : '#1e293b'); 
            list.innerHTML += `<div class="virtual-card" style="background: ${cardBg};"><div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;"><div class="v-card-type">${c.network || 'Nagra Virtual'}</div><span style="background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid rgba(16, 185, 129, 0.3);">🟢 فعالة</span></div><div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1); color: #f8fafc; font-family: monospace; font-size: 15px; letter-spacing: 1px; line-height: 1.6;">${c.adminReply}</div></div>`;
        });
    });
};

window.closeCardsModal = () => { document.getElementById('cards-modal').style.display = 'none'; const homeNav = document.getElementById('nav-home'); if(homeNav) window.switchNavTab(homeNav, 'home'); };

let logoutTimer;
function resetTimer() { clearTimeout(logoutTimer); logoutTimer = setTimeout(() => { if (auth.currentUser) { signOut(auth).then(() => { localStorage.removeItem('nagra_user_name'); localStorage.removeItem('nagra_user_email'); location.reload(); }); } }, 10 * 60 * 1000); }
['click', 'mousemove', 'keydown', 'touchstart'].forEach(evt => document.addEventListener(evt, resetTimer)); resetTimer();

window.forceLogout = async () => { await signOut(auth); localStorage.removeItem('nagra_user_name'); localStorage.removeItem('nagra_user_email'); location.reload(); }

document.addEventListener("click", function(e) {
    const toggleBtn = e.target.closest("#toggle-balance");
    if (toggleBtn) {
        const balanceText = document.getElementById("balance-amount"); if (!balanceText) return;
        if (state.balanceVisible) { balanceText.innerText = "••••••"; toggleBtn.innerHTML = '<i data-lucide="eye-off"></i>'; } else { balanceText.innerText = state.realBalance; toggleBtn.innerHTML = '<i data-lucide="eye"></i>'; }
        if (typeof lucide !== 'undefined') lucide.createIcons();
        state.balanceVisible = !state.balanceVisible;
    }
});

// 🌟🌟 دوال الإعدادات الشخصية 🌟🌟
window.openSettingsModal = () => {
    document.getElementById('set-name').innerText = state.currentUser || 'غير متوفر';
    document.getElementById('set-email').innerText = state.currentEmail || 'غير متوفر';
    document.getElementById('set-acc').innerText = state.accountNumber || 'غير متوفر';
    
    const statusEl = document.getElementById('set-status');
    const verifyBtn = document.getElementById('btn-open-verify-from-settings');

    if (state.isVerified) {
        statusEl.innerHTML = '<span style="color: #10b981; font-weight: bold;">موثق 🟢</span>';
        verifyBtn.style.display = 'none'; 
    } else if (state.verificationStatus === 'pending') {
        statusEl.innerHTML = '<span style="color: #f59e0b; font-weight: bold;">قيد المراجعة ⏳</span>';
        verifyBtn.style.display = 'none'; 
    } else {
        statusEl.innerHTML = '<span style="color: #ef4444; font-weight: bold;">غير موثق 🔴</span>';
        verifyBtn.style.display = 'inline-flex'; 
    }

    document.getElementById('settings-modal').style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.closeSettingsModal = () => {
    document.getElementById('settings-modal').style.display = 'none';
};

window.switchNavTab = (element, tabName) => {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active')); element.classList.add('active');
    if (tabName === 'cards') { if(document.getElementById('cards-modal').style.display !== 'flex') window.openMyCards();
    } else if (tabName === 'history') { if(document.getElementById('history-modal').style.display !== 'flex') window.openHistoryModal();
    } else if (tabName === 'profile') { 
        window.openSettingsModal(); // 🌟 يفتح الإعدادات مباشرة من الشريط السفلي
    } else if (tabName === 'home') { document.getElementById('cards-modal').style.display = 'none'; document.getElementById('history-modal').style.display = 'none'; const menu = document.getElementById('sidebar-menu'); const overlay = document.getElementById('sidebar-overlay'); if (menu.classList.contains('active')) { menu.classList.remove('active'); overlay.classList.remove('active'); } }
};

// 🌟🌟 دوال التوثيق ورفع المستندات 🌟🌟
window.openVerificationModal = () => { const modal = document.getElementById('verification-modal'); if(modal) modal.style.display = 'flex'; };
window.closeVerificationModal = () => { const modal = document.getElementById('verification-modal'); if(modal) modal.style.display = 'none'; };

window.submitVerification = async () => {
    const fileInput = document.getElementById('id-upload-input'); if (!fileInput) return;
    const file = fileInput.files[0]; if (!file) return window.showToast("الرجاء اختيار صورة المستند أولاً", true);
    const btn = document.getElementById('btn-submit-verification');
    if(btn) { btn.disabled = true; btn.innerText = "جاري الرفع... ⏳"; }
    try {
        const storageRef = ref(storage, `verifications/${auth.currentUser.uid}/${file.name}`);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        await updateDoc(doc(db, "users", auth.currentUser.uid), { verificationStatus: "pending", idDocumentUrl: downloadURL });
        window.showToast("تم رفع المستند بنجاح! جاري المراجعة ⏳"); window.closeVerificationModal();
    } catch (error) { window.showToast("حدث خطأ أثناء الرفع.", true);
    } finally { if(btn) { btn.disabled = false; btn.innerText = "رفع المستند"; } }
};
