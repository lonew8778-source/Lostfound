require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const session = require("express-session");
const nodemailer = require("nodemailer");
const mailTransporter = nodemailer.createTransport({
  service: "gmail",
  family: 4,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});
const database = require("./database");

const app = express();
const PORT = 3000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb" }));
app.use(session({
  secret: "493471bca0c16da5eb22b7e16920de95445817ee489e143ff5e014e970983a94",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    maxAge: 1000 * 60 * 60 * 24
  }
}));
app.use(express.static("public"));

app.get("/api", (req, res) => {
  res.json({
    message: "LostFound Algeria API is running"
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout session destroy error:", err);
      return res.status(500).json({ error: "تعذر تسجيل الخروج" });
    }

    res.clearCookie("connect.sid");
    res.json({ message: "تم تسجيل الخروج" });
  });
});

app.get("/api/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "غير مسجل الدخول" });
  }
  res.json({ userId: req.session.userId });
});

app.get("/api/reports", (req, res) => {
  const file = path.join(__dirname, "reports.json");

  if (!fs.existsSync(file)) {
    return res.json([]);
  }

  const reports = JSON.parse(fs.readFileSync(file, "utf8"));

  res.json(reports.map(report => ({
    id: report.id,
    type: report.type,
    itemType: report.itemType,
    wilaya: report.wilaya,
    commune: report.commune,
    description: report.description,
    created_at: report.created_at
  })));
});


app.get("/api/search", (req, res) => {
  const file = path.join(__dirname, "reports.json");

  if (!fs.existsSync(file)) {
    return res.json([]);
  }

  const reports = JSON.parse(fs.readFileSync(file, "utf8"));

  const q = String(req.query.q || "").trim().toLowerCase();
  const type = String(req.query.type || "").trim().toLowerCase();
  const wilaya = String(req.query.wilaya || "").trim().toLowerCase();
  const commune = String(req.query.commune || "").trim().toLowerCase();

  const results = reports.filter(report => {
    const text = [
      report.itemType,
      report.wilaya,
      report.commune,
      report.description
    ].join(" ").toLowerCase();

    if (q && !text.includes(q)) return false;
    if (type && String(report.type || "").toLowerCase() !== type) return false;
    if (wilaya && String(report.wilaya || "").toLowerCase() !== wilaya) return false;
    if (commune && String(report.commune || "").toLowerCase() !== commune) return false;

    return true;
  });

  res.json(results.map(report => ({
    id: report.id,
    type: report.type,
    itemType: report.itemType,
    wilaya: report.wilaya,
    commune: report.commune,
    description: report.description,
    created_at: report.created_at
  })));
});

app.post("/api/register", async (req, res) => {
  try {
    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!firstName || !lastName) {
      return res.status(400).json({ error: "الاسم واللقب مطلوبان" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "البريد الإلكتروني غير صالح" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
    }

    const user = await database.createUser(email, password, firstName, lastName);
    const verificationToken = database.createEmailVerification(user.id);
await mailTransporter.sendMail({
  from: `"LostFound الجزائر" <${process.env.MAIL_USER}>`,
  to: user.email,
  subject: "تأكيد البريد الإلكتروني - LostFound الجزائر",
  text: `رمز تأكيد البريد الإلكتروني الخاص بك هو: ${verificationToken}\n\nهذا الرمز صالح لمدة 15 دقيقة.`
});
    res.status(201).json({
      message: "تم إنشاء الحساب",
      user
    });
  } catch (error) {
    if (error.message === "البريد الإلكتروني مستخدم") {
      try {
        const existingEmail = String(req.body.email || "").trim().toLowerCase();
        const existingUser = database.findUserByEmail(existingEmail);

        if (!existingUser) {
          return res.status(409).json({ error: error.message });
        }

        if (existingUser.verified === true) {
          return res.status(409).json({ error: error.message });
        }

        const verificationToken = database.createEmailVerification(existingUser.id);

        if (!verificationToken) {
          return res.status(500).json({ error: "تعذر إنشاء رمز التحقق" });
        }

        await mailTransporter.sendMail({
          from: `"LostFound الجزائر" <${process.env.MAIL_USER}>`,
          to: existingUser.email,
          subject: "تأكيد البريد الإلكتروني - LostFound الجزائر",
          text: `رمز تأكيد البريد الإلكتروني الخاص بك هو: ${verificationToken}\n\nهذا الرمز صالح لمدة 15 دقيقة.`
        });

        return res.status(200).json({
          message: "تم إرسال رمز التحقق إلى بريدك الإلكتروني",
          user: {
            id: existingUser.id,
            email: existingUser.email
          }
        });
      } catch (sendError) {
        console.error(sendError);
        return res.status(500).json({ error: "تعذر إرسال رمز التحقق إلى البريد الإلكتروني" });
      }
    }

    console.error(error);
    res.status(500).json({ error: "تعذر إنشاء الحساب" });
  }
});

const loginAttempts=new Map();const MAX_LOGIN_ATTEMPTS=5;const LOGIN_LOCK_MS=900000;function loginBlocked(k){const r=loginAttempts.get(k);if(!r)return false;if(r.lockedUntil&&Date.now()<r.lockedUntil)return true;if(r.lockedUntil)loginAttempts.delete(k);return false;}function loginFailed(k){const r=loginAttempts.get(k)||{count:0};r.count++;if(r.count>=MAX_LOGIN_ATTEMPTS)r.lockedUntil=Date.now()+LOGIN_LOCK_MS;loginAttempts.set(k,r);}function loginSucceeded(k){loginAttempts.delete(k);}
app.post("/api/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const loginKey=String(req.ip||"unknown")+"|"+email; if(loginBlocked(loginKey))return res.status(429).json({error:"محاولات تسجيل الدخول كثيرة. حاول مرة أخرى بعد 15 دقيقة"});

    if (!email || !password) {
      return res.status(400).json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" });
    }

    const user = database.findUserByEmail(email);

    if (!user) {
      loginFailed(loginKey);
      return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    }

    const valid = await database.verifyPassword(password, user.passwordHash);

    if (!valid) {
      loginFailed(loginKey);
      return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    }

    if (user.verified === false) {
      return res.status(403).json({ error: "يجب تأكيد البريد الإلكتروني قبل تسجيل الدخول" });
    }

    loginSucceeded(loginKey);
    req.session.userId = user.id;
    res.json({
      message: "تم تسجيل الدخول",
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "تعذر تسجيل الدخول" });
  }
});
app.post("/api/resend-verification", async (req, res) => {
  try {
    const userId = String(req.body.userId || "").trim();

    if (!userId) {
      return res.status(400).json({ error: "بيانات الحساب ناقصة" });
    }

    const user = database.findUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "الحساب غير موجود" });
    }

    if (user.verified === true) {
      return res.status(400).json({ error: "البريد الإلكتروني مؤكد بالفعل" });
    }

    const verificationToken = database.createEmailVerification(user.id);

    if (!verificationToken) {
      return res.status(500).json({ error: "تعذر إنشاء رمز التحقق" });
    }

    await mailTransporter.sendMail({
      from: `"LostFound الجزائر" <${process.env.MAIL_USER}>`,
      to: user.email,
      subject: "رمز تأكيد البريد الإلكتروني - LostFound الجزائر",
      text: `رمز تأكيد البريد الإلكتروني الخاص بك هو: ${verificationToken}\n\nهذا الرمز صالح لمدة 15 دقيقة.`
    });

    res.json({ message: "تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "تعذر إعادة إرسال رمز التحقق" });
  }
});

app.post("/api/verify-email", (req, res) => {
  const userId = String(req.body.userId || "").trim();
  const token = String(req.body.token || "").trim();

  if (!userId || !token) {
    return res.status(400).json({ error: "بيانات التحقق ناقصة" });
  }

  const ok = database.verifyEmailToken(userId, token);

  if (!ok) {
    return res.status(400).json({ error: "رمز التحقق غير صالح أو منتهي الصلاحية" });
  }

  res.json({ message: "تم تأكيد البريد الإلكتروني بنجاح" });
});

app.post("/api/reports", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      error: "يجب تسجيل الدخول أولاً"
    });
  }

  const { type, itemType, wilaya, commune, description } = req.body;

  if (!type || !itemType || !wilaya || !commune || !description) {
    return res.status(400).json({
      error: "جميع المعلومات مطلوبة"
    });
  }

  const report = database.addReport({
    userId: req.session.userId,
    type,
    itemType,
    wilaya,
    commune,
    description
  });

  res.status(201).json({
    message: "تم حفظ البلاغ",
    reportId: report.id
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});

app.get("/api/matches/:id", (req, res) => {
  const file = path.join(__dirname, "reports.json");

  if (!fs.existsSync(file)) return res.json([]);

  const reports = JSON.parse(fs.readFileSync(file, "utf8"));
  const id = Number(req.params.id);
  const report = reports.find(r => r.id === id);

  if (!report) {
    return res.status(404).json({ error: "البلاغ غير موجود" });
  }

  const oppositeType = report.type === "lost" ? "found" : "lost";

  const normalize = text => String(text || "").toLowerCase().trim();
  const sourceWords = normalize(report.description).split(/\s+/).filter(w => w.length >= 3);

  const matches = reports
    .filter(r => r.id !== report.id && r.type === oppositeType)
    .map(match => {
      let score = 0;

      if (normalize(match.itemType) === normalize(report.itemType)) score += 40;
      if (normalize(match.wilaya) === normalize(report.wilaya)) score += 30;
      if (normalize(match.commune) === normalize(report.commune)) score += 20;

      const matchText = normalize(match.description);
      sourceWords.forEach(word => {
        if (matchText.includes(word)) score += 10;
      });

      return {
        type: match.type,
        itemType: match.itemType,
        wilaya: match.wilaya,
        commune: match.commune,
        matchScore: Math.min(score, 100),
        created_at: match.created_at
      };
    })
    .filter(match => match.matchScore >= 50)
    .sort((a, b) => b.matchScore - a.matchScore);

  res.json(matches);
});


app.post("/api/support-contact", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const message = String(req.body.message || "").trim();

    if (!name || !email || !message)
      return res.status(400).json({error:"يرجى ملء جميع الحقول"});

    if (name.length > 100 || message.length > 2000)
      return res.status(400).json({error:"البيانات طويلة جدًا"});

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({error:"البريد الإلكتروني غير صالح"});

    await mailTransporter.sendMail({
      from: `"LostFound الجزائر" <${process.env.MAIL_USER}>`,
      to: process.env.MAIL_USER,
      replyTo: email,
      subject: `رسالة تواصل جديدة من ${name}`,
      text: `الاسم: ${name}\nالبريد الإلكتروني: ${email}\n\nالرسالة:\n${message}`
    });

    res.json({message:"تم إرسال رسالتك بنجاح، شكرًا لتواصلك معنا"});
  } catch (error) {
    console.error("Support contact email error:", error);
    res.status(500).json({error:"تعذر إرسال الرسالة حاليًا"});
  }
});

app.post("/api/contact",(req,res)=>{if(!req.session.userId)return res.status(401).json({error:"يجب تسجيل الدخول أولاً"});const reportId=Number(req.body.reportId);if(!Number.isInteger(reportId)||reportId<=0)return res.status(400).json({error:"رقم البلاغ غير صالح"});const report=database.findReportById(reportId);if(!report)return res.status(404).json({error:"البلاغ غير موجود"});const contact=database.addContactRequest({reportId,userId:req.session.userId});if(contact.duplicate)return res.status(409).json({error:"لقد أرسلت طلب تواصل لهذا البلاغ من قبل"});res.status(201).json({message:"تم تسجيل طلب التواصل",contactId:contact.id});});

app.get("/api/contact/my-requests",(req,res)=>{
  if(!req.session.userId){
    return res.status(401).json({error:"يجب تسجيل الدخول أولاً"});
  }

  const contacts=database.getContactRequests();

  const requests=contacts
    .filter(contact=>String(contact.userId)===String(req.session.userId))
    .map(contact=>({
      id:contact.id,
      reportId:contact.reportId,
      status:contact.status,
      created_at:contact.created_at,
      updated_at:contact.updated_at
    }));

  res.json(requests);
});

app.get("/api/contact/unread-count",(req,res)=>{
  if(!req.session.userId){
    return res.status(401).json({error:"يجب تسجيل الدخول أولاً"});
  }

  const contacts = database.getContactRequests();

  const ownedReports = JSON.parse(
    fs.readFileSync(path.join(__dirname,"reports.json"),"utf8")
  ).filter(
    report => String(report.userId) === String(req.session.userId)
  );

  const ownedReportIds = new Set(
    ownedReports.map(report => Number(report.id))
  );

  const unreadCount = contacts
    .filter(contact => ownedReportIds.has(Number(contact.reportId)))
    .filter(contact => contact.owner_hidden !== true)
    .filter(contact => contact.owner_read !== true)
    .length;

  res.json({count: unreadCount});
});

app.post("/api/contact/mark-read",(req,res)=>{
  if(!req.session.userId){
    return res.status(401).json({error:"يجب تسجيل الدخول أولاً"});
  }

  const contacts=database.getContactRequests();

  const ownedReports=JSON.parse(
    fs.readFileSync(path.join(__dirname,"reports.json"),"utf8")
  ).filter(
    report=>String(report.userId)===String(req.session.userId)
  );

  const ownedReportIds=new Set(
    ownedReports.map(report=>Number(report.id))
  );

  const updated=contacts.map(contact=>{
    if(
      ownedReportIds.has(Number(contact.reportId)) &&
      contact.owner_hidden !== true
    ){
      return {...contact, owner_read:true};
    }

    return contact;
  });

  fs.writeFileSync(
    path.join(__dirname,"contacts.json"),
    JSON.stringify(updated,null,2),
    {mode:0o600}
  );

  res.json({message:"تم تعليم طلبات التواصل كمقروءة"});
});

app.get("/api/contact/requests",(req,res)=>{
  if(!req.session.userId){
    return res.status(401).json({error:"يجب تسجيل الدخول أولاً"});
  }

  const contacts=database.getContactRequests();

  const ownedReports=JSON.parse(
    fs.readFileSync(path.join(__dirname,"reports.json"),"utf8")
  ).filter(
    report=>String(report.userId)===String(req.session.userId)
  );

  const ownedReportIds=new Set(
    ownedReports.map(report=>Number(report.id))
  );

  const requests=contacts
    .filter(contact=>ownedReportIds.has(Number(contact.reportId)))
    .filter(contact=>contact.owner_hidden !== true)
    .map(contact=>({
      id:contact.id,
      reportId:contact.reportId,
      status:contact.status,
      created_at:contact.created_at,
      updated_at:contact.updated_at
    }));

  res.json(requests);
});


app.post("/api/contact/delete",(req,res)=>{
  if(!req.session.userId){
    return res.status(401).json({error:"يجب تسجيل الدخول أولاً"});
  }

  const contactId=String(req.body.contactId||"").trim();

  if(!contactId){
    return res.status(400).json({error:"رقم طلب التواصل مطلوب"});
  }

  const result=database.deleteContactRequest(
    contactId,
    req.session.userId
  );

  if(!result.success){
    if(result.error==="غير مسموح بحذف هذا الطلب"){
      return res.status(403).json({error:result.error});
    }

    return res.status(404).json({error:result.error});
  }

  res.json({message:"تم حذف طلب التواصل"});
});

app.post("/api/contact/cancel",(req,res)=>{
  if(!req.session.userId){
    return res.status(401).json({error:"يجب تسجيل الدخول أولاً"});
  }

  const contactId=String(req.body.contactId||"").trim();

  if(!contactId){
    return res.status(400).json({error:"رقم طلب التواصل مطلوب"});
  }

  const result=database.cancelContactRequest(
    contactId,
    req.session.userId
  );

  if(!result.success){
    if(result.error==="غير مسموح بإلغاء هذا الطلب"){
      return res.status(403).json({error:result.error});
    }

    if(result.error==="لا يمكن إلغاء هذا الطلب بعد معالجته"){
      return res.status(409).json({error:result.error});
    }

    return res.status(404).json({error:result.error});
  }

  res.json({message:"تم إلغاء طلب التواصل"});
});

app.post("/api/contact/status",(req,res)=>{
  if(!req.session.userId){
    return res.status(401).json({error:"يجب تسجيل الدخول أولاً"});
  }

  const contactId=String(req.body.contactId||"").trim();
  const status=String(req.body.status||"").trim();

  if(!contactId){
    return res.status(400).json({error:"رقم طلب التواصل مطلوب"});
  }

  if(!["approved","rejected"].includes(status)){
    return res.status(400).json({error:"حالة التواصل غير صالحة"});
  }

  const contactFile=path.join(__dirname,"contacts.json");

  if(!fs.existsSync(contactFile)){
    return res.status(404).json({error:"طلب التواصل غير موجود"});
  }

  const contacts=JSON.parse(fs.readFileSync(contactFile,"utf8"));
  const contact=contacts.find(item=>String(item.id)===contactId);

  if(!contact){
    return res.status(404).json({error:"طلب التواصل غير موجود"});
  }

  const report=database.findReportById(contact.reportId);

  if(!report){
    return res.status(404).json({error:"البلاغ المرتبط بالطلب غير موجود"});
  }

  if(!report.userId){
    return res.status(403).json({error:"لا يمكن تحديد صاحب البلاغ بأمان"});
  }

  if(String(report.userId)!==String(req.session.userId)){
    return res.status(403).json({error:"غير مسموح لك بتغيير حالة هذا الطلب"});
  }

  if(contact.userId && String(contact.userId)===String(req.session.userId)){
    return res.status(403).json({error:"لا يمكنك الموافقة على طلبك بنفسك"});
  }

  if(contact.status!=="pending"){
    return res.status(409).json({error:"تمت معالجة هذا الطلب من قبل"});
  }

  const updated=database.updateContactStatus(contactId,status);

  if(!updated){
    return res.status(404).json({error:"طلب التواصل غير موجود"});
  }

  res.json({
    message:status==="approved"?"تمت الموافقة على طلب التواصل":"تم رفض طلب التواصل",
    contactId:updated.id,
    status:updated.status
  });
});

app.get("/api/messages/conversations", (req,res)=>{
  if(!req.session.userId){
    return res.status(401).json({error:"يجب تسجيل الدخول أولاً"});
  }

  const userId=String(req.session.userId);
  const contactFile=path.join(__dirname,"contacts.json");
  const messageFile=path.join(__dirname,"messages.json");

  if(!fs.existsSync(contactFile)){
    return res.json([]);
  }

  const contacts=JSON.parse(
    fs.readFileSync(contactFile,"utf8")
  );

  const messages=fs.existsSync(messageFile)
    ? JSON.parse(fs.readFileSync(messageFile,"utf8"))
    : [];

  const conversationsByReport=new Map();

  contacts.forEach(contact=>{
    if(contact.status!=="approved") return;

    const report=database.findReportById(contact.reportId);

    if(!report || !report.userId || !contact.userId){
      return;
    }

    let isParticipant=false;
    let otherUserId="";

    if(userId===String(contact.userId)){
      isParticipant=true;
      otherUserId=String(report.userId);
    } else if(userId===String(report.userId)){
      isParticipant=true;
      otherUserId=String(contact.userId);
    }

    if(!isParticipant) return;

    const conversationMessages=messages.filter(
      message=>String(message.contactId)===String(contact.id)
    );

    let lastMessageAt="";

    if(conversationMessages.length>0){
      lastMessageAt=conversationMessages.reduce((latest,message)=>{
        const current=String(message.created_at||"");
        return current>latest ? current : latest;
      },"");
    }

    const unread=messages.filter(message=>{
      if(String(message.contactId)!==String(contact.id)){
        return false;
      }

      if(String(message.userId)===userId){
        return false;
      }

      const readBy=Array.isArray(message.readBy)
        ? message.readBy
        : [];

      return !readBy.includes(userId);
    }).length;

    const candidate={
      contactId:String(contact.id),
      reportId:contact.reportId,
      otherUserId,
      unread,
      lastMessageAt
    };

    const existing=conversationsByReport.get(String(contact.reportId));

    if(!existing){
      conversationsByReport.set(String(contact.reportId),candidate);
      return;
    }

    if(String(candidate.lastMessageAt)>String(existing.lastMessageAt)){
      conversationsByReport.set(String(contact.reportId),candidate);
    }
  });

  const conversations=Array.from(conversationsByReport.values());

  conversations.sort((a,b)=>{
    return String(b.lastMessageAt).localeCompare(
      String(a.lastMessageAt)
    );
  });

  res.json(conversations);
});


app.get("/api/messages/:contactId",(req,res)=>{
  if(!req.session.userId){
    return res.status(401).json({error:"يجب تسجيل الدخول أولاً"});
  }

  const contactId=String(req.params.contactId||"").trim();

  if(!contactId){
    return res.status(400).json({error:"رقم طلب التواصل مطلوب"});
  }

  const contactFile=path.join(__dirname,"contacts.json");

  if(!fs.existsSync(contactFile)){
    return res.status(404).json({error:"طلب التواصل غير موجود"});
  }

  const contacts=JSON.parse(fs.readFileSync(contactFile,"utf8"));
  const contact=contacts.find(item=>String(item.id)===contactId);

  if(!contact){
    return res.status(404).json({error:"طلب التواصل غير موجود"});
  }

  if(contact.status!=="approved"){
    return res.status(403).json({error:"التواصل غير متاح قبل الموافقة"});
  }

  const report=database.findReportById(contact.reportId);

  if(!report){
    return res.status(404).json({error:"البلاغ المرتبط بالطلب غير موجود"});
  }

  if(!report.userId || !contact.userId){
    return res.status(403).json({error:"لا يمكن تحديد طرفي التواصل بأمان"});
  }

  const userId=String(req.session.userId);

  if(
    userId!==String(report.userId) &&
    userId!==String(contact.userId)
  ){
    return res.status(403).json({error:"غير مسموح لك بالدخول إلى هذه المحادثة"});
  }

  const messageFile=path.join(__dirname,"messages.json");

  if(!fs.existsSync(messageFile)){
    return res.json([]);
  }

  const messages=JSON.parse(fs.readFileSync(messageFile,"utf8"));

  const result=messages.filter(
    message=>String(message.contactId)===contactId
  );

  res.json(result);
});


app.post("/api/messages/:contactId",(req,res)=>{
  if(!req.session.userId){
    return res.status(401).json({error:"يجب تسجيل الدخول أولاً"});
  }

  const contactId=String(req.params.contactId||"").trim();
  const text=String(req.body.text||"").trim();

  if(!contactId){
    return res.status(400).json({error:"رقم طلب التواصل مطلوب"});
  }

  if(!text){
    return res.status(400).json({error:"الرسالة فارغة"});
  }

  if(text.length>2000){
    return res.status(400).json({error:"الرسالة طويلة جدًا"});
  }

  const contactFile=path.join(__dirname,"contacts.json");

  if(!fs.existsSync(contactFile)){
    return res.status(404).json({error:"طلب التواصل غير موجود"});
  }

  const contacts=JSON.parse(fs.readFileSync(contactFile,"utf8"));
  const contact=contacts.find(item=>String(item.id)===contactId);

  if(!contact){
    return res.status(404).json({error:"طلب التواصل غير موجود"});
  }

  if(contact.status!=="approved"){
    return res.status(403).json({error:"لا يمكن إرسال رسالة قبل الموافقة"});
  }

  const report=database.findReportById(contact.reportId);

  if(!report){
    return res.status(404).json({error:"البلاغ المرتبط بالطلب غير موجود"});
  }

  if(!report.userId || !contact.userId){
    return res.status(403).json({error:"لا يمكن تحديد طرفي التواصل بأمان"});
  }

  const userId=String(req.session.userId);

  if(
    userId!==String(report.userId) &&
    userId!==String(contact.userId)
  ){
    return res.status(403).json({error:"غير مسموح لك بإرسال رسالة في هذه المحادثة"});
  }

  const messageFile=path.join(__dirname,"messages.json");

  if(!fs.existsSync(messageFile)){
    fs.writeFileSync(messageFile,"[]",{mode:0o600});
  }

  const messages=JSON.parse(fs.readFileSync(messageFile,"utf8"));

  const message={
    id:require("crypto").randomBytes(16).toString("hex"),
    contactId,
    userId,
    text,
    created_at:new Date().toISOString()
  };

  messages.push(message);

  fs.writeFileSync(
    messageFile,
    JSON.stringify(messages,null,2),
    {mode:0o600}
  );

  res.status(201).json({
    message:"تم إرسال الرسالة",
    id:message.id,
    created_at:message.created_at
  });
});




app.get("/api/messages/unread/count", (req,res)=>{
  if(!req.session.userId){
    return res.status(401).json({error:"يجب تسجيل الدخول أولاً"});
  }

  const userId=String(req.session.userId);
  const contactFile=path.join(__dirname,"contacts.json");
  const messageFile=path.join(__dirname,"messages.json");

  if(!fs.existsSync(contactFile)){
    return res.json({total:0, conversations:[]});
  }

  const contacts=JSON.parse(fs.readFileSync(contactFile,"utf8"));
  const messages=fs.existsSync(messageFile)
    ? JSON.parse(fs.readFileSync(messageFile,"utf8"))
    : [];

  const conversations=[];

  contacts.forEach(contact=>{
    if(contact.status!=="approved") return;

    const report=database.findReportById(contact.reportId);
    if(!report || !report.userId || !contact.userId) return;

    const isParticipant =
      userId===String(report.userId) ||
      userId===String(contact.userId);

    if(!isParticipant) return;

    const unread=messages.filter(message=>{
      if(String(message.contactId)!==String(contact.id)) return false;
      if(String(message.userId)===userId) return false;

      const readBy=Array.isArray(message.readBy)
        ? message.readBy
        : [];

      return !readBy.includes(userId);
    }).length;

    if(unread>0){
      conversations.push({
        contactId:String(contact.id),
        unread
      });
    }
  });

  const total=conversations.reduce(
    (sum,item)=>sum+item.unread,
    0
  );

  res.json({total,conversations});
});


app.post("/api/messages/:contactId/read", (req,res)=>{
  if(!req.session.userId){
    return res.status(401).json({error:"يجب تسجيل الدخول أولاً"});
  }

  const contactId=String(req.params.contactId||"").trim();
  const userId=String(req.session.userId);

  if(!contactId){
    return res.status(400).json({error:"رقم طلب التواصل مطلوب"});
  }

  const contactFile=path.join(__dirname,"contacts.json");
  const messageFile=path.join(__dirname,"messages.json");

  if(!fs.existsSync(contactFile)){
    return res.status(404).json({error:"طلب التواصل غير موجود"});
  }

  const contacts=JSON.parse(fs.readFileSync(contactFile,"utf8"));
  const contact=contacts.find(
    item=>String(item.id)===contactId
  );

  if(!contact){
    return res.status(404).json({error:"طلب التواصل غير موجود"});
  }

  if(contact.status!=="approved"){
    return res.status(403).json({error:"التواصل غير متاح قبل الموافقة"});
  }

  const report=database.findReportById(contact.reportId);

  if(!report || !report.userId || !contact.userId){
    return res.status(403).json({error:"لا يمكن تحديد طرفي التواصل بأمان"});
  }

  if(
    userId!==String(report.userId) &&
    userId!==String(contact.userId)
  ){
    return res.status(403).json({error:"غير مسموح لك بهذه المحادثة"});
  }

  if(!fs.existsSync(messageFile)){
    return res.json({message:"لا توجد رسائل"});
  }

  const messages=JSON.parse(
    fs.readFileSync(messageFile,"utf8")
  );

  let changed=false;

  messages.forEach(message=>{
    if(String(message.contactId)!==contactId) return;
    if(String(message.userId)===userId) return;

    if(!Array.isArray(message.readBy)){
      message.readBy=[];
    }

    if(!message.readBy.includes(userId)){
      message.readBy.push(userId);
      changed=true;
    }
  });

  if(changed){
    fs.writeFileSync(
      messageFile,
      JSON.stringify(messages,null,2),
      {mode:0o600}
    );
  }

  res.json({message:"تم تعليم الرسائل كمقروءة"});
});


app.post("/api/contact/hide",(req,res)=>{
  if(!req.session.userId){
    return res.status(401).json({error:"يجب تسجيل الدخول أولاً"});
  }

  const contactId=String(req.body.contactId||"").trim();

  if(!contactId){
    return res.status(400).json({error:"رقم طلب التواصل مطلوب"});
  }

  const result=database.hideContactRequestForOwner(
    contactId,
    req.session.userId
  );

  if(!result.success){
    if(result.error==="غير مسموح بإخفاء هذا الطلب"){
      return res.status(403).json({error:result.error});
    }

    return res.status(404).json({error:result.error});
  }

  res.json({message:"تم إخفاء طلب التواصل"});
});
