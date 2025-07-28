# AI Smart Warehouse & Delivery Management System

![Apex Logistics Management System](https://via.placeholder.com/1200x600/4a69bd/ffffff?text=Apex+Logistics+System)

An advanced, full-stack web application designed to bring intelligence and efficiency to warehouse operations and delivery logistics. This project combines a robust backend for managing inventory, users, and deliveries with a suite of AI-powered services for route optimization, smart staff assignment, and predictive sales forecasting.

---

## ✨ Key Features

This application is built with a clear, role-based architecture, providing distinct dashboards and capabilities for different user types.

### 👤 Role-Based Access Control (RBAC)
- **Admin:** Has complete oversight and control over the entire system. Can manage users, view all data, access special administrative tools, and monitor the work of other users.
- **Manager:** Oversees daily operations, including inventory management, assigning deliveries, and generating invoices.
- **Delivery Staff:** Can view their assigned deliveries and update the status in real-time (`Pending`, `In Transit`, `Delivered`, `Failed`).

### 🧠 AI & Smart Features
- **Route Optimization:** Utilizes the PositionStack API for high-accuracy geocoding to find precise coordinates for delivery destinations and calculates an efficient travel order.
- **Smart Staff Assignment:** Automatically recommends the delivery staff member with the lightest current workload when assigning a new delivery, ensuring balanced and efficient operations.
- **Predictive Inventory Forecasting:** A Python-based script analyzes the 30-day sales history of successfully delivered items to calculate:
  - **AI: Daily Burn:** The average number of units sold per day.
  - **AI: Stock Left:** A prediction of how many days the current available stock will last based on the burn rate.

### 📦 Core Functionality
- **Advanced Inventory Management:**
  - Full CRUD (Create, Read, Update, Delete) operations for inventory items.
  - Differentiates between **Total Stock** (cumulative total) and **Available Stock** (physically on-hand).
  - Robust **server-side validation** prevents stock levels from ever going negative.
- **Comprehensive Delivery Tracking:** Managers can create, assign, and monitor all deliveries. Admins can view details for any staff member.
- **Billing & Invoicing:**
  - Automatically generate detailed, professional invoices from successfully completed deliveries.
  - Track invoice status (`Unpaid`, `Paid`).
  - View and print individual invoices from a dedicated, beautifully styled page.
- **Modern Landing Page:** A sleek, single-page design for non-logged-in users, combining Home, About, and Contact sections with smooth scrolling and animations.

### 👑 Admin Super-Powers
- **Centralized Admin Sidebar:** A modern, slide-in sidebar gives the Admin quick access to oversight tools.
- **User Monitoring:** Admins can view lists of all Managers and Delivery Staff and drill down to see a detailed page for each user, including their complete delivery history.
- **Dashboard Impersonation:** Admins can view the full Manager Dashboard to see the application from a manager's perspective.

### 🛡️ Security Features
- **Secure Password Hashing:** Uses `bcrypt.js` to securely hash and salt all user passwords before storing them in the database.
- **Server-Side Session Management:** Employs `express-session` to maintain user login state securely. Session data is stored on the server, and a secure, HTTP-only cookie is sent to the client.
- **Input Validation & Sanitization:** Uses `express-validator` to validate and sanitize all user inputs (e.g., on registration and login) to prevent common vulnerabilities like XSS attacks and ensure data integrity.
- **Route Protection (Authorization):** A robust middleware system (`authMiddleware.js`) protects all sensitive routes, ensuring they are only accessible to authenticated users with the correct role (e.g., Admin-only, Manager-only).
- **Environment Variables:** All sensitive information (database URIs, secret keys, API keys) is stored securely in `.env` files and is not hard-coded.

---

## 🛠️ Technology Stack

#### **Backend & Database**
- **Node.js & Express.js:** For the core application server.
- **MongoDB:** NoSQL database for storing all application data.
- **Mongoose:** Object Data Modeling (ODM) library for MongoDB.
- **Express Session & bcrypt.js:** For authentication and security.
- **Express Validator:** For input validation and sanitization.

#### **Frontend**
- **EJS (Embedded JavaScript templates):** For server-side rendering of dynamic HTML.
- **CSS3:** A custom-built modern theme with variables, a responsive layout, and animations.
- **JavaScript (Client-Side):** For interactive components like the admin sidebar, dynamic forms, and chart rendering.
- **Chart.js:** For data visualization on the Admin dashboard.
- **Leaflet.js:** For displaying the interactive map on the route optimization page.

#### **AI Services (Python Microservice)**
- **Python & Flask:** A lightweight web server to expose AI features as an API.
- **Pymongo:** For connecting Python scripts to the MongoDB database.
- **Requests & Scipy:** For external API communication and calculations.

#### **External APIs**
- **PositionStack API:** For converting street addresses into geographic coordinates.

---

## 🚀 Setup and Installation

To run this project locally, you will need Node.js, npm, Python, pip, and a running MongoDB instance.

### 1. Backend Server (Node.js)

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Install all required npm packages
npm install

# 3. Create a .env file in the 'backend' directory and add the following variables:
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/warehouseDB
SECRET_KEY=your-super-secret-key-for-sessions

# 4. Start the server
node server.js
```
The main application will now be running at `http://localhost:3000`.

### 2. AI Services (Python)

```bash
# 1. In a new terminal, navigate to the Python directory
cd python-ai-services

# 2. Install all required Python packages
pip install -r requirements.txt

# 3. Create a .env file in this directory and add your API key:
MONGO_URI=mongodb://127.0.0.1:27017/warehouseDB
POSITIONSTACK_API_KEY=your_free_api_key_from_positionstack.com

# 4. Start the Python API server
python app.py
```
The AI API service will now be running at `http://localhost:5001`.

---

## 📈 Usage

1.  Ensure your MongoDB database instance is running.
2.  Start both the Node.js backend server and the Python AI server in separate terminals.
3.  Navigate to `http://localhost:3000` in your browser.
4.  Register users with different roles to test the full functionality.
5.  **To run the AI forecast:** You can manually run the forecaster script from the Python directory at any time to update the inventory with the latest sales predictions.
    ```bash
    python forecaster.py
    ```
