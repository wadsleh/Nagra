import { firebaseConfig } from './config.js';
 
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const app = initializeApp(firebaseConfig); 
const db = getFirestore(app); 
const auth = getAuth(app); 
const googleProvider = new GoogleAuthProvider();

window.currentUser = ""; 
window.selectedNetwork = ""; 
window.currentService = "";

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

window.signInWithGoogle = async () => {
    try {
        window.showToast("جاري فتح نافذة جوجل... ⏳", false);
        const result = await signInWithPopup(auth, googleProvider);
        if(result.user) {
            window.showToast("تم الدخول بنجاح! 🚀", false);
        }
    } catch (error) {
        console.error(error);
        window.showToast("حدث خطأ أثناء الدخول بجوجل", true);
    }
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid); 
        const snap = await getDoc(userRef);
        
        if (!snap.exists()) {
            await setDoc(userRef, { name: user.displayName || user.email.split('@')[0], email: user.email, balance: 0 });
        } else if (snap.data().balance === undefined) {
            await updateDoc(userRef, { balance: 0 });
        }

        onSnapshot(userRef, (s) => {
            if (s.exists()) {
                const data = s.data(); 
                window.currentUser = data.name;
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('main-app').style.display = 'block';
                document.getElementById('user-balance').innerText = (Number(data.balance) || 0).toLocaleString() + " ج.س";
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
        window.showToast("بيانات خاطئة", true); 
    }
}

function loadOrders(userId) {
function loadOrders(userId) {
    onSnapshot(query(collection(db, "orders"), where("uid", "==", userId)), (snap) => {
        const list = document.getElementById('user-orders-list'); 
        list.innerHTML = ""; 
        let orders = [];
        
        snap.forEach(d => orders.push(d.data())); 
        orders.sort((a,b) => b.date.toMillis() - a.date.toMillis());
        
        orders.forEach(o => {
            const statusClass = o.status === 'مكتمل' ? 'completed' : (o.status === 'مرفوض' ? 'rejected' : 'pending');
            
            // 🌟 الجزء الجديد: عرض رد الإدمن (كود البطاقة أو سبب الرفض) للزبون
            let replyHtml = "";
            if (o.adminReply) {
                replyHtml = `<div style="margin-top: 10px; padding: 10px; background: #e3f2fd; border-radius: 10px; font-size: 13px; color: #0984e3; border: 1px dashed #74b9ff; font-weight: bold;">
                    رد الإدارة: <span style="color:#2d3436; user-select: all;">${o.adminReply}</span>
                </div>`;
            }

            list.innerHTML += `<div class="order-card-pro ${statusClass}" style="display:flex; flex-direction:column; gap:5px;">
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <div>
                        <h4 style="margin:0;">${o.service} ${o.network ? '('+o.network+')' : ''}</h4>
                        <p style="margin:3px 0 0; font-size:12px; color:#7f8c8d;">${o.targetInfo}</p>
                    </div>
                    <div style="text-align:left">
                        <b>${Number(o.amount).toLocaleString()} ج.س</b><br>
                        <span class="status-pill status-${statusClass}" style="display:inline-block; margin-top:5px;">${o.status}</span>
                    </div>
                </div>
                ${replyHtml} </div>`;
        });
    });
}


window.openRechargeModal = () => document.getElementById('recharge-modal').style.display = 'flex';
window.closeRechargeModal = () => document.getElementById('recharge-modal').style.display = 'none';

window.openOrderModal = (s) => {
    window.currentService = s;
    document.getElementById('order-modal').style.display = 'flex';
    document.getElementById('step-1-options').style.display = 'block';
    document.getElementById('step-2-details').style.display = 'none';
    document.getElementById('modal-title').innerText = "اختر نوع " + s;
    const grid = document.getElementById('dynamic-options-grid');

    if(s==='شحن رصيد'){
        grid.style.gridTemplateColumns='repeat(3, 1fr)';
        grid.innerHTML=`
            <div class="network-card" onclick="proceedToStep2('زين')">
                <div class="pro-logo"><img src="images/zain.jpeg" alt="زين"></div>
                <p>زين</p>
            </div>
            <div class="network-card" onclick="proceedToStep2('سوداني')">
                <div class="pro-logo"><img src="images/sudani_logo.jpeg" alt="سوداني"></div>
                <p>سوداني</p>
            </div>
            <div class="network-card" onclick="proceedToStep2('MTN')">
                <div class="pro-logo"><img src="images/MTN_Logo.svg.png" alt="MTN"></div>
                <p>MTN</p>
            </div>
        `;
    } else if(s==='ألعاب'){
        grid.style.gridTemplateColumns='repeat(2, 1fr)';
        grid.innerHTML=`
            <div class="network-card" onclick="proceedToStep2('PUBG')">
                <div class="pro-logo"><img src="images/pubg.jpeg" alt="ببجي"></div>
                <p>ببجي</p>
            </div>
            <div class="network-card" onclick="proceedToStep2('Free Fire')">
                <div class="pro-logo"><img src="images/freefire.jpeg" alt="فري فاير"></div>
                <p>فري فاير</p>
            </div>
        `;
    } else if(s==='اشتراكات'){
        grid.style.gridTemplateColumns='repeat(2, 1fr)';
        grid.innerHTML=`<div class="network-card" onclick="proceedToStep2('Netflix')"><div class="pro-logo netflix-logo">N</div><p>نتفليكس</p></div><div class="network-card" onclick="proceedToStep2('Spotify')"><div class="pro-logo spotify-logo">S</div><p>سبوتيفاي</p></div>`;
    } else if(s==='بطاقات دفع'){
        grid.style.gridTemplateColumns='repeat(2, 1fr)';
        grid.innerHTML=`<div class="network-card" onclick="proceedToStep2('Visa')"><div class="pro-logo visa-logo">V</div><p>فيزا</p></div><div class="network-card" onclick="proceedToStep2('Mastercard')"><div class="pro-logo master-logo">M</div><p>ماستركارد</p></div>`;
    } else if(s==='عملات مشفرة'){
        grid.style.gridTemplateColumns='repeat(2, 1fr)';
        grid.innerHTML=`
            <div class="network-card" onclick="proceedToStep2('USDT')">
                <div class="pro-logo" style="background:#26a69a; color:white; font-size:14px; border:none;">USDT</div>
                <p>USDT</p>
            </div>
            <div class="network-card" onclick="proceedToStep2('Bitcoin')">
                <div class="pro-logo" style="background:#f7931a; color:white; font-size:14px; border:none;">BTC</div>
                <p>بيتكوين</p>
            </div>
        `;
    }
}

window.proceedToStep2 = (subService) => {
    window.selectedNetwork = subService;
    document.getElementById('step-1-options').style.display = 'none';
    document.getElementById('step-2-details').style.display = 'block';
    document.getElementById('modal-title').innerText = "طلب " + subService;

    const infoBox = document.getElementById('card-info-box');
    if(infoBox) {
        infoBox.style.display = 'none';
        infoBox.innerHTML = '';
    }

    let placeholder = "البيانات المطلوبة";

    if(window.currentService === 'شحن رصيد') placeholder = "رقم الهاتف (10 أرقام)";
    if(window.currentService === 'ألعاب') placeholder = "رقم اللاعب (ID)";
    if(window.currentService === 'اشتراكات') placeholder = "إيميل الحساب";
    if(window.currentService === 'عملات مشفرة') placeholder = "رابط المحفظة (Wallet Address)";

    if(window.currentService === 'بطاقات دفع') {
        placeholder = "الاسم المراد طباعته على البطاقة (بالإنجليزي)";
        let price = subService === 'Visa' ? '28$' : '18$';
        let badgeColor = subService === 'Visa' ? '#192a56' : '#eb4d4b';

        if(infoBox) {
            infoBox.style.display = 'block';
            infoBox.innerHTML = `
                <div style="text-align: center; margin-bottom: 10px;">
                    <span style="background: ${badgeColor}; color: white; padding: 6px 20px; border-radius: 20px; font-weight: 900; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">سعر البطاقة: ${price}</span>
                </div>
                <ul style="margin: 0; padding-right: 20px; font-weight: 500; text-align: right; font-size: 13px; color: #2c3e50; line-height: 1.8;">
                    <li><b>صلاحية البطاقة:</b> 3 سنوات كاملة.</li>
                    <li><b>الاستخدام:</b> تعمل في جميع المواقع والخدمات الأونلاين.</li>
                    <li style="color: #e74c3c;"><b>تنبيه أمني:</b> تُقفل البطاقة تلقائياً في حال إتمام 15 عملية شراء فاشلة لحمايتك.</li>
                </ul>
            `;
        }
    }

    document.getElementById('order-target').placeholder = placeholder;
    document.getElementById('order-amount').value = '';
}

window.closeModal = () => document.getElementById('order-modal').style.display = 'none'; 
window.openHistoryModal = () => document.getElementById('history-modal').style.display = 'flex'; 
window.closeHistoryModal = () => document.getElementById('history-modal').style.display = 'none';

window.submitRecharge = async () => {
    const amt = document.getElementById('recharge-amount').value; 
    const rec = document.getElementById('recharge-receipt').value;
    if(!amt || !rec) return window.showToast("أكمل البيانات", true);
    
    await addDoc(collection(db, "orders"), { uid: auth.currentUser.uid, user: window.currentUser, service: "تغذية المحفظة", targetInfo: "إشعار رقم: " + rec, amount: Number(amt), status: "قيد المراجعة", date: new Date() });
    window.showToast("تم الإرسال 🚀"); 
    window.closeRechargeModal();
}

window.submitOrder = async () => {
    const tar = document.getElementById('order-target').value; 
    const amt = document.getElementById('order-amount').value;
    if(!tar || !amt) return window.showToast("أكمل البيانات", true);
    
    await addDoc(collection(db, "orders"), { uid: auth.currentUser.uid, user: window.currentUser, service: window.currentService, network: window.selectedNetwork, targetInfo: tar, amount: Number(amt), status: "قيد التنفيذ", date: new Date() });
    window.showToast("تم إرسال طلبك 📦"); 
    window.closeModal();
}

window.forceLogout = async () => { await signOut(auth); location.reload(); }
let timer; 
const reset = () => { clearTimeout(timer); timer = setTimeout(forceLogout, 5 * 60 * 1000); }
document.onmousemove = reset; document.onclick = reset; document.ontouchstart = reset;
 
