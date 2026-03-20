/**
 * ACLEDA KHQR Donation App
 * Frontend JavaScript for donation management
 * Version: 1.0.0
 */

// ============================================
// GLOBAL VARIABLES
// ============================================
let currentDonationId = null;
let currentAmount = null;
let currentName = null;
let isLoading = false;

// API endpoints
const API = {
    status: '/api/status',
    createDonation: '/api/create-donation',
    getDonations: '/api/get-donations',
    confirmPayment: '/api/confirm-payment/',
    testKHQR: '/api/test-khqr'
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 ACLEDA KHQR App initialized');
    initializeApp();
});

/**
 * Initialize the application
 */
async function initializeApp() {
    try {
        await checkAPIStatus();
        await loadDonations();
        setupEventListeners();
        startAutoRefresh();
    } catch (error) {
        console.error('❌ Initialization error:', error);
        showToast('Failed to initialize app', 'error');
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        const modal = document.getElementById('donationModal');
        if (e.target === modal) {
            closeModal();
        }
    });

    // Form submission prevention
    const form = document.getElementById('donationForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            generateQR();
        });
    }
}

// ============================================
// API STATUS CHECK
// ============================================

/**
 * Check API and database status
 */
async function checkAPIStatus() {
    try {
        const response = await fetch(API.status);
        const data = await response.json();

        console.log('📊 API Status:', data);

        // Update status badge
        const dbStatus = document.getElementById('dbStatus');
        if (dbStatus) {
            if (data.database.available) {
                dbStatus.innerHTML = `
                    <span class="status connected">
                        <span class="dot"></span>
                        Database Connected (${data.database.stats?.total || 0} donations)
                    </span>
                `;
            } else {
                dbStatus.innerHTML = `
                    <span class="status disconnected">
                        <span class="dot"></span>
                        Database Disconnected
                    </span>
                `;
            }
        }

        return data;
    } catch (error) {
        console.error('❌ Status check failed:', error);
        return null;
    }
}

// ============================================
// MODAL FUNCTIONS
// ============================================

/**
 * Open donation modal
 */
function openModal() {
    const modal = document.getElementById('donationModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    showStep(1);
    clearForm();

    // Focus on name input
    setTimeout(() => {
        document.getElementById('name').focus();
    }, 300);
}

/**
 * Close donation modal
 */
function closeModal() {
    const modal = document.getElementById('donationModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    showStep(1);
    clearForm();
    hideLoading();
}

/**
 * Show specific step in modal
 * @param {number} step - Step number (1, 2, or 3)
 */
function showStep(step) {
    document.querySelectorAll('.step').forEach(el => {
        el.classList.remove('active');
    });
    document.getElementById(`step${step}`).classList.add('active');
}

/**
 * Go back to step 1 from QR step
 */
function goBack() {
    showStep(1);
    clearForm();
}

/**
 * Clear form inputs
 */
function clearForm() {
    document.getElementById('name').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('qrCode').innerHTML = `
        <div class="qr-placeholder">
            <div class="loader"></div>
        </div>
    `;
    document.getElementById('displayAmount').innerHTML = `
        <span class="amount-label">Amount:</span>
        <span class="amount-value">$0.00</span>
    `;
}

// ============================================
// LOADING FUNCTIONS
// ============================================

/**
 * Show loading overlay
 * @param {string} message - Loading message
 */
function showLoading(message = 'Processing...') {
    isLoading = true;
    document.getElementById('loading').style.display = 'block';
    document.getElementById('loadingMessage').textContent = message;

    // Disable buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        if (!btn.classList.contains('close-btn')) {
            btn.disabled = true;
        }
    });
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    isLoading = false;
    document.getElementById('loading').style.display = 'none';

    // Enable buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.disabled = false;
    });
}

// ============================================
// DONATION FUNCTIONS
// ============================================

/**
 * Generate KHQR code for donation
 */
async function generateQR() {
    if (isLoading) return;

    const name = document.getElementById('name').value.trim();
    const amount = document.getElementById('amount').value;

    // Validate inputs
    if (!validateInputs(name, amount)) {
        return;
    }

    showLoading('Creating KHQR...');

    try {
        console.log('📝 Creating donation:', { name, amount: parseFloat(amount) });

        const response = await fetch(API.createDonation, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                amount: parseFloat(amount)
            })
        });

        const data = await response.json();
        console.log('📥 Response:', data);

        if (data.success) {
            currentDonationId = data.donation_id;
            currentName = name;
            currentAmount = parseFloat(amount);

            // Display QR code
            displayQRCode(data);

            // Move to step 2
            showStep(2);
            showToast('KHQR generated successfully!', 'success');
        } else {
            showToast(data.error || 'Failed to create donation', 'error');
        }
    } catch (error) {
        console.error('❌ Error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Validate form inputs
 * @param {string} name - Donor name
 * @param {string} amount - Donation amount
 * @returns {boolean} - Validation result
 */
function validateInputs(name, amount) {
    if (!name) {
        showToast('Please enter your name', 'error');
        return false;
    }

    if (name.length > 100) {
        showToast('Name is too long (max 100 characters)', 'error');
        return false;
    }

    if (!amount || parseFloat(amount) <= 0) {
        showToast('Please enter a valid amount', 'error');
        return false;
    }

    if (parseFloat(amount) > 10000) {
        showToast('Amount cannot exceed $10,000', 'error');
        return false;
    }

    return true;
}

/**
 * Display QR code in modal
 * @param {Object} data - Response data from server
 */
function displayQRCode(data) {
    const qrContainer = document.getElementById('qrCode');
    const amountDisplay = document.getElementById('displayAmount');

    if (data.khqr) {
        qrContainer.innerHTML = `<img src="${data.khqr}" alt="KHQR Code" title="Scan with ACLEDA Mobile">`;
    } else {
        qrContainer.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p>QR Code generated</p>
                <p style="font-size: 0.8rem; color: #666;">Please refresh if not visible</p>
            </div>
        `;
    }

    amountDisplay.innerHTML = `
        <span class="amount-label">Amount:</span>
        <span class="amount-value">$${currentAmount.toFixed(2)}</span>
    `;
}

/**
 * Confirm payment
 */
async function confirmPayment() {
    if (isLoading) return;

    if (!currentDonationId) {
        showToast('No donation found', 'error');
        return;
    }

    showLoading('Confirming payment...');

    try {
        console.log('💰 Confirming payment:', currentDonationId);

        const response = await fetch(API.confirmPayment + currentDonationId, {
            method: 'POST'
        });

        const data = await response.json();
        console.log('📥 Response:', data);

        if (data.success) {
            // Show success message
            showStep(3);

            // Update success details
            document.getElementById('successDetails').innerHTML = `
                <p>Name: ${currentName}</p>
                <p>Amount: $${currentAmount.toFixed(2)}</p>
                <p>Reference: ${currentDonationId.slice(-6)}</p>
            `;

            // Reload donations list
            await loadDonations();
            await checkAPIStatus();

            showToast('Payment confirmed! Thank you!', 'success');

            // Auto close after 3 seconds
            setTimeout(() => {
                closeModal();
            }, 3000);
        } else {
            showToast(data.error || 'Confirmation failed', 'error');
        }
    } catch (error) {
        console.error('❌ Error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// ============================================
// DONATIONS LIST FUNCTIONS
// ============================================

/**
 * Load donations list
 */
async function loadDonations() {
    const list = document.getElementById('donationsList');

    try {
        console.log('📊 Loading donations...');

        const response = await fetch(API.getDonations);
        const data = await response.json();

        console.log('📥 Donations:', data);

        if (data.success && data.donations && data.donations.length > 0) {
            list.innerHTML = '';

            data.donations.forEach(donation => {
                const card = createDonationCard(donation);
                list.appendChild(card);
            });
        } else {
            list.innerHTML = `
                <div class="loading-state">
                    <p>No donations yet. Be the first!</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('❌ Error loading donations:', error);
        list.innerHTML = `
            <div class="loading-state">
                <p style="color: var(--danger);">Failed to load donations</p>
                <button onclick="loadDonations()" style="margin-top: 10px; padding: 5px 15px; background: var(--acleda-blue); color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Retry
                </button>
            </div>
        `;
    }
}

/**
 * Create donation card element
 * @param {Object} donation - Donation data
 * @returns {HTMLElement} - Card element
 */
function createDonationCard(donation) {
    const card = document.createElement('div');
    card.className = 'donation-card';

    // Format date
    let dateStr = 'Just now';
    if (donation.timestamp) {
        try {
            const date = new Date(donation.timestamp);
            dateStr = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            console.log('Date error:', e);
        }
    }

    // Get initials for avatar
    const initials = donation.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    card.innerHTML = `
        <div style="margin-bottom: 10px;">
            <span style="background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 20px; font-size: 0.8rem;">
                ${initials}
            </span>
        </div>
        <h4>${donation.name || 'Anonymous'}</h4>
        <div class="amount">$${(donation.amount || 0).toFixed(2)}</div>
        <div class="date">${dateStr}</div>
    `;

    return card;
}

// ============================================
// AUTO REFRESH
// ============================================

let refreshInterval;

/**
 * Start auto refresh for donations
 */
function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(() => {
        if (!isLoading) {
            loadDonations();
            checkAPIStatus();
        }
    }, 30000); // Refresh every 30 seconds
}

// ============================================
// TOAST NOTIFICATION
// ============================================

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success' or 'error'
 */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted amount
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!', 'success');
    } catch (err) {
        console.error('Copy failed:', err);
        showToast('Failed to copy', 'error');
    }
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// EXPORT FUNCTIONS TO GLOBAL SCOPE
// ============================================
window.openModal = openModal;
window.closeModal = closeModal;
window.generateQR = generateQR;
window.confirmPayment = confirmPayment;
window.goBack = goBack;
window.loadDonations = loadDonations;