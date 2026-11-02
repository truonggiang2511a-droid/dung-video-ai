# Dựng KHO FONT có dấu tiếng Việt (chạy khi cần thêm font, kết quả commit vào public/fonts/lib/ + js/font-list.js):
#   python3 tools/build-fonts.py
# Lấy font Google (giấy phép SIL OFL — dùng thương mại, nhúng vào app/video thoải mái) qua gói npm @fontsource/<tên>,
# GỘP 3 bộ chữ latin + latin-ext + vietnamese của 1 độ đậm thành 1 file woff2 (fontTools; cần pip install fonttools brotli).
# Font nào KHÔNG có bộ chữ tiếng Việt thì tự bỏ qua (chữ có dấu sẽ vỡ).
import json, os, subprocess, tarfile, io, sys
from fontTools.merge import Merger
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public/fonts/lib')
CACHE = '/tmp/fontsource-cache'
os.makedirs(OUT, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)

# (gói @fontsource, độ đậm, tên hiện, nhóm)
FONTS = [
    # Đậm / tiêu đề
    ('anton', 400, 'Anton', 'Tiêu đề đậm'),
    ('oswald', 700, 'Oswald', 'Tiêu đề đậm'),
    ('montserrat', 900, 'Montserrat Black', 'Tiêu đề đậm'),
    ('be-vietnam-pro', 900, 'Be Vietnam Black', 'Tiêu đề đậm'),
    ('barlow-condensed', 800, 'Barlow Condensed', 'Tiêu đề đậm'),
    ('big-shoulders-display', 900, 'Big Shoulders', 'Tiêu đề đậm'),
    ('saira-condensed', 800, 'Saira Condensed', 'Tiêu đề đậm'),
    ('archivo', 900, 'Archivo Black', 'Tiêu đề đậm'),
    ('kanit', 800, 'Kanit', 'Tiêu đề đậm'),
    ('prompt', 800, 'Prompt', 'Tiêu đề đậm'),
    ('exo-2', 900, 'Exo 2', 'Tiêu đề đậm'),
    ('unbounded', 800, 'Unbounded', 'Tiêu đề đậm'),
    ('lexend', 800, 'Lexend', 'Tiêu đề đậm'),
    ('plus-jakarta-sans', 800, 'Plus Jakarta', 'Tiêu đề đậm'),
    ('inter', 900, 'Inter Black', 'Tiêu đề đậm'),
    ('roboto', 900, 'Roboto Black', 'Tiêu đề đậm'),
    ('roboto-condensed', 800, 'Roboto Condensed', 'Tiêu đề đậm'),
    ('noto-sans', 900, 'Noto Sans Black', 'Tiêu đề đậm'),
    ('raleway', 900, 'Raleway Black', 'Tiêu đề đậm'),
    ('mulish', 900, 'Mulish Black', 'Tiêu đề đậm'),
    ('bricolage-grotesque', 800, 'Bricolage', 'Tiêu đề đậm'),
    ('darker-grotesque', 900, 'Darker Grotesque', 'Tiêu đề đậm'),
    ('space-grotesk', 700, 'Space Grotesk', 'Tiêu đề đậm'),
    ('encode-sans-expanded', 900, 'Encode Expanded', 'Tiêu đề đậm'),
    ('anybody', 900, 'Anybody', 'Tiêu đề đậm'),
    ('vina-sans', 400, 'Vina Sans', 'Tiêu đề đậm'),
    # Vui / tròn / quảng cáo
    ('bungee', 400, 'Bungee', 'Vui nhộn'),
    ('paytone-one', 400, 'Paytone One', 'Vui nhộn'),
    ('chonburi', 400, 'Chonburi', 'Vui nhộn'),
    ('coiny', 400, 'Coiny', 'Vui nhộn'),
    ('pattaya', 400, 'Pattaya', 'Vui nhộn'),
    ('rowdies', 700, 'Rowdies', 'Vui nhộn'),
    ('grandstander', 900, 'Grandstander', 'Vui nhộn'),
    ('baloo-2', 800, 'Baloo 2', 'Vui nhộn'),
    ('nunito', 900, 'Nunito Black', 'Vui nhộn'),
    ('quicksand', 700, 'Quicksand', 'Vui nhộn'),
    ('comfortaa', 700, 'Comfortaa', 'Vui nhộn'),
    ('chakra-petch', 700, 'Chakra Petch', 'Vui nhộn'),
    ('bai-jamjuree', 700, 'Bai Jamjuree', 'Vui nhộn'),
    ('mitr', 600, 'Mitr', 'Vui nhộn'),
    ('dosis', 800, 'Dosis', 'Vui nhộn'),
    ('josefin-sans', 700, 'Josefin Sans', 'Vui nhộn'),
    ('bangers', 400, 'Bangers', 'Vui nhộn'),
    # Viết tay
    ('dancing-script', 700, 'Dancing Script', 'Viết tay'),
    ('pacifico', 400, 'Pacifico', 'Viết tay'),
    ('lobster', 400, 'Lobster', 'Viết tay'),
    ('sriracha', 400, 'Sriracha', 'Viết tay'),
    ('itim', 400, 'Itim', 'Viết tay'),
    ('mali', 700, 'Mali', 'Viết tay'),
    ('charm', 700, 'Charm', 'Viết tay'),
    ('patrick-hand', 400, 'Patrick Hand', 'Viết tay'),
    ('pangolin', 400, 'Pangolin', 'Viết tay'),
    ('dongle', 700, 'Dongle', 'Viết tay'),
    ('playpen-sans', 700, 'Playpen Sans', 'Viết tay'),
    ('caveat', 700, 'Caveat', 'Viết tay'),
    # Có chân / sang trọng
    ('playfair-display', 900, 'Playfair Black', 'Sang trọng'),
    ('merriweather', 900, 'Merriweather', 'Sang trọng'),
    ('lora', 700, 'Lora', 'Sang trọng'),
    ('cormorant-garamond', 700, 'Cormorant', 'Sang trọng'),
    ('alegreya', 900, 'Alegreya', 'Sang trọng'),
    ('noto-serif', 900, 'Noto Serif', 'Sang trọng'),
    ('yeseva-one', 400, 'Yeseva One', 'Sang trọng'),
    ('philosopher', 700, 'Philosopher', 'Sang trọng'),
    ('arima', 700, 'Arima', 'Sang trọng'),
    ('taviraj', 700, 'Taviraj', 'Sang trọng'),
    # ---- 2/11 chiều: mở rộng kho (font nào thiếu tiếng Việt tự bị bỏ) ----
    ('inter-tight', 900, 'Inter Tight', 'Tiêu đề đậm'),
    ('archivo-black', 400, 'Archivo Black 2', 'Tiêu đề đậm'),
    ('archivo-narrow', 700, 'Archivo Narrow', 'Tiêu đề đậm'),
    ('alumni-sans', 900, 'Alumni Sans', 'Tiêu đề đậm'),
    ('league-spartan', 900, 'League Spartan', 'Tiêu đề đậm'),
    ('lexend-deca', 800, 'Lexend Deca', 'Tiêu đề đậm'),
    ('lexend-zetta', 800, 'Lexend Zetta', 'Tiêu đề đậm'),
    ('saira', 900, 'Saira', 'Tiêu đề đậm'),
    ('saira-extra-condensed', 900, 'Saira Extra Condensed', 'Tiêu đề đậm'),
    ('saira-stencil-one', 400, 'Saira Stencil', 'Tiêu đề đậm'),
    ('encode-sans-condensed', 900, 'Encode Sans Condensed', 'Tiêu đề đậm'),
    ('barlow', 900, 'Barlow Black', 'Tiêu đề đậm'),
    ('barlow-semi-condensed', 800, 'Barlow Semi Condensed', 'Tiêu đề đậm'),
    ('sofia-sans', 900, 'Sofia Sans', 'Tiêu đề đậm'),
    ('sofia-sans-condensed', 900, 'Sofia Sans Condensed', 'Tiêu đề đậm'),
    ('sofia-sans-extra-condensed', 900, 'Sofia Sans Extra Condensed', 'Tiêu đề đậm'),
    ('fira-sans', 900, 'Fira Sans Black', 'Tiêu đề đậm'),
    ('fira-sans-condensed', 900, 'Fira Sans Condensed', 'Tiêu đề đậm'),
    ('nunito-sans', 900, 'Nunito Sans', 'Tiêu đề đậm'),
    ('open-sans', 800, 'Open Sans', 'Tiêu đề đậm'),
    ('source-sans-3', 900, 'Source Sans 3', 'Tiêu đề đậm'),
    ('roboto', 900, 'Roboto Black', 'Tiêu đề đậm'),
    ('ibm-plex-sans', 700, 'IBM Plex Sans', 'Tiêu đề đậm'),
    ('signika', 700, 'Signika', 'Tiêu đề đậm'),
    ('wix-madefor-display', 800, 'Wix Madefor', 'Tiêu đề đậm'),
    ('onest', 900, 'Onest', 'Tiêu đề đậm'),
    ('afacad', 700, 'Afacad', 'Tiêu đề đậm'),
    ('pathway-extreme', 900, 'Pathway Extreme', 'Tiêu đề đậm'),
    ('big-shoulders-stencil-display', 900, 'Big Shoulders Stencil', 'Tiêu đề đậm'),
    ('k2d', 800, 'K2D', 'Tiêu đề đậm'),
    ('play', 700, 'Play', 'Vui nhộn'),
    ('bungee-shade', 400, 'Bungee Shade', 'Vui nhộn'),
    ('bungee-inline', 400, 'Bungee Inline', 'Vui nhộn'),
    ('bungee-outline', 400, 'Bungee Outline', 'Vui nhộn'),
    ('bungee-spice', 400, 'Bungee Spice', 'Vui nhộn'),
    ('baloo-bhai-2', 800, 'Baloo Bhai', 'Vui nhộn'),
    ('fuzzy-bubbles', 700, 'Fuzzy Bubbles', 'Vui nhộn'),
    ('gluten', 800, 'Gluten', 'Vui nhộn'),
    ('sigmar', 400, 'Sigmar', 'Vui nhộn'),
    ('tilt-neon', 400, 'Tilt Neon', 'Vui nhộn'),
    ('tilt-prism', 400, 'Tilt Prism', 'Vui nhộn'),
    ('handjet', 700, 'Handjet', 'Vui nhộn'),
    ('tektur', 800, 'Tektur', 'Vui nhộn'),
    ('montserrat-alternates', 800, 'Montserrat Alternates', 'Vui nhộn'),
    ('kodchasan', 700, 'Kodchasan', 'Vui nhộn'),
    ('krub', 700, 'Krub', 'Vui nhộn'),
    ('koho', 700, 'KoHo', 'Vui nhộn'),
    ('niramit', 700, 'Niramit', 'Vui nhộn'),
    ('fahkwang', 700, 'Fahkwang', 'Vui nhộn'),
    ('athiti', 700, 'Athiti', 'Vui nhộn'),
    ('oi', 400, 'Oi', 'Vui nhộn'),
    ('space-mono', 700, 'Space Mono', 'Vui nhộn'),
    ('roboto-mono', 700, 'Roboto Mono', 'Vui nhộn'),
    ('ibm-plex-mono', 700, 'IBM Plex Mono', 'Vui nhộn'),
    ('sedgwick-ave', 400, 'Sedgwick Ave', 'Viết tay'),
    ('sedgwick-ave-display', 400, 'Sedgwick Ave Display', 'Viết tay'),
    ('charmonman', 700, 'Charmonman', 'Viết tay'),
    ('srisakdi', 700, 'Srisakdi', 'Viết tay'),
    ('thasadith', 700, 'Thasadith', 'Viết tay'),
    ('grenze-gotisch', 800, 'Grenze Gotisch', 'Sang trọng'),
    ('playfair-display-sc', 900, 'Playfair SC', 'Sang trọng'),
    ('playfair', 900, 'Playfair', 'Sang trọng'),
    ('cormorant', 700, 'Cormorant', 'Sang trọng'),
    ('cormorant-infant', 700, 'Cormorant Infant', 'Sang trọng'),
    ('eb-garamond', 800, 'EB Garamond', 'Sang trọng'),
    ('crimson-pro', 800, 'Crimson Pro', 'Sang trọng'),
    ('literata', 800, 'Literata', 'Sang trọng'),
    ('bitter', 800, 'Bitter', 'Sang trọng'),
    ('roboto-slab', 800, 'Roboto Slab', 'Sang trọng'),
    ('roboto-serif', 800, 'Roboto Serif', 'Sang trọng'),
    ('noto-serif-display', 800, 'Noto Serif Display', 'Sang trọng'),
    ('source-serif-4', 800, 'Source Serif 4', 'Sang trọng'),
    ('spectral', 800, 'Spectral', 'Sang trọng'),
    ('ibm-plex-serif', 700, 'IBM Plex Serif', 'Sang trọng'),
    ('hepta-slab', 800, 'Hepta Slab', 'Sang trọng'),
    ('montagu-slab', 700, 'Montagu Slab', 'Sang trọng'),
    ('prata', 400, 'Prata', 'Sang trọng'),
    ('old-standard-tt', 700, 'Old Standard', 'Sang trọng'),
    ('podkova', 800, 'Podkova', 'Sang trọng'),
    ('pridi', 700, 'Pridi', 'Sang trọng'),
    ('maitree', 700, 'Maitree', 'Sang trọng'),
    ('trirong', 800, 'Trirong', 'Sang trọng'),
    ('sedan', 400, 'Sedan', 'Sang trọng'),
    ('alegreya-sans', 900, 'Alegreya Sans', 'Tiêu đề đậm'),
]

def tarball(pkg):
    have = [f for f in os.listdir(CACHE) if f.startswith(f'fontsource-{pkg}-') and f.endswith('.tgz')]
    if not have:
        r = subprocess.run(['npm', 'pack', f'@fontsource/{pkg}', '--silent'], cwd=CACHE, capture_output=True, text=True, timeout=180)
        if r.returncode:
            return None
        have = [r.stdout.strip().splitlines()[-1]]
    return os.path.join(CACHE, have[0])

out_list = []
for pkg, w, label, cat in FONTS:
    tgz = tarball(pkg)
    if not tgz:
        print('  bỏ (không tải được gói):', pkg); continue
    files = {}
    with tarfile.open(tgz) as t:
        for sub in ('latin', 'latin-ext', 'vietnamese'):
            name = f'package/files/{pkg}-{sub}-{w}-normal.woff2'
            try:
                files[sub] = t.extractfile(name).read()
            except KeyError:
                pass
    if 'vietnamese' not in files or 'latin' not in files:
        print('  bỏ (không có bộ chữ tiếng Việt / độ đậm này):', pkg, w); continue
    tmp = []
    for sub in ('latin', 'latin-ext', 'vietnamese'):
        if sub not in files: continue
        f = TTFont(io.BytesIO(files[sub]))
        f.flavor = None
        p = os.path.join(CACHE, f'{pkg}-{sub}-{w}.ttf')
        f.save(p)
        tmp.append(p)
    try:
        m = Merger().merge(tmp)
    except Exception as e:
        print('  bỏ (gộp lỗi):', pkg, e); continue
    VN = 'ăâđêôơưĂÂĐÊÔƠƯàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ'
    cmap = m.getBestCmap() or {}
    miss = [c for c in VN if ord(c) not in cmap]
    if miss:
        print('  bỏ (thiếu chữ tiếng Việt', ''.join(miss[:8]), '):', pkg); continue
    m.flavor = 'woff2'
    key = pkg.replace('-', '')[:18] + str(w)
    m.save(os.path.join(OUT, key + '.woff2'))
    size = os.path.getsize(os.path.join(OUT, key + '.woff2'))
    fam = 'L-' + key
    out_list.append({'key': key, 'family': fam, 'weight': str(w), 'label': label, 'cat': cat, 'file': key + '.woff2', 'kb': round(size / 1024)})
    print(f'  ✓ {label} ({w}) {round(size/1024)} KB')

js = '// TỰ SINH bởi tools/build-fonts.py — kho font có dấu tiếng Việt (Google Fonts, SIL OFL). Đừng sửa tay.\nexport const FONT_LIB = ' + json.dumps(out_list, ensure_ascii=False, indent=0).replace('\n', '') + ';\n'
open(os.path.join(ROOT, 'js/font-list.js'), 'w').write(js)
open(os.path.join(OUT, 'GIAY-PHEP.txt'), 'w').write('Các font trong thư mục này là Google Fonts theo giấy phép SIL Open Font License 1.1 (https://openfontlicense.org) — được dùng, nhúng và phân phối kèm phần mềm, kể cả thương mại; không bán riêng font.\n' + '\n'.join(f"- {f['label']} (@fontsource/{f['key']})" for f in out_list) + '\n')
print(f'Xong: {len(out_list)} font, tổng {sum(f["kb"] for f in out_list)} KB')
