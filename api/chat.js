// Chat System - GitHub-based message storage with real-time polling
// Uses GITHUB_TOKEN from environment variables (set on Vercel)

const { getFile, putFile } = require('./gh');

// Helper: Extract and validate auth token from Authorization header
function extractAuthToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

// Helper: Verify token is valid
function validateAuthToken(token, userEmail) {
  if (!token || !userEmail) return false;
  if (typeof token !== 'string' || token.length < 10) {
    return false;
  }
  console.log(`✓ Token validated for user: ${userEmail}`);
  return true;
}

// Helper: Verify user owns a project
async function verifyProjectOwnership(projectId, userEmail) {
  try {
    // Try to fetch the project from projects.json to verify ownership
    const projectsData = await getFile('/data/projects.json');
    const projects = JSON.parse(projectsData.content || '[]');
    
    const userOwnsProject = projects.some(p => p.id === projectId && p.userEmail === userEmail);
    
    if (!userOwnsProject) {
      console.warn(`🚫 User ${userEmail} does not own project ${projectId}`);
      return false;
    }
    
    console.log(`✓ Project ownership verified: ${projectId} belongs to ${userEmail}`);
    return true;
  } catch (error) {
    console.error('Error verifying project ownership:', error.message);
    return false;
  }
}

// Helper: Read chat file from GitHub
async function readChatFile(chatFileKey) {
  try {
    const data = await getFile(`/data/chats/${chatFileKey}.json`);
    const content = JSON.parse(data.content || '{}');
    return content && content.messages ? content : { messages: [] };
  } catch (e) {
    return { messages: [] }; // New chat
  }
}

// Helper: Write chat file to GitHub
async function writeChatFile(chatFileKey, chatData) {
  try {
    await putFile(`/data/chats/${chatFileKey}.json`, JSON.stringify(chatData, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing chat file:', error);
    throw error;
  }
}

// ✅ POST /api/chat/send - Send a message (with auth validation)
async function handleChatSend(req, res) {
  try {
    const { projectId, userEmail, senderType, senderEmail, text } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Missing required field: projectId' });
    }
    if (!userEmail) {
      return res.status(400).json({ error: 'Missing required field: userEmail' });
    }
    if (!senderType) {
      return res.status(400).json({ error: 'Missing required field: senderType' });
    }
    if (!senderEmail) {
      return res.status(400).json({ error: 'Missing required field: senderEmail' });
    }
    if (!text) {
      return res.status(400).json({ error: 'Missing required field: text' });
    }
    
    if (!['user', 'admin'].includes(senderType)) {
      return res.status(400).json({ error: 'Invalid senderType (must be "user" or "admin")' });
    }
    
    const token = extractAuthToken(req);
    if (!token) {
      console.warn('🚫 Chat send: Missing authentication token');
      return res.status(401).json({ error: 'Missing or invalid authentication token' });
    }
    
    if (senderType === 'user') {
      if (!validateAuthToken(token, userEmail)) {
        console.warn(`🚫 Chat send: Invalid token for user ${userEmail}`);
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
      }
      
      if (senderEmail !== userEmail) {
        console.warn(`🚫 Chat send: User sender email ${senderEmail} does not match project owner ${userEmail}`);
        return res.status(403).json({ error: 'User cannot send messages from a different email' });
      }
      
      const ownsProject = await verifyProjectOwnership(projectId, userEmail);
      if (!ownsProject) {
        console.warn(`🚫 Chat send: User ${userEmail} does not own project ${projectId}`);
        return res.status(403).json({ error: 'You do not have permission to message this project' });
      }
    } else if (senderType === 'admin') {
      if (!validateAuthToken(token, senderEmail)) {
        console.warn(`🚫 Chat send: Invalid admin token for ${senderEmail}`);
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
      }
      console.log(`✓ Admin ${senderEmail} verified to message project ${projectId}`);
    }
    
    const chatFileKey = `${projectId}_${userEmail}`;
    const chatData = await readChatFile(chatFileKey);
    
    const message = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sender: senderType,
      senderEmail: senderEmail,
      text: text,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    chatData.messages = chatData.messages || [];
    chatData.messages.push(message);
    
    await writeChatFile(chatFileKey, chatData);
    
    console.log(`✓ Message sent: ${projectId} | ${senderType} ${senderEmail}`);
    res.json({ success: true, message: message });
  } catch (error) {
    console.error('Chat send error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ✅ GET /api/chat/messages - Load chat messages (with auth validation)
async function handleChatMessages(req, res) {
  try {
    const { projectId, userEmail, viewerType } = req.query;
    
    if (!projectId || !userEmail) {
      return res.status(400).json({ error: 'Missing projectId or userEmail' });
    }
    
    const viewType = viewerType || 'user';
    if (!['admin', 'user'].includes(viewType)) {
      return res.status(400).json({ error: 'Invalid viewerType' });
    }
    
    const token = extractAuthToken(req);
    if (!token) {
      console.warn('🚫 Chat messages: Missing authentication token');
      return res.status(401).json({ error: 'Missing or invalid authentication token' });
    }
    
    if (viewType === 'admin') {
      if (!validateAuthToken(token, userEmail)) {
        console.warn(`🚫 Chat messages: Invalid admin token`);
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
      }
      console.log(`✓ Admin loading messages for project ${projectId}`);
    } else {
      if (!validateAuthToken(token, userEmail)) {
        console.warn(`🚫 Chat messages: Invalid token for user ${userEmail}`);
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
      }
      
      const ownsProject = await verifyProjectOwnership(projectId, userEmail);
      if (!ownsProject) {
        console.warn(`🚫 Chat messages: User ${userEmail} attempted to access messages for project ${projectId} they don't own`);
        return res.status(403).json({ error: 'You do not have permission to access this chat' });
      }
    }
    
    const chatFileKey = `${projectId}_${userEmail}`;
    const chatData = await readChatFile(chatFileKey);
    
    console.log(`📨 Loaded ${chatData.messages.length} messages for ${chatFileKey}`);
    res.json(chatData.messages);
  } catch (error) {
    console.error('Chat messages error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ✅ PUT /api/chat/mark-read - Mark messages as read (with auth validation)
async function handleMarkMessagesAsRead(req, res) {
  try {
    const { projectId, userEmail, messageIds, viewerType } = req.body;
    
    if (!projectId || !userEmail || !Array.isArray(messageIds)) {
      return res.status(400).json({ error: 'Missing projectId, userEmail, or messageIds' });
    }
    
    const viewType = viewerType || 'user';
    if (!['admin', 'user'].includes(viewType)) {
      return res.status(400).json({ error: 'Invalid viewerType' });
    }
    
    const token = extractAuthToken(req);
    if (!token) {
      console.warn('🚫 Mark read: Missing authentication token');
      return res.status(401).json({ error: 'Missing or invalid authentication token' });
    }
    
    if (viewType === 'admin') {
      if (!validateAuthToken(token, userEmail)) {
        console.warn(`🚫 Mark read: Invalid admin token`);
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
      }
    } else {
      if (!validateAuthToken(token, userEmail)) {
        console.warn(`🚫 Mark read: Invalid token for user ${userEmail}`);
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
      }
      
      const ownsProject = await verifyProjectOwnership(projectId, userEmail);
      if (!ownsProject) {
        console.warn(`🚫 Mark read: User ${userEmail} attempted to mark read for project ${projectId} they don't own`);
        return res.status(403).json({ error: 'You do not have permission to access this chat' });
      }
    }
    
    const chatFileKey = `${projectId}_${userEmail}`;
    const chatData = await readChatFile(chatFileKey);
    
    // Mark messages as read and set deleteAt for expired messages
    const beforeCount = chatData.messages.length;
    chatData.messages.forEach(msg => {
      if (messageIds.includes(msg.id)) {
        msg.read = true;
      }
    });
    
    // Auto-delete read messages after 30 days
    const now = new Date();
    chatData.messages = chatData.messages.filter(msg => {
      if (msg.deleteAt && new Date(msg.deleteAt) < now) {
        return false;
      }
      return true;
    });
    const removedCount = beforeCount - chatData.messages.length;
    
    await writeChatFile(chatFileKey, chatData);
    
    console.log(`✓ Marked ${messageIds.length} messages as read; removed ${removedCount} expired messages`);
    res.json({ success: true, unreadCount: chatData.messages.filter(m => !m.read).length });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ✅ GET /api/chat/unread-count - Get unread count for a chat (with auth validation)
async function handleUnreadCount(req, res) {
  try {
    const { projectId, userEmail, viewerType } = req.query;
    
    if (!projectId || !userEmail) {
      return res.status(400).json({ error: 'Missing projectId or userEmail' });
    }
    
    const viewType = viewerType || 'user';
    if (!['admin', 'user'].includes(viewType)) {
      return res.status(400).json({ error: 'Invalid viewerType' });
    }
    
    const token = extractAuthToken(req);
    if (!token) {
      console.warn('🚫 Unread count: Missing authentication token');
      return res.status(401).json({ error: 'Missing or invalid authentication token' });
    }
    
    if (viewType === 'admin') {
      if (!validateAuthToken(token, userEmail)) {
        console.warn(`🚫 Unread count: Invalid admin token`);
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
      }
      console.log(`✓ Admin checking unread count for project ${projectId}`);
    } else {
      if (!validateAuthToken(token, userEmail)) {
        console.warn(`🚫 Unread count: Invalid token for user ${userEmail}`);
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
      }
      
      const ownsProject = await verifyProjectOwnership(projectId, userEmail);
      if (!ownsProject) {
        console.warn(`🚫 Unread count: User ${userEmail} attempted to access unread count for project ${projectId} they don't own`);
        return res.status(403).json({ error: 'You do not have permission to access this chat' });
      }
    }
    
    const chatFileKey = `${projectId}_${userEmail}`;
    const chatData = await readChatFile(chatFileKey);
    
    const unreadMessages = chatData.messages.filter(msg => {
      if (!msg.read) {
        if (viewType === 'user' && msg.sender === 'admin') return true;
        if (viewType === 'admin' && msg.sender === 'user') return true;
      }
      return false;
    });
    
    console.log(`📊 Unread count for ${chatFileKey}: ${unreadMessages.length} messages`);
    res.json({ unreadCount: unreadMessages.length, messages: unreadMessages });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  handleChatSend,
  handleChatMessages,
  handleMarkMessagesAsRead,
  handleUnreadCount
};
