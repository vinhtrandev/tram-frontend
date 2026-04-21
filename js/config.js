/* ================================================
   TRẠM GỬI TÍN HIỆU - config.js  [v2 - optimised]
   ================================================ */

const CONFIG = {
    API_BASE: window.location.hostname === 'localhost'
        ? 'http://localhost:8080/api'
        : 'https://tram-backend.onrender.com/api',

    /* ── Star types ────────────────────────────── */
    STAR_TYPES: {
        shooting: { id: 'shooting', emoji: '💫', label: 'Sao Băng', size: [3, 5], color: '#a8d8ff', ttl: 4 * 60 * 60 * 1000, permanent: false },
        north: { id: 'north', emoji: '✦', label: 'Sao Bắc Đẩu', size: [5, 8], color: '#fff8c2', ttl: null, permanent: true },
        cluster: { id: 'cluster', emoji: '⋯', label: 'Chùm Sao', size: [3, 6], color: '#d4b8ff', ttl: 24 * 60 * 60 * 1000, permanent: false },
    },

    /* ── Points ────────────────────────────────── */
    POINTS: {
        SEND_SIGNAL: 5,
        VOID_HOLD: 10,
        SHOOTING_STAR: 50,
        BREATHING: 30,
        PATIENT_ASTRONAUT: 100,
        READ_10_STARS: 20,
        LIGHT_HOPE: 25,
        SHARE: 40,
        STREAK_1_3: 20,
        STREAK_4_6: 50,
        STREAK_7: 200,
        REACTION_RECEIVE: 3,
    },

    /* ── Missions ──────────────────────────────── */
    MISSIONS: [
        { id: 'void_hold', name: 'Chạm vào hư vô', desc: 'Giữ chuột vào Hố Đen trong 10 giây', reward: 20, icon: '🕳️', type: 'static', daily: true, max: 1 },
        { id: 'breathing', name: 'Hòa nhịp', desc: 'Thực hiện 3 chu kỳ thở (4-4-8)', reward: 20, icon: '🌬️', type: 'static', daily: true, max: 1 },
        { id: 'shooting_star', name: 'Ngắm sao băng', desc: 'Bắt được 1 ngôi sao băng bay qua', reward: 20, icon: '🌠', type: 'static', daily: true, max: 1 },
        { id: 'patient_astronaut', name: 'Phi hành gia kiên nhẫn', desc: 'Ở lại Trạm liên tục trong 30 phút', reward: 20, icon: '🧑‍🚀', type: 'static', daily: true, max: 1 },
        { id: 'read_stars', name: 'Vạn dặm kết nối', desc: 'Đọc tâm tư của 10 ngôi sao', reward: 20, icon: '👁️', type: 'social', daily: true, max: 1 },
        { id: 'light_hope', name: 'Thắp sáng hy vọng', desc: 'Tương tác với một ngôi sao buồn', reward: 20, icon: '🕯️', type: 'social', daily: true, max: 3 },
        { id: 'streak_7', name: 'Kỷ niệm chương', desc: 'Truy cập Trạm liên tục trong 7 ngày', reward: 200, icon: '🏅', type: 'streak', daily: false, max: 999 },
        { id: 'light_candle', name: 'Ngọn nến thiện lành', desc: 'Thắp nến cho 5 tín hiệu của người lạ trên bản đồ thiên hà', reward: 20, icon: '🕯️', type: 'social', daily: true, max: 5 },
        { id: 'void_negative', name: 'Giải phóng bóng tối', desc: 'Viết ít nhất 3 dòng suy nghĩ tiêu cực, gửi đi và kéo thả vào hố đen', reward: 20, icon: '🌑', type: 'static', daily: true, max: 1 },
        { id: 'hug_meteor', name: 'Ôm sao băng', desc: 'Tìm một ngôi sao sắp tan biến và nhấn "Gửi ôm" để tiếp thêm 5 phút tỏa sáng', reward: 20, icon: '🌠', type: 'social', daily: true, max: 1 },
    ],

    /* ── Store ─────────────────────────────────── */
    STORE: {
        experience: [
            { id: 'sound_rain', name: 'Tiếng mưa Đà Lạt', price: 100, desc: 'Mở khóa tiếng thông reo & mưa đêm Đà Lạt', icon: '🌧️' },
            { id: 'sound_wave', name: 'Tiếng sóng đêm', price: 150, desc: 'Mở khóa tiếng sóng vỗ mạn thuyền trong đêm', icon: '🌊' },
            { id: 'sound_wind', name: 'Chuông gió ngân xa', price: 200, desc: 'Mở khóa tiếng chuông gió nhẹ nhàng', icon: '🔔' },
            { id: 'future_letter', name: 'Lá thư tương lai', price: 800, desc: 'Viết thư cho mình & nhận lại sau 1 tháng qua web', icon: '📮' },
            { id: 'meditation', name: 'Hướng dẫn thiền định', price: 1000, desc: 'Mở khóa các bài dẫn thiền ngắn giải tỏa tức thì', icon: '🧘' },
        ],
        real: [
            { id: 'handwritten_letter', name: 'Thư tay từ vũ trụ', price: 3500, desc: 'Nhận một lá thư tay viết lời động viên từ nhóm vận hành hoặc tình nguyện viên — gửi qua đường bưu điện đến tay bạn', icon: '✉️' },
            { id: 'voucher_cafe', name: 'Voucher "Góc Yên Tĩnh"', price: 1500, desc: 'Giảm 15-20% tại quán cafe sách & tiệm trà đối tác', icon: '☕' },
            { id: 'gift_box', name: 'Hộp quà "Tín Hiệu"', price: 3500, desc: 'Bộ Kit: nến thơm, sáp thơm, trà hoa & lá thư ẩn danh gửi về nhà', icon: '📦' },
        ],
        community: [
            { id: 'plant_tree', name: 'Gieo mầm hy vọng', price: 5000, desc: 'Nhóm dự án thay bạn trồng 1 cây xanh tại khu phòng hộ', icon: '🌱' },
            { id: 'meal_children', name: 'Bữa cơm ấm áp', price: 7000, desc: 'Quy đổi thành suất ăn cho trẻ em mái ấm. Nhận chứng nhận "Sứ giả ánh sáng"', icon: '🍚' },
        ],
    },

    /* ── Quotes ────────────────────────────────── */
    QUOTES: [
        'Thế giới ngoài kia ồn ào quá, cảm ơn bạn đã chọn dừng chân ở đây một chút.',
        'Đừng lo lắng về những gì bạn chưa làm được. Đêm nay, việc duy nhất bạn cần làm là bình yên.',
        'Mỗi ngôi sao bạn thắp sáng trên đây là một niềm tin gửi đến tương lai.',
        'Hơi thở của bạn là món quà quý giá nhất. Hãy trân trọng nó ngay lúc này.',
        'Em đã làm rất tốt hôm nay rồi, nghỉ ngơi một chút nhé.',
        'Bạn không cô đơn. Hàng ngàn ngôi sao đang lắng nghe bạn đây.',
        'Chỉ cần bạn ở đây, hít thở, và tin rằng mọi thứ sẽ ổn.',
        'Nỗi buồn cũng giống như những đám mây, chúng đến rồi sẽ đi, chỉ có bầu trời trong bạn là mãi mãi.',
        'Gói ghém muộn phiền gửi vào hư vô, ngày mai khi thức dậy, bạn sẽ là một phiên bản nhẹ nhàng hơn.',
        'Bạn không cần phải mạnh mẽ mọi lúc. Ở đây, bạn được phép yếu đuối và để vũ trụ ôm ấp lấy mình.',
        'Hãy để bóng tối bao bọc lấy mệt mỏi của bạn, và để ánh sao dẫn lối cho trái tim.',
        'Hãy cứ tỏa sáng theo cách của riêng bạn, vũ trụ này cần ánh sáng đó.',
        'Một cái ôm từ xa gửi đến bạn. Mong bạn cảm nhận được hơi ấm giữa không gian vô tận này.',
        'Tín hiệu của bạn đã được tiếp nhận. Vũ trụ đang gửi lại cho bạn một lời hồi đáp bình yên.',
        'Vũ trụ không im lặng. Đó là một bản nhạc không lời, chỉ cần lắng nghe bằng cả tâm hồn, bạn sẽ nghe thấy nhịp thở của ngàn vì sao.',
    ],

    /* ── Keyword filters ───────────────────────── */
    NEGATIVE_KEYWORDS: [
        'mệt', 'buồn', 'khóc', 'cô đơn', 'chán', 'tệ', 'sợ', 'lo',
        'áp lực', 'stress', 'đau', 'thất bại', 'tuyệt vọng', 'bất lực',
        'trống rỗng', 'vô nghĩa', 'vô dụng', 'vô vọng', 'lạc lõng',
        'hoang mang', 'bế tắc', 'mệt mỏi', 'kiệt sức', 'nản',
        'ghét bản thân', 'ghét mình', 'xấu hổ', 'tự ti', 'kém cỏi',
        'không xứng', 'không đủ tốt', 'hối hận', 'ân hận', 'tội lỗi',
        'không ai hiểu', 'không ai quan tâm', 'bị bỏ rơi', 'bị phản bội',
        'một mình', 'nhớ nhà', 'bị lãng quên', 'xa cách',
        'hoảng loạn', 'lo lắng', 'sợ hãi', 'ám ảnh', 'bất an',
        'không yên', 'ức chế', 'bực bội',
        'burn out', 'burnout', 'đuối', 'ngộp', 'tụt mood', 'down',
        'overthink', 'suy sụp', 'gục ngã', 'tan vỡ',
        'chịu không nổi', 'quá sức', 'không còn sức',
    ],

    CRISIS_KEYWORDS: [
        'không muốn sống', 'không muốn tiếp tục', 'muốn biến mất',
        'muốn chết', 'tự tử', 'kết thúc tất cả', 'không còn lý do sống',
        'bỏ lại tất cả', 'ra đi mãi mãi', 'không muốn tồn tại',
        'chán sống', 'sống để làm gì', 'còn sống làm gì',
    ],

    TOXIC_KEYWORDS: [
        'đần', 'dốt', 'óc chó', 'bại não', 'súc vật',
        'vcl', 'vch', 'hãm', 'bê đê',
        'ngu si', 'rẻ rác', 'đồ bỏ đi', 'đồ vứt đi',
        'đồ chết tiệt', 'đồ khốn', 'đồ vô dụng',
        'đồ thất bại', 'đồ tệ hại', 'khốn nạn',
        'địt', 'lồn', 'cặc', 'đéo', 'đụ', 'buồi',
        'vãi lồn', 'vãi cặc', 'đm', 'đmm', 'dmm', 'dm',
        'con chó', 'con lợn', 'đồ chó', 'thằng chó',
        'mặt lồn', 'thằng điên', 'con điên', 'đứa điên',
    ],

    TOXIC_PHRASES: [
        'mày chết', 'tao ghét mày', 'tao khinh mày',
        'mày ngu', 'mày dốt', 'mày tệ',
        'giết mày', 'đánh mày', 'muốn giết',
        'đồ ngu', 'đồ ngốc', 'thằng ngu', 'con ngu',
        'thằng hèn', 'con hèn', 'thằng bẩn', 'con bẩn',
    ],

    /* ── Timing ────────────────────────────────── */
    SHOOTING_STAR_INTERVAL: 15 * 60 * 1000,
    METEOR_RAIN_INTERVAL: 15 * 60 * 1000,
    VOID_HOLD_DURATION: 10_000,
    PATIENT_DURATION: 30 * 60 * 1000,
};

/* ── Global app state ───────────────────────── */
const STATE = {
    user: null,
    points: 0,
    dailyMissions: {},
    streak: [],
    starsRead: 0,
    activeStarType: 'shooting',
    currentSound: 'rain',
    patientTimer: null,
    patientStart: null,
    unlocked: {},
};

/* ── Single text-filter utility (shared across all modules) ─── */
const TextFilter = (() => {
    const _norm = s => s.toLowerCase().normalize('NFC');
    const _lower = (text) => _norm(text || '');

    return {
        isToxic(text) {
            const t = _lower(text);
            if (!t) return false;
            if (CONFIG.TOXIC_KEYWORDS.some(k => t.includes(_norm(k)))) return true;
            if (CONFIG.TOXIC_PHRASES.some(p => t.includes(_norm(p)))) return true;
            return false;
        },
        isCrisis(text) {
            const t = _lower(text);
            return CONFIG.CRISIS_KEYWORDS.some(k => t.includes(_norm(k)));
        },
        isNegative(text) {
            const t = _lower(text);
            return CONFIG.NEGATIVE_KEYWORDS.some(k => t.includes(_norm(k)));
        },
        hasMood(text) {
            // subset of NEGATIVE that indicates emotional state for mood hint
            const MOOD = [
                'buồn', 'mệt', 'chán', 'stress', 'áp lực', 'bế tắc',
                'lo sợ', 'lo lắng', 'lo', 'tủi thân', 'cô đơn', 'mệt mỏi',
                'vô vọng', 'tuyệt vọng', 'nản', 'oải', 'sad',
            ];
            const t = _lower(text);
            return MOOD.some(k => t.includes(_norm(k)));
        },
    };
})();