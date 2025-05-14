from flask import Flask, request, send_file, render_template, jsonify
from rembg import new_session, remove
from PIL import Image, ImageFilter
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

@app.route('/process-single', methods=['POST'])
def process_single():
    file = request.files['image']
    input_bytes = file.read()
    output_bytes = remove(input_bytes, session=session)

    img = Image.open(io.BytesIO(output_bytes)).convert("RGBA")
    img = img.filter(ImageFilter.SMOOTH)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)

    return send_file(buf, mimetype='image/png', as_attachment=False)

if __name__ == '__main__':
    app.run(debug=True)
