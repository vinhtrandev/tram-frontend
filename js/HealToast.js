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
        'Nỗi buồn cũng giống như những đám mây, chúng đến rồi sẽ đi, chỉ có bầu trời trong bạn là mãi mãi.',
        'Gói ghém muộn phiền gửi vào hư vô, ngày mai khi thức dậy, bạn sẽ là một phiên bản nhẹ nhàng hơn.',
        'Bạn không cần phải mạnh mẽ mọi lúc. Ở đây, bạn được phép yếu đuối và để vũ trụ ôm ấp lấy mình.',
        'Hãy để bóng tối bao bọc lấy mệt mỏi của bạn, và để ánh sao dẫn lối cho trái tim.',
        'Hãy cứ tỏa sáng theo cách của riêng bạn, vũ trụ này cần ánh sáng đó.',
        'Một cái ôm từ xa gửi đến bạn. Mong bạn cảm nhận được hơi ấm giữa không gian vô tận này.',
        'Tín hiệu của bạn đã được tiếp nhận. Vũ trụ đang gửi lại cho bạn một lời hồi đáp bình yên.',
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
        const old = document.getElementById('heal-toast');
        if (old) {
            old.remove();
        }

        const el = document.createElement('div');
        el.id = 'heal-toast';
        el.textContent = _getRandom();
        document.body.appendChild(el);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => el.classList.add('visible'));
        });

        setTimeout(() => {
            el.classList.remove('visible');
            el.classList.add('hiding');
            setTimeout(() => { if (el.parentNode) el.remove(); }, 550);
        }, 4500);
    }

    return { show };
})();