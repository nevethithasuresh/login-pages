// ==========================================================================
// AuthVault - Client-Side Controller
// Handles MongoDB Compass Connection, Auth Flows, and Live Data Output
// ==========================================================================

const API_BASE = "/api/auth";

// DOM Elements
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const loginFormContainer = document.getElementById("loginFormContainer");
const registerFormContainer = document.getElementById("registerFormContainer");
const authSection = document.getElementById("authSection");
const dashboardSection = document.getElementById("dashboardSection");

// Status & Output Elements
const dbStatusPill = document.getElementById("dbStatusPill");
const dbStatusText = document.getElementById("dbStatusText");
const userCountBadge = document.getElementById("userCountBadge");
const totalCountDisplay = document.getElementById("totalCountDisplay");
const usersTable = document.getElementById("usersTable");
const usersTableBody = document.getElementById("usersTableBody");
const emptyState = document.getElementById("emptyState");
const refreshUsersBtn = document.getElementById("refreshUsersBtn");
const searchUserInput = document.getElementById("searchUserInput");
const openOutputDrawerBtn = document.getElementById("openOutputDrawerBtn");
const outputCardSection = document.getElementById("outputCardSection");

// Forms
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");

// Password Strength
const regPasswordInput = document.getElementById("regPassword");
const strengthBarFill = document.getElementById("strengthBarFill");
const strengthLabel = document.getElementById("strengthLabel");

// Dashboard Elements
const dashboardUserName = document.getElementById("dashboardUserName");
const dashboardUserEmail = document.getElementById("dashboardUserEmail");
const dashboardJoinDate = document.getElementById("dashboardJoinDate");
const userAvatar = document.getElementById("userAvatar");
const logoutBtn = document.getElementById("logoutBtn");
const dashViewDataBtn = document.getElementById("dashViewDataBtn");

// Quick links
const goToRegisterLink = document.getElementById("goToRegisterLink");
const goToLoginLink = document.getElementById("goToLoginLink");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");

let cachedUsers = [];

// ==========================================================================
// 1. Initial Setup & Event Listeners
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    setupTabSwitching();
    setupPasswordToggles();
    setupPasswordStrength();
    checkDatabaseStatus();
    loadCompassUsers();
    checkSavedSession();

    // Auto-poll database status every 8 seconds
    setInterval(checkDatabaseStatus, 8000);
});

// Tab switcher
function setupTabSwitching() {
    tabLogin.addEventListener("click", () => switchTab("login"));
    tabRegister.addEventListener("click", () => switchTab("register"));
    goToRegisterLink.addEventListener("click", () => switchTab("register"));
    goToLoginLink.addEventListener("click", () => switchTab("login"));
}

function switchTab(target) {
    if (target === "login") {
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
        loginFormContainer.classList.remove("hidden");
        registerFormContainer.classList.add("hidden");
    } else {
        tabRegister.classList.add("active");
        tabLogin.classList.remove("active");
        registerFormContainer.classList.remove("hidden");
        loginFormContainer.classList.add("hidden");
    }
}

// Password show/hide toggle
function setupPasswordToggles() {
    document.querySelectorAll(".btn-toggle-eye").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-target");
            const input = document.getElementById(targetId);
            const icon = btn.querySelector("i");

            if (input.type === "password") {
                input.type = "text";
                icon.className = "fa-regular fa-eye-slash";
            } else {
                input.type = "password";
                icon.className = "fa-regular fa-eye";
            }
        });
    });
}

// Password strength calculator
function setupPasswordStrength() {
    regPasswordInput.addEventListener("input", () => {
        const val = regPasswordInput.value;
        if (!val) {
            strengthBarFill.style.width = "0%";
            strengthBarFill.style.backgroundColor = "transparent";
            strengthLabel.textContent = "Enter password";
            strengthLabel.style.color = "var(--text-muted)";
            return;
        }

        let score = 0;
        if (val.length >= 6) score++;
        if (val.length >= 10) score++;
        if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;

        if (score <= 2) {
            strengthBarFill.style.width = "30%";
            strengthBarFill.style.backgroundColor = "var(--rose)";
            strengthLabel.textContent = "Weak";
            strengthLabel.style.color = "var(--rose)";
        } else if (score <= 4) {
            strengthBarFill.style.width = "65%";
            strengthBarFill.style.backgroundColor = "var(--amber)";
            strengthLabel.textContent = "Medium";
            strengthLabel.style.color = "var(--amber)";
        } else {
            strengthBarFill.style.width = "100%";
            strengthBarFill.style.backgroundColor = "var(--emerald)";
            strengthLabel.textContent = "Strong";
            strengthLabel.style.color = "var(--emerald)";
        }
    });
}

// ==========================================================================
// 2. Check Local MongoDB Connection Status
// ==========================================================================
async function checkDatabaseStatus() {
    try {
        const res = await fetch(`${API_BASE}/status`);
        const data = await res.json();

        if (data.connected) {
            dbStatusPill.className = "status-pill connected";
            dbStatusText.textContent = "MongoDB Compass Connected";
        } else {
            dbStatusPill.className = "status-pill error";
            dbStatusText.textContent = "MongoDB Disconnected";
        }
    } catch (err) {
        dbStatusPill.className = "status-pill error";
        dbStatusText.textContent = "Server Offline";
    }
}

// ==========================================================================
// 3. User Registration Flow (Stores directly in MongoDB Compass)
// ==========================================================================
registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const confirmPassword = document.getElementById("regConfirmPassword").value;

    if (!name || !email || !password) {
        showToast("Please fill in all registration fields", "error");
        return;
    }

    if (password !== confirmPassword) {
        showToast("Passwords do not match. Please check again.", "error");
        return;
    }

    if (password.length < 6) {
        showToast("Password must be at least 6 characters long", "error");
        return;
    }

    setButtonLoading(registerBtn, true, "Storing in Compass...");

    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Registration failed");
        }

        showToast("Account successfully registered & saved in MongoDB Compass!", "success");

        // Clear registration form
        registerForm.reset();
        setupPasswordStrength();

        // Refresh output list immediately so new user appears in live table
        await loadCompassUsers();

        // Pre-fill login email and switch to login tab
        document.getElementById("loginEmail").value = email;
        document.getElementById("loginPassword").focus();
        switchTab("login");

        // Smooth scroll down to output table to showcase the stored record!
        outputCardSection.scrollIntoView({ behavior: "smooth" });

    } catch (err) {
        showToast(err.message, "error");
    } finally {
        setButtonLoading(registerBtn, false, "Register to MongoDB");
    }
});

// ==========================================================================
// 4. User Login Flow
// ==========================================================================
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
        showToast("Please enter both email and password", "error");
        return;
    }

    setButtonLoading(loginBtn, true, "Authenticating...");

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Login failed");
        }

        showToast(`Welcome back, ${data.user.name}!`, "success");

        // Save session if remember me is checked or default
        localStorage.setItem("authUser", JSON.stringify(data.user));
        localStorage.setItem("authToken", data.token);

        displayDashboard(data.user);

    } catch (err) {
        showToast(err.message, "error");
    } finally {
        setButtonLoading(loginBtn, false, "Sign In");
    }
});

// Display User Dashboard
function displayDashboard(user) {
    dashboardUserName.textContent = user.name || "Authenticated User";
    dashboardUserEmail.textContent = user.email;
    userAvatar.textContent = (user.name ? user.name[0] : "U").toUpperCase();
    
    if (user.createdAt) {
        const date = new Date(user.createdAt);
        dashboardJoinDate.textContent = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }

    authSection.classList.add("hidden");
    dashboardSection.classList.remove("hidden");
}

// Logout
logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("authUser");
    localStorage.removeItem("authToken");
    dashboardSection.classList.add("hidden");
    authSection.classList.remove("hidden");
    showToast("Signed out successfully", "info");
});

function checkSavedSession() {
    const saved = localStorage.getItem("authUser");
    if (saved) {
        try {
            const user = JSON.parse(saved);
            displayDashboard(user);
        } catch (e) {
            localStorage.clear();
        }
    }
}

// ==========================================================================
// 5. MongoDB Compass Output & Records Management
// ==========================================================================
async function loadCompassUsers() {
    const icon = refreshUsersBtn.querySelector("i");
    if (icon) icon.classList.add("fa-spin");

    try {
        const res = await fetch(`${API_BASE}/users`);
        const data = await res.json();

        if (data.success && Array.isArray(data.users)) {
            cachedUsers = data.users;
            renderUsersTable(cachedUsers);
            userCountBadge.textContent = cachedUsers.length;
            totalCountDisplay.textContent = cachedUsers.length;
        }
    } catch (err) {
        console.error("Failed to load Compass users:", err);
    } finally {
        if (icon) icon.classList.remove("fa-spin");
    }
}

refreshUsersBtn.addEventListener("click", () => {
    loadCompassUsers();
    checkDatabaseStatus();
    showToast("Data refreshed from MongoDB Compass", "info");
});

// Render table
function renderUsersTable(users) {
    usersTableBody.innerHTML = "";

    if (!users || users.length === 0) {
        usersTable.classList.add("hidden");
        emptyState.classList.remove("hidden");
        return;
    }

    usersTable.classList.remove("hidden");
    emptyState.classList.add("hidden");

    users.forEach((user, index) => {
        const tr = document.createElement("tr");

        const dateFormatted = user.createdAt 
            ? new Date(user.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })
            : "N/A";

        tr.innerHTML = `
            <td><strong>#${index + 1}</strong></td>
            <td><i class="fa-regular fa-user" style="color:var(--text-muted); margin-right:6px;"></i> ${escapeHtml(user.name)}</td>
            <td class="email-cell"><i class="fa-regular fa-envelope" style="margin-right:6px;"></i> ${escapeHtml(user.email)}</td>
            <td>
                <span class="hash-badge" title="Secure Bcrypt Hash stored in MongoDB Compass">
                    <i class="fa-solid fa-key" style="color:#a855f7;"></i>
                    <code>${escapeHtml(user.passwordHash || "••••••••••••")}</code>
                </span>
            </td>
            <td style="color:var(--text-secondary); font-size:12px;">${dateFormatted}</td>
            <td>
                <button class="btn-delete-user" data-id="${user.id}" title="Remove record from Compass">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </td>
        `;

        usersTableBody.appendChild(tr);
    });

    // Attach delete listeners
    document.querySelectorAll(".btn-delete-user").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            if (!confirm("Are you sure you want to remove this user document from MongoDB Compass?")) return;

            try {
                const res = await fetch(`${API_BASE}/users/${id}`, { method: "DELETE" });
                const result = await res.json();
                if (result.success) {
                    showToast(result.message, "success");
                    loadCompassUsers();
                } else {
                    showToast(result.message, "error");
                }
            } catch (e) {
                showToast("Failed to delete user: " + e.message, "error");
            }
        });
    });
}

// Search / Filter
searchUserInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (!term) {
        renderUsersTable(cachedUsers);
        return;
    }

    const filtered = cachedUsers.filter(u => 
        (u.name && u.name.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term))
    );
    renderUsersTable(filtered);
});

// Quick scroll to output drawer
openOutputDrawerBtn.addEventListener("click", () => {
    outputCardSection.scrollIntoView({ behavior: "smooth" });
});

dashViewDataBtn.addEventListener("click", () => {
    outputCardSection.scrollIntoView({ behavior: "smooth" });
});

forgotPasswordLink.addEventListener("click", (e) => {
    e.preventDefault();
    showToast("To reset, open MongoDB Compass -> auth_db -> users collection to manage credentials directly.", "info");
});

// ==========================================================================
// 6. Utility Functions
// ==========================================================================
function setButtonLoading(button, isLoading, text) {
    const btnText = button.querySelector(".btn-text");
    const arrow = button.querySelector(".btn-arrow");
    const spinner = button.querySelector(".spinner");

    button.disabled = isLoading;
    if (isLoading) {
        if (btnText) btnText.textContent = text;
        if (arrow) arrow.classList.add("hidden");
        if (spinner) spinner.classList.remove("hidden");
    } else {
        if (btnText) btnText.textContent = text;
        if (arrow) arrow.classList.remove("hidden");
        if (spinner) spinner.classList.add("hidden");
    }
}

function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    let icon = "fa-circle-info";
    if (type === "success") icon = "fa-circle-check";
    if (type === "error") icon = "fa-circle-xmark";

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(100%)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
