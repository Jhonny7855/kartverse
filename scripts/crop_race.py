from PIL import Image

im = Image.open("scripts/out/driver_race_close.png")
crop = im.crop((560, 320, 740, 460))
crop = crop.resize((crop.width * 5, crop.height * 5), Image.LANCZOS)
crop.save("scripts/out/driver_race_zoom.png")
print(crop.size)

im2 = Image.open("scripts/out/driver_race_close.png")
crop2 = im2.crop((1020, 340, 1180, 440))
crop2 = crop2.resize((crop2.width * 5, crop2.height * 5), Image.LANCZOS)
crop2.save("scripts/out/rival_zoom.png")
print(crop2.size)
