# Bulkhead (Full-Stack Messenger)

This is a modern full-stack messenger application named **Bulkhead**, built with React/TypeScript for the frontend and Node.js/Express for the backend. It includes a real database (SQLite), real-time chat via WebSockets, secure user authentication, Google login, and an admin panel.

## Features

-   **Full-Stack Architecture:** Separated client and server.
-   **Persistent Database:** Uses SQLite to store users and messages.
-   **Real-Time Chat:** WebSockets (via Socket.IO) for instant message delivery.
-   **End-to-End Encrypted Video Calls:** Secure 1-on-1 video calls using WebRTC and the browser-native **Web Crypto API** for robust, high-performance encryption, with an integrated TURN server for reliable connectivity.
-   **Web Push Notifications:** System-level notifications for offline users via Service Workers.
-   **User Presence:** Real-time online/offline status indicators.
-   **Secure Authentication:** Password hashing (`bcrypt`) and JWT-based sessions.
-   **Multiple Login Methods:** Standard (login/password), Google, Telegram, and anonymous (guest).
-   **Media Uploads:** Send images, audio recordings, video circles, and files in chats.
-   **Admin & Moderator Panel:** Manage users, their roles, and apply bans or mutes.
-   **Multilingual Support:** English and Russian.
-   **Light & Dark Themes:** Fully supported, themeable UI.
-   **HTTPS Ready:** Pre-configured to run in a secure HTTPS environment.

## How to Run the Project

This project is a full-stack application and requires Node.js and npm to run.

### Prerequisites

-   [Node.js](https://nodejs.org/) (which includes npm) version 16 or higher.

### Steps

1.  **Download and Unpack:** Download all project files and place them in a single directory.

2.  **Install Dependencies:**
    -   Open your terminal in the **root** project directory.
    -   Run the following command. It will install all necessary packages for both the client and the server.
    ```bash
    npm install
    ```
    
3.  **Provide Required Assets (`server/assets/`):**
    - For the application to display correctly and play sounds, you must place the following files in the `server/assets/` directory:
        -   **`logo_for_pc.jpg`**: The logo for desktop screens.
        -   **`logo_for_mobile.jpg`**: The logo for mobile screens.
        -   **`notification.mp3`**: The sound played for new messages.
        -   **`logo.png`**: A transparent logo used for video watermarks.

4.  **Run the Development Server:**
    -   You have two options to run the server:
        -   **Standard (HTTP):**
            ```bash
            npm run dev
            ```
            -   This will run the client on `http://localhost:5174` and the server on `http://localhost:5173`.
        
        -   **Secure (HTTPS):**
            -   To test features like camera/microphone on mobile devices or over a network, you need to run with HTTPS.
            -   See the **"Local HTTPS Setup (Manual)"** section below first.
            -   After setup, run:
            ```bash
            npm run dev:https
            ```
            -   This will run the client on `https://localhost:5174` and the server on `https://localhost:5173`.

### Configuration (Hardcoded)

**As requested, all configuration variables (API keys, secrets, etc.) are now hardcoded directly into the source code to eliminate `.env` file issues.**

-   **Server Configuration:** To change server settings (like JWT Secret, Google Client ID, Telegram Bot Token, etc.), edit the file: `server/src/config.ts`.
-   **Client Configuration:** To change client-side settings (like Google Client ID for the login button), edit the file: `client/src/config.ts`.

### Video Call Setup (Production)

To enable video calls in a production environment (outside of your local network), you must configure your server and network correctly:

1.  **Set Public IP:**
    -   Open `server/src/config.ts`.
    -   Find the `TURN_PUBLIC_IP` variable.
    -   Change its value from `"127.0.0.1"` to your server's **static public IP address**.
    ```typescript
    // server/src/config.ts
    export const config = {
        // ... other settings
        TURN_PUBLIC_IP: "YOUR_SERVER_PUBLIC_IP_HERE", 
        // ... other settings
    };
    ```

2.  **Port Forwarding:**
    -   You must configure your router and firewall to forward the following ports to the server running this application:
        -   **`TCP/UDP 3478`**: For the TURN server's primary listening port.
        -   **`UDP 50000-50100`**: The range of ports for relaying media traffic.

3.  **Firewall Configuration:**
    -   Ensure your server's firewall allows traffic on these ports.
    -   **For Linux (UFW):**
        ```bash
        sudo ufw allow 3478/tcp
        sudo ufw allow 3478/udp
        sudo ufw allow 50000:50100/udp
        sudo ufw reload
        ```
    -   **For Windows (PowerShell as Administrator):**
        ```powershell
        New-NetFirewallRule -DisplayName "TURN Server (TCP)" -Direction Inbound -Protocol TCP -LocalPort 3478 -Action Allow
        New-NetFirewallRule -DisplayName "TURN Server (UDP)" -Direction Inbound -Protocol UDP -LocalPort 3478 -Action Allow
        New-NetFirewallRule -DisplayName "TURN Server Relay (UDP)" -Direction Inbound -Protocol UDP -LocalPort 50000-50100 -Action Allow
        ```

### Cryptography with Web Crypto API

To ensure maximum compatibility, performance, and security, all end-to-end encryption operations for video calls are handled by the browser's native **Web Crypto API**. This modern, standardized API provides high-performance cryptographic functions (like AES-GCM and HKDF) that are available in all modern browsers, eliminating the need for external libraries and ensuring video calls are always secure and functional.

### Local HTTPS Setup (Manual)

To test features like the camera/microphone or to access the app from other devices on your network, you need to run the server with HTTPS. The project is pre-configured to use SSL certificates, but you must provide them yourself.

1.  **Obtain Certificate Files:**
    -   You need a valid SSL certificate. For local development, you can use `mkcert` to generate locally-trusted certificates.
    -   You will need two files: a private key file (`acme.key`) and a certificate file (`acme.cer`).

2.  **Place Certificate Files:**
    -   In the `server` directory, create a new folder named `.certs`.
    -   Place your `acme.key` and `acme.cer` files inside this `server/.certs/` directory.

3.  **Run with HTTPS:**
    -   Once the certificate files are in place, start the server using:
    ```bash
    npm run dev:https
    ```