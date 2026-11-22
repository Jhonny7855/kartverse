from PIL import Image

for name, box in [
    ("driver_closeup", (480, 230, 800, 520)),
    ("driver_side", (380, 220, 700, 500)),
]:
    im = Image.open(f"scripts/out/{name}.png")
    crop = im.crop(box)
    crop = crop.resize((crop.width * 3, crop.height * 3), Image.LANCZOS)
    crop.save(f"scripts/out/{name}_zoom.png")
    print(name, crop.size)
