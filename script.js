import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = { 
    apiKey: "AIzaSyB_8sjnJNMpUi0LAQv7U5lFmMvRlh5x0nU", 
    authDomain: "nagra-app.firebaseapp.com", 
    projectId: "nagra-app", 
    storageBucket: "nagra-app.firebasestorage.app", 
    messagingSenderId: "29893867141", 
    appId: "1:29893867141:web:e8b4e0a15d80898575dbec" 
};

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

window.signInWithGoogle = () => {
    window.showToast("جاري التحويل لجوجل... ⏳", false);
    signInWithRedirect(auth, googleProvider).catch(e => window.showToast("خطأ في الاتصال بجوجل", true));
};

getRedirectResult(auth).then(res => { 
    if(res?.user) window.showToast("تم الدخول بنجاح! 🚀", false); 
});

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
    } catch (e) { window.showToast("فشل التسجيل", true); }
}

document.getElementById('btn-login-execute').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try { 
        await signInWithEmailAndPassword(auth, email, pass); 
    } catch (e) { window.showToast("بيانات الدخول خاطئة", true); }
}

function loadOrders(userId) {
    onSnapshot(query(collection(db, "orders"), where("uid", "==", userId)), (snap) => {
        const list = document.getElementById('user-orders-list'); 
        list.innerHTML = ""; 
        let orders = [];
        snap.forEach(d => orders.push(d.data())); 
        orders.sort((a,b) => b.date.toMillis() - a.date.toMillis());
        
        orders.forEach(o => {
            const statusClass = o.status === 'مكتمل' ? 'completed' : (o.status === 'مرفوض' ? 'rejected' : 'pending');
            list.innerHTML += `
            <div class="order-card-pro ${statusClass}">
                <div>
                    <h4 style="margin:0;">${o.service} (${o.network || 'شحن'})</h4>
                    <p style="margin:3px 0 0; font-size:12px; color:#7f8c8d;">${o.targetInfo}</p>
                </div>
                <div style="text-align:left">
                    <b>${o.amount}</b><br>
                    <span class="status-pill status-${statusClass}">${o.status}</span>
                </div>
            </div>`;
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
    
    // ستايل موحد للصور
    const imgStyle = "width:100%; height:100%; object-fit:contain; border-radius:8px;";
    const divStyle = "border:none; padding:0; overflow:hidden; background: transparent;";

    if(s === 'شحن رصيد'){ 
        grid.style.gridTemplateColumns = 'repeat(3, 1fr)'; 
        grid.innerHTML = `
            <div class="network-card" onclick="proceedToStep2('زين')">
                <div class="pro-logo" style="${divStyle}"><img src="رابط_صورة_زين" style="${imgStyle}"></div>
                <p>زين</p>
            </div>
            <div class="network-card" onclick="proceedToStep2('سوداني')">
                <div class="pro-logo" style="${divStyle}"><img src="رابط_صورة_سوداني" style="${imgStyle}"></div>
                <p>سوداني</p>
            </div>
            <div class="network-card" onclick="proceedToStep2('MTN')">
                <div class="pro-logo" style="${divStyle}"><img src="رابط_صورة_ام_تي_ان" style="${imgStyle}"></div>
                <p>MTN</p>
            </div>
        `;
    } 
    else if(s === 'ألعاب'){ 
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)'; 
        grid.innerHTML = `
            <div class="network-card" onclick="proceedToStep2('PUBG')">
                <div class="pro-logo" style="${divStyle}"><img src="رابط_صورة_ببجي" style="${imgStyle}"></div>
                <p>ببجي</p>
            </div>
            <div class="network-card" onclick="proceedToStep2('Free Fire')">
                <div class="pro-logo" style="${divStyle}"><img src="رابط_صورة_فري_فاير" style="${imgStyle}"></div>
                <p>فري فاير</p>
            </div>
        `;
    } 
    else if(s === 'اشتراكات'){ 
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)'; 
        grid.innerHTML = `
            <div class="network-card" onclick="proceedToStep2('Netflix')">
                <div class="pro-logo" style="${divStyle}"><img src="رابط_صورة_نتفليكس" style="${imgStyle}"></div>
                <p>نتفليكس</p>
            </div>
            <div class="network-card" onclick="proceedToStep2('Spotify')">
                <div class="pro-logo" style="${divStyle}"><img src="رابط_صورة_سبوتيفاي" style="${imgStyle}"></div>
                <p>سبوتيفاي</p>
            </div>
        `;
    } 
    else if(s === 'بطاقات دفع'){ 
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)'; 
        grid.innerHTML = `
            <div class="network-card" onclick="proceedToStep2('Visa')">
                <div class="pro-logo" style="${divStyle}">
                    <img src="http://googleusercontent.com/generated_image_content/0
