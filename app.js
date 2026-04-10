// ======================================
// CONFIGURATION
// ======================================
const PERMITTED_USERS = ['RJ', 'MJ', 'SB'];

// Important: When you create your Google Sheet, publish it to the web as a CSV.
// Paste that CSV link below. 
// For now, we will use a dummy URL. 
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSuqySYqh2V4BeVlM6A9xnn6jtMOFIQhecKYpYOuTkRQ0e3Qu14X_8YIHSZhQqQbbdrxnlDOot1rh6x/pub?output=csv'; 

// If the CSV URL is empty (like above) or fails to load, it will use these default fallback templates.
// You must have 4 columns in your sheet: Category, Title, Template, Allowed Users
const FALLBACK_TEMPLATES = [
    ["Check-in", "Welcome Notice", "Hi [First Name], welcome to the property! Your room is ready. Let us know if you need anything.", "All"],
    ["Check-in", "Wifi Password", "Hi [First Name], the wifi network is 'GuestNet' and the password is 'Welcome123'.", "RJ, MJ"],
    ["Check-out", "Checkout Reminder", "Hi [First Name], just a friendly reminder that check-out is at 11am today. Safe travels!", "All"],
    ["General", "Management Info", "Hi [First Name], this is management. Please contact the front desk.", "RJ, SB"]
];

// ======================================
// STATE UI DOM ELEMENTS
// ======================================
let currentUser = null;
let templatesData = [];

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const passcodeInput = document.getElementById('passcode-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const userBadge = document.getElementById('user-badge');
const guestPhoneInput = document.getElementById('guest-phone');
const guestNameInput = document.getElementById('guest-name');
const templateCategoriesContainer = document.getElementById('template-categories');
const toast = document.getElementById('toast');
const loadingState = document.getElementById('loading-state');

// ======================================
// INITIALIZATION
// ======================================
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('templatesUser');
    if (savedUser && PERMITTED_USERS.includes(savedUser.toUpperCase())) {
        login(savedUser.toUpperCase());
    }

    // Format phone number
    guestPhoneInput.addEventListener('input', (e) => {
        let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/);
        e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
    });

    // Real-time update templates
    guestNameInput.addEventListener('input', renderTemplates);
});

// ======================================
// LOGIN LOGIC
// ======================================
loginBtn.addEventListener('click', attemptLogin);
passcodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') attemptLogin();
});

function attemptLogin() {
    const code = passcodeInput.value.trim().toUpperCase();
    if (PERMITTED_USERS.includes(code)) {
        loginError.classList.add('hide');
        login(code);
    } else {
        loginError.classList.remove('hide');
    }
}

function login(code) {
    currentUser = code;
    localStorage.setItem('templatesUser', code);
    userBadge.innerText = code;
    
    // Switch screens
    loginScreen.classList.add('hide');
    appScreen.classList.remove('hide');
    
    // Load Templates
    fetchTemplates();
}

logoutBtn.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('templatesUser');
    appScreen.classList.add('hide');
    loginScreen.classList.remove('hide');
    passcodeInput.value = '';
});

// ======================================
// TEMPLATE LOGIC
// ======================================
async function fetchTemplates() {
    templateCategoriesContainer.innerHTML = '';
    loadingState.classList.remove('hide');

    if (!GOOGLE_SHEET_CSV_URL) {
        // Use fallbacks
        setTimeout(() => {
            processTemplates(FALLBACK_TEMPLATES);
        }, 500); // simulate network delay
        return;
    }

    try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL);
        const csvText = await response.text();
        const rows = parseCSV(csvText);
        // Remove header row assuming it exists
        rows.shift();
        processTemplates(rows);
    } catch (e) {
        console.error("Failed to load CSV, using fallbacks:", e);
        processTemplates(FALLBACK_TEMPLATES);
    }
}

// Convert CSV arrays into JSON array 
function processTemplates(rows) {
    templatesData = [];
    
    rows.forEach(row => {
        if (row.length < 4) return; // Ignore malformed rows

        const category = row[0].trim();
        const title = row[1].trim();
        const template = row[2].trim();
        const allowed = row[3].trim().toUpperCase();

        // Check if user has access to this template
        // Matches if allowed list includes user, or allowed says "ALL", or is completely blank
        const allowedArr = allowed.split(/[\s,]+/).filter(Boolean); // handle spaces and commas
        let hasAccess = false;

        if (allowedArr.length === 0 || allowedArr.includes('ALL')) {
            hasAccess = true;
        } else if (allowedArr.includes(currentUser)) {
            hasAccess = true;
        }

        if (hasAccess && category && title && template) {
            templatesData.push({ category, title, template });
        }
    });

    loadingState.classList.add('hide');
    renderTemplates();
}

function renderTemplates() {
    // Current variables
    const guestName = guestNameInput.value.trim() || "[First Name]";

    // Group by category
    const grouped = {};
    templatesData.forEach(t => {
        if (!grouped[t.category]) grouped[t.category] = [];
        grouped[t.category].push(t);
    });

    templateCategoriesContainer.innerHTML = '';

    for (const [category, templates] of Object.entries(grouped)) {
        const catBlock = document.createElement('div');
        catBlock.className = 'category-block';
        
        const catTitle = document.createElement('h2');
        catTitle.className = 'category-title';
        catTitle.innerText = category;
        catBlock.appendChild(catTitle);

        templates.forEach(t => {
            const card = document.createElement('div');
            card.className = 'template-card';
            
            // Perform substitution 
            let bodyText = t.template.replace(/\[First Name\]/gi, guestName);
            
            card.innerHTML = `
                <h3>${t.title}</h3>
                <div class="template-preview">${bodyText}</div>
                <div class="action-row">
                    <button class="btn-copy">📋 Copy</button>
                    <button class="btn-send">💬 Send Text</button>
                </div>
            `;

            // Attach listeners
            const copyBtn = card.querySelector('.btn-copy');
            const sendBtn = card.querySelector('.btn-send');

            copyBtn.addEventListener('click', () => copyToClipboard(bodyText));
            sendBtn.addEventListener('click', () => sendNativeSMS(bodyText));

            catBlock.appendChild(card);
        });

        templateCategoriesContainer.appendChild(catBlock);
    }
}

function sendNativeSMS(bodyText) {
    const rawNumber = guestPhoneInput.value.replace(/\D/g, ''); // strip to numbers only
    const encodedBody = encodeURIComponent(bodyText);
    
    // Cross-platform compatible sms URL scheme
    // If you need a specific number, use 'sms:+1234567890?body=...' 
    // ?body= works best universally for prepopulating text on modern iOS and Android.
    let smsUrl = `sms:${rawNumber}?body=${encodedBody}`;
    
    window.location.href = smsUrl;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast();
    }).catch(err => {
        alert("Failed to copy text!");
    });
}

function showToast() {
    toast.classList.remove('hide');
    setTimeout(() => {
        toast.classList.add('hide');
    }, 2000);
}

// Helper: CSV Parser to handle commas inside quotes
function parseCSV(str) {
    const arr = [];
    let quote = false;
    let row=0, col=0;
    for (let c = 0; c < str.length; c++) {
        let cc = str[c], nc = str[c+1];
        arr[row] = arr[row] || [];
        arr[row][col] = arr[row][col] || '';
        if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }
        if (cc == '"') { quote = !quote; continue; }
        if (cc == ',' && !quote) { ++col; continue; }
        if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }
        if (cc == '\n' && !quote) { ++row; col = 0; continue; }
        if (cc == '\r' && !quote) { ++row; col = 0; continue; }
        arr[row][col] += cc;
    }
    return arr;
}
