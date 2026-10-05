function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showLostForm() {
  const overlay = document.getElementById("infoOverlay");
  const content = document.getElementById("infoContent");

  if (!overlay || !content) return;

  content.innerHTML = `
    <h2>🔴 الإبلاغ عن شيء ضائع</h2>

    <input id="itemType" placeholder="نوع الشيء">
    <input id="wilaya" placeholder="الولاية">
    <input id="commune" placeholder="البلدية">
    <textarea id="description" placeholder="وصف الشيء"></textarea>

    <button id="submitBtn" type="button">إرسال البلاغ</button>
  `;

  overlay.style.display = "block";

  document
    .getElementById("submitBtn")
    .addEventListener("click", submitReport);
}

function showFoundForm() {
  const overlay = document.getElementById("infoOverlay");
  const content = document.getElementById("infoContent");

  if (!overlay || !content) return;

  content.innerHTML = `
    <h2>🟢 الإبلاغ عن شيء تم العثور عليه</h2>

    <input id="foundItemType" placeholder="نوع الشيء">
    <input id="foundWilaya" placeholder="الولاية">
    <input id="foundCommune" placeholder="البلدية">
    <textarea id="foundDescription" placeholder="وصف الشيء"></textarea>

    <button id="foundSubmitBtn" type="button">إرسال البلاغ</button>
  `;

  overlay.style.display = "block";

  document
    .getElementById("foundSubmitBtn")
    .addEventListener("click", submitFoundReport);
}
async function submitReport() {  const data = {
    type: "lost",
    itemType: document.getElementById("itemType").value.trim(),
    wilaya: document.getElementById("wilaya").value.trim(),
    commune: document.getElementById("commune").value.trim(),
    description: document.getElementById("description").value.trim()
  };

  if (!data.itemType || !data.wilaya || !data.commune || !data.description) {
    alert("من فضلك أكمل جميع المعلومات.");
    return;
  }

  try {
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "حدث خطأ.");
      return;
    }

    alert("تم حفظ بلاغ الضياع. رقم البلاغ: " + result.reportId);

    const overlay = document.getElementById("infoOverlay");
    if (overlay) overlay.style.display = "none";
  } catch (error) {
    alert("تعذر الاتصال بالخادم.");
  }
}

async function submitFoundReport() {
  const data = {
    type: "found",
    itemType: document.getElementById("foundItemType").value.trim(),
    wilaya: document.getElementById("foundWilaya").value.trim(),
    commune: document.getElementById("foundCommune").value.trim(),
    description: document.getElementById("foundDescription").value.trim()
  };

  if (!data.itemType || !data.wilaya || !data.commune || !data.description) {
    alert("من فضلك أكمل جميع المعلومات.");
    return;
  }

  try {
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "حدث خطأ.");
      return;
    }

    alert("تم حفظ بلاغ العثور. رقم البلاغ: " + result.reportId);

    const overlay = document.getElementById("infoOverlay");
    if (overlay) overlay.style.display = "none";
  } catch (error) {
    alert("تعذر الاتصال بالخادم.");
  }
}

async function showReports() {
  const area = document.getElementById("form-area");

  try {
    const response = await fetch("/api/reports");
    const reports = await response.json();

    if (!reports.length) {
      area.innerHTML = "<p>لا توجد بلاغات حاليًا.</p>";
      return;
    }

    area.innerHTML = `
      <h2>البلاغات</h2>
      <div id="reports-list"></div>
      <div id="matches-area"></div>
    `;

    const list = document.getElementById("reports-list");

    reports.forEach(report => {
      const div = document.createElement("div");

      const typeText =
        report.type === "lost" ? "ضائع" : "تم العثور عليه";

      div.innerHTML = `
        <hr>
        <p><strong>الحالة:</strong> ${typeText}</p>
        <p><strong>نوع الشيء:</strong> ${escapeHtml(report.itemType)}</p>
        <p><strong>الولاية:</strong> ${escapeHtml(report.wilaya)}</p>
        <p><strong>البلدية:</strong> ${escapeHtml(report.commune)}</p>
        <p><strong>الوصف:</strong> ${escapeHtml(report.description)}</p>
        <button class="match-btn" data-id="${Number(report.id)}">
          البحث عن مطابقة
        </button>
        <button class="contact-btn" data-id="${Number(report.id)}">
          التواصل
        </button>
      `;

      list.appendChild(div);
    });

    document.querySelectorAll(".contact-btn").forEach(button => {
      button.addEventListener("click", () => {
        fetch("/api/contact", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({reportId: Number(button.dataset.id)})
        })
        .then(r => r.json())
        .then(data => alert(data.message || data.error || "تعذر تسجيل طلب التواصل"))
        .catch(() => alert("تعذر الاتصال بالخادم"));
      });
    });
    document.querySelectorAll(".match-btn").forEach(button => {
      button.addEventListener("click", () => {
        findMatches(button.dataset.id);
      });
    });

  } catch (error) {
    area.innerHTML = "<p>تعذر الاتصال بالخادم.</p>";
  }
}

async function findMatches(reportId) {
  const area = document.getElementById("matches-area");

  area.innerHTML = "<p>جاري البحث عن المطابقات...</p>";

  try {
    const response = await fetch("/api/matches/" + encodeURIComponent(reportId));
    const matches = await response.json();

    if (!response.ok) {
      area.innerHTML = "<p>تعذر البحث عن المطابقات.</p>";
      return;
    }

    if (matches.length === 0) {
      area.innerHTML = `
        <h3>نتيجة المطابقة</h3>
        <p>لم نجد مطابقة حاليًا.</p>
      `;
      return;
    }

    area.innerHTML = `
      <h3>وجدنا ${matches.length} مطابقة محتملة</h3>
    `;

    matches.forEach(match => {
      const div = document.createElement("div");

      div.innerHTML = `
        <div>
          <p><strong>نوع الشيء:</strong> ${escapeHtml(match.itemType)}</p>
          <p><strong>الولاية:</strong> ${escapeHtml(match.wilaya)}</p>
          <p><strong>البلدية:</strong> ${escapeHtml(match.commune)}</p>
          <hr>
        </div>
      `;

      area.appendChild(div);
    });

  } catch (error) {
    area.innerHTML = "<p>تعذر الاتصال بالخادم.</p>";
  }
}


document.getElementById("lostBtn")
  .addEventListener("click", showLostForm);

document.getElementById("foundBtn")
  .addEventListener("click", showFoundForm);

document.getElementById("reportsBtn")
  .addEventListener("click", showReports);

function showLogin(){
  document.getElementById("form-area").innerHTML =
    "<h2>تسجيل الدخول</h2>" +
    "<input id=\"loginEmail\" type=\"email\" placeholder=\"البريد الإلكتروني\">" +
    "<input id=\"loginPassword\" type=\"password\" placeholder=\"كلمة المرور\">" +
    "<button id=\"doLogin\">دخول</button>";

  document.getElementById("doLogin").onclick = async () => {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if(!email || !password){
      alert("يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }

    try {
      const r = await fetch("/api/login", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email,password})
      });

      const d = await r.json();

      if(!r.ok){
        alert(d.error || "تعذر تسجيل الدخول");
        return;
      }

      alert(d.message || "تم تسجيل الدخول بنجاح");

      showReports();

      updateMessageBadges();

    } catch(error) {
      console.error(error);
      alert("تعذر الاتصال بالخادم");
    }
  };
}
function showRegister(){
  document.getElementById("form-area").innerHTML=`
<h2>إنشاء حساب</h2>
<input id="regFirstName" placeholder="الاسم">
<input id="regLastName" placeholder="اللقب">
<input id="regEmail" type="email" placeholder="البريد الإلكتروني">
<input id="regPassword" type="password" placeholder="كلمة المرور">
<button id="doRegister">إنشاء الحساب</button>`;

  document.getElementById("doRegister").onclick=async()=>{
    const firstName=document.getElementById("regFirstName").value.trim();
    const lastName=document.getElementById("regLastName").value.trim();
    const email=document.getElementById("regEmail").value.trim();
    const password=document.getElementById("regPassword").value;

    if(!firstName || !lastName || !email || !password){
      alert("يرجى ملء جميع الخانات");
      return;
    }

    const confirmation = confirm(
      "تأكيد البريد الإلكتروني\n\n" +
      "سيتم إرسال رمز التحقق إلى بريدك الإلكتروني.\n" +
      "اضغط OK للمتابعة."
    );

    if(!confirmation){
      return;
    }

    const registerBtn = document.getElementById("doRegister");

    if(registerBtn){
      registerBtn.disabled = true;
      registerBtn.textContent = "جاري إرسال رمز التحقق...";
    }

    try {
      const r=await fetch("/api/register",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({firstName,lastName,email,password})
      });

      const d=await r.json();

      if(!r.ok){
        if(registerBtn){
          registerBtn.disabled = false;
          registerBtn.textContent = "إنشاء الحساب";
        }

        alert(d.error || "تعذر إنشاء الحساب");
        return;
      }

      const userId = d.user && d.user.id;

      if(!userId){
        if(registerBtn){
          registerBtn.disabled = false;
          registerBtn.textContent = "إنشاء الحساب";
        }

        alert("تم إنشاء الحساب، لكن تعذر بدء تأكيد البريد");
        return;
      }

      document.getElementById("form-area").innerHTML=`
<h2>تأكيد البريد الإلكتروني</h2>
<p>تم إرسال رمز مكون من 5 أرقام إلى بريدك الإلكتروني.</p>
<p>أدخل الرمز لإكمال إنشاء الحساب:</p>
<input id="verifyToken" inputmode="numeric" maxlength="5" placeholder="رمز التحقق">
<button id="doVerifyEmail">تأكيد البريد</button>
<button id="resendInfo" type="button">لم يصلك الرمز؟</button>`;

      document.getElementById("doVerifyEmail").onclick=async()=>{
        const token=document.getElementById("verifyToken").value.trim();

        if(!/^\d{5}$/.test(token)){
          alert("أدخل رمز التحقق المكون من 5 أرقام");
          return;
        }

        try {
          const vr=await fetch("/api/verify-email",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({userId,token})
          });

          const vd=await vr.json();

          if(!vr.ok){
            alert(vd.error || "رمز التحقق غير صحيح");
            return;
          }

          alert(vd.message || "تم تأكيد البريد الإلكتروني بنجاح");
          showLogin();

        } catch(error) {
          console.error(error);
          alert("تعذر الاتصال بالخادم");
        }
      };

      document.getElementById("resendInfo").onclick=async()=>{
        try {
          const rr=await fetch("/api/resend-verification",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({userId})
          });

          const rd=await rr.json();

          if(!rr.ok){
            alert(rd.error || "تعذر إعادة إرسال رمز التحقق");
            return;
          }

          alert(rd.message || "تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني");

        } catch(error) {
          console.error(error);
          alert("تعذر الاتصال بالخادم");
        }
      };

    } catch(error) {
      console.error(error);
      alert("تعذر الاتصال بالخادم");
    }
  };
}

document.getElementById("loginBtn").addEventListener("click",showLogin);document.getElementById("registerBtn").addEventListener("click",showRegister);

async function showMyContactRequests(){
  const area = document.getElementById("form-area");
  area.innerHTML = "<h2>طلباتي</h2><p>جاري تحميل الطلبات...</p>";

  try {
    const response = await fetch("/api/contact/my-requests");
    const data = await response.json();

    if(!response.ok){
      area.innerHTML = `<h2>طلباتي</h2><p>${escapeHtml(data.error || "تعذر تحميل الطلبات")}</p>`;
      return;
    }

    if(data.length === 0){
      area.innerHTML = `<h2>طلباتي</h2><p>لا توجد طلبات تواصل أرسلتها حاليًا.</p>`;
      return;
    }

    area.innerHTML = `<h2>طلباتي</h2><div id="myContactRequestsList"></div>`;

    const list = document.getElementById("myContactRequestsList");

    data.forEach(request => {
      const div = document.createElement("div");

      let statusText = "قيد الانتظار";
      if(request.status === "approved") statusText = "تمت الموافقة";
      if(request.status === "rejected") statusText = "تم الرفض";

      let actions = "";

      if(request.status === "pending"){
        actions = `
          <button class="cancel-contact-btn" data-id="${escapeHtml(String(request.id))}">
            إلغاء الطلب
          </button>
        `;
      } else if(request.status === "approved"){
        actions = `
          <button class="open-chat-btn" data-id="${escapeHtml(String(request.id))}">
            فتح المحادثة
          </button>
          <button class="delete-contact-btn" data-id="${escapeHtml(String(request.id))}">
            حذف من طلباتي
          </button>
        `;
      } else {
        actions = `
          <button class="delete-contact-btn" data-id="${escapeHtml(String(request.id))}">
            حذف من طلباتي
          </button>
        `;
      }

      div.innerHTML = `
        <div>
          <p><strong>رقم الطلب:</strong> ${escapeHtml(String(request.id))}</p>
          <p><strong>رقم البلاغ:</strong> ${escapeHtml(String(request.reportId))}</p>
          <p><strong>الحالة:</strong> ${escapeHtml(statusText)}</p>
          <p><strong>التاريخ:</strong> ${escapeHtml(String(request.created_at || ""))}</p>
          ${actions}
          <hr>
        </div>
      `;

      list.appendChild(div);
    });

    document.querySelectorAll(".cancel-contact-btn").forEach(button => {
      button.addEventListener("click", () => {
        cancelMyContactRequest(button.dataset.id);
      });
    });

    document.querySelectorAll(".open-chat-btn").forEach(button => {
      button.addEventListener("click", () => {
        showChat(button.dataset.id);
      });
    });

    document.querySelectorAll(".delete-contact-btn").forEach(button => {
      button.addEventListener("click", () => {
        deleteMyContactRequest(button.dataset.id);
      });
    });

  } catch(error) {
    console.error(error);
    area.innerHTML = "<h2>طلباتي</h2><p>تعذر الاتصال بالخادم.</p>";
  }
}

async function deleteMyContactRequest(contactId){
  if(!confirm("هل تريد حذف هذا الطلب من قائمة طلباتك؟")){
    return;
  }

  try {
    const response = await fetch("/api/contact/delete", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({contactId})
    });

    const data = await response.json();

    alert(data.message || data.error || "تعذر حذف الطلب");

    if(response.ok){
      await showMyContactRequests();
    }
  } catch(error) {
    console.error(error);
    alert("تعذر الاتصال بالخادم.");
  }
}

async function cancelMyContactRequest(contactId){
  if(!confirm("هل تريد إلغاء طلب التواصل هذا؟")){
    return;
  }

  try {
    const response = await fetch("/api/contact/cancel", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({contactId})
    });

    const data = await response.json();

    alert(data.message || data.error || "تعذر إلغاء الطلب");

    if(response.ok){
      await showMyContactRequests();
    }
  } catch(error) {
    console.error(error);
    alert("تعذر الاتصال بالخادم.");
  }
}

async function showContactRequests(){
  try {
    await fetch("/api/contact/mark-read", {
      method: "POST"
    });
  } catch(error) {
    console.error("تعذر تعليم طلبات التواصل كمقروءة:", error);
  }

  const area = document.getElementById("form-area");
  area.innerHTML = "<h2>طلبات التواصل</h2><p>جاري تحميل الطلبات...</p>";

  try {
    const response = await fetch("/api/contact/requests");
    const data = await response.json();

    if(!response.ok){
      area.innerHTML = `<h2>طلبات التواصل</h2><p>${escapeHtml(data.error || "تعذر تحميل الطلبات")}</p>`;
      return;
    }

    if(data.length === 0){
      area.innerHTML = `
        <h2>طلبات التواصل</h2>
        <p>لا توجد طلبات تواصل حاليًا.</p>
      `;
      return;
    }

    area.innerHTML = `
      <h2>طلبات التواصل</h2>
      <div id="contactRequestsList"></div>
    `;

    const list = document.getElementById("contactRequestsList");

    data.forEach(request => {
      const div = document.createElement("div");

      let statusText = "قيد الانتظار";
      if(request.status === "approved") statusText = "تمت الموافقة";
      if(request.status === "rejected") statusText = "تم الرفض";

      div.innerHTML = `
        <div>
          <p><strong>رقم الطلب:</strong> ${escapeHtml(String(request.id))}</p>
          <p><strong>رقم البلاغ:</strong> ${escapeHtml(String(request.reportId))}</p>
          <p><strong>الحالة:</strong> ${escapeHtml(statusText)}</p>
          <p><strong>التاريخ:</strong> ${escapeHtml(String(request.created_at || ""))}</p>
          ${
            request.status === "pending"
            ? `
              <button class="approve-contact-btn" data-id="${escapeHtml(String(request.id))}">
                الموافقة
              </button>
              <button class="reject-contact-btn" data-id="${escapeHtml(String(request.id))}">
                رفض
              </button>
            `
            : ""
          }
          <button class="hide-contact-btn" data-id="${escapeHtml(String(request.id))}">إخفاء الطلب</button>
          <hr>
        </div>
      `;

      list.appendChild(div);
    });

    document.querySelectorAll(".hide-contact-btn").forEach(button => {
      button.addEventListener("click", () => hideContactRequest(button.dataset.id));
    });

    document.querySelectorAll(".approve-contact-btn").forEach(button => {
      button.addEventListener("click", () => updateContactRequest(button.dataset.id, "approved"));
    });

    document.querySelectorAll(".reject-contact-btn").forEach(button => {
      button.addEventListener("click", () => updateContactRequest(button.dataset.id, "rejected"));
    });

  } catch(error) {
    area.innerHTML = "<h2>طلبات التواصل</h2><p>تعذر الاتصال بالخادم.</p>";
  }
}

async function hideContactRequest(contactId) {
  try {
    const response = await fetch("/api/contact/hide", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contactId: contactId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "تعذر إخفاء طلب التواصل");
      return;
    }

    alert(data.message || "تم إخفاء طلب التواصل");
    await showContactRequests();

  } catch (error) {
    console.error(error);
    alert("تعذر الاتصال بالخادم");
  }
}

async function updateContactRequest(contactId, status){
  try {
    const response = await fetch("/api/contact/status", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({contactId, status})
    });

    const data = await response.json();

    alert(data.message || data.error || "تعذر تحديث الطلب");

    if(response.ok){
      if(status === "approved"){
        showChat(contactId);
      } else {
        showContactRequests();
      }
    }

  } catch(error) {
    alert("تعذر الاتصال بالخادم");
  }
}


async function showMyChats(){
  const area = document.getElementById("form-area");
  area.innerHTML = "<h2>محادثاتي</h2><p>جاري تحميل المحادثات...</p>";

  try {
    const response = await fetch("/api/messages/conversations");
    const data = await response.json();

    if(!response.ok){
      area.innerHTML = `<h2>محادثاتي</h2><p>${escapeHtml(data.error || "تعذر تحميل المحادثات")}</p>`;
      return;
    }

    if(data.length === 0){
      area.innerHTML = "<h2>محادثاتي</h2><p>لا توجد محادثات حاليًا.</p>";
      return;
    }

    area.innerHTML = `
      <h2>محادثاتي</h2>
      <div id="myChatsList"></div>
    `;

    const list = document.getElementById("myChatsList");

    data.forEach(chat => {
      const div = document.createElement("div");

      const unread = Number(chat.unread || 0);
      const unreadBadge = unread > 0
        ? `<span style="display:inline-block;background:red;color:white;border-radius:50%;padding:3px 8px;font-size:12px;margin-right:8px;">${unread}</span>`
        : "";

      div.innerHTML = `
        <div style="padding:10px;border-bottom:1px solid #ccc;">
          <p>
            <strong>محادثة البلاغ رقم ${escapeHtml(String(chat.reportId))}</strong>
            ${unreadBadge}
          </p>
          <button class="open-my-chat-btn" data-id="${escapeHtml(String(chat.contactId))}">
            فتح المحادثة
          </button>
        </div>
      `;

      list.appendChild(div);
    });

    document.querySelectorAll(".open-my-chat-btn").forEach(button => {
      button.addEventListener("click", () => {
        showChat(button.dataset.id);
      });
    });

  } catch(error) {
    console.error(error);
    area.innerHTML = "<h2>محادثاتي</h2><p>تعذر الاتصال بالخادم.</p>";
  }
}

async function showChat(contactId){
  const area = document.getElementById("form-area");

  area.innerHTML = `
    <h2>التواصل الآمن</h2>
    <div id="chatMessages"><p>جاري تحميل المحادثة...</p></div>
    <textarea id="chatText" maxlength="2000" placeholder="اكتب رسالتك هنا..."></textarea>
    <button id="sendChatMessage">إرسال</button>
    <button id="backToMyChats">العودة إلى محادثاتي</button>
  `;

  const messagesArea = document.getElementById("chatMessages");

  async function loadMessages(){
    const response = await fetch(
      "/api/messages/" + encodeURIComponent(contactId)
    );
    const data = await response.json();

    if(!response.ok){
      messagesArea.innerHTML =
        "<p>" + escapeHtml(data.error || "تعذر تحميل المحادثة") + "</p>";
      return;
    }

    if(data.length === 0){
      messagesArea.innerHTML = "<p>لا توجد رسائل بعد.</p>";
      return;
    }

    messagesArea.innerHTML = "";

    data.forEach(message => {
      const div = document.createElement("div");
      div.innerHTML =
        "<p>" + escapeHtml(message.text) + "</p>" +
        "<small>" + escapeHtml(String(message.created_at || "")) + "</small><hr>";
      messagesArea.appendChild(div);
    });
  }

  document.getElementById("sendChatMessage").onclick = async () => {
    const input = document.getElementById("chatText");
    const text = input.value.trim();

    if(!text){
      alert("اكتب رسالة أولاً");
      return;
    }

    const response = await fetch(
      "/api/messages/" + encodeURIComponent(contactId),
      {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({text})
      }
    );

    const data = await response.json();

    if(!response.ok){
      alert(data.error || "تعذر إرسال الرسالة");
      return;
    }

    input.value = "";
    await loadMessages();
  };

  document.getElementById("backToMyChats").onclick =
    showMyChats;

  await loadMessages();

  // تعليم رسائل هذه المحادثة كمقروءة
  try {
    await fetch(
      "/api/messages/" + encodeURIComponent(contactId) + "/read",
      {method:"POST"}
    );
  } catch(error) {
    console.error("تعذر تعليم الرسائل كمقروءة:", error);
  }

  const chatRefreshTimer = setInterval(async () => {
    if(document.getElementById("chatMessages")){
      await loadMessages();
    } else {
      clearInterval(chatRefreshTimer);
    }
  }, 2000);
}


async function updateMessageBadges(){
  try {
    const response = await fetch("/api/messages/unread/count");
    const data = await response.json();

    if(!response.ok){
      return;
    }

    const badge = document.getElementById("myChatsBadge");

    if(badge){
      if(Number(data.total) > 0){
        badge.textContent = String(data.total);
        badge.style.display = "inline-block";
      } else {
        badge.textContent = "0";
        badge.style.display = "none";
      }
    }
  } catch(error) {
    console.error("تعذر تحديث إشعارات الرسائل:", error);
  }

  try {
    const response = await fetch("/api/contact/unread-count");
    const data = await response.json();

    if(response.ok){
      const badge = document.getElementById("contactRequestsBadge");

      if(badge){
        const count = Number(data.count) || 0;

        if(count > 0){
          badge.textContent = String(count);
          badge.style.display = "inline-block";
        } else {
          badge.textContent = "0";
          badge.style.display = "none";
        }
      }
    }
  } catch(error) {
    console.error("تعذر تحديث إشعارات طلبات التواصل:", error);
  }
}

// تحديث إشعارات الرسائل تلقائيًا
updateMessageBadges();
setInterval(updateMessageBadges, 3000);

document.getElementById("contactRequestsBtn")
  .addEventListener("click", showContactRequests);


document.getElementById("myContactRequestsBtn")
  .addEventListener("click", showMyContactRequests);

document.getElementById("myChatsBtn")
  .addEventListener("click", showMyChats);

async function showSearchPage(){
  const area=document.getElementById("form-area");
  area.innerHTML='<h2>البحث في البلاغات</h2><input id="search-q" placeholder="ماذا تبحث؟"><button id="search-btn">بحث</button><div id="search-results"></div>';
  document.getElementById("search-btn").onclick=async()=>{
    const q=document.getElementById("search-q").value.trim();
    const r=await fetch("/api/search?q="+encodeURIComponent(q));
    const data=await r.json();
    document.getElementById("search-results").innerHTML=(Array.isArray(data)?data:(data.reports||[])).map(x=>'<div><b>'+escapeHtml(String(x.type||""))+'</b> - '+escapeHtml(String(x.itemType||""))+' - '+escapeHtml(String(x.wilaya||""))+' - '+escapeHtml(String(x.commune||""))+'</div>').join("")||"<p>لا توجد نتائج</p>";
  };
}

/* ===== قائمة التطبيق الرئيسية ===== */
(function setupMainMenu() {
  const menuBtn = document.getElementById("menuBtn");
  const menuOverlay = document.getElementById("menuOverlay");
  const closeMenuBtn = document.getElementById("closeMenuBtn");

  if (!menuBtn || !menuOverlay || !closeMenuBtn) {
    console.warn("عناصر القائمة غير موجودة");
    return;
  }

  function openMainMenu() {
    menuOverlay.style.display = "block";
  }

  function closeMainMenu() {
    menuOverlay.style.display = "none";
  }

  menuBtn.addEventListener("click", openMainMenu);
  closeMenuBtn.addEventListener("click", closeMainMenu);

  menuOverlay.addEventListener("click", function (event) {
    if (event.target === menuOverlay) {
      closeMainMenu();
    }
  });

  const menuLinks = {
    menuLostBtn: "lostBtn",
    menuFoundBtn: "foundBtn",
    menuReportsBtn: "reportsBtn",
    menuChatsBtn: "myChatsBtn",
    menuContactBtn: "contactRequestsBtn",
    menuMyRequestsBtn: "myContactRequestsBtn",
    menuLoginBtn: "loginBtn",
    menuRegisterBtn: "registerBtn"
  };

  Object.keys(menuLinks).forEach(function (menuId) {
    const menuItem = document.getElementById(menuId);
    const targetId = menuLinks[menuId];

    if (!menuItem) return;

    menuItem.addEventListener("click", function () {
      closeMainMenu();

      const target = document.getElementById(targetId);

      if (target) {
        target.click();
      }
    });
  });
})();

/* ===== صفحة من نحن ===== */
function showAbout() {
  const overlay = document.getElementById("infoOverlay");
  const content = document.getElementById("infoContent");

  if (!overlay || !content) return;

  content.innerHTML = `
    <h2>ℹ️ من نحن</h2>

    <h3>LostFound الجزائر</h3>

    <p>
      LostFound الجزائر هي منصة رقمية تهدف إلى تسهيل الإبلاغ عن
      الممتلكات والوثائق الضائعة والعثور عليها، وربط أصحابها
      بالأشخاص الذين عثروا عليها بطريقة منظمة وآمنة.
    </p>

    <p>
      نسعى إلى توفير مساحة رقمية تساعد أفراد المجتمع الجزائري على
      نشر البلاغات والبحث عن المفقودات والتواصل بين أصحاب البلاغات
      والأشخاص الذين يمكنهم المساعدة في العثور عليها.
    </p>

    <h3>هدفنا</h3>

    <p>
      المساهمة في تسهيل استرجاع الممتلكات والوثائق الضائعة، وتقليل
      الوقت والجهد اللازمين للوصول إلى أصحابها، مع تطوير المنصة
      تدريجيًا لتقديم خدمات أكثر تنظيمًا وأمانًا.
    </p>

    <p>
      المنصة تعمل كوسيط تقني لتنظيم البلاغات والتواصل بين المستخدمين،
      ولا تضمن بحد ذاتها استرجاع أي غرض أو صحة جميع المعلومات التي
      يقدمها المستخدمون.
    </p>
  `;

  overlay.style.display = "block";
}

/* ربط زر من نحن بالقائمة */
const menuAboutBtn = document.getElementById("menuAboutBtn");

if (menuAboutBtn) {
  menuAboutBtn.addEventListener("click", function () {
    const menuOverlay = document.getElementById("menuOverlay");

    if (menuOverlay) {
      menuOverlay.style.display = "none";
    }

    showAbout();
  });
}

/* إغلاق نافذة المعلومات */
const closeInfoBtn = document.getElementById("closeInfoBtn");
const infoOverlay = document.getElementById("infoOverlay");

if (closeInfoBtn) {
  closeInfoBtn.addEventListener("click", function () {
    if (infoOverlay) {
      infoOverlay.style.display = "none";
    }
  });
}

/* إغلاق نافذة المعلومات عند الضغط خارج محتواها */
if (infoOverlay) {
  infoOverlay.addEventListener("click", function (event) {
    if (event.target === infoOverlay) {
      infoOverlay.style.display = "none";
    }
  });
}

/* إغلاق النوافذ بزر Escape */
document.addEventListener("keydown", function (event) {
  if (event.key !== "Escape") return;

  const info = document.getElementById("infoOverlay");
  const form = document.getElementById("form-area");
  const menu = document.getElementById("menuOverlay");

  if (info && info.style.display !== "none") {
    info.style.display = "none";
    return;
  }

  if (form && form.innerHTML.trim() !== "") {
    form.innerHTML = "";
    return;
  }

  if (menu && menu.style.display !== "none") {
    menu.style.display = "none";
  }
});


/* ===== شروط الاستخدام ===== */
function showTerms() {
  const overlay = document.getElementById("infoOverlay");
  const content = document.getElementById("infoContent");

  if (!overlay || !content) return;

  content.innerHTML = `
    <h2>📜 شروط الاستخدام</h2>

    <p>
      باستخدامك منصة LostFound الجزائر، فإنك توافق على الالتزام بهذه
      الشروط واستخدام المنصة بطريقة قانونية ومسؤولة.
    </p>

    <h3>1. استخدام المنصة</h3>
    <p>
      تتيح المنصة للمستخدمين نشر بلاغات عن الممتلكات والوثائق الضائعة
      أو التي تم العثور عليها، والبحث في البلاغات والتواصل وفق الخدمات
      المتاحة داخل المنصة.
    </p>

    <h3>2. صحة المعلومات</h3>
    <p>
      يتحمل المستخدم مسؤولية المعلومات التي يقدمها في البلاغات
      والرسائل. يجب عدم نشر معلومات كاذبة أو مضللة أو انتحال صفة
      شخص آخر.
    </p>

    <h3>3. التواصل بين المستخدمين</h3>
    <p>
      يتم التواصل من خلال الأدوات التي توفرها المنصة، ويجب استخدام
      هذه الأدوات لغرض مشروع ومحترم مرتبط بالبلاغات.
    </p>

    <h3>4. المحتوى الممنوع</h3>
    <p>
      يمنع استخدام المنصة لنشر محتوى غير قانوني أو مسيء أو تهديدي،
      أو لاستغلال بيانات المستخدمين، أو لإرسال رسائل مزعجة.
    </p>

    <h3>5. الحسابات</h3>
    <p>
      يجب على المستخدم الحفاظ على سرية بيانات الدخول الخاصة به وعدم
      مشاركتها مع الآخرين، وهو مسؤول عن النشاط الذي يتم من خلال حسابه.
    </p>

    <h3>6. دور المنصة</h3>
    <p>
      LostFound الجزائر منصة تقنية لتنظيم البلاغات والتواصل بين
      المستخدمين، ولا تُعد طرفًا في ملكية الممتلكات أو في أي اتفاق
      يتم بين المستخدمين.
    </p>

    <h3>7. التحديثات</h3>
    <p>
      قد يتم تحديث هذه الشروط عند تطوير المنصة أو إضافة خدمات جديدة،
      وسيتم نشر النسخة المحدثة داخل التطبيق.
    </p>

    <p class="info-note">
      آخر تحديث: أكتوبر 2026
    </p>
  `;

  overlay.style.display = "block";
}

/* ربط شروط الاستخدام */
const menuTermsBtn = document.getElementById("menuTermsBtn");

if (menuTermsBtn) {
  menuTermsBtn.addEventListener("click", function () {
    const menuOverlay = document.getElementById("menuOverlay");

    if (menuOverlay) {
      menuOverlay.style.display = "none";
    }

    showTerms();
  });
}

function showPrivacy() {
  const overlay = document.getElementById("infoOverlay");
  const content = document.getElementById("infoContent");
  if (!overlay || !content) return;

  content.innerHTML = `
    <h2>🔒 سياسة الخصوصية</h2>

    <p>
      تحترم منصة LostFound الجزائر خصوصية مستخدميها، وتهدف إلى
      التعامل مع المعلومات الشخصية بطريقة مسؤولة ومرتبطة بالخدمات
      التي توفرها المنصة.
    </p>

    <h3>1. المعلومات المرتبطة بالحساب</h3>
    <p>
      عند إنشاء الحساب، قد يتم تسجيل الاسم واللقب وعنوان البريد
      الإلكتروني وكلمة مرور الحساب، إضافة إلى تاريخ إنشاء الحساب
      وحالة التحقق من البريد الإلكتروني.
    </p>

    <h3>2. حماية كلمة المرور</h3>
    <p>
      لا يتم تخزين كلمة المرور الأصلية داخل حساب المستخدم، وإنما
      يتم تخزين قيمة مشفرة مخصصة للتحقق من كلمة المرور.
    </p>

    <h3>3. التحقق من البريد الإلكتروني</h3>
    <p>
      تستخدم المنصة رمز تحقق مؤقتًا للتأكد من إمكانية الوصول إلى
      البريد الإلكتروني المستخدم في إنشاء الحساب. يتم التعامل مع
      رمز التحقق بطريقة محمية وله مدة صلاحية محددة.
    </p>

    <h3>4. جلسة تسجيل الدخول</h3>
    <p>
      تستخدم المنصة بيانات جلسة لتحديد الحساب الذي قام بتسجيل
      الدخول وتمكينه من استخدام الخدمات التي تتطلب المصادقة.
    </p>

    <h3>5. البلاغات</h3>
    <p>
      قد يتم حفظ المعلومات التي يضيفها المستخدم في بلاغات المفقودات
      أو الموجودات، مثل نوع الغرض والولاية والبلدية والوصف، وربط
      البلاغ بالحساب الذي أنشأه بهدف توفير البحث والمطابقة.
    </p>

    <h3>6. طلبات التواصل والمحادثات</h3>
    <p>
      عند استخدام خدمة التواصل، يتم حفظ طلبات التواصل والرسائل
      اللازمة لتوفير المحادثة بين المستخدمين. وتطبق المنصة صلاحيات
      للتحكم في الوصول إلى المحادثات.
    </p>

    <h3>7. استخدام المعلومات</h3>
    <p>
      تستخدم المعلومات لتوفير الحسابات وتسجيل الدخول والتحقق من
      البريد الإلكتروني وإدارة البلاغات والبحث والمطابقة وطلبات
      التواصل والمحادثات، وكذلك للمساعدة في حماية تشغيل المنصة.
    </p>

    <h3>8. حماية الحساب</h3>
    <p>
      يجب على المستخدم المحافظة على بيانات تسجيل الدخول الخاصة به
      وعدم مشاركتها مع الآخرين. كما يُنصح بعدم نشر معلومات شديدة
      الحساسية داخل البلاغات أو المحادثات.
    </p>

    <h3>9. مشاركة المعلومات</h3>
    <p>
      لا تهدف المنصة إلى بيع المعلومات الشخصية للمستخدمين. وقد يتم
      عرض المعلومات اللازمة لتشغيل البلاغات والخدمات داخل المنصة
      وفق طبيعة الخدمة والصلاحيات المطبقة.
    </p>

    <h3>10. الاحتفاظ بالمعلومات</h3>
    <p>
      قد تحتفظ المنصة بالمعلومات طالما كانت ضرورية لتشغيل الحساب
      والخدمات أو لأغراض أمنية وتقنية، مع إمكانية تغيير آليات
      الاحتفاظ والحذف عند تطوير المنصة.
    </p>

    <h3>11. تحديث سياسة الخصوصية</h3>
    <p>
      قد يتم تحديث هذه السياسة عند إضافة خدمات جديدة أو تغيير
      طريقة معالجة المعلومات. وسيتم نشر النسخة المحدثة داخل
      التطبيق.
    </p>

    <p class="info-note">
      آخر تحديث: أكتوبر 2026
    </p>
  `;

  overlay.style.display = "block";
}

const menuPrivacyBtn = document.getElementById("menuPrivacyBtn");

if (menuPrivacyBtn) {
  menuPrivacyBtn.addEventListener("click", function () {
    const menuOverlay = document.getElementById("menuOverlay");
    if (menuOverlay) menuOverlay.style.display = "none";
    showPrivacy();
  });
}



// ===== Authentication / Logout =====
async function updateAuthButtons() {
  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (!loginBtn || !registerBtn || !logoutBtn) return;

  try {
    const response = await fetch("/api/me");
    const loggedIn = response.ok;

    loginBtn.style.display = loggedIn ? "none" : "";
    registerBtn.style.display = loggedIn ? "none" : "";
    logoutBtn.style.display = loggedIn ? "" : "none";
  } catch (error) {
    console.error("تعذر التحقق من جلسة الدخول:", error);
  }
}

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async function () {
    try {
      const response = await fetch("/api/logout", {
        method: "POST"
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "تعذر تسجيل الخروج");
        return;
      }

      alert(data.message || "تم تسجيل الخروج");
      document.getElementById("form-area").innerHTML = "";
      updateAuthButtons();
    } catch (error) {
      console.error(error);
      alert("تعذر الاتصال بالخادم");
    }
  });
}

updateAuthButtons();

document.getElementById("closeFormArea").addEventListener("click", function () {
  document.getElementById("form-area").innerHTML = "";
});


// ===== Support Contact =====
const supportContactBtn = document.getElementById("supportContactBtn");
if (supportContactBtn) {
  supportContactBtn.addEventListener("click", function () {
    const area = document.getElementById("form-area");
    area.innerHTML = `
      <div class="support-contact-form">
        <h2>تواصل معنا</h2>
        <p>أرسل لنا رسالتك وسنراجعها في أقرب وقت.</p>
        <div class="support-field">
          <label for="supportName">الاسم</label>
          <input id="supportName" type="text" maxlength="100">
        </div>
        <div class="support-field">
          <label for="supportEmail">البريد الإلكتروني</label>
          <input id="supportEmail" type="email" maxlength="254">
        </div>
        <div class="support-field support-message-field">
          <label for="supportMessage">الرسالة</label>
          <textarea id="supportMessage" maxlength="2000" rows="6"></textarea>
        </div>
        <button id="sendSupportMessage" type="button">إرسال الرسالة</button>
      </div>
    `;

    document.getElementById("sendSupportMessage").addEventListener("click", async function () {
      const name = document.getElementById("supportName").value.trim();
      const email = document.getElementById("supportEmail").value.trim();
      const message = document.getElementById("supportMessage").value.trim();

      if (!name || !email || !message) {
        alert("يرجى ملء جميع الحقول");
        return;
      }

      this.disabled = true;
      this.textContent = "جاري الإرسال...";

      try {
        const response = await fetch("/api/support-contact", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({name, email, message})
        });

        const data = await response.json();

        if (!response.ok) {
          alert(data.error || "تعذر إرسال الرسالة");
          return;
        }

        alert(data.message);
        area.innerHTML = "";
      } catch (error) {
        console.error(error);
        alert("تعذر الاتصال بالخادم");
      } finally {
        this.disabled = false;
        this.textContent = "إرسال الرسالة";
      }
    });
  });
}
