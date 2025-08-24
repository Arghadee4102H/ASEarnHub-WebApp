// script.js
import { db } from './firebaseConfig.js';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Telegram Web App Initialization ---
let tg = window.Telegram.WebApp;
let userId = null;
let userUsername = null;
let userFirstName = null;
let userLastName = null;
let userProfileName = null;
let userPhotoUrl = null; 

tg.ready();
tg.expand(); // Expand the Mini App to full screen

// --- DOM Elements ---
const homeScreen = document.getElementById('home');
const adsTasksScreen = document.getElementById('ads-tasks');
const tgTasksScreen = document.getElementById('tg-tasks');
const referralsScreen = document.getElementById('referrals');
const withdrawScreen = document.getElementById('withdraw');
const profileScreen = document.getElementById('profile');
const navItems = document.querySelectorAll('.nav-item');
const toastContainer = document.getElementById('toast-container');

// Home Screen
const userAvatar = document.getElementById('user-avatar');
const profileNameDisplay = document.getElementById('profile-name');
const asPointsBalanceDisplay = document.getElementById('as-points-balance');
const streakIndicator = document.getElementById('streak-indicator');
const claimCheckinBtn = document.getElementById('claim-checkin-btn');
const checkinMessage = document.getElementById('checkin-message');
const todayAdsEarnings = document.getElementById('today-ads-earnings');
const todayTgEarnings = document.getElementById('today-tg-earnings');
const todayReferralEarnings = document.getElementById('today-referral-earnings');
const dailyGoalTarget = document.getElementById('daily-goal-target');
const dailyGoalProgressFill = document.getElementById('daily-goal-progress-fill');

// Ads Task Section
const adsDailyCompleted = document.getElementById('ads-daily-completed');
const adsHourlyCompleted = document.getElementById('ads-hourly-completed');
const adsLifetimeCompleted = document.getElementById('ads-lifetime-completed');
const startAdTaskBtn = document.getElementById('start-ad-task-btn');
const adTaskStatus = document.getElementById('ad-task-status');

// Telegram Tasks Section
const tgTaskList = document.getElementById('tg-task-list');
const tgTaskMessage = document.getElementById('tg-task-message');

// Referral Section
const referralCodeInput = document.getElementById('referral-code-input');
const copyReferralBtn = document.getElementById('copy-referral-btn');
const enterReferralCodeInput = document.getElementById('enter-referral-code');
const submitReferralCodeBtn = document.getElementById('submit-referral-code-btn');
const referralEntryMessage = document.getElementById('referral-entry-message');
const totalReferralsCount = document.getElementById('total-referrals-count');
const referredList = document.getElementById('referred-list');

// Withdraw Section
const binanceWithdrawOption = document.getElementById('binance-withdraw-option');
const binancePayIdInput = document.getElementById('binance-pay-id');
const requestBinanceWithdrawBtn = document.getElementById('request-binance-withdraw-btn');
const binanceWithdrawMsg = document.getElementById('binance-withdraw-msg');
const googlePlayWithdrawOption = document.getElementById('google-play-withdraw-option');
const googlePlayEmailInput = document.getElementById('google-play-email');
const requestGooglePlayWithdrawBtn = document.getElementById('request-google-play-withdraw-btn');
const googlePlayWithdrawMsg = document.getElementById('google-play-withdraw-msg');
const withdrawalHistoryList = document.getElementById('withdrawal-history-list');

// Profile Section
const profileTgUsername = document.getElementById('profile-tg-username');
const profileTgId = document.getElementById('profile-tg-id');
const profileFullName = document.getElementById('profile-full-name');
const profileJoinDate = document.getElementById('profile-join-date');
const profileCurrentBalance = document.getElementById('profile-current-balance');
const profileTotalEarned = document.getElementById('profile-total-earned');
const profileTotalTasks = document.getElementById('profile-total-tasks');
const profileCurrentStreak = document.getElementById('profile-current-streak');
const profileTotalReferrals = document.getElementById('profile-total-referrals');
const historyTabBtns = document.querySelectorAll('.history-tab-btn');
const tasksHistoryView = document.getElementById('tasks-history-view');
const withdrawalsHistoryView = document.getElementById('withdrawals-history-view');
const detailedTasksList = document.getElementById('detailed-tasks-list');
const detailedWithdrawalsList = document.getElementById('detailed-withdrawals-list');


// --- Global Variables ---
let currentUserData = null;
let currentBalance = 0;
const CHECKIN_POINTS = [1, 2, 4, 6, 10, 15, 20];
const AD_REWARD = 0.35;
const TG_TASK_REWARD = 1;
const REFERRER_REWARD = 20;
const REFERRED_REWARD = 5;
const BINANCE_WITHDRAW_POINTS = 320;
const GOOGLE_PLAY_WITHDRAW_POINTS = 210;
const BINANCE_USD_VALUE = 0.9;
const GOOGLE_PLAY_USD_VALUE = 0.5;

// --- Utility Functions ---

/**
 * Shows a toast notification.
 * @param {string} message - The message to display.
 * @param {'success'|'error'|'info'|'warning'} type - The type of toast.
 * @param {string} icon - Optional. An emoji or icon character.
 */
function showToast(message, type = 'info', icon = '') {
    const toast = document.createElement('div');
    toast.classList.add('toast', type);
    toast.innerHTML = `<span class="toast-icon">${icon}</span> ${message}`;
    toastContainer.appendChild(toast);

    // Remove toast after animation
    toast.addEventListener('animationend', (event) => {
        if (event.animationName === 'fadeOutToast') {
            toast.remove();
        }
    });
}

/**
 * Animates a number count up.
 * @param {HTMLElement} element - The DOM element to update.
 * @param {number} start - The starting number.
 * @param {number} end - The target number.
 * @param {number} duration - Animation duration in ms.
 */
function animateBalance(element, start, end, duration = 800) {
    let startTime = null;
    const easing = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // Ease-in-out quad

    function animate(currentTime) {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const easedProgress = easing(progress);
        const value = start + (end - start) * easedProgress;
        element.textContent = Math.floor(value).toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            element.textContent = end.toLocaleString(); // Ensure final value is exact
        }
    }
    requestAnimationFrame(animate);
}

/**
 * Adds a ripple effect to a clicked button.
 * @param {Event} event - The click event.
 */
function addRippleEffect(event) {
    const button = event.currentTarget;
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');

    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    button.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
}

// Attach ripple effect to all cta-buttons
document.querySelectorAll('.cta-button').forEach(button => {
    button.addEventListener('click', addRippleEffect);
});

// --- Telegram WebApp User Data Handling ---
async function registerOrLoginUser(initData, userData) {
    try {
        console.log("Attempting to register or login user...");
        
        // IMPORTANT: NEVER TRUST initData directly on client-side for critical operations.
        // Always send initData to your backend (Cloud Function) for validation and then process.
        // For this client-side example, we'll directly interact with Firestore but keep this warning.

        userId = userData.id.toString(); // Ensure userId is string
        userUsername = userData.username || `user_${userId}`;
        userFirstName = userData.first_name || '';
        userLastName = userData.last_name || '';
        userProfileName = (userFirstName + ' ' + userLastName).trim();
        if (!userProfileName) userProfileName = `Telegram User`; // Fallback for empty name
        userPhotoUrl = userData.photo_url || 'https://via.placeholder.com/60'; // Default placeholder

        const userRef = doc(db, 'users', userId);
        let userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // New user registration
            console.log("New user detected, creating document...");
            const newUserDoc = {
                telegramUsername: userUsername,
                telegramProfileName: userProfileName,
                profilePhotoUrl: userPhotoUrl,
                joinedAt: serverTimestamp(),
                currentBalanceAS: 0,
                totalEarnedAS: 0,
                totalTasksCompleted: 0,
                referralsCount: 0,
                streakDay: 0, // Will be 1 after first check-in
                lastCheckinAt: null,
                lastSeenAt: serverTimestamp(),
                flags: [],
                referredBy: null, // To be filled if a referral code is entered
                initialTasksCompleted: false,
                referralCode: `AS${userUsername.replace(/[^a-zA-Z0-9]/g, '')}`, // Generate code from username
                hourlyAdCount: 0,
                dailyAdCount: 0,
                lastAdTaskAt: null,
            };
            await setDoc(userRef, newUserDoc);
            userSnap = await getDoc(userRef); // Re-fetch to get serverTimestamp values
            currentUserData = userSnap.data(); // Ensure currentUserData is populated from Firestore
            showToast('Welcome to AS Earn Hub!', 'success', '👋');
            console.log("New user created:", currentUserData);
        } else {
            // Existing user login
            console.log("Existing user, updating document...");
            await updateDoc(userRef, {
                telegramUsername: userUsername, // Update on every session
                telegramProfileName: userProfileName,
                profilePhotoUrl: userPhotoUrl,
                lastSeenAt: serverTimestamp(),
            });
            userSnap = await getDoc(userRef); // Re-fetch updated data
            currentUserData = userSnap.data();
            showToast('Welcome back!', 'info', '👋');
            console.log("Existing user updated:", currentUserData);
        }

        currentBalance = currentUserData.currentBalanceAS;
        await renderUI(currentUserData); // Ensure initial UI render is awaited

    } catch (error) {
        console.error("Error registering/logging in user:", error);
        showToast('Failed to load user data. Please try again.', 'error', '😔');
        // Set profile to error state to visually indicate failure
        profileNameDisplay.textContent = "Error loading user";
        userAvatar.src = "https://via.placeholder.com/60?text=Error";
        asPointsBalanceDisplay.textContent = "0";
    }
}

async function fetchUserData() {
    if (!userId) {
        console.warn("User ID not available to fetch data.");
        showToast('User ID not found. Please refresh.', 'error', '😔');
        return;
    }
    try {
        console.log("Fetching user data for UI refresh...");
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            currentUserData = userSnap.data();
            currentBalance = currentUserData.currentBalanceAS;
            console.log("User data fetched:", currentUserData);
            await renderUI(currentUserData); // Await rendering
        } else {
            console.error("User data not found after initial load. This should not happen.");
            showToast('User data not found. Please contact support.', 'error', '😔');
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
        showToast('Error fetching user data.', 'error', '😔');
    }
}


// --- Render UI ---
async function renderUI(userData) {
    if (!userData) {
        console.warn("renderUI called with no user data.");
        return;
    }
    console.log("Rendering UI with data:", userData);

    userAvatar.src = userData.profilePhotoUrl;
    profileNameDisplay.textContent = userData.telegramProfileName;
    animateBalance(asPointsBalanceDisplay, 0, userData.currentBalanceAS);

    // Await all rendering functions to ensure they complete before proceeding
    await renderCheckinStreak(userData.streakDay, userData.lastCheckinAt);
    await renderEarningsSummary(userData);
    await renderAdsMetrics(userData);
    await renderTelegramTasks();
    await renderReferralSection(userData);
    await renderWithdrawSection(userData);
    await renderProfileSection(userData);

    // Update bottom nav
    const currentHash = window.location.hash || '#home';
    navItems.forEach(item => {
        if (item.getAttribute('href') === currentHash) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

async function renderCheckinStreak(currentStreak, lastCheckinAt) {
    streakIndicator.innerHTML = '';
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // UTC midnight
    const lastCheckinDate = lastCheckinAt ? new Date(lastCheckinAt.toDate()) : null;
    if (lastCheckinDate) lastCheckinDate.setUTCHours(0, 0, 0, 0);

    const isCheckedInToday = lastCheckinDate && lastCheckinDate.getTime() === today.getTime();
    let displayStreak = currentStreak;

    if (lastCheckinDate && (today.getTime() - lastCheckinDate.getTime()) > (24 * 60 * 60 * 1000)) {
        displayStreak = 0; // Missed a day
        checkinMessage.textContent = "Streak reset! Claim Day 1 again.";
        claimCheckinBtn.textContent = `CLAIM DAY 1`;
        claimCheckinBtn.disabled = false;
    } else if (isCheckedInToday) {
        checkinMessage.textContent = `You've checked in today! Come back tomorrow for Day ${currentStreak % 7 === 0 ? 1 : (currentStreak + 1)}`;
        claimCheckinBtn.textContent = `CHECKED IN`;
        claimCheckinBtn.disabled = true;
    } else {
        const dayToClaim = (currentStreak % 7 === 0) ? 1 : (currentStreak % 7) + 1; // If streak is 0, claim Day 1. If 7, claim Day 1 next.
        checkinMessage.textContent = `Claim your daily points! Day ${dayToClaim}`;
        claimCheckinBtn.textContent = `CLAIM DAY ${dayToClaim}`;
        claimCheckinBtn.disabled = false;
    }

    for (let i = 1; i <= 7; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('streak-day');
        dayDiv.textContent = i;
        if (i <= displayStreak) {
            dayDiv.classList.add('completed');
        }
        // Current day to highlight
        if (!isCheckedInToday && i === ((displayStreak % 7 === 0) ? 1 : (displayStreak % 7) + 1)) {
             dayDiv.classList.add('current');
        } else if (isCheckedInToday && i === (displayStreak % 7 === 0 ? 7 : displayStreak % 7)) { // Highlight actual day if checked in
            dayDiv.classList.add('current');
        }
        streakIndicator.appendChild(dayDiv);
    }
}

async function renderEarningsSummary(userData) {
    if (!userId) return;

    // Get today's UTC midnight for filtering
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    // In a real app, this would be a Cloud Function that aggregates daily earnings
    const tasksRef = collection(db, 'tasks');
    const q = query(tasksRef,
        where('userId', '==', userId),
        where('createdAt', '>=', today) // Filter by tasks created today UTC
    );
    const querySnapshot = await getDocs(q);

    let ads = 0, tg = 0, referrals = 0;
    querySnapshot.forEach(doc => {
        const task = doc.data();
        if (task.taskType === 'AD') ads += task.rewardPoints;
        if (task.taskType === 'TG_JOIN') tg += task.rewardPoints;
        // Referral CREDIT from user B to user A is logged under user A.
        if (task.taskType === 'REFERRAL_CREDIT' && task.meta.reason === 'Referred user completed initial tasks') referrals += task.rewardPoints;
        // User B's initial 5 points should also be counted for their own total earnings
        if (task.taskType === 'REFERRAL_CREDIT' && task.meta.reason === 'Referred by') referrals += task.rewardPoints;
    });

    todayAdsEarnings.textContent = ads.toFixed(2);
    todayTgEarnings.textContent = tg.toFixed(2);
    todayReferralEarnings.textContent = referrals.toFixed(2);

    const totalToday = ads + tg + referrals;
    const dailyGoal = 50; // Example daily goal
    dailyGoalTarget.textContent = dailyGoal;
    const progress = Math.min((totalToday / dailyGoal) * 100, 100);
    dailyGoalProgressFill.style.width = `${progress}%`;
}

async function renderAdsMetrics(userData) {
    adsDailyCompleted.textContent = userData.dailyAdCount || 0;
    adsHourlyCompleted.textContent = userData.hourlyAdCount || 0;

    const q = query(collection(db, 'tasks'),
        where('userId', '==', userId),
        where('taskType', '==', 'AD'),
        where('status', '==', 'COMPLETED')
    );
    const snapshot = await getDocs(q);
    adsLifetimeCompleted.textContent = snapshot.size;

    // Check rate limits
    if ((userData.dailyAdCount || 0) >= 120) {
        startAdTaskBtn.disabled = true;
        adTaskStatus.textContent = "Daily ad limit reached. Come back tomorrow!";
    } else if ((userData.hourlyAdCount || 0) >= 15) {
        startAdTaskBtn.disabled = true;
        adTaskStatus.textContent = "Hourly ad limit reached. Try again soon!";
    } else {
        startAdTaskBtn.disabled = false;
        adTaskStatus.textContent = "";
    }
}

async function renderTelegramTasks() {
    const taskItems = tgTaskList.querySelectorAll('.tg-task-item');
    for (const item of taskItems) {
        const taskId = item.dataset.taskId;
        const link = item.dataset.link;
        const joinBtn = item.querySelector('.join-btn');
        const taskStatusSpan = item.querySelector('.task-status');

        // Check if task is already completed by user
        const q = query(collection(db, 'tasks'),
            where('userId', '==', userId),
            where('taskType', '==', 'TG_JOIN'),
            where('reference', '==', link),
            where('status', '==', 'COMPLETED')
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            item.classList.remove('completed');
            joinBtn.style.display = 'inline-block';
            taskStatusSpan.textContent = '';
        } else {
            item.classList.add('completed');
            joinBtn.style.display = 'none';
            taskStatusSpan.innerHTML = '✅'; // Swooping checkmark
        }
    }
    tgTaskMessage.textContent = "Click 'Join' to complete tasks.";
}

async function renderReferralSection(userData) {
    referralCodeInput.value = userData.referralCode;
    totalReferralsCount.textContent = userData.referralsCount || 0;
    referredList.innerHTML = '';

    // Fetch referred users for display
    const q = query(collection(db, 'users'), where('referredBy', '==', userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        referredList.innerHTML = '<li class="no-history-item">No one has used your referral code yet.</li>';
    } else {
        snapshot.forEach(doc => {
            const referredUser = doc.data();
            const li = document.createElement('li');
            li.innerHTML = `<span>${referredUser.telegramProfileName || referredUser.telegramUsername}</span> <span>${referredUser.initialTasksCompleted ? 'Rewarded' : 'Pending...'}</span>`;
            referredList.appendChild(li);
        });
    }

    // Disable referral code entry if already submitted
    if (userData.referredBy) {
        enterReferralCodeInput.disabled = true;
        submitReferralCodeBtn.disabled = true;
        referralEntryMessage.textContent = `You were referred by: ${userData.referredBy}. Cannot enter another code.`;
        referralEntryMessage.style.color = 'var(--text-color-accent)'; // Use CSS variable
    } else {
        enterReferralCodeInput.disabled = false;
        submitReferralCodeBtn.disabled = false;
        referralEntryMessage.textContent = `Enter a friend's referral code to get ${REFERRED_REWARD} AS points!`;
        referralEntryMessage.style.color = 'var(--text-color-medium)';
    }
}

async function renderWithdrawSection(userData) {
    // Enable/disable withdraw buttons based on balance
    requestBinanceWithdrawBtn.disabled = userData.currentBalanceAS < BINANCE_WITHDRAW_POINTS;
    requestGooglePlayWithdrawBtn.disabled = userData.currentBalanceAS < GOOGLE_PLAY_WITHDRAW_POINTS;

    // Apply glow if active
    if (!requestBinanceWithdrawBtn.disabled) {
        binanceWithdrawOption.classList.add('active-glow');
    } else {
        binanceWithdrawOption.classList.remove('active-glow');
        binanceWithdrawMsg.textContent = `Requires ${BINANCE_WITHDRAW_POINTS} AS points.`;
    }
    if (!requestGooglePlayWithdrawBtn.disabled) {
        googlePlayWithdrawOption.classList.add('active-glow');
    } else {
        googlePlayWithdrawOption.classList.remove('active-glow');
        googlePlayWithdrawMsg.textContent = `Requires ${GOOGLE_PLAY_WITHDRAW_POINTS} AS points.`;
    }

    // Render withdrawal history
    withdrawalHistoryList.innerHTML = '';
    const q = query(collection(db, 'withdrawals'), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        withdrawalHistoryList.innerHTML = '<li class="no-history-item">No withdrawal history.</li>';
    } else {
        const sortedWithdrawals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                                            .sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

        sortedWithdrawals.forEach(withdrawal => {
            const li = document.createElement('li');
            const date = withdrawal.createdAt ? new Date(withdrawal.createdAt.toDate()).toLocaleString() : 'N/A';
            li.innerHTML = `
                <span>Method: <strong>${withdrawal.method}</strong></span>
                <span>Points: <strong>${withdrawal.amountASPoints} AS</strong></span>
                <span>Status: <strong class="status-${withdrawal.status.toLowerCase()}">${withdrawal.status}</strong></span>
                <span>Requested: ${date}</span>
                ${withdrawal.adminNote ? `<span>Admin Note: ${withdrawal.adminNote}</span>` : ''}
            `;
            withdrawalHistoryList.appendChild(li);
        });
    }
}

async function renderProfileSection(userData) {
    if (!userData) return;

    profileTgUsername.textContent = userData.telegramUsername;
    profileTgId.textContent = userId;
    profileFullName.textContent = userData.telegramProfileName;
    profileJoinDate.textContent = userData.joinedAt ? new Date(userData.joinedAt.toDate()).toLocaleDateString() : 'N/A';
    profileCurrentBalance.textContent = userData.currentBalanceAS.toLocaleString();
    profileTotalEarned.textContent = userData.totalEarnedAS.toLocaleString();
    profileTotalTasks.textContent = userData.totalTasksCompleted.toLocaleString();
    profileCurrentStreak.textContent = userData.streakDay;
    profileTotalReferrals.textContent = userData.referralsCount;

    // Render detailed histories (tasks and withdrawals)
    await renderDetailedTasksHistory();
    await renderDetailedWithdrawalsHistory();
}

async function renderDetailedTasksHistory() {
    detailedTasksList.innerHTML = '';
    const q = query(collection(db, 'tasks'), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        detailedTasksList.innerHTML = '<li class="no-history-item">No task history.</li>';
    } else {
        const sortedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                                    .sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

        sortedTasks.forEach(task => {
            const li = document.createElement('li');
            const date = task.createdAt ? new Date(task.createdAt.toDate()).toLocaleString() : 'N/A';
            li.innerHTML = `
                <strong>${task.taskType.replace('_', ' ')}: +${task.rewardPoints} AS</strong>
                <span>${task.reference ? `Ref: ${task.reference}` : ''}</span>
                <span>Status: ${task.status}</span>
                <span>Time: ${date}</span>
            `;
            detailedTasksList.appendChild(li);
        });
    }
}

async function renderDetailedWithdrawalsHistory() {
    detailedWithdrawalsList.innerHTML = '';
    const q = query(collection(db, 'withdrawals'), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        detailedWithdrawalsList.innerHTML = '<li class="no-history-item">No withdrawal history.</li>';
    } else {
        const sortedWithdrawals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                                            .sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

        sortedWithdrawals.forEach(withdrawal => {
            const li = document.createElement('li');
            const date = withdrawal.createdAt ? new Date(withdrawal.createdAt.toDate()).toLocaleString() : 'N/A';
            li.innerHTML = `
                <strong>${withdrawal.method} Withdrawal: -${withdrawal.amountASPoints} AS</strong>
                <span>Recipient: ${withdrawal.recipient}</span>
                <span>Status: <span class="status-${withdrawal.status.toLowerCase()}">${withdrawal.status}</span></span>
                <span>Requested: ${date}</span>
                ${withdrawal.updatedAt ? `<span>Last Update: ${new Date(withdrawal.updatedAt.toDate()).toLocaleString()}</span>` : ''}
                ${withdrawal.adminNote ? `<span>Admin Note: ${withdrawal.adminNote}</span>` : ''}
            `;
            detailedWithdrawalsList.appendChild(li);
        });
    }
}


// --- Event Listeners ---

// Navigation
navItems.forEach(item => {
    item.addEventListener('click', async (e) => { // Made async
        e.preventDefault();
        const targetScreenId = item.dataset.screen;
        
        try {
            // Remove active from all screens first, then add to the current one
            document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
            document.getElementById(targetScreenId).classList.add('active');

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            window.location.hash = targetScreenId; // Update URL hash

            await fetchUserData(); // Always refresh user data after screen change
        } catch (error) {
            console.error("Error navigating or rendering screen:", error);
            showToast('Navigation error. Please refresh.', 'error', '😞');
        }
    });
});

// Initial screen load based on hash
window.addEventListener('hashchange', async () => { // Made async
    const currentHash = window.location.hash.substring(1) || 'home';
    
    try {
        // Remove active from all screens first, then add to the current one
        document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
        document.getElementById(currentHash).classList.add('active');

        navItems.forEach(item => {
            if (item.dataset.screen === currentHash) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        await fetchUserData(); // Ensure data is fresh for the displayed screen
    } catch (error) {
        console.error("Error handling hashchange:", error);
        showToast('Page load error. Please refresh.', 'error', '😞');
    }
});


// Home - Daily Check-in
claimCheckinBtn.addEventListener('click', async () => {
    if (claimCheckinBtn.disabled || !currentUserData) return;

    try {
        claimCheckinBtn.disabled = true;
        // --- Call Cloud Function for secure check-in logic ---
        // For client-side simulation, we'll directly update Firestore for now.
        // Replace with actual Cloud Function call:
        // const response = await callCloudFunction('performCheckin', { userId });

        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) throw new Error("User data not found.");
        const userData = userSnap.data();

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const lastCheckinDate = userData.lastCheckinAt ? new Date(userData.lastCheckinAt.toDate()) : null;
        if (lastCheckinDate) lastCheckinDate.setUTCHours(0, 0, 0, 0);

        const isCheckedInToday = lastCheckinDate && lastCheckinDate.getTime() === today.getTime();
        if (isCheckedInToday) {
            showToast('You have already claimed your daily check-in!', 'warning', '🗓️');
            claimCheckinBtn.disabled = true;
            return;
        }

        let newStreakDay = (userData.streakDay || 0) + 1;
        let pointsEarned = 0;

        // Check if day was missed (more than 24 hours since last check-in, and not today)
        if (lastCheckinDate && (today.getTime() - lastCheckinDate.getTime()) > (24 * 60 * 60 * 1000)) {
            newStreakDay = 1; // Reset streak
            pointsEarned = CHECKIN_POINTS[0];
            showToast('Streak reset! Starting Day 1 again.', 'info', '🗓️');
        } else {
             // If streak is already 7, restart from Day 1 but for 7th day points
            if (newStreakDay > 7) {
                newStreakDay = 1;
            }
            pointsEarned = CHECKIN_POINTS[newStreakDay - 1];
        }


        const oldBalance = currentUserData.currentBalanceAS;
        const newBalance = oldBalance + pointsEarned;

        await updateDoc(userRef, {
            currentBalanceAS: newBalance,
            totalEarnedAS: currentUserData.totalEarnedAS + pointsEarned,
            streakDay: newStreakDay,
            lastCheckinAt: serverTimestamp(),
            totalTasksCompleted: (currentUserData.totalTasksCompleted || 0) + 1,
        });

        await addDoc(collection(db, 'tasks'), {
            userId: userId,
            taskType: 'CHECKIN',
            reference: `Day ${newStreakDay}`,
            rewardPoints: pointsEarned,
            status: 'COMPLETED',
            createdAt: serverTimestamp(),
            meta: {}
        });

        // Update UI
        currentUserData.currentBalanceAS = newBalance;
        currentUserData.totalEarnedAS += pointsEarned;
        currentUserData.streakDay = newStreakDay;
        currentUserData.lastCheckinAt = serverTimestamp();
        currentUserData.totalTasksCompleted += 1;

        animateBalance(asPointsBalanceDisplay, oldBalance, newBalance);
        await renderCheckinStreak(newStreakDay, currentUserData.lastCheckinAt); // Re-render with new data
        showToast(`+${pointsEarned} AS points for Day ${newStreakDay}!`, 'success', '💰');

        // Particle effect
        const particleOrigin = claimCheckinBtn.getBoundingClientRect();
        const balanceTarget = asPointsBalanceDisplay.getBoundingClientRect();
        for (let i = 0; i < 10; i++) {
            const particle = document.createElement('div');
            particle.classList.add('checkin-particle');
            Object.assign(particle.style, {
                position: 'absolute',
                left: `${particleOrigin.left + particleOrigin.width / 2}px`,
                top: `${particleOrigin.top + particleOrigin.height / 2}px`,
                width: '8px',
                height: '8px',
                background: 'var(--text-color-accent)',
                borderRadius: '50%',
                opacity: 0.8,
                pointerEvents: 'none',
                zIndex: 1000
            });
            document.body.appendChild(particle);

            const xOffset = balanceTarget.left + balanceTarget.width / 2 - (particleOrigin.left + particleOrigin.width / 2) + (Math.random() - 0.5) * 20;
            const yOffset = balanceTarget.top + balanceTarget.height / 2 - (particleOrigin.top + particleOrigin.height / 2) + (Math.random() - 0.5) * 20;

            particle.animate([
                { transform: 'translate(0,0) scale(1)', opacity: 1 },
                { transform: `translate(${xOffset}px, ${yOffset}px) scale(0)`, opacity: 0 }
            ], {
                duration: 800 + Math.random() * 400,
                easing: 'ease-out',
                fill: 'forwards',
                delay: Math.random() * 100
            }).onfinish = () => particle.remove();
        }

    } catch (error) {
        console.error("Error claiming check-in:", error);
        showToast('Failed to claim check-in. Try again later.', 'error', '😔');
    } finally {
        claimCheckinBtn.disabled = false;
    }
});


// Ads Task Section
startAdTaskBtn.addEventListener('click', async () => {
    if (startAdTaskBtn.disabled || !currentUserData) return;

    startAdTaskBtn.disabled = true;
    adTaskStatus.textContent = "Loading ad...";
    showToast('Loading ad...', 'info', '📺');

    try {
        // --- Monetag Rewarded Interstitial ---
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate ad loading delay
        const userSawAd = await show_9725833().then(() => true).catch(() => false); // Monetag's promise

        if (userSawAd) {
            // --- Call Cloud Function for secure ad completion logic ---
            // Replace with actual Cloud Function call:
            // const response = await callCloudFunction('completeAdTask', { userId, adId: 'monetag-rewarded-interstitial-9725833' });

            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) throw new Error("User data not found.");
            const userData = userSnap.data();

            const now = new Date();
            const lastAdTaskTime = userData.lastAdTaskAt ? userData.lastAdTaskAt.toDate() : new Date(0);

            // Reset hourly count if hour changed
            let hourlyCount = userData.hourlyAdCount || 0;
            if ((now.getTime() - lastAdTaskTime.getTime()) > (60 * 60 * 1000)) {
                hourlyCount = 0;
            }

            // Reset daily count if day changed (UTC)
            let dailyCount = userData.dailyAdCount || 0;
            const todayUTC = new Date();
            todayUTC.setUTCHours(0,0,0,0);
            const lastAdTaskDateUTC = lastAdTaskTime;
            lastAdTaskDateUTC.setUTCHours(0,0,0,0);
            if (todayUTC.getTime() !== lastAdTaskDateUTC.getTime()) {
                dailyCount = 0;
            }

            if (hourlyCount >= 15) {
                showToast('Hourly ad limit reached. Try again in the next hour.', 'warning', '⏳');
                adTaskStatus.textContent = "Hourly ad limit reached. Try again soon!";
                return;
            }
            if (dailyCount >= 120) {
                showToast('Daily ad limit reached. Come back tomorrow!', 'warning', '🗓️');
                adTaskStatus.textContent = "Daily ad limit reached. Come back tomorrow!";
                return;
            }

            const oldBalance = currentUserData.currentBalanceAS;
            const newBalance = oldBalance + AD_REWARD;

            await updateDoc(userRef, {
                currentBalanceAS: newBalance,
                totalEarnedAS: currentUserData.totalEarnedAS + AD_REWARD,
                totalTasksCompleted: (currentUserData.totalTasksCompleted || 0) + 1,
                hourlyAdCount: hourlyCount + 1,
                dailyAdCount: dailyCount + 1,
                lastAdTaskAt: serverTimestamp(),
            });

            await addDoc(collection(db, 'tasks'), {
                userId: userId,
                taskType: 'AD',
                reference: 'monetag-rewarded-interstitial-9725833',
                rewardPoints: AD_REWARD,
                status: 'COMPLETED',
                createdAt: serverTimestamp(),
                meta: { ad_zone: '9725833' }
            });

            currentUserData.currentBalanceAS = newBalance;
            currentUserData.totalEarnedAS += AD_REWARD;
            currentUserData.totalTasksCompleted += 1;
            currentUserData.hourlyAdCount = hourlyCount + 1;
            currentUserData.dailyAdCount = dailyCount + 1;
            currentUserData.lastAdTaskAt = serverTimestamp(); // Update local object

            animateBalance(asPointsBalanceDisplay, oldBalance, newBalance);
            showToast(`+${AD_REWARD} AS for watching ad!`, 'success', '✅');
            adTaskStatus.innerHTML = `Ad completed <span class="bounced-checkmark">✅</span>`;
            await renderAdsMetrics(currentUserData); // Re-render metrics
            await checkInitialTasksCompletion();

        } else {
            showToast('Ad was not completed.', 'error', '❌');
            adTaskStatus.textContent = "Ad not completed. Try again.";
        }

    } catch (error) {
        console.error("Error completing ad task:", error);
        showToast('Failed to complete ad task. Try again later.', 'error', '😔');
    } finally {
        startAdTaskBtn.disabled = false;
    }
});


// Telegram Tasks Section
tgTaskList.addEventListener('click', async (event) => {
    const joinBtn = event.target.closest('.join-btn');
    if (!joinBtn) return;

    const listItem = joinBtn.closest('.tg-task-item');
    const taskId = listItem.dataset.taskId;
    const link = listItem.dataset.link;

    if (listItem.classList.contains('completed')) {
        showToast('Task already completed!', 'info', '✔️');
        return;
    }

    try {
        // Redirect user to Telegram link
        tg.openLink(link);
        showToast('Redirecting to Telegram. Please join and return here.', 'info', '✈️');

        // Simulating auto-verification after a delay (NOT SECURE FOR PRODUCTION)
        // In production, you would need a "Verify" button and a Cloud Function to check
        // user membership using the Telegram Bot API.
        setTimeout(async () => {
            // --- Call Cloud Function for secure TG join verification ---
            // const response = await callCloudFunction('verifyTelegramJoin', { userId, channelLink: link });

            // Client-side simulation of verification:
            const verificationSuccess = Math.random() > 0.1; // Simulate 90% success rate

            if (verificationSuccess) {
                const userRef = doc(db, 'users', userId);
                const oldBalance = currentUserData.currentBalanceAS;
                const newBalance = oldBalance + TG_TASK_REWARD;

                await updateDoc(userRef, {
                    currentBalanceAS: newBalance,
                    totalEarnedAS: currentUserData.totalEarnedAS + TG_TASK_REWARD,
                    totalTasksCompleted: (currentUserData.totalTasksCompleted || 0) + 1,
                });

                await addDoc(collection(db, 'tasks'), {
                    userId: userId,
                    taskType: 'TG_JOIN',
                    reference: link,
                    rewardPoints: TG_TASK_REWARD,
                    status: 'COMPLETED',
                    createdAt: serverTimestamp(),
                    meta: { taskId: taskId }
                });

                currentUserData.currentBalanceAS = newBalance;
                currentUserData.totalEarnedAS += TG_TASK_REWARD;
                currentUserData.totalTasksCompleted += 1;

                animateBalance(asPointsBalanceDisplay, oldBalance, newBalance);
                listItem.classList.add('completed');
                joinBtn.style.display = 'none';
                listItem.querySelector('.task-status').innerHTML = '<span class="bounced-checkmark">✅</span>';
                showToast(`+${TG_TASK_REWARD} AS for joining!`, 'success', '🎉');
                // Check if initial tasks completed for referral payout
                await checkInitialTasksCompletion();
            } else {
                showToast('Failed to verify Telegram join. Did you join the channel?', 'error', '😔');
            }
        }, 3000); // Wait 3 seconds for user to join
    } catch (error) {
        console.error("Error with Telegram task:", error);
        showToast('Could not open Telegram link.', 'error', '⚠️');
    }
});


// Referral System
copyReferralBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(referralCodeInput.value);
        copyReferralBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        copyReferralBtn.style.background = 'var(--success-color)';
        showToast('Referral code copied!', 'success', '📋');
        setTimeout(() => {
            copyReferralBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
            copyReferralBtn.style.background = 'var(--secondary-gradient)';
        }, 2000);
    } catch (err) {
        console.error('Failed to copy text: ', err);
        showToast('Failed to copy code. Please copy manually.', 'error', '📋');
    }
});

submitReferralCodeBtn.addEventListener('click', async () => {
    const code = enterReferralCodeInput.value.trim();
    if (!code) {
        referralEntryMessage.textContent = 'Please enter a referral code.';
        referralEntryMessage.style.color = 'var(--error-color)';
        return;
    }
    if (currentUserData.referredBy) {
        referralEntryMessage.textContent = 'You have already used a referral code.';
        referralEntryMessage.style.color = 'var(--warning-color)';
        return;
    }
    if (code === currentUserData.referralCode) {
        referralEntryMessage.textContent = 'You cannot refer yourself!';
        referralEntryMessage.style.color = 'var(--error-color)';
        return;
    }

    try {
        submitReferralCodeBtn.disabled = true;
        referralEntryMessage.textContent = 'Submitting referral code...';
        referralEntryMessage.style.color = 'var(--text-color-medium)';

        // --- Call Cloud Function for secure referral processing ---
        // Replace with actual Cloud Function call:
        // const response = await callCloudFunction('applyReferralCode', { userId, referralCode: code });

        const referrerQuery = query(collection(db, 'users'), where('referralCode', '==', code));
        const referrerSnapshot = await getDocs(referrerQuery);

        if (referrerSnapshot.empty) {
            referralEntryMessage.textContent = 'Invalid referral code.';
            referralEntryMessage.style.color = 'var(--error-color)';
            return;
        }

        const referrerDoc = referrerSnapshot.docs[0];
        const referrerId = referrerDoc.id;
        const referrerData = referrerDoc.data();

        // Update current user
        const currentUserRef = doc(db, 'users', userId);
        const oldBalance = currentUserData.currentBalanceAS;
        const newBalance = oldBalance + REFERRED_REWARD;

        await updateDoc(currentUserRef, {
            referredBy: referrerId,
            currentBalanceAS: newBalance,
            totalEarnedAS: currentUserData.totalEarnedAS + REFERRED_REWARD,
        });

        // Update referrer's count (payout for referrer happens later)
        await updateDoc(doc(db, 'users', referrerId), {
            referralsCount: (referrerData.referralsCount || 0) + 1,
        });

        // Log referral for current user (the referred one)
        await addDoc(collection(db, 'tasks'), {
            userId: userId,
            taskType: 'REFERRAL_CREDIT',
            reference: referrerId,
            rewardPoints: REFERRED_REWARD,
            status: 'COMPLETED',
            createdAt: serverTimestamp(),
            meta: { reason: 'Referred by' }
        });

        showToast(`You received ${REFERRED_REWARD} AS points for using a referral code!`, 'success', '🎁');
        referralEntryMessage.textContent = `Referral code applied successfully! You got ${REFERRED_REWARD} AS.`;
        referralEntryMessage.style.color = 'var(--success-color)';

        currentUserData.referredBy = referrerId;
        currentUserData.currentBalanceAS = newBalance;
        currentUserData.totalEarnedAS += REFERRED_REWARD;

        animateBalance(asPointsBalanceDisplay, oldBalance, newBalance);
        await renderReferralSection(currentUserData); // Re-render to disable input

        // Now, trigger the check for referrer's payout (might be pending initial tasks)
        // This is crucial for the 20 points for the referrer
        await checkReferralPayout(referrerId, userId);

    } catch (error) {
        console.error("Error submitting referral code:", error);
        referralEntryMessage.textContent = 'Failed to submit referral code. Try again later.';
        referralEntryMessage.style.color = 'var(--error-color)';
    } finally {
        submitReferralCodeBtn.disabled = false;
    }
});

// Function to check if referred user completed initial tasks and award referrer
async function checkInitialTasksCompletion() {
    if (!userId || currentUserData.initialTasksCompleted) return;

    // Required tasks: All 4 Telegram tasks + at least 15 Ad tasks
    const requiredTelegramTasks = 4;
    const requiredAds = 15;

    const tgTasksQ = query(collection(db, 'tasks'),
        where('userId', '==', userId),
        where('taskType', '==', 'TG_JOIN'),
        where('status', '==', 'COMPLETED')
    );
    const tgTasksSnap = await getDocs(tgTasksQ);

    const adTasksQ = query(collection(db, 'tasks'),
        where('userId', '==', userId),
        where('taskType', '==', 'AD'),
        where('status', '==', 'COMPLETED')
    );
    const adTasksSnap = await getDocs(adTasksQ);

    if (tgTasksSnap.size >= requiredTelegramTasks && adTasksSnap.size >= requiredAds) {
        await updateDoc(doc(db, 'users', userId), {
            initialTasksCompleted: true
        });
        currentUserData.initialTasksCompleted = true;
        showToast('You completed your initial tasks, good job!', 'success', '🎉');

        // Now, if this user was referred, trigger payout for the referrer
        if (currentUserData.referredBy) {
            await checkReferralPayout(currentUserData.referredBy, userId);
        }
    }
}

async function checkReferralPayout(referrerId, referredId) {
    // This should ideally be a Cloud Function for security and atomicity
    const referrerRef = doc(db, 'users', referrerId);
    const referredRef = doc(db, 'users', referredId);

    const [referrerSnap, referredSnap] = await Promise.all([getDoc(referrerRef), getDoc(referredRef)]);

    if (referrerSnap.exists() && referredSnap.exists()) {
        const referredUserData = referredSnap.data();
        const referrerUserData = referrerSnap.data();

        // Check if referred user completed initial tasks AND referrer hasn't been paid for this specific referral yet
        if (referredUserData.initialTasksCompleted && !(referrerUserData.flags || []).includes('referral_paid_for_' + referredId)) {
            const oldReferrerBalance = referrerUserData.currentBalanceAS;
            const newReferrerBalance = oldReferrerBalance + REFERRER_REWARD;

            await updateDoc(referrerRef, {
                currentBalanceAS: newReferrerBalance,
                totalEarnedAS: referrerUserData.totalEarnedAS + REFERRER_REWARD,
                flags: [...(referrerUserData.flags || []), 'referral_paid_for_' + referredId] // Mark as paid
            });

            await addDoc(collection(db, 'tasks'), {
                userId: referrerId,
                taskType: 'REFERRAL_CREDIT',
                reference: referredId,
                rewardPoints: REFERRER_REWARD,
                status: 'COMPLETED',
                createdAt: serverTimestamp(),
                meta: { reason: 'Referred user completed initial tasks' }
            });

            // If the current user *is* the referrer, update their UI immediately
            if (userId === referrerId) {
                currentUserData.currentBalanceAS = newReferrerBalance;
                currentUserData.totalEarnedAS += REFERRER_REWARD;
                animateBalance(asPointsBalanceDisplay, oldReferrerBalance, newReferrerBalance);
                await renderReferralSection(currentUserData);
            }
            showToast(`Referral bonus of ${REFERRER_REWARD} AS sent to ${referrerUserData.telegramProfileName}!`, 'success', '🎁');

        }
    }
}


// Withdraw Section
requestBinanceWithdrawBtn.addEventListener('click', async () => {
    if (requestBinanceWithdrawBtn.disabled || !currentUserData) return;

    const binanceId = binancePayIdInput.value.trim();
    if (!binanceId) {
        binanceWithdrawMsg.textContent = 'Please enter your Binance Pay ID.';
        binanceWithdrawMsg.style.color = 'var(--error-color)';
        return;
    }
    // Basic format validation for Binance Pay ID (often starts with "B" and numbers, or is a longer number)
    if (!/^B?\d{8,30}$/.test(binanceId)) { // Allow B followed by numbers or just numbers
        binanceWithdrawMsg.textContent = 'Invalid Binance Pay ID format.';
        binanceWithdrawMsg.style.color = 'var(--error-color)';
        return;
    }

    try {
        requestBinanceWithdrawBtn.disabled = true;
        binanceWithdrawMsg.textContent = 'Submitting withdrawal request...';
        binanceWithdrawMsg.style.color = 'var(--text-color-medium)';

        // --- Call Cloud Function for secure withdrawal request ---
        // Replace with actual Cloud Function call:
        // const response = await callCloudFunction('submitWithdrawalRequest', {
        //     userId, method: 'BINANCE', amount: BINANCE_WITHDRAW_POINTS, recipient: binanceId, usdValue: BINANCE_USD_VALUE
        // });

        if (currentUserData.currentBalanceAS < BINANCE_WITHDRAW_POINTS) {
            binanceWithdrawMsg.textContent = 'Insufficient AS points.';
            binanceWithdrawMsg.style.color = 'var(--error-color)';
            return;
        }

        const userRef = doc(db, 'users', userId);
        const oldBalance = currentUserData.currentBalanceAS;
        const newBalance = oldBalance - BINANCE_WITHDRAW_POINTS;

        await updateDoc(userRef, {
            currentBalanceAS: newBalance,
        });

        await addDoc(collection(db, 'withdrawals'), {
            userId: userId,
            method: 'BINANCE',
            amountASPoints: BINANCE_WITHDRAW_POINTS,
            estUsdValue: BINANCE_USD_VALUE,
            recipient: binanceId,
            status: 'PENDING',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            adminNote: ''
        });

        currentUserData.currentBalanceAS = newBalance; // Update local data
        animateBalance(asPointsBalanceDisplay, oldBalance, newBalance);
        showToast('Binance withdrawal requested successfully! Pending admin review.', 'success', '💸');
        binanceWithdrawMsg.textContent = 'Request submitted! Check history for status.';
        binanceWithdrawMsg.style.color = 'var(--success-color)';
        binancePayIdInput.value = ''; // Clear input
        await renderWithdrawSection(currentUserData); // Re-render to update history and button state

    } catch (error) {
        console.error("Error requesting Binance withdrawal:", error);
        showToast('Failed to request Binance withdrawal. Try again later.', 'error', '😔');
        binanceWithdrawMsg.textContent = 'Failed to submit request.';
        binanceWithdrawMsg.style.color = 'var(--error-color)';
    } finally {
        requestBinanceWithdrawBtn.disabled = false;
    }
});

requestGooglePlayWithdrawBtn.addEventListener('click', async () => {
    if (requestGooglePlayWithdrawBtn.disabled || !currentUserData) return;

    const email = googlePlayEmailInput.value.trim();
    if (!email) {
        googlePlayWithdrawMsg.textContent = 'Please enter your email.';
        googlePlayWithdrawMsg.style.color = 'var(--error-color)';
        return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) { // Basic email regex
        googlePlayWithdrawMsg.textContent = 'Invalid email format.';
        googlePlayWithdrawMsg.style.color = 'var(--error-color)';
        return;
    }

    try {
        requestGooglePlayWithdrawBtn.disabled = true;
        googlePlayWithdrawMsg.textContent = 'Submitting withdrawal request...';
        googlePlayWithdrawMsg.style.color = 'var(--text-color-medium)';

        // --- Call Cloud Function for secure withdrawal request ---
        // Replace with actual Cloud Function call:
        // const response = await callCloudFunction('submitWithdrawalRequest', {
        //     userId, method: 'GOOGLE_PLAY', amount: GOOGLE_PLAY_WITHDRAW_POINTS, recipient: email, usdValue: GOOGLE_PLAY_USD_VALUE
        // });

        if (currentUserData.currentBalanceAS < GOOGLE_PLAY_WITHDRAW_POINTS) {
            googlePlayWithdrawMsg.textContent = 'Insufficient AS points.';
            googlePlayWithdrawMsg.style.color = 'var(--error-color)';
            return;
        }

        const userRef = doc(db, 'users', userId);
        const oldBalance = currentUserData.currentBalanceAS;
        const newBalance = oldBalance - GOOGLE_PLAY_WITHDRAW_POINTS;

        await updateDoc(userRef, {
            currentBalanceAS: newBalance,
        });

        await addDoc(collection(db, 'withdrawals'), {
            userId: userId,
            method: 'GOOGLE_PLAY',
            amountASPoints: GOOGLE_PLAY_WITHDRAW_POINTS,
            estUsdValue: GOOGLE_PLAY_USD_VALUE,
            recipient: email,
            status: 'PENDING',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            adminNote: ''
        });

        currentUserData.currentBalanceAS = newBalance; // Update local data
        animateBalance(asPointsBalanceDisplay, oldBalance, newBalance);
        showToast('Google Play withdrawal requested successfully! Pending admin review.', 'success', '💸');
        googlePlayWithdrawMsg.textContent = 'Request submitted! Check history for status.';
        googlePlayWithdrawMsg.style.color = 'var(--success-color)';
        googlePlayEmailInput.value = ''; // Clear input
        await renderWithdrawSection(currentUserData); // Re-render to update history and button state

    } catch (error) {
        console.error("Error requesting Google Play withdrawal:", error);
        showToast('Failed to request Google Play withdrawal. Try again later.', 'error', '😔');
        googlePlayWithdrawMsg.textContent = 'Failed to submit request.';
        googlePlayWithdrawMsg.style.color = 'var(--error-color)';
    } finally {
        requestGooglePlayWithdrawBtn.disabled = false;
    }
});


// Profile History Tabs
historyTabBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => { // Made async
        historyTabBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        const historyType = e.target.dataset.historyType; // Corrected dataset property name
        if (historyType === 'tasks') {
            tasksHistoryView.classList.add('active');
            withdrawalsHistoryView.classList.remove('active');
            await renderDetailedTasksHistory(); // Ensure fresh data
        } else {
            tasksHistoryView.classList.remove('active');
            withdrawalsHistoryView.classList.add('active');
            await renderDetailedWithdrawalsHistory(); // Ensure fresh data
        }
    });
});


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => { // Made async
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        console.log("Telegram WebApp data available. Initializing user...");
        await registerOrLoginUser(tg.initData, tg.initDataUnsafe.user);
    } else {
        // Fallback for testing outside Telegram (not recommended for production)
        console.warn("Telegram WebApp data not available. Using dummy user for testing.");
        const dummyUser = {
            id: '123456789',
            username: 'dummyuser',
            first_name: 'Test',
            last_name: 'User',
            photo_url: 'https://via.placeholder.com/60',
        };
        await registerOrLoginUser('dummy_init_data', dummyUser);
        showToast('Running in dummy mode. Please open in Telegram.', 'warning', '⚠️');
    }

    // Set initial active screen based on hash
    const initialHash = window.location.hash.substring(1) || 'home';
    
    // Ensure all screens are hidden initially, then activate the correct one
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(initialHash).classList.add('active');
    
    navItems.forEach(item => {
        if (item.dataset.screen === initialHash) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
});

// Helper for calling simulated Cloud Functions (replace with actual HTTP calls)
// In a real scenario, this would involve sending initData or an auth token
// to your Cloud Functions via fetch API.
async function callCloudFunction(functionName, data) {
    console.log(`Calling simulated Cloud Function: ${functionName} with data:`, data);
    // Replace with your actual Cloud Function endpoint URL
    const CLOUD_FUNCTIONS_BASE_URL = "YOUR_CLOUD_FUNCTIONS_BASE_URL"; // e.g. "https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net"
    if (CLOUD_FUNCTIONS_BASE_URL === "YOUR_CLOUD_FUNCTIONS_BASE_URL") {
        console.warn("Cloud Functions Base URL not set. Cannot make API calls.");
        showToast('Cloud Functions URL not set. Backend calls will fail.', 'error', '⚠️');
        throw new Error("Cloud Functions Base URL not configured.");
    }
    
    const response = await fetch(`${CLOUD_FUNCTIONS_BASE_URL}/${functionName}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tg.initData}` // IMPORTANT: Send initData for validation
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Cloud Function ${functionName} failed.`);
    }

    return response.json();
}