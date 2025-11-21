# Trully Giveaway Backend

Nest.js + Prisma backend for managing Trully social giveaways.

## 📋 Requirements

- **Node.js** 20 or higher
- **PostgreSQL** 14 or higher (local or remote)
- **npm** or **yarn** (comes with Node.js)

## 🚀 Initial Setup (New Server)

### 1. Install Node.js (if needed)

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Verify installation:**
```bash
node --version  # Should show v20.x or higher
npm --version
```

### 2. Install and Configure PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Create database and user:**
```bash
sudo -u postgres psql
```

Inside psql, execute:
```sql
CREATE DATABASE trullygiveaway;
CREATE USER your_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE trullygiveaway TO your_user;
\q
```

**Note:** If you prefer to use the default `postgres` user, skip user creation and use PostgreSQL credentials.

### 3. Clone/Setup the Project

If you already have the code:
```bash
cd /path/to/project/backend
```

If cloning:
```bash
git clone <repository-url>
cd backend
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Configure Environment Variables

Copy the example file:
```bash
cp .env.example .env
```

Edit the `.env` file with your credentials:
```bash
nano .env
# or
vim .env
```

Configure the environment variables:
```env
# Database
DATABASE_URL="postgresql://your_user:your_password@localhost:5432/trullygiveaway?schema=public"

# API port (optional, default: 3000)
PORT=3000

# Google OAuth (required for authentication)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# JWT (required for authentication)
JWT_SECRET=your_jwt_secret_key_here_change_in_production
JWT_EXPIRES_IN=7d

# Frontend URL (for OAuth redirects)
FRONTEND_URL=http://localhost:3000
```

**Database Examples:**
- Local PostgreSQL with default user: `postgresql://postgres:postgres@localhost:5432/trullygiveaway?schema=public`
- Remote PostgreSQL: `postgresql://user:password@192.168.1.100:5432/trullygiveaway?schema=public`

**Google OAuth Setup:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google+ API (or Google Identity API)
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. **IMPORTANT**: Add authorized redirect URI. It MUST match EXACTLY your `GOOGLE_CALLBACK_URL`:
   - For local development: `http://localhost:3000/auth/google/callback`
   - For production: `https://yourdomain.com/auth/google/callback`
   - ⚠️ **The URL must match EXACTLY** (including http/https, port, path, trailing slashes)
7. Copy the Client ID and Client Secret to your `.env` file

**Troubleshooting `redirect_uri_mismatch` error:**
- Check that `GOOGLE_CALLBACK_URL` in your `.env` matches EXACTLY the URL in Google Cloud Console
- Common issues:
  - `http://` vs `https://` mismatch
  - Port mismatch (e.g., `:3000` vs `:8080`)
  - Path mismatch (e.g., `/auth/google/callback` vs `/auth/google/callback/`)
  - Domain mismatch (e.g., `localhost` vs `127.0.0.1`)
- When the backend starts, it will log the callback URL being used - verify it matches Google Cloud Console
- In Google Cloud Console, you can add multiple authorized redirect URIs (one for dev, one for prod)

### 6. Generate Prisma Client

```bash
npm run prisma:generate
```

### 7. Run Migrations

This will create all tables in the database:
```bash
npm run prisma:migrate -- --name init
```

**Verify it worked:**
You can check in DBeaver or via psql:
```bash
psql -U your_user -d trullygiveaway -c "\dt"
```

Should show the `User` and `ConnectedAccount` tables.

### 8. Start the Application

**Development mode (with hot-reload):**
```bash
npm run start:dev
```

**Production mode:**
```bash
npm run build
npm run start:prod
```

The API will be available at `http://localhost:3000` (or the port configured in `.env`).

## 📝 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start in development mode with hot-reload |
| `npm run start:prod` | Start in production mode (requires build first) |
| `npm run build` | Compile TypeScript project to JavaScript |
| `npm run prisma:generate` | Generate Prisma Client after schema changes |
| `npm run prisma:migrate` | Run `prisma migrate dev` |
| `npm run prisma:studio` | Start Prisma Studio |
| `npm run format` | Format code with Prettier |

## 🗄️ Database Management

### Create New Migration

After changing the schema in `prisma/schema.prisma`:
```bash
npm run prisma:migrate -- --name migration_name
```

### View Data (Prisma Studio)

Web interface to view and edit data:
```bash
npm run prisma:studio
```

Access at `http://localhost:5555`

### Reset Database (CAUTION!)

**⚠️ This deletes all data:**
```bash
npx prisma migrate reset
```

## 🐳 Option: Use Docker (Optional)

If you prefer to use Docker for PostgreSQL instead of installing locally:

### PostgreSQL Only via Docker

```bash
docker compose up -d db
```

This starts only PostgreSQL. Run the API locally with `npm run start:dev`.

### Everything via Docker

```bash
docker compose up -d
```

This starts both PostgreSQL and API in containers.

**Note:** Docker is optional. You can use your own PostgreSQL without issues.

## 📁 Project Structure

```
backend/
├── src/
│   ├── auth/              # Authentication module (Google OAuth)
│   ├── user/              # User module
│   ├── connected-accounts/ # Connected accounts (Twitch, Kick, etc)
│   ├── ticket-config/     # Ticket configuration
│   ├── giveaway/          # Giveaway core
│   ├── realtime-gateway/  # WebSockets/real-time events
│   ├── social-giveaway/   # Multi-platform social integrations
│   ├── prisma/            # Prisma service
│   ├── app.module.ts      # Root module
│   └── main.ts            # Entry point
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Prisma migrations
├── .env                   # Environment variables (not versioned)
├── .env.example           # Environment variables example
└── package.json           # Dependencies and scripts
```

## 🔧 Troubleshooting

### Error: "The introspected database was empty"

This means the database is empty. Run migrations:
```bash
npm run prisma:migrate -- --name init
```

### PostgreSQL Connection Error

1. Check if PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   ```

2. Check if the database exists:
   ```bash
   psql -U your_user -l
   ```

3. Test connection manually:
   ```bash
   psql -U your_user -d trullygiveaway
   ```

4. Verify the `DATABASE_URL` in `.env` is correct

### Error: "Cannot find module '@prisma/client'"

Run:
```bash
npm run prisma:generate
```

## 📚 Additional Documentation

- [Nest.js Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## 🆘 Support

If you encounter issues, check:
1. Node.js version (`node --version`)
2. PostgreSQL version (`psql --version`)
3. Application logs
4. PostgreSQL logs (`sudo tail -f /var/log/postgresql/postgresql-*.log`)
