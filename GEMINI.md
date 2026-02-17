# Project Overview

This is a Next.js application that provides a dashboard for interacting with the Cloudflare API. It allows users to view and manage their Cloudflare zones, DNS records, and view traffic analytics. The application features a user authentication and management system.

The frontend is built with React and Tailwind CSS, and the backend is powered by Next.js API Routes and Server Actions. It uses `axios` to communicate with the Cloudflare API and `sqlite` for the user database.

# Features

*   **Zone & DNS Management:** View and manage Cloudflare zones and DNS records.
*   **Traffic Analytics:** Real-time visualization of traffic volume, top URLs, client IPs, and countries using Recharts.
*   **Security Monitoring:** Track WAF events, blocked attacks, and HTTP status code distributions.
*   **API Discovery:** Discover and manage API endpoints associated with your zones. Handles permissions gracefully (graceful degradation if feature is unavailable).
*   **Batch Reporting:** Automatically generate comprehensive reports for multiple sub-domains. This feature captures dashboard snapshots and aggregates data into a single downloadable Word document using Template Variables (e.g., `@TOP_HOST_VAL@`).
*   **Dynamic Theming:** Centralized theme management supporting multiple themes (Dark, Pink Pastel, Corporate Blue). Theming applies globally to Sidebar, Modals, and Dashboard components via `app/utils/themes.js` and custom events.

# Building and Running

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Setup (Debugging):**
    While the App manages tokens via its User Management system, for **Script Debugging** and **Regression Testing**, you must configure `.env.local`:
    ```env
    # Required for scripts/debug/*.js
    CLOUDFLARE_API_TOKEN=your_token_here
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at [http://localhost:8002](http://localhost:8002).

4.  **Build for production:**
    ```bash
    npm run build
    ```

5.  **Start the production server:**
    ```bash
    npm run start
    ```

# Development Conventions

*   **Styling & Theming:**
    *   Uses Tailwind CSS for styling.
    *   **Theme System:** All theme colors and styles are centralized in `app/utils/themes.js`.
    *   Components subscribe to theme changes via the `theme-change` custom event.
    *   **Do not hardcode colors.** Use variables from the `theme` object (e.g., `theme.bg`, `theme.text`, `theme.card`) to ensure compatibility across Dark, Pastel, and Corporate themes.
*   **API:** The backend API is built with Next.js API Routes. The main endpoint is `/api/scrape`, which handles various actions related to the Cloudflare API.
*   **Authentication:** User authentication is handled by Next.js Server Actions and session management using `localStorage`.
*   **Debug Scripts:**
    *   Located in `scripts/debug/` and `scripts/total_requests/`.
    *   **MUST** use `scripts/helpers.js` for consistent token retrieval and output formatting.
    *   **MUST** first fetch the **Zone ID (UUID)** using the Account/Zone Name before querying Traffic Analytics endpoints, matching the frontend logic (avoid using Zone Name directly).
    *   Output should be directed to the terminal with color-coded logs.

# Key Files

*   `app/page.js`: The main portal page with links to different systems.
*   `app/systems/gdcc/page.js`: The GDCC Analytics dashboard. Handles data visualization, report generation logic, and processing of template variables (like `@TOP_HOST_VAL@`).
*   `app/systems/Sidebar.js`: The global sidebar component, fully themable and responsive.
*   `app/utils/themes.js`: Centralized configuration for all application themes (Dark, Pastel, Corporate).
*   `app/systems/api_discovery/page.js`: The SDB Cloudflare API dashboard for zone and API discovery management.
*   `app/api/scrape/route.js`: The core of the backend, handling all interactions with the Cloudflare API (Proxy to Cloudflare).
*   `app/utils/auth.js`: Handles user authentication and session management.
*   `app/actions/authActions.js`: Contains the Next.js Server Actions for authentication and user management.
*   `scripts/helpers.js`: Shared utility module for debug scripts (API Token loading, Logger).
*   `scripts/debug/test-template-variables.js`: regression script to verify all report template variables are populating correctly.
*   `package.json`: Defines the project's dependencies and scripts.
