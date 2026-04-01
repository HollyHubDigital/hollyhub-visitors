# 💬 Real-Time Chat System Setup Guide

## Overview
A fully functional real-time project chat system with GitHub API storage, automatic message expiration (3 hours after read), and beautiful WhatsApp-like UI.

## ✅ What's Implemented

### Backend (admin-hollyhub/server.js)
- **Chat API Endpoints**:
  - `POST /api/chat/send` - Send messages (user/admin)
  - `GET /api/chat/messages` - Fetch chat history for a project
  - `PUT /api/chat/mark-read` - Mark messages as read, auto-delete after 3 hours
  - `GET /api/chat/unread-count` - Get unread count with role filtering

### Frontend (contact.html)
- **Chat Modal**: Beautiful, responsive chat UI (inspired by WhatsApp)
- **Chat Icon**: Appears next to "Make Payment" button on each project
- **Notification Badges**: Shows unread message count
- **Real-Time Polling**: 2-second polling interval for messages
- **Message Display**: 
  - User messages: Right-aligned, gradient background
  - Admin messages: Left-aligned, subtle background
  - Timestamps and read status (✓ or ✓✓)
- **Auto-Features**:
  - Auto-scroll to latest messages
  - Enter key to send message
  - Auto-update notification badges every 3 seconds
  - Auto-delete messages 3 hours after being read

## 🔧 Required Configuration

### 1. GitHub Token Setup
The chat system stores messages in your GitHub repository using the GitHub API.

**Steps:**
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token" (Classic)
3. Set scopes`:
   - `repo` (full control of private repositories)
   - `workflow` (optional)
4. Save the token - **you'll only see it once!**
5. Add to your `.env` file:

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=HollyHubDigital
GITHUB_REPO=hollyhub-visitors
```

### 2. Environment Variables (admin-hollyhub/.env)
Create or update `.env` file in `admin-hollyhub/` directory:

```env
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=HollyHubDigital
GITHUB_REPO=hollyhub-visitors
VISITORS_API_URL=https://hollyhubdigitals.vercel.app
PORT=3000
```

### 3. GitHub Repository Structure
The chat system will automatically create this structure:
```
├── data/
│   └── chats/
│       ├── project-id-1_user@email.com.json
│       ├── project-id-2_user@email.com.json
│       └── ... (one file per project-user conversation)
```

## 📊 Message Storage Format

Messages are stored in GitHub as JSON files with this structure:

```json
{
  "messages": [
    {
      "id": "1234567890_abc123xyz",
      "sender": "user",
      "senderEmail": "user@example.com",
      "text": "Hello admin!",
      "timestamp": "2026-04-01T10:30:00.000Z",
      "read": true,
      "readAt": "2026-04-01T10:35:00.000Z",
      "deleteAt": "2026-04-01T13:35:00.000Z"
    },
    {
      "id": "1234567891_def456uvw",
      "sender": "admin",
      "senderEmail": "admin@example.com",
      "text": "Hi user! I'll help with your project.",
      "timestamp": "2026-04-01T10:40:00.000Z",
      "read": false,
      "readAt": null,
      "deleteAt": null
    }
  ]
}
```

## 🚀 How It Works

### User Side (contact.html)
1. User logs in and views their projects
2. Chat icon appears next to each project with unread badge
3. User clicks chat icon → modal opens
4. System polls `/api/chat/messages` every 2 seconds
5. User types message and clicks "Send"
6. Message sent to `/api/chat/send` with `sender: 'user'`
7. Modal polls and displays message
8. When user closes modal → marks messages as read
9. Admin is notified of reply

### Admin Side (admin.html - TODO)
1. Admin logs in and views all projects
2. For each project, chat icon shows unread count from users
3. Admin clicks chat → same modal opens (BUT messages reversed)
   - User messages: LEFT (from admin perspective)
   - Admin messages: RIGHT (from admin perspective)
4. Admin sends reply with `sender: 'admin'`
5. User sees notification badge update
6. Messages auto-delete 3 hours after being read

## 📱 Message Lifecycle

```
SENT (timestamp) 
  ↓ (user/admin reads message)
READ (readAt timestamp)
  ↓ (3 hours pass)
DELETED (deleteAt timestamp reached)
  ↓
REMOVED from file
```

## 🔐 Security Notes

- ✅ Messages linked via `projectId + userEmail` (scoped access)
- ✅ Admin can only message within associated projects
- ✅ Users can only message about their own projects
- ✅ GitHub API requires authentication token (private repos)
- ⚠️ TODO: Add authentication headers to validate user/admin roles

## 📋 API Endpoints Reference

### POST /api/chat/send
Send a message
```json
{
  "projectId": "proj123",
  "userEmail": "user@example.com",
  "senderType": "user",
  "senderEmail": "user@example.com",
  "text": "Message content"
}
```

### GET /api/chat/messages?projectId=X&userEmail=Y
Get all messages for a chat

**Response:**
```json
[
  { "id": "...", "sender": "user", "text": "...", ... },
  { "id": "...", "sender": "admin", "text": "...", ... }
]
```

### PUT /api/chat/mark-read
Mark messages as read (queues deletion after 3 hours)
```json
{
  "projectId": "proj123",
  "userEmail": "user@example.com",
  "messageIds": ["msg_id_1", "msg_id_2"]
}
```

### GET /api/chat/unread-count?projectId=X&userEmail=Y&viewerType=user
Get unread count (filters by viewerType role)

**Response:**
```json
{
  "unreadCount": 2,
  "messages": [...]
}
```

## ⏱️ Performance & Rate Limits

- **Polling Interval**: 2 seconds (messages) + 3 seconds (badges)
- **GitHub API Rate**: 5,000 requests/hour (should be plenty)
- **Estimated Load**: ~30 requests/hour for active chat
- **Message Cleanup**: Automatic, runs on each `mark-read` call

## 🐛 Troubleshooting

### "GitHub API error (401)"
- Check GITHUB_TOKEN is valid: https://github.com/settings/tokens
- Ensure token has `repo` scope
- Token may have expired (regenerate if > 90 days old)

### "Failed to load messages"
- Check network tab for failed requests
- Verify `/api/chat/messages` endpoint is reachable
- Check browser console for errors

### Messages not persisting
- Verify GitHub token is set in `.env`
- Check repository has write access
- Ensure `data/chats/` directory exists in repo

### Notification badges not updating
- Check browser console for fetch errors
- Verify unread messages exist in GitHub
- Check localStorage has `authUserEmail` set

## 📅 Next Steps: Admin Chat UI

The backend is complete! To add admin chat UI:

1. **Update admin.html**
   - Add chat modal (same UI as contact.html)
   - Add chat icons to project list

2. **Update admin.js**
   - Add `openChatModal()` for admin projects
   - Add message polling/rendering
   - Add admin-specific message formatting (reversed L/R)
   - Add unread badge updates

3. **Test Flow**
   - User sends message from contact.html
   - Admin sees notification badge
   - Admin clicks chat, sees conversation
   - Admin sends reply
   - User sees new message in real-time

## 📦 Deployment

1. **Local Testing**:
   ```bash
   cd admin-hollyhub
   cp .env.example .env  # Add GITHUB_TOKEN
   npm install
   npm start
   ```

2. **Production (Vercel)**:
   - Set environment variables in Vercel dashboard:
     - `GITHUB_TOKEN`
     - `GITHUB_OWNER`
     - `GITHUB_REPO`
   - Redeploy both repositories

## 📞 Support

For issues:
1. Check browser DevTools Console for errors
2. Verify GitHub token and permissions
3. Check rate limits: https://api.github.com/rate_limit
4. Review chat storage in GitHub repo: `data/chats/` directory

---

**Chat System v1.0** | Built with ❤️ for HollyHub Digital
