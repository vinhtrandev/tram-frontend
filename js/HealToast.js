/* ================================================
   TRẠM GỬI TÍN HIỆU - heal-toast.js
   Câu an ủi / chữa lành hiện lên top-center
   sau khi người dùng gửi tín hiệu
   ================================================ */

const HealToast = (() => {

    const MESSAGES = [
        'Hơi thở của bạn là món quý giá nhất. Hãy trân trọng nó ngay lúc này.',
        'Hôm nay bạn đã bước qua được. Đó là điều tuyệt vời nhất.',
        'Cảm xúc của bạn có giá trị. Bạn được phép cảm thấy như vậy.',
        'Vũ trụ đã lắng nghe. Bạn không bao giờ nói vào khoảng trống.',
        'Mỗi tín hiệu bạn gửi đi là một hành động dũng cảm.',
        'Bạn không cần phải mạnh mẽ mọi lúc. Nghỉ ngơi cũng là tiến về phía trước.',
        'Có người đang nhìn lên cùng một bầu trời với bạn, ngay lúc này.',
        'Điều bạn đang cảm thấy — ai đó ngoài kia cũng đang cảm thấy như vậy.',
        'Bạn đã đi được đến hôm nay. Đó là đủ rồi.',
        'Ánh sáng không cần phải to mới soi sáng được bóng tối.',
        'Giữa vũ trụ rộng lớn này, tín hiệu của bạn chạm đến một ngôi sao.',
        'Bạn xứng đáng được yêu thương — kể cả từ chính bản thân mình.',
        'Mỗi ngày bạn còn ở đây là một điều kỳ diệu.',
        'Hít vào nhẹ nhàng. Thở ra từ từ. Bạn đang ổn.',
        'Không ai trong vũ trụ này giống bạn. Điều đó thật đặc biệt.',
        'Đôi khi gửi đi cảm xúc là cách chữa lành dũng cảm nhất.',
        'Tín hiệu của bạn đang bay giữa các vì sao. Bạn thuộc về nơi đây.',
        'Mọi cảm xúc rồi sẽ qua. Nhưng khoảnh khắc này, bạn không cô đơn.',
        'Bạn làm tốt hơn bạn nghĩ rất nhiều.',
        'Trạm đã nhận được tín hiệu. Cảm ơn bạn đã tin tưởng chia sẻ.',
    ];

    let lastIndex = -1;

    function _getRandom() {
        let idx;
        do { idx = Math.floor(Math.random() * MESSAGES.length); }
        while (idx === lastIndex);
        lastIndex = idx;
        return MESSAGES[idx];
    }

    function show() {
        // Xóa cái cũ nếu đang hiển thị
        const old = document.getElementById('heal-toast');
        if (old) {
            old.remove();
        }

        const el = document.createElement('div');
        el.id = 'heal-toast';
        el.textContent = _getRandom();
        document.body.appendChild(el);

        // Kích hoạt animation vào
        requestAnimationFrame(() => {
            requestAnimationFrame(() => el.classList.add('visible'));
        });

        // Tự ẩn sau 4.5s
        setTimeout(() => {
            el.classList.remove('visible');
            el.classList.add('hiding');
            setTimeout(() => { if (el.parentNode) el.remove(); }, 550);
        }, 4500);
    }

    return { show };
})();