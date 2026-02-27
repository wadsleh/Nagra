import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, updateDoc, getDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { firebaseConfig } from './config.js'; // تأكد إن ملف config.js موجود ومربوط صح

const app = initializeApp(firebaseConfig); 
const db = getFirestore(app); 
const auth = getAuth(app);

// 🚨 غيّر الإيميل دا لإيميل الإدمن بتاعك
const ADMIN_EMAIL = "wadsalihhamed@gmail.com"; 

let pending = null;
let actionPending = null;
let allUsers = [];
let allTransactions = [];

onAuthStateChanged(auth, (user) => {
    if (user && user.email === ADMIN_EMAIL) {
        document.getElementById('admin-body').style.display = 'block';
        initListeners();
    } else { 
        window.location.href = "index.html"; 
    }
});

document.getElementById('btn-logout-admin').onclick = () => signOut(auth);

window.showToast = (msg, err=false) => { 
    const t=document.getElementById('toast-message'); 
    t.innerText=msg; 
    t.className=err?"toast show error":"toast show"; 
    setTimeout(()=>t.className="toast", 3000); 
};

window.closeConfirm = () => { 
    document.getElementById('confirm-modal').style.display='none'; 
    document.getElementById('normal-reply').style.display='none'; 
    document.getElementById('card-reply').style.display='none'; 
};

window.closeActionModal = () => { 
    document.getElementById('action-modal').style.display='none'; 
};

document.getElementById('btn-action-cancel').onclick = window.closeActionModal;
document.getElementById('btn-confirm-cancel').onclick = window.closeConfirm;

function initListeners() {
    // 1. جلب الطلبات
    onSnapshot(collection(db, "orders"), (snap) => {
        const container = document.getElementById('orders-container'); 
        container.innerHTML = "";
        let count = 0;
        snap.forEach(d => {
            const o = d.data();
            if(o.status !== "مكتمل" && o.status !== "مرفوض") {
                count++;
                const isR = o.service === "تغذية المحفظة";
                container.innerHTML += `<div class="item-row">
                    <div style="flex:1;">
                        <h4 class="item-title">${o.service} <span style="font-size:12px; font-weight:normal; color:#64748b; margin-right:8px;">(${o.user})</span></h4>
                        <p class="item-subtitle">${o.targetInfo}</p>
                        <b class="item-price">${Number(o.amount).toLocaleString()} ج.س</b>
                    </div>
                    <div style="display:flex; flex-direction:row; gap:8px;">
                        ${isR ? `<button class="btn btn-green" onclick="approveR('${d.id}', '${o.uid}', ${o.amount})">تأكيد الإيداع</button>` : 
                               `<button class="btn btn-blue" onclick="approveO('${d.id}', '${o.uid}', ${o.amount}, '${o.service}')">تنفيذ الطلب</button>`}
                        <button class="btn btn-outline" style="color:#ef4444; border-color:#ef4444;" onclick="reject('${d.id}')">رفض</button>
                    </div>
                </div>`;
            }
        });
        if(count === 0) container.innerHTML = `<p style="color: #64748b; font-size: 14px; text-align: center; padding: 20px;">لا توجد طلبات معلقة حالياً 🎉</p>`;
        document.getElementById('stats-orders').innerText = count;
    });

    // 2. جلب المستخدمين (محدث ليعرض التوثيق ورقم الحساب)
    onSnapshot(collection(db, "users"), (snap) => {
        allUsers = [];
        let totalBal = 0;
        snap.forEach(d => {
            const u = d.data();
            allUsers.push({id: d.id, ...u});
            totalBal += (Number(u.balance) || 0);
        });
        renderUsers(allUsers);
        document.getElementById('stats-users').innerText = allUsers.length;
        document.getElementById('total-users-balance').innerText = totalBal.toLocaleString();
    });

    // 3. جلب السجلات
    onSnapshot(collection(db, "transactions"), (snap) => {
        allTransactions = [];
        const tbody = document.getElementById('transactions-table-body'); 
        tbody.innerHTML = "";
        snap.forEach(d => allTransactions.push(d.data()));
        allTransactions.sort((a,b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0));
        document.getElementById('total-tx-count').innerText = allTransactions.length;
        allTransactions.forEach(l => {
            const isCredit = l.type === "credit";
            tbody.innerHTML += `<tr>
                <td style="font-size:12px;">${l.date ? l.date.toDate().toLocaleString('ar-EG') : ''}</td>
                <td><span style="background:${isCredit?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.1)'}; color:${isCredit?'#10b981':'#ef4444'}; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:700;">${isCredit?'إيداع 📥':'خصم 📤'}</span></td>
                <td style="font-weight:700; color:#f8fafc;">${Number(l.amount).toLocaleString()}</td>
                <td style="color:#94a3b8;">${l.source}</td>
            </tr>`;
        });
    });
}

function renderUsers(users) {
    const tbody = document.getElementById('users-table-body'); 
    tbody.innerHTML = "";
    users.forEach(u => {
        const isBanned = u.isBanned === true;
        const isVerified = u.isVerified === true; // حالة التوثيق
        const accNum = u.accountNumber || "غير متوفر"; // رقم الحساب
        
        const verifyStatus = isVerified ? '<span style="color: #10b981; font-size: 11px; font-weight: bold;">🟢 حساب موثق</span>' : '<span style="color: #ef4444; font-size: 11px; font-weight: bold;">🔴 غير موثق</span>';

        tbody.innerHTML += `
        <tr class="${isBanned ? 'banned-row' : ''}">
            <td>
                <b style="color:#f8fafc; font-size:14px;">${u.name}</b><br>
                <span style="color:#64748b; font-size:12px;">${u.email}</span><br>
                <span style="font-family: monospace; color: #94a3b8; font-size: 12px;">حساب: ${accNum}</span>
            </td>
            <td>
                <span style="color:#10b981; font-weight:700; font-size:15px;">${(u.balance||0).toLocaleString()}</span><br>
                ${verifyStatus}
            </td>
            <td>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-outline btn-icon-only" title="تعديل الرصيد" onclick="customEditBal('${u.id}', '${u.name}', ${u.balance||0})">✏️</button>
                    <button class="btn ${isVerified ? 'btn-outline' : 'btn-blue'} btn-icon-only" title="${isVerified ? 'إلغاء التوثيق' : 'توثيق الحساب 🛡️'}" onclick="customToggleVerify('${u.id}', '${u.name}', ${isVerified})">🛡️</button>
                    <button class="btn ${isBanned ? 'btn-outline' : 'btn-destructive'} btn-icon-only" title="${isBanned ? 'فك الحظر' : 'حظر المستخدم'}" onclick="customToggleBan('${u.id}', '${u.name}', ${isBanned})">${isBanned ? '🔓' : '🚫'}</button>
                </div>
            </td>
        </tr>`;
    });
}

// 🌟 البحث المحدث (يشمل رقم الحساب)
document.getElementById('userSearch').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allUsers.filter(u => 
        u.name.toLowerCase().includes(term) || 
        u.email.toLowerCase().includes(term) ||
        (u.accountNumber && u.accountNumber.includes(term))
    );
    renderUsers(filtered);
};

document.getElementById('btn-export-excel').onclick = () => {
    if(allTransactions.length === 0) return window.showToast("لا توجد بيانات لتصديرها!", true);
    
    const dataToExport = allTransactions.map(t => {
        const userObj = allUsers.find(u => u.id === t.userId);
        const userName = userObj ? (userObj.name || userObj.email) : "مستخدم غير معروف";

        return {
            "التاريخ والوقت": t.date ? t.date.toDate().toLocaleString('ar-EG') : '',
            "النوع": t.type === 'credit' ? 'إيداع' : 'خصم',
            "المبلغ (ج.س)": t.amount,
            "إسم الزبون": userName,
            "الخدمة / المصدر": t.source,
            "رقم الطلب المرجعي": t.orderId
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "سجل العمليات");
    XLSX.writeFile(workbook, `سجل_نكرة_${new Date().toLocaleDateString()}.xlsx`);
    window.showToast("تم تصدير ملف Excel بنجاح! 📊");
};

// 🌟 دالة التوثيق الجديدة 🌟
window.customToggleVerify = (id, name, currentlyVerified) => {
    const action = currentlyVerified ? "إلغاء توثيق" : "توثيق";
    document.getElementById('action-modal-title').innerText = "تأكيد " + action + " 🛡️";
    document.getElementById('action-modal-msg').innerText = "هل أنت متأكد من " + action + " حساب الزبون: " + name + "؟";
    document.getElementById('action-input-container').style.display = 'none';
    document.getElementById('action-modal').style.display = 'flex';
    
    actionPending = () => {
        updateDoc(doc(db, "users", id), { isVerified: !currentlyVerified }).then(() => {
            window.showToast("تم تحديث حالة التوثيق بنجاح ✅");
            window.closeActionModal();
        }).catch(e => window.showToast("حدث خطأ أثناء التحديث", true));
    };
};

window.customEditBal = (id, name, cur) => {
    document.getElementById('action-modal-title').innerText = "تعديل رصيد المحفظة";
    document.getElementById('action-modal-msg').innerText = "أنت تقوم بتعديل رصيد الزبون: " + name;
    document.getElementById('action-input-container').style.display = 'block';
    document.getElementById('action-value-input').value = cur;
    document.getElementById('action-modal').style.display = 'flex';
    actionPending = () => {
        const val = Number(document.getElementById('action-value-input').value);
        updateDoc(doc(db, "users", id), { balance: val }).then(() => {
            window.showToast("تم تحديث الرصيد بنجاح ✅");
            window.closeActionModal();
        });
    };
};

window.customToggleBan = (id, name, currentlyBanned) => {
    const action = currentlyBanned ? "فك الحظر عن" : "حظر";
    document.getElementById('action-modal-title').innerText = "تأكيد الإجراء الأمني";
    document.getElementById('action-modal-msg').innerText = `هل أنت متأكد من ${action} الزبون: ${name}؟`;
    document.getElementById('action-input-container').style.display = 'none';
    document.getElementById('action-modal').style.display = 'flex';
    actionPending = () => {
        updateDoc(doc(db, "users", id), { isBanned: !currentlyBanned }).then(() => {
            window.showToast("تم تطبيق الإجراء بنجاح ✅");
            window.closeActionModal();
        });
    };
};

document.getElementById('btn-action-confirm').onclick = () => { if(actionPending) actionPending(); };

window.openConfirm = (t, m, showInp, f, sType='') => {
    document.getElementById('modal-title-text').innerText = t;
    document.getElementById('modal-msg').innerText = m;
    window.currentConfirmService = sType;
    if(showInp) {
        if(sType === 'بطاقات دفع') {
            document.getElementById('card-reply').style.display = 'block';
            document.getElementById('normal-reply').style.display = 'none';
        } else {
            document.getElementById('normal-reply').style.display = 'block';
            document.getElementById('card-reply').style.display = 'none';
        }
    } else {
        document.getElementById('card-reply').style.display = 'none';
        document.getElementById('normal-reply').style.display = 'none';
    }
    pending = f; document.getElementById('confirm-modal').style.display = 'flex';
};

document.getElementById('btn-confirm').onclick = async () => { if(pending) await pending(); window.closeConfirm(); };

window.approveR = (oId, uid, amt) => openConfirm("تأكيد إيداع رصيد", `هل تأكدت من وصول مبلغ التحويل (${amt} ج.س) إلى حسابك البنكي؟`, false, async () => {
    const oRef = doc(db, "orders", oId); const oSnap = await getDoc(oRef);
    if(oSnap.data().status !== "قيد المراجعة") return window.showToast("تمت معالجة هذا الطلب مسبقاً", true);
    const uRef = doc(db, "users", uid); const uSnap = await getDoc(uRef);
    await updateDoc(uRef, { balance: (uSnap.data().balance||0) + Number(amt) });
    await updateDoc(oRef, { status: "مكتمل", adminReply: "تم تأكيد الإيداع وإضافة الرصيد لمحفظتك." });
    await addDoc(collection(db, "transactions"), { userId: uid, type: "credit", amount: Number(amt), source: "تغذية محفظة (بنكك)", orderId: oId, date: serverTimestamp() });
    window.showToast("تم إضافة الرصيد للزبون بنجاح ✅");
});

window.approveO = (oId, uid, amt, sType) => openConfirm("تنفيذ طلب خدمة", `سيتم خصم مبلغ (${amt} ج.س) من محفظة الزبون. هل تم تنفيذ الخدمة؟`, true, async () => {
    const oRef = doc(db, "orders", oId); const oSnap = await getDoc(oRef);
    if(oSnap.data().status !== "قيد التنفيذ") return window.showToast("تمت معالجة هذا الطلب مسبقاً", true);
    let reply = "";
    if(window.currentConfirmService === 'بطاقات دفع') {
        const n=document.getElementById('c-num').value, e=document.getElementById('c-exp').value, c=document.getElementById('c-cvv').value;
        if(!n||!e||!c) return window.showToast("الرجاء إكمال بيانات البطاقة أولاً", true);
        reply = `<div style="text-align:right; font-family: monospace; letter-spacing: 1px;"><span style="color:#64748b; font-size:12px;">رقم البطاقة:</span><br><b>${n}</b><br><br><div style="display:flex; justify-content:space-between;"><span style="color:#64748b; font-size:12px;">التاريخ: <b>${e}</b></span><span style="color:#64748b; font-size:12px;">CVV: <b>${c}</b></span></div></div>`;
    } else {
        reply = document.getElementById('admin-reply-input').value; if(!reply) return window.showToast("يجب إدخال الكود أو الملاحظة للزبون", true);
    }
    const uRef = doc(db, "users", uid); const uSnap = await getDoc(uRef);
    const bal = uSnap.data().balance||0;
    if(bal < amt) return window.showToast("عذراً، رصيد الزبون الحالي غير كافٍ لإتمام العملية", true);
    await updateDoc(uRef, { balance: bal - Number(amt) });
    await updateDoc(oRef, { status: "مكتمل", adminReply: reply });
    await addDoc(collection(db, "transactions"), { userId: uid, type: "debit", amount: Number(amt), source: sType, orderId: oId, date: serverTimestamp() });
    window.showToast("تم خصم الرصيد وتنفيذ الطلب بنجاح ✅");
}, sType);

window.reject = (oId) => openConfirm("رفض الطلب", "سيتم إلغاء هذا الطلب ولن يتم خصم أي مبلغ من الزبون. هل أنت متأكد؟", false, async () => {
    await updateDoc(doc(db, "orders", oId), { status: "مرفوض", adminReply: "تم رفض الطلب من قبل الإدارة، الرجاء مراجعة الدعم الفني." });
    window.showToast("تم رفض الطلب بنجاح");
});

// تعيين الدوال للنافذة للوصول لها من الـ HTML
window.customEditBal = window.customEditBal;
window.customToggleBan = window.customToggleBan;
window.customToggleVerify = window.customToggleVerify;
window.approveR = window.approveR;
window.approveO = window.approveO;
window.reject = window.reject;
