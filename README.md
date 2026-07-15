### Smart Link Tracker

A full-stack MongoDB link tracking application with:

- Short links and custom aliases
- QR code generation and download
- Click and visitor tracking
- Country, city, device, browser and operating-system analytics
- Expiry dates
- Password-protected links
- CSV export
- Responsive admin dashboard
- Render deployment support

## Local setup

1. Extract the project.
2. Open PowerShell inside the folder.
3. Install dependencies:

```powershell
npm install
```

4. Copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

5. Edit `.env` and paste your real MongoDB Atlas connection string:

```env
PORT=3000
BASE_URL=http://localhost:3000
MONGO_URL=mongodb+srv://USERNAME:PASSWORD@cluster-name.mongodb.net/mylinktracker?retryWrites=true&w=majority
ADMIN_USERNAME=admin
ADMIN_PASSWORD=1234
```

6. Start:

```powershell
Copy-Item .env.example .env
```

7. Open `http://localhost:3000`.

## MongoDB Atlas

- Create a free cluster.
- Open Database Access and create a database user.
- Open Network Access and add `0.0.0.0/0` for testing.
- Open Connect, Drivers, Node.js and copy the connection string.
- URL-encode special password characters.
