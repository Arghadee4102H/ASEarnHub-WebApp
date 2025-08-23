// script.js

// Firebase Initialization
let firebaseApp;
let db;
let usersCollection;
let tasksCollection;
let withdrawalsCollection;

try {
    firebaseApp = firebase.initializeApp(window.firebaseConfig);
    db = firebaseApp.firestore();
    usersCollection = db.collection('users');
    tasksCollection = db.collection('tasks');
    withdrawalsCollection = db.collection('withdrawals');
    console.log("Firebase initialized successfully.");
} catch (e) {
    console.error("Failed to initialize Firebase:", e);
    // Display a persistent error if Firebase itself fails to initialize
    document.getElementById('loader').innerHTML = `
        <p style="color:red; text-align:center;">
            Critical Error: Firebase failed to initialize. <br>
            Please check your firebaseConfig.js and internet connection. <br>
            Error: ${e.message}
        </p>
        <button onclick="window.location.reload();" style="margin-top:20px; padding:10px 20px; border-radius:10px; border:none; background:#FF6B6B; color:white;">Reload App</button>
    `;
    throw e; // Stop script execution if Firebase is not ready
}


// Global variables for user data
let telegramUser = null;
let currentUserData = null;
let userTasks = [];
let userWithdrawals = [];
let dailyAdCount = 0;
let hourlyAdCount = 0;
let lastAdHour = new Date().getUTCHours();
let todayEarnings = { ads: 0, tgTasks: 0, referrals: 0 };

// Telegram WebApp Initialization
Telegram.WebApp.ready();
Telegram.WebApp.expand();
Telegram.WebApp.setBackgroundColor('#1a2a6c'); // Set a matching background color
Telegram.WebApp.setHeaderColor('#1a2a6c');
console.log("Telegram WebApp ready and expanded.");


// Utility Functions
function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.warn("Toast container not found. Cannot show toast:", message);
        return;
    }
    const toast = document.createElement('div');
    toast.classList.add('toast', type);

    let icon = '';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else if (type === 'warning') icon = '⚠️';
    else icon = 'ℹ️';

    toast.innerHTML = `<span class="toast-icon">${icon}</span> ${message}`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}

// UI Elements
const loaderScreen = document.getElementById('loader');
const screens = document.querySelectorAll('.screen');
const navItems = document.querySelectorAll('.nav-item');
const asPointsBalanceSpan = document.getElementById('as-points-balance');
const userAvatarImg = document.getElementById('user-avatar');
const profileNameH2 = document.getElementById('profile-name');

// --- Core App Logic ---

async function initializeApp() {
    console.log("initializeApp: Starting...");
    if (loaderScreen) loaderScreen.classList.remove('hidden'); // Ensure loader is visible

    const initData = Telegram.WebApp.initData || '';
    const initDataUnsafe = Telegram.WebApp.initDataUnsafe;

    if (initDataUnsafe && initDataUnsafe.user) {
        telegramUser = initDataUnsafe.user;
        console.log("initializeApp: Telegram User Data captured.", telegramUser);
    } else {
        telegramUser = {
            id: 'test_user_12345',
            username: 'testuser',
            first_name: 'Test',
            last_name: 'User',
            photo_url: 'https://via.placeholder.com/60/0072FF/FFFFFF?text=TU'
        };
        console.warn("initializeApp: Using test user data. Connect via Telegram for full features.");
        showToast("Using test user data. Connect via Telegram for full features.", "warning");
    }

    if (!telegramUser || !telegramUser.id) {
        console.error("initializeApp: Failed to retrieve Telegram user data after fallback. Cannot proceed.");
        showToast("Failed to retrieve Telegram user data. Please try again from Telegram.", "error");
        if (loaderScreen) {
             loaderScreen.innerHTML = `
                <p style="color:red; text-align:center;">
                    Could not get Telegram user info. <br>
                    Please try refreshing the Mini App from Telegram.
                </p>
                <button onclick="window.location.reload();" style="margin-top:20px; padding:10px 20px; border-radius:10px; border:none; background:#FF6B6B; color:white;">Refresh</button>
            `;
        }
        return; // Stop execution if critical user data is missing
    }

    try {
        console.log("initializeApp: Fetching or creating user...");
        await fetchOrCreateUser(telegramUser);
        console.log("initializeApp: User fetched/created successfully.");
        
        console.log("initializeApp: Loading user tasks...");
        await loadUserTasks();
        console.log("initializeApp: User tasks loaded.");

        console.log("initializeApp: Loading user withdrawals...");
        await loadUserWithdrawals();
        console.log("initializeApp: User withdrawals loaded.");

        console.log("initializeApp: Updating all UI elements...");
        updateAllUI();
        console.log("initializeApp: UI updated.");

        console.log("initializeApp: Hiding loader and setting app ready.");
        // A short delay to ensure UI renders before loader disappears smoothly
        setTimeout(() => {
            if (loaderScreen) loaderScreen.classList.add('hidden');
            // Telegram.WebApp.ready() is called at the very beginning of the script,
            // but we can ensure visual readiness here.
            Telegram.WebApp.ready(); // Confirm app readiness after full load
        }, 500); // Give a bit more time for content to paint

    } catch (error) {
        console.error("initializeApp: Critical error during app initialization:", error);
        showToast("Failed to load app data. Please refresh. Error: " + error.message, "error", 0); // Show persistent error
        if (loaderScreen) {
            loaderScreen.innerHTML = `
                <p style="color:red; text-align:center;">
                    Error loading AS Earn Hub: <br>${error.message}<br>
                    Please try refreshing the Telegram Mini App.
                </p>
                <button onclick="window.location.reload();" style="margin-top:20px; padding:10px 20px; border-radius:10px; border:none; background:#00C6FF; color:white;">Refresh</button>
            `;
        }
    }
}

async function fetchOrCreateUser(tgUser) {
    const userRef = usersCollection.doc(String(tgUser.id));
    const doc = await userRef.get();

    if (!doc.exists) {
        console.log("User not found, creating new user...");
        currentUserData = {
            user_id: String(tgUser.id),
            telegram_username: tgUser.username || null,
            telegram_profile_name: `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim(),
            profile_photo_url: tgUser.photo_url || `https://ui-avatars.com/api/?name=${tgUser.first_name}+${tgUser.last_name}&background=0D8ABC&color=fff`,
            joined_at: firebase.firestore.FieldValue.serverTimestamp(),
            current_balance_as: 0,
            total_earned_as: 0,
            total_tasks_completed: 0,
            referrals_count: 0,
            streak_day: 0,
            last_checkin_at: null,
            last_seen_at: firebase.firestore.FieldValue.serverTimestamp(),
            flags: {
                has_entered_referral: false
            }
        };
        await userRef.set(currentUserData);
        showToast("Welcome to AS Earn Hub!", "success");
        console.log("New user created in Firestore:", currentUserData.user_id);
    } else {
        currentUserData = doc.data();
        console.log("User data loaded:", currentUserData);

        // Update username/profile name on every session
        if (currentUserData.telegram_username !== tgUser.username || currentUserData.telegram_profile_name !== `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim()) {
            console.log("Updating user profile info...");
            await userRef.update({
                telegram_username: tgUser.username || null,
                telegram_profile_name: `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim(),
                profile_photo_url: tgUser.photo_url || `https://ui-avatars.com/api/?name=${tgUser.first_name}+${tgUser.last_name}&background=0D8ABC&color=fff`,
                last_seen_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            // Update local data to reflect changes
            currentUserData.telegram_username = tgUser.username || null;
            currentUserData.telegram_profile_name = `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim();
            currentUserData.profile_photo_url = tgUser.photo_url || `https://ui-avatars.com/api/?name=${tgUser.first_name}+${tgUser.last_name}&background=0D8ABC&color=fff`;
            console.log("User profile info updated.");
        }
    }

    // Set referral code for the user based on their username
    const usernamePart = tgUser.username ? tgUser.username.replace(/[^a-zA-Z0-9]/g, '') : String(tgUser.id);
    document.getElementById('my-referral-code').value = `AS${usernamePart}`;
}

async function loadUserTasks() {
    const snapshot = await tasksCollection.where('user_id', '==', currentUserData.user_id).orderBy('created_at', 'desc').get();
    userTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calculate today's earnings
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Start of UTC day

    todayEarnings = { ads: 0, tgTasks: 0, referrals: 0 };
    dailyAdCount = 0;
    hourlyAdCount = 0;
    const currentHour = new Date().getUTCHours();

    userTasks.forEach(task => {
        if (task.status === 'COMPLETED' && task.created_at) {
            const taskDate = task.created_at.toDate();
            if (taskDate >= today) { // Check if task was completed today (UTC)
                if (task.task_type === 'AD') {
                    todayEarnings.ads += task.reward_points;
                    dailyAdCount++;
                    // Check hourly count
                    if (taskDate.getUTCHours() === currentHour) {
                         hourlyAdCount++;
                    }
                } else if (task.task_type === 'TG_JOIN') {
                    todayEarnings.tgTasks += task.reward_points;
                } else if (task.task_type === 'REFERRAL_EARNED') { // Only count points earned by referrer, not the 5 points received
                    todayEarnings.referrals += task.reward_points;
                } else if (task.task_type === 'CHECKIN') {
                    // Check-in points are not part of "today's earnings" summary as they are distinct
                }
            }
        }
    });

    lastAdHour = currentHour; // Update last hour for rate limiting
}

async function loadUserWithdrawals() {
    const snapshot = await withdrawalsCollection.where('user_id', '==', currentUserData.user_id).orderBy('created_at', 'desc').get();
    userWithdrawals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- UI Update Functions ---

function updateAllUI() {
    if (!currentUserData) return;

    // Home Screen
    userAvatarImg.src = currentUserData.profile_photo_url;
    profileNameH2.textContent = currentUserData.telegram_profile_name;
    animateBalance(document.getElementById('as-points-balance'), currentUserData.current_balance_as);
    updateCheckinStreakUI();
    document.getElementById('today-ads-earnings').textContent = todayEarnings.ads.toFixed(2);
    document.getElementById('today-tg-tasks-earnings').textContent = todayEarnings.tgTasks.toFixed(2);
    document.getElementById('today-referrals-earnings').textContent = todayEarnings.referrals.toFixed(2);

    // Ads Task Section
    document.getElementById('ads-daily-count').textContent = dailyAdCount;
    document.getElementById('ads-hourly-count').textContent = hourlyAdCount;
    const lifetimeAds = userTasks.filter(t => t.task_type === 'AD' && t.status === 'COMPLETED').length;
    document.getElementById('ads-lifetime-count').textContent = lifetimeAds;
    updateAdsTaskButtonState();

    // Telegram Tasks Section
    updateTelegramTasksUI();

    // Referral Section
    document.getElementById('total-referrals-count').textContent = currentUserData.referrals_count;
    updateReferralListUI();
    document.getElementById('submit-referral-code-btn').disabled = currentUserData.flags.has_entered_referral;
    document.getElementById('enter-referral-code').readOnly = currentUserData.flags.has_entered_referral;
    if (currentUserData.flags.has_entered_referral) {
        document.getElementById('referral-message').textContent = "You have already submitted a referral code.";
        document.getElementById('referral-message').classList.add('info');
    }

    // Withdraw Section
    document.getElementById('withdraw-current-balance').textContent = currentUserData.current_balance_as.toFixed(2);
    updateWithdrawButtons();
    updateWithdrawalHistoryUI();

    // Profile Section
    document.getElementById('profile-avatar-large').src = currentUserData.profile_photo_url;
    document.getElementById('profile-username').textContent = currentUserData.telegram_username || 'N/A';
    document.getElementById('profile-full-name').textContent = currentUserData.telegram_profile_name;
    document.getElementById('profile-user-id').textContent = currentUserData.user_id;
    document.getElementById('profile-join-date').textContent = currentUserData.joined_at ? new Date(currentUserData.joined_at.toDate()).toLocaleDateString() : 'N/A';
    document.getElementById('profile-current-balance').textContent = currentUserData.current_balance_as.toFixed(2) + ' AS';
    document.getElementById('profile-total-earned').textContent = currentUserData.total_earned_as.toFixed(2) + ' AS';
    document.getElementById('profile-tasks-done').textContent = currentUserData.total_tasks_completed;
    document.getElementById('profile-current-streak').textContent = currentUserData.streak_day;
    document.getElementById('profile-total-referrals').textContent = currentUserData.referrals_count;
    updateProfileHistoryUI();
}

function animateBalance(element, targetValue) {
    const startValue = parseFloat(element.textContent) || 0;
    const duration = 800; // ms
    let startTime = null;

    function animate(currentTime) {
        if (!startTime) startTime = currentTime;
        const progress = (currentTime - startTime) / duration;
        const easedProgress = easeOutCubic(progress); // Apply easing function

        const currentValue = startValue + (targetValue - startValue) * easedProgress;
        element.textContent = currentValue.toFixed(2);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            element.textContent = targetValue.toFixed(2); // Ensure final value is exact
        }
    }
    requestAnimationFrame(animate);
}

function easeOutCubic(t) {
    return (--t) * t * t + 1;
}

function updateCheckinStreakUI() {
    const streakIndicator = document.getElementById('streak-indicator');
    streakIndicator.innerHTML = '';
    const currentDay = currentUserData.streak_day;
    const lastCheckin = currentUserData.last_checkin_at ? currentUserData.last_checkin_at.toDate() : null;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const checkinBtn = document.getElementById('claim-checkin-btn');
    let canClaimToday = true;
    let nextReward = 1;
    let nextDayToClaim = 1;

    if (lastCheckin) {
        const lastCheckinDay = new Date(lastCheckin);
        lastCheckinDay.setUTCHours(0, 0, 0, 0);

        if (lastCheckinDay.getTime() === today.getTime()) {
            canClaimToday = false; // Already claimed today
            nextDayToClaim = currentDay > 0 ? (currentDay % 7) + 1 : 1;
        } else {
            // Check if last checkin was yesterday
            const yesterday = new Date(today);
            yesterday.setUTCDate(today.getUTCDate() - 1);
            if (lastCheckinDay.getTime() === yesterday.getTime()) {
                nextDayToClaim = (currentDay % 7) + 1; // Continue streak
            } else {
                nextDayToClaim = 1; // Streak broken, reset
            }
        }
    }

    // Determine the reward for the next day
    switch (nextDayToClaim) {
        case 1: nextReward = 1; break;
        case 2: nextReward = 2; break;
        case 3: nextReward = 4; break;
        case 4: nextReward = 6; break;
        case 5: nextReward = 10; break;
        case 6: nextReward = 15; break;
        case 7: nextReward = 20; break;
    }

    for (let i = 1; i <= 7; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('streak-day');
        dayDiv.textContent = i;
        if (i < nextDayToClaim) {
            dayDiv.classList.add('completed');
        } else if (i === nextDayToClaim && canClaimToday) {
            dayDiv.classList.add('current');
        } else if (i === nextDayToClaim && !canClaimToday && currentDay === i) {
             dayDiv.classList.add('completed'); // Mark current day as completed if already claimed
        }

        streakIndicator.appendChild(dayDiv);
    }

    if (!canClaimToday) {
        checkinBtn.textContent = `Claimed Today! (Day ${currentDay})`;
        checkinBtn.classList.add('disabled');
        checkinBtn.disabled = true;
    } else {
        checkinBtn.textContent = `Claim Day ${nextDayToClaim} (${nextReward} AS)`;
        checkinBtn.classList.remove('disabled');
        checkinBtn.disabled = false;
    }
}

function updateAdsTaskButtonState() {
    const startButton = document.getElementById('start-ads-task-btn');
    startButton.classList.remove('disabled', 'pulsing-button');
    startButton.disabled = false;
    document.getElementById('ad-task-status').textContent = '';

    const currentHour = new Date().getUTCHours();
    if (currentHour !== lastAdHour) {
        hourlyAdCount = 0; // Reset hourly counter if hour changed
        lastAdHour = currentHour;
    }

    if (dailyAdCount >= 120) {
        startButton.classList.add('disabled');
        startButton.disabled = true;
        document.getElementById('ad-task-status').textContent = "Daily ad limit reached. Try again tomorrow (UTC).";
        document.getElementById('ad-task-status').classList.add('error');
    } else if (hourlyAdCount >= 15) {
        startButton.classList.add('disabled');
        startButton.disabled = true;
        document.getElementById('ad-task-status').textContent = "Hourly ad limit reached. Try again in the next hour (UTC).";
        document.getElementById('ad-task-status').classList.add('error');
    } else {
        startButton.classList.add('pulsing-button');
    }
}

function updateTelegramTasksUI() {
    const tgTaskList = document.getElementById('tg-task-list');
    tgTaskList.querySelectorAll('li').forEach(li => {
        const taskId = li.dataset.taskId;
        const link = li.querySelector('a').href;
        const button = li.querySelector('.join-tg-btn');
        const statusSpan = li.querySelector('.task-status');

        const completedTask = userTasks.find(task =>
            task.task_type === 'TG_JOIN' &&
            task.reference === link &&
            task.status === 'COMPLETED'
        );

        if (completedTask) {
            button.classList.add('completed');
            button.textContent = 'Verified ✅';
            button.disabled = true;
            statusSpan.classList.add('completed');
            statusSpan.innerHTML = '&#10004;'; // Checkmark symbol
        } else {
            button.classList.remove('completed');
            button.textContent = 'Verify & Claim';
            button.disabled = false;
            statusSpan.classList.remove('completed');
            statusSpan.textContent = '';
        }
    });
}

function updateReferralListUI() {
    const referralList = document.getElementById('referral-list');
    referralList.innerHTML = ''; // Clear existing list

    const successfulReferrals = userTasks.filter(task =>
        task.task_type === 'REFERRAL_EARNED' && task.user_id === currentUserData.user_id
    );

    if (successfulReferrals.length === 0) {
        referralList.innerHTML = '<li>No referrals yet. Share your code!</li>';
    } else {
        successfulReferrals.forEach(refTask => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<span>Referred: ${refTask.meta.referred_username || 'Unknown'}</span><span>+${refTask.reward_points} AS</span>`;
            referralList.appendChild(listItem);
        });
    }
}

function updateWithdrawButtons() {
    const binanceBtn = document.getElementById('request-binance-withdraw-btn');
    const googlePlayBtn = document.getElementById('request-google-play-withdraw-btn');

    const canWithdrawBinance = currentUserData.current_balance_as >= 320;
    const canWithdrawGooglePlay = currentUserData.current_balance_as >= 210;

    binanceBtn.classList.toggle('active', canWithdrawBinance);
    binanceBtn.disabled = !canWithdrawBinance;
    googlePlayBtn.classList.toggle('active', canWithdrawGooglePlay);
    googlePlayBtn.disabled = !canWithdrawGooglePlay;
}

function updateWithdrawalHistoryUI() {
    const withdrawHistoryList = document.getElementById('withdrawal-history-list');
    const profileWithdrawHistoryList = document.getElementById('profile-withdrawal-history-list');

    withdrawHistoryList.innerHTML = '';
    profileWithdrawHistoryList.innerHTML = '';

    if (userWithdrawals.length === 0) {
        withdrawHistoryList.innerHTML = '<li>No withdrawal requests yet.</li>';
        profileWithdrawHistoryList.innerHTML = '<li>No withdrawal requests yet.</li>';
        return;
    }

    userWithdrawals.forEach(withdrawal => {
        const listItem = document.createElement('li');
        let statusClass = '';
        let statusText = withdrawal.status;

        if (withdrawal.status === 'PENDING') {
            statusClass = 'withdrawal-status-pending';
            statusText = 'Pending ⏳';
        } else if (withdrawal.status === 'SUCCESSFUL') {
            statusClass = 'withdrawal-status-successful';
            statusText = 'Successful ✅';
        } else if (withdrawal.status === 'REJECTED') {
            statusClass = 'withdrawal-status-rejected';
            statusText = 'Rejected ❌';
        }

        listItem.innerHTML = `
            <div><strong>${withdrawal.method}</strong> - ${withdrawal.amount_as_points} AS (~$${withdrawal.est_usd_value.toFixed(2)})</div>
            <div class="${statusClass}">Status: ${statusText}</div>
            <small>${new Date(withdrawal.created_at.toDate()).toLocaleString()}</small>
        `;
        withdrawHistoryList.appendChild(listItem);

        const profileListItem = listItem.cloneNode(true);
        profileWithdrawHistoryList.appendChild(profileListItem);
    });
}

function updateProfileHistoryUI() {
    const profileTaskHistoryList = document.getElementById('profile-task-history-list');
    profileTaskHistoryList.innerHTML = '';

    if (userTasks.length === 0) {
        profileTaskHistoryList.innerHTML = '<li>No tasks completed yet.</li>';
        return;
    }

    userTasks.forEach(task => {
        const listItem = document.createElement('li');
        let taskDescription = '';
        let rewardDisplay = `+${task.reward_points} AS`;

        switch (task.task_type) {
            case 'AD':
                taskDescription = 'Completed Ad Task';
                break;
            case 'TG_JOIN':
                taskDescription = `Joined Telegram: ${task.reference.split('/').pop()}`;
                break;
            case 'CHECKIN':
                taskDescription = `Daily Check-in Day ${task.meta.day}`;
                break;
            case 'REFERRAL_EARNED': // When a referrer earns points
                taskDescription = `Referral Bonus (referred: ${task.meta.referred_username || 'Unknown'})`;
                break;
            case 'REFERRAL_RECEIVED': // When a new user receives points
                taskDescription = `Referral Join Bonus (referrer: ${task.meta.referrer_username || 'Unknown'})`;
                break;
            default:
                taskDescription = task.task_type;
        }

        const taskDate = task.created_at ? new Date(task.created_at.toDate()).toLocaleString() : 'N/A';
        listItem.innerHTML = `
            <div><strong>${taskDescription}</strong></div>
            <div>${rewardDisplay} <span class="${task.status === 'COMPLETED' ? 'withdrawal-status-successful' : 'withdrawal-status-pending'}">${task.status}</span></div>
            <small>${taskDate}</small>
        `;
        profileTaskHistoryList.appendChild(listItem);
    });
}

// --- Event Handlers ---

// Navigation
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetScreenId = item.dataset.screen;

        // Deactivate current screen and nav item
        document.querySelector('.screen.active')?.classList.remove('active');
        document.querySelector('.nav-item.active')?.classList.remove('active');

        // Activate new screen and nav item
        document.getElementById(targetScreenId).classList.add('active');
        item.classList.add('active');

        // Update UI for the activated screen if needed
        // Note: updateAllUI() covers most screens, but specific updates can be added here if a screen needs distinct refresh logic
        if (targetScreenId === 'home-screen') updateCheckinStreakUI();
        if (targetScreenId === 'ads-task-screen') updateAdsTaskButtonState();
        if (targetScreenId === 'tg-tasks-screen') updateTelegramTasksUI();
        if (targetScreenId === 'referral-screen') {
            updateReferralListUI();
            document.getElementById('total-referrals-count').textContent = currentUserData.referrals_count;
        }
        if (targetScreenId === 'withdraw-screen') {
            updateWithdrawButtons();
            updateWithdrawalHistoryUI();
        }
        if (targetScreenId === 'profile-screen') updateAllUI(); // Reload all profile data
    });
});

// Home Screen - Daily Check-in
document.getElementById('claim-checkin-btn')?.addEventListener('click', async () => {
    if (!currentUserData || document.getElementById('claim-checkin-btn').disabled) return;

    // Simulate backend check for streak and rewards
    let currentDay = currentUserData.streak_day;
    let lastCheckin = currentUserData.last_checkin_at ? currentUserData.last_checkin_at.toDate() : null;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let newStreakDay = 1; // Default to day 1
    if (lastCheckin) {
        const lastCheckinDay = new Date(lastCheckin);
        lastCheckinDay.setUTCHours(0, 0, 0, 0);

        if (lastCheckinDay.getTime() === today.getTime()) {
            showToast("You have already claimed your daily check-in for today!", "info");
            return; // Already claimed
        }

        const yesterday = new Date(today);
        yesterday.setUTCDate(today.getUTCDate() - 1);

        if (lastCheckinDay.getTime() === yesterday.getTime()) {
            // Streak continues
            newStreakDay = (currentDay % 7) + 1;
        }
        // else: streak broken, newStreakDay remains 1
    }

    const rewardPoints = [0, 1, 2, 4, 6, 10, 15, 20][newStreakDay]; // 0 is placeholder for index 0
    if (!rewardPoints) {
        showToast("Error calculating check-in reward.", "error");
        return;
    }

    document.getElementById('claim-checkin-btn').classList.add('disabled');
    document.getElementById('claim-checkin-btn').disabled = true;

    try {
        // Simulate adding to task table and updating user balance via backend/cloud function
        // For client-side, we directly update Firestore (less secure, but for demo)
        const userRef = usersCollection.doc(currentUserData.user_id);
        const batch = db.batch();

        const newBalance = currentUserData.current_balance_as + rewardPoints;
        const newTotalEarned = currentUserData.total_earned_as + rewardPoints;
        const newTotalTasks = currentUserData.total_tasks_completed + 1;

        batch.update(userRef, {
            current_balance_as: newBalance,
            total_earned_as: newTotalEarned,
            total_tasks_completed: newTotalTasks,
            streak_day: newStreakDay,
            last_checkin_at: firebase.firestore.FieldValue.serverTimestamp(),
            last_seen_at: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Add task record
        const taskRef = tasksCollection.doc();
        batch.set(taskRef, {
            user_id: currentUserData.user_id,
            task_type: 'CHECKIN',
            reference: `Day ${newStreakDay} Check-in`,
            reward_points: rewardPoints,
            status: 'COMPLETED',
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
            meta: {
                day: newStreakDay
            }
        });

        await batch.commit();

        currentUserData.current_balance_as = newBalance;
        currentUserData.total_earned_as = newTotalEarned;
        currentUserData.total_tasks_completed = newTotalTasks;
        currentUserData.streak_day = newStreakDay;
        currentUserData.last_checkin_at = new Date(); // Update locally for immediate UI refresh
        
        userTasks.unshift({ // Add to local tasks list for history update
            id: taskRef.id,
            user_id: currentUserData.user_id,
            task_type: 'CHECKIN',
            reference: `Day ${newStreakDay} Check-in`,
            reward_points: rewardPoints,
            status: 'COMPLETED',
            created_at: new Date(),
            meta: { day: newStreakDay }
        });


        animateBalance(asPointsBalanceSpan, newBalance);
        showToast(`+${rewardPoints} AS for Day ${newStreakDay} Check-in!`, "success");
        updateCheckinStreakUI();
        updateProfileHistoryUI(); // Update profile task history

    } catch (error) {
        console.error("Error claiming check-in:", error);
        showToast("Failed to claim check-in. Please try again.", "error");
        document.getElementById('claim-checkin-btn').classList.remove('disabled');
        document.getElementById('claim-checkin-btn').disabled = false;
    }
});

// Ads Task Section
document.getElementById('start-ads-task-btn')?.addEventListener('click', async () => {
    if (!currentUserData || document.getElementById('start-ads-task-btn').disabled) {
        showToast("Ad task currently unavailable due to limits or loading.", "info");
        return;
    }

    const currentHour = new Date().getUTCHours();
    // Re-check rate limits just before starting, as they might have changed
    if (dailyAdCount >= 120) {
        showToast("Daily ad limit reached. Try again tomorrow (UTC).", "error");
        updateAdsTaskButtonState();
        return;
    }
    if (hourlyAdCount >= 15 && currentHour === lastAdHour) {
        showToast("Hourly ad limit reached. Try again in the next hour (UTC).", "error");
        updateAdsTaskButtonState();
        return;
    }
    // If hour changed, reset hourly count
    if (currentHour !== lastAdHour) {
        hourlyAdCount = 0;
        lastAdHour = currentHour;
    }


    document.getElementById('ad-task-status').textContent = "Loading ad...";
    document.getElementById('start-ads-task-btn').classList.add('disabled');
    document.getElementById('start-ads-task-btn').disabled = true;


    try {
        // Monetag Rewarded interstitial code
        // Ensure 'show_9725833' is available globally from the SDK
        if (typeof show_9725833 === 'function') {
            await show_9725833().then(async () => {
                const reward = 0.35; // Fixed reward per ad
                
                // --- THIS SECTION SHOULD BE SECURED VIA A BACKEND CALLBACK FROM MONETAG ---
                // For client-side demonstration, we process directly.
                // In a real app, Monetag should notify your server, and your server awards points.
                
                const userRef = usersCollection.doc(currentUserData.user_id);
                const batch = db.batch();

                const newBalance = currentUserData.current_balance_as + reward;
                const newTotalEarned = currentUserData.total_earned_as + reward;
                const newTotalTasks = currentUserData.total_tasks_completed + 1;

                batch.update(userRef, {
                    current_balance_as: newBalance,
                    total_earned_as: newTotalEarned,
                    total_tasks_completed: newTotalTasks,
                    last_seen_at: firebase.firestore.FieldValue.serverTimestamp()
                });

                const taskRef = tasksCollection.doc();
                batch.set(taskRef, {
                    user_id: currentUserData.user_id,
                    task_type: 'AD',
                    reference: 'Monetag_Ad_9725833', // Placeholder, ideally specific ad ID
                    reward_points: reward,
                    status: 'COMPLETED',
                    created_at: firebase.firestore.FieldValue.serverTimestamp(),
                    meta: { ad_zone_id: '9725833' }
                });

                await batch.commit();

                currentUserData.current_balance_as = newBalance;
                currentUserData.total_earned_as = newTotalEarned;
                currentUserData.total_tasks_completed = newTotalTasks;
                
                // Update local counters for rate limiting
                dailyAdCount++;
                hourlyAdCount++;
                todayEarnings.ads += reward;

                userTasks.unshift({
                    id: taskRef.id,
                    user_id: currentUserData.user_id,
                    task_type: 'AD',
                    reference: 'Monetag_Ad_9725833',
                    reward_points: reward,
                    status: 'COMPLETED',
                    created_at: new Date(),
                    meta: { ad_zone_id: '9725833' }
                });
                
                animateBalance(asPointsBalanceSpan, newBalance);
                showToast(`+${reward.toFixed(2)} AS! Ad completed.`, "success");
                document.getElementById('ad-task-status').textContent = ""; // Clear status
                updateAllUI(); // Refresh all related UI elements
            });
        } else {
            console.error("Monetag SDK function 'show_9725833' not found or not a function.");
            showToast("Ad service not fully loaded. Please refresh.", "error");
            document.getElementById('ad-task-status').textContent = "Ad not loaded.";
        }
    } catch (error) {
        console.error("Error showing or completing ad:", error);
        showToast("Failed to complete ad. Please try again.", "error");
        document.getElementById('ad-task-status').textContent = "Failed to load/complete ad.";
    } finally {
        // Re-enable button regardless of success/failure after a short delay
        setTimeout(() => {
            updateAdsTaskButtonState();
        }, 1000); // Small delay to prevent rapid clicking
    }
});


// Telegram Tasks Section
document.querySelectorAll('.join-tg-btn')?.forEach(button => {
    button.addEventListener('click', async (e) => {
        if (!currentUserData || button.disabled) return;

        const link = e.target.dataset.link;
        const taskId = e.target.closest('li').dataset.taskId;
        const reward = 1;

        // Check if already completed (client-side check for UX, server should verify)
        const alreadyCompleted = userTasks.some(task =>
            task.task_type === 'TG_JOIN' &&
            task.reference === link &&
            task.status === 'COMPLETED'
        );

        if (alreadyCompleted) {
            showToast("You have already completed this task.", "info");
            return;
        }

        e.target.textContent = 'Verifying...';
        e.target.disabled = true;

        // Redirect user to Telegram link
        Telegram.WebApp.openTelegramLink(link);

        // --- IMPORTANT: REAL VERIFICATION REQUIRES A BACKEND ---
        // The following is a client-side simulation.
        // A real Telegram bot would check user membership in the channel/group.
        showToast("Redirecting to Telegram. Please join the channel/group. Verifying in 5 seconds...", "info", 5000);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Simulate delay for user to join

        // After user *supposedly* joins, simulate verification and reward
        try {
            // Assume successful verification for demo
            const userRef = usersCollection.doc(currentUserData.user_id);
            const batch = db.batch();

            const newBalance = currentUserData.current_balance_as + reward;
            const newTotalEarned = currentUserData.total_earned_as + reward;
            const newTotalTasks = currentUserData.total_tasks_completed + 1;

            batch.update(userRef, {
                current_balance_as: newBalance,
                total_earned_as: newTotalEarned,
                total_tasks_completed: newTotalTasks,
                last_seen_at: firebase.firestore.FieldValue.serverTimestamp()
            });

            const taskRef = tasksCollection.doc();
            batch.set(taskRef, {
                user_id: currentUserData.user_id,
                task_type: 'TG_JOIN',
                reference: link,
                reward_points: reward,
                status: 'COMPLETED',
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                meta: { channel_id: link.split('/').pop() }
            });

            await batch.commit();

            currentUserData.current_balance_as = newBalance;
            currentUserData.total_earned_as = newTotalEarned;
            currentUserData.total_tasks_completed = newTotalTasks;
            
            userTasks.unshift({
                id: taskRef.id,
                user_id: currentUserData.user_id,
                task_type: 'TG_JOIN',
                reference: link,
                reward_points: reward,
                status: 'COMPLETED',
                created_at: new Date(),
                meta: { channel_id: link.split('/').pop() }
            });

            todayEarnings.tgTasks += reward;

            animateBalance(asPointsBalanceSpan, newBalance);
            showToast(`+${reward} AS! Task completed.`, "success");
            updateAllUI(); // Refresh all related UI elements
        } catch (error) {
            console.error("Error completing TG task:", error);
            showToast("Failed to verify Telegram task. Please try again.", "error");
        } finally {
            e.target.textContent = 'Verify & Claim';
            e.target.disabled = false; // Re-enable if failed
            updateTelegramTasksUI(); // Update state correctly
        }
    });
});

// Referral System
document.getElementById('copy-referral-code-btn')?.addEventListener('click', async () => {
    const referralCodeField = document.getElementById('my-referral-code');
    try {
        await navigator.clipboard.writeText(referralCodeField.value);
        showToast("Referral code copied!", "success");
        referralCodeField.classList.add('glow');
        setTimeout(() => referralCodeField.classList.remove('glow'), 1000);
    } catch (err) {
        console.error('Failed to copy text:', err);
        showToast("Failed to copy code. Please copy manually.", "error");
    }
});

document.getElementById('submit-referral-code-btn')?.addEventListener('click', async () => {
    if (!currentUserData || currentUserData.flags.has_entered_referral) {
        showToast("You have already submitted a referral code.", "info");
        return;
    }

    const enteredCode = document.getElementById('enter-referral-code').value.trim();
    if (!enteredCode) {
        showToast("Please enter a referral code.", "error");
        return;
    }
    const myCode = document.getElementById('my-referral-code').value;
    if (enteredCode === myCode) {
        showToast("You cannot refer yourself!", "error");
        return;
    }

    // Extract referrer user ID from the code (e.g., ASUsername -> username -> fetch user ID)
    const referrerUsernamePart = enteredCode.startsWith('AS') ? enteredCode.substring(2) : null;
    if (!referrerUsernamePart) {
        showToast("Invalid referral code format.", "error");
        return;
    }

    let referrerUserData;
    try {
        // Find referrer by username part (this is fragile, should ideally use user_id in code)
        const referrerSnapshot = await usersCollection.where('telegram_username', '==', referrerUsernamePart).limit(1).get();
        if (referrerSnapshot.empty) {
            showToast("Referral code not found.", "error");
            return;
        }
        referrerUserData = referrerSnapshot.docs[0].data();

        // Check if this referrer has been successfully referred before
        const existingReferral = userTasks.find(task =>
            task.task_type === 'REFERRAL_RECEIVED' &&
            task.meta.referrer_user_id === referrerUserData.user_id &&
            task.status === 'COMPLETED'
        );

        if (existingReferral) {
            showToast("You have already been referred by this user.", "info");
            // Also mark 'has_entered_referral' as true if it's not
            if (!currentUserData.flags.has_entered_referral) {
                 await usersCollection.doc(currentUserData.user_id).update({ 'flags.has_entered_referral': true });
                 currentUserData.flags.has_entered_referral = true;
                 updateAllUI();
            }
            return;
        }

        // --- SECURE REFERRAL VERIFICATION (Requires Backend) ---
        // In a real application, a backend function would verify if the referred user
        // (currentUserData.user_id) has completed required initial tasks
        // (e.g., joined all TG channels AND/OR completed 15 verified ads).
        // For this client-side demo, we'll assume tasks are completed.

        // Simulate task completion check (very basic client-side check)
        const tgTasksCompleted = userTasks.filter(t => t.task_type === 'TG_JOIN' && t.status === 'COMPLETED').length;
        const adTasksCompleted = userTasks.filter(t => t.task_type === 'AD' && t.status === 'COMPLETED').length;

        const meetsReferralCriteria = (tgTasksCompleted >= 4 && adTasksCompleted >= 15); // Example: both criteria
        if (!meetsReferralCriteria) {
            showToast("You need to complete initial tasks (e.g., all TG joins & 15 ads) before referral credit can be processed.", "warning", 8000);
            return;
        }


        // Award points to referrer (20 AS) and referred (5 AS)
        const referrerPoints = 20;
        const referredPoints = 5;

        const batch = db.batch();

        // Update referrer's data
        const referrerRef = usersCollection.doc(referrerUserData.user_id);
        batch.update(referrerRef, {
            current_balance_as: firebase.firestore.FieldValue.increment(referrerPoints),
            total_earned_as: firebase.firestore.FieldValue.increment(referrerPoints),
            referrals_count: firebase.firestore.FieldValue.increment(1),
            last_seen_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Add task record for referrer
        batch.set(tasksCollection.doc(), {
            user_id: referrerUserData.user_id,
            task_type: 'REFERRAL_EARNED',
            reference: currentUserData.user_id,
            reward_points: referrerPoints,
            status: 'COMPLETED',
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
            meta: {
                referred_user_id: currentUserData.user_id,
                referred_username: currentUserData.telegram_username,
                referred_profile_name: currentUserData.telegram_profile_name
            }
        });


        // Update referred user's data (currentUser)
        const currentUserRef = usersCollection.doc(currentUserData.user_id);
        batch.update(currentUserRef, {
            current_balance_as: firebase.firestore.FieldValue.increment(referredPoints),
            total_earned_as: firebase.firestore.FieldValue.increment(referredPoints),
            'flags.has_entered_referral': true, // Mark as having entered a referral
            last_seen_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Add task record for referred user
        batch.set(tasksCollection.doc(), {
            user_id: currentUserData.user_id,
            task_type: 'REFERRAL_RECEIVED',
            reference: referrerUserData.user_id,
            reward_points: referredPoints,
            status: 'COMPLETED',
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
            meta: {
                referrer_user_id: referrerUserData.user_id,
                referrer_username: referrerUserData.telegram_username,
                referrer_profile_name: referrerUserData.telegram_profile_name
            }
        });

        await batch.commit();

        currentUserData.current_balance_as += referredPoints;
        currentUserData.total_earned_as += referredPoints;
        currentUserData.flags.has_entered_referral = true;

        todayEarnings.referrals += referredPoints;

        // Optionally, if referrer is also active in this session, update their UI too (complex)
        // For simplicity, we just update current user's UI.
        showToast(`You received +${referredPoints} AS! Referrer (${referrerUserData.telegram_username}) received +${referrerPoints} AS!`, "success", 6000);
        document.getElementById('referral-message').textContent = `Referral successful! You got +${referredPoints} AS.`;
        document.getElementById('referral-message').classList.add('success');
        updateAllUI(); // Refresh all related UI elements
        
        // Re-load referrer's tasks/data if they were the current user, or trigger a re-render
        await loadUserTasks(); // Reload tasks to include the new referral_received entry

    } catch (error) {
        console.error("Error submitting referral code:", error);
        showToast("Failed to submit referral code. " + error.message, "error");
        document.getElementById('referral-message').textContent = `Failed: ${error.message}`;
        document.getElementById('referral-message').classList.add('error');
    } finally {
        document.getElementById('submit-referral-code-btn').disabled = currentUserData.flags.has_entered_referral;
        document.getElementById('enter-referral-code').readOnly = currentUserData.flags.has_entered_referral;
    }
});


// Withdraw Section
document.getElementById('request-binance-withdraw-btn')?.addEventListener('click', async () => {
    if (!currentUserData || document.getElementById('request-binance-withdraw-btn').disabled) return;

    const binancePayId = document.getElementById('binance-pay-id').value.trim();
    if (!binancePayId) {
        showToast("Please enter your Binance Pay ID.", "error");
        return;
    }
    // Basic validation for Binance Pay ID format (example: typically alphanumeric)
    if (!/^[a-zA-Z0-9]{10,20}$/.test(binancePayId)) { // Adjust regex as needed for actual Binance ID format
        showToast("Invalid Binance Pay ID format.", "error");
        return;
    }

    const amountAsPoints = 320;
    const estUsdValue = 0.9;
    
    if (currentUserData.current_balance_as < amountAsPoints) {
        showToast("Insufficient AS Points for Binance withdrawal.", "error");
        return;
    }

    document.getElementById('request-binance-withdraw-btn').disabled = true;
    document.getElementById('binance-withdraw-status').textContent = 'Submitting request...';
    document.getElementById('binance-withdraw-status').classList.remove('error');

    try {
        // --- THIS PART REQUIRES ADMIN REVIEW AND MANUAL PROCESSING ---
        // The following client-side operation is for recording the request.
        // Actual transfer happens manually by an admin.

        const userRef = usersCollection.doc(currentUserData.user_id);
        const batch = db.batch();

        // Deduct points immediately (this assumes trust in manual process, or use a "hold" state)
        const newBalance = currentUserData.current_balance_as - amountAsPoints;
        batch.update(userRef, {
            current_balance_as: newBalance,
            last_seen_at: firebase.firestore.FieldValue.serverTimestamp()
        });

        const withdrawalRef = withdrawalsCollection.doc();
        batch.set(withdrawalRef, {
            user_id: currentUserData.user_id,
            method: 'BINANCE',
            amount_as_points: amountAsPoints,
            est_usd_value: estUsdValue,
            recipient: binancePayId,
            status: 'PENDING', // Will be manually updated by admin
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
            updated_at: firebase.firestore.FieldValue.serverTimestamp(),
            admin_note: ''
        });

        await batch.commit();

        currentUserData.current_balance_as = newBalance;
        userWithdrawals.unshift({ // Add to local list for immediate UI refresh
            id: withdrawalRef.id,
            user_id: currentUserData.user_id,
            method: 'BINANCE',
            amount_as_points: amountAsPoints,
            est_usd_value: estUsdValue,
            recipient: binancePayId,
            status: 'PENDING',
            created_at: new Date(),
            updated_at: new Date(),
            admin_note: ''
        });

        animateBalance(asPointsBalanceSpan, newBalance);
        showToast("Binance withdrawal requested! Pending admin review.", "info");
        document.getElementById('binance-withdraw-status').textContent = "Request submitted. Status: PENDING";
        document.getElementById('binance-withdraw-status').classList.add('info');
        document.getElementById('binance-pay-id').value = ''; // Clear field
        updateAllUI();

    } catch (error) {
        console.error("Error requesting Binance withdrawal:", error);
        showToast("Failed to request Binance withdrawal. Please try again.", "error");
        document.getElementById('binance-withdraw-status').textContent = "Failed to submit request.";
        document.getElementById('binance-withdraw-status').classList.add('error');
    } finally {
        document.getElementById('request-binance-withdraw-btn').disabled = false;
        updateWithdrawButtons(); // Ensure button state is correct
    }
});

document.getElementById('request-google-play-withdraw-btn')?.addEventListener('click', async () => {
    if (!currentUserData || document.getElementById('request-google-play-withdraw-btn').disabled) return;

    const email = document.getElementById('google-play-email').value.trim();
    if (!email) {
        showToast("Please enter your email address.", "error");
        return;
    }
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast("Invalid email address format.", "error");
        return;
    }

    const amountAsPoints = 210;
    const estUsdValue = 0.5;

    if (currentUserData.current_balance_as < amountAsPoints) {
        showToast("Insufficient AS Points for Google Play withdrawal.", "error");
        return;
    }

    document.getElementById('request-google-play-withdraw-btn').disabled = true;
    document.getElementById('google-play-withdraw-status').textContent = 'Submitting request...';
    document.getElementById('google-play-withdraw-status').classList.remove('error');

    try {
        // --- THIS PART REQUIRES ADMIN REVIEW AND MANUAL PROCESSING ---
        // The following client-side operation is for recording the request.
        // Actual code delivery happens manually by an admin to the provided email.

        const userRef = usersCollection.doc(currentUserData.user_id);
        const batch = db.batch();

        const newBalance = currentUserData.current_balance_as - amountAsPoints;
        batch.update(userRef, {
            current_balance_as: newBalance,
            last_seen_at: firebase.firestore.FieldValue.serverTimestamp()
        });

        const withdrawalRef = withdrawalsCollection.doc();
        batch.set(withdrawalRef, {
            user_id: currentUserData.user_id,
            method: 'GOOGLE_PLAY',
            amount_as_points: amountAsPoints,
            est_usd_value: estUsdValue,
            recipient: email,
            status: 'PENDING', // Will be manually updated by admin
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
            updated_at: firebase.firestore.FieldValue.serverTimestamp(),
            admin_note: ''
        });

        await batch.commit();

        currentUserData.current_balance_as = newBalance;
        userWithdrawals.unshift({ // Add to local list for immediate UI refresh
            id: withdrawalRef.id,
            user_id: currentUserData.user_id,
            method: 'GOOGLE_PLAY',
            amount_as_points: amountAsPoints,
            est_usd_value: estUsdValue,
            recipient: email,
            status: 'PENDING',
            created_at: new Date(),
            updated_at: new Date(),
            admin_note: ''
        });

        animateBalance(asPointsBalanceSpan, newBalance);
        showToast("Google Play withdrawal requested! Code will be sent to your email.", "info");
        document.getElementById('google-play-withdraw-status').textContent = "Request submitted. Status: PENDING";
        document.getElementById('google-play-withdraw-status').classList.add('info');
        document.getElementById('google-play-email').value = ''; // Clear field
        updateAllUI();

    } catch (error) {
        console.error("Error requesting Google Play withdrawal:", error);
        showToast("Failed to request Google Play withdrawal. Please try again.", "error");
        document.getElementById('google-play-withdraw-status').textContent = "Failed to submit request.";
        document.getElementById('google-play-withdraw-status').classList.add('error');
    } finally {
        document.getElementById('request-google-play-withdraw-btn').disabled = false;
        updateWithdrawButtons(); // Ensure button state is correct
    }
});


// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Also re-initialize if Telegram WebApp becomes visible again (e.g., from background)
// This is important for ensuring data is fresh after user leaves and returns
Telegram.WebApp.onEvent('viewportChanged', () => {
    if (Telegram.WebApp.isVisible) {
        console.log("Viewport changed: App became visible. Re-initializing...");
        initializeApp(); // Re-run full initialization to refresh data
    } else {
        console.log("Viewport changed: App became hidden.");
    }
});

// For development: Expose some globals
window.db = db;
window.currentUserData = currentUserData; // This will only hold initial data until re-assigned
window.refreshApp = initializeApp; // A way to manually refresh from console