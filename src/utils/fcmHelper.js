/**
 * Firebase Cloud Messaging Helper
 * 
 * Setup Instructions:
 * 1. Tạo Firebase project tại https://console.firebase.google.com/
 * 2. Vào Project Settings > Service Accounts
 * 3. Click "Generate new private key" → Lưu file JSON
 * 4. Đặt file JSON vào thư mục config/ với tên firebase-admin-sdk.json
 * 5. Thêm vào .env: FIREBASE_PROJECT_ID=your-project-id
 * 6. Mobile app phải đăng ký FCM token và gửi lên backend (lưu vào User.fcmToken)
 */

let admin;
let isFirebaseInitialized = false;

const initializeFirebase = () => {
  if (isFirebaseInitialized) {
    return admin;
  }

  try {
    // Import firebase-admin (cần cài: npm install firebase-admin)
    admin = require('firebase-admin');
    
    // Đọc service account key
    const serviceAccount = require('../../config/firebase-admin-sdk.json');
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });
    
    isFirebaseInitialized = true;
    console.log('✅ Firebase Admin initialized');
    return admin;
  } catch (error) {
    console.warn('⚠️ Firebase not initialized:', error.message);
    console.warn('💡 Video call notifications will only work via Socket.IO');
    return null;
  }
};

/**
 * Send incoming call notification via FCM
 * @param {Object} params
 * @param {String} params.fcmToken - FCM token của người nhận
 * @param {String} params.callId - ID của cuộc gọi
 * @param {Object} params.caller - Thông tin người gọi
 * @param {String} params.callType - 'video' hoặc 'audio'
 */
const sendIncomingCallNotification = async ({ fcmToken, callId, caller, callType = 'video' }) => {
  if (!admin || !isFirebaseInitialized) {
    console.warn('Firebase not initialized, skipping FCM notification');
    return { success: false, error: 'Firebase not initialized' };
  }

  if (!fcmToken) {
    console.warn('No FCM token provided, skipping FCM notification');
    return { success: false, error: 'No FCM token' };
  }

  try {
    const message = {
      token: fcmToken,
      notification: {
        title: `Incoming ${callType} call`,
        body: `${caller.name} is calling you...`,
        sound: 'default'
      },
      data: {
        type: 'incoming_call',
        callId: callId.toString(),
        callerId: caller._id.toString(),
        callerName: caller.name,
        callerAvatar: caller.avatar || '',
        callType
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'video_calls',
          priority: 'high',
          sound: 'ringtone',
          tag: callId.toString() // Replace previous notification with same callId
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: `Incoming ${callType} call`,
              body: `${caller.name} is calling you...`
            },
            sound: 'ringtone.caf',
            'content-available': 1,
            category: 'INCOMING_CALL'
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('✅ FCM notification sent:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('❌ Error sending FCM notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send call ended notification
 * @param {Object} params
 */
const sendCallEndedNotification = async ({ fcmToken, callId, duration, endedBy }) => {
  if (!admin || !isFirebaseInitialized || !fcmToken) {
    return { success: false };
  }

  try {
    const message = {
      token: fcmToken,
      notification: {
        title: 'Call Ended',
        body: `Call duration: ${Math.floor(duration / 60)}m ${duration % 60}s`
      },
      data: {
        type: 'call_ended',
        callId: callId.toString(),
        duration: duration.toString(),
        endedBy: endedBy.toString()
      }
    };

    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending call ended notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send missed call notification
 * @param {Object} params
 */
const sendMissedCallNotification = async ({ fcmToken, callId, caller }) => {
  if (!admin || !isFirebaseInitialized || !fcmToken) {
    return { success: false };
  }

  try {
    const message = {
      token: fcmToken,
      notification: {
        title: 'Missed Call',
        body: `You missed a call from ${caller.name}`
      },
      data: {
        type: 'missed_call',
        callId: callId.toString(),
        callerId: caller._id.toString(),
        callerName: caller.name
      }
    };

    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending missed call notification:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  initializeFirebase,
  sendIncomingCallNotification,
  sendCallEndedNotification,
  sendMissedCallNotification
};
