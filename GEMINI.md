# Project Overview

This is a Next.js application that provides a dashboard for interacting with the Cloudflare API. It allows users to view and manage their Cloudflare zones, DNS records, and view traffic analytics. The application features a user authentication and management system.

The frontend is built with React and Tailwind CSS, and the backend is powered by Next.js API Routes and Server Actions. It uses `axios` to communicate with the Cloudflare API and `sqlite` for the user database.

# Building and Running

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Set up environment variables:**
    Create a `.env.local` file and add your Cloudflare API token and account ID:
    ```env
    CLOUDFLARE_API_TOKEN=your-api-token
    CLOUDFLARE_ACCOUNT_ID=your-account-id
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

*   **Styling:** The project uses Tailwind CSS for styling.
*   **API:** The backend API is built with Next.js API Routes. The main endpoint is `/api/scrape`, which handles various actions related to the Cloudflare API.
*   **Authentication:** User authentication is handled by Next.js Server Actions and session management using `localStorage`.
*   **Linting:** The project uses ESLint for code linting. Run `npm run lint` to check for linting errors.

# Key Files

*   `app/page.js`: The main portal page with links to different systems.
*   `app/api/scrape/route.js`: The core of the backend, handling all interactions with the Cloudflare API.
*   `app/utils/auth.js`: Handles user authentication and session management.
*   `app/actions/authActions.js`: Contains the Next.js Server Actions for authentication and user management.
*   `package.json`: Defines the project's dependencies and scripts.
*   `README.md`: Provides a detailed overview of the project, including setup instructions and API documentation.