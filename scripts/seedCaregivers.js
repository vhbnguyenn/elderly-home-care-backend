require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const CaregiverProfile = require('../src/models/CaregiverProfile');
const CaregiverSkill = require('../src/models/CaregiverSkill');
const { ROLES } = require('../src/constants');

// Danh sách tên Việt Nam
const firstNames = ['Nguyễn Văn', 'Trần Thị', 'Lê Văn', 'Phạm Thị', 'Hoàng Văn', 'Phan Thị', 'Vũ Văn', 'Đặng Thị', 'Bùi Văn', 'Đỗ Thị', 'Hồ Văn', 'Ngô Thị', 'Dương Văn', 'Lý Thị'];
const lastNames = ['An', 'Bình', 'Cường', 'Dũng', 'Em', 'Giang', 'Hà', 'Hương', 'Khánh', 'Lan', 'Mai', 'Nam', 'Phương', 'Quân', 'Sơn', 'Tâm', 'Thảo', 'Vân', 'Xuân', 'Yến'];

// Địa chỉ Việt Nam
const addresses = [
  'Quận 1, TP. Hồ Chí Minh',
  'Quận 2, TP. Hồ Chí Minh',
  'Quận 3, TP. Hồ Chí Minh',
  'Quận 4, TP. Hồ Chí Minh',
  'Quận 5, TP. Hồ Chí Minh',
  'Quận 7, TP. Hồ Chí Minh',
  'Quận 10, TP. Hồ Chí Minh',
  'Quận Bình Thạnh, TP. Hồ Chí Minh',
  'Quận Phú Nhuận, TP. Hồ Chí Minh',
  'Quận Tân Bình, TP. Hồ Chí Minh',
  'Quận Gò Vấp, TP. Hồ Chí Minh',
  'Huyện Bình Chánh, TP. Hồ Chí Minh',
  'Thành phố Thủ Đức, TP. Hồ Chí Minh',
];

// Kỹ năng chăm sóc
const skillList = [
  { name: 'Chăm sóc người cao tuổi', description: 'Chăm sóc toàn diện cho người cao tuổi', icon: 'elderly-care' },
  { name: 'Hỗ trợ di chuyển', description: 'Hỗ trợ đi lại, tập vật lý trị liệu', icon: 'mobility' },
  { name: 'Chăm sóc sau phẫu thuật', description: 'Chăm sóc bệnh nhân sau phẫu thuật', icon: 'surgery-care' },
  { name: 'Theo dõi sức khỏe', description: 'Theo dõi các chỉ số sức khỏe', icon: 'health-monitor' },
  { name: 'Quản lý thuốc men', description: 'Nhắc nhở và quản lý dùng thuốc', icon: 'medication' },
  { name: 'Vệ sinh cá nhân', description: 'Hỗ trợ vệ sinh, tắm rửa', icon: 'hygiene' },
  { name: 'Nấu ăn dinh dưỡng', description: 'Chuẩn bị bữa ăn phù hợp', icon: 'nutrition' },
  { name: 'Chăm sóc Alzheimer', description: 'Chăm sóc người bệnh sa sút trí tuệ', icon: 'alzheimer' },
  { name: 'Chăm sóc Parkinson', description: 'Chăm sóc bệnh nhân Parkinson', icon: 'parkinson' },
  { name: 'Chăm sóc bệnh tiểu đường', description: 'Theo dõi và chăm sóc bệnh nhân tiểu đường', icon: 'diabetes' },
  { name: 'Massage trị liệu', description: 'Massage phục hồi chức năng', icon: 'massage' },
  { name: 'Hỗ trợ tâm lý', description: 'Lắng nghe, động viên tinh thần', icon: 'mental-health' },
];

// Lịch sử làm việc
const workHistories = [
  'Làm việc tại Bệnh viện Chợ Rẫy 3 năm',
  'Chăm sóc tại gia đình 5 năm kinh nghiệm',
  'Làm việc tại Viện Dưỡng lão Thị Nghè 2 năm',
  'Điều dưỡng viên tại Bệnh viện Nhi Đồng 1',
  'Chăm sóc người cao tuổi tại Singapore 4 năm',
  'Nhân viên y tế tại phòng khám tư nhân',
  'Điều dưỡng tại Bệnh viện Đại học Y Dược',
];

// Bio mẫu
const bios = [
  'Tôi có nhiều năm kinh nghiệm chăm sóc người cao tuổi với sự tận tâm và chu đáo. Luôn đặt sức khỏe và tinh thần của người bệnh lên hàng đầu.',
  'Là người kiên nhẫn, tỉ mỉ và yêu thương người già. Tôi sẽ chăm sóc người thân của bạn như chính người thân của mình.',
  'Có chứng chỉ điều dưỡng và nhiều năm kinh nghiệm làm việc trong ngành y tế. Tôi hiểu rõ nhu cầu chăm sóc đặc biệt cho người cao tuổi.',
  'Tận tâm, chu đáo và nhiệt tình trong công việc chăm sóc sức khỏe người cao tuổi. Luôn học hỏi và cập nhật kiến thức mới.',
  'Đặt lợi ích người bệnh lên hàng đầu, làm việc có trách nhiệm và chuyên nghiệp.',
];

const educationLevels = [
  'Tốt nghiệp Trung cấp Điều dưỡng',
  'Tốt nghiệp Cao đẳng Y tế',
  'Tốt nghiệp Đại học Điều dưỡng',
  'Tốt nghiệp Đại học Y khoa',
  'Trung cấp chăm sóc sức khỏe',
];

// Hàm tạo số điện thoại ngẫu nhiên
const generatePhone = () => {
  const prefix = ['090', '091', '098', '097', '096', '086', '032', '033', '034', '035', '036', '037', '038', '039'];
  return prefix[Math.floor(Math.random() * prefix.length)] + Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
};

// Hàm tạo email ngẫu nhiên
const generateEmail = (index) => {
  return `caregiver${index}@example.com`;
};

// Hàm tạo ngày sinh ngẫu nhiên (25-55 tuổi)
const generateDOB = () => {
  const year = new Date().getFullYear() - (25 + Math.floor(Math.random() * 30));
  const month = Math.floor(Math.random() * 12);
  const day = Math.floor(Math.random() * 28) + 1;
  return new Date(year, month, day);
};

// Hàm tạo CMND/CCCD ngẫu nhiên
const generateIdCard = () => {
  return Math.floor(Math.random() * 900000000000 + 100000000000).toString();
};

// Hàm random một phần tử từ mảng
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Hàm random nhiều kỹ năng
const randomSkills = (num = 5) => {
  const shuffled = [...skillList].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, num);
};

const seedCaregivers = async () => {
  try {
    // Kết nối database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    console.log('📊 Database:', process.env.MONGO_URI.includes('mongodb+srv') ? 'PRODUCTION' : 'LOCAL');
    console.log('');

    // Hỏi xác nhận
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const numberOfCaregivers = await new Promise(resolve => {
      readline.question('Số lượng caregiver muốn tạo (mặc định 20): ', (answer) => {
        resolve(parseInt(answer) || 20);
      });
    });

    const confirm = await new Promise(resolve => {
      readline.question(`⚠️  Bạn có chắc muốn tạo ${numberOfCaregivers} caregivers vào database PRODUCTION? (yes/no): `, (answer) => {
        resolve(answer.toLowerCase() === 'yes');
      });
    });

    readline.close();

    if (!confirm) {
      console.log('❌ Hủy bỏ thao tác');
      process.exit(0);
    }

    console.log(`\n🚀 Bắt đầu tạo ${numberOfCaregivers} caregivers...\n`);

    const createdCaregivers = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i <= numberOfCaregivers; i++) {
      try {
        const name = `${randomItem(firstNames)} ${randomItem(lastNames)}`;
        const email = generateEmail(Date.now() + i);
        const phone = generatePhone();
        const gender = Math.random() > 0.5 ? 'Nam' : 'Nữ';
        
        // Tạo user
        const userData = {
          name,
          email,
          password: '123456', // Password mặc định
          role: ROLES.CAREGIVER,
          phone,
          isActive: true,
          isEmailVerified: true
        };

        const user = await User.create(userData);

        // Tạo caregiver profile
        const profileData = {
          user: user._id,
          phoneNumber: phone,
          dateOfBirth: generateDOB(),
          gender,
          permanentAddress: randomItem(addresses),
          temporaryAddress: randomItem(addresses),
          idCardNumber: generateIdCard(),
          yearsOfExperience: Math.floor(Math.random() * 15) + 1,
          workHistory: randomItem(workHistories),
          education: randomItem(educationLevels),
          bio: randomItem(bios),
          agreeToEthics: true,
          agreeToTerms: true,
          profileStatus: 'approved', // Đã được duyệt
          // Bank account
          bankAccount: {
            bankName: 'Vietcombank',
            bankCode: 'VCB',
            accountNumber: Math.floor(Math.random() * 9000000000000 + 1000000000000).toString(),
            accountName: name.toUpperCase()
          }
        };

        const profile = await CaregiverProfile.create(profileData);

        // Tạo skills
        const skills = randomSkills(Math.floor(Math.random() * 5) + 3); // 3-7 skills
        const skillPromises = skills.map(skill => 
          CaregiverSkill.create({
            caregiver: user._id,
            name: skill.name,
            description: skill.description,
            icon: skill.icon,
            isDisplayedOnProfile: true,
            isActive: true
          })
        );

        await Promise.all(skillPromises);

        successCount++;
        createdCaregivers.push({
          email,
          name,
          password: '123456'
        });

        console.log(`✅ [${i}/${numberOfCaregivers}] Tạo thành công: ${name} (${email})`);

      } catch (error) {
        errorCount++;
        console.error(`❌ [${i}/${numberOfCaregivers}] Lỗi:`, error.message);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 KẾT QUẢ SEEDING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Thành công: ${successCount}/${numberOfCaregivers}`);
    console.log(`❌ Thất bại: ${errorCount}/${numberOfCaregivers}`);
    console.log('');
    console.log('🔑 Tất cả caregivers có password: 123456');
    console.log('');
    
    if (createdCaregivers.length > 0) {
      console.log('📋 DANH SÁCH CAREGIVERS ĐÃ TẠO:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      createdCaregivers.slice(0, 10).forEach((cg, idx) => {
        console.log(`${idx + 1}. ${cg.name}`);
        console.log(`   📧 ${cg.email}`);
        console.log(`   🔑 ${cg.password}`);
        console.log('');
      });
      
      if (createdCaregivers.length > 10) {
        console.log(`... và ${createdCaregivers.length - 10} caregivers khác`);
      }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
};

seedCaregivers();
