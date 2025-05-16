from flask import Flask, request, send_file, render_template, jsonify
from rembg import new_session, remove
from PIL import Image, ImageFilter, ImageEnhance
import io
import uuid

app = Flask(__name__)
session = new_session(model_name='isnet-general-use')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/pricing')
def pricing():
    return render_template('pricing.html')

@app.route('/hapusbg/download')
def hapusbg():
    return render_template('hapusbg.html')


@app.route('/process-single', methods=['POST'])
def process_single():
    file = request.files['image']
    input_bytes = file.read()

    # Buka image asli dan simpan ukurannya
    original_img = Image.open(io.BytesIO(input_bytes)).convert("RGBA")
    original_size = original_img.size

    # Resize ke 1.5x untuk meningkatkan detail tepi
    upscale_size = (int(original_size[0] * 2.5), int(original_size[1] * 2.5))
    upscaled_img = original_img.resize(upscale_size, Image.LANCZOS)

    # Konversi gambar upscale ke bytes
    buf_upscaled = io.BytesIO()
    upscaled_img.save(buf_upscaled, format='PNG')
    buf_upscaled.seek(0)

    # Proses hapus background dengan alpha matting
    output_bytes = remove(
        buf_upscaled.getvalue(),
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=10,
        session=session
    )

    # Buka hasilnya, resize ke ukuran asli, lalu filter untuk smoothing
    result_img = Image.open(io.BytesIO(output_bytes)).convert("RGBA")
    result_img = result_img.resize(original_size, Image.LANCZOS)
    result_img = result_img.filter(ImageFilter.SMOOTH_MORE)

    # Simpan ke buffer untuk dikirim
    buf = io.BytesIO()
    result_img.save(buf, format='PNG')
    buf.seek(0)

    return send_file(buf, mimetype='image/png', as_attachment=False)
    
@app.route('/remove-bg-crop', methods=['POST'])
def remove_bg_crop():
    file = request.files['image']
    input_bytes = file.read()

    # Buka gambar hasil background removal
    result_img = Image.open(io.BytesIO(input_bytes)).convert("RGBA")

    # Deteksi bounding box dari objek yang masih tersisa
    bbox = result_img.getbbox()
    if bbox:
        cropped_img = result_img.crop(bbox)
    else:
        cropped_img = result_img  # fallback kalau bbox gak terdeteksi

    # Convert ke BytesIO untuk diunduh
    buf = io.BytesIO()
    cropped_img.save(buf, format="PNG")
    buf.seek(0)

    return send_file(buf, mimetype="image/png")

if __name__ == '__main__':
    app.run(debug=True)
