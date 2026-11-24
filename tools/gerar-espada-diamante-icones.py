from PIL import Image, ImageDraw, ImageFont
import base64, io
from pathlib import Path

out = Path(__file__).resolve().parent
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 23)

outline = '#273038'
wood = '#79583d'; wooddark = '#48372b'; woodlight = '#a87b50'

PALETTES = {
    'A': {
        'label': 'Diamante clássico',
        'desc': 'Ciano brilhante, próximo da paleta das ferramentas de diamante do jogo.',
        'dark': '#106260', 'mid': '#22bcAe', 'light': '#30d4c4', 'bright': '#5cf0dc', 'steel': '#1a9c92',
    },
    'B': {
        'label': 'Diamante cristalino',
        'desc': 'Mais claro e vítreo, com brilho forte de gema lapidada.',
        'dark': '#185870', 'mid': '#30b8c8', 'light': '#58d8e8', 'bright': '#b8f8ff', 'steel': '#2490a8',
    },
    'C': {
        'label': 'Diamante profundo',
        'desc': 'Azul-ciano mais escuro, com contraste forte e cara de gema densa.',
        'dark': '#0c4a52', 'mid': '#1a9ca8', 'light': '#2cc0cc', 'bright': '#78e8f0', 'steel': '#147888',
    },
    'D': {
        'label': 'Diamante verde-água',
        'desc': 'Mais esverdeado, puxando para água-marinha/turquesa.',
        'dark': '#146858', 'mid': '#2cc49c', 'light': '#48dcbc', 'bright': '#90f4dc', 'steel': '#20a080',
    },
}

# fix typo in A mid
PALETTES['A']['mid'] = '#22bcae'

def sprite(pal):
    im = Image.new('RGBA', (64, 64))
    d = ImageDraw.Draw(im)
    dark, mid, light, bright, steel = pal['dark'], pal['mid'], pal['light'], pal['bright'], pal['steel']
    d.rectangle((29,42,35,56), fill=outline)
    d.rectangle((30,43,34,55), fill=wood)
    d.rectangle((31,44,32,54), fill=woodlight)
    d.rectangle((34,43,34,54), fill=wooddark)
    d.rectangle((28,56,36,59), fill=outline); d.rectangle((29,56,35,57), fill=wooddark); d.rectangle((30,58,34,58), fill=wood)
    d.polygon([(27,39),(27,12),(31,5),(33,5),(37,12),(37,39)], fill=outline)
    d.polygon([(29,38),(29,13),(32,8),(35,13),(35,38)], fill=mid)
    d.polygon([(29,13),(32,8),(32,38),(29,38)], fill=light)
    d.line([(30,14),(30,35)], fill=bright, width=1)
    d.rectangle((22,39,42,43), fill=outline); d.rectangle((23,39,41,41), fill=steel); d.line((25,39,39,39), fill=light)
    rotated = im.rotate(-45, resample=Image.Resampling.NEAREST, expand=True)
    bb = rotated.getbbox(); crop = rotated.crop(bb)
    crop.thumbnail((57,57), Image.Resampling.NEAREST)
    canvas = Image.new('RGBA',(64,64))
    canvas.alpha_composite(crop, ((64-crop.width)//2, (64-crop.height)//2))
    return canvas

icons = {k: sprite(p) for k,p in PALETTES.items()}
for k,im in icons.items():
    im.save(out / f'espada-diamante-icone-{k.lower()}.png')

sheet = Image.new('RGB', (1200, 640), '#232922')
dr = ImageDraw.Draw(sheet)
dr.text((30,20), 'ESPADA DE DIAMANTE • ÍCONES PARA ANÁLISE', font=bold, fill='#f0f2e7')
dr.text((30,53), 'Mesma silhueta da Espada A; variações de paleta/material de diamante', font=font, fill='#c6d1c2')
for i,(k,im) in enumerate(icons.items()):
    x = 22 + i*296
    dr.rounded_rectangle((x,95,x+275,600), radius=8, fill='#303a30', outline='#788a73', width=2)
    dr.text((x+16,106), f'OPÇÃO {k}', font=bold, fill='#ecf2e8')
    dr.text((x+16,134), PALETTES[k]['label'], font=font, fill='#c6d1c2')
    dr.rectangle((x+25,162,x+249,386), fill='#1d251f', outline='#71816e')
    large = im.resize((224,224), Image.Resampling.NEAREST)
    sheet.paste(large, (x+25,162), large)
    dr.text((x+17,400), 'Redução a 16 × 16', font=font, fill='#c6d1c2')
    small = im.resize((16,16), Image.Resampling.NEAREST).resize((128,128), Image.Resampling.NEAREST)
    dr.rectangle((x+73,437,x+201,565), fill='#1d251f')
    sheet.paste(small, (x+73,437), small)
sheet.save(out / 'espada-diamante-icones-comparacao.png')

def uri(image):
    b = io.BytesIO(); image.save(b,'PNG'); return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()

cards = []
for k,im in icons.items():
    small = im.resize((16,16), Image.Resampling.NEAREST)
    p = PALETTES[k]
    cards.append(f'''<article>
      <h2>Opção {k}</h2>
      <p><strong>{p['label']}</strong><br>{p['desc']}</p>
      <img class="big" src="{uri(im)}" alt="Espada de diamante {k}">
      <h3>Redução a 16 × 16</h3>
      <img class="small" src="{uri(small)}" alt="Redução 16 por 16">
      <p><small>Tamanho real: <img class="actual" src="{uri(small)}" alt="Tamanho real"></small></p>
    </article>''')
html = f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Espada de diamante — ícones</title>
<style>
body{{font:16px/1.5 system-ui;margin:auto;padding:24px;max-width:1250px;background:#1c241d;color:#ecf2e8}}
p{{color:#c6d1c2}} .grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}}
article{{padding:16px;background:#303a30;border:1px solid #71816e;border-radius:8px}}
h2{{margin:0}} h3{{font-size:15px;margin-bottom:8px}}
img.big{{width:100%;max-width:240px;aspect-ratio:1;background:#1d251f;image-rendering:pixelated}}
img.small{{width:128px;height:128px;background:#1d251f;image-rendering:pixelated}}
img.actual{{width:16px;height:16px;background:#1d251f;image-rendering:pixelated}}
.ref{{display:flex;gap:14px;align-items:center;background:#273027;border:1px solid #71816e;border-radius:8px;padding:12px;margin-bottom:16px}}
.ref img{{width:72px;height:72px;image-rendering:pixelated;background:#1d251f;border-radius:6px}}
</style></head><body>
<h1>Espada de diamante · ícones</h1>
<div class="ref"><img src="espada-icone-a.png" alt="Espada A base"><p><strong>Base:</strong> mesma silhueta da Espada A (escolhida). Só muda a paleta do metal para diamante. Nada implementado no jogo.</p></div>
<p>Quatro variações de paleta de diamante para comparar. Cada opção aparece ampliada e em 16×16.</p>
<div class="grid">{''.join(cards)}</div>
</body></html>'''
(out / 'espada-diamante-icones-opcoes.html').write_text(html, encoding='utf8')
print('ok')
