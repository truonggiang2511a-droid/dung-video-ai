# Bộ icon bất động sản "mẫu 1" (của Giang — vẽ trong skill batdongsan-editor, kit/hook_mg.py) chuyển sang SVG cho kho app.
# Lưới 100×100, nét trắng dày 7, đầu nét tròn. Chạy: python3 tools/build-bds-icons.py → public/lib/i/bds-<tên>.svg + public/lib/bds.json
# (tools/build-lib.mjs gộp vào mục lục icon, nhóm "Bộ BĐS mẫu 1"). Thêm icon mới: thêm 1 nhánh elif + nhãn tiếng Việt trong LABELS.
import math, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS = ["floors", "area", "bed", "bath", "check", "road", "sun", "car", "key", "doc", "house", "tree", "cart", "shield", "wind", "people", "stairs", "highway", "pin", "chart", "temple", "kitchen",
         "city", "school", "hospital", "park", "pool", "garage", "gate", "cctv", "sofa", "balcony", "window", "leaf", "drop", "bolt", "lamp", "shop", "coffee", "money", "percent",
         "handshake", "cert", "crane", "clock", "compass", "ruler", "star", "bike", "bank", "ac", "plant", "heart", "sparkle", "door", "map", "calendar", "chat", "growth", "tag", "bell", "thumb", "share"]
LABELS = {
 "floors": "nhà nhiều tầng,trệt,lầu", "area": "diện tích,mét vuông", "bed": "phòng ngủ,giường", "bath": "phòng tắm,toilet,vệ sinh",
 "check": "đạt,xong,đúng", "road": "đường đi,trục đường", "sun": "nắng,sân thượng,ánh sáng", "car": "ô tô,xe hơi",
 "key": "chìa khoá,nhận nhà,dọn vào", "doc": "giấy tờ,hồ sơ", "house": "ngôi nhà,nhà", "tree": "cây xanh",
 "cart": "chợ,siêu thị,mua sắm", "shield": "an toàn,bảo vệ,kiên cố", "wind": "thoáng mát,gió", "people": "gia đình,dân cư",
 "stairs": "cầu thang,lầu", "highway": "cao tốc,đường lớn", "pin": "vị trí,địa chỉ", "chart": "biểu đồ,tăng",
 "temple": "phòng thờ", "kitchen": "bếp,nhà bếp", "city": "khu đô thị,thành phố", "school": "trường học",
 "hospital": "bệnh viện,y tế", "park": "công viên", "pool": "hồ bơi", "garage": "gara,đậu xe hơi",
 "gate": "cổng,cổng rào", "cctv": "camera,an ninh", "sofa": "phòng khách,nội thất,sofa", "balcony": "ban công",
 "window": "cửa sổ", "leaf": "không khí trong lành,xanh", "drop": "nước sạch,nước", "bolt": "điện",
 "lamp": "đèn,ánh sáng", "shop": "kinh doanh,cửa hàng,buôn bán", "coffee": "quán cà phê,quán xá", "money": "tiền,giá,tỷ",
 "percent": "lãi suất,phần trăm,giảm giá", "handshake": "thương lượng,chốt,hợp tác", "cert": "sổ hồng,pháp lý,hoàn công",
 "crane": "xây dựng,đổ đúc", "clock": "phút,thời gian", "compass": "hướng nhà,phong thuỷ", "ruler": "chiều ngang,mặt tiền,kích thước",
 "star": "cao cấp,5 sao", "bike": "xe máy", "bank": "ngân hàng,vay", "ac": "máy lạnh,điều hoà", "plant": "cây cảnh",
 "heart": "ấm cúng,yêu thích", "sparkle": "mới,sạch đẹp", "door": "cửa chính,cửa", "map": "bản đồ,giáp ranh",
 "calendar": "lịch xem nhà,hẹn", "chat": "nhắn tin,tư vấn", "growth": "tiềm năng,tăng giá trị,phát triển",
 "tag": "giá bán,giá", "bell": "đăng ký kênh,chuông", "thumb": "thích,like", "share": "chia sẻ",
}
SW = 7

def svg_for(name):
    parts = []
    f = lambda v: ('%.2f' % v).rstrip('0').rstrip('.')
    def L(*pts):
        if len(pts) == 1 or all(p == pts[0] for p in pts):
            x, y = pts[0]; parts.append('<circle cx="%s" cy="%s" r="%s" fill="#fff" stroke="none"/>' % (f(x), f(y), f(SW / 2))); return
        parts.append('<polyline points="%s"/>' % ' '.join('%s,%s' % (f(x), f(y)) for x, y in pts))
    def A(box, a0, a1):
        x0, y0, x1, y1 = box; cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
        span = a1 - a0
        if span >= 360:
            parts.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s"/>' % (f(cx), f(cy), f(rx), f(ry))); return
        p = lambda a: (cx + rx * math.cos(math.radians(a)), cy + ry * math.sin(math.radians(a)))
        (sx, sy), (ex, ey) = p(a0), p(a1)
        parts.append('<path d="M%s %s A%s %s 0 %d 1 %s %s"/>' % (f(sx), f(sy), f(rx), f(ry), 1 if span > 180 else 0, f(ex), f(ey)))
    def R(box, rad):
        x0, y0, x1, y1 = box
        parts.append('<rect x="%s" y="%s" width="%s" height="%s" rx="%s"/>' % (f(x0), f(y0), f(x1 - x0), f(y1 - y0), f(rad)))
    def C(cx, cy, r, fill=False):
        parts.append('<circle cx="%s" cy="%s" r="%s"%s/>' % (f(cx), f(cy), f(r), ' fill="#fff" stroke="none"' if fill else ''))
    w = SW
    if name == "floors":            # nha nhieu tang
        L((12, 46), (50, 14), (88, 46)); L((24, 38), (24, 86), (76, 86), (76, 38)); L((24, 62), (76, 62))
    elif name == "area":            # o vuong + mui ten cheo hai dau
        R((14, 14, 86, 86), 10); L((36, 64), (64, 36)); L((48, 36), (64, 36), (64, 52)); L((36, 48), (36, 64), (52, 64))
    elif name == "bed":             # giuong nhin ngang
        L((12, 24), (12, 84)); L((12, 68), (88, 68)); L((88, 50), (88, 84)); R((20, 46, 42, 60), 6); L((50, 68), (50, 50), (88, 50))
    elif name == "bath":            # bon tam
        L((8, 50), (92, 50)); A((16, 22, 84, 78), 0, 180); L((30, 76), (26, 88)); L((70, 76), (74, 88)); L((24, 50), (24, 22), (38, 22), (38, 30))
    elif name == "check":
        L((20, 52), (42, 74), (82, 28))
    elif name == "road":            # duong di xa dan
        L((30, 88), (42, 12)); L((70, 88), (58, 12)); L((50, 80), (50, 66)); L((50, 52), (50, 40)); L((50, 28), (50, 20))
    elif name == "sun":
        C(50, 50, 17)
        for a in range(0, 360, 45):
            ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
            L((50 + 28 * ca, 50 + 28 * sa), (50 + 38 * ca, 50 + 38 * sa))
    elif name == "car":
        L((10, 62), (16, 62)); L((16, 62), (24, 40), (70, 40), (84, 56), (90, 62)); L((10, 62), (10, 72), (90, 72), (90, 62)); C(28, 74, 8); C(72, 74, 8)
    elif name == "key":             # chia khoa (nhan nha, o lien)
        C(32, 50, 17); L((49, 50), (88, 50)); L((70, 50), (70, 64)); L((84, 50), (84, 62))
    elif name == "doc":             # giay to (so hong, phap ly)
        L((24, 12), (60, 12), (78, 30), (78, 88), (24, 88), (24, 12)); L((60, 12), (60, 30), (78, 30)); L((36, 50), (66, 50)); L((36, 66), (66, 66))
    elif name == "house":           # ngoi nha co cua
        L((10, 50), (50, 14), (90, 50)); L((22, 40), (22, 86), (78, 86), (78, 40)); L((42, 86), (42, 62), (58, 62), (58, 86))
    elif name == "tree":            # cay xanh
        C(50, 36, 24); L((50, 60), (50, 90)); L((50, 74), (38, 64)); L((36, 90), (64, 90))
    elif name == "cart":            # xe day (cho, sieu thi)
        L((8, 18), (22, 18), (32, 64), (80, 64), (88, 30), (26, 30)); C(38, 80, 7); C(74, 80, 7)
    elif name == "shield":          # cua bao ve, an toan
        L((50, 10), (84, 22), (82, 52), (50, 90), (18, 52), (16, 22), (50, 10)); L((34, 50), (46, 62), (68, 38))
    elif name == "wind":            # mat me, thoang
        L((10, 36), (62, 36)); A((52, 16, 76, 40), 270, 90 + 360); L((10, 56), (78, 56)); A((68, 44, 92, 68), 270, 90 + 360); L((10, 76), (48, 76))
    elif name == "people":          # gia dinh
        C(32, 30, 12); C(68, 30, 12); A((12, 50, 52, 100), 180, 360); A((48, 50, 88, 100), 180, 360)
    elif name == "stairs":          # nhieu tang lau
        L((12, 86), (12, 66), (34, 66), (34, 46), (56, 46), (56, 26), (78, 26), (78, 12), (90, 12))
    elif name == "highway":         # cao toc / duong lon
        L((8, 86), (40, 14)); L((92, 86), (60, 14)); L((50, 84), (50, 70)); L((50, 56), (50, 44)); L((50, 32), (50, 24)); L((4, 50), (96, 50))
    elif name == "pin":
        L((50, 90), (28, 56)); L((50, 90), (72, 56)); A((22, 12, 78, 68), 150, 390); C(50, 40, 10)
    elif name == "chart":           # bieu do tang
        L((12, 12), (12, 88), (90, 88)); L((22, 72), (42, 54), (58, 62), (84, 26)); L((68, 26), (84, 26), (84, 42))
    elif name == "temple":          # phong tho (lu huong)
        L((20, 86), (80, 86)); L((26, 86), (30, 58), (70, 58), (74, 86)); L((40, 58), (40, 30)); L((50, 58), (50, 22)); L((60, 58), (60, 30))
    elif name == "kitchen":         # bep
        R((16, 40, 84, 88), 8); L((16, 56), (84, 56)); C(36, 48, 3, True); C(64, 48, 3, True); L((34, 12), (34, 30)); L((50, 8), (50, 30)); L((66, 12), (66, 30))
    # ---- 28/10/2026 (Giang: icon da dang hon, ghep dung loi noi) — them bo icon bat dong san
    elif name == "city":            # khu do thi
        L((8, 88), (92, 88)); R((14, 42, 38, 88), 3); R((42, 16, 66, 88), 3); R((70, 54, 88, 88), 3)
        for yy in (30, 44, 58, 72):
            C(50, yy, 2.5, True); C(58, yy, 2.5, True)
        C(26, 56, 2.5, True); C(26, 70, 2.5, True)
    elif name == "school":          # truong hoc
        L((10, 46), (50, 24), (90, 46)); L((20, 46), (20, 88), (80, 88), (80, 46)); L((42, 88), (42, 66), (58, 66), (58, 88)); L((50, 24), (50, 6)); L((50, 7), (66, 11), (50, 16))
    elif name == "hospital":        # benh vien
        R((14, 14, 86, 86), 16); L((50, 30), (50, 70)); L((30, 50), (70, 50))
    elif name == "park":            # cong vien
        C(28, 32, 17); L((28, 50), (28, 88)); L((48, 60), (92, 60)); L((48, 70), (92, 70)); L((54, 70), (54, 88)); L((86, 70), (86, 88))
    elif name == "pool":            # ho boi
        L((34, 8), (34, 50)); L((60, 8), (60, 50)); L((34, 22), (60, 22)); L((34, 36), (60, 36))
        for yy in (66, 84):
            L(*[(x_, yy + 6 * math.sin((x_ - 10) / 80 * 4 * math.pi)) for x_ in range(10, 91, 4)])
    elif name == "garage":          # cho dau xe hoi
        L((8, 42), (50, 12), (92, 42)); L((16, 36), (16, 88)); L((84, 36), (84, 88)); R((28, 48, 72, 88), 4); L((28, 60), (72, 60)); L((28, 72), (72, 72))
    elif name == "gate":            # cong rao
        L((10, 88), (10, 20)); L((90, 88), (90, 20)); L((10, 34), (50, 22), (90, 34)); L((10, 88), (90, 88))
        for xx in (30, 50, 70):
            L((xx, 88), (xx, 28 if xx != 50 else 22))
        C(44, 60, 3, True); C(56, 60, 3, True)
    elif name == "cctv":            # camera an ninh
        L((12, 30), (66, 18), (72, 42), (18, 54), (12, 30)); L((70, 30), (86, 30)); C(56, 34, 4, True); L((40, 48), (44, 70), (20, 70)); L((20, 62), (20, 80))
    elif name == "sofa":            # phong khach, noi that
        R((24, 30, 76, 58), 8); L((14, 46), (14, 78), (86, 78), (86, 46)); L((14, 58), (86, 58)); L((22, 78), (22, 88)); L((78, 78), (78, 88))
    elif name == "balcony":         # ban cong
        R((30, 10, 70, 58), 4); L((50, 10), (50, 58)); L((8, 60), (92, 60)); L((8, 88), (92, 88))
        for xx in (18, 34, 50, 66, 82):
            L((xx, 60), (xx, 88))
    elif name == "window":          # cua so, thoang sang
        R((18, 12, 82, 88), 6); L((50, 12), (50, 88)); L((18, 50), (82, 50))
    elif name == "leaf":            # khong khi trong lanh, xanh
        L((18, 84), (24, 50), (44, 28), (70, 18), (88, 14), (84, 38), (70, 62), (46, 78), (18, 84)); L((18, 84), (66, 36))
    elif name == "drop":            # nuoc sach
        L((50, 10), (26, 52)); L((50, 10), (74, 52)); A((24, 36, 76, 88), -28, 208); A((36, 52, 60, 76), 100, 170)
    elif name == "bolt":            # dien
        L((58, 8), (26, 54), (50, 54), (40, 92), (76, 42), (52, 42), (58, 8))
    elif name == "lamp":            # anh sang, den
        A((26, 12, 74, 60), 140, 400); L((38, 54), (40, 66), (60, 66), (62, 54)); L((42, 76), (58, 76)); L((46, 86), (54, 86))
    elif name == "shop":            # kinh doanh, cua hang
        L((14, 14), (86, 14), (92, 34), (8, 34), (14, 14)); A((8, 26, 29, 46), 0, 180); A((29, 26, 50, 46), 0, 180); A((50, 26, 71, 46), 0, 180); A((71, 26, 92, 46), 0, 180)
        L((16, 46), (16, 88), (84, 88), (84, 46)); L((40, 88), (40, 62), (60, 62), (60, 88))
    elif name == "coffee":          # quan xa, tien ich
        L((16, 40), (66, 40), (62, 84), (20, 84), (16, 40)); A((54, 46, 84, 72), 270, 450); L((32, 12), (36, 28)); L((48, 10), (52, 28))
    elif name == "money":           # gia, tien
        R((8, 26, 92, 74), 8); C(50, 50, 13); L((20, 38), (20, 38)); C(22, 38, 3, True); C(78, 62, 3, True)
    elif name == "percent":         # lai suat, ho tro vay
        C(30, 30, 11); C(70, 70, 11); L((78, 18), (22, 82))
    elif name == "handshake":       # thuong luong, chot
        L((6, 40), (28, 40), (50, 56), (62, 48)); L((94, 40), (72, 40), (48, 64), (38, 72)); L((28, 40), (28, 60), (40, 74)); L((72, 40), (72, 56)); L((44, 60), (54, 70)); L((50, 54), (60, 64))
    elif name == "bell":            # dang ky kenh
        A((22, 14, 78, 70), 180, 360); L((22, 42), (22, 64), (12, 76), (88, 76), (78, 64), (78, 42)); A((40, 74, 60, 94), 0, 180); L((50, 6), (50, 14))
    elif name == "thumb":           # thich (like)
        L((10, 46), (28, 46), (28, 88), (10, 88), (10, 46)); L((28, 50), (44, 44), (54, 14), (62, 12), (68, 22), (64, 40), (84, 40), (90, 50), (84, 82), (74, 88), (28, 84))
    elif name == "share":           # chia se
        L((56, 14), (90, 44), (56, 74), (56, 56), (38, 56), (22, 66), (12, 84), (14, 62), (28, 42), (56, 34), (56, 14))
    elif name == "tag":             # gia ban, thuong luong
        L((10, 50), (44, 14), (88, 14), (88, 58), (52, 92), (10, 50)); C(70, 32, 7)
    elif name == "cert":            # so hong, phap ly hoan cong
        R((12, 12, 88, 66), 6); L((26, 28), (74, 28)); L((26, 42), (60, 42)); C(68, 72, 12); L((62, 82), (56, 94)); L((74, 82), (80, 94))
    elif name == "crane":           # xay dung, do duc
        L((26, 90), (26, 12)); L((8, 22), (90, 22)); L((26, 12), (62, 22)); L((78, 22), (78, 46)); A((70, 42, 86, 58), 0, 220); L((12, 90), (42, 90)); L((26, 40), (40, 22))
    elif name == "clock":           # vai phut di chuyen
        C(50, 50, 36); L((50, 50), (50, 26)); L((50, 50), (68, 60))
    elif name == "compass":         # huong nha
        C(50, 50, 38); L((50, 18), (60, 50), (50, 82), (40, 50), (50, 18)); C(50, 50, 3, True)
    elif name == "ruler":           # kich thuoc, chieu ngang
        R((8, 34, 92, 66), 4)
        for i_, xx in enumerate(range(20, 90, 12)):
            L((xx, 34), (xx, 48 if i_ % 2 == 0 else 42))
    elif name == "star":            # 5 sao, cao cap
        pts = [(50 + (38 if k % 2 == 0 else 16) * math.cos(math.radians(-90 + k * 36)), 52 + (38 if k % 2 == 0 else 16) * math.sin(math.radians(-90 + k * 36))) for k in range(11)]
        L(*pts)
    elif name == "bike":            # xe may
        C(22, 70, 13); C(78, 70, 13); L((22, 70), (42, 50), (66, 50), (78, 70)); L((60, 50), (66, 28), (78, 28)); L((36, 50), (50, 50))
    elif name == "bank":            # ngan hang, vay von
        L((8, 36), (50, 12), (92, 36), (8, 36)); L((8, 88), (92, 88)); L((14, 80), (86, 80))
        for xx in (22, 40, 60, 78):
            L((xx, 44), (xx, 72))
    elif name == "ac":              # may lanh, mat
        R((8, 22, 92, 56), 8); L((20, 44), (80, 44)); L((30, 66), (26, 84)); L((50, 66), (50, 86)); L((70, 66), (74, 84))
    elif name == "plant":           # cay canh, xanh mat
        L((30, 60), (70, 60), (64, 90), (36, 90), (30, 60)); L((50, 60), (50, 26)); L((50, 46), (30, 32)); L((50, 38), (70, 22)); C(26, 30, 6); C(74, 20, 6)
    elif name == "heart":           # am cung, yeu thich
        A((12, 18, 52, 58), 140, 360); A((48, 18, 88, 58), 180, 400); L((15, 46), (50, 84), (85, 46))
    elif name == "sparkle":         # moi, sach dep
        L((50, 8), (58, 42), (92, 50), (58, 58), (50, 92), (42, 58), (8, 50), (42, 42), (50, 8)); L((80, 14), (80, 26)); L((74, 20), (86, 20))
    elif name == "door":            # cua chinh
        R((26, 8, 74, 92), 4); C(63, 52, 3.5, True); L((14, 92), (86, 92))
    elif name == "map":             # ban do, vi tri
        L((8, 22), (36, 12), (64, 22), (92, 12), (92, 78), (64, 88), (36, 78), (8, 88), (8, 22)); L((36, 12), (36, 78)); L((64, 22), (64, 88))
    elif name == "calendar":        # han, lich xem nha
        R((12, 18, 88, 88), 8); L((12, 38), (88, 38)); L((32, 8), (32, 26)); L((68, 8), (68, 26)); C(34, 56, 3.5, True); C(50, 56, 3.5, True); C(66, 56, 3.5, True); C(34, 72, 3.5, True)
    elif name == "chat":            # nhan tin (nut CTA)
        R((8, 14, 92, 66), 18); L((28, 66), (22, 88), (46, 66)); C(32, 40, 5, True); C(50, 40, 5, True); C(68, 40, 5, True)
    elif name == "growth":          # khu vuc dang len, tang gia tri (khong ghi so)
        L((10, 88), (90, 88)); R((16, 62, 30, 88), 2); R((38, 48, 52, 88), 2); R((60, 32, 74, 88), 2); L((14, 46), (44, 26), (58, 34), (86, 10)); L((72, 10), (86, 10), (86, 24))
    else:
        C(50, 50, 30)
    return '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 100 100"><g fill="none" stroke="#fff" stroke-width="%d" stroke-linecap="round" stroke-linejoin="round">%s</g></svg>' % (SW, ''.join(parts))

os.makedirs(os.path.join(ROOT, 'public/lib/i'), exist_ok=True)
items = []
for n in ICONS:
    open(os.path.join(ROOT, 'public/lib/i', 'bds-' + n + '.svg'), 'w').write(svg_for(n))
    lab = LABELS.get(n, n)
    items.append(['bds-' + n, lab.split(',')[0], lab])
json.dump(items, open(os.path.join(ROOT, 'tools/bds-icons.json'), 'w'), ensure_ascii=False)
print(len(items), 'icon BĐS')
