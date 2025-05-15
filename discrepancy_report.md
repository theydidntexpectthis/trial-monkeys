# Discrepancy and Bug Report (Initial Review)

This document outlines the initial discrepancies and potential bugs found when comparing the existing codebase (`trial-monkeys-main/Sandbox`) with the provided reference images and E2E testing prompts.

## I. Visual and Branding Discrepancies (Compared to Reference Images)

**Reference Image 1: Bot Installation Page (`ChatGPT Image May 15, 2025, 03_13_51 PM.png`)**

*   **Branding:**
    *   **Logo:** The reference image shows a distinct monkey logo. The current `index.html` does not include this logo; it only has the text "Trial Junkies".
    *   **Project Name:** The reference image uses "Trial Monkeys". The current codebase uses "Trial Junkies" in `index.html` and `package.json`.
*   **Color Scheme:**
    *   The reference image uses a dark theme with specific shades of purple, green, orange, and blue for bot cards and UI elements. The current `styles.css` uses a different color palette (e.g., ` --primary-color: #4f46e5;`). The overall theme needs to be updated to match the dark, vibrant theme of the reference.
*   **Layout - Header:**
    *   The reference shows "Docs", "Discord", "Telegram", "Log in" in the top right. The current `index.html` (dashboard view) has "Active Trials", "Available Services", "Settings", and a Logout button, which is a different context but indicates the header structure needs to be adapted for the public-facing pages.
*   **Layout - Sidebar:**
    *   The reference shows a left sidebar with "Commands", "Industry-Specific Bots", and "Subscriptions". The current `index.html` has a different dashboard navigation structure.
*   **Layout - Main Content (Bot Grid):**
    *   **Title:** Reference shows "250 Type One-Click Easy Installations Trial Bots". Current `index.html` (Available Services panel) shows "Available Services".
    *   **Search Bar:** Present in the reference, also present in `index.html` (`id="search-services"`). Styling needs to match.
    *   **Filter Tags:** Reference shows filter tags like "Discord", "DBot", "lolelementation" (likely "Implementation"), "Telegram". Current `index.html` has a category dropdown (`id="category-filter"`). This needs to be changed to tag-style filters.
    *   **Bot Cards:** Reference shows distinct card styling with a prominent monkey icon, bot name, and an "Install" button. The current `services-grid` in `app.js` renders cards with `service.name`, `service.description`, duration, and a "Start Trial" button. The visual design (colors, icons, layout) of these cards needs a complete overhaul.

**Reference Image 2: Pricing Page (`ChatGPT Image May 15, 2025, 03_13_44 PM.png`)**

*   **Branding & Header:** Consistent with the first image (Trial Monkeys logo, Docs, Discord, Telegram, Log in).
*   **Page Title:** "Choose a Plan".
*   **Pricing Tiers:**
    *   Three tiers: "Free", "Pro" ($25/mo), "Enterprise" ($50/mo).
    *   Each tier has a monkey icon, plan name, price, feature list, and a "Get Started" button.
    *   The styling (dark theme, card design, typography) is consistent with the first reference image.
*   **Current Codebase:**
    *   There is no dedicated pricing page HTML file in the `public` directory.
    *   `subscription.routes.js` handles subscription logic (upgrade, details, etc.), and `payment.routes.js` handles payments, but the frontend for this page needs to be created from scratch based on the reference.
*   **Footer:** Reference shows "About" and "Contact" links in the footer. This is missing from the current `index.html`.

## II. Functional Discrepancies (Compared to E2E Testing Prompts in `pasted_content.txt`)

*   **E2E Test 1: One-Click Trial Bot Installation**
    *   **Current:** `app.js` has `createTrial(serviceId)`. The E2E prompt implies a direct "Install" action. The flow seems to exist but needs UI alignment.
    *   **Missing:** Assertion of installation status in a user dashboard (the current dashboard shows active trials, which is similar).
*   **E2E Test 2: Subscription Plan Checkout**
    *   **Current:** Backend routes for subscription and payment exist. `index.html` does not have a pricing page or checkout flow UI.
    *   **Missing:** Frontend for `/pricing`, mock payment info handling (Stripe test data mentioned, but no Stripe integration visible in `package.json` or frontend code beyond a generic payment modal).
*   **E2E Test 3: Sidebar Navigation**
    *   **Current:** `index.html` has a dashboard navigation, not the public-facing sidebar from the reference image.
    *   **Missing:** Frontend for "Commands", "Industry-Specific Bots", "Docs", "Subscriptions" as separate navigable sections accessible from a main sidebar as per reference images.
The `/docs` route in `server.js` redirects to `documentation.html`, but this file is not present in the provided zip.
*   **E2E Test 4: Search and Filter Function**
    *   **Current:** `index.html` has a search input and category dropdown. `app.js` has `filterServices` and `filterByCategory`.
    *   **Discrepancy:** E2E prompt mentions filtering by "Streaming" category and searching for "Netflix". The current categories are generic. The filter UI needs to change from dropdown to tags.
*   **E2E Test 5: Discord Bot Integration**
    *   **Current:** No explicit Discord integration (OAuth, invite link handling) is visible in the routes or frontend code.
    *   **Missing:** `/discord` route, "Add to Discord" functionality.
*   **E2E Test 6: Telegram Bot Functionality**
    *   **Current:** No explicit Telegram integration visible.
    *   **Missing:** "Connect Telegram" functionality, bot start command handling.
*   **E2E Test 7: Login / Auth Flow**
    *   **Current:** `auth.routes.js` and `app.js` implement Phantom wallet authentication. The E2E prompt mentions Google OAuth or standard login.
    *   **Discrepancy/Missing:** No Google OAuth or standard email/password login is implemented. The current auth is Solana/Phantom specific.
*   **E2E Test 8: Docs Page Load**
    *   **Current:** `/docs` redirects to `documentation.html` (missing). E2E prompt implies internal page navigation within docs.
    *   **Missing:** `documentation.html` and its internal structure.
*   **E2E Test 9: Fallback Handling**
    *   **Current:** `app.js` has `showError()` for trial creation failures.
    *   **To Verify:** Behavior for disabled bots and user-friendly error modals needs specific testing and potentially more nuanced error handling.
*   **E2E Test 10: Mobile Responsiveness**
    *   **Current:** `styles.css` has some `@media (max-width: 768px)` rules.
    *   **To Verify:** Thorough testing on mobile resolution is needed to confirm no layout shifts or broken UI, especially after implementing the new design.

## III. General Codebase Observations

*   **Project Name:** Inconsistency ("Trial Junkies" in code, "Trial Monkeys" in references).
*   **Frontend Framework:** The project uses vanilla JavaScript for the frontend. No major framework like React, Vue, or Angular is used, which is fine but good to note for development complexity.
*   **Missing Files:** `documentation.html` is referenced but not provided.
*   **AI Features:** The user request mentions "add AIs for me etc". There is no specific detail on what AI features are needed. This requires clarification.
*   **ODCs:** User requested "make very detailed odcs". This refers to Operational Design Choices documentation, which will need to be created.

## IV. Summary of Key Areas for Development/Fixes:

1.  **Branding Update:** Change project name to "Trial Monkeys", incorporate the logo.
2.  **Complete UI/UX Overhaul:** Redesign all frontend pages (especially bot listing and new pricing page) to match the reference images (dark theme, new layouts, card designs, typography, colors).
3.  **Create Missing Pages/Sections:** Pricing page, Docs page (with content), Commands page, Industry-Specific Bots page.
4.  **Implement Missing Integrations:** Discord and Telegram integration.
5.  **Auth System Review:** Clarify if Phantom wallet auth is sufficient or if Google OAuth/standard login is also required.
6.  **Filter System Update:** Change category dropdown to tag-based filters.
7.  **Content Population:** Bot details, categories (e.g., "Streaming", specific bot names like "Netflix trial bot").
8.  **Thorough E2E Testing:** After changes, re-validate against all E2E prompts.
9.  **AI Feature Clarification & Implementation.**
10. **Documentation Creation:** User docs and ODCs.
