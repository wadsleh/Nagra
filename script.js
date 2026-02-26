import { firebaseConfig } from './config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const app = initializeApp(firebaseConfig); 
const db = getFirestore(app); 
const auth = getAuth(app); 
const googleProvider = new GoogleAuthProvider();

// 1️⃣ State Management
const state = {
    currentUser: null,
    currentEmail: null,
    currentService: null,
    selectedNetwork: null,
    unsubscribeOrders: null,
    unsubscribeCards: null,
    realBalance: "0",        
    balanceVisible: true     
};

// 2️⃣ Service Config System (تمت إضافة ستارلينك والأسعار الثابتة 🌟)
const servicesConfig = {
    "ستارلينك": {
        columns: 2,
        options: [
            { name: "فرنسا 🇫🇷", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Starlink_Logo.svg/512px-Starlink_Logo.svg.png", price: 450000 },
            { name: "الدومينيكان 🇩🇴", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Starlink_Logo.svg/512px-Starlink_Logo.svg.png", price: 390000 },
            { name: "نيجيريا 🇳🇬", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Starlink_Logo.svg/512px-Starlink_Logo.svg.png", price: 250000 }, 
            { name: "رواندا 🇷🇼", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Starlink_Logo.svg/512px-Starlink_Logo.svg.png", price: 260000 }
        ]
    },
    "شحن رصيد": {
        columns: 3,
        options: [
            { name: "زين", img: "images/zain.jpeg" },
            { name: "سوداني", img: "images/sudani_logo.jpeg" },
            { name: "MTN", img: "images/MTN_Logo.svg.png" }
        ]
    },
    "ألعاب": {
        columns: 2,
        options: [
            { name: "PUBG", img: "images/pubg.jpeg" },
            { name: "Free Fire", img: "images/freefire.jpeg" }
        ]
    },
    "اشتراكات": {
        columns: 2,
        options: [
            { name: "Netflix", img: "images/Subscriptions.png" },
            { name: "Spotify", img: "images/Subscriptions.png" }
        ]
    },
    "بطاقات دفع": {
        columns: 2,
        options: [
            { name: "Visa", img: "images/cards.jpg" },
            { name: "Mastercard", img: "images/cards.jpg" }
        ]
    },
    "عملات مشفرة": {
        columns: 2,
        options: [
            { name: "USDT", img: "images/coins.jpg" },
            { name: "Bitcoin", img: "images/coins.jpg" }
        ]
    }
};

window.showToast = (msg, isError = false) => {
    const t = document.getElementById('toast-message'); 
    t.innerText = msg;
    // تعديل الكلاس ليتوافق مع shadcn
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
        menu.classList.remove('active');
        overlay.classList.remove('active');
        const homeNav = document.getElementById('nav-home');
        if(homeNav) window.switchNavTab(homeNav, 'home');
    } else {
        menu.classList.add('active');
        overlay.classList.add('active');
        const uName = localStorage.getItem('nagra_user_name') || 'زبون نَقْرَة';
        const uEmail = localStorage.getItem('nagra_user_email') || 'جاري التحميل...';
        document.getElementById('sidebar-user-name').innerText = uName;
        document.getElementById('sidebar-user-email').innerText = uEmail;
    }
};

window.forgotPassword = async () => {
    const email = document.getElementById('login-email').value;
    if(!email) return window.showToast("الرجاء إدخال إيميلك أولاً في حقل البريد أعلاه 📧", true);
    try {
        await sendPasswordResetEmail(auth, email);
        window.showToast("تم إرسال رابط تغيير كلمة المرور إلى إيميلك! ✅");
    } catch(e) {
        window.showToast("حدث خطأ! تأكد من صحة البريد الإلكتروني", true);
    }
};

window.signInWithGoogle = async () => {
    try {
        window.showToast("جاري فتح نافذة جوجل... ⏳", false);
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        window.showToast("حدث خطأ أثناء الدخول بجوجل", true);
    }
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid); 
        const snap = await getDoc(userRef);
        
        if (!snap.exists()) {
            await setDoc(userRef, { name: user.displayName || user.email.split('@')[0], email: user.email, balance: 0 });
        }

        onSnapshot(userRef, (s) => {
            if (s.exists()) {
                const data = s.data(); 
                if(data.isBanned === true) {
                    window.showToast("⛔ تم إيقاف حسابك من قبل الإدارة", true);
                    signOut(auth).then(() => setTimeout(() => location.reload(), 2000));
                    return; 
                }

                state.currentUser = data.name; 
                state.currentEmail = data.email;
                localStorage.setItem('nagra_user_name', data.name);
                localStorage.setItem('nagra_user_email', data.email);

                const sidebarName = document.getElementById('sidebar-user-name');
                const sidebarEmail = document.getElementById('sidebar-user-email');
                if(sidebarName) sidebarName.innerText = data.name;
                if(sidebarEmail) sidebarEmail.innerText = data.email;

                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('main-app').style.display = 'block';
                
                state.realBalance = (Number(data.balance) || 0).toLocaleString();
                const balanceAmountEl = document.getElementById('balance-amount');
                if (balanceAmountEl) {
                    if (state.balanceVisible) {
                        balanceAmountEl.innerText = state.realBalance;
                    }
                }
                loadOrders(user.uid);
            }
        });
    }
});

document.getElementById('btn-signup-execute').onclick = async () => {
    const name = document.getElementById('reg-name').value; 
    const email = document.getElementById('reg-email').value; 
    const pass = document.getElementById('reg-pass').value;
    if(!name || !email || !pass) return window.showToast("املأ البيانات", true);
    try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", res.user.uid), { name, email, balance: 0 });
    } catch (e) { 
        window.showToast("فشل التسجيل", true); 
    }
}

document.getElementById('btn-login-execute').onclick = async () => {
    try { 
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value); 
    } catch (e) { 
        window.showToast("كلمة المرور أو الإيميل غير صحيح", true); 
    }
}

function loadOrders(userId) {
    if (state.unsubscribeOrders) state.unsubscribeOrders(); 
    const q = query(collection(db, "orders"), where("uid", "==", userId));
    state.unsubscribeOrders = onSnapshot(q, (snap) => {
        const container = document.getElementById('user-orders-list'); 
        container.innerHTML = ""; 
        let orders = [];
        snap.forEach(d => orders.push({id: d.id, ...d.data()})); 
        orders.sort((a,b) => b.date.toMillis() - a.date.toMillis());
        
        orders.forEach(o => {
            const div = document.createElement("div");
            // إضافة ستايل shadcn للسجل
            div.className = `order-card-pro shadcn-card ${o.status === 'مكتمل' ? 'completed' : (o.status === 'مرفوض' ? 'rejected' : 'pending')}`;
            div.style.display = "flex"; div.style.flexDirection = "column"; div.style.gap = "8px";
            div.style.padding = "16px"; div.style.marginBottom = "12px"; div.style.borderRightWidth = "4px";

            const topDiv = document.createElement("div");
            topDiv.style.display = "flex"; topDiv.style.justifyContent = "space-between"; topDiv.style.alignItems = "center"; topDiv.style.width = "100%";

            const infoDiv = document.createElement("div");
            const title = document.createElement("h4");
            title.style.margin = "0"; title.style.color = "#0f172a"; title.textContent = `${o.service} ${o.network ? '('+o.network+')' : ''}`;
            
            const targetInfo = document.createElement("p");
            targetInfo.style.margin = "4px 0 0"; targetInfo.style.fontSize = "12px"; targetInfo.style.color = "#64748b";
            targetInfo.textContent = o.targetInfo;

            infoDiv.appendChild(title); infoDiv.appendChild(targetInfo);

            const amountDiv = document.createElement("div");
            amountDiv.style.textAlign = "left";
            const amountBold = document.createElement("b");
            amountBold.style.color = "#0f172a";
            amountBold.textContent = `${Number(o.amount).toLocaleString()} ج.س`;
            
            const statusPill = document.createElement("span");
            statusPill.className = `status-pill status-${o.status === 'مكتمل' ? 'completed' : (o.status === 'مرفوض' ? 'rejected' : 'pending')}`;
            statusPill.style.display = "inline-block"; statusPill.style.marginTop = "6px"; statusPill.textContent = o.status;

            amountDiv.appendChild(amountBold); amountDiv.appendChild(document.createElement("br")); amountDiv.appendChild(statusPill);
            topDiv.appendChild(infoDiv); topDiv.appendChild(amountDiv); div.appendChild(topDiv);

            if (o.adminReply) {
                const replyDiv = document.createElement("div");
                // تعديل مظهر الرد ليتوافق مع shadcn
                replyDiv.style.marginTop = "10px"; replyDiv.style.padding = "12px"; replyDiv.style.background = "#f8fafc"; replyDiv.style.borderRadius = "8px"; replyDiv.style.fontSize = "13px"; replyDiv.style.color = "#334155"; replyDiv.style.border = "1px solid #e2e8f0"; replyDiv.style.fontWeight = "600";
                
                if(o.service === 'بطاقات دفع' && o.status === 'مكتمل') {
                    replyDiv.innerHTML = `<div style="text-align: center; color: #0f172a;">💳 تم إصدار البطاقة! تجدها في قسم (بطاقاتي)</div>`; 
                } else {
                    const replyLabel = document.createTextNode("الرد: ");
                    const replySpan = document.createElement("span");
                    replySpan.style.color = "#0f172a"; replySpan.style.userSelect = "all"; replySpan.textContent = o.adminReply;
                    replyDiv.appendChild(replyLabel); replyDiv.appendChild(replySpan);
                }
                div.appendChild(replyDiv);
            }
            container.appendChild(div);
        });
    });
}

window.openOrderModal = (service) => {
    state.currentService = service;
    const config = servicesConfig[service];
    const grid = document.getElementById('dynamic-options-grid');
    if(!config) return window.showToast("الخدمة غير متوفرة حالياً", true);

    document.getElementById('order-modal').style.display = 'flex';
    document.getElementById('step-1-options').style.display = 'block';
    document.getElementById('step-2-details').style.display = 'none';
    document.getElementById('modal-title').textContent = "اختر نوع " + service;
    
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${config.columns}, 1fr)`;

    config.options.forEach(opt => {
        const item = document.createElement("div");
        item.className = "network-card";
        // تعديل ألوان وتصميم شبكة الخيارات لـ shadcn
        item.style.border = "1px solid #e2e8f0";
        item.style.borderRadius = "8px";
        item.innerHTML = `
            <div class="pro-logo" style="border:none; box-shadow:none; background:transparent;"><img src="${opt.img}" alt="${opt.name}"></div>
            <p style="color: #0f172a; font-weight: 600;">${opt.name}</p>
            ${opt.price ? `<p style="color: #0f172a; font-size: 12px; margin-top: 5px; font-weight: 700;">${opt.price.toLocaleString()} ج.س</p>` : ''}
        `;
        item.addEventListener("click", () => {
            window.proceedToStep2(opt.name, opt.price); 
        });
        grid.appendChild(item);
    });
}

document.querySelectorAll(".service-item").forEach(item => {
    item.addEventListener("click", () => {
        const serviceName = item.dataset.service;
        if(serviceName) openOrderModal(serviceName);
    });
});

document.getElementById('btn-history')?.addEventListener("click", () => {
    document.getElementById('history-modal').style.display = 'flex';
    const historyNav = document.getElementById('nav-history');
    if(historyNav) window.switchNavTab(historyNav, 'history');
});

// 🌟 تعديل الدالة لاستقبال السعر وتجميد حقل الإدخال 🌟
window.proceedToStep2 = (subService, price = null) => {
    state.selectedNetwork = subService;
    document.getElementById('step-1-options').style.display = 'none';
    document.getElementById('step-2-details').style.display = 'block';
    document.getElementById('modal-title').textContent = "طلب " + subService;
    
    const targetInput = document.getElementById('order-target');
    const amountInput = document.getElementById('order-amount');

    if (state.currentService === "ستارلينك") {
        targetInput.placeholder = "رقم الحساب (Account ID) أو الإيميل المرتبط";
    } else {
        targetInput.placeholder = "البيانات المطلوبة";
    }

    if (price) {
        amountInput.value = price;
        amountInput.disabled = true; 
        amountInput.style.background = "#f1f5f9"; // لون shadcn للعناصر المعطلة
        amountInput.style.color = "#0f172a";
        amountInput.style.fontWeight = "bold";
    } else {
        amountInput.value = '';
        amountInput.disabled = false;
        amountInput.style.background = "";
        amountInput.style.color = "";
        amountInput.style.fontWeight = "";
    }
}

window.closeModal = () => document.getElementById('order-modal').style.display = 'none'; 

window.openHistoryModal = () => document.getElementById('history-modal').style.display = 'flex';
window.closeHistoryModal = () => {
    document.getElementById('history-modal').style.display = 'none';
    const homeNav = document.getElementById('nav-home');
    if(homeNav) window.switchNavTab(homeNav, 'home');
};

window.openRechargeModal = () => document.getElementById('recharge-modal').style.display = 'flex';
window.closeRechargeModal = () => document.getElementById('recharge-modal').style.display = 'none';

window.submitRecharge = async () => {
    const amt = document.getElementById('recharge-amount').value; 
    const rec = document.getElementById('recharge-receipt').value;
    if(!amt || !rec) return window.showToast("أكمل البيانات", true);
    if(Number(amt) <= 0) return window.showToast("المبلغ غير صحيح! 🚫", true);
    
    await addDoc(collection(db, "orders"), { 
        uid: auth.currentUser.uid, user: state.currentUser, service: "تغذية المحفظة", 
        targetInfo: "إشعار رقم: " + rec, amount: Number(amt), status: "قيد المراجعة", date: new Date() 
    });
    window.showToast("تم الإرسال 🚀"); 
    window.closeRechargeModal();
}

window.submitOrder = async () => {
    const tar = document.getElementById('order-target').value; 
    const amt = document.getElementById('order-amount').value;
    const btn = document.getElementById('submitBtn');

    if(!tar || !amt) return window.showToast("أكمل البيانات", true);
    if(Number(amt) <= 0) return window.showToast("المبلغ غير صحيح! 🚫", true);
    
    if(btn) { btn.disabled = true; btn.innerText = "جاري الإرسال..."; }

    try {
        await addDoc(collection(db, "orders"), { 
            uid: auth.currentUser.uid, user: state.currentUser, service: state.currentService, 
            network: state.selectedNetwork, targetInfo: tar, amount: Number(amt), 
            status: "قيد التنفيذ", date: new Date() 
        });
        window.showToast("تم إرسال طلبك 📦"); 
        window.closeModal();
    } catch(e) {
        window.showToast("حدث خطأ أثناء الطلب", true);
    } finally {
        if(btn) { btn.disabled = false; btn.innerText = "تأكيد الطلب"; }
    }
}

window.openMyCards = () => {
    document.getElementById('cards-modal').style.display = 'flex';
    const cardsNav = document.getElementById('nav-cards');
    if(cardsNav) window.switchNavTab(cardsNav, 'cards');

    const list = document.getElementById('my-cards-list');
    list.innerHTML = "<p class='loading-text'>جاري جلب البطاقات... ⏳</p>";

    onSnapshot(query(collection(db, "orders"), where("uid", "==", auth.currentUser.uid)), (snap) => {
        list.innerHTML = ""; let cards = [];
        snap.forEach(d => {
            let o = d.data();
            if(o.service === 'بطاقات دفع' && o.status === 'مكتمل') cards.push(o);
        });
        cards.sort((a,b) => b.date.toMillis() - a.date.toMillis());

        if(cards.length === 0) {
            list.innerHTML = "<div style='text-align:center; padding: 20px;'><div style='font-size: 40px; margin-bottom: 10px;'>📭</div><p style='color: #64748b; font-weight: bold;'>لا توجد بطاقات محفوظة حالياً</p></div>";
            return;
        }

        cards.forEach(c => {
            // تصميم بطاقة أنيق ورسمي (Minimalist) متوافق مع shadcn بدلاً من التدرجات القوية
            let cardBg = c.network === 'Visa' ? '#0f172a' : '#1e293b'; 
            if (c.network === 'Mastercard') cardBg = '#020817'; 

            list.innerHTML += `
                <div style="background: ${cardBg}; padding: 24px; border-radius: 12px; margin-bottom: 16px; text-align: right; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); color: white; position: relative; border: 1px solid #334155;">
                    <div style="width: 40px; height: 30px; background: #e2e8f0; border-radius: 6px; margin-bottom: 20px; opacity: 0.8;"></div>
                    <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom: 16px;">
                        <span style="font-weight: 700; font-size: 20px; font-family: monospace; letter-spacing: 2px;">${c.network}</span>
                        <span style="background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; border: 1px solid rgba(255,255,255,0.2);">🟢 فعالة</span>
                    </div>
                    <div style="background: #ffffff; border-radius: 8px; padding: 12px; color: #0f172a; margin-top: 10px; font-size: 14px; border: 1px solid #e2e8f0; font-family: 'Tajawal', sans-serif;">
                        ${c.adminReply}
                    </div>
                </div>
            `;
        });
    });
};

window.closeCardsModal = () => {
    document.getElementById('cards-modal').style.display = 'none';
    const homeNav = document.getElementById('nav-home');
    if(homeNav) window.switchNavTab(homeNav, 'home');
};

let logoutTimer;
function resetTimer() {
    clearTimeout(logoutTimer);
    logoutTimer = setTimeout(() => {
        if (auth.currentUser) {
            signOut(auth).then(() => {
                localStorage.removeItem('nagra_user_name');
                localStorage.removeItem('nagra_user_email');
                location.reload();
            });
        }
    }, 10 * 60 * 1000); 
}

['click', 'mousemove', 'keydown', 'touchstart'].forEach(evt => document.addEventListener(evt, resetTimer));
resetTimer();

window.forceLogout = async () => { 
    await signOut(auth); 
    localStorage.removeItem('nagra_user_name');
    localStorage.removeItem('nagra_user_email');
    location.reload(); 
}

document.addEventListener("click", function(e) {
    if (e.target.id === "toggle-balance") {
        const balanceText = document.getElementById("balance-amount");
        if (!balanceText) return;
        if (state.balanceVisible) {
            balanceText.innerText = "••••••"; e.target.innerText = "🙈";
        } else {
            balanceText.innerText = state.realBalance; e.target.innerText = "👁️";
        }
        state.balanceVisible = !state.balanceVisible;
    }
});

window.switchNavTab = (element, tabName) => {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    if (tabName === 'cards') {
        if(document.getElementById('cards-modal').style.display !== 'flex') window.openMyCards();
    } else if (tabName === 'history') {
        if(document.getElementById('history-modal').style.display !== 'flex') window.openHistoryModal();
    } else if (tabName === 'profile') {
        const menu = document.getElementById('sidebar-menu');
        if (!menu.classList.contains('active')) window.toggleSidebar();
    } else if (tabName === 'home') {
        document.getElementById('cards-modal').style.display = 'none';
        document.getElementById('history-modal').style.display = 'none';
        const menu = document.getElementById('sidebar-menu');
        const overlay = document.getElementById('sidebar-overlay');
        if (menu.classList.contains('active')) {
            menu.classList.remove('active'); overlay.classList.remove('active');
        }
    }
};
 
