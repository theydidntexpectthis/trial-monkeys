Here’s a **complete set of E2E (end-to-end) testing prompts** tailored specifically for the **Trial Monkeys** project. These can be used with tools like **Playwright**, **Cypress**, or **Puppeteer**—whichever you're using for automation. The focus is on testing core functionality like one-click bot installs, Discord/Telegram links, subscription flows, and category browsing.

---

### 🧪 **Trial Monkeys E2E Testing Prompt Suite**

---

### ✅ **1. One-Click Trial Bot Installation**

**Goal:** Ensure user can click once to install a bot and receive confirmation.

```
- Visit homepage
- Scroll to bot grid
- Click “Install” on a visible bot card
- Verify success message or redirect to installation screen
- Assert installation status is stored in user dashboard
```

---

### 🛒 **2. Subscription Plan Checkout**

**Goal:** Validate Free, Pro, and Enterprise plan checkout functionality.

```
- Navigate to /pricing
- Select “Pro Plan”
- Click “Subscribe”
- Fill in mock payment info (Stripe test data)
- Verify confirmation and redirect to dashboard
```

---

### 🧭 **3. Sidebar Navigation**

**Goal:** Make sure all sidebar links work and show the right content.

```
- Navigate to homepage
- Click each sidebar item:
  - “Commands”
  - “Industry-Specific Bots”
  - “Docs”
  - “Subscriptions”
- Assert correct page loads and content is visible
```

---

### 🧪 **4. Search and Filter Function**

**Goal:** Ensure search bar and category filter display accurate bots.

```
- Go to bot library
- Type “Netflix” in search
- Assert Netflix trial bot is the first result
- Click on “Streaming” category
- Assert only streaming-related bots are shown
```

---

### 💬 **5. Discord Bot Integration**

**Goal:** Validate Discord OAuth or invite link works correctly.

```
- Navigate to /discord
- Click “Add to Discord”
- Authenticate with test Discord account
- Assert bot appears in selected test server
```

---

### 📲 **6. Telegram Bot Functionality**

**Goal:** Check bot start command in Telegram.

```
- Click “Connect Telegram” from homepage
- Open Telegram in web view
- Click “Start” in bot window
- Assert bot replies with welcome message and /start_trial command
```

---

### 🔐 **7. Login / Auth Flow**

**Goal:** Ensure Google OAuth or standard login works.

```
- Visit /login
- Click “Login with Google”
- Use test credentials
- Assert user is redirected to dashboard with name/email visible
```

---

### 📋 **8. Docs Page Load**

**Goal:** Validate that Docs sidebar and internal links work.

```
- Navigate to /docs
- Click on each doc section:
  - “Getting Started”
  - “Command Reference”
  - “Bot Categories”
- Assert that each page scrolls to the correct section
```

---

### 🐛 **9. Fallback Handling**

**Goal:** Ensure broken installs or failed bots give user-friendly errors.

```
- Attempt install on a disabled bot
- Assert error modal shows: “Bot currently unavailable”
- Retry install and confirm success
```

---

### 📱 **10. Mobile Responsiveness**

**Goal:** Check layout and functionality on smaller screens.

```
- Set screen to mobile resolution (375x667)
- Open bot grid and sidebar
- Test install button
- Navigate pricing page
- Assert no layout shifts or broken UI
```

---

### Want These in Code Format?

Let me know if you're using **Cypress**, **Playwright**, or something else—I can give you the entire test file ready to run.

Would you like me to drop the full Cypress/Playwright E2E test scripts?
