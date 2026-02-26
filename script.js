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
    realBalance: "0",        // 🌟 إضافة لحفظ الرصيد الحقيقي
    balanceVisible: true     // 🌟 إضافة لمعرفة حالة الرصيد (مخفي/ظاهر)
};

// 2️⃣ Service Config System
const servicesConfig = {
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
    t.className = isError ? "toast error show" : "toast show"; 
    setTimeout(() => t.className = "toast", 3000);
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
                
                // 🌟 التعديل الجديد لمنع تخريب الـ HTML 🌟
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
    if (state.unsubscribeOrders) {
        state.unsubscribeOrders(); 
    }

    const q = query(collection(db, "orders"), where("uid", "==", userId));

    state.unsubscribeOrders = onSnapshot(q, (snap) => {
        const container = document.getElementById('user-orders-list'); 
        container.innerHTML = ""; 
        let orders = [];
        
        snap.forEach(d => orders.push({id: d.id, ...d.data()})); 
        orders.sort((a,b) => b.date.toMillis() - a.date.toMillis());
        
        orders.forEach(o => {
            const div = document.createElement("div");
            div.className = `order-card-pro ${o.status === 'مكتمل' ? 'completed' : (o.status === 'مرفوض' ? 'rejected' : 'pending')}`;
            div.style.display = "flex";
            div.style.flexDirection = "column";
            div.style.gap = "5px";

            const topDiv = document.createElement("div");
            topDiv.style.display = "flex";
            topDiv.style.justifyContent = "space-between";
            topDiv.style.alignItems = "center";
            topDiv.style.width = "100%";

            const infoDiv = document.createElement("div");
            const title = document.createElement("h4");
            title.style.margin = "0";
            title.textContent = `${o.service} ${o.network ? '('+o.network+')' : ''}`;
            
            const targetInfo = document.createElement("p");
            targetInfo.style.margin = "3px 0 0";
            targetInfo.style.fontSize = "12px";
            targetInfo.style.color = "#7f8c8d";
            targetInfo.textContent = o.targetInfo;

            infoDiv.appendChild(title);
            infoDiv.appendChild(targetInfo);

            const amountDiv = document.createElement("div");
            amountDiv.style.textAlign = "left";
            const amountBold = document.createElement("b");
            amountBold.textContent = `${Number(o.amount).toLocaleString()} ج.س`;
            
            const statusPill = document.createElement("span");
            statusPill.className = `status-pill status-${o.status === 'مكتمل' ? 'completed' : (o.status === 'مرفوض' ? 'rejected' : 'pending')}`;
            statusPill.style.display = "inline-block";
            statusPill.style.marginTop = "5px";
            statusPill.textContent = o.status;

            amountDiv.appendChild(amountBold);
            amountDiv.appendChild(document.createElement("br"));
            amountDiv.appendChild(statusPill);

            topDiv.appendChild(infoDiv);
            topDiv.appendChild(amountDiv);
            div.appendChild(topDiv);

            if (o.adminReply) {
                const replyDiv = document.createElement("div");
                replyDiv.style.marginTop = "10px";
                replyDiv.style.padding = "10px";
                replyDiv.style.background = "#e3f2fd";
                replyDiv.style.borderRadius = "10px";
                replyDiv.style.fontSize = "13px";
                replyDiv.style.color = "#0984e3";
                replyDiv.style.border = "1px dashed #74b9ff";
                replyDiv.style.fontWeight = "bold";
                
                if(o.service === 'بطاقات دفع' && o.status === 'مكتمل') {
                    replyDiv.innerHTML = `<div style="text-align: center; color: #27ae60;">💳 تم إصدار البطاقة! تجدها في قسم (بطاقاتي)</div>`; 
                } else {
                    const replyLabel = document.createTextNode("رد الإدارة: ");
                    const replySpan = document.createElement("span");
                    replySpan.style.color = "#2d3436";
                    replySpan.style.userSelect = "all";
                    replySpan.textContent = o.adminReply;
                    replyDiv.appendChild(replyLabel);
                    replyDiv.appendChild(replySpan);
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
        item.innerHTML = `
            <div class="pro-logo"><img src="${opt.img}" alt="${opt.name}"></div>
            <p>${opt.name}</p>
        `;
        item.addEventListener("click", () => {
            window.proceedToStep2(opt.name);
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
});

window.proceedToStep2 = (subService) => {
    state.selectedNetwork = subService;
    document.getElementById('step-1-options').style.display = 'none';
    document.getElementById('step-2-details').style.display = 'block';
    document.getElementById('modal-title').textContent = "طلب " + subService;
    document.getElementById('order-target').placeholder = "البيانات المطلوبة";
    document.getElementById('order-amount').value = '';
}

window.closeModal = () => document.getElementById('order-modal').style.display = 'none'; 
window.openHistoryModal = () => document.getElementById('history-modal').style.display = 'flex';
window.closeHistoryModal = () => document.getElementById('history-modal').style.display = 'none';
window.openRechargeModal = () => document.getElementById('recharge-modal').style.display = 'flex';
window.closeRechargeModal = () => document.getElementById('recharge-modal').style.display = 'none';

window.submitRecharge = async () => {
    const amt = document.getElementById('recharge-amount').value; 
    const rec = document.getElementById('recharge-receipt').value;
    if(!amt || !rec) return window.showToast("أكمل البيانات", true);
    if(Number(amt) <= 0) return window.showToast("المبلغ غير صحيح! 🚫", true);
    
    await addDoc(collection(db, "orders"), { 
        uid: auth.currentUser.uid, 
        user: state.currentUser, 
        service: "تغذية المحفظة", 
        targetInfo: "إشعار رقم: " + rec, 
        amount: Number(amt), 
        status: "قيد المراجعة", 
        date: new Date() 
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
    
    if(btn) {
        btn.disabled = true;
        btn.innerText = "جاري الإرسال...";
    }

    try {
        await addDoc(collection(db, "orders"), { 
            uid: auth.currentUser.uid, 
            user: state.currentUser, 
            service: state.currentService, 
            network: state.selectedNetwork, 
            targetInfo: tar, 
            amount: Number(amt), 
            status: "قيد التنفيذ", 
            date: new Date() 
        });
        window.showToast("تم إرسال طلبك 📦"); 
        window.closeModal();
    } catch(e) {
        window.showToast("حدث خطأ أثناء الطلب", true);
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerText = "تأكيد الطلب";
        }
    }
}

window.openMyCards = () => {
    document.getElementById('cards-modal').style.display = 'flex';
    const list = document.getElementById('my-cards-list');
    list.innerHTML = "<p style='text-align:center; color: #7f8c8d;'>جاري جلب البطاقات... ⏳</p>";

    onSnapshot(query(collection(db, "orders"), where("uid", "==", auth.currentUser.uid)), (snap) => {
        list.innerHTML = ""; 
        let cards = [];
        
        snap.forEach(d => {
            let o = d.data();
            if(o.service === 'بطاقات دفع' && o.status === 'مكتمل') cards.push(o);
        });
        cards.sort((a,b) => b.date.toMillis() - a.date.toMillis());

        if(cards.length === 0) {
            list.innerHTML = "<div style='text-align:center; padding: 20px;'><div style='font-size: 40px; margin-bottom: 10px;'>📭</div><p style='color: #e74c3c; font-weight: bold;'>لا توجد بطاقات محفوظة حالياً</p></div>";
            return;
        }

        cards.forEach(c => {
            let cardGradient = c.network === 'Visa' ? 'linear-gradient(135deg, #1e3c72, #2a5298)' : 'linear-gradient(135deg, #2c3e50, #bdc3c7)';
            if (c.network === 'Mastercard') cardGradient = 'linear-gradient(135deg, #eb3349, #f45c43)';

            list.innerHTML += `
                <div style="background: ${cardGradient}; padding: 20px; border-radius: 15px; margin-bottom: 15px; text-align: right; box-shadow: 0 10px 20px rgba(0,0,0,0.25); color: white; position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.2);">
                    <div style="width: 45px; height: 35px; background: linear-gradient(135deg, #ffd700, #daa520); border-radius: 6px; margin-bottom: 15px; opacity: 0.9; box-shadow: inset 1px 1px 4px rgba(0,0,0,0.3); border: 1px solid #b8860b;"></div>
                    <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom: 15px; padding-bottom: 5px;">
                        <span style="font-weight: 900; font-size: 22px; text-shadow: 1px 1px 3px rgba(0,0,0,0.5); font-family: monospace; letter-spacing: 2px;">${c.network}</span>
                        <span style="background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; border: 1px solid rgba(255,255,255,0.3);">🟢 فعالة</span>
                    </div>
                    <div style="background: white; border-radius: 10px; padding: 12px; color: #333; margin-top: 10px; box-shadow: inset 0 2px 5px rgba(0,0,0,0.05);">
                        ${c.adminReply}
                    </div>
                </div>
            `;
        });
    });
};

window.closeCardsModal = () => document.getElementById('cards-modal').style.display = 'none';

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

// 🌟🌟 إضافة ميزة إخفاء/إظهار الرصيد 🌟🌟
document.addEventListener("click", function(e) {
    if (e.target.id === "toggle-balance") {
        const balanceText = document.getElementById("balance-amount");
        if (!balanceText) return;

        if (state.balanceVisible) {
            balanceText.innerText = "••••••";
            e.target.innerText = "🙈";
        } else {
            balanceText.innerText = state.realBalance;
            e.target.innerText = "👁️";
        }

        state.balanceVisible = !state.balanceVisible;
    }
});
 
