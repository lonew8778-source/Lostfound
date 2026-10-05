const fs = require("fs");
const bcrypt = require("bcryptjs");
const path = require("path");

const file = path.join(__dirname, "reports.json");

function loadReports() {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "[]", { mode: 0o600 });
  }

  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function addReport(report) {
  const reports = loadReports();

  const newReport = {
    id: Date.now(),
    ...report,
    created_at: new Date().toISOString()
  };

  reports.push(newReport);

  fs.writeFileSync(
    file,
    JSON.stringify(reports, null, 2),
    { mode: 0o600 }
  );

  return newReport;
}

function findReportById(reportId) {
  const reports = loadReports();
  return reports.find(report => Number(report.id) === Number(reportId)) || null;
}

function findUserById(userId) {
  const usersFile = path.join(__dirname, "users.json");

  if (!fs.existsSync(usersFile)) {
    return null;
  }

  const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));

  const user = users.find(
    u => String(u.id) === String(userId)
  );

  return user || null;
}

module.exports = { addReport, addContactRequest, findReportById, findUserById, getContactRequests, updateContactStatus, deleteContactRequest, cancelContactRequest, hideContactRequestForOwner, createUser, findUserByEmail, verifyPassword, createEmailVerification, verifyEmailToken };
function addContactRequest(request) {
  const contactFile = path.join(__dirname, "contacts.json");
  if (!fs.existsSync(contactFile)) fs.writeFileSync(contactFile, "[]", { mode: 0o600 });
  const contacts = JSON.parse(fs.readFileSync(contactFile, "utf8"));

  const existing = contacts.find(
    contact => Number(contact.reportId) === Number(request.reportId) &&
               String(contact.userId) === String(request.userId) &&
               (contact.status === "pending" || contact.status === "approved")
  );

  if (existing) return { ...existing, duplicate: true };

  const newRequest = {
    id: require("crypto").randomBytes(16).toString("hex"),
    reportId: Number(request.reportId),
    userId: request.userId,
    created_at: new Date().toISOString(),
    status: "pending",
      owner_read: false
  };
  contacts.push(newRequest);
  fs.writeFileSync(contactFile, JSON.stringify(contacts, null, 2), { mode: 0o600 });
  return { ...newRequest, duplicate: false };
}

function getContactRequests() {
  const contactFile = path.join(__dirname, "contacts.json");

  if (!fs.existsSync(contactFile)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(contactFile, "utf8"));
}

function updateContactStatus(contactId, status) {
  if (!["approved", "rejected"].includes(status)) {
    throw new Error("حالة التواصل غير صالحة");
  }

  const contactFile = path.join(__dirname, "contacts.json");

  if (!fs.existsSync(contactFile)) {
    return null;
  }

  const contacts = JSON.parse(fs.readFileSync(contactFile, "utf8"));

  const contact = contacts.find(
    item => String(item.id) === String(contactId)
  );

  if (!contact) {
    return null;
  }

  contact.status = status;
  contact.updated_at = new Date().toISOString();

  fs.writeFileSync(
    contactFile,
    JSON.stringify(contacts, null, 2),
    { mode: 0o600 }
  );

  return contact;
}


function deleteContactRequest(contactId, userId) {
  const contactFile = path.join(__dirname, "contacts.json");

  if (!fs.existsSync(contactFile)) {
    return { success: false, error: "الطلب غير موجود" };
  }

  const contacts = JSON.parse(fs.readFileSync(contactFile, "utf8"));

  const index = contacts.findIndex(
    item => String(item.id) === String(contactId)
  );

  if (index === -1) {
    return { success: false, error: "الطلب غير موجود" };
  }

  const contact = contacts[index];

  if (String(contact.userId) !== String(userId)) {
    return { success: false, error: "غير مسموح بحذف هذا الطلب" };
  }

  contacts.splice(index, 1);

  fs.writeFileSync(
    contactFile,
    JSON.stringify(contacts, null, 2),
    { mode: 0o600 }
  );

  return { success: true };
}

function loadUsers() {
  const userFile = path.join(__dirname, "users.json");
  if (!fs.existsSync(userFile)) {
    fs.writeFileSync(userFile, "[]", { mode: 0o600 });
  }
  return JSON.parse(fs.readFileSync(userFile, "utf8"));
}

async function createUser(email, password, firstName, lastName) {
  const users = loadUsers();
  const normalizedEmail = String(email).trim().toLowerCase();

  if (users.some(user => user.email === normalizedEmail)) {
    throw new Error("البريد الإلكتروني مستخدم");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = {
    id: require("crypto").randomBytes(16).toString("hex"),
    email: normalizedEmail,
    firstName: String(firstName).trim(), lastName: String(lastName).trim(), verified: false,
    passwordHash,
    created_at: new Date().toISOString()
  };

  users.push(user);

  const userFile = path.join(__dirname, "users.json");
  fs.writeFileSync(userFile, JSON.stringify(users, null, 2), { mode: 0o600 });

  return {
    id: user.id,
    firstName: user.firstName, lastName: user.lastName, verified: user.verified,
    email: user.email,
    created_at: user.created_at
  };
}

function createEmailVerification(userId) {
  const users = loadUsers();
  const crypto = require("crypto");
  const user = users.find(u => String(u.id) === String(userId));
  if (!user) return null;

  const token = String(crypto.randomInt(10000, 100000));
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  user.verificationTokenHash = tokenHash;
  user.verificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const userFile = path.join(__dirname, "users.json");
  fs.writeFileSync(userFile, JSON.stringify(users, null, 2), { mode: 0o600 });

  return token;
}

function verifyEmailToken(userId, token) {
  const users = loadUsers();
  const crypto = require("crypto");
  const user = users.find(u => String(u.id) === String(userId));
  if (!user || !user.verificationTokenHash || !user.verificationExpiresAt) return false;
  if (Date.now() > new Date(user.verificationExpiresAt).getTime()) return false;

  const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
  if (tokenHash !== user.verificationTokenHash) return false;

  user.verified = true;
  delete user.verificationTokenHash;
  delete user.verificationExpiresAt;

  const userFile = path.join(__dirname, "users.json");
  fs.writeFileSync(userFile, JSON.stringify(users, null, 2), { mode: 0o600 });
  return true;
}

function findUserByEmail(email) {
  const users = loadUsers();
  const normalizedEmail = String(email).trim().toLowerCase();
  return users.find(user => user.email === normalizedEmail) || null;
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function cancelContactRequest(contactId, userId) {
  const contactFile = path.join(__dirname, "contacts.json");

  if (!fs.existsSync(contactFile)) {
    return { success: false, error: "الطلب غير موجود" };
  }

  const contacts = JSON.parse(fs.readFileSync(contactFile, "utf8"));

  const index = contacts.findIndex(
    item => String(item.id) === String(contactId)
  );

  if (index === -1) {
    return { success: false, error: "الطلب غير موجود" };
  }

  const contact = contacts[index];

  if (String(contact.userId) !== String(userId)) {
    return { success: false, error: "غير مسموح بإلغاء هذا الطلب" };
  }

  if (contact.status !== "pending") {
    return { success: false, error: "لا يمكن إلغاء هذا الطلب بعد معالجته" };
  }

  contacts.splice(index, 1);

  fs.writeFileSync(
    contactFile,
    JSON.stringify(contacts, null, 2),
    { mode: 0o600 }
  );

  return { success: true };
}

function hideContactRequestForOwner(contactId, userId) {
  const contactFile = path.join(__dirname, "contacts.json");

  if (!fs.existsSync(contactFile)) {
    return { success: false, error: "الطلب غير موجود" };
  }

  const contacts = JSON.parse(fs.readFileSync(contactFile, "utf8"));
  const contact = contacts.find(
    item => String(item.id) === String(contactId)
  );

  if (!contact) {
    return { success: false, error: "الطلب غير موجود" };
  }

  const report = findReportById(contact.reportId);

  if (!report || String(report.userId) !== String(userId)) {
    return { success: false, error: "غير مسموح بإخفاء هذا الطلب" };
  }

  contact.owner_hidden = true;
  contact.owner_hidden_at = new Date().toISOString();

  fs.writeFileSync(
    contactFile,
    JSON.stringify(contacts, null, 2),
    { mode: 0o600 }
  );

  return { success: true };
}
