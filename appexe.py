from flask import Flask, request, send_file, render_template, jsonify
from rembg import new_session, remove
from PIL import Image, ImageFilter
import io
import uuid
import webbrowser
import threading

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

    # Konfigurasi presisi tinggi untuk hasil lebih bersih
    output_bytes = remove(
        input_bytes,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=10,
        session=session
    )

    # Post-processing untuk smoothing dan konversi RGBA
    img = Image.open(io.BytesIO(output_bytes)).convert("RGBA")
    img = img.filter(ImageFilter.SMOOTH_MORE)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)

    return send_file(buf, mimetype='image/png', as_attachment=False)

if __name__ == '__main__':
    def open_browser():
        webbrowser.open_new('http://127.0.0.1:5000')

    threading.Timer(1.5, open_browser).start()  # delay dikit biar server udah siap
    app.run(debug=False)
