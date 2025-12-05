const cron = require('node-cron');
const { processCompletedBookings } = require('../controllers/walletController');

// Chạy mỗi giờ để kiểm tra và xử lý các booking đã qua 24h
const startWalletCronJob = () => {
  // Chạy vào mỗi giờ đầu tiên (0 phút)
  cron.schedule('0 * * * *', async () => {
    console.log('🔄 Running wallet processing cron job...');
    try {
      const processed = await processCompletedBookings();
      console.log(`✅ Wallet cron job completed. Processed ${processed} bookings.`);
    } catch (error) {
      console.error('❌ Wallet cron job failed:', error);
    }
  });

  console.log('⏰ Wallet cron job scheduled (runs every hour)');
};

module.exports = { startWalletCronJob };
