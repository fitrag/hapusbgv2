from flask import Flask, request, send_file, render_template, jsonify
from rembg import new_session, remove
from PIL import Image, ImageFilter, ImageEnhance
import numpy as np

import requests
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
    import gc

    file = request.files['image']
    input_bytes = file.read()

    # Buka image asli
    original_img = Image.open(io.BytesIO(input_bytes)).convert("RGBA")
    original_size = original_img.size

    # Batasi ukuran gambar asli jika terlalu besar
    MAX_DIM = 2048
    if max(original_size) > MAX_DIM:
        scale = MAX_DIM / max(original_size)
        new_size = (int(original_size[0] * scale), int(original_size[1] * scale))
        original_img = original_img.resize(new_size, Image.LANCZOS)
        original_size = new_size

    # Upscale lebih besar untuk presisi tepi
    upscale_factor = 1.6
    upscale_size = (int(original_size[0] * upscale_factor), int(original_size[1] * upscale_factor))
    upscaled_img = original_img.resize(upscale_size, Image.LANCZOS)

    # Simpan gambar upscale ke buffer
    buf_upscaled = io.BytesIO()
    upscaled_img.save(buf_upscaled, format='PNG')
    buf_upscaled.seek(0)

    # Proses remove background presisi tinggi
    output_bytes = remove(
        buf_upscaled.getvalue(),
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=15,  # lebih besar, pinggiran lebih bersih
        session=session
    )

    # Load hasilnya
    result_img = Image.open(io.BytesIO(output_bytes)).convert("RGBA")

    # Resize kembali ke ukuran awal
    result_img = result_img.resize(original_size, Image.LANCZOS)

    # Tambahkan filter smoothing tambahan
    result_img = result_img.filter(ImageFilter.SMOOTH_MORE)

    # Simpan hasil akhir ke buffer
    buf = io.BytesIO()
    result_img.save(buf, format='PNG')
    buf.seek(0)

    # Cleanup memory
    del result_img, buf_upscaled, output_bytes, upscaled_img
    gc.collect()

    return send_file(buf, mimetype='image/png', as_attachment=False)


@app.route('/refine-background', methods=['POST'])
def refine_background():
    if 'image' not in request.files or 'mask' not in request.files:
        return jsonify({'error': 'Both image and mask files are required'}), 400

    image_file = request.files['image']
    mask_file = request.files['mask']

    try:
        image = Image.open(image_file).convert('RGBA')
        mask = Image.open(mask_file).convert('L')  # grayscale mask

        image_np = np.array(image)
        mask_np = np.array(mask)

        if mask_np.shape[:2] != image_np.shape[:2]:
            return jsonify({'error': 'Mask and image dimensions must match'}), 400

        # Terapkan mask: bagian putih akan dihapus (alpha=0)
        alpha = image_np[:, :, 3]
        alpha = np.where(mask_np > 10, 0, alpha)  # nilai threshold mask
        image_np[:, :, 3] = alpha

        result = Image.fromarray(image_np)

        output = io.BytesIO()
        result.save(output, format='PNG')
        output.seek(0)

        return send_file(output, mimetype='image/png')
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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

@app.route('/magic-brush', methods=['POST'])
def magic_brush():
    try:
        image_file = request.files['image']
        mask_file = request.files['mask']

        image = Image.open(image_file.stream).convert('RGBA')
        mask = Image.open(mask_file.stream).convert('L')  # grayscale

        # Convert to numpy arrays
        np_image = np.array(image)
        np_mask = np.array(mask)

        # Buat biner mask (255 = area terseleksi)
        binary_mask = np.where(np_mask > 10, 255, 0).astype(np.uint8)

        # Hapus seluruh gambar dengan rembg
        removed = remove(image_file.stream.read())
        removed_image = Image.open(io.BytesIO(removed)).convert('RGBA')
        np_removed = np.array(removed_image)

        # Gabungkan hanya bagian yang terseleksi
        combined = np.where(binary_mask[..., None] == 255, np_removed, np_image)

        final = Image.fromarray(combined, 'RGBA')
        output = io.BytesIO()
        final.save(output, format='PNG')
        output.seek(0)
        return send_file(output, mimetype='image/png')

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
