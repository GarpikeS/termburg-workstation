from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'docs' / 'qr'
TARGET_URL = 'https://tbgame.ru/games?source=moscow_cashier'
QR_PATH = OUTPUT / 'termliny-moscow-cashier-qr.png'
POSTER_PATH = OUTPUT / 'termliny-moscow-cashier-a4.png'


def font(size: int, bold: bool = False):
    candidates = [
        Path(r'C:\Windows\Fonts\arialbd.ttf' if bold else r'C:\Windows\Fonts\arial.ttf'),
        Path(r'C:\Windows\Fonts\verdana.ttf'),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def centered(draw: ImageDraw.ImageDraw, text: str, y: int, used_font, fill, width: int):
    box = draw.textbbox((0, 0), text, font=used_font)
    draw.text(((width - (box[2] - box[0])) / 2, y), text, font=used_font, fill=fill)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    encoder = cv2.QRCodeEncoder_create()
    qr = encoder.encode(TARGET_URL)
    quiet = 5
    qr = cv2.copyMakeBorder(qr, quiet, quiet, quiet, quiet, cv2.BORDER_CONSTANT, value=255)
    qr = cv2.resize(qr, (1500, 1500), interpolation=cv2.INTER_NEAREST)
    encoded, buffer = cv2.imencode('.png', qr)
    if not encoded:
        raise RuntimeError('Could not encode QR image')
    buffer.tofile(str(QR_PATH))

    width, height = 2480, 3508
    poster = Image.new('RGB', (width, height), '#171322')
    pixels = np.array(poster)
    yy, xx = np.mgrid[0:height, 0:width]
    glow = np.clip(1 - np.sqrt(((xx - width * 0.5) / (width * 0.75)) ** 2 + ((yy - height * 0.25) / (height * 0.62)) ** 2), 0, 1)
    pixels[:, :, 0] = np.clip(pixels[:, :, 0] + glow * 28, 0, 255)
    pixels[:, :, 1] = np.clip(pixels[:, :, 1] + glow * 19, 0, 255)
    pixels[:, :, 2] = np.clip(pixels[:, :, 2] + glow * 5, 0, 255)
    poster = Image.fromarray(pixels.astype(np.uint8))
    draw = ImageDraw.Draw(poster)

    gold = '#E0C46A'
    pale = '#F7F1DD'
    muted = '#C7BDCF'
    draw.rounded_rectangle((110, 110, width - 110, height - 110), radius=70, outline='#6F603F', width=5)
    draw.rounded_rectangle((145, 145, width - 145, height - 145), radius=58, outline='#403650', width=3)

    logo_path = ROOT / 'frontend' / 'public' / 'images' / 'brand' / 'termburg-fish.png'
    logo = Image.open(logo_path).convert('RGBA').resize((260, 260), Image.Resampling.LANCZOS)
    poster.alpha_composite(logo, (width // 2 - 130, 210)) if poster.mode == 'RGBA' else poster.paste(logo, (width // 2 - 130, 210), logo)

    centered(draw, 'ТЕРМБУРГ', 510, font(112, True), gold, width)
    centered(draw, 'МОСКВА', 655, font(42, True), muted, width)
    centered(draw, 'Играйте и получайте', 790, font(68, True), pale, width)
    centered(draw, 'награды Термбурга', 880, font(68, True), pale, width)

    qr_image = Image.open(QR_PATH).convert('RGB').resize((1530, 1530), Image.Resampling.NEAREST)
    qr_left = (width - qr_image.width) // 2
    qr_top = 1060
    draw.rounded_rectangle((qr_left - 45, qr_top - 45, qr_left + qr_image.width + 45, qr_top + qr_image.height + 45), radius=46, fill='#FFFFFF', outline=gold, width=10)
    poster.paste(qr_image, (qr_left, qr_top))

    centered(draw, 'Наведите камеру на QR-код', 2700, font(64, True), gold, width)
    centered(draw, 'Игры откроются в браузе — ничего скачивать не нужно', 2800, font(38), muted, width)
    centered(draw, 'Собирайте термокоины и обменивайте их на бонусы', 2905, font(42, True), pale, width)
    draw.line((400, 3070, width - 400, 3070), fill='#6F603F', width=4)
    centered(draw, 'Стресс долой — семья с тобой!', 3150, font(49, True), gold, width)
    centered(draw, 'tbgame.ru', 3265, font(34), muted, width)
    poster.save(POSTER_PATH, optimize=True)

    detector = cv2.QRCodeDetector()
    poster_cv = cv2.imdecode(np.fromfile(str(POSTER_PATH), dtype=np.uint8), cv2.IMREAD_COLOR)
    decoded, _, _ = detector.detectAndDecode(poster_cv)
    if decoded != TARGET_URL:
        raise RuntimeError(f'QR validation failed: {decoded!r}')
    print(f'QR_OK {decoded}')
    print(QR_PATH)
    print(POSTER_PATH)


if __name__ == '__main__':
    main()
